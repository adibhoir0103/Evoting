import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';

const rawUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';
const API_URL = rawUrl.startsWith('http') ? (rawUrl.endsWith('/api/v1') ? rawUrl : rawUrl.replace(/\/$/, '') + '/api/v1') : 'https://' + rawUrl.replace(/\/$/, '') + (rawUrl.endsWith('/api/v1') ? '' : '/api/v1');

const AuditLogs = () => {
    const { getToken } = useAuth();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const token = await getToken();
                const res = await fetch(`${API_URL}/admin/audit`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (res.ok) setLogs(data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, []);

    if (loading) return <div className="p-8 text-center"><i className="fa-solid fa-spinner fa-spin text-3xl"></i></div>;

    return (
        <div className="gov-card p-6">
            <h3 className="text-xl font-bold mb-4">Immutable Audit Trail</h3>
            <p className="text-gray-500 mb-6 text-sm">All administrative lifecycle actions, overrides, and role configurations are permanently logged here to guarantee institutional transparency.</p>
            
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Admin</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP Address</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {logs.map(log => (
                            <tr key={log.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {new Date(log.created_at).toLocaleString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {log.admin_email}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                        {log.action}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500">
                                    {log.details}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 font-mono">
                                    {log.ip_address}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {logs.length === 0 && <p className="text-center p-6 text-gray-500">No audit logs available.</p>}
            </div>
        </div>
    );
};

export default AuditLogs;
