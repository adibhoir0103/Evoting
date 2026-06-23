import { test, expect } from '@playwright/test';

test.describe('Admin E2E Flow', () => {
  test('should successfully log in and see the admin dashboard', async ({ page }) => {
    // Navigate to admin login
    await page.goto('/admin-login');

    // Wait for Turnstile to automatically pass (since we are using the 1x...AA test key)
    // and wait for the "Login to Command Center" button to be enabled
    const submitBtn = page.getByRole('button', { name: /login to command center/i });
    
    // Fill in admin credentials. We fallback to the defaults found in the backend code
    // if the env vars are missing during test execution.
    await page.getByPlaceholder('admin@evote.gov.in').fill(process.env.ADMIN_EMAIL || 'admin@evote.com');
    await page.getByPlaceholder('••••••••').fill(process.env.ADMIN_PASSWORD || process.env.ADMIN_DEV_PASSWORD || 'Admin@modern7');

    // Submit the form
    await submitBtn.click();

    // Verify successful redirection to the admin dashboard
    await expect(page).toHaveURL(/\/admin-panel/);

    // Verify the command center UI elements load
    await expect(page.getByText('Admin Command Center')).toBeVisible();
    await expect(page.getByText('Total Registered Voters')).toBeVisible();
  });

  test('should show error on invalid admin credentials', async ({ page }) => {
    await page.goto('/admin-login');

    const submitBtn = page.getByRole('button', { name: /login to command center/i });
    
    await page.getByPlaceholder('admin@evote.gov.in').fill('wrongadmin@evote.com');
    await page.getByPlaceholder('••••••••').fill('wrongpassword123');

    await submitBtn.click();

    // Verify the toast error or inline error appears
    await expect(page.locator('.Toastify__toast-body, [role="status"], .text-red-500').filter({ hasText: /invalid/i }).first()).toBeVisible({ timeout: 5000 });
  });
});
