// Native fetch is available in Node 18+

async function testMobileOtp() {
    console.log('Testing Mobile OTP Request...');

    // Payload simulating exactly what LoginPage.js sends for Mobile
    const payload = {
        aadhaarNumber: '710665114572', // User's Aaadhaar from screenshot
        method: 'mobile',
        mobileNumber: '9876543210' // Mock mobile, backend should check if it matches DB
    };

    try {
        const response = await fetch('http://localhost:5000/api/auth/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        console.log('Response Status:', response.status);
        console.log('Response Data:', data);
    } catch (error) {
        console.error('Test Failed:', error);
    }
}

testMobileOtp();
