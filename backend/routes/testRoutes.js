const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');

router.post('/seed-voter', async (req, res) => {
    // Only allow in non-production environments
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ error: 'Forbidden in production' });
    }

    const { aadhaar } = req.body;
    if (!aadhaar) return res.status(400).json({ error: 'Aadhaar required' });

    try {
        await prisma.approvedVoter.upsert({
            where: { email: aadhaar },
            update: { status: 'WHITELIST' },
            create: { email: aadhaar, status: 'WHITELIST', added_by: 'test_script' }
        });
        res.status(200).json({ success: true, message: `Voter ${aadhaar} seeded` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
