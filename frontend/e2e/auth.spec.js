import { test, expect } from '@playwright/test';

// Helper to generate a random 12 digit Aadhaar
function generateAadhaar() {
  return Math.floor(100000000000 + Math.random() * 900000000000).toString();
}

test.describe('Authentication E2E Flow', () => {
  const testAadhaar = generateAadhaar();
  const testPassword = 'SecurePassword123!';

  test('should successfully register a new user', async ({ page }) => {
    // Call the dev-only backdoor to seed the random Aadhaar into the ApprovedVoters whitelist
    await fetch('http://localhost:5000/api/v1/test/seed-voter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aadhaar: testAadhaar })
    });

    await page.goto('/signup');

    // Fill Registration Form
    await page.getByPlaceholder('Ex: 1234 5678 9012').fill(testAadhaar);
    await page.getByPlaceholder('Doe').fill('Test User');
    await page.getByPlaceholder('Ex: 01/01/1990').fill('01/01/1990');
    // Ensure email is unique per test run
    await page.getByPlaceholder('john@example.com').fill(`testuser_${testAadhaar}@example.com`);
    await page.getByPlaceholder('••••••••').first().fill(testPassword);
    
    // Playwright locator for confirm password based on type/placeholder
    const confirmInput = page.locator('input[type="password"]').nth(1);
    await confirmInput.fill(testPassword);

    await page.getByRole('button', { name: /create account/i }).click();

    // Verify successful registration routes to login or shows success message
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('.Toastify__toast-body, [role="status"]').filter({ hasText: /success/i }).first()).toBeVisible();
  });

  test('should login successfully with the test user', async ({ page }) => {
    await page.goto('/login');

    await page.getByPlaceholder('Aadhaar or Email').fill(testAadhaar);
    await page.getByPlaceholder('••••••••').fill(testPassword);

    await page.getByRole('button', { name: /continue securely/i }).click();

    // The backend should return 200 and route to the OTP screen
    await expect(page.getByText('Security Verification')).toBeVisible({ timeout: 10000 });
    
    // Now enter the '000000' dev backdoor OTP
    const otpInputs = page.locator('input[type="text"]').or(page.locator('input[type="tel"]')).elementHandles();
    // Assuming a 6-digit split input or single input
    const inputs = await page.locator('input[aria-label="Digit 1"], input.w-12').all();
    if (inputs.length === 6) {
      for (let i = 0; i < 6; i++) {
        await inputs[i].fill('0');
      }
    } else {
        // Fallback if it's a single input
        const singleInput = page.getByPlaceholder(/OTP|Code/i);
        if (await singleInput.isVisible()) {
            await singleInput.fill('000000');
        }
    }

    await page.getByRole('button', { name: /verify/i }).click();

    // Verify routing to voter dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText('Voter Dashboard')).toBeVisible();
  });
});
