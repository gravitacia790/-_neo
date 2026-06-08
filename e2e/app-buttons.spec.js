const { test, expect } = require('@playwright/test');

const E2E_PASSWORD = 'e2e-pass-12345';
const ADMIN_EMAIL = 'admin@test.ru';
const ADMIN_PASSWORD = 'admin123';
let e2eUserCounter = 0;

function nextE2eEmail() {
  e2eUserCounter += 1;
  return 'e2e-director-' + Date.now() + '-' + e2eUserCounter + '@school.ru';
}

async function registerOrLogin(page) {
  const email = nextE2eEmail();
  await page.goto('/');
  await expect(page.locator('#loginBtn')).toBeVisible();

  await page.click('#registerBtn');
  await page.fill('#regName', 'E2E Director');
  await page.fill('#regEmail', email);
  await page.fill('#regPhone', '+7 (999) 000-00-01');
  await page.fill('#regPassword', E2E_PASSWORD);
  await page.click('#doRegisterBtn');

  const appVisible = await page.locator('#mainContent').waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false);
  if (!appVisible) {
    await page.click('.modal-overlay .close-modal');
    await page.click('#loginBtn');
    await expect(page.locator('#doLoginBtn')).toBeVisible();
    await page.fill('#loginEmail', email);
    await page.fill('#loginPassword', E2E_PASSWORD);
    await page.click('#doLoginBtn');
  }

  await expect(page.locator('#mainContent')).toBeVisible();
  await expect(page.locator('#directors.active')).toBeVisible();
  await expect(page.locator('#logoutBtn')).toBeVisible();
}

test.describe('UI buttons DB flows', () => {
  test('mobile splash shows auth buttons and hides bottom nav when logged out', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
      isMobile: true,
      hasTouch: true,
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    await context.clearCookies();
    await page.goto('/');

    await expect(page.locator('#splashScreen')).toBeVisible();
    await expect(page.locator('#loginBtn')).toBeVisible();
    await expect(page.locator('#registerBtn')).toBeVisible();
    await expect(page.locator('#mobileBottomNav')).toBeHidden();

    await context.close();
  });

  test('start screen auth buttons and session flow', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#loginBtn')).toBeVisible();
    await expect(page.locator('#registerBtn')).toBeVisible();

    await registerOrLogin(page);
    await expect(page.locator('#mainContent')).toBeVisible();

    await page.click('#logoutBtn');
    await expect(page.locator('#splashScreen')).toBeVisible();
  });

  test('notifications button opens DB-backed list', async ({ page }) => {
    await registerOrLogin(page);

    const notifBadge = page.locator('#notifBadge');
    await page.click('#notifBell');
    await expect(page.locator('#notifDropdown')).toBeVisible();
    await expect(page.locator('#notifList')).toBeVisible();

    await page.click('#notifMarkAllRead');
    await expect(page.locator('#notifDropdown')).toBeVisible();
    await expect(notifBadge).toBeHidden();
  });

  test('directors and events action buttons keep backend connectivity', async ({ page }) => {
    await registerOrLogin(page);

    await page.click('#topNav button[data-tab="directors"]');
    await expect(page.locator('#directorsList')).toBeVisible();

    const favoriteBtn = page.locator('[data-action="favorite"]').first();
    await expect(favoriteBtn).toBeVisible();
    await favoriteBtn.click();

    const contactBtn = page.locator('[data-action="contact"]').first();
    await contactBtn.click();
    await expect(page.locator('#contactActionsModal')).toBeVisible();
    await expect(page.locator('#contactActionsModal [data-contact-action="phone"]')).toBeVisible();
    await page.click('.modal-overlay .close-modal');

    await page.click('#moreNavBtn');
    await page.click('#moreRow button[data-tab="events"]');
    await expect(page.locator('#eventsList')).toBeVisible();
    await page.fill('#eventTitle', 'E2E Event');
    await page.fill('#eventDate', '30 июня 2026');
    await page.fill('#eventDesc', 'E2E auto event');
    await page.fill('#eventMax', '20');
    await page.click('#createEventBtn');
    await expect(page.locator('#eventsList')).toContainText('E2E Event');

    await page.reload();
    await expect(page.locator('#mainContent')).toBeVisible();
    await page.click('#moreNavBtn');
    await page.click('#moreRow button[data-tab="events"]');
    await expect(page.locator('#eventsList')).toContainText('E2E Event');
  });

  test('profile and school save buttons persist through DB-backed APIs', async ({ page }) => {
    await registerOrLogin(page);

    await page.click('#moreNavBtn');
    await page.click('#moreRow button[data-tab="profile"]');
    await expect(page.locator('#profile.active #saveProfileBtn')).toBeVisible();
    await page.fill('#directorPhone', '+7 (999) 111-22-33');
    await page.fill('#uniqueExperience', 'E2E уникальный опыт');
    await page.fill('#personalInterests', 'E2E интересы');
    await page.click('#saveProfileBtn');
    await expect(page.locator('#profile .form-status-box')).toContainText('Профиль сохранён');

    await page.click('#moreNavBtn');
    await page.click('#moreRow button[data-tab="school"]');
    await expect(page.locator('#doSaveSchool')).toBeVisible();
    const editBtn = page.locator('#editSchoolBtn');
    if (await editBtn.isVisible().catch(() => false)) {
      await editBtn.click();
    }
    await page.fill('#schoolName', 'E2E School');
    await page.fill('#schoolAddress', 'Москва, E2E, 1');
    await page.fill('#usefulExperience', 'Помогаем с управлением');
    await page.fill('#wantToKnow', 'Хотим изучить новые подходы');
    await page.click('#doSaveSchool');
    await expect(page.locator('#school .form-status-box')).toContainText('Информация о школе сохранена');

    await page.reload();
    await expect(page.locator('#mainContent')).toBeVisible();
    await page.click('#moreNavBtn');
    await page.click('#moreRow button[data-tab="school"]');
    await expect(page.locator('#schoolView')).toContainText('E2E School');
  });

  test('extras and calendar buttons execute full click path', async ({ page, context }) => {
    await registerOrLogin(page);

    page.on('dialog', async (dialog) => {
      const msg = dialog.message().toLowerCase();
      if (msg.includes('фио')) await dialog.accept('E2E Employee');
      else if (msg.includes('должность')) await dialog.accept('Методист');
      else if (msg.includes('школ')) await dialog.accept('E2E School');
      else await dialog.dismiss();
    });

    await page.click('#moreNavBtn');
    await page.click('#moreRow button[data-tab="gl"]');
    await expect(page.locator('#gl [data-action="reg"]').first()).toBeVisible();
    await page.locator('#gl [data-action="reg"]').first().click();

    await page.click('#moreNavBtn');
    await page.click('#moreRow button[data-tab="internship"]');
    await expect(page.locator('#internship [data-action="reg"]').first()).toBeVisible();
    await page.locator('#internship [data-action="reg"]').first().click();

    await page.click('#moreNavBtn');
    await page.click('#moreRow button[data-tab="calendar"]');
    await expect(page.locator('#calendar .cal-nav[data-dir="next"]')).toBeVisible();
    await page.click('#calendar .cal-nav[data-dir="next"]');
    await page.click('#calendar .cal-nav[data-dir="prev"]');

    const eventDay = page.locator('#calendar .cal-day.cal-has-events').first();
    if (await eventDay.isVisible().catch(() => false)) {
      await eventDay.click();
      await expect(page.locator('#closeCalDetail')).toBeVisible();
      await page.click('#closeCalDetail');
    }

    await context.clearCookies();
  });

  test('admin tab loads DB-backed admin panel', async ({ page }) => {
    await page.goto('/');
    await page.click('#loginBtn');
    await page.fill('#loginEmail', ADMIN_EMAIL);
    await page.fill('#loginPassword', ADMIN_PASSWORD);
    await page.click('#doLoginBtn');
    await expect(page.locator('#mainContent')).toBeVisible();

    await page.click('#moreNavBtn');
    const adminBtn = page.locator('#moreRow button[data-tab="admin"]');
    await expect(adminBtn).toBeVisible();
    await adminBtn.click();
    await expect(page.locator('#admin .admin-table')).toBeVisible();
  });

  test('mobile more button opens and closes sheet', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await registerOrLogin(page);

    const mobileMore = page.locator('#mobileMoreBtn');
    await expect(mobileMore).toBeVisible();
    await mobileMore.click();
    await expect(page.locator('#moreSheet')).toBeVisible();
    await expect(page.locator('#moreSheetBackdrop')).toBeVisible();

    await page.click('#moreSheetClose');
    await expect(page.locator('#moreSheet')).toBeHidden();

    await context.close();
  });

  test('mobile detail modal closes and more sheet opens from more tabs', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await registerOrLogin(page);

    await page.click('#mobileBottomNav button[data-tab="directors"]');
    const detailBtn = page.locator('[data-action="detail"]').first();
    await expect(detailBtn).toBeVisible();
    await detailBtn.click();
    const detailModal = page.locator('.modal-overlay .modal-content').first();
    await expect(detailModal).toBeVisible();

    await page.click('.modal-overlay .close-modal');
    await expect(detailModal).toBeHidden();

    await page.click('#mobileMoreBtn');
    await page.click('#moreSheet [data-tab="gl"]');
    await expect(page.locator('#gl')).toBeVisible();

    await page.click('#mobileMoreBtn');
    await expect(page.locator('#moreSheet')).toBeVisible();
    await context.close();
  });

  test('mobile navigation switches between primary and more tabs', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await registerOrLogin(page);

    await page.click('#mobileMoreBtn');
    await page.click('#moreSheet [data-tab="events"]');
    await expect(page.locator('#events.active')).toBeVisible();
    await page.click('#mobileBottomNav button[data-tab="directors"]');
    await expect(page.locator('#directors.active')).toBeVisible();

    await page.click('#mobileMoreBtn');
    await page.click('#moreSheet [data-tab="events"]');
    await expect(page.locator('#events.active')).toBeVisible();
    await context.close();
  });
});

