import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Leaderboard = () => {
    const [leaderboard, setLeaderboard] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        // Auth check
        const loggedInUser = localStorage.getItem('user');
        if (loggedInUser) {
            setUser(JSON.parse(loggedInUser));
        } else {
            navigate('/login');
            return;
        }

        // Fetch Leaderboard
        const fetchLeaderboard = async () => {
            try {
                // Not sending a token because leaderboards are often public, 
                // but we can if we want to secure it. Right now our backend route is fully open.
                const res = await axios.get('http://localhost:5001/api/leaderboard');
                setLeaderboard(res.data);
            } catch (error) {
                console.error("Failed to fetch leaderboard", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchLeaderboard();
    }, [navigate]);

    if (!user) return null;

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#0b0f19', color: 'white', padding: '0', fontFamily: 'Inter, sans-serif' }}>
            {/* Navbar */}
            <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 3rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', backgroundColor: 'rgba(11, 15, 25, 0.95)', position: 'sticky', top: 0, zIndex: 10 }}>
                <h2 style={{ margin: 0, background: 'linear-gradient(to right, #00f2fe, #4facfe)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 700, cursor: 'pointer' }} onClick={() => navigate('/dashboard')}>
                    Game Hub
                </h2>
                <button onClick={() => navigate('/dashboard')} style={{ padding: '0.5rem 1rem', background: 'transparent', color: '#cbd5e1', border: '1px solid #334155', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }} onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }} onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                    Back to Dashboard
                </button>
            </nav>

            <main style={{ padding: '3rem', maxWidth: '1000px', margin: '0 auto' }}>
                <header style={{ marginBottom: '3rem', textAlign: 'center' }}>
                    <h1 style={{ fontSize: '3rem', margin: '0 0 10px 0', color: '#f59e0b', textShadow: '0 0 15px rgba(245, 158, 11, 0.3)' }}>Global Leaderboard</h1>
                    <p style={{ color: '#94a3b8', fontSize: '1.2rem' }}>Top 50 ranking players by Elo Rating.</p>
                </header>

                {isLoading ? (
                    <div style={{ textAlign: 'center', padding: '40px' }}>
                        <div style={{ width: '40px', height: '40px', border: '4px solid rgba(245, 158, 11, 0.3)', borderTopColor: '#f59e0b', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 20px auto' }}></div>
                        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                        <p style={{ color: '#94a3b8' }}>Loading rankings...</p>
                    </div>
                ) : (
                    <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.05)', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', borderBottom: '2px solid rgba(255, 255, 255, 0.08)' }}>
                                    <th style={{ padding: '20px', color: '#94a3b8', fontWeight: 600, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Rank</th>
                                    <th style={{ padding: '20px', color: '#94a3b8', fontWeight: 600, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Player</th>
                                    <th style={{ padding: '20px', color: '#f59e0b', fontWeight: 600, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'right' }}>Rating</th>
                                    <th style={{ padding: '20px', color: '#4ade80', fontWeight: 600, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'center' }}>W</th>
                                    <th style={{ padding: '20px', color: '#f87171', fontWeight: 600, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'center' }}>L</th>
                                </tr>
                            </thead>
                            <tbody>
                                {leaderboard.map((player, index) => {
                                    const isCurrentUser = player.username === user.username;
                                    const rank = index + 1;

                                    // Special styling for Top 3
                                    let rankColor = '#64748b';
                                    let rowStyle = { borderBottom: '1px solid rgba(255, 255, 255, 0.05)', transition: 'background 0.2s', backgroundColor: isCurrentUser ? 'rgba(79, 172, 254, 0.1)' : 'transparent' };

                                    if (rank === 1) rankColor = '#fbbf24'; // Gold
                                    else if (rank === 2) rankColor = '#94a3b8'; // Silver
                                    else if (rank === 3) rankColor = '#b45309'; // Bronze

                                    return (
                                        <tr key={player._id} style={rowStyle} onMouseOver={(e) => { if (!isCurrentUser) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'; }} onMouseOut={(e) => { if (!isCurrentUser) e.currentTarget.style.backgroundColor = 'transparent'; }}>
                                            <td style={{ padding: '20px', fontWeight: 700, fontSize: '1.2rem', color: rankColor }}>#{rank}</td>
                                            <td style={{ padding: '20px', fontWeight: isCurrentUser ? 700 : 500, color: isCurrentUser ? '#00f2fe' : 'white', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                {player.username}
                                                {isCurrentUser && <span style={{ fontSize: '0.7rem', background: '#00f2fe', color: '#0b0f19', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>YOU</span>}
                                            </td>
                                            <td style={{ padding: '20px', fontWeight: 700, color: '#f59e0b', textAlign: 'right', fontSize: '1.2rem' }}>{player.rating}</td>
                                            <td style={{ padding: '20px', color: '#4ade80', textAlign: 'center' }}>{player.wins || 0}</td>
                                            <td style={{ padding: '20px', color: '#f87171', textAlign: 'center' }}>{player.losses || 0}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </main>
        </div>
    );
};

export default Leaderboard;
