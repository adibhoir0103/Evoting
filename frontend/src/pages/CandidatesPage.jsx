import React, { useState } from 'react';
import { Link } from 'react-router-dom';

function CandidatesPage() {
    const [searchTerm, setSearchTerm] = useState('');

    const candidates = [
        { id: 1, name: "Rajesh Kumar", party: "Janta Party", symbol: "fa-star", color: "#FF9933" },
        { id: 2, name: "Suresh Patil", party: "Progressive Alliance", symbol: "fa-leaf", color: "#28a745" },
        { id: 3, name: "Amitabh Singh", party: "Tech Forward", symbol: "fa-laptop", color: "#007bff" },
        { id: 4, name: "Lakshmi Devi", party: "United Front", symbol: "fa-hand-holding-heart", color: "#dc3545" },
        { id: 5, name: "Abdul Wahab", party: "Peace Party", symbol: "fa-dove", color: "#6f42c1" },
        { id: 6, name: "Guruswamy Iyer", party: "Heritage Bloc", symbol: "fa-om", color: "#fd7e14" },
        { id: 7, name: "Mary Stephens", party: "Coastal Congress", symbol: "fa-ship", color: "#17a2b8" },
        { id: 8, name: "Vikram Rathore", party: "Youth Voice", symbol: "fa-bicycle", color: "#e83e8c" },
        { id: 9, name: "Priya Sharma", party: "Women's Power", symbol: "fa-venus", color: "#d63384" },
        { id: 10, name: "NOTA", party: "None of the Above", symbol: "fa-ban", color: "#343a40" }
    ];

    const filteredCandidates = candidates.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.party.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="dashboard-page">
            <div className="dashboard-header">
                <div className="dashboard-header-content">
                    <h1><i className="fa-solid fa-users-viewfinder"></i> Candidates List</h1>
                    <p>Official Ballot Sheet (EVM View)</p>
                </div>
                <Link to="/dashboard" className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }}>
                    <i className="fa-solid fa-arrow-left"></i> Back to Dashboard
                </Link>
            </div>

            <div className="dashboard-content">
                {/* Search / Filter Bar */}
                <div style={{ maxWidth: '900px', margin: '0 auto 1.5rem', position: 'relative' }}>
                    <i className="fa-solid fa-search" style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: '#888' }}></i>
                    <input
                        type="text"
                        placeholder="Search candidate or party name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '12px 12px 12px 45px',
                            borderRadius: '50px',
                            border: '1px solid #ddd',
                            fontSize: '1rem',
                            boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                            outline: 'none'
                        }}
                    />
                </div>

                <div className="dashboard-card" style={{ maxWidth: '900px', margin: '0 auto', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
                    <div className="dashboard-card-header" style={{
                        background: 'linear-gradient(135deg, #1a2a6c, #b21f1f, #fdbb2d)',
                        color: '#fff',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <span><i className="fa-solid fa-check-to-slot"></i> Electronic Voting Machine (Ballot Unit)</span>
                        <span style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '4px' }}>
                            {filteredCandidates.length} Candidates
                        </span>
                    </div>
                    <div className="dashboard-card-body" style={{ padding: '0', background: '#f8f9fa' }}>
                        <div className="evm-container">
                            <div className="evm-header-row">
                                <div style={{ width: '50px', textAlign: 'center' }}>S.No</div>
                                <div style={{ flex: 1 }}>Candidate / Party</div>
                                <div style={{ width: '80px', textAlign: 'center' }}>Symbol</div>
                                <div style={{ width: '80px', textAlign: 'center' }}>Vote</div>
                            </div>

                            {filteredCandidates.map((candidate, index) => (
                                <div key={candidate.id} className="evm-row">
                                    {/* Serial Number */}
                                    <div className="evm-serial">
                                        {candidate.id}
                                    </div>

                                    {/* Candidate Details */}
                                    <div className="evm-details">
                                        <h3 className="candidate-name">{candidate.name}</h3>
                                        <span className="party-name">{candidate.party}</span>
                                    </div>

                                    {/* Symbol */}
                                    <div className="evm-symbol">
                                        <i className={`fa-solid ${candidate.symbol}`} style={{ color: candidate.color }}></i>
                                    </div>

                                    {/* Blue Button / Lamp */}
                                    <div className="evm-button-section">
                                        <div className="evm-lamp"></div>
                                        <div className="evm-blue-button">
                                            <div className="button-inner"></div>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {filteredCandidates.length === 0 && (
                                <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
                                    No candidates found matching "{searchTerm}"
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                .evm-container {
                    display: flex;
                    flex-direction: column;
                    background: #fff;
                    border: 1px solid #dcdcdc;
                }
                .evm-header-row {
                    display: flex;
                    background-color: #eee;
                    font-weight: bold;
                    color: #555;
                    padding: 0.8rem 1rem;
                    border-bottom: 2px solid #ccc;
                    font-size: 0.9rem;
                    text-transform: uppercase;
                }
                .evm-row {
                    display: flex;
                    align-items: center;
                    border-bottom: 1px solid #e0e0e0;
                    padding: 0.8rem 1rem;
                    transition: background 0.2s;
                    min-height: 80px;
                }
                .evm-row:hover {
                    background-color: #f0f8ff;
                }
                .evm-row:last-child {
                    border-bottom: none;
                }
                .evm-serial {
                    width: 50px;
                    font-size: 1.2rem;
                    font-weight: bold;
                    color: #333;
                    text-align: center;
                    margin-right: 15px;
                }
                .evm-details {
                    flex: 1;
                    padding-right: 15px;
                }
                .candidate-name {
                    margin: 0;
                    font-size: 1.1rem;
                    font-weight: bold;
                    color: #000;
                    text-transform: uppercase;
                }
                .party-name {
                    font-size: 0.85rem;
                    color: #666;
                    margin-top: 2px;
                    display: block;
                }
                .evm-symbol {
                    width: 80px;
                    text-align: center;
                    font-size: 2.2rem;
                    margin-right: 1rem;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }
                .evm-button-section {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    width: 80px;
                    justify-content: flex-end;
                }
                .evm-lamp {
                    width: 12px;
                    height: 12px;
                    background: #ccc;
                    border-radius: 50%;
                    border: 1px solid #999;
                    box-shadow: inset 1px 1px 2px rgba(0,0,0,0.3);
                }
                /* Realistic Blue Button */
                .evm-blue-button {
                    width: 60px;
                    height: 35px;
                    background: #0056b3;
                    border-radius: 20px;
                    box-shadow: 0 4px 0 #003d80, 0 5px 5px rgba(0,0,0,0.3);
                    position: relative;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: transform 0.1s, box-shadow 0.1s;
                }
                .evm-blue-button:active {
                    transform: translateY(3px);
                    box-shadow: 0 1px 0 #003d80, 0 1px 2px rgba(0,0,0,0.3);
                }
                .button-inner {
                    width: 20px;
                    height: 8px;
                    background: rgba(255,255,255,0.2);
                    border-radius: 4px;
                }

                @media (max-width: 600px) {
                    .evm-header-row { display: none; }
                    .evm-row {
                        flex-wrap: wrap;
                        padding: 1rem;
                        position: relative;
                        height: auto;
                    }
                    .evm-serial {
                        position: absolute;
                        top: 10px;
                        left: 10px;
                        font-size: 0.9rem;
                        width: auto;
                        background: #eee;
                        padding: 2px 6px;
                        border-radius: 4px;
                    }
                    .evm-details {
                        min-width: 100%;
                        margin-bottom: 1rem;
                        padding-left: 2rem; /* space for serial */
                    }
                    .evm-symbol {
                        flex: 1;
                        justify-content: flex-start;
                        font-size: 2.5rem;
                    }
                    .evm-button-section {
                        flex: 1;
                        justify-content: flex-end;
                    }
                }
            `}</style>
        </div>
    );
}

export default CandidatesPage;
