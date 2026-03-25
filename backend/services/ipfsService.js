/**
 * IPFS Metadata Storage Service
 * 
 * Provides pinning and retrieval of vote receipts, candidate metadata,
 * and election data to/from IPFS.
 * 
 * Supports:
 * - Pinata cloud pinning (when API keys are configured)
 * - Local file-based mock (fallback for development)
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Pinata API configuration
const PINATA_API_KEY = process.env.PINATA_API_KEY || '';
const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY || '';
const PINATA_BASE_URL = 'https://api.pinata.cloud';

// Local mock storage directory
const MOCK_IPFS_DIR = path.join(__dirname, '..', 'ipfs_mock');

// Ensure mock directory exists
if (!fs.existsSync(MOCK_IPFS_DIR)) {
    fs.mkdirSync(MOCK_IPFS_DIR, { recursive: true });
}

/**
 * Check if Pinata is configured
 */
function isPinataConfigured() {
    return PINATA_API_KEY.length > 0 && PINATA_SECRET_KEY.length > 0;
}

/**
 * Generate a mock IPFS CID (Content Identifier)
 * Mimics the format: Qm... (46 characters)
 */
function generateMockCID(data) {
    const hash = crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
    return 'Qm' + hash.substring(0, 44);
}

const ipfsService = {
    /**
     * Pin JSON data to IPFS
     * @param {Object} data - JSON data to pin
     * @param {string} name - Descriptive name for the pin
     * @returns {{ ipfsHash: string, pinSize: number, timestamp: string }}
     */
    async pinJSON(data, name = 'bharat-evote-data') {
        if (isPinataConfigured()) {
            return this._pinToPinata(data, name);
        }
        return this._pinToLocal(data, name);
    },

    /**
     * Pin vote receipt metadata to IPFS
     * @param {Object} voteData - Vote data (commitment, nullifier, timestamp, etc.)
     * @returns {{ ipfsHash: string, ... }}
     */
    async pinVoteMetadata(voteData) {
        const metadata = {
            type: 'vote_receipt',
            version: '1.0',
            election: 'bharat-evote-2026',
            commitment: voteData.commitment,
            nullifierHash: voteData.nullifierHash,
            timestamp: voteData.timestamp || new Date().toISOString(),
            zkpVerified: true,
            // Note: candidateId is NOT included — privacy preserved
        };

        return this.pinJSON(metadata, `vote-receipt-${Date.now()}`);
    },

    /**
     * Pin candidate metadata to IPFS
     * @param {Object} candidateData - Candidate info
     * @returns {{ ipfsHash: string, ... }}
     */
    async pinCandidateMetadata(candidateData) {
        const metadata = {
            type: 'candidate_metadata',
            version: '1.0',
            candidateId: candidateData.id,
            name: candidateData.name,
            partyName: candidateData.partyName || '',
            partySymbol: candidateData.partySymbol || '',
            stateCode: candidateData.stateCode || 0,
            constituencyCode: candidateData.constituencyCode || 0,
            timestamp: new Date().toISOString()
        };

        return this.pinJSON(metadata, `candidate-${candidateData.id}`);
    },

    /**
     * Pin election summary to IPFS
     * @param {Object} electionData - Election summary data
     * @returns {{ ipfsHash: string, ... }}
     */
    async pinElectionMetadata(electionData) {
        const metadata = {
            type: 'election_metadata',
            version: '1.0',
            electionId: electionData.electionId || 'bharat-evote-2026',
            totalVotes: electionData.totalVotes || 0,
            totalCandidates: electionData.totalCandidates || 0,
            zkpEnabled: electionData.zkpEnabled || false,
            timestamp: new Date().toISOString()
        };

        return this.pinJSON(metadata, 'election-summary');
    },

    /**
     * Retrieve data from IPFS by hash
     * @param {string} ipfsHash - The IPFS CID
     * @returns {Object} The retrieved JSON data
     */
    async getFromIPFS(ipfsHash) {
        if (isPinataConfigured()) {
            return this._getFromPinata(ipfsHash);
        }
        return this._getFromLocal(ipfsHash);
    },

    /**
     * List all pinned items
     * @returns {Array} List of pinned items
     */
    async listPins() {
        if (isPinataConfigured()) {
            return this._listPinataPins();
        }
        return this._listLocalPins();
    },

    // ============ Pinata Implementation ============

    async _pinToPinata(data, name) {
        try {
            const response = await fetch(`${PINATA_BASE_URL}/pinning/pinJSONToIPFS`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'pinata_api_key': PINATA_API_KEY,
                    'pinata_secret_api_key': PINATA_SECRET_KEY
                },
                body: JSON.stringify({
                    pinataContent: data,
                    pinataMetadata: { name }
                })
            });

            if (!response.ok) {
                throw new Error(`Pinata error: ${response.statusText}`);
            }

            const result = await response.json();
            return {
                ipfsHash: result.IpfsHash,
                pinSize: result.PinSize,
                timestamp: result.Timestamp
            };
        } catch (err) {
            console.error('Pinata pinning failed, falling back to local:', err.message);
            return this._pinToLocal(data, name);
        }
    },

    async _getFromPinata(ipfsHash) {
        try {
            const response = await fetch(`https://gateway.pinata.cloud/ipfs/${ipfsHash}`);
            if (!response.ok) {
                throw new Error('Failed to retrieve from IPFS');
            }
            return response.json();
        } catch (err) {
            console.error('Pinata retrieval failed, trying local:', err.message);
            return this._getFromLocal(ipfsHash);
        }
    },

    async _listPinataPins() {
        try {
            const response = await fetch(`${PINATA_BASE_URL}/data/pinList?status=pinned`, {
                headers: {
                    'pinata_api_key': PINATA_API_KEY,
                    'pinata_secret_api_key': PINATA_SECRET_KEY
                }
            });

            if (!response.ok) throw new Error('Failed to list pins');
            const result = await response.json();
            return result.rows.map(r => ({
                ipfsHash: r.ipfs_pin_hash,
                name: r.metadata?.name || 'unknown',
                size: r.size,
                date: r.date_pinned
            }));
        } catch (err) {
            return this._listLocalPins();
        }
    },

    // ============ Local Mock Implementation ============

    async _pinToLocal(data, name) {
        const cid = generateMockCID(data);
        const filePath = path.join(MOCK_IPFS_DIR, `${cid}.json`);

        const stored = {
            data,
            metadata: { name, pinned: new Date().toISOString() }
        };

        fs.writeFileSync(filePath, JSON.stringify(stored, null, 2));
        console.log(`📌 IPFS Mock: Pinned ${name} → ${cid}`);

        return {
            ipfsHash: cid,
            pinSize: Buffer.byteLength(JSON.stringify(data)),
            timestamp: new Date().toISOString()
        };
    },

    async _getFromLocal(ipfsHash) {
        const filePath = path.join(MOCK_IPFS_DIR, `${ipfsHash}.json`);

        if (!fs.existsSync(filePath)) {
            throw new Error(`IPFS content not found: ${ipfsHash}`);
        }

        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return content.data;
    },

    async _listLocalPins() {
        const files = fs.readdirSync(MOCK_IPFS_DIR).filter(f => f.endsWith('.json'));
        return files.map(f => {
            const content = JSON.parse(fs.readFileSync(path.join(MOCK_IPFS_DIR, f), 'utf-8'));
            return {
                ipfsHash: f.replace('.json', ''),
                name: content.metadata?.name || 'unknown',
                size: fs.statSync(path.join(MOCK_IPFS_DIR, f)).size,
                date: content.metadata?.pinned || 'unknown'
            };
        });
    }
};

module.exports = ipfsService;
