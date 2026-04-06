import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';

const rawUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';
const API_URL = rawUrl.startsWith('http') ? (rawUrl.endsWith('/api/v1') ? rawUrl : rawUrl.replace(/\/$/, '') + '/api/v1') : 'https://' + rawUrl.replace(/\/$/, '') + (rawUrl.endsWith('/api/v1') ? '' : '/api/v1');

const VoterRolls = () => {
    const { getToken } = useAuth();
    const [elections, setElections] = useState([]);
    const [selectedElection, setSelectedElection] = useState('');
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        const fetchElections = async () => {
            const token = await getToken();
            const res = await fetch(`${API_URL}/admin/elections`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setElections(data);
                if (data.length > 0) setSelectedElection(data[0].id);
            }
        };
        fetchElections();
    }, []);

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!file || !selectedElection) return;

        setUploading(true);
        setMessage('');

        const formData = new FormData();
        formData.append('file', file);

        try {
            const token = await getToken();
            const res = await fetch(`${API_URL}/admin/elections/${selectedElection}/voters/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });
            const data = await res.json();
            
            if (res.ok) {
                setMessage(`✅ Success! ${data.successCount} voters whitelisted. ${data.errorCount} skipped.`);
            } else {
                setMessage(`❌ Error: ${data.error}`);
            }
        } catch (err) {
            setMessage('❌ Failed to upload CSV');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="gov-card p-6">
            <h3 className="text-xl font-bold mb-4">Voter Roll Management</h3>
            
            <form onSubmit={handleUpload} className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Target Election</label>
                    <select 
                        className="gov-input w-full mt-1" 
                        value={selectedElection} 
                        onChange={(e) => setSelectedElection(e.target.value)}
                        required
                    >
                        {elections.map(e => (
                            <option key={e.id} value={e.id}>{e.name} ({e.status})</option>
                        ))}
                    </select>
                </div>

                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50">
                    <i className="fa-solid fa-file-csv text-4xl text-gray-400 mb-2"></i>
                    <p className="text-sm text-gray-500 mb-4">Upload a .CSV file containing an 'email' or 'voter_id' column</p>
                    <input 
                        type="file" 
                        accept=".csv"
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 mx-auto"
                        onChange={(e) => { setFile(e.target.files[0]); setMessage(''); }}
                        required
                    />
                </div>

                {message && (
                    <div className={`p-4 rounded text-sm ${message.includes('✅') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                        {message}
                    </div>
                )}

                <button 
                    type="submit" 
                    className="btn-primary w-full"
                    disabled={uploading || !file}
                >
                    {uploading ? <><i className="fa-solid fa-spinner fa-spin mr-2"></i> Processing CSV...</> : <><i className="fa-solid fa-upload mr-2"></i> Import Voter List</>}
                </button>
            </form>
        </div>
    );
};

export default VoterRolls;
