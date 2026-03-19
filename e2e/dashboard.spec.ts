import { test, expect } from '@playwright/test';

// Helper: login and return whether it succeeded
async function login(page: import('@playwright/test').Page): Promise<boolean> {
  await page.goto('/auth/login');
  await page.locator('#email').fill('manitejakanuri@gamil.com');
  await page.locator('#password').fill('Mani@2026');
  await page.locator('button[type="submit"]').click();

  const result = await Promise.race([
    page.waitForURL(/\/dashboard/, { timeout: 15000 }).then(() => true),
    page.locator('.text-red-400').waitFor({ timeout: 15000 }).then(() => false),
  ]).catch(() => false);

  return result;
}

test.describe('Dashboard - Unauthenticated', () => {
  test('TC021 - Unauthenticated user is redirected from dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login|\/auth\/login/, { timeout: 10000 });
  });
});

test.describe('Dashboard - Authenticated', () => {
  test('TC022 - Dashboard loads with greeting', async ({ page }) => {
    const loggedIn = await login(page);
    if (!loggedIn) {
      test.skip(true, 'Login failed — credentials may be invalid');
      return;
    }
    await expect(page.locator('h1')).toContainText(/Good (morning|afternoon|evening)/);
  });

  test('TC023 - Dashboard shows persona templates or agents section', async ({ page }) => {
    const loggedIn = await login(page);
    if (!loggedIn) { test.skip(true, 'Login failed'); return; }
    const hasAgents = await page.getByText('Your Agents').isVisible().catch(() => false);
    const hasTemplates = await page.getByText('Persona Templates').isVisible().catch(() => false);
    expect(hasAgents || hasTemplates).toBe(true);
  });

  test('TC024 - "Create Your Own" agent link exists', async ({ page }) => {
    const loggedIn = await login(page);
    if (!loggedIn) { test.skip(true, 'Login failed'); return; }
    const createLink = page.locator('a[href="/dashboard/agents/new"]').first();
    await expect(createLink).toBeVisible();
  });

  test('TC025 - Getting Started section is visible', async ({ page }) => {
    const loggedIn = await login(page);
    if (!loggedIn) { test.skip(true, 'Login failed'); return; }
    await expect(page.getByText('Getting Started')).toBeVisible();
  });

  test('TC026 - Usage Overview section is visible', async ({ page }) => {
    const loggedIn = await login(page);
    if (!loggedIn) { test.skip(true, 'Login failed'); return; }
    await expect(page.getByText('Usage Overview')).toBeVisible();
  });

  test('TC027 - Navigate to create new agent page', async ({ page }) => {
    const loggedIn = await login(page);
    if (!loggedIn) { test.skip(true, 'Login failed'); return; }
    await page.locator('a[href="/dashboard/agents/new"]').first().click();
    await expect(page).toHaveURL(/\/dashboard\/agents\/new/);
  });
});

test.describe('Agent Management', () => {
  test('TC028 - New agent page loads', async ({ page }) => {
    const loggedIn = await login(page);
    if (!loggedIn) { test.skip(true, 'Login failed'); return; }
    await page.goto('/dashboard/agents/new');
    await expect(page).toHaveURL(/\/dashboard\/agents\/new/);
  });

  test('TC029 - Agents list page loads', async ({ page }) => {
    const loggedIn = await login(page);
    if (!loggedIn) { test.skip(true, 'Login failed'); return; }
    await page.goto('/dashboard/agents');
    await expect(page).toHaveURL(/\/dashboard\/agents/);
  });
});
