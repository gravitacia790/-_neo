const { test, expect } = require('@playwright/test');

const E2E_PASSWORD = 'e2e-pass-12345';
const ADMIN_EMAIL = 'admin@test.ru';
const ADMIN_PASSWORD = 'admin123';
let e2eUserCounter = 0;

function nextE2eEmail() {
  e2eUserCounter += 1;
  return 'e2e-smoke-' + Date.now() + '-' + e2eUserCounter + '@school.ru';
}

async function registerOrLogin(page) {
  const email = nextE2eEmail();
  await page.goto('/');
  await expect(page.locator('#loginBtn')).toBeVisible();

  await page.click('#registerBtn');
  await page.fill('#regName', 'E2E Smoke Director');
  await page.fill('#regEmail', email);
  await page.fill('#regPhone', '+7 (999) 000-10-10');
  await page.fill('#regPassword', E2E_PASSWORD);
  await page.click('#doRegisterBtn');

  await expect(page.getByText('Заявка отправлена', { exact: true })).toBeVisible();
  await approveApplication(page, email);
  await page.locator('[data-dialog-action="ok"]').click();
  await expect(page.locator('#doLoginBtn')).toBeVisible();
  await page.fill('#loginEmail', email);
  await page.fill('#loginPassword', E2E_PASSWORD);
  await page.click('#doLoginBtn');

  await expect(page.locator('#mainContent')).toBeVisible();
  await expect(page.locator('#directors.active')).toBeVisible();
}

async function approveApplication(page, email) {
  const request = page.context().request;
  await request.get('/csrf-bootstrap');
  const cookies = await page.context().cookies();
  const csrf = cookies.find((cookie) => cookie.name === 'csrf');
  expect(csrf).toBeTruthy();
  const headers = { 'X-CSRF-Token': csrf.value };
  const login = await request.post('/api/auth/login', {
    headers,
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(login.ok()).toBeTruthy();
  const applications = await request.get('/api/admin/applications');
  const body = await applications.json();
  const application = body.applications.find((item) => item.email === email);
  expect(application).toBeTruthy();
  const approval = await request.put('/api/admin/applications/' + application.id, {
    headers,
    data: { status: 'approved' },
  });
  expect(approval.ok()).toBeTruthy();
  await request.post('/api/auth/logout', { headers });
}

test.describe('Critical smoke flows', () => {
  test('auth + directors/events render + register/cancel lifecycle', async ({ page }) => {
    await registerOrLogin(page);

    await page.click('#topNav button[data-tab="directors"]');
    await expect(page.locator('#directors.active')).toBeVisible();
    await expect(page.locator('#directorsList')).toBeVisible();
    await expect(page.locator('#directorsList .director-card').first()).toBeVisible();

    await page.click('#moreNavBtn');
    await page.click('#moreRow button[data-tab="events"]');
    await expect(page.locator('#events.active')).toBeVisible();
    await expect(page.locator('#eventsList')).toBeVisible();

    const eventTitle = 'E2E Smoke Event ' + Date.now();
    await page.fill('#eventTitle', eventTitle);
    await page.fill('#eventDate', '2026-07-01T10:00');
    await page.fill('#eventDesc', 'Critical smoke event');
    await page.fill('#eventMax', '5');
    await page.click('#createEventBtn');

    await expect(page.locator('#eventsList')).toContainText(eventTitle);

    const targetCard = page.locator('#eventsList .event-card').filter({ hasText: eventTitle }).first();
    await expect(targetCard).toBeVisible();

    const regButton = targetCard.locator('[data-action="reg"]');
    if (await regButton.isVisible().catch(() => false)) {
      await regButton.click();
      const modal = page.locator('.modal-overlay').last();
      await expect(modal.locator('#registrationForm')).toBeVisible();
      await modal.locator('#regParticipantSchool').fill('Smoke School');
      await modal.locator('#regParticipantCity').fill('Moscow');
      await modal.locator('#registrationSubmitBtn').click();
      await expect(modal).toBeHidden();
      await expect(targetCard).toContainText('E2E Smoke Director');

      const cancelBtn = targetCard.locator('[data-action="cancel-reg"]').first();
      if (await cancelBtn.isVisible().catch(() => false)) {
        await cancelBtn.click();
        const confirmModal = page.locator('.modal-overlay').last();
        await expect(confirmModal.locator('[data-dialog-action="confirm"]')).toBeVisible();
        await confirmModal.locator('[data-dialog-action="confirm"]').click();
        await expect(confirmModal).toBeHidden();
      }
    }
  });
});
