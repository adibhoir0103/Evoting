import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

function AdminPanel() {
    const navigate = useNavigate();
    const [stats, setStats] = useState({ totalUsers: 0, votedUsers: 0, totalVotes: 0, votingPercentage: 0 });
    const [users, setUsers] = useState([]);
    const [votes, setVotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('overview');

    const adminToken = localStorage.getItem('adminToken');

    useEffect(() => {
        if (!adminToken) {
            navigate('/admin-login');
            return;
        }
        loadData();
    }, [adminToken, navigate]);

    const loadData = async () => {
        try {
            setLoading(true);
            const headers = { 'Authorization': `Bearer ${adminToken}` };

            const [statsRes, usersRes, votesRes] = await Promise.all([
                fetch('http://localhost:5000/api/admin/stats', { headers }),
                fetch('http://localhost:5000/api/admin/users', { headers }),
                fetch('http://localhost:5000/api/admin/votes', { headers })
            ]);

            if (!statsRes.ok || !usersRes.ok || !votesRes.ok) {
                throw new Error('Failed to load admin data');
            }

            const [statsData, usersData, votesData] = await Promise.all([
                statsRes.json(),
                usersRes.json(),
                votesRes.json()
            ]);

            setStats(statsData);
            setUsers(usersData.users);
            setVotes(votesData.votes);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('admin');
        navigate('/');
    };

    if (loading) {
        return (
            <div className="loading-container" style={{ minHeight: '100vh' }}>
                <div className="spinner"></div>
                <p>Loading Admin Dashboard...</p>
            </div>
        );
    }

    return (
        <div className="admin-panel">
            <nav className="govt-navbar">
                <div className="navbar-top" style={{ background: '#dc3545' }}>
                    <span><i className="fa-solid fa-shield-halved"></i> Admin Control Panel</span>
                    <span>Election Commission of India</span>
                </div>
                <div className="navbar-main">
                    <Link to="/" className="navbar-brand">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/5/55/Emblem_of_India.svg" alt="National Emblem" />
                        <div className="brand-text">
                            <span className="title">Bharat E-Vote</span>
                            <span className="subtitle">Admin Dashboard</span>
                        </div>
                    </Link>
                    <div className="navbar-actions">
                        <button onClick={loadData} className="btn btn-secondary">
                            <i className="fa-solid fa-refresh"></i> Refresh
                        </button>
                        <button onClick={handleLogout} className="btn" style={{ background: '#dc3545', color: 'white' }}>
                            <i className="fa-solid fa-sign-out-alt"></i> Logout
                        </button>
                    </div>
                </div>
            </nav>

            <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
                {error && <div className="error-message">{error}</div>}

                {/* Stats Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                    <div className="auth-card" style={{ textAlign: 'center', padding: '1.5rem' }}>
                        <div style={{ fontSize: '2.5rem', color: '#000080', fontWeight: 'bold' }}>{stats.totalUsers}</div>
                        <div style={{ color: '#555' }}><i className="fa-solid fa-users"></i> Registered Voters</div>
                    </div>
                    <div className="auth-card" style={{ textAlign: 'center', padding: '1.5rem' }}>
                        <div style={{ fontSize: '2.5rem', color: '#138808', fontWeight: 'bold' }}>{stats.votedUsers}</div>
                        <div style={{ color: '#555' }}><i className="fa-solid fa-check-circle"></i> Votes Cast</div>
                    </div>
                    <div className="auth-card" style={{ textAlign: 'center', padding: '1.5rem' }}>
                        <div style={{ fontSize: '2.5rem', color: '#FF9933', fontWeight: 'bold' }}>{stats.votingPercentage}%</div>
                        <div style={{ color: '#555' }}><i className="fa-solid fa-chart-pie"></i> Voter Turnout</div>
                    </div>
                    <div className="auth-card" style={{ textAlign: 'center', padding: '1.5rem' }}>
                        <div style={{ fontSize: '2.5rem', color: '#dc3545', fontWeight: 'bold' }}>{stats.totalUsers - stats.votedUsers}</div>
                        <div style={{ color: '#555' }}><i className="fa-solid fa-clock"></i> Pending Votes</div>
                    </div>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`btn ${activeTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`}
                    >
                        <i className="fa-solid fa-chart-bar"></i> Overview
                    </button>
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-secondary'}`}
                    >
                        <i className="fa-solid fa-users"></i> Registered Users ({users.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('votes')}
                        className={`btn ${activeTab === 'votes' ? 'btn-primary' : 'btn-secondary'}`}
                    >
                        <i className="fa-solid fa-vote-yea"></i> Vote Records ({votes.length})
                    </button>
                </div>

                {/* Content */}
                <div className="auth-card" style={{ padding: '1.5rem' }}>
                    {activeTab === 'overview' && (
                        <div>
                            <h2 style={{ color: '#000080', marginBottom: '1rem' }}><i className="fa-solid fa-chart-line"></i> Election Overview</h2>
                            <div style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '8px' }}>
                                <p><strong>Total Registered Voters:</strong> {stats.totalUsers}</p>
                                <p><strong>Votes Cast:</strong> {stats.votedUsers}</p>
                                <p><strong>Voter Turnout:</strong> {stats.votingPercentage}%</p>
                                <div style={{ marginTop: '1rem' }}>
                                    <div style={{ background: '#e0e0e0', borderRadius: '10px', height: '20px', overflow: 'hidden' }}>
                                        <div style={{
                                            background: 'linear-gradient(90deg, #FF9933, #138808)',
                                            width: `${stats.votingPercentage}%`,
                                            height: '100%',
                                            transition: 'width 0.5s'
                                        }}></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'users' && (
                        <div>
                            <h2 style={{ color: '#000080', marginBottom: '1rem' }}><i className="fa-solid fa-users"></i> Registered Users</h2>
                            {users.length === 0 ? (
                                <p style={{ color: '#777' }}>No registered users yet.</p>
                            ) : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ background: '#000080', color: 'white' }}>
                                                <th style={{ padding: '0.75rem', textAlign: 'left' }}>ID</th>
                                                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Name</th>
                                                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Voter ID</th>
                                                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Email</th>
                                                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Aadhaar</th>
                                                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Mobile</th>
                                                <th style={{ padding: '0.75rem', textAlign: 'center' }}>Voted</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {users.map((user, idx) => (
                                                <tr key={user.id} style={{ background: idx % 2 === 0 ? '#f8f9fa' : 'white', borderBottom: '1px solid #dee2e6' }}>
                                                    <td style={{ padding: '0.75rem' }}>{user.id}</td>
                                                    <td style={{ padding: '0.75rem' }}>{user.fullname}</td>
                                                    <td style={{ padding: '0.75rem' }}>{user.voter_id}</td>
                                                    <td style={{ padding: '0.75rem' }}>{user.email}</td>
                                                    <td style={{ padding: '0.75rem' }}>{user.aadhaar_number ? `****${user.aadhaar_number.slice(-4)}` : '-'}</td>
                                                    <td style={{ padding: '0.75rem' }}>{user.mobile_number || '-'}</td>
                                                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                                        {user.has_voted ?
                                                            <span style={{ color: '#138808' }}><i className="fa-solid fa-check-circle"></i> Yes</span> :
                                                            <span style={{ color: '#dc3545' }}><i className="fa-solid fa-times-circle"></i> No</span>
                                                        }
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'votes' && (
                        <div>
                            <h2 style={{ color: '#000080', marginBottom: '1rem' }}><i className="fa-solid fa-vote-yea"></i> Vote Records</h2>
                            {votes.length === 0 ? (
                                <p style={{ color: '#777' }}>No votes recorded yet.</p>
                            ) : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ background: '#000080', color: 'white' }}>
                                                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Vote ID</th>
                                                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Voter ID</th>
                                                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Candidate ID</th>
                                                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Tx Hash</th>
                                                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Timestamp</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {votes.map((vote, idx) => (
                                                <tr key={vote.id} style={{ background: idx % 2 === 0 ? '#f8f9fa' : 'white', borderBottom: '1px solid #dee2e6' }}>
                                                    <td style={{ padding: '0.75rem' }}>{vote.id}</td>
                                                    <td style={{ padding: '0.75rem' }}>{vote.voter_id}</td>
                                                    <td style={{ padding: '0.75rem' }}>Candidate #{vote.candidate_id}</td>
                                                    <td style={{ padding: '0.75rem', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                                        {vote.tx_hash ? `${vote.tx_hash.slice(0, 10)}...` : '-'}
                                                    </td>
                                                    <td style={{ padding: '0.75rem' }}>{vote.voted_at || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default AdminPanel;
