import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('TC001 - Page loads with correct title and hero', async ({ page }) => {
    await expect(page).toHaveTitle(/Talk to Site/i);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('h1')).toContainText('Meet Your');
  });

  test('TC002 - Navigation has Sign In and Get Started links', async ({ page }) => {
    const signIn = page.locator('a[href="/auth/login"]', { hasText: 'Sign In' });
    const getStarted = page.locator('a[href="/auth/signup"]', { hasText: 'Get Started' });
    await expect(signIn).toBeVisible();
    await expect(getStarted).toBeVisible();
  });

  test('TC003 - Hero CTA "Create Your Agent" links to signup', async ({ page }) => {
    const cta = page.locator('a[href="/auth/signup"]', { hasText: 'Create Your Agent' });
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(/\/auth\/signup/);
  });

  test('TC004 - Feature cards are displayed', async ({ page }) => {
    await expect(page.getByText('Real-Time Faces')).toBeVisible();
    await expect(page.getByText('Voice Intelligence')).toBeVisible();
    await expect(page.getByText('Website Trained')).toBeVisible();
    await expect(page.getByText('Lightning Fast')).toBeVisible();
  });

  test('TC005 - Stats section shows metrics', async ({ page }) => {
    await expect(page.getByText('500ms', { exact: true })).toBeVisible();
    await expect(page.getByText('99.9%', { exact: true })).toBeVisible();
    await expect(page.getByText('50+', { exact: true })).toBeVisible();
  });

  test('TC006 - Sign In link navigates to login page', async ({ page }) => {
    await page.locator('a[href="/auth/login"]', { hasText: 'Sign In' }).click();
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('TC007 - Page is responsive (mobile viewport)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('a[href="/auth/signup"]', { hasText: 'Create Your Agent' })).toBeVisible();
  });
});
