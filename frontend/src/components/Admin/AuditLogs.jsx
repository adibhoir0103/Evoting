import React, { useState, useEffect } from 'react';
import { API_URL } from '../../config/api';

const AuditLogs = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const token = localStorage.getItem('adminToken');
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

    const exportCSV = () => {
        if (logs.length === 0) return;
        const headers = ['Timestamp', 'Admin', 'Action', 'Details', 'IP Address'];
        const rows = logs.map(l => [
            new Date(l.created_at).toISOString(),
            l.admin_email,
            l.action,
            `"${(l.details || '').replace(/"/g, '""')}"`,
            l.ip_address
        ]);
        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `audit_trail_${Date.now()}.csv`; a.click();
        URL.revokeObjectURL(url);
    };

    const exportJSON = () => {
        if (logs.length === 0) return;
        const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `audit_trail_${Date.now()}.json`; a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="gov-card p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
                <div>
                    <h3 className="text-xl font-bold">Immutable Audit Trail</h3>
                    <p className="text-gray-500 text-sm mt-1">All administrative lifecycle actions, overrides, and role configurations are permanently logged here to guarantee institutional transparency.</p>
                </div>
                <div className="flex gap-2 shrink-0">
                    <button onClick={exportCSV} disabled={logs.length === 0} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition disabled:opacity-40" aria-label="Export audit logs as CSV">
                        <i className="fa-solid fa-file-csv"></i> Export CSV
                    </button>
                    <button onClick={exportJSON} disabled={logs.length === 0} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition disabled:opacity-40" aria-label="Export audit logs as JSON">
                        <i className="fa-solid fa-file-code"></i> Export JSON
                    </button>
                </div>
            </div>
            
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
                {logs.length === 0 && (
                    <div className="text-center py-12 px-6">
                        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                            <i className="fa-solid fa-shield-halved text-gray-400 text-2xl"></i>
                        </div>
                        <h4 className="text-gray-700 font-bold text-lg mb-1">No Audit Logs Yet</h4>
                        <p className="text-gray-500 text-sm max-w-md mx-auto">
                            Administrative actions like creating elections, managing voters, and status changes will be automatically recorded here for transparency and compliance.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AuditLogs;
