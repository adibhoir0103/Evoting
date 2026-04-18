/**
 * Database cleanup script — removes test/stale users and their references
 * Run with: node cleanup-test-data.js
 */
const prisma = require('./lib/prisma');

async function cleanup() {
    console.log('🧹 Cleaning up test data...\n');

    // Step 1: Delete all votes (they reference users via voter_id FK)
    const deletedVotes = await prisma.vote.deleteMany({});
    console.log(`✅ Deleted ${deletedVotes.count} votes`);

    // Step 2: Delete election voters
    const deletedEV = await prisma.electionVoter.deleteMany({});
    console.log(`✅ Deleted ${deletedEV.count} election voter records`);

    // Step 3: Delete login history
    const deletedHistory = await prisma.loginHistory.deleteMany({});
    console.log(`✅ Deleted ${deletedHistory.count} login history records`);

    // Step 4: Delete MFA tokens
    const deletedMfa = await prisma.mfaToken.deleteMany({});
    console.log(`✅ Deleted ${deletedMfa.count} MFA tokens`);

    // Step 5: Delete QR tickets
    const deletedQr = await prisma.qrVoteTicket.deleteMany({});
    console.log(`✅ Deleted ${deletedQr.count} QR tickets`);

    // Step 6: Delete keystroke profiles
    const deletedKs = await prisma.keystrokeProfile.deleteMany({});
    console.log(`✅ Deleted ${deletedKs.count} keystroke profiles`);

    // Step 7: Delete notifications
    const deletedNotif = await prisma.electionNotification.deleteMany({});
    console.log(`✅ Deleted ${deletedNotif.count} election notifications`);

    // Step 8: Now delete all test users (the Autobot + test accounts)
    const deletedUsers = await prisma.user.deleteMany({
        where: {
            voter_id: { in: ['VOTE181763', 'TEST123456'] }
        }
    });
    console.log(`✅ Deleted ${deletedUsers.count} test users (Autobot, Test)`);

    // Show remaining users
    const remaining = await prisma.user.findMany({
        select: { id: true, fullname: true, voter_id: true, email: true }
    });
    console.log('\n📋 Remaining users:');
    remaining.forEach(u => console.log(`   ${u.id}: ${u.fullname} (${u.voter_id}) — ${u.email}`));

    // Show approved voters
    const approved = await prisma.approvedVoter.findMany({
        select: { id: true, email: true, full_name: true, status: true }
    });
    console.log('\n📋 Approved Voter Whitelist:');
    if (approved.length === 0) {
        console.log('   ⚠️  EMPTY — No one can register! Add voters via Admin Panel.');
    } else {
        approved.forEach(v => console.log(`   ${v.id}: ${v.full_name} (${v.email}) — ${v.status}`));
    }

    console.log('\n✅ Cleanup complete!');
    await prisma.$disconnect();
}

cleanup().catch(err => {
    console.error('❌ Cleanup failed:', err);
    process.exit(1);
});
