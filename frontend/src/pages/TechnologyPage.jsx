import React, { useState, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { homomorphicService } from '../services/homomorphicService';
import { postQuantumService } from '../services/postQuantumService';

function TechnologyPage() {
    const [activeSection, setActiveSection] = useState('dlt');

    const [heDemo, setHeDemo] = useState(null);
    const [heLoading, setHeLoading] = useState(false);
    const [pqDemo, setPqDemo] = useState(null);
    const [pqLoading, setPqLoading] = useState(false);

    const runHeDemo = useCallback(async () => {
        setHeLoading(true);
        try {
            const result = homomorphicService.runDemo([1, 0, 1, 1, 0, 1]);
            setHeDemo(result);
        } catch (e) { console.error(e); }
        setHeLoading(false);
    }, []);

    const runPqDemo = useCallback(async () => {
        setPqLoading(true);
        try {
            const result = await postQuantumService.runDemo();
            setPqDemo(result);
        } catch (e) { console.error(e); }
        setPqLoading(false);
    }, []);

    const sections = [
        { id: 'dlt', label: 'Distributed Ledger', icon: 'fa-network-wired' },
        { id: 'consensus', label: 'Consensus', icon: 'fa-handshake' },
        { id: 'smart', label: 'Smart Contracts', icon: 'fa-file-contract' },
        { id: 'crypto', label: 'Cryptography', icon: 'fa-key' },
        { id: 'zkp', label: 'Zero-Knowledge Proofs', icon: 'fa-user-secret' },
        { id: 'homomorphic', label: 'Homomorphic Encryption', icon: 'fa-calculator' },
        { id: 'mfa', label: 'MFA & QR Auth', icon: 'fa-shield-halved' },
        { id: 'coercion', label: 'Coercion Resistance', icon: 'fa-person-shelter' },
        { id: 'tee', label: 'TEE Architecture', icon: 'fa-microchip' },
        { id: 'postquantum', label: 'Post-Quantum Crypto', icon: 'fa-atom' },
        { id: 'ipfs', label: 'IPFS Storage', icon: 'fa-database' },
        { id: 'threats', label: 'Threat Model', icon: 'fa-skull-crossbones' },
        { id: 'trust', label: 'Trust & Integrity', icon: 'fa-handshake-angle' },
        { id: 'upgrade', label: 'Upgradeability', icon: 'fa-arrows-rotate' },
        { id: 'arch', label: 'Architecture', icon: 'fa-sitemap' },
    ];

    return (
        <div className="min-h-screen bg-[#f3f4f6]">
            <Helmet>
                <title>Technology | Bharat E-Vote Portal</title>
                <meta name="description" content="Learn about the blockchain technology, cryptographic protocols, and zero-knowledge proofs powering India's secure digital voting system." />
            </Helmet>

            {/* Hero */}
            <div className="bg-primary text-white">
                <div className="h-1 bg-gradient-to-r from-accent-saffron via-white to-accent-green"></div>
                <div className="max-w-7xl mx-auto px-4 py-12 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 text-sm font-semibold mb-4">
                        <i className="fa-solid fa-microchip"></i> Technical Architecture
                    </div>
                    <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3">How Bharat E-Vote Works</h1>
                    <p className="text-blue-100 max-w-2xl mx-auto">A deep dive into the blockchain infrastructure, cryptographic protocols, and zero-knowledge proof systems securing India's digital democracy.</p>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-10">
                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Sidebar Nav */}
                    <nav className="lg:w-64 flex-shrink-0">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden sticky top-4">
                            <div className="p-4 bg-gray-50 border-b border-gray-200">
                                <h3 className="font-bold text-sm text-gray-500 uppercase tracking-wider">Topics</h3>
                            </div>
                            {sections.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => setActiveSection(s.id)}
                                    className={`w-full text-left px-4 py-3 flex items-center gap-3 text-sm font-medium transition-colors border-l-4 ${
                                        activeSection === s.id
                                            ? 'bg-blue-50 text-primary border-primary font-bold'
                                            : 'text-gray-600 hover:bg-gray-50 border-transparent'
                                    }`}
                                >
                                    <i className={`fa-solid ${s.icon} w-5 text-center`}></i>
                                    {s.label}
                                </button>
                            ))}
                        </div>
                    </nav>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        {activeSection === 'dlt' && (
                            <Section title="Distributed Ledger Technology (DLT)" icon="fa-network-wired">
                                <p>Unlike traditional voting databases that rely on a single central server, Bharat E-Vote uses <strong>Distributed Ledger Technology</strong> — the same foundation that powers Ethereum and Bitcoin.</p>
                                
                                <InfoCard title="How DLT Works in Our System" color="blue">
                                    <div className="space-y-3">
                                        <Step num={1} title="Vote Transaction Created">When a voter casts their ballot, a cryptographic transaction is created containing only their participation proof (not their vote choice).</Step>
                                        <Step num={2} title="Broadcast to Network">The transaction is broadcast to all nodes in the blockchain network simultaneously.</Step>
                                        <Step num={3} title="Validation & Consensus">Validator nodes verify the transaction's authenticity — checking the voter's authorization, preventing double-voting, and validating the digital signature.</Step>
                                        <Step num={4} title="Block Formation">Valid transactions are grouped into a block, hashed, and chained to the previous block — creating an immutable, append-only ledger.</Step>
                                    </div>
                                </InfoCard>

                                <InfoCard title="Immutability Guarantee" color="green">
                                    <p>Once a vote is recorded on the blockchain, it <strong>cannot be altered, deleted, or tampered with</strong>. Each block contains the hash of the previous block, creating a chain where any modification would invalidate all subsequent blocks — making tampering immediately detectable.</p>
                                    <code className="block mt-3 bg-gray-900 text-green-400 p-3 rounded-lg text-xs font-mono">
                                        Block N: hash(votes + previousHash) → 0x7f3a...<br/>
                                        Block N+1: hash(votes + 0x7f3a...) → 0xb2c1...<br/>
                                        Tamper Block N → hash changes → Block N+1 invalid → chain breaks ✗
                                    </code>
                                </InfoCard>

                                <Highlight>Our system runs on a <strong>private/permissioned Ethereum network</strong> (Hardhat for development, Sepolia Testnet for public demonstration) where only authorized Election Commission nodes can validate blocks.</Highlight>
                            </Section>
                        )}

                        {activeSection === 'consensus' && (
                            <Section title="Consensus Mechanisms" icon="fa-handshake">
                                <p>Consensus mechanisms are the protocols by which all nodes in a blockchain network agree on the validity of transactions. Our system uses different consensus models depending on the deployment environment.</p>

                                <div className="grid md:grid-cols-2 gap-4 my-6">
                                    <div className="bg-white border-2 border-blue-200 rounded-xl p-5">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center"><i className="fa-solid fa-server text-blue-600 text-sm"></i></div>
                                            <h4 className="font-bold text-gray-900">Proof of Authority (PoA)</h4>
                                        </div>
                                        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full mb-3 inline-block">Used: Local / Private Network</span>
                                        <ul className="text-sm text-gray-600 space-y-2 mt-2">
                                            <li>• Pre-approved validators (Election Commission servers)</li>
                                            <li>• No mining — blocks created by authorized nodes only</li>
                                            <li>• Fast block times (~2 seconds)</li>
                                            <li>• Energy efficient — no computational puzzles</li>
                                            <li>• Ideal for permissioned government networks</li>
                                        </ul>
                                        <div className="mt-3 p-2 bg-green-50 rounded-lg text-xs text-green-700 font-semibold">
                                            <i className="fa-solid fa-check-circle mr-1"></i> Recommended for national e-voting
                                        </div>
                                    </div>

                                    <div className="bg-white border-2 border-purple-200 rounded-xl p-5">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center"><i className="fa-solid fa-coins text-purple-600 text-sm"></i></div>
                                            <h4 className="font-bold text-gray-900">Proof of Stake (PoS)</h4>
                                        </div>
                                        <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full mb-3 inline-block">Used: Sepolia Testnet</span>
                                        <ul className="text-sm text-gray-600 space-y-2 mt-2">
                                            <li>• Validators stake ETH as collateral</li>
                                            <li>• Ethereum's consensus since "The Merge" (Sep 2022)</li>
                                            <li>• 99.95% more energy efficient than PoW</li>
                                            <li>• Decentralized — thousands of validators</li>
                                            <li>• Used for our public testnet demonstration</li>
                                        </ul>
                                        <div className="mt-3 p-2 bg-purple-50 rounded-lg text-xs text-purple-700 font-semibold">
                                            <i className="fa-solid fa-globe mr-1"></i> Public chain transparency
                                        </div>
                                    </div>
                                </div>

                                <InfoCard title="Why NOT Proof of Work?" color="red">
                                    <p>Proof of Work (PoW), used by Bitcoin, requires enormous computational power to mine blocks. This makes it <strong>too slow</strong> (10+ min block times), <strong>too expensive</strong> (high energy costs), and <strong>impractical</strong> for a voting system that needs fast confirmation and scalability for millions of voters.</p>
                                </InfoCard>
                            </Section>
                        )}

                        {activeSection === 'smart' && (
                            <Section title="Smart Contracts" icon="fa-file-contract">
                                <p>Our <code>Voting.sol</code> smart contract is the heart of the election — self-executing code deployed on the blockchain that enforces all voting rules automatically, without any central authority.</p>

                                <InfoCard title="What Our Smart Contract Enforces" color="blue">
                                    <div className="grid sm:grid-cols-2 gap-3">
                                        {[
                                            { icon: 'fa-users', title: 'Candidate Registration', desc: 'Define candidates with party, state, and constituency info' },
                                            { icon: 'fa-clock', title: 'Election Timeline', desc: 'Set start/end times — enforced on-chain, not by servers' },
                                            { icon: 'fa-ban', title: 'Double-Vote Prevention', desc: 'require(!voter.hasVoted) — mathematically impossible to vote twice' },
                                            { icon: 'fa-building-columns', title: 'Constituency Matching', desc: 'Voters can only vote for candidates in their constituency' },
                                            { icon: 'fa-calculator', title: 'Automatic Tally', desc: 'Vote counts updated atomically — no manual counting needed' },
                                            { icon: 'fa-shield-halved', title: 'Admin Controls', desc: 'Only the deployer (Election Commission) can manage the election' },
                                        ].map((item, i) => (
                                            <div key={i} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                                                <i className={`fa-solid ${item.icon} text-primary mt-0.5`}></i>
                                                <div>
                                                    <p className="font-bold text-sm text-gray-900">{item.title}</p>
                                                    <p className="text-xs text-gray-500">{item.desc}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </InfoCard>

                                <InfoCard title="Contract Lifecycle" color="green">
                                    <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                                        {['Deploy', 'Add Candidates', 'Authorize Voters', 'Start Voting', 'Voters Cast Ballots', 'End Voting', 'Results Published'].map((step, i) => (
                                            <React.Fragment key={i}>
                                                {i > 0 && <i className="fa-solid fa-arrow-right text-gray-300 text-xs"></i>}
                                                <span className="bg-white border border-gray-200 px-3 py-1 rounded-full text-gray-700">{step}</span>
                                            </React.Fragment>
                                        ))}
                                    </div>
                                </InfoCard>

                                <Highlight>The smart contract guarantees that <strong>even the admin cannot see who voted for whom</strong>. The contract only stores whether a voter has voted, not their choice. Vote counts are incremented atomically.</Highlight>
                            </Section>
                        )}

                        {activeSection === 'crypto' && (
                            <Section title="Cryptographic Primitives" icon="fa-key">
                                <p>Every layer of Bharat E-Vote relies on battle-tested cryptographic algorithms to ensure security, integrity, and privacy.</p>

                                <div className="space-y-4 my-6">
                                    <CryptoCard
                                        name="Keccak-256 (SHA-3)"
                                        usage="Block hashing, vote receipts, address derivation"
                                        detail="Creates unique 256-bit fingerprints. Used by Ethereum for all hashing. Our getVoteReceipt() generates keccak256(voter, chainId, 'voted') — proving participation without revealing choice."
                                        color="blue"
                                    />
                                    <CryptoCard
                                        name="SHA-256"
                                        usage="ZKP commitments, nullifier generation, proof challenges"
                                        detail="Used in our ZKP service for Pedersen commitment hashing and Fiat-Shamir challenge generation. 256-bit output ensures collision resistance."
                                        color="green"
                                    />
                                    <CryptoCard
                                        name="ECDSA (secp256k1)"
                                        usage="Voter identity, transaction signing"
                                        detail="Every voter has an Ethereum wallet (public/private key pair). When casting a vote, the transaction is digitally signed with their private key — proving identity without revealing the key."
                                        color="purple"
                                    />
                                    <CryptoCard
                                        name="bcrypt (Blowfish)"
                                        usage="Password hashing"
                                        detail="Voter passwords are hashed with bcrypt(12) — 12 rounds of key stretching. Even if the database is compromised, passwords cannot be reversed."
                                        color="amber"
                                    />
                                </div>
                            </Section>
                        )}

                        {activeSection === 'zkp' && (
                            <Section title="Zero-Knowledge Proofs (ZKP)" icon="fa-user-secret">
                                <p>Zero-Knowledge Proofs allow a voter to <strong>prove their vote is valid without revealing who they voted for</strong>. This is the cornerstone of our privacy-preserving voting system.</p>

                                <InfoCard title="Our ZKP Implementation" color="purple">
                                    <div className="space-y-4">
                                        <div>
                                            <h5 className="font-bold text-sm mb-1">1. Pedersen Commitments</h5>
                                            <p className="text-sm text-gray-600">The voter's choice is hidden inside a cryptographic commitment: <code className="bg-gray-100 px-1 rounded">C = g^candidateId × h^randomness mod p</code>. The commitment can be verified without opening it.</p>
                                        </div>
                                        <div>
                                            <h5 className="font-bold text-sm mb-1">2. Schnorr-style Sigma Protocol</h5>
                                            <p className="text-sm text-gray-600">A non-interactive proof (using Fiat-Shamir heuristic) proves the commitment contains a valid candidateId without revealing it. The verifier checks the proof against the commitment mathematically.</p>
                                        </div>
                                        <div>
                                            <h5 className="font-bold text-sm mb-1">3. Nullifier System</h5>
                                            <p className="text-sm text-gray-600"><code className="bg-gray-100 px-1 rounded">nullifier = hash(voterSecret, electionId)</code> — Same voter + same election = same nullifier. Prevents double voting without revealing identity. Different elections produce different nullifiers (unlinkable).</p>
                                        </div>
                                    </div>
                                </InfoCard>

                                <InfoCard title="ZKP Voting Flow" color="blue">
                                    <div className="space-y-3">
                                        <Step num={1} title="Generate Identity Commitment">Voter creates identityCommitment = hash(secret). Registered on-chain by admin.</Step>
                                        <Step num={2} title="Generate Nullifier">nullifier = hash(secret, electionId). Unique per election, prevents double voting.</Step>
                                        <Step num={3} title="Create Pedersen Commitment">Vote choice hidden: C = g^choice × h^random mod p</Step>
                                        <Step num={4} title="Generate ZK Proof">Schnorr proof proves C contains a valid choice without revealing it.</Step>
                                        <Step num={5} title="Submit to Blockchain">Commitment + nullifier + proof submitted. Contract verifies proof, records vote.</Step>
                                    </div>
                                </InfoCard>

                                <Highlight>The ZKP system ensures <strong>non-coercibility</strong> — a voter cannot prove to a third party how they voted, preventing vote buying and coercion.</Highlight>
                            </Section>
                        )}

                        {activeSection === 'homomorphic' && (
                            <Section title="Homomorphic Encryption" icon="fa-calculator">
                                <p>Homomorphic encryption allows <strong>computations on encrypted data</strong> — votes can be tallied without ever decrypting individual ballots. Only the final SUM is decrypted.</p>

                                <InfoCard title="Paillier Cryptosystem (Additive HE)" color="purple">
                                    <div className="space-y-3">
                                        <div>
                                            <h5 className="font-bold text-sm mb-1">Core Property</h5>
                                            <code className="block bg-gray-900 text-green-400 p-3 rounded-lg text-xs font-mono">
                                                E(m₁) × E(m₂) mod n² = E(m₁ + m₂)<br/>
                                                Multiply ciphertexts → Add plaintexts!<br/><br/>
                                                E(Vote_1) × E(Vote_2) × ... × E(Vote_n) = E(Total)
                                            </code>
                                        </div>
                                        <div>
                                            <h5 className="font-bold text-sm mb-1">Why This Matters</h5>
                                            <p className="text-sm text-gray-600">The election authority can compute the final tally <strong>without ever seeing any individual vote</strong>. The encrypted votes are multiplied together (which adds the plaintexts), and only the final result is decrypted.</p>
                                        </div>
                                    </div>
                                </InfoCard>

                                <InfoCard title="Live Demo: Encrypted Vote Tally" color="blue">
                                    <button onClick={runHeDemo} disabled={heLoading}
                                        className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-primary hover:bg-primary/90 transition disabled:opacity-50 mb-4"
                                    >
                                        {heLoading ? <><i className="fa-solid fa-spinner fa-spin mr-1"></i> Running...</> : <><i className="fa-solid fa-play mr-1"></i> Run Homomorphic Tally Demo</>}
                                    </button>

                                    {heDemo && (
                                        <div className="space-y-3 mt-3">
                                            <div className="bg-gray-50 rounded-lg p-3">
                                                <p className="font-bold text-xs text-gray-500 mb-2">ENCRYPTED VOTES (individual votes hidden)</p>
                                                {heDemo.votes.map((v, i) => (
                                                    <div key={i} className="flex items-center gap-2 text-xs mb-1">
                                                        <span className="font-mono text-gray-400 w-16">{v.voter}</span>
                                                        <span className={`font-bold ${v.vote.includes('Yes') ? 'text-green-600' : 'text-red-500'}`}>{v.vote}</span>
                                                        <span className="text-gray-300">→</span>
                                                        <span className="font-mono text-purple-600 text-[10px]">{v.encrypted}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                                <p className="font-bold text-sm text-green-800"><i className="fa-solid fa-check-circle mr-1"></i> {heDemo.summary}</p>
                                                <p className="text-xs text-green-600 mt-1">Decrypted tally: <strong>{heDemo.decryptedTally}</strong> | Time: {heDemo.timingMs}ms</p>
                                            </div>
                                        </div>
                                    )}
                                </InfoCard>

                                <Highlight>This is an educational Paillier simulation. Real-world FHE systems (TFHE, BGV, CKKS) use 128-bit security with lattice-based assumptions and are used by companies like Zama and Microsoft SEAL.</Highlight>
                            </Section>
                        )}

                        {activeSection === 'mfa' && (
                            <Section title="Multi-Factor Authentication & QR Tickets" icon="fa-shield-halved">
                                <p>Bharat E-Vote implements <strong>3-factor authentication</strong> to ensure that only the legitimate voter can cast a ballot, even if their password is compromised.</p>

                                <InfoCard title="Three Authentication Factors" color="blue">
                                    <div className="space-y-3">
                                        <Step num={1} title="Something You Know — Password">Standard bcrypt-hashed password with 12 rounds of key stretching. Brute-force infeasible.</Step>
                                        <Step num={2} title="Something You Have — Email OTP">After password verification, a 6-digit OTP is sent to the voter's registered email via Resend API. Valid for 5 minutes, max 5 attempts, bcrypt-hashed in database.</Step>
                                        <Step num={3} title="Something You Are — Keystroke Biometrics">Typing patterns (hold times, flight times, speed) are captured during password entry and compared against the enrolled profile using Euclidean distance.</Step>
                                    </div>
                                </InfoCard>

                                <InfoCard title="QR Code Voting Tickets" color="green">
                                    <p className="text-sm text-gray-600 mb-3">After full MFA authentication, the voter receives a <strong>time-limited QR voting ticket</strong> — a JWT-signed cryptographic pass that separates authentication from the voting act.</p>
                                    <div className="space-y-2">
                                        <Step num={1} title="Ticket Issuance">Backend generates JWT with voter ID, nonce, and 5-minute expiry.</Step>
                                        <Step num={2} title="QR Display">QR code rendered in browser with circular countdown timer.</Step>
                                        <Step num={3} title="Validation">Ticket JWT verified (signature + expiry + single-use check in DB).</Step>
                                        <Step num={4} title="Voting Access">Only after validation can the voter enter the proctored voting booth.</Step>
                                    </div>
                                </InfoCard>

                                <Highlight>The QR ticket creates a <strong>temporal separation</strong> between who you are (authentication) and what you do (voting). This makes coercion harder — even if forced to authenticate, the ticket expires before an attacker can use it.</Highlight>
                            </Section>
                        )}

                        {activeSection === 'coercion' && (
                            <Section title="Coercion Resistance & Receipt-Freeness" icon="fa-person-shelter">
                                <p>Our system implements multiple layers to prevent <strong>vote buying</strong> and <strong>coercion</strong> — ensuring voters can express their true preference even under duress.</p>

                                <InfoCard title="Vote Cancellation & Re-voting" color="blue">
                                    <div className="space-y-3">
                                        <p className="text-sm text-gray-600">VotingV2.sol allows a voter to <strong>change their vote up to 3 times</strong> during the voting period. Only the last vote counts.</p>
                                        <div className="bg-gray-900 text-green-400 p-3 rounded-lg text-xs font-mono">
                                            <span className="text-gray-500">// VotingV2.sol — Coercion Resistance</span><br/>
                                            MAX_REVOTES = 3;<br/>
                                            REVOTE_LOCKOUT = 30 minutes; <span className="text-gray-500">// before end</span><br/><br/>
                                            <span className="text-gray-500">// Old vote decremented, new vote counted</span><br/>
                                            candidates[oldCandidateId].voteCount--;<br/>
                                            candidates[newCandidateId].voteCount++;
                                        </div>
                                        <p className="text-sm text-gray-600"><strong>Safeguards:</strong> Max 3 re-votes prevents abuse. Re-vote window closes 30 minutes before votingEndTime to ensure a clean final tally. All events are obfuscated — no candidate choice is leaked.</p>
                                    </div>
                                </InfoCard>

                                <InfoCard title="Receipt-Freeness" color="green">
                                    <div className="space-y-2">
                                        {[
                                            { feature: 'Obfuscated Events', desc: 'VoteCast event hashes candidateId with timestamp and prevrandao — cannot be reverse-engineered' },
                                            { feature: 'ZKP Nullifiers', desc: 'In ZKP mode, voter identity is replaced by a one-way nullifier hash — voter cannot prove their choice to anyone' },
                                            { feature: 'Participation-Only Receipt', desc: 'Vote receipt PDF shows transaction hash but NOT candidate choice. Receipt text: "proves participation without revealing choice"' },
                                            { feature: 'No On-Chain Vote Record', desc: 'The smart contract stores voteCount per candidate but NOT which voter chose which candidate' },
                                        ].map((item, i) => (
                                            <div key={i} className="flex gap-3 p-2 bg-gray-50 rounded-lg">
                                                <i className="fa-solid fa-check-circle text-green-500 mt-0.5"></i>
                                                <div><p className="font-bold text-sm text-gray-900">{item.feature}</p><p className="text-xs text-gray-500">{item.desc}</p></div>
                                            </div>
                                        ))}
                                    </div>
                                </InfoCard>

                                <Highlight>A voter forced to vote under duress can <strong>comply with the coercer</strong>, then privately re-vote later. Since no receipt proves the original choice, the coercer has no way to verify compliance.</Highlight>
                            </Section>
                        )}

                        {activeSection === 'tee' && (
                            <Section title="Trusted Execution Environments (TEEs)" icon="fa-microchip">
                                <p>A TEE is a <strong>secure, isolated processing zone</strong> inside a CPU that protects data even from the operating system and server administrators. We propose TEE integration for the most sensitive operations.</p>

                                <InfoCard title="Intel SGX Architecture Proposal" color="purple">
                                    <div className="space-y-3">
                                        <div className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs font-mono">
                                            <span className="text-blue-400">┌─────────────────────────────────────────┐</span><br/>
                                            <span className="text-blue-400">│</span> <span className="text-yellow-300">Election Server (Untrusted Zone)</span> <span className="text-blue-400">        │</span><br/>
                                            <span className="text-blue-400">│</span>  ┌─────────────────────────────────┐  <span className="text-blue-400">│</span><br/>
                                            <span className="text-blue-400">│</span>  │ <span className="text-green-300">SGX Enclave (Trusted Zone)</span>       │  <span className="text-blue-400">│</span><br/>
                                            <span className="text-blue-400">│</span>  │  • decryptAndTally()            │  <span className="text-blue-400">│</span><br/>
                                            <span className="text-blue-400">│</span>  │  • Sealed private key           │  <span className="text-blue-400">│</span><br/>
                                            <span className="text-blue-400">│</span>  │  • Remote attestation           │  <span className="text-blue-400">│</span><br/>
                                            <span className="text-blue-400">│</span>  │  • Memory encryption (MEE)      │  <span className="text-blue-400">│</span><br/>
                                            <span className="text-blue-400">│</span>  └─────────────────────────────────┘  <span className="text-blue-400">│</span><br/>
                                            <span className="text-blue-400">│</span> OS / Admin / Malware → <span className="text-red-400">CANNOT ACCESS</span>   <span className="text-blue-400">│</span><br/>
                                            <span className="text-blue-400">└─────────────────────────────────────────┘</span>
                                        </div>
                                        <p className="text-sm text-gray-600">The tally decryption key is <strong>sealed inside the enclave</strong>. Even if the server is compromised, the attacker cannot extract the key or view individual votes during tallying.</p>
                                    </div>
                                </InfoCard>

                                <InfoCard title="Proposed Integration" color="blue">
                                    <div className="space-y-2">
                                        <Step num={1} title="Remote Attestation">Before the election, the SGX enclave proves to election auditors that it runs unmodified, approved tally code.</Step>
                                        <Step num={2} title="Sealed Key Storage">The homomorphic decryption private key is generated INSIDE the enclave and sealed. It never exists outside.</Step>
                                        <Step num={3} title="Encrypted Tally">Encrypted votes from the blockchain are streamed into the enclave. Decryption happens only inside the enclave.</Step>
                                        <Step num={4} title="Result Publication">Only the final tally (aggregate) is output. Individual votes are decrypted and immediately discarded inside the enclave memory.</Step>
                                    </div>
                                </InfoCard>

                                <Highlight>TEEs require specific hardware (Intel SGX, ARM TrustZone, AMD SEV). This is a proposed architecture for production deployment with Election Commission infrastructure, not implemented in this demo.</Highlight>
                            </Section>
                        )}

                        {activeSection === 'postquantum' && (
                            <Section title="Post-Quantum Cryptography" icon="fa-atom">
                                <p>Current cryptography (RSA, ECDSA) is <strong>vulnerable to quantum computers</strong>. CRYSTALS-Dilithium (NIST FIPS 204) is the leading quantum-resistant digital signature standard.</p>

                                <InfoCard title="The Quantum Threat" color="red">
                                    <div className="space-y-2">
                                        <p className="text-sm text-gray-600"><strong>Shor's Algorithm</strong> can break RSA and ECDSA in polynomial time on a quantum computer. This affects:</p>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div className="bg-red-50 p-2 rounded"><strong>Ethereum Wallets:</strong> ECDSA private keys extractable</div>
                                            <div className="bg-red-50 p-2 rounded"><strong>Vote Signatures:</strong> Forgeable by quantum adversary</div>
                                            <div className="bg-red-50 p-2 rounded"><strong>TLS/HTTPS:</strong> Past traffic decryptable</div>
                                            <div className="bg-red-50 p-2 rounded"><strong>JWT Tokens:</strong> Signature bypass possible</div>
                                        </div>
                                        <p className="text-sm text-gray-600 mt-2"><strong>"Harvest Now, Decrypt Later":</strong> Adversaries may record encrypted vote data TODAY for decryption when quantum computers arrive (est. 2030-2035).</p>
                                    </div>
                                </InfoCard>

                                <InfoCard title="Live Demo: CRYSTALS-Dilithium Signatures" color="purple">
                                    <button onClick={runPqDemo} disabled={pqLoading}
                                        className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 transition disabled:opacity-50 mb-4"
                                    >
                                        {pqLoading ? <><i className="fa-solid fa-spinner fa-spin mr-1"></i> Running...</> : <><i className="fa-solid fa-atom mr-1"></i> Run Post-Quantum Signature Demo</>}
                                    </button>

                                    {pqDemo && (
                                        <div className="space-y-3 mt-3">
                                            {pqDemo.steps.map((s, i) => (
                                                <div key={i} className={`flex items-center gap-3 p-2 rounded-lg text-xs ${s.status === 'done' ? 'bg-green-50' : 'bg-gray-50'}`}>
                                                    <i className={`fa-solid ${s.status === 'done' ? 'fa-check-circle text-green-500' : 'fa-spinner fa-spin text-gray-400'}`}></i>
                                                    <span className="font-bold">{s.phase}</span>
                                                    {s.data?.timeMs && <span className="text-gray-400">({s.data.timeMs}ms)</span>}
                                                    {s.phase === 'Tamper Detection' && s.data && (
                                                        <span className={s.data.valid ? 'text-red-600' : 'text-green-600'}>
                                                            {s.data.valid ? '⚠️ Tampered accepted!' : '✓ Tampered message rejected'}
                                                        </span>
                                                    )}
                                                </div>
                                            ))}

                                            {pqDemo.comparison && (
                                                <div className="overflow-x-auto mt-3">
                                                    <table className="w-full text-xs border-collapse">
                                                        <thead><tr className="bg-gray-100"><th className="p-2 text-left">Metric</th><th className="p-2">ECDSA (Current)</th><th className="p-2">Dilithium (PQ)</th></tr></thead>
                                                        <tbody>
                                                            {pqDemo.comparison.rows.map((row, i) => (
                                                                <tr key={i} className="border-t border-gray-200">
                                                                    <td className="p-2 font-bold">{row.metric}</td>
                                                                    <td className="p-2 text-center">{row.ecdsa}</td>
                                                                    <td className="p-2 text-center font-semibold text-purple-700">{row.pq}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}

                                            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                                <p className="font-bold text-sm text-green-800">{pqDemo.summary}</p>
                                            </div>
                                        </div>
                                    )}
                                </InfoCard>

                                <InfoCard title="Migration Roadmap" color="blue">
                                    <div className="space-y-3">
                                        {postQuantumService.getMigrationRoadmap().phases.map((phase, i) => (
                                            <Step key={i} num={i + 1} title={`${phase.phase} (${phase.timeline})`}>{phase.description}</Step>
                                        ))}
                                    </div>
                                </InfoCard>

                                <Highlight>Post-quantum cryptography is not a future concern — it's a <strong>present imperative</strong>. NIST standardized CRYSTALS-Dilithium as FIPS 204 in August 2024. Our migration roadmap ensures Bharat E-Vote is ready before quantum computers threaten current encryption.</Highlight>
                            </Section>
                        )}

                        {activeSection === 'ipfs' && (
                            <Section title="IPFS Decentralized Storage" icon="fa-database">
                                <p>The InterPlanetary File System (IPFS) provides <strong>content-addressed, decentralized storage</strong> for vote receipts and election metadata — ensuring data integrity even if our servers go offline.</p>

                                <InfoCard title="What We Store on IPFS" color="blue">
                                    <div className="space-y-2">
                                        {[
                                            { type: 'Vote Receipts', desc: 'Commitment hash, nullifier, timestamp (candidateId excluded for privacy)' },
                                            { type: 'Candidate Metadata', desc: 'Name, party, constituency, manifesto references' },
                                            { type: 'Election Summaries', desc: 'Total votes, candidates count, ZKP status, timestamps' },
                                        ].map((item, i) => (
                                            <div key={i} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                                                <i className="fa-solid fa-thumbtack text-blue-500 mt-0.5"></i>
                                                <div>
                                                    <p className="font-bold text-sm text-gray-900">{item.type}</p>
                                                    <p className="text-xs text-gray-500">{item.desc}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </InfoCard>

                                <Highlight>IPFS uses <strong>Content Identifiers (CIDs)</strong> — the hash of the content itself. If even a single byte changes, the CID changes. This makes tampering immediately detectable.</Highlight>
                            </Section>
                        )}

                        {activeSection === 'threats' && (
                            <Section title="Formal Threat Model (STRIDE)" icon="fa-skull-crossbones">
                                <p>A systematic analysis of threats using the <strong>STRIDE</strong> framework — Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, and Elevation of Privilege.</p>

                                <InfoCard title="Attack Surface Analysis" color="red">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs border-collapse">
                                            <thead>
                                                <tr className="bg-gray-100">
                                                    <th className="p-2 text-left font-bold">Threat</th>
                                                    <th className="p-2 text-center">Category</th>
                                                    <th className="p-2 text-center">Likelihood</th>
                                                    <th className="p-2 text-center">Impact</th>
                                                    <th className="p-2 text-left">Mitigation</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {[
                                                    { threat: 'Voter machine compromised (keylogger)', cat: 'Spoofing', like: 'Medium', likeColor: 'amber', impact: 'High', impactColor: 'red', mitigation: 'Proctored window, MFA, keystroke biometrics' },
                                                    { threat: 'DDoS on API backend', cat: 'DoS', like: 'High', likeColor: 'red', impact: 'High', impactColor: 'red', mitigation: 'Cloudflare WAF, Upstash Redis rate limiting' },
                                                    { threat: 'Malicious front-end (phishing)', cat: 'Tampering', like: 'Medium', likeColor: 'amber', impact: 'Critical', impactColor: 'red', mitigation: 'CSP, HSTS, SRI hashes, on-chain proof rejection' },
                                                    { threat: 'Admin collusion (fake voters)', cat: 'EoP', like: 'Low', likeColor: 'green', impact: 'Critical', impactColor: 'red', mitigation: 'On-chain audit log, Merkle tree whitelist (proposed)' },
                                                    { threat: '51% attack on blockchain', cat: 'Tampering', like: 'Very Low', likeColor: 'green', impact: 'Critical', impactColor: 'red', mitigation: 'PoS network with thousands of validators' },
                                                    { threat: 'Smart contract vulnerability', cat: 'Tampering', like: 'Low', likeColor: 'green', impact: 'Critical', impactColor: 'red', mitigation: '85 unit tests, CEI pattern, UUPS proxy (proposed)' },
                                                    { threat: 'Replay attack', cat: 'Repudiation', like: 'Low', likeColor: 'green', impact: 'Medium', impactColor: 'amber', mitigation: 'Nonce tracking + hasVoted flag + nullifier' },
                                                    { threat: 'Sybil attack (fake identities)', cat: 'Spoofing', like: 'Medium', likeColor: 'amber', impact: 'High', impactColor: 'red', mitigation: 'Aadhaar uniqueness, voter whitelist, oracle (proposed)' },
                                                    { threat: 'MetaMask wallet theft', cat: 'Spoofing', like: 'Medium', likeColor: 'amber', impact: 'High', impactColor: 'red', mitigation: 'MFA separates auth from wallet, QR ticket' },
                                                    { threat: 'Side-channel on ZKP (timing)', cat: 'Info Disc.', like: 'Low', likeColor: 'green', impact: 'Medium', impactColor: 'amber', mitigation: 'Constant-time modPow, Web Crypto API' },
                                                    { threat: 'IPFS metadata tampering', cat: 'Tampering', like: 'Very Low', likeColor: 'green', impact: 'Low', impactColor: 'green', mitigation: 'Content-addressed storage (hash = address)' },
                                                    { threat: 'JWT token theft (XSS)', cat: 'Spoofing', like: 'Low', likeColor: 'green', impact: 'High', impactColor: 'red', mitigation: 'CSP, input sanitization, 24h expiry' },
                                                ].map((row, i) => (
                                                    <tr key={i} className="border-t border-gray-200 hover:bg-gray-50">
                                                        <td className="p-2 font-semibold text-gray-900">{row.threat}</td>
                                                        <td className="p-2 text-center"><span className="px-1.5 py-0.5 rounded bg-gray-100 font-medium">{row.cat}</span></td>
                                                        <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded font-bold text-${row.likeColor}-700 bg-${row.likeColor}-50`}>{row.like}</span></td>
                                                        <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded font-bold text-${row.impactColor}-700 bg-${row.impactColor}-50`}>{row.impact}</span></td>
                                                        <td className="p-2 text-gray-600">{row.mitigation}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </InfoCard>

                                <InfoCard title="Risk Heat Map" color="amber">
                                    <div className="grid grid-cols-5 gap-1 text-[10px] font-bold text-center">
                                        <div className="p-1"></div>
                                        <div className="p-2 bg-green-100 rounded text-green-700">Low</div>
                                        <div className="p-2 bg-amber-100 rounded text-amber-700">Medium</div>
                                        <div className="p-2 bg-red-100 rounded text-red-700">High</div>
                                        <div className="p-2 bg-red-200 rounded text-red-800">Critical</div>
                                        
                                        <div className="p-2 bg-red-100 rounded text-red-700">High</div>
                                        <div className="p-2 bg-gray-50 rounded"></div>
                                        <div className="p-2 bg-gray-50 rounded"></div>
                                        <div className="p-2 bg-gray-50 rounded"></div>
                                        <div className="p-2 bg-red-50 border border-red-200 rounded text-red-800">DDoS</div>

                                        <div className="p-2 bg-amber-100 rounded text-amber-700">Med</div>
                                        <div className="p-2 bg-gray-50 rounded"></div>
                                        <div className="p-2 bg-amber-50 border border-amber-200 rounded text-amber-700">Timing</div>
                                        <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700">Keylog, Sybil, Wallet</div>
                                        <div className="p-2 bg-red-50 border border-red-200 rounded text-red-800">Phishing</div>

                                        <div className="p-2 bg-green-100 rounded text-green-700">Low</div>
                                        <div className="p-2 bg-green-50 border border-green-200 rounded text-green-700">IPFS</div>
                                        <div className="p-2 bg-amber-50 border border-amber-200 rounded text-amber-700">Replay</div>
                                        <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700">JWT/XSS</div>
                                        <div className="p-2 bg-red-50 border border-red-200 rounded text-red-800">Admin, Contract</div>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-3 text-center">Rows = Likelihood (High → Low) · Columns = Impact (Low → Critical)</p>
                                </InfoCard>

                                <Highlight>The highest-risk threats (DDoS, phishing, keylogger) are <strong>infrastructure-level challenges common to all web applications</strong> — not unique to blockchain voting. Our 8-layer defense-in-depth approach mitigates most vectors.</Highlight>
                            </Section>
                        )}

                        {activeSection === 'trust' && (
                            <Section title="Trust Analysis & Oracle Problem" icon="fa-handshake-angle">
                                <p>Three critical trust assumptions underpin the system. Understanding and mitigating them is essential for a credible deployment.</p>

                                <InfoCard title="Critical Gap #1: Semi-Trusted Admin" color="red">
                                    <div className="space-y-3">
                                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                            <p className="text-sm font-bold text-red-800"><i className="fa-solid fa-exclamation-triangle mr-1"></i> Current Limitation</p>
                                            <p className="text-xs text-red-700 mt-1">The admin calls <code className="bg-red-100 px-1 rounded">registerEligibleVoter(identity)</code> for each voter. This means the admin knows all eligible identities and could theoretically generate secrets to vote on their behalf.</p>
                                        </div>
                                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                            <p className="text-sm font-bold text-green-800"><i className="fa-solid fa-lightbulb mr-1"></i> Proposed Solution: Merkle Tree Whitelist</p>
                                            <p className="text-xs text-green-700 mt-1">Admin publishes only the <strong>Merkle root</strong> on-chain. Voters prove membership via a Merkle proof (sibling hashes). The admin's role reduces to publishing a single hash — they cannot forge proof of membership.</p>
                                            <div className="mt-2 bg-gray-900 text-green-400 p-3 rounded-lg text-[10px] font-mono">
                                                {'          Root Hash (on-chain)'}<br/>
                                                {'         /                    \\'}<br/>
                                                {'    Hash(AB)              Hash(CD)'}<br/>
                                                {'   /       \\            /       \\'}<br/>
                                                {'Hash(A)  Hash(B)    Hash(C)  Hash(D)'}<br/>
                                                {'  |         |          |         |'}<br/>
                                                {'Voter₁    Voter₂    Voter₃    Voter₄'}
                                            </div>
                                        </div>
                                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                            <p className="text-sm font-bold text-blue-800"><i className="fa-solid fa-shield-halved mr-1"></i> Current Mitigations</p>
                                            <ul className="text-xs text-blue-700 mt-1 space-y-1">
                                                <li>• Every <code className="bg-blue-100 px-1 rounded">registerEligibleVoter()</code> emits a <strong>VoterRegistered</strong> event — publicly auditable</li>
                                                <li>• AdminAuditLog records all actions with IP addresses</li>
                                                <li>• Identity commitment is one-way — admin cannot reverse-engineer the secret</li>
                                                <li>• Anyone can compare <code className="bg-blue-100 px-1 rounded">allNullifiers.length</code> against registered count</li>
                                            </ul>
                                        </div>
                                    </div>
                                </InfoCard>

                                <InfoCard title="Critical Gap #2: Front-End Code Integrity" color="amber">
                                    <div className="space-y-3">
                                        <p className="text-sm text-gray-600">ZKP proof generation runs in the browser (<code className="bg-gray-100 px-1 rounded">zkpService.js</code>). A malicious front-end could steal secrets or change votes.</p>
                                        <div className="grid sm:grid-cols-2 gap-2">
                                            {[
                                                { solution: 'Subresource Integrity (SRI)', desc: 'Browser refuses scripts whose SHA-384 hash doesn\'t match', complexity: 'Low' },
                                                { solution: 'Reproducible Builds', desc: 'Auditors compile source and verify bundle matches', complexity: 'Medium' },
                                                { solution: 'Code Signing', desc: 'ECI signs builds; extension verifies before execution', complexity: 'Medium' },
                                                { solution: 'Hardware Wallet', desc: 'ZKP generation inside Ledger/Trezor TEE', complexity: 'High' },
                                            ].map((s, i) => (
                                                <div key={i} className="bg-gray-50 rounded-lg p-3">
                                                    <p className="font-bold text-sm text-gray-900">{s.solution}</p>
                                                    <p className="text-xs text-gray-500 mt-0.5">{s.desc}</p>
                                                    <span className={`text-[10px] font-bold mt-1 inline-block px-1.5 py-0.5 rounded ${s.complexity === 'Low' ? 'bg-green-100 text-green-700' : s.complexity === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{s.complexity}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                            <p className="text-xs text-green-700"><i className="fa-solid fa-check-circle mr-1"></i> <strong>Key insight:</strong> Even if the front-end is compromised, <code className="bg-green-100 px-1 rounded">_verifyVoteProof()</code> in the smart contract <strong>rejects invalid proofs on-chain</strong>. The attacker's best outcome is denial-of-service, not vote manipulation.</p>
                                        </div>
                                    </div>
                                </InfoCard>

                                <InfoCard title="Critical Gap #3: The Oracle Problem" color="purple">
                                    <div className="space-y-3">
                                        <p className="text-sm text-gray-600">The blockchain has no inherent way to verify <strong>real-world identity</strong> (Aadhaar, citizenship). This is the classic "oracle problem."</p>
                                        <div className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs font-mono">
                                            <span className="text-blue-400">{'┌────────────────┐    ┌──────────────────┐    ┌────────────────┐'}</span><br/>
                                            <span className="text-blue-400">{'│'}</span> <span className="text-yellow-300">UIDAI / ECI</span>{'    '}<span className="text-blue-400">{'│───►│'}</span> <span className="text-yellow-300">Identity Oracle</span>{'  '}<span className="text-blue-400">{'│───►│'}</span> <span className="text-yellow-300">Smart Contract</span> <span className="text-blue-400">{'│'}</span><br/>
                                            <span className="text-blue-400">{'│'}</span>{' Aadhaar DB     '}<span className="text-blue-400">{'│    │'}</span>{' Signed tokens   '}<span className="text-blue-400">{'│    │'}</span>{' Verify sig     '}<span className="text-blue-400">{'│'}</span><br/>
                                            <span className="text-blue-400">{'│'}</span>{' Digital tokens  '}<span className="text-blue-400">{'│    │'}</span>{' Relay to chain  '}<span className="text-blue-400">{'│    │'}</span>{' Store auth     '}<span className="text-blue-400">{'│'}</span><br/>
                                            <span className="text-blue-400">{'└────────────────┘    └──────────────────┘    └────────────────┘'}</span>
                                        </div>
                                        <p className="text-sm text-gray-600"><strong>Proposed:</strong> ECI issues digitally signed eligibility tokens containing <code className="bg-gray-100 px-1 rounded">(voterAddress, constituency, electionId)</code>. An <code className="bg-gray-100 px-1 rounded">OracleVerifier.sol</code> verifies ECDSA signatures — voters self-authorize without admin involvement.</p>
                                    </div>
                                </InfoCard>

                                <Highlight>These gaps are <strong>openly acknowledged</strong> in our design. Proposed solutions (Merkle trees, SRI, oracle contracts) demonstrate understanding of the complete system — addressing them makes the difference between a prototype and a production system.</Highlight>
                            </Section>
                        )}

                        {activeSection === 'upgrade' && (
                            <Section title="Upgradeability & Disaster Recovery" icon="fa-arrows-rotate">
                                <p>Smart contracts are <strong>immutable once deployed</strong>. A critical bug in <code>VotingV2.sol</code> during an active election could be catastrophic. We propose standard patterns for safe upgrades.</p>

                                <InfoCard title="UUPS Proxy Pattern (ERC-1822)" color="blue">
                                    <div className="space-y-3">
                                        <p className="text-sm text-gray-600">The Universal Upgradeable Proxy Standard separates <strong>state</strong> (in the proxy) from <strong>logic</strong> (in the implementation). Upgrades replace the logic contract while preserving all election data.</p>
                                        <div className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs font-mono">
                                            <span className="text-blue-400">{'┌──────────────────┐     ┌──────────────────┐'}</span><br/>
                                            <span className="text-blue-400">{'│'}</span> <span className="text-yellow-300">Proxy (ERC-1967)</span>  <span className="text-blue-400">{'│────►│'}</span> <span className="text-yellow-300">VotingV2.sol</span>{'      '}<span className="text-blue-400">{'│'}</span><br/>
                                            <span className="text-blue-400">{'│'}</span>{' Stores: voters,  '}<span className="text-blue-400">{'│     │'}</span>{' Logic only       '}<span className="text-blue-400">{'│'}</span><br/>
                                            <span className="text-blue-400">{'│'}</span>{' candidates,      '}<span className="text-blue-400">{'│     └──────────────────┘'}</span><br/>
                                            <span className="text-blue-400">{'│'}</span>{' vote counts       '}<span className="text-blue-400">{'│           ↓ upgrade'}</span><br/>
                                            <span className="text-blue-400">{'│'}</span>{' (delegatecall)   '}<span className="text-blue-400">{'│     ┌──────────────────┐'}</span><br/>
                                            <span className="text-blue-400">{'│'}</span>{'                   '}<span className="text-blue-400">{'│────►│'}</span> <span className="text-yellow-300">VotingV3.sol</span>{'      '}<span className="text-blue-400">{'│'}</span><br/>
                                            <span className="text-blue-400">{'│'}</span>{'                   '}<span className="text-blue-400">{'│     │'}</span>{' Bug fix + new    '}<span className="text-blue-400">{'│'}</span><br/>
                                            <span className="text-blue-400">{'└──────────────────┘     └──────────────────┘'}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 mt-2">
                                            <div className="bg-green-50 rounded-lg p-2 text-xs"><i className="fa-solid fa-check text-green-500 mr-1"></i> <strong>State preserved</strong> — all votes intact</div>
                                            <div className="bg-green-50 rounded-lg p-2 text-xs"><i className="fa-solid fa-check text-green-500 mr-1"></i> <strong>Transparent</strong> — upgrade events on-chain</div>
                                            <div className="bg-green-50 rounded-lg p-2 text-xs"><i className="fa-solid fa-check text-green-500 mr-1"></i> <strong>Gas efficient</strong> — no data migration</div>
                                            <div className="bg-green-50 rounded-lg p-2 text-xs"><i className="fa-solid fa-check text-green-500 mr-1"></i> <strong>Rollback</strong> — can point back to old logic</div>
                                        </div>
                                    </div>
                                </InfoCard>

                                <InfoCard title="Multi-Signature Governance" color="green">
                                    <p className="text-sm text-gray-600 mb-3">To prevent unilateral admin control, critical functions require <strong>multi-sig approval</strong> with timelocks:</p>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs border-collapse">
                                            <thead>
                                                <tr className="bg-gray-100">
                                                    <th className="p-2 text-left">Action</th>
                                                    <th className="p-2 text-center">Required Signers</th>
                                                    <th className="p-2 text-center">Timelock</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {[
                                                    { action: 'upgradeToAndCall()', signers: '2-of-3', timelock: '48 hours' },
                                                    { action: 'startVoting()', signers: '1-of-3', timelock: 'None' },
                                                    { action: 'endVoting()', signers: '2-of-3', timelock: 'None' },
                                                    { action: 'addCandidate()', signers: '1-of-3', timelock: 'None (pre-voting)' },
                                                    { action: 'Emergency pause()', signers: '1-of-3', timelock: 'Immediate' },
                                                ].map((row, i) => (
                                                    <tr key={i} className="border-t border-gray-200">
                                                        <td className="p-2 font-mono font-bold text-gray-900">{row.action}</td>
                                                        <td className="p-2 text-center"><span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold">{row.signers}</span></td>
                                                        <td className="p-2 text-center">{row.timelock}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-3"><strong>Implementation:</strong> OpenZeppelin's <code className="bg-gray-100 px-1 rounded">TimelockController</code> + Gnosis Safe multi-sig wallet. 48-hour public timelock for contract upgrades allows community scrutiny.</p>
                                </InfoCard>

                                <InfoCard title="Admin Key Recovery" color="purple">
                                    <div className="space-y-2">
                                        {[
                                            { title: 'Multi-sig governance', desc: 'No single key is a single point of failure — 2-of-3 required for critical ops' },
                                            { title: 'Social recovery', desc: '3-of-5 state-level election officers can rotate the admin key' },
                                            { title: 'Emergency pause', desc: 'Separate pause() function with independent signer halts all operations' },
                                            { title: 'Timelock transparency', desc: '48-hour delay on upgrades allows public review and objection' },
                                        ].map((item, i) => (
                                            <div key={i} className="flex gap-3 p-2 bg-gray-50 rounded-lg">
                                                <i className="fa-solid fa-key text-purple-500 mt-0.5"></i>
                                                <div>
                                                    <p className="font-bold text-sm text-gray-900">{item.title}</p>
                                                    <p className="text-xs text-gray-500">{item.desc}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </InfoCard>

                                <Highlight>Contract upgradeability is a <strong>double-edged sword</strong> — it enables bug fixes but also introduces upgrade risk. The multi-sig + timelock pattern ensures no single party can unilaterally alter the election contract, while still allowing emergency responses.</Highlight>
                            </Section>
                        )}

                        {activeSection === 'arch' && (
                            <Section title="System Architecture" icon="fa-sitemap">
                                <p>Bharat E-Vote follows a three-tier architecture separating concerns between the user interface, business logic, and blockchain network.</p>

                                <div className="my-6 bg-white rounded-xl border-2 border-gray-200 p-6">
                                    <h4 className="font-bold text-center mb-6 text-gray-900">Architecture Overview</h4>
                                    <div className="grid md:grid-cols-3 gap-4">
                                        <ArchTier
                                            title="Frontend (Client)"
                                            color="blue"
                                            icon="fa-display"
                                            items={['React 18 + Vite', 'MetaMask Integration', 'ethers.js Web3 Bridge', 'Proctored Voting Window', 'Keystroke Biometrics', 'i18n (Hindi/English)', 'PDF Receipt Generation']}
                                        />
                                        <ArchTier
                                            title="Backend (Server)"
                                            color="green"
                                            icon="fa-server"
                                            items={['Express.js REST API', 'PostgreSQL + Prisma ORM', 'JWT Authentication', 'ZKP Crypto Service', 'IPFS Pinning (Pinata)', 'WebSocket Listener', 'Rate Limiting + Helmet']}
                                        />
                                        <ArchTier
                                            title="Blockchain (Network)"
                                            color="purple"
                                            icon="fa-link"
                                            items={['Solidity Smart Contract', 'Hardhat Local Node (PoA)', 'Sepolia Testnet (PoS)', 'ERC-2771 Meta-Transactions', 'keccak256 Vote Receipts', 'Event-Driven Logging', 'ZKP Verification']}
                                        />
                                    </div>
                                </div>

                                <InfoCard title="Data Flow" color="blue">
                                    <div className="space-y-2 text-sm">
                                        <p><strong>Registration:</strong> Voter → Backend (whitelist check, bcrypt) → PostgreSQL → JWT issued</p>
                                        <p><strong>Voting:</strong> Voter → MetaMask signs tx → Smart Contract (on-chain) → Event emitted → Backend listener → IPFS pin</p>
                                        <p><strong>Results:</strong> Frontend → ethers.js → Smart Contract getAllCandidates() → Live vote counts</p>
                                        <p><strong>Verification:</strong> TX hash → Etherscan / Smart Contract getVoteReceipt() → Cryptographic proof</p>
                                    </div>
                                </InfoCard>
                            </Section>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// Reusable components
function Section({ title, icon, children }) {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
            <h2 className="text-2xl font-extrabold text-gray-900 mb-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <i className={`fa-solid ${icon} text-primary`}></i>
                </div>
                {title}
            </h2>
            <div className="prose prose-sm max-w-none text-gray-700 space-y-4">{children}</div>
        </div>
    );
}

function InfoCard({ title, color, children }) {
    const colors = {
        blue: 'border-blue-200 bg-blue-50/50',
        green: 'border-green-200 bg-green-50/50',
        purple: 'border-purple-200 bg-purple-50/50',
        red: 'border-red-200 bg-red-50/50',
        amber: 'border-amber-200 bg-amber-50/50',
    };
    return (
        <div className={`border-2 ${colors[color]} rounded-xl p-5 my-4`}>
            <h4 className="font-bold text-gray-900 mb-3">{title}</h4>
            <div className="text-sm text-gray-700">{children}</div>
        </div>
    );
}

function Step({ num, title, children }) {
    return (
        <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{num}</div>
            <div>
                <p className="font-bold text-sm text-gray-900">{title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{children}</p>
            </div>
        </div>
    );
}

function CryptoCard({ name, usage, detail, color }) {
    const colors = { blue: 'border-l-blue-500', green: 'border-l-green-500', purple: 'border-l-purple-500', amber: 'border-l-amber-500' };
    return (
        <div className={`bg-white border border-gray-200 border-l-4 ${colors[color]} rounded-xl p-4`}>
            <h4 className="font-bold text-gray-900">{name}</h4>
            <p className="text-xs text-primary font-semibold mt-1">{usage}</p>
            <p className="text-sm text-gray-600 mt-2">{detail}</p>
        </div>
    );
}

function Highlight({ children }) {
    return (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 my-4 text-sm text-amber-800">
            <i className="fa-solid fa-lightbulb text-amber-500 mr-2"></i>
            {children}
        </div>
    );
}

function ArchTier({ title, color, icon, items }) {
    const colors = { blue: 'border-blue-300 bg-blue-50', green: 'border-green-300 bg-green-50', purple: 'border-purple-300 bg-purple-50' };
    const iconColors = { blue: 'text-blue-600 bg-blue-100', green: 'text-green-600 bg-green-100', purple: 'text-purple-600 bg-purple-100' };
    return (
        <div className={`border-2 ${colors[color]} rounded-xl p-4`}>
            <div className="flex items-center gap-2 mb-3">
                <div className={`w-8 h-8 rounded-full ${iconColors[color]} flex items-center justify-center`}><i className={`fa-solid ${icon} text-sm`}></i></div>
                <h4 className="font-bold text-sm text-gray-900">{title}</h4>
            </div>
            <ul className="space-y-1.5">
                {items.map((item, i) => (
                    <li key={i} className="text-xs text-gray-600 flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full bg-gray-400"></span>{item}
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default TechnologyPage;
