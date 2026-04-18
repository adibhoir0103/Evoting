/**
 * Election Notification Scheduler
 * 
 * Runs every 60 seconds and checks for election events that need email notifications:
 * 1. REMINDER_24H — 24 hours before election starts
 * 2. VOTING_STARTED — When election goes ACTIVE (start_time reached)
 * 3. LAST_CALL_30M — 30 minutes before election ends, only to non-voters
 */

const prisma = require('../lib/prisma');
const logger = require('../lib/logger');

const notifLog = logger.child('notification');

let isRunning = false; // Prevent overlapping runs

/**
 * Check and send election notifications
 */
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
                status: { in: ['PUBLISHED', 'ACTIVE'] }
            }
        });

        for (const election of elections) {
            const startTime = new Date(election.start_time);
            const endTime = new Date(election.end_time);

            // 1. REMINDER_24H: 24 hours before start (±5 min window)
            const reminderTime = new Date(startTime.getTime() - 24 * 60 * 60 * 1000);
            const reminderWindowStart = new Date(reminderTime.getTime() - 5 * 60 * 1000);
            const reminderWindowEnd = new Date(reminderTime.getTime() + 5 * 60 * 1000);

            if (now >= reminderWindowStart && now <= reminderWindowEnd) {
                await sendNotification(election, 'REMINDER_24H', {
                    subject: 'Voting Reminder — Tomorrow',
                    getBody: (name, elName) => `Dear ${name},\n\nThis is a reminder that voting for "${elName}" opens tomorrow at ${startTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}.\n\nPlease ensure:\n• Your MetaMask wallet is configured\n• You have your Voter ID ready\n• Check eligibility at the Bharat E-Vote portal\n\nYour vote matters for India's democracy!`
                });
            }

            // 2. VOTING_STARTED: When start_time is reached (±5 min window)
            const startWindowStart = new Date(startTime.getTime() - 2 * 60 * 1000);
            const startWindowEnd = new Date(startTime.getTime() + 5 * 60 * 1000);

            if (now >= startWindowStart && now <= startWindowEnd) {
                await sendNotification(election, 'VOTING_STARTED', {
                    subject: 'Voting Is Now Open!',
                    getBody: (name, elName) => `Dear ${name},\n\nVoting for "${elName}" is NOW OPEN!\n\n🗳️ Cast your vote at: https://bharat-evote.netlify.app/vote\n\n⏰ Voting closes at: ${endTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\n\nRemember:\n• Each voter can cast only ONE vote\n• Your vote is encrypted on the blockchain\n• Results will be announced after polls close\n\nJai Hind! 🇮🇳`
                });
            }

            // 3. LAST_CALL_30M: 30 minutes before end, only to non-voters
            const lastCallTime = new Date(endTime.getTime() - 30 * 60 * 1000);
            const lastCallWindowStart = new Date(lastCallTime.getTime() - 2 * 60 * 1000);
            const lastCallWindowEnd = new Date(lastCallTime.getTime() + 5 * 60 * 1000);

            if (now >= lastCallWindowStart && now <= lastCallWindowEnd) {
                await sendNotification(election, 'LAST_CALL_30M', {
                    subject: '⚠️ Last 30 Minutes to Vote!',
                    getBody: (name, elName) => `Dear ${name},\n\n⚠️ URGENT: Only 30 minutes remain to cast your vote for "${elName}"!\n\nVoting closes at: ${endTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\n\n🗳️ Vote now: https://bharat-evote.netlify.app/vote\n\nDon't miss your chance to participate in India's democracy!\n\nJai Hind! 🇮🇳`,
                    onlyNonVoters: true // Only send to voters who haven't voted
                });
            }
        }
    } catch (error) {
        notifLog.error('Notification scheduler error', { error: error.message });
    } finally {
        isRunning = false;
    }
}

/**
 * Send a notification for a specific election event
 */
async function sendNotification(election, type, { subject, getBody, onlyNonVoters = false }) {
    try {
        // Check if already sent
        const existing = await prisma.electionNotification.findUnique({
            where: { election_id_type: { election_id: election.id, type } }
        });

        if (existing) {
            return; // Already sent, skip
        }

        // Get recipients
        let recipients;
        if (onlyNonVoters) {
            // Get approved voters who haven't voted in this election
            const allApproved = await prisma.approvedVoter.findMany({
                where: { status: 'WHITELIST' },
                select: { email: true, fullname: true }
            });

            // Get users who HAVE voted
            const votedUsers = await prisma.user.findMany({
                where: { has_voted: true },
                select: { email: true }
            });
            const votedEmails = new Set(votedUsers.map(u => u.email));

            recipients = allApproved.filter(v => !votedEmails.has(v.email));
        } else {
            recipients = await prisma.approvedVoter.findMany({
                where: { status: 'WHITELIST' },
                select: { email: true, fullname: true }
            });
        }

        if (recipients.length === 0) {
            notifLog.info(`No recipients for ${type} - election ${election.id}`);
            return;
        }

        // Send emails in batches of 10 to avoid rate limits
        const emailService = require('./emailService');
        let sentCount = 0;
        const batchSize = 10;

        for (let i = 0; i < recipients.length; i += batchSize) {
            const batch = recipients.slice(i, i + batchSize);

            for (const voter of batch) {
                try {
                    const name = voter.fullname || 'Voter';
                    const body = getBody(name, election.name);

                    // Use the OTP email template but with custom content
                    await emailService.sendElectionNotification(
                        voter.email,
                        name,
                        subject,
                        body,
                        election.name
                    );
                    sentCount++;
                } catch (emailErr) {
                    notifLog.error(`Failed to send ${type} to ${voter.email}`, { error: emailErr.message });
                }
            }

            // Small delay between batches (2 seconds)
            if (i + batchSize < recipients.length) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        // Record that notification was sent
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

/**
 * Start the notification scheduler
 */
function start() {
    notifLog.info('📧 Election notification scheduler started (checking every 60s)');
    // Run immediately on start
    checkAndNotify();
    // Then every 60 seconds
    setInterval(checkAndNotify, 60 * 1000);
}

module.exports = { start };
