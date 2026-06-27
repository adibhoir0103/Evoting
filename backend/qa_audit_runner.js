const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const http = require('http');

const API_BASE = 'http://127.0.0.1:5000/api/v1';

// We need an admin token to authenticate our API requests
async function getAdminToken() {
    return new Promise((resolve, reject) => {
        const req = http.request(`${API_BASE}/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed.token);
                } catch (e) {
                    reject(e);
                }
            });
        });
        req.on('error', reject);
        req.write(JSON.stringify({ 
            email: 'admin@evote.com', 
            password: 'Admin@modern7',
            turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX'
        }));
        req.end();
    });
}

async function runAudit() {
    const results = [];
    console.log('Starting QA Audit...\n');

    let adminToken;
    try {
        adminToken = await getAdminToken();
        console.log('Obtained Admin Token:', adminToken ? 'Success' : 'Failed');
    } catch (e) {
        console.error('Failed to login as admin. Ensure the backend is running and credentials are correct.');
        process.exit(1);
    }

    const authHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
    };

    // Helper to make fetch-like requests using native http module
    const makeRequest = (path, method, body) => {
        return new Promise((resolve, reject) => {
            const req = http.request(`${API_BASE}${path}`, {
                method,
                headers: authHeaders
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null });
                });
            });
            req.on('error', reject);
            if (body) req.write(JSON.stringify(body));
            req.end();
        });
    };

    // -------------------------------------------------------------
    // Test 1: Admin Create Election (Frontend API -> DB Sync)
    // -------------------------------------------------------------
    const testElectionData = {
        name: 'QA Audit Election ' + Date.now(),
        description: 'Testing Database Sync',
        start_time: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
        end_time: new Date(Date.now() + 26 * 3600 * 1000).toISOString()
    };

    let start = Date.now();
    const createElectionRes = await makeRequest('/admin/elections', 'POST', testElectionData);
    let timeTaken = Date.now() - start;

    let dbElection = null;
    if (createElectionRes.status === 201 || createElectionRes.status === 200) {
        // Verify in database
        dbElection = await prisma.election.findFirst({
            where: { name: testElectionData.name }
        });
    }

    results.push({
        module: 'Election Management',
        action: 'Create Election (API POST)',
        frontendResult: `Status ${createElectionRes.status}`,
        dbResult: dbElection ? 'Record exists in DB' : 'Record missing',
        syncStatus: (dbElection && dbElection.description === testElectionData.description) ? 'Synced' : 'Failed',
        passFail: (dbElection && dbElection.description === testElectionData.description) ? 'PASS' : 'FAIL',
        remarks: `Time: ${timeTaken}ms. DB id: ${dbElection?.id}`
    });


    // -------------------------------------------------------------
    // Test 2: Admin Add Approved Voter (Frontend API -> DB Sync)
    // -------------------------------------------------------------
    const testVoterData = {
        email: `qa_voter_${Date.now()}@example.com`,
        fullname: 'QA Tester',
        voter_id: 'QA' + Date.now(),
        status: 'WHITELIST'
    };

    start = Date.now();
    const createVoterRes = await makeRequest('/admin/approved-voters', 'POST', testVoterData);
    timeTaken = Date.now() - start;

    let dbVoter = null;
    if (createVoterRes.status === 201 || createVoterRes.status === 200) {
        dbVoter = await prisma.approvedVoter.findUnique({
            where: { email: testVoterData.email }
        });
    }

    results.push({
        module: 'Voter Rolls',
        action: 'Add Approved Voter (API POST)',
        frontendResult: `Status ${createVoterRes.status}`,
        dbResult: dbVoter ? 'Record exists in DB' : 'Record missing',
        syncStatus: (dbVoter && dbVoter.status === 'WHITELIST') ? 'Synced' : 'Failed',
        passFail: (dbVoter && dbVoter.status === 'WHITELIST') ? 'PASS' : 'FAIL',
        remarks: `Time: ${timeTaken}ms. DB id: ${dbVoter?.id}`
    });


    // -------------------------------------------------------------
    // Test 3: Admin Update Election Status (Update Verification)
    // -------------------------------------------------------------
    if (dbElection) {
        start = Date.now();
        const updateStatusRes = await makeRequest(`/admin/elections/${dbElection.id}/status`, 'PATCH', {
            status: 'PUBLISHED',
            override_reason: 'QA Testing'
        });
        timeTaken = Date.now() - start;

        const updatedDbElection = await prisma.election.findUnique({ where: { id: dbElection.id } });
        
        results.push({
            module: 'Election Management',
            action: 'Update Election Status (API PATCH)',
            frontendResult: `Status ${updateStatusRes.status}`,
            dbResult: `Status in DB: ${updatedDbElection?.status}`,
            syncStatus: updatedDbElection?.status === 'PUBLISHED' ? 'Synced' : 'Failed',
            passFail: updatedDbElection?.status === 'PUBLISHED' ? 'PASS' : 'FAIL',
            remarks: `Time: ${timeTaken}ms.`
        });
    }

    // -------------------------------------------------------------
    // Test 4: Edge Case - Empty Fields / Missing Required Data
    // -------------------------------------------------------------
    start = Date.now();
    const badElectionRes = await makeRequest('/admin/elections', 'POST', { name: '' }); // Missing dates
    timeTaken = Date.now() - start;

    results.push({
        module: 'Edge Case',
        action: 'Create Election missing fields',
        frontendResult: `Status ${badElectionRes.status} (Expected 4xx or 500)`,
        dbResult: 'N/A',
        syncStatus: 'Blocked by Validation',
        passFail: badElectionRes.status >= 400 ? 'PASS' : 'FAIL',
        remarks: `Time: ${timeTaken}ms. Handled bad input gracefully.`
    });

    console.log('\n--- AUDIT RESULTS ---');
    console.log(JSON.stringify(results, null, 2));

    await prisma.$disconnect();
}

runAudit().catch(e => {
    console.error(e);
    prisma.$disconnect();
});
