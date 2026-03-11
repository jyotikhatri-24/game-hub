import React, { useState, useEffect } from 'react';

const TicTacToe = ({ socket, roomId, user, initialGameState, onLocalMove, isSpectator }) => {
    const [gameState, setGameState] = useState(initialGameState || {
        board: Array(9).fill(null),
        currentTurn: 'X',
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

        socket.on('tictactoe_state_update', stateUpdateListener);

        return () => {
            socket.off('tictactoe_state_update', stateUpdateListener);
        };
    }, [socket]);

    const handleCellClick = (index) => {
        // Validation checks
        if (isSpectator) return;
        if (gameState.winner || gameState.isDraw) return;
        if (gameState.board[index] !== null) return;

        // Is it local offline play? Route the click upwards!
        if (onLocalMove) {
            onLocalMove(index);
            return;
        }

        // Determine my symbol based on the players object
        let mySymbol = null;
        if (gameState.players['X'] === user.username) mySymbol = 'X';
        else if (gameState.players['O'] === user.username) mySymbol = 'O';

        // Prevent clicking if it's not my turn
        if (mySymbol !== gameState.currentTurn) return;

        // Optimistically update the UI to feel instant
        const newBoard = [...gameState.board];
        newBoard[index] = mySymbol;
        setGameState(prev => ({ ...prev, board: newBoard }));

        // Send the move to the server
        socket.emit('tictactoe_move', {
            roomId,
            index,
            player: user.username
        });
    };

    const renderCell = (index) => {
        const value = gameState.board[index];
        let color = '#334155'; // default empty
        if (value === 'X') color = '#00f2fe'; // neon blue for X
        if (value === 'O') color = '#fe0979'; // neon pink for O

        return (
            <div
                key={index}
                onClick={() => handleCellClick(index)}
                style={{
                    width: '120px',
                    height: '120px',
                    backgroundColor: 'rgba(30, 41, 59, 0.5)',
                    border: '2px solid rgba(79, 172, 254, 0.2)',
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '4rem',
                    fontWeight: 'bold',
                    color: color,
                    cursor: (gameState.winner || gameState.isDraw || value) ? 'default' : 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: value ? `0 0 15px ${color}40` : 'none',
                    textShadow: value ? `0 0 20px ${color}` : 'none'
                }}
            >
                {value}
            </div>
        );
    };

    // Determine Turn Text
    let turnText = "Waiting for game state...";
    let turnColor = "#94a3b8";

    if (gameState.winner) {
        const isMe = gameState.winner === user.username;
        turnText = isMe ? "🎉 You Won! 🎉" : `💀 ${gameState.winner} Won 💀`;
        turnColor = isMe ? "#22c55e" : "#ef4444";
    } else if (gameState.isDraw) {
        turnText = "🤝 It's a Draw! 🤝";
        turnColor = "#fbbf24";
    } else if (gameState.players) {
        if (onLocalMove) {
            // Local offline wording
            const playerName = gameState.players[gameState.currentTurn];
            turnText = `${playerName}'s Turn (${gameState.currentTurn})`;
            turnColor = gameState.currentTurn === 'X' ? '#00f2fe' : '#fe0979';
        } else {
            // Online wording
            let mySymbol = null;
            if (gameState.players['X'] === user.username) mySymbol = 'X';
            else if (gameState.players['O'] === user.username) mySymbol = 'O';

            if (gameState.currentTurn === mySymbol) {
                turnText = "Your Turn (" + mySymbol + ")";
                turnColor = "#4facfe";
            } else {
                const oppName = gameState.players[gameState.currentTurn] || "Opponent";
                turnText = `${oppName}'s Turn (${gameState.currentTurn})`;
                turnColor = "#94a3b8";
            }
        }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '30px' }}>
            <h2 style={{ color: turnColor, textShadow: `0 0 10px ${turnColor}40`, margin: 0, transition: 'color 0.3s' }}>
                {turnText}
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
                {gameState.board.map((_, i) => renderCell(i))}
            </div>
        </div>
    );
};

export default TicTacToe;
