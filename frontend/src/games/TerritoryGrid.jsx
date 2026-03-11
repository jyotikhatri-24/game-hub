import React, { useState, useEffect } from 'react';

const TerritoryGrid = ({ socket, roomId, user, initialGameState, onLocalMove, isSpectator }) => {
    const [gameState, setGameState] = useState(initialGameState || {
        board: Array.from({ length: 100 }, () => ({ owner: null, strength: 0 })),
        scores: {},
        players: {},
        winner: null,
        isDraw: false
    });

    // Sync state if parent forces a new initial state (used for Local Offline Play)
    useEffect(() => {
        if (initialGameState) {
            setGameState(initialGameState);
        }
    }, [initialGameState]);

    useEffect(() => {
        const stateUpdateListener = (newState) => {
            setGameState(newState);
        };

        socket.on('territory_sync', stateUpdateListener);

        return () => {
            socket.off('territory_sync', stateUpdateListener);
        };
    }, [socket]);

    const handleCellClick = (index) => {
        if (isSpectator || gameState.winner || gameState.isDraw) return;

        // Is it local offline play? Pass the index and the currently designated active user color
        if (onLocalMove) {
            onLocalMove(index, user.username);
            return;
        }

        // Optimistically set the state to make it feel instantly responsive
        const newBoard = [...gameState.board];
        const cell = newBoard[index];
        const myUsername = user.username;

        if (cell.owner === null) {
            cell.owner = myUsername;
            cell.strength = 1;
        } else if (cell.owner === myUsername) {
            cell.strength = Math.min(3, cell.strength + 1);
        } else {
            cell.strength -= 1;
            if (cell.strength === 0) cell.owner = null;
        }

        setGameState(prev => ({ ...prev, board: newBoard }));

        // Emit the real action to be validated by the server and broadcasted
        socket.emit('territory_action', {
            roomId,
            index,
            player: myUsername
        });
    };

    const getCellColor = (owner, strength) => {
        if (owner === null) return 'rgba(30, 41, 59, 0.4)'; // Neutral dark gray

        // Determine if player 1 or player 2 color scheme based on the backend players config
        const isPlayer1 = owner === gameState.players.p1;
        const baseColor = isPlayer1 ? '0, 242, 254' : '254, 9, 121'; // Neon Blue vs Neon Pink

        // Strength modifies the opacity and brightness
        if (strength === 1) return `rgba(${baseColor}, 0.3)`;
        if (strength === 2) return `rgba(${baseColor}, 0.6)`;
        if (strength === 3) return `rgba(${baseColor}, 1.0)`;

        return 'rgba(30, 41, 59, 0.4)';
    };

    const getCellShadow = (owner, strength) => {
        if (owner === null || strength < 3) return 'none';
        const isPlayer1 = owner === gameState.players.p1;
        const hexColor = isPlayer1 ? '#00f2fe' : '#fe0979';
        return `0 0 10px ${hexColor}`;
    };

    const renderCell = (cell, index) => {
        return (
            <div
                key={index}
                onClick={() => handleCellClick(index)}
                style={{
                    width: '100%',
                    paddingBottom: '100%', // Creates a perfect square
                    backgroundColor: getCellColor(cell.owner, cell.strength),
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: '4px',
                    cursor: (gameState.winner || gameState.isDraw) ? 'default' : 'pointer',
                    transition: 'all 0.1s ease',
                    boxShadow: getCellShadow(cell.owner, cell.strength),
                    position: 'relative'
                }}
            >
                {/* Optional logic to display a shield icon inside the box if it has strength 3 */}
                {cell.strength === 3 && (
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.5, pointerEvents: 'none' }}>
                        🛡️
                    </div>
                )}
            </div>
        );
    };

    const p1Name = gameState.players?.p1 === user.username ? "YOU" : (gameState.players?.p1 || "Player 1");
    const p2Name = gameState.players?.p2 === user.username ? "YOU" : (gameState.players?.p2 || "Player 2");
    const p1Score = gameState.scores?.[p1Name] || 0;
    const p2Score = gameState.scores?.[p2Name] || 0;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '600px' }}>

            {/* Scoreboard Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '20px', padding: '15px 25px', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '12px', border: '1px solid #334155' }}>

                <div style={{ textAlign: 'left' }}>
                    <h3 style={{ margin: 0, color: '#00f2fe', textShadow: '0 0 10px rgba(0,242,254,0.5)' }}>{p1Name}</h3>
                    <p style={{ margin: '5px 0 0 0', fontSize: '1.5rem', fontWeight: 'bold' }}>{p1Score}</p>
                </div>

                <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <span style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Territory</span>
                    <strong style={{ fontSize: '1.2rem', color: 'white' }}>{p1Score + p2Score} / 100</strong>
                </div>

                <div style={{ textAlign: 'right' }}>
                    <h3 style={{ margin: 0, color: '#fe0979', textShadow: '0 0 10px rgba(254,9,121,0.5)' }}>{p2Name}</h3>
                    <p style={{ margin: '5px 0 0 0', fontSize: '1.5rem', fontWeight: 'bold' }}>{p2Score}</p>
                </div>

            </div>

            {/* End Game Overlay */}
            {gameState.winner && (
                <div style={{ marginBottom: '20px', padding: '10px 20px', background: 'rgba(34, 197, 94, 0.2)', border: '1px solid #22c55e', borderRadius: '8px', color: '#22c55e', fontWeight: 'bold', fontSize: '1.2rem' }}>
                    🎉 {gameState.winner} conquerered the grid! 🎉
                </div>
            )}
            {gameState.isDraw && (
                <div style={{ marginBottom: '20px', padding: '10px 20px', background: 'rgba(251, 191, 36, 0.2)', border: '1px solid #fbbf24', borderRadius: '8px', color: '#fbbf24', fontWeight: 'bold', fontSize: '1.2rem' }}>
                    🤝 The battle ended in a stalemate! 🤝
                </div>
            )}

            {/* The 10x10 Matrix */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(10, 1fr)',
                gap: '4px',
                width: '100%',
                background: '#0f172a',
                padding: '10px',
                borderRadius: '12px',
                border: '2px solid #1e293b',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
            }}>
                {gameState.board.map((cell, i) => renderCell(cell, i))}
            </div>

            <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '15px' }}>
                <strong>How to play:</strong> Click empty cells to claim them. Click your own cells to reinforce their strength (up to 3x). Click opponent cells to break their defenses.
            </p>
        </div>
    );
};

export default TerritoryGrid;
