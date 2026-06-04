const { test, expect } = require('@playwright/test');

const E2E_EMAIL = 'e2e-director@school.ru';
const E2E_PASSWORD = 'e2e-pass-12345';
const ADMIN_EMAIL = 'admin@test.ru';
const ADMIN_PASSWORD = 'admin123';

async function registerOrLogin(page) {
  await page.goto('/');
  await expect(page.locator('#loginBtn')).toBeVisible();

  await page.click('#registerBtn');
  await page.fill('#regName', 'E2E Director');
  await page.fill('#regEmail', E2E_EMAIL);
  await page.fill('#regPhone', '+7 (999) 000-00-01');
  await page.fill('#regPassword', E2E_PASSWORD);
  await page.click('#doRegisterBtn');

  const loginModal = page.locator('#doLoginBtn');
  if (await loginModal.isVisible().catch(() => false)) {
    await page.fill('#loginEmail', E2E_EMAIL);
    await page.fill('#loginPassword', E2E_PASSWORD);
    await page.click('#doLoginBtn');
  }

  await expect(page.locator('#mainContent')).toBeVisible();
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

    await page.click('#loginBtn');
    await expect(page.locator('#doLoginBtn')).toBeVisible();
    await page.fill('#loginEmail', E2E_EMAIL);
    await page.fill('#loginPassword', E2E_PASSWORD);
    await page.click('#doLoginBtn');

    if (await page.locator('#doRegisterBtn').isVisible().catch(() => false)) {
      await page.fill('#regName', 'E2E Director');
      await page.fill('#regEmail', E2E_EMAIL);
      await page.fill('#regPhone', '+7 (999) 000-00-01');
      await page.fill('#regPassword', E2E_PASSWORD);
      await page.click('#doRegisterBtn');
    }

    await expect(page.locator('#mainContent')).toBeVisible();

    await page.click('#logoutBtn');
    await expect(page.locator('#splashScreen')).toBeVisible();
  });

  test('messages and notifications buttons open DB-backed lists', async ({ page }) => {
    await registerOrLogin(page);

    const notifBadge = page.locator('#notifBadge');
    await page.click('#notifBell');
    await expect(page.locator('#notifDropdown')).toBeVisible();
    await expect(page.locator('#notifList')).toBeVisible();

    await page.click('#notifMarkAllRead');
    await expect(page.locator('#notifDropdown')).toBeVisible();
    await expect(notifBadge).toBeHidden();

    const msgBadge = page.locator('#msgBadge');
    await page.click('#msgBtn');
    await expect(page.locator('#msgDropdown')).toBeVisible();
    await expect(page.locator('#msgList')).toBeVisible();
    await expect(msgBadge).toBeHidden();
  });

  test('directors and events action buttons keep backend connectivity', async ({ page }) => {
    await registerOrLogin(page);

    await page.click('button[data-tab="directors"]');
    await expect(page.locator('#directorsList')).toBeVisible();

    const favoriteBtn = page.locator('[data-action="favorite"]').first();
    await expect(favoriteBtn).toBeVisible();
    await favoriteBtn.click();

    const contactBtn = page.locator('[data-action="contact"]').first();
    await contactBtn.click();
    await expect(page.locator('#msgSendBtn')).toBeVisible();
    await page.fill('#msgText', 'E2E ping');
    await page.click('#msgSendBtn');

    await page.click('button[data-tab="events"]');
    await expect(page.locator('#eventsList')).toBeVisible();
    await page.fill('#eventTitle', 'E2E Event');
    await page.fill('#eventDate', '30 июня 2026');
    await page.fill('#eventDescription', 'E2E auto event');
    await page.fill('#eventMax', '20');
    await page.click('#createEventBtn');
    await expect(page.locator('#eventsList')).toContainText('E2E Event');

    await page.reload();
    await expect(page.locator('#mainContent')).toBeVisible();
    await page.click('button[data-tab="events"]');
    await expect(page.locator('#eventsList')).toContainText('E2E Event');
  });

  test('profile and school save buttons persist through DB-backed APIs', async ({ page }) => {
    await registerOrLogin(page);

    await page.click('button[data-tab="profile"]');
    await expect(page.locator('#saveProfileBtn')).toBeVisible();
    await page.fill('#directorPhone', '+7 (999) 111-22-33');
    await page.fill('#uniqueExperience', 'E2E уникальный опыт');
    await page.fill('#personalInterests', 'E2E интересы');
    await page.click('#saveProfileBtn');
    await expect(page.locator('#profile .form-status')).toContainText('Профиль сохранён');

    await page.click('button[data-tab="school"]');
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
    await expect(page.locator('#school .form-status')).toContainText('Информация о школе сохранена');

    await page.reload();
    await expect(page.locator('#mainContent')).toBeVisible();
    await page.click('button[data-tab="school"]');
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

  test('mobile swipe right closes director detail and reopens more sheet from more tabs', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await registerOrLogin(page);

    await page.click('button[data-tab="directors"]');
    const detailBtn = page.locator('[data-action="detail"]').first();
    await expect(detailBtn).toBeVisible();
    await detailBtn.click();
    const detailModal = page.locator('.modal-overlay .modal-content').first();
    await expect(detailModal).toBeVisible();

    await detailModal.dispatchEvent('touchstart', {
      touches: [{ identifier: 1, clientX: 20, clientY: 220 }],
      changedTouches: [{ identifier: 1, clientX: 20, clientY: 220 }],
    });
    await detailModal.dispatchEvent('touchend', {
      touches: [],
      changedTouches: [{ identifier: 1, clientX: 180, clientY: 230 }],
    });
    await expect(detailModal).toBeHidden();

    await page.click('#mobileMoreBtn');
    await page.click('#moreSheet [data-tab="gl"]');
    await expect(page.locator('#gl')).toBeVisible();

    const main = page.locator('#mainContent');
    await main.dispatchEvent('touchstart', {
      touches: [{ identifier: 2, clientX: 18, clientY: 300 }],
      changedTouches: [{ identifier: 2, clientX: 18, clientY: 300 }],
    });
    await main.dispatchEvent('touchend', {
      touches: [],
      changedTouches: [{ identifier: 2, clientX: 170, clientY: 310 }],
    });

    await expect(page.locator('#moreSheet')).toBeVisible();
    await context.close();
  });
});

