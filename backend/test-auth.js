const email = `test-${Date.now()}@test.com`;
const password = 'TestPassword123!';
const aadhaarNumber = ("" + Date.now() + "000000000000").slice(0, 12);
const voterId = `VOTE${Date.now().toString().slice(-6)}`;

async function testAuth() {
  try {
    console.log('--- Registering ---');
    const res1 = await fetch('http://localhost:5000/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullname: 'Autobot', voterId, email, password, aadhaarNumber })
    });
    console.log('Status:', res1.status);
    console.log(await res1.json());

    console.log('\n--- Logging In ---');
    const res2 = await fetch('http://localhost:5000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: email, password })
    });
    console.log('Status:', res2.status);
    const data = await res2.json();
    console.log(data);

    if (data.token) {
      console.log('\n--- Fetching Profile (authenticateToken Middleware) ---');
      const res3 = await fetch('http://localhost:5000/api/v1/auth/me', {
        headers: { 'Authorization': `Bearer ${data.token}` }
      });
      console.log('Status:', res3.status);
      console.log(await res3.json());
    }
  } catch (err) {
    console.error('Test failed:', err);
  }
}
testAuth();
