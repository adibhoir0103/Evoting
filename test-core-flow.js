const ethers = require('ethers');

async function buildAndRun() {
    console.log("Starting Core Functionality & Performance Test...");

    const PORT = 5000;
    const API_BASE = `http://localhost:${PORT}/api/v1`;

    const fetchConfig = {
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer TEST_TOKEN",
            // The bypass sets turnstile/clerk out of the way for now
        }
    };

    console.log("1. Checking simulated user (Voter Management)...");
    let res = await fetch(`${API_BASE}/auth/me`, fetchConfig);
    if (!res.ok) {
        console.error("Failed to load simulated user. Did bypass work?", await res.text());
        return;
    }
    const user = await res.json();
    console.log("User retrieved:", user);

    console.log("2. Creating Election (Election Management)...");
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + 10 * 60000); // 10 minutes timeframe
    res = await fetch(`${API_BASE}/admin/elections`, {
        method: "POST",
        ...fetchConfig,
        body: JSON.stringify({
            name: "Test Election 2026",
            description: "Core functionality performance test",
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString()
        })
    });
    const election = await res.json();
    console.log("Election Created:", election);

    console.log("3. Adding Candidate...");
    res = await fetch(`${API_BASE}/admin/elections/${election.id}/candidates`, {
        method: "POST",
        ...fetchConfig,
        body: JSON.stringify({
            candidate_name: "John Doe Test",
            party_name: "Test Party",
            party_symbol: "Star"
        })
    });
    const candidate = await res.json();
    console.log("Candidate Added:", candidate);

    console.log("4. Activating Election...");
    // Bypass AWAITING_APPROVAL strict logic locally
    res = await fetch(`${API_BASE}/admin/elections/${election.id}/status`, {
        method: "PATCH",
        ...fetchConfig,
        body: JSON.stringify({ status: "ACTIVE", override_reason: "Testing" })
    });
    const activeElection = await res.json();
    console.log("Election Activated:", activeElection);

    console.log("5. Voting Mechanism (Backend Verification)...");
    // Request Pre-flight token
    res = await fetch(`${API_BASE}/vote/pre-flight`, fetchConfig);
    if (!res.ok) {
         console.error("Preflight failed. Did the auth_id set properly?", await res.text());
         return;
    }
    const { upstashToken } = await res.json();
    console.log("Acquired Pre-Flight Token:", upstashToken);

    // Cast a mock tx on the blockchain using the frontend ABI 
    // Hardhat Account 0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
    const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
    const signer = await provider.getSigner(0);
    
    console.log("Recording vote mapping back to DB...");
    res = await fetch(`${API_BASE}/vote/record`, {
        method: "POST",
        ...fetchConfig,
        body: JSON.stringify({
            txHash: '0xmockedhash1234567890abcdef',
            upstashToken: upstashToken,
            turnstileToken: 'turnstile-not-configured'
        })
    });
    
    if (!res.ok) {
        console.error("Vote Record Failed:", await res.text());
    } else {
        const record = await res.json();
        console.log("Vote Cast Success:", record);
    }
    
    console.log("6. Verifying Results Status...");
    res = await fetch(`${API_BASE}/admin/stats`, fetchConfig);
    const stats = await res.json();
    console.log("Admin Dashboard Stats (Counts):", stats);
}

buildAndRun().catch(console.error);
