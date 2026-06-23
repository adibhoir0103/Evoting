import { test, expect } from '@playwright/test';

function generateAadhaar() {
  return Math.floor(100000000000 + Math.random() * 900000000000).toString();
}

test.describe('Voting Terminal E2E Flow', () => {
  const testAadhaar = generateAadhaar();
  const testPassword = 'SecurePassword123!';

  test.beforeEach(async ({ request }) => {
    // Seed voter whitelist
    await request.post('http://localhost:5000/api/v1/test/seed-voter', {
      data: { aadhaar: testAadhaar }
    });

    // Register user via API to skip UI registration step
    await request.post('http://localhost:5000/api/v1/auth/register', {
      data: {
        fullname: 'Voting Test User',
        identifier: testAadhaar,
        dob: '01/01/1990',
        email: `vote_${testAadhaar}@example.com`,
        password: testPassword,
        turnstileToken: '1x00000000000000000000AA'
      }
    });
  });

  test('should navigate to voting terminal and prompt for wallet connection', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.getByPlaceholder('Aadhaar or Email').fill(testAadhaar);
    await page.getByPlaceholder('••••••••').fill(testPassword);
    await page.getByRole('button', { name: /continue securely/i }).click();

    // Dev backdoor OTP
    await expect(page.getByText('Security Verification')).toBeVisible();
    const inputs = await page.locator('input[aria-label^="Digit"], input.w-12').all();
    if (inputs.length === 6) {
      for (let i = 0; i < 6; i++) {
        await inputs[i].fill('0');
      }
    } else {
      await page.getByPlaceholder(/OTP|Code/i).fill('000000');
    }
    await page.getByRole('button', { name: /verify/i }).click();

    // Verify Dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Click Cast Vote Securely
    await page.getByRole('link', { name: /cast vote securely/i }).first().click();

    // Expect Voting Terminal UI
    await expect(page).toHaveURL(/\/vote/);
    await expect(page.getByText('State Assembly Election 2026 — Voting Terminal')).toBeVisible();

    // Since this is an automated browser without MetaMask installed, it should prompt for connection
    await expect(page.getByRole('button', { name: /Verify Secure Identity/i })).toBeVisible();
    await expect(page.getByText('Connect Secure Vault')).toBeVisible();
  });
});
