import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';

export const TurnoutChart = ({ stats }) => {
    const totalUsers = stats?.totalUsers || 0;
    const votedUsers = stats?.votedUsers || 0;
    const pendingUsers = Math.max(0, totalUsers - votedUsers);

    const data = [
        { name: 'Voted', value: votedUsers, color: '#8b5cf6' }, // Purple
        { name: 'Pending', value: pendingUsers, color: '#e2e8f0' } // Slate 200
    ];

    if (totalUsers === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                <i className="fa-solid fa-chart-pie text-3xl mb-2 opacity-50"></i>
                <p className="text-sm font-medium">No voters registered</p>
            </div>
        );
    }

    return (
        <div className="h-48 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                    >
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                    </Pie>
                    <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        itemStyle={{ fontWeight: 'bold' }}
                    />
                </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-black text-gray-800">{stats?.votingPercentage || 0}%</span>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Turnout</span>
            </div>
        </div>
    );
};

export const ActivityChart = () => {
    // Mocking last 7 days of activity for visual dashboard effect, 
    // as backend doesn't provide time-series data yet.
    const mockData = useMemo(() => {
        const data = [];
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            data.push({
                day: d.toLocaleDateString('en-US', { weekday: 'short' }),
                logins: Math.floor(Math.random() * 50) + 10,
                votes: Math.floor(Math.random() * 30) + 5
            });
        }
        return data;
    }, []);

    return (
        <div className="h-64 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={mockData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorVotes" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorLogins" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                    <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        labelStyle={{ color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}
                    />
                    <Area type="monotone" dataKey="logins" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorLogins)" name="User Logins" />
                    <Area type="monotone" dataKey="votes" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorVotes)" name="Votes Cast" />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};
