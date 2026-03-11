import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TicTacToe from '../games/TicTacToe';
import TerritoryGrid from '../games/TerritoryGrid';
import DrawingGame from '../games/DrawingGame';

// A mock socket object that does nothing to satisfy the games' dependencies
const MockSocket = {
    on: () => { },
    off: () => { },
    emit: () => { }
};

const LocalGameRoom = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [user, setUser] = useState(null);

    // Master state for local play
    const [gameState, setGameState] = useState(null);
    const [gameStarted, setGameStarted] = useState(false);

    // UI state for Territory Grid active player
    const [activeColor, setActiveColor] = useState('Player 1');

    // Series State
    const [totalMatches, setTotalMatches] = useState(1);
    const [currentMatch, setCurrentMatch] = useState(1);
    const [seriesScores, setSeriesScores] = useState({ 'Player 1': 0, 'Player 2': 0 });
    const [seriesWinner, setSeriesWinner] = useState(null);

    useEffect(() => {
        const loggedInUser = localStorage.getItem('user');
        if (loggedInUser) {
            setUser(JSON.parse(loggedInUser));
        } else {
            navigate('/login');
        }
    }, [navigate]);

    const startGame = () => {
        setGameStarted(true);
        setSeriesWinner(null);

        // Initialize state based on game type
        if (id === 'tictactoe') {
            setGameState({
                board: Array(9).fill(null),
                currentTurn: 'X',
                players: { 'X': 'Player 1', 'O': 'Player 2' },
                winner: null,
                isDraw: false
            });
        } else if (id === 'territory') {
            setGameState({
                board: Array.from({ length: 100 }, () => ({ owner: null, strength: 0 })),
                scores: { 'Player 1': 0, 'Player 2': 0 },
                players: { p1: 'Player 1', p2: 'Player 2' },
                winner: null,
                isDraw: false
            });
        } else if (id === 'drawing') {
            const WORDS = ['Apple', 'House', 'Tree', 'Cat', 'Sun', 'Car', 'Flower', 'Pizza', 'Bird', 'Rainbow', 'Computer', 'Guitar'];
            setGameState({
                drawer: 'Player 1',
                guesser: 'Player 2',
                word: WORDS[Math.floor(Math.random() * WORDS.length)],
                roundComplete: false,
                winner: null
            });
        }
    };

    const nextMatch = () => {
        setCurrentMatch(prev => prev + 1);
        startGame();
    };

    const restartSeries = () => {
        setCurrentMatch(1);
        setSeriesScores({ 'Player 1': 0, 'Player 2': 0 });
        setSeriesWinner(null);
        setGameStarted(false);
    };

    const updateSeriesScore = (winnerName, isDraw = false) => {
        setSeriesScores(prev => {
            const newScores = isDraw ? {
                'Player 1': prev['Player 1'] + 1,
                'Player 2': prev['Player 2'] + 1
            } : (winnerName ? {
                ...prev,
                [winnerName]: prev[winnerName] + 1
            } : prev);
            return newScores;
        });

        // Check series winner outside of the dispatcher
        // We can do this in the next tick or via useEffect, 
        // but for now, we'll use the current logic which is safer
    };

    // Correctly check for series winner when scores or match count change
    useEffect(() => {
        if (!gameStarted) return;

        const p1Score = seriesScores['Player 1'];
        const p2Score = seriesScores['Player 2'];

        // Series winner should only be declared after ALL selected matches are finished
        if (currentMatch >= totalMatches && (gameState?.winner || gameState?.isDraw)) {
            if (p1Score > p2Score) setSeriesWinner('Player 1');
            else if (p2Score > p1Score) setSeriesWinner('Player 2');
            else if (p1Score === p2Score) setSeriesWinner('Draw');
        }
    }, [seriesScores, currentMatch, totalMatches, gameStarted, gameState]);

    // --- Local Logic Handlers ---
    const handleLocalTicTacToe = (index) => {
        if (gameState.winner || gameState.isDraw || gameState.board[index]) return;

        const newBoard = [...gameState.board];
        newBoard[index] = gameState.currentTurn;

        // Check Winner (Local implementation)
        const WINNING_COMBINATIONS = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8],
            [0, 3, 6], [1, 4, 7], [2, 5, 8],
            [0, 4, 8], [2, 4, 6]
        ];

        let winnerSymbol = null;
        for (const combination of WINNING_COMBINATIONS) {
            const [a, b, c] = combination;
            if (newBoard[a] && newBoard[a] === newBoard[b] && newBoard[a] === newBoard[c]) {
                winnerSymbol = newBoard[a];
                break;
            }
        }

        const isDraw = !winnerSymbol && newBoard.every(cell => cell !== null);

        if (winnerSymbol || isDraw) {
            updateSeriesScore(winnerSymbol ? gameState.players[winnerSymbol] : null, isDraw);
        }

        setGameState(prev => ({
            ...prev,
            board: newBoard,
            currentTurn: winnerSymbol || isDraw ? prev.currentTurn : (prev.currentTurn === 'X' ? 'O' : 'X'),
            winner: winnerSymbol ? prev.players[winnerSymbol] : null,
            isDraw
        }));
    };

    const handleLocalTerritory = (index, actingPlayer) => {
        if (gameState.winner || gameState.isDraw) return;

        const newBoard = [...gameState.board];
        const cell = newBoard[index];

        if (cell.owner === null) {
            cell.owner = actingPlayer;
            cell.strength = 1;
        } else if (cell.owner === actingPlayer) {
            cell.strength = Math.min(3, cell.strength + 1);
        } else {
            cell.strength -= 1;
            if (cell.strength === 0) cell.owner = null;
        }

        // Recalculate Scores
        let p1Score = 0;
        let p2Score = 0;
        let neutralCount = 0;

        newBoard.forEach(c => {
            if (c.owner === gameState.players.p1) p1Score++;
            else if (c.owner === gameState.players.p2) p2Score++;
            else neutralCount++;
        });

        const newGameState = {
            ...gameState,
            board: newBoard,
            scores: { [gameState.players.p1]: p1Score, [gameState.players.p2]: p2Score }
        };

        if (neutralCount === 0) {
            let matchWinner = null;
            if (p1Score > p2Score) matchWinner = gameState.players.p1;
            else if (p2Score > p1Score) matchWinner = gameState.players.p2;
            else newGameState.isDraw = true;

            newGameState.winner = matchWinner;
            updateSeriesScore(matchWinner, newGameState.isDraw);
        }

        setGameState(newGameState);
    };

    const handleLocalDrawing = (action) => {
        if (action === 'win') {
            updateSeriesScore(gameState.guesser);
            setGameState(prev => ({
                ...prev,
                roundComplete: true,
                winner: prev.guesser
            }));
        } else if (action === 'next_round') {
            const WORDS = ['Apple', 'House', 'Tree', 'Cat', 'Sun', 'Car', 'Flower', 'Pizza', 'Bird', 'Rainbow', 'Computer', 'Guitar'];
            setGameState(prev => ({
                drawer: prev.guesser, // Swap roles
                guesser: prev.drawer,
                word: WORDS[Math.floor(Math.random() * WORDS.length)],
                roundComplete: false,
                winner: null
            }));
        }
    };

    if (!user) return null;

    return (
        <div style={{ display: 'flex', height: '100vh', backgroundColor: '#0b0f19', color: 'white', flexDirection: 'column' }}>

            {/* Header */}
            <header style={{ padding: '20px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, color: '#f59e0b' }}>Local Offline Play</h2>
                <button onClick={() => navigate('/dashboard')} style={{ padding: '8px 16px', background: 'transparent', color: '#94a3b8', border: '1px solid #334155', borderRadius: '6px', cursor: 'pointer' }}>Back to Dashboard</button>
            </header>

            {/* Main Game Area */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>

                {!gameStarted ? (
                    <div style={{ textAlign: 'center', width: '500px', padding: '40px', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '16px', border: '1px solid #334155' }}>
                        <h1 style={{ color: '#00f2fe', marginBottom: '10px' }}>Shared Screen Mode</h1>
                        <p style={{ color: '#94a3b8', marginBottom: '20px' }}>You are playing locally on the same device. No internet or matchmaking required. Take turns using the mouse!</p>

                        <div style={{ marginBottom: '30px', textAlign: 'left' }}>
                            <label style={{ display: 'block', color: '#e2e8f0', marginBottom: '10px', fontSize: '0.9rem', fontWeight: 'bold' }}>NUMBER OF MATCHES</label>
                            <select
                                value={totalMatches}
                                onChange={(e) => setTotalMatches(parseInt(e.target.value))}
                                style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '1rem', outline: 'none' }}
                            >
                                {[1, 2, 3, 5, 7, 10].map(n => (
                                    <option key={n} value={n}>{n === 1 ? 'Single Match' : `${n} Matches (Best of ${n})`}</option>
                                ))}
                            </select>
                        </div>

                        <button
                            onClick={startGame}
                            style={{ width: '100%', padding: '15px', background: 'linear-gradient(to right, #00f2fe, #4facfe)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.2rem' }}
                        >
                            Start Match
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '800px' }}>

                        {/* Series Scoreboard */}
                        {totalMatches > 1 && (
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '30px', marginBottom: '20px', padding: '10px 30px', background: 'rgba(255,255,255,0.05)', borderRadius: '30px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Player 1</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#00f2fe' }}>{seriesScores['Player 1']}</div>
                                </div>
                                <div style={{ fontSize: '1.2rem', color: '#334155', alignSelf: 'center', fontWeight: 'bold' }}>
                                    MATCH {currentMatch} OF {totalMatches}
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Player 2</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fe0979' }}>{seriesScores['Player 2']}</div>
                                </div>
                            </div>
                        )}

                        <div style={{ textAlign: 'center', marginBottom: '20px', padding: '15px', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '12px', border: '1px solid #334155', width: '100%' }}>
                            <h3 style={{ color: '#00f2fe', margin: '0 0 5px 0' }}>Shared Screen Mode</h3>
                            <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.95rem' }}>Both players are playing on this device. Pass the mouse back and forth!</p>
                        </div>

                        {/* Game Specific UI */}
                        {id === 'tictactoe' && (
                            <TicTacToe
                                socket={MockSocket}
                                roomId="local"
                                user={{ username: gameState.currentTurn === 'X' ? 'Player 1' : 'Player 2' }}
                                initialGameState={gameState}
                                onLocalMove={handleLocalTicTacToe}
                            />
                        )}

                        {id === 'territory' && (
                            <>
                                <h3 style={{ color: '#fbbf24', marginBottom: '10px' }}>Territory: Click anywhere to claim! Both players use the mouse.</h3>
                                <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
                                    <button
                                        onClick={() => setActiveColor('Player 1')}
                                        style={{ padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', border: activeColor === 'Player 1' ? '2px solid white' : 'none', background: '#00f2fe', color: 'black', fontWeight: 'bold', boxShadow: activeColor === 'Player 1' ? '0 0 10px #00f2fe' : 'none' }}
                                    >Act as Neon Blue</button>
                                    <button
                                        onClick={() => setActiveColor('Player 2')}
                                        style={{ padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', border: activeColor === 'Player 2' ? '2px solid white' : 'none', background: '#fe0979', color: 'white', fontWeight: 'bold', boxShadow: activeColor === 'Player 2' ? '0 0 10px #fe0979' : 'none' }}
                                    >Act as Neon Pink</button>
                                </div>
                                <TerritoryGrid
                                    socket={MockSocket}
                                    roomId="local"
                                    user={{ username: activeColor }}
                                    initialGameState={gameState}
                                    onLocalMove={handleLocalTerritory}
                                />
                            </>
                        )}

                        {id === 'drawing' && (
                            <>
                                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                                    <p style={{ color: '#f59e0b', margin: 0, fontSize: '0.9rem' }}><strong>Rule:</strong> The drawer should hide the word, and the guesser should look away or guess out loud!</p>
                                </div>
                                <DrawingGame
                                    socket={MockSocket}
                                    roomId="local"
                                    user={{ username: gameState.drawer }} // Ensures isMyTurn is always true for whoever is acting
                                    initialGameState={gameState}
                                    isOffline={true}
                                    onLocalAction={handleLocalDrawing}
                                />
                            </>
                        )}

                        {/* Match/Series Over Overlay */}
                        {(gameState && (gameState.winner || gameState.isDraw)) && (
                            <div style={{
                                marginTop: '40px',
                                padding: '30px',
                                background: 'rgba(15, 23, 42, 0.98)',
                                borderRadius: '20px',
                                border: '2px solid #4facfe',
                                textAlign: 'center',
                                width: '100%',
                                maxWidth: '500px',
                                boxShadow: '0 0 50px rgba(0, 0, 0, 0.8), 0 0 20px rgba(79, 172, 254, 0.3)',
                                zIndex: 1000,
                                position: 'relative'
                            }}>
                                {seriesWinner ? (
                                    <>
                                        <h2 style={{ color: '#f59e0b', fontSize: '2.2rem', marginBottom: '10px', textShadow: '0 0 15px rgba(245, 158, 11, 0.5)' }}>🏆 Series Over! 🏆</h2>
                                        <p style={{ fontSize: '1.4rem', marginBottom: '30px', color: '#e2e8f0' }}>
                                            {seriesWinner === 'Draw' ? "The series ended in a tie!" : `Congratulations ${seriesWinner}! You won the series!`}
                                        </p>
                                        <div style={{ display: 'flex', gap: '20px' }}>
                                            <button onClick={restartSeries} style={{ flex: 1, padding: '16px', background: 'linear-gradient(to right, #00f2fe, #4facfe)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}>Restart Series</button>
                                            <button onClick={() => navigate('/dashboard')} style={{ flex: 1, padding: '16px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}>Back to Menu</button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <h2 style={{ color: '#ffffff', marginBottom: '25px', fontSize: '1.8rem' }}>Match Complete</h2>
                                        <div style={{ display: 'flex', gap: '20px' }}>
                                            <button onClick={nextMatch} style={{ flex: 1, padding: '16px', background: 'linear-gradient(to right, #00f2fe, #4facfe)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}>Next Match</button>
                                            <button onClick={restartSeries} style={{ flex: 1, padding: '16px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}>Restart Series</button>
                                        </div>
                                        <button onClick={() => navigate('/dashboard')} style={{ width: '100%', marginTop: '15px', padding: '12px', background: 'transparent', color: '#94a3b8', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}>Back to Menu</button>
                                    </>
                                )}
                            </div>
                        )}

                    </div>
                )}
            </div>
        </div>
    );
};

export default LocalGameRoom;
