import React, { useState } from 'react';
import { Link } from 'react-router-dom';

function SearchRollPage() {
    const [searchParams, setSearchParams] = useState({
        name: '',
        epicNo: '',
        state: ''
    });
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const handleSearch = (e) => {
        e.preventDefault();
        setLoading(true);
        setResult(null);

        // Simulate search API call
        setTimeout(() => {
            setLoading(false);
            // Mock result
            setResult({
                name: searchParams.name || "Rajesh Kumar",
                epicNo: searchParams.epicNo || "ABC1234567",
                partNo: "125",
                serialNo: "452",
                pollingStation: "Public School, Ward 12, New Delhi",
                assembly: "New Delhi Central"
            });
        }, 1500);
    };

    return (
        <div className="dashboard-page">
            <div className="dashboard-header">
                <div className="dashboard-header-content">
                    <h1><i className="fa-solid fa-magnifying-glass"></i> Search Electoral Roll</h1>
                    <p>Find your name in the voter list and know your polling station.</p>
                </div>
                <Link to="/dashboard" className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }}>
                    <i className="fa-solid fa-arrow-left"></i> Back to Dashboard
                </Link>
            </div>

            <div className="dashboard-content">
                <div className="dashboard-card" style={{ maxWidth: '800px', margin: '0 auto' }}>
                    <div className="dashboard-card-header">
                        <i className="fa-solid fa-filter"></i> Search Criteria
                    </div>
                    <div className="dashboard-card-body">
                        <form onSubmit={handleSearch}>
                            <div className="row">
                                <div className="col-md-6 mb-3">
                                    <label className="form-label">Name</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="Enter your full name"
                                        value={searchParams.name}
                                        onChange={(e) => setSearchParams({ ...searchParams, name: e.target.value })}
                                    />
                                </div>
                                <div className="col-md-6 mb-3">
                                    <label className="form-label">EPIC No. (Optional)</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="ABC1234567"
                                        value={searchParams.epicNo}
                                        onChange={(e) => setSearchParams({ ...searchParams, epicNo: e.target.value })}
                                    />
                                </div>
                                <div className="col-md-6 mb-3">
                                    <label className="form-label">State</label>
                                    <select
                                        className="form-control"
                                        value={searchParams.state}
                                        onChange={(e) => setSearchParams({ ...searchParams, state: e.target.value })}
                                    >
                                        <option value="">Select State</option>
                                        <option value="Delhi">Delhi</option>
                                        <option value="Maharashtra">Maharashtra</option>
                                        <option value="Karnataka">Karnataka</option>
                                    </select>
                                </div>
                            </div>
                            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={loading}>
                                {loading ? 'Searching...' : 'Search in Roll'}
                            </button>
                        </form>
                    </div>
                </div>

                {result && (
                    <div className="dashboard-card" style={{ maxWidth: '800px', margin: '2rem auto' }}>
                        <div className="dashboard-card-header" style={{ background: '#d4edda', color: '#155724' }}>
                            <i className="fa-solid fa-check-circle"></i> Record Found
                        </div>
                        <div className="dashboard-card-body">
                            <div className="result-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                                <div>
                                    <div className="label" style={{ fontSize: '0.85rem', color: '#666' }}>Name</div>
                                    <div className="value" style={{ fontWeight: 'bold' }}>{result.name}</div>
                                </div>
                                <div>
                                    <div className="label" style={{ fontSize: '0.85rem', color: '#666' }}>EPIC No.</div>
                                    <div className="value" style={{ fontWeight: 'bold' }}>{result.epicNo}</div>
                                </div>
                                <div>
                                    <div className="label" style={{ fontSize: '0.85rem', color: '#666' }}>Part No.</div>
                                    <div className="value">{result.partNo}</div>
                                </div>
                                <div>
                                    <div className="label" style={{ fontSize: '0.85rem', color: '#666' }}>Serial No.</div>
                                    <div className="value">{result.serialNo}</div>
                                </div>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <div className="label" style={{ fontSize: '0.85rem', color: '#666' }}>Polling Station</div>
                                    <div className="value" style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{result.pollingStation}</div>
                                </div>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <div className="label" style={{ fontSize: '0.85rem', color: '#666' }}>Assembly Constituency</div>
                                    <div className="value">{result.assembly}</div>
                                </div>
                            </div>
                            <button className="btn btn-outline-primary" style={{ marginTop: '1.5rem', width: '100%' }}>
                                <i className="fa-solid fa-download"></i> Download Voter Slip
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default SearchRollPage;
