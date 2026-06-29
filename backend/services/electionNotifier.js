/**
 * Election Notification Scheduler
 * 
 * Runs every 60 seconds and checks for election events that need email notifications:
 * 1. VOTING_STARTED — When election goes ACTIVE (start_time reached)
 * 2. FIVE_MIN_WARNING — 5 minutes before election ends, only to non-voters
 * 3. ELECTION_ENDED — When election timer fires and voting closes
 * 4. RESULTS_RELEASED — 1 hour after election closes, auto-releases results
 */

const prisma = require('../lib/prisma');
const logger = require('../lib/logger');
const emailService = require('./emailService');
const blockchainReader = require('./blockchainReader');

const notifLog = logger.child('notification');

let isRunning = false; // Prevent overlapping runs

async function checkAndNotify() {
    if (isRunning) return;
    isRunning = true;

    try {
        const now = new Date();

        // Find all elections with scheduled times
        const elections = await prisma.election.findMany({
            where: {
                start_time: { not: null },
                end_time: { not: null },
                status: { in: ['PUBLISHED', 'ACTIVE', 'CLOSED'] }
            }
        });

        for (const election of elections) {
            const startTime = new Date(election.start_time);
            const endTime = new Date(election.end_time);

            // 1. VOTING_STARTED: When start_time is reached (±5 min window)
            const startWindowStart = new Date(startTime.getTime() - 2 * 60 * 1000);
            const startWindowEnd = new Date(startTime.getTime() + 5 * 60 * 1000);

            if (now >= startWindowStart && now <= startWindowEnd && election.status === 'ACTIVE') {
                await sendNotification(election, 'VOTING_STARTED', {
                    subject: 'Voting Is Now Open!',
                    getBody: (name, elName) => `Dear ${name},\n\nVoting for "${elName}" is NOW OPEN!\n\n🗳️ Cast your vote at: https://bharat-evote.me/vote\n\n⏰ Voting closes at: ${endTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\n\nRemember:\n• Each voter can cast only ONE vote\n• Your vote is encrypted on the blockchain\n• Results will be announced 1 hour after polls close\n\nJai Hind! 🇮🇳`
                });
            }

            // 2. FIVE_MIN_WARNING: 5 minutes before end, only to non-voters
            const warningTime = new Date(endTime.getTime() - 5 * 60 * 1000);
            const warningWindowStart = new Date(warningTime.getTime() - 2 * 60 * 1000);
            const warningWindowEnd = new Date(warningTime.getTime() + 2 * 60 * 1000);

            if (now >= warningWindowStart && now <= warningWindowEnd && election.status === 'ACTIVE') {
                await sendNotification(election, 'FIVE_MIN_WARNING', {
                    subject: '⚠️ 5 Minutes Left to Vote!',
                    getBody: (name, elName) => `Dear ${name},\n\n⚠️ URGENT: The election closes in exactly 5 minutes.\n\nYou haven't voted yet — cast your vote now before the blockchain locks!\n\n🗳️ Vote now: https://bharat-evote.me/vote\n\nJai Hind! 🇮🇳`,
                    onlyNonVoters: true
                });
            }

            // 3. ELECTION_ENDED: Exactly when end_time is reached
            const endWindowStart = new Date(endTime.getTime() - 1 * 60 * 1000);
            const endWindowEnd = new Date(endTime.getTime() + 5 * 60 * 1000);

            if (now >= endWindowStart && now <= endWindowEnd) {
                // We don't check status === 'CLOSED' because admin might not have clicked it yet,
                // but the time has passed.
                await sendNotification(election, 'ELECTION_ENDED', {
                    subject: 'Election Voting Has Ended',
                    getBody: (name, elName) => `Dear ${name},\n\nVoting for "${elName}" has officially concluded and the blockchain is now locked.\n\n📊 Results will be mathematically tallied and published in exactly 1 hour.\n\nThank you for participating.\n\nJai Hind! 🇮🇳`
                });
            }

            // 4. RESULTS_RELEASED: 1 hour after end_time
            const resultsTime = new Date(endTime.getTime() + 60 * 60 * 1000);
            const resultsWindowStart = new Date(resultsTime.getTime() - 2 * 60 * 1000);
            const resultsWindowEnd = new Date(resultsTime.getTime() + 5 * 60 * 1000);

            if (now >= resultsWindowStart && now <= resultsWindowEnd) {
                // Ensure results are not sent if we haven't already
                const sent = await prisma.electionNotification.findUnique({
                    where: { election_id_type: { election_id: election.id, type: 'RESULTS_RELEASED' } }
                });
                
                if (!sent) {
                    // Compute tally from blockchain
                    const candidates = await blockchainReader.getAllCandidates();
                    
                    if (candidates && candidates.length > 0) {
                        const winner = candidates.reduce((best, c) => c.voteCount > best.voteCount ? c : best, candidates[0]);
                        
                        let breakdown = '';
                        const sortedCandidates = [...candidates].sort((a, b) => b.voteCount - a.voteCount);
                        for (const c of sortedCandidates) {
                            breakdown += `${c.name} (${c.partyName || 'Independent'}): ${c.voteCount} votes\n`;
                        }

                        await sendNotification(election, 'RESULTS_RELEASED', {
                            subject: 'Election Results Are Now Live! 📊',
                            getBody: (name, elName) => `Dear ${name},\n\nThe official results for "${elName}" are now finalized on the blockchain.\n\n🏆 WINNER: ${winner.name} (${winner.partyName || 'Independent'}) with ${winner.voteCount} votes!\n\n--- Full Vote Breakdown ---\n${breakdown}\n\nView the verified results here: https://bharat-evote.me/results\n\nJai Hind! 🇮🇳`
                        });
                        
                        // Auto-update election status to CLOSED if it wasn't already (auto-release)
                        if (election.status !== 'CLOSED' && election.status !== 'ARCHIVED') {
                            await prisma.election.update({
                                where: { id: election.id },
                                data: { status: 'CLOSED' }
                            });
                            notifLog.info(`Auto-closed election ${election.id} during results release`);
                        }
                    }
                }
            }
        }
    } catch (error) {
        notifLog.error('Notification scheduler error', { error: error.message });
    } finally {
        isRunning = false;
    }
}

async function sendNotification(election, type, { subject, getBody, onlyNonVoters = false }) {
    try {
        const existing = await prisma.electionNotification.findUnique({
            where: { election_id_type: { election_id: election.id, type } }
        });

        if (existing) {
            return;
        }

        // Get recipients for this specific election
        const electionVoters = await prisma.electionVoter.findMany({
            where: { election_id: election.id },
            include: { user: true }
        });

        if (electionVoters.length === 0) {
            return; // No one to notify
        }

        let recipients = [];

        if (onlyNonVoters) {
            for (const ev of electionVoters) {
                // If the DB says they haven't voted, check the blockchain to be absolutely sure
                if (!ev.has_voted && ev.user && ev.user.wallet_address) {
                    const hasVotedOnChain = await blockchainReader.hasVoterVoted(ev.user.wallet_address);
                    if (!hasVotedOnChain) {
                        recipients.push(ev.user);
                    } else {
                        // Fix sync issue silently
                        await prisma.electionVoter.update({
                            where: { id: ev.id },
                            data: { has_voted: true }
                        });
                    }
                } else if (!ev.has_voted && ev.user) {
                    recipients.push(ev.user);
                }
            }
        } else {
            recipients = electionVoters.map(ev => ev.user).filter(u => u);
        }

        if (recipients.length === 0) {
            notifLog.info(`No recipients for ${type} - election ${election.id}`);
            // We should still mark as sent so we don't keep polling
            await prisma.electionNotification.create({
                data: { election_id: election.id, type, sent_count: 0 }
            });
            return;
        }

        let sentCount = 0;
        const batchSize = 10;

        for (let i = 0; i < recipients.length; i += batchSize) {
            const batch = recipients.slice(i, i + batchSize);

            for (const user of batch) {
                if (!user.email) continue;
                
                try {
                    const name = user.fullname || 'Voter';
                    const body = getBody(name, election.name);

                    await emailService.sendElectionNotification(
                        user.email,
                        name,
                        subject,
                        body,
                        election.name
                    );
                    sentCount++;
                } catch (emailErr) {
                    notifLog.error(`Failed to send ${type} to ${user.email}`, { error: emailErr.message });
                }
            }

            if (i + batchSize < recipients.length) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        await prisma.electionNotification.create({
            data: {
                election_id: election.id,
                type,
                sent_count: sentCount
            }
        });

        notifLog.info(`✅ ${type} sent for election "${election.name}" — ${sentCount}/${recipients.length} recipients`);
    } catch (error) {
        notifLog.error(`Failed to send ${type} for election ${election.id}`, { error: error.message });
    }
}

function start() {
    notifLog.info('📧 Election notification scheduler started (checking every 60s)');
    checkAndNotify();
    setInterval(checkAndNotify, 60 * 1000);
}

module.exports = { start };
