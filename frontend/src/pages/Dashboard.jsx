import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { socket } from '../socket';

const Dashboard = () => {
    const [user, setUser] = useState(null);
    const [isQueueing, setIsQueueing] = useState(false);
    const [queueingGame, setQueueingGame] = useState(null);
    const [gameHistory, setGameHistory] = useState([]);
    const [globalRecentMatches, setGlobalRecentMatches] = useState([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);
    const [isLoadingGlobal, setIsLoadingGlobal] = useState(true);
    const [inviteCode, setInviteCode] = useState('');
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [joinCodeInput, setJoinCodeInput] = useState('');
    const [isCreatingPrivate, setIsCreatingPrivate] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const loggedInUser = localStorage.getItem('user');
        if (loggedInUser) {
            setUser(JSON.parse(loggedInUser));
            // Connect socket
            if (!socket.connected) {
                socket.connect();
            }

            // Fetch game history
            const fetchHistory = async () => {
                const token = localStorage.getItem('token');
                if (!token) return;
                try {
                    const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/history`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    setGameHistory(res.data);
                } catch (error) {
                    console.error("Failed to fetch history", error);
                } finally {
                    setIsLoadingHistory(false);
                }
            };

            const fetchGlobalRecent = async () => {
                try {
                    const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/history/recent`);
                    setGlobalRecentMatches(res.data);
                } catch (error) {
                    console.error("Failed to fetch global history", error);
                } finally {
                    setIsLoadingGlobal(false);
                }
            };

            fetchHistory();
            fetchGlobalRecent();

        } else {
            navigate('/login');
        }

        // Listen for match found event
        const matchFoundListener = (data) => {
            console.log('Match found!', data);
            setIsQueueing(false);
            navigate(`/room/${data.roomId}`);
        };

        socket.on('match_found', matchFoundListener);

        const privateRoomCreatedListener = (data) => {
            setIsCreatingPrivate(false);
            setInviteCode(data.inviteCode);
        };

        const errorListener = (data) => {
            alert(data.message);
            setIsQueueing(false);
            setIsCreatingPrivate(false);
        };

        socket.on('private_room_created', privateRoomCreatedListener);
        socket.on('error_message', errorListener);

        return () => {
            socket.off('match_found', matchFoundListener);
            socket.off('private_room_created', privateRoomCreatedListener);
            socket.off('error_message', errorListener);
        };
    }, [navigate]);

    const onLogout = () => {
        localStorage.removeItem('user');
        socket.disconnect();
        navigate('/login');
    };

    const joinQueue = (gameType) => {
        if (!user) return;
        setIsQueueing(true);
        setQueueingGame(gameType);
        socket.emit('join_queue', { gameType, user });
    };

    const createPrivateRoom = (gameType) => {
        if (!user) return;
        setIsCreatingPrivate(true);
        socket.emit('create_private_room', { gameType, user });
    };

    const joinPrivateRoom = () => {
        if (!joinCodeInput || !user) return;
        socket.emit('join_private_room', { inviteCode: joinCodeInput.toUpperCase(), user });
    };

    if (!user) return null;

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#0b0f19', color: 'white', padding: '0' }}>

            {/* Navbar */}
            <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 3rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', backgroundColor: 'rgba(11, 15, 25, 0.95)', position: 'sticky', top: 0, zIndex: 10 }}>
                <h2 style={{ margin: 0, background: 'linear-gradient(to right, #00f2fe, #4facfe)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 700 }}>Game Hub</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <span style={{ color: '#cbd5e1' }}>{user.username} <span style={{ color: '#4facfe', fontWeight: 'bold' }}>({user.rating} Elo)</span></span>

                    <button onClick={() => navigate('/leaderboard')} style={{ padding: '0.5rem 1rem', background: 'transparent', color: '#f59e0b', border: '1px solid #f59e0b', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px' }} onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(245, 158, 11, 0.1)'; }} onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                        🏆 Global Leaderboard
                    </button>

                    <button onClick={onLogout} style={{ padding: '0.5rem 1rem', background: 'transparent', color: '#fca5a5', border: '1px solid #fca5a5', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }} onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; }} onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                        Logout
                    </button>
                </div>
            </nav>

            {/* Main Content */}
            <main style={{ padding: '3rem', maxWidth: '1200px', margin: '0 auto' }}>

                {/* Queue Status Overlay */}
                {isQueueing && (
                    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(11, 15, 25, 0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, flexDirection: 'column' }}>
                        <div style={{ width: '50px', height: '50px', border: '4px solid rgba(79, 172, 254, 0.3)', borderTopColor: '#4facfe', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                        <h2 style={{ marginTop: '20px', color: 'white' }}>Finding Match...</h2>
                        <p style={{ color: '#94a3b8' }}>Waiting for opponent for {queueingGame}</p>
                        <button onClick={() => { setIsQueueing(false); /* Ideally emit leave_queue */ }} style={{ marginTop: '30px', padding: '10px 20px', backgroundColor: 'transparent', border: '1px solid #64748b', color: '#cbd5e1', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
                    </div>
                )}

                {/* Private Room Creation Overlay */}
                {isCreatingPrivate && (
                    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(11, 15, 25, 0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, flexDirection: 'column' }}>
                        <div style={{ width: '50px', height: '50px', border: '4px solid rgba(245, 158, 11, 0.3)', borderTopColor: '#f59e0b', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                        <h2 style={{ marginTop: '20px', color: 'white' }}>Creating Private Room...</h2>
                    </div>
                )}

                {/* Invite Code Modal */}
                {inviteCode && (
                    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(11, 15, 25, 0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 101, flexDirection: 'column' }}>
                        <div style={{ backgroundColor: '#1e293b', padding: '40px', borderRadius: '24px', border: '1px solid #334155', textAlign: 'center', maxWidth: '450px', width: '90%' }}>
                            <h2 style={{ color: '#f59e0b', marginBottom: '10px' }}>Private Room Ready!</h2>
                            <p style={{ color: '#94a3b8', marginBottom: '30px' }}>Share this code with a friend to play together.</p>
                            <div style={{ backgroundColor: '#0f172a', padding: '20px', borderRadius: '12px', fontSize: '3rem', fontWeight: 800, letterSpacing: '8px', color: '#00f2fe', border: '2px dashed #334155', marginBottom: '30px' }}>
                                {inviteCode}
                            </div>
                            <p style={{ color: '#64748b', marginBottom: '30px' }}>Waiting for opponent to join...</p>
                            <button onClick={() => setInviteCode('')} style={{ padding: '12px 24px', backgroundColor: 'transparent', border: '1px solid #64748b', color: '#cbd5e1', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
                        </div>
                    </div>
                )}

                {/* Join Private Room Modal */}
                {showJoinModal && (
                    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(11, 15, 25, 0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 101, flexDirection: 'column' }}>
                        <div style={{ backgroundColor: '#1e293b', padding: '40px', borderRadius: '24px', border: '1px solid #334155', textAlign: 'center', maxWidth: '400px', width: '90%' }}>
                            <h2 style={{ color: '#00f2fe', marginBottom: '20px' }}>Join Private Room</h2>
                            <input
                                type="text"
                                placeholder="ENTER CODE"
                                value={joinCodeInput}
                                onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                                style={{ width: '100%', padding: '15px', borderRadius: '12px', background: '#0f172a', border: '2px solid #334155', color: 'white', fontSize: '1.5rem', textAlign: 'center', fontWeight: 'bold', marginBottom: '20px', outline: 'none' }}
                            />
                            <div style={{ display: 'flex', gap: '15px' }}>
                                <button onClick={() => setShowJoinModal(false)} style={{ flex: 1, padding: '12px', backgroundColor: 'transparent', border: '1px solid #64748b', color: '#cbd5e1', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
                                <button onClick={joinPrivateRoom} style={{ flex: 1, padding: '12px', background: 'linear-gradient(to right, #00f2fe, #4facfe)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Join Game</button>
                            </div>
                        </div>
                    </div>
                )}

                <header style={{ marginBottom: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                        <h1 style={{ fontSize: '2.5rem', margin: '0 0 10px 0' }}>Select Game</h1>
                        <p style={{ color: '#94a3b8', fontSize: '1.1rem' }}>Enter the matchmaking queue or play with a friend.</p>
                    </div>
                    <button onClick={() => setShowJoinModal(true)} style={{ padding: '0.8rem 1.5rem', backgroundColor: 'rgba(0, 242, 254, 0.1)', border: '1px solid #00f2fe', color: '#00f2fe', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                        Join Private Game
                    </button>
                </header>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>

                    {/* Game Card 1 */}
                    <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', overflow: 'hidden', transition: 'transform 0.3s ease, box-shadow 0.3s ease', cursor: 'pointer', display: 'flex', flexDirection: 'column' }} onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)'; e.currentTarget.style.borderColor = 'rgba(79, 172, 254, 0.3)'; }} onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'; }}>
                        <div style={{ height: '160px', background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: '4rem' }}>❌⭕</span>
                        </div>
                        <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <h3 style={{ fontSize: '1.4rem', margin: '0 0 10px 0' }}>Tic Tac Toe</h3>
                            <p style={{ color: '#94a3b8', margin: '0 0 20px 0', flex: 1 }}>The classic game of X's and O's. First to get three in a row wins.</p>
                            <button onClick={() => joinQueue('tictactoe')} style={{ width: '100%', marginBottom: '10px', padding: '12px', background: 'linear-gradient(to right, #00f2fe, #4facfe)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '1rem' }}>Find Match</button>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => createPrivateRoom('tictactoe')} style={{ flex: 1, padding: '10px', background: 'transparent', color: '#4facfe', border: '1px solid #4facfe', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>Private</button>
                                <button onClick={() => navigate('/local/tictactoe')} style={{ flex: 1, padding: '10px', background: 'transparent', color: '#64748b', border: '1px solid #334155', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>Offline</button>
                            </div>
                        </div>
                    </div>

                    {/* Game Card 2 */}
                    <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', overflow: 'hidden', transition: 'transform 0.3s ease, box-shadow 0.3s ease', cursor: 'pointer', display: 'flex', flexDirection: 'column' }} onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)'; e.currentTarget.style.borderColor = '#fbbf24'; }} onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'; }}>
                        <div style={{ height: '160px', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: '4rem' }}>🎨✏️</span>
                        </div>
                        <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <h3 style={{ fontSize: '1.4rem', margin: '0 0 10px 0' }}>Drawing & Guess</h3>
                            <p style={{ color: '#94a3b8', margin: '0 0 20px 0', flex: 1 }}>One player draws a secret word, the other guesses it. Fast and chaotic.</p>
                            <button onClick={() => joinQueue('drawing')} style={{ width: '100%', marginBottom: '10px', padding: '12px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '1rem' }}>Find Match</button>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => createPrivateRoom('drawing')} style={{ flex: 1, padding: '10px', background: 'transparent', color: '#f59e0b', border: '1px solid #f59e0b', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>Private</button>
                                <button onClick={() => navigate('/local/drawing')} style={{ flex: 1, padding: '10px', background: 'transparent', color: '#64748b', border: '1px solid #334155', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>Offline</button>
                            </div>
                        </div>
                    </div>

                    {/* Game Card 3 */}
                    <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', overflow: 'hidden', transition: 'transform 0.3s ease, box-shadow 0.3s ease', cursor: 'pointer', display: 'flex', flexDirection: 'column' }} onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)'; e.currentTarget.style.borderColor = '#10b981'; }} onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'; }}>
                        <div style={{ height: '160px', background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: '4rem' }}>⚔️🗺️</span>
                        </div>
                        <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <h3 style={{ fontSize: '1.4rem', margin: '0 0 10px 0' }}>Territory Grid</h3>
                            <p style={{ color: '#94a3b8', margin: '0 0 20px 0', flex: 1 }}>Strategic territory control. Claim sectors and outmaneuver your enemy.</p>
                            <button onClick={() => joinQueue('territory')} style={{ width: '100%', marginBottom: '10px', padding: '12px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '1rem' }}>Find Match</button>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => createPrivateRoom('territory')} style={{ flex: 1, padding: '10px', background: 'transparent', color: '#10b981', border: '1px solid #10b981', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>Private</button>
                                <button onClick={() => navigate('/local/territory')} style={{ flex: 1, padding: '10px', background: 'transparent', color: '#64748b', border: '1px solid #334155', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>Offline</button>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Game History Section */}
                <section style={{ marginTop: '4rem' }}>
                    <h2 style={{ fontSize: '2rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '10px' }}>Recent Matches</h2>

                    {isLoadingHistory ? (
                        <p style={{ color: '#94a3b8' }}>Loading history...</p>
                    ) : gameHistory.length === 0 ? (
                        <div style={{ padding: '30px', backgroundColor: 'rgba(255, 255, 255, 0.02)', borderRadius: '12px', border: '1px dashed #334155', textAlign: 'center' }}>
                            <p style={{ color: '#64748b', margin: 0 }}>You haven't played any matches yet. Join a queue to get started!</p>
                        </div>
                    ) : (
                        <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
                                        <th style={{ padding: '15px 20px', color: '#94a3b8', fontWeight: 600 }}>Game</th>
                                        <th style={{ padding: '15px 20px', color: '#94a3b8', fontWeight: 600 }}>Result</th>
                                        <th style={{ padding: '15px 20px', color: '#94a3b8', fontWeight: 600 }}>Opponent</th>
                                        <th style={{ padding: '15px 20px', color: '#94a3b8', fontWeight: 600 }}>Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {gameHistory.map((match) => {
                                        const isWin = match.winner === user.username;
                                        const isDraw = match.winner === 'Draw';
                                        const opponent = match.players.find(p => p !== user.username) || "Unknown";

                                        let resultColor = '#f87171'; // Red for loss
                                        let resultText = 'Defeat';
                                        if (isWin) { resultColor = '#4ade80'; resultText = 'Victory'; }
                                        else if (isDraw) { resultColor = '#fbbf24'; resultText = 'Draw'; }

                                        let gameNameDisplay = match.gameType;
                                        if (match.gameType === 'tictactoe') gameNameDisplay = 'Tic Tac Toe';
                                        if (match.gameType === 'drawing') gameNameDisplay = 'Drawing & Guess';
                                        if (match.gameType === 'territory') gameNameDisplay = 'Territory Grid';

                                        return (
                                            <tr key={match._id} style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                                <td style={{ padding: '15px 20px', fontWeight: 500 }}>{gameNameDisplay}</td>
                                                <td style={{ padding: '15px 20px', color: resultColor, fontWeight: 'bold' }}>{resultText}</td>
                                                <td style={{ padding: '15px 20px', color: '#cbd5e1' }}>{opponent}</td>
                                                <td style={{ padding: '15px 20px', color: '#64748b' }}>{new Date(match.createdAt).toLocaleDateString()}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                {/* Global Recent Matches Section */}
                <section style={{ marginTop: '4rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#22c55e', boxShadow: '0 0 10px #22c55e' }}></span>
                        <h2 style={{ fontSize: '1.8rem', margin: 0 }}>Global Activity</h2>
                    </div>

                    {isLoadingGlobal ? (
                        <p style={{ color: '#94a3b8' }}>Loading global activity...</p>
                    ) : globalRecentMatches.length === 0 ? (
                        <p style={{ color: '#64748b' }}>No recent global activity.</p>
                    ) : (
                        <div style={{ display: 'flex', gap: '15px', overflowX: 'auto', paddingBottom: '15px', scrollbarWidth: 'thin' }}>
                            {globalRecentMatches.map((match) => (
                                <div key={match._id} style={{ minWidth: '240px', background: 'rgba(30, 41, 59, 0.4)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', padding: '15px' }}>
                                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 'bold' }}>
                                        {match.gameType === 'tictactoe' ? 'Tic Tac Toe' : match.gameType === 'drawing' ? 'Drawing & Guess' : 'Territory Grid'}
                                    </div>
                                    <div style={{ fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '4px', color: '#e2e8f0' }}>
                                        {match.players[0]} <span style={{ color: '#4facfe' }}>vs</span> {match.players[1]}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: match.winner === 'Draw' ? '#fbbf24' : '#4ade80' }}>
                                        Result: {match.winner === 'Draw' ? 'Draw' : `${match.winner} Won`}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '8px' }}>
                                        {new Date(match.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
};

export default Dashboard;
