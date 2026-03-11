import { useEffect, useState, useRef } from 'react';

import { useParams, useNavigate } from 'react-router-dom';
import { socket } from '../socket';
import TicTacToe from '../games/TicTacToe';
import DrawingGame from '../games/DrawingGame';
import TerritoryGrid from '../games/TerritoryGrid';

const TimerBar = ({ timer }) => {
    const [timeLeft, setTimeLeft] = useState(100);

    useEffect(() => {
        if (!timer) return;

        const total = timer.timeout;
        const interval = setInterval(() => {
            const elapsed = Date.now() - timer.startTime;
            const percentage = Math.max(0, 100 - (elapsed / total) * 100);
            setTimeLeft(percentage);
            if (percentage <= 0) clearInterval(interval);
        }, 50);

        return () => clearInterval(interval);
    }, [timer]);

    if (!timer) return null;

    return (
        <div style={{ width: '100%', maxWidth: '600px', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden', marginBottom: '20px' }}>
            <div style={{ width: `${timeLeft}%`, height: '100%', background: timeLeft > 30 ? '#4facfe' : '#ef4444', transition: 'width 0.1s linear, background 0.3s' }}></div>
        </div>
    );
};

const GameRoom = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');

    // Read user synchronously to avoid blank flash
    const storedUser = localStorage.getItem('user');
    const [user, setUser] = useState(storedUser ? JSON.parse(storedUser) : null);

    // Synchronization State
    const [isReady, setIsReady] = useState(false);
    const [opponentReady, setOpponentReady] = useState(false);
    const [gameStarted, setGameStarted] = useState(false);
    const [opponentDisconnected, setOpponentDisconnected] = useState(false);
    const [disconnectionMessage, setDisconnectionMessage] = useState('');
    const [isReconnecting, setIsReconnecting] = useState(false);
    const [reconnectingOpponent, setReconnectingOpponent] = useState(null);
    const [opponentName, setOpponentName] = useState('Opponent');
    const [isSpectator, setIsSpectator] = useState(false);
    const [turnTimer, setTurnTimer] = useState(null); // { timeout, startTime }
    const [countdown, setCountdown] = useState(null);
    const [typingPlayers, setTypingPlayers] = useState([]);
    const [connectionStatus, setConnectionStatus] = useState('Connected');

    // Multi-match Series State
    const [seriesScores, setSeriesScores] = useState({});
    const [currentMatch, setCurrentMatch] = useState(1);
    const [totalMatches, setTotalMatches] = useState(3);
    const [seriesWinner, setSeriesWinner] = useState(null);
    const [initialGameState, setInitialGameState] = useState(null);

    // Determine game type from URL room ID
    const gameType = id.split('_')[0];

    // Ref guard: prevents React Strict Mode double-invoke from sending duplicate
    // socket events. The ref value persists across the mount→unmount→remount cycle.
    const hasJoinedRoom = useRef(false);

    useEffect(() => {
        const loggedInUser = localStorage.getItem('user');
        if (loggedInUser) {
            setUser(JSON.parse(loggedInUser));
            // Ensure socket is connected and join the room
            if (!socket.connected) {
                socket.connect();
            }

            // Only emit once per actual mount (not on React Strict Mode double-invoke)
            if (!hasJoinedRoom.current) {
                hasJoinedRoom.current = true;
                const username = JSON.parse(loggedInUser).username;

                // join_room now handles smart reconnection on the server side:
                // if the player is already in the session, it updates their socket ID.
                socket.emit('join_room', { roomId: id, username });
            }
        } else {
            navigate('/login');
        }

        const messageListener = (data) => {
            setMessages((prev) => [...prev, data]);
        };

        const readyStatusListener = (data) => {
            if (data.reset) {
                setIsReady(false);
                setOpponentReady(false);
                return;
            }
            // If the event is about the opponent, update their ready state
            if (loggedInUser && data.username !== JSON.parse(loggedInUser).username) {
                setOpponentReady(data.isReady);
            }
        };

        const gameStartListener = (data) => {
            setGameStarted(true);
            setInitialGameState(data.initialGameState);
            // Optional: Add a system message to chat
            setMessages((prev) => [...prev, { user: 'System', message: data.message }]);
        };

        const opponentDisconnectedListener = (data) => {
            setMessages((prev) => [...prev, { user: 'System', message: data.message }]);
            setOpponentDisconnected(true);
            setDisconnectionMessage(data.message);
            setReconnectingOpponent(null);
            localStorage.removeItem('activeRoomId'); // Room is done
        };

        const opponentReconnectingListener = (data) => {
            setReconnectingOpponent(data.username);
            setMessages((prev) => [...prev, { user: 'System', message: `${data.username} disconnected. Waiting ${data.timeout / 1000}s for reconnection...` }]);
        };

        const opponentReconnectedListener = (data) => {
            setReconnectingOpponent(null);
            setMessages((prev) => [...prev, { user: 'System', message: `${data.username} has reconnected!` }]);
        };

        const reconnectSuccessListener = (data) => {
            setGameStarted(data.state === 'playing');
            setInitialGameState(data.gameState);

            // Find current player to set their ready status
            const me = data.players.find(p => p.username === JSON.parse(loggedInUser).username);
            if (me) setIsReady(me.isReady);

            // Find opponent
            const opp = data.players.find(p => p.username !== JSON.parse(loggedInUser).username);
            if (opp) {
                setOpponentName(opp.username);
                setOpponentReady(opp.isReady);
            }

            if (data.scores) setSeriesScores(data.scores);
            if (data.currentMatch) setCurrentMatch(data.currentMatch);
            if (data.totalMatches) setTotalMatches(data.totalMatches);

            console.log("Reconnected to active game session state:", data.state);
        };

        const matchFoundListener = (data) => {
            const opp = data.players.find(p => p.username !== JSON.parse(loggedInUser).username);
            if (opp) setOpponentName(opp.username);
        };

        // Fired by the server as an acknowledgment of join_room.
        // This is the primary way GameRoom gets initial state (opponent name, scores,
        // game status) because the match_found event fires before this component mounts.
        const roomJoinedListener = (data) => {
            const myUsername = JSON.parse(loggedInUser).username;
            const opp = data.players.find(p => p.username !== myUsername);
            if (opp) {
                setOpponentName(opp.username);
                setOpponentReady(opp.isReady);
            }
            const me = data.players.find(p => p.username === myUsername);
            if (me) setIsReady(me.isReady);

            if (data.scores) setSeriesScores(data.scores);
            if (data.currentMatch) setCurrentMatch(data.currentMatch);
            if (data.totalMatches) setTotalMatches(data.totalMatches);

            // If the game is already in progress (e.g. browser refresh mid-game)
            if (data.state === 'playing') {
                setGameStarted(true);
                setInitialGameState(data.gameState);
            }
        };

        const scoreUpdateListener = (data) => {
            setSeriesScores(data.scores);
            setCurrentMatch(data.currentMatch);
            setTotalMatches(data.totalMatches);
            setIsReady(false);
            setOpponentReady(false);
            setGameStarted(false);
            setSeriesWinner(null);
            setInitialGameState(null);

            // Redundant check to fix "Opponent" placeholder if name wasn't resolved yet
            if (opponentName === 'Opponent' && data.scores) {
                const opp = Object.keys(data.scores).find(name => name !== JSON.parse(loggedInUser).username);
                if (opp) setOpponentName(opp);
            }
        };

        const seriesEndListener = (data) => {
            setSeriesWinner(data.winner);
            setSeriesScores(data.finalScores);
            setGameStarted(false);
            setTurnTimer(null);
            localStorage.removeItem('activeRoomId'); // Room is done
        };

        const playerQuitListener = (data) => {
            setMessages((prev) => [...prev, { user: 'System', message: data.message }]);
            setSeriesWinner(data.winner);
            setGameStarted(false);
            localStorage.removeItem('activeRoomId'); // Room is done
        };

        const timerStartListener = (data) => setTurnTimer(data);
        const timerEndListener = () => setTurnTimer(null);
        const countdownListener = (data) => {
            setCountdown(data.seconds);
            if (data.seconds === 0) setCountdown(null);
        };
        const spectatorJoinedListener = (data) => {
            setIsSpectator(true);
            setGameStarted(true);
            setInitialGameState(data.gameState);
            setSeriesScores(data.scores);
            setCurrentMatch(data.currentMatch);
            setTotalMatches(data.totalMatches);
            const currUser = loggedInUser ? JSON.parse(loggedInUser) : null;
            const opp = currUser ? data.players.find(p => p.username !== currUser.username) : null;
            if (opp) setOpponentName(opp.username);
        };
        const typingListener = ({ username, isTyping }) => {
            setTypingPlayers(prev => isTyping ? [...new Set([...prev, username])] : prev.filter(u => u !== username));
        };
        const connectListener = () => setConnectionStatus('Connected');
        const disconnectListener = () => setConnectionStatus('Disconnected');
        const reconnectingListener = () => setConnectionStatus('Reconnecting');

        socket.on('connect', connectListener);
        socket.on('disconnect', disconnectListener);
        socket.on('reconnecting', reconnectingListener);
        socket.on('room_joined', roomJoinedListener);
        socket.on('receive_message', messageListener);
        socket.on('player_ready_status', readyStatusListener);
        socket.on('game_start', gameStartListener);
        socket.on('turn_timer_start', timerStartListener);
        socket.on('turn_timer_end', timerEndListener);
        socket.on('next_match_countdown', countdownListener);
        socket.on('spectator_joined', spectatorJoinedListener);
        socket.on('player_typing', typingListener);
        socket.on('opponent_disconnected', opponentDisconnectedListener);
        socket.on('opponent_reconnecting', opponentReconnectingListener);
        socket.on('opponent_reconnected', opponentReconnectedListener);
        socket.on('reconnect_success', reconnectSuccessListener);
        socket.on('match_found', matchFoundListener);
        socket.on('match_score_update', scoreUpdateListener);
        socket.on('series_end', seriesEndListener);
        socket.on('player_quit', playerQuitListener);

        return () => {
            socket.off('connect', connectListener);
            socket.off('disconnect', disconnectListener);
            socket.off('reconnecting', reconnectingListener);
            socket.off('room_joined', roomJoinedListener);
            socket.off('receive_message', messageListener);
            socket.off('player_ready_status', readyStatusListener);
            socket.off('game_start', gameStartListener);
            socket.off('turn_timer_start', timerStartListener);
            socket.off('turn_timer_end', timerEndListener);
            socket.off('next_match_countdown', countdownListener);
            socket.off('spectator_joined', spectatorJoinedListener);
            socket.off('player_typing', typingListener);
            socket.off('opponent_disconnected', opponentDisconnectedListener);
            socket.off('opponent_reconnecting', opponentReconnectingListener);
            socket.off('opponent_reconnected', opponentReconnectedListener);
            socket.off('reconnect_success', reconnectSuccessListener);
            socket.off('match_found', matchFoundListener);
            socket.off('match_score_update', scoreUpdateListener);
            socket.off('series_end', seriesEndListener);
            socket.off('player_quit', playerQuitListener);
        };
    }, [id, navigate]);

    const sendMessage = (e) => {
        e.preventDefault();
        if (inputMessage.trim() && user) {
            socket.emit('send_message', {
                roomId: id,
                message: inputMessage,
                user: user.username
            });
            socket.emit('typing_stop', { roomId: id, username: user.username });
            setInputMessage('');
        }
    };

    const handleInputChange = (e) => {
        setInputMessage(e.target.value);
        if (e.target.value.length > 0) {
            socket.emit('typing_start', { roomId: id, username: user.username });
        } else {
            socket.emit('typing_stop', { roomId: id, username: user.username });
        }
    };

    const markReady = () => {
        if (!isReady && user) {
            setIsReady(true);
            socket.emit('player_ready', { roomId: id, username: user.username });
        }
    };

    const quitGame = () => {
        if (window.confirm("Are you sure you want to quit? This will count as a forfeit win for your opponent.")) {
            socket.emit('quit_game', { roomId: id, username: user.username });
            localStorage.removeItem('activeRoomId');
            navigate('/dashboard');
        }
    };

    if (!user) return null;

    return (
        <div style={{ display: 'flex', height: '100vh', backgroundColor: '#0b0f19', color: 'white' }}>

            {/* Sidebar - Player List & Scoreboard Placeholder */}
            <div style={{ width: '250px', borderRight: '1px solid #1e293b', padding: '20px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: connectionStatus === 'Connected' ? '#22c55e' : connectionStatus === 'Reconnecting' ? '#f59e0b' : '#ef4444' }}></div>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{connectionStatus}</span>
                </div>
                <h2>Room: {id.split('_')[0]}</h2>
                <div style={{ marginTop: '20px' }}>
                    <h4 style={{ color: '#94a3b8' }}>PLAYERS</h4>
                    <ul style={{ listStyle: 'none', padding: 0, marginTop: '10px' }}>
                        <li style={{ padding: '8px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e' }}></span>
                                {user.username} (You)
                            </div>
                            {isReady && <span style={{ color: '#4facfe', fontSize: '0.8rem', fontWeight: 'bold' }}>READY</span>}
                        </li>
                        <li style={{ padding: '8px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', color: '#cbd5e1' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    backgroundColor: opponentDisconnected ? '#ef4444' : (reconnectingOpponent ? '#f59e0b' : '#22c55e')
                                }}></span>
                                {opponentName}
                            </div>
                            {opponentReady && <span style={{ color: '#4facfe', fontSize: '0.8rem', fontWeight: 'bold' }}>READY</span>}
                        </li>
                    </ul>
                </div>

                {!gameStarted && !seriesWinner && !isSpectator && (
                    <div style={{ marginTop: '30px' }}>
                        <button
                            onClick={markReady}
                            disabled={isReady}
                            style={{ width: '100%', padding: '12px', background: isReady ? '#334155' : 'linear-gradient(to right, #00f2fe, #4facfe)', color: isReady ? '#94a3b8' : 'white', border: 'none', borderRadius: '8px', cursor: isReady ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
                        >
                            {isReady ? 'Waiting for Opponent...' : 'I am Ready'}
                        </button>
                    </div>
                )}

                <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
                    <button
                        onClick={isSpectator ? () => navigate('/dashboard') : quitGame}
                        style={{ width: '100%', padding: '12px', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        {isSpectator ? 'Leave Room' : 'Quit Game'}
                    </button>
                </div>
            </div>

            {/* Main Game Board Area */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', position: 'relative' }}>

                {/* Series Overlay for Winner */}
                {seriesWinner && (
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(11, 15, 25, 0.95)', zIndex: 110, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', textAlign: 'center' }}>
                        <div style={{ fontSize: '5rem', marginBottom: '20px' }}>🏆</div>
                        <h1 style={{ color: '#fbbf24', fontSize: '3rem', marginBottom: '10px' }}>Series Complete!</h1>
                        <h2 style={{ color: 'white', marginBottom: '20px' }}>
                            {seriesWinner === 'Draw' ? "It's a tie!" : `${seriesWinner} Wins the Series!`}
                        </h2>
                        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '12px', marginBottom: '30px' }}>
                            {Object.entries(seriesScores).map(([name, score]) => (
                                <div key={name} style={{ fontSize: '1.2rem', margin: '5px 0' }}>
                                    {name}: <strong>{score}</strong>
                                </div>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: '20px' }}>
                            <button
                                onClick={() => navigate('/dashboard')}
                                style={{ padding: '12px 30px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid #334155', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                                Return to Lobby
                            </button>
                            {!isSpectator && (
                                <button
                                    onClick={() => socket.emit('restart_series', { roomId: id })}
                                    style={{ padding: '12px 40px', background: 'linear-gradient(to right, #00f2fe, #4facfe)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                                >
                                    Play Again
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Scoreboard Header */}
                <div style={{ marginBottom: '20px', display: 'flex', gap: '40px', background: 'rgba(30, 41, 59, 0.5)', padding: '10px 30px', borderRadius: '30px', border: '1px solid #334155' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>MATCH</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#fbbf24' }}>{currentMatch} / {totalMatches}</div>
                    </div>
                    {Object.entries(seriesScores).map(([name, score]) => (
                        <div key={name} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                                {user && name === user.username ? 'YOU' : name}
                            </div>
                            <div style={{
                                fontSize: '1.2rem',
                                fontWeight: 'bold',
                                color: user && name === user.username ? '#22c55e' : '#f87171'
                            }}>
                                {score}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Turn Timer Bar - Only show if game is active */}
                {gameStarted && <TimerBar timer={turnTimer} />}

                {/* Next Match Countdown Overlay */}
                {countdown !== null && (
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 120, textAlign: 'center' }}>
                        <div style={{ fontSize: '8rem', fontWeight: 'bold', color: '#4facfe', textShadow: '0 0 30px rgba(79, 172, 254, 0.5)', animation: 'pulse 1s infinite' }}>
                            {countdown}
                        </div>
                        <h2 style={{ color: 'white' }}>Next match starting...</h2>
                    </div>
                )}

                {!gameStarted ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.5s ease-out' }}>
                        <div style={{
                            width: '450px',
                            background: 'rgba(30, 41, 59, 0.4)',
                            border: '1px solid #334155',
                            borderRadius: '24px',
                            padding: '40px',
                            textAlign: 'center',
                            backdropFilter: 'blur(10px)',
                            boxShadow: '0 20px 50px rgba(0,0,0,0.3)'
                        }}>
                            <div style={{ fontSize: '4rem', marginBottom: '20px' }}>
                                {gameType === 'tictactoe' ? '🕹️' : (gameType === 'drawing' ? '🎨' : '⚔️')}
                            </div>
                            <h1 style={{ color: 'white', fontSize: '2rem', marginBottom: '5px' }}>
                                {gameType.charAt(0).toUpperCase() + gameType.slice(1)}
                            </h1>
                            {opponentName && (
                                <h2 style={{ color: '#4facfe', fontSize: '1.2rem', margin: '0 0 15px 0', opacity: 0.8 }}>
                                    Vs {opponentName}
                                </h2>
                            )}
                            <p style={{ color: '#94a3b8', marginBottom: '30px', fontSize: '1rem' }}>
                                Match {currentMatch} of {totalMatches}
                            </p>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', padding: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                                <div style={{ height: '10px', width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: '5px', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: isReady && opponentReady ? '100%' : (isReady || opponentReady ? '50%' : '0%'), background: '#4facfe', transition: 'width 0.5s ease' }}></div>
                                </div>
                                <span style={{ color: '#4facfe', fontWeight: 'bold', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                                    {isReady && opponentReady ? 'STARTING...' : (isReady || opponentReady ? '1/2 READY' : 'WAITING')}
                                </span>
                            </div>

                            {!isReady && (
                                <p style={{ marginTop: '20px', color: '#64748b', fontSize: '0.9rem' }}>
                                    Click the "I am Ready" button to begin!
                                </p>
                            )}
                        </div>
                    </div>
                ) : (
                    <>
                        {gameType === 'tictactoe' && (
                            <TicTacToe
                                socket={socket}
                                roomId={id}
                                user={user}
                                initialGameState={initialGameState}
                                isSpectator={isSpectator}
                            />
                        )}
                        {gameType === 'drawing' && (
                            <DrawingGame
                                socket={socket}
                                roomId={id}
                                user={user}
                                initialGameState={initialGameState}
                                isSpectator={isSpectator}
                            />
                        )}
                        {gameType === 'territory' && (
                            <TerritoryGrid
                                socket={socket}
                                roomId={id}
                                user={user}
                                initialGameState={initialGameState}
                                isSpectator={isSpectator}
                            />
                        )}
                        {gameType !== 'tictactoe' && gameType !== 'drawing' && gameType !== 'territory' && (
                            <div style={{ width: '500px', height: '500px', border: '2px dashed #334155', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <p style={{ color: '#64748b' }}>Game logic not implemented for {gameType}</p>
                            </div>
                        )}
                    </>
                )}

                {/* Opponent Disconnected Overlay */}
                {opponentDisconnected && (
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(11, 15, 25, 0.9)', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', textAlign: 'center' }}>
                        <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🏃💨</div>
                        <h1 style={{ color: '#f87171', marginBottom: '10px' }}>Opponent Left</h1>
                        <p style={{ color: '#cbd5e1', fontSize: '1.2rem', maxWidth: '400px', marginBottom: '30px' }}>{disconnectionMessage}</p>
                        <button
                            onClick={() => navigate('/dashboard')}
                            style={{ padding: '12px 30px', background: 'linear-gradient(to right, #00f2fe, #4facfe)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.1rem', boxShadow: '0 4px 15px rgba(0, 242, 254, 0.3)' }}
                        >
                            Return to Dashboard
                        </button>
                    </div>
                )}

                {/* Opponent Reconnecting Overlay */}
                {reconnectingOpponent && (
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(11, 15, 25, 0.7)', zIndex: 90, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                        <div style={{ width: '40px', height: '40px', border: '3px solid rgba(245, 158, 11, 0.3)', borderTopColor: '#f59e0b', borderRadius: '50%', animation: 'spin 1.5s linear infinite', marginBottom: '20px' }}></div>
                        <h2 style={{ color: '#f59e0b', marginBottom: '10px' }}>Opponent Disconnected</h2>
                        <p style={{ color: '#cbd5e1' }}>Waiting for {reconnectingOpponent} to return...</p>
                    </div>
                )}
            </div>

            {/* Chat Panel */}
            <div style={{ width: '300px', borderLeft: '1px solid #1e293b', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid #1e293b' }}>
                    <h3>Room Chat</h3>
                </div>

                <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {messages.length === 0 && (
                        <p style={{ color: '#64748b', textAlign: 'center', marginTop: '50%' }}>Say hello to your opponent!</p>
                    )}
                    {messages.map((msg, index) => (
                        <div key={index} style={{ background: msg.user === user.username ? '#1e293b' : 'rgba(79, 172, 254, 0.1)', padding: '10px 15px', borderRadius: '8px', alignSelf: msg.user === user.username ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                            <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>{msg.user}</span>
                            <p style={{ margin: 0, fontSize: '0.95rem' }}>{msg.message}</p>
                        </div>
                    ))}
                    {typingPlayers.length > 0 && (
                        <div style={{ color: '#94a3b8', fontSize: '0.8rem', fontStyle: 'italic', padding: '5px' }}>
                            {typingPlayers.join(', ')} {typingPlayers.length === 1 ? 'is' : 'are'} typing...
                        </div>
                    )}
                </div>

                <form onSubmit={sendMessage} style={{ padding: '20px', borderTop: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <input
                        type="text"
                        value={inputMessage}
                        onChange={handleInputChange}
                        placeholder="Type a message..."
                        style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #334155', background: '#0f172a', color: 'white', outline: 'none' }}
                    />
                    <button type="submit" style={{ background: '#4facfe', border: 'none', borderRadius: '8px', padding: '10px', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>
                        Send
                    </button>
                </form>
            </div>

        </div>
    );
};

export default GameRoom;
