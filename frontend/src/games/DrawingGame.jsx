import React, { useState, useEffect, useRef } from 'react';

const DrawingGame = ({ socket, roomId, user, initialGameState, isOffline, onLocalAction, isSpectator }) => {
    const canvasRef = useRef(null);
    const contextRef = useRef(null);

    const [gameState, setGameState] = useState(initialGameState);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hideWord, setHideWord] = useState(false);

    // Sync state if parent forces a new initial state
    useEffect(() => {
        if (initialGameState) {
            setGameState(initialGameState);
            if (isOffline) setHideWord(true); // Hide word for offline mode on new round
        }
    }, [initialGameState, isOffline]);

    // Draw Settings
    const [color, setColor] = useState('#00f2fe'); // Default neon blue
    const [brushSize, setBrushSize] = useState(5);

    const isMyTurn = gameState?.drawer === user.username;

    // --- 1. Canvas Initialization ---
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Set actual size in memory (scaled for retina displays)
        canvas.width = 600 * 2;
        canvas.height = 400 * 2;

        // Set display size
        canvas.style.width = '600px';
        canvas.style.height = '400px';

        const context = canvas.getContext('2d');
        context.scale(2, 2);
        context.lineCap = 'round';
        context.lineJoin = 'round';
        contextRef.current = context;
    }, []);

    // --- 2. Socket Synchronization Listeners ---
    useEffect(() => {
        const syncDrawListener = (pathData) => {
            if (!contextRef.current) return;
            const context = contextRef.current;

            // Apply incoming styles
            context.strokeStyle = pathData.color;
            context.lineWidth = pathData.brushSize;

            if (pathData.type === 'start') {
                context.beginPath();
                context.moveTo(pathData.x, pathData.y);
            } else if (pathData.type === 'draw') {
                context.lineTo(pathData.x, pathData.y);
                context.stroke();
            } else if (pathData.type === 'end') {
                context.closePath();
            }
        };

        const syncClearListener = () => {
            const canvas = canvasRef.current;
            const context = contextRef.current;
            if (context && canvas) {
                context.clearRect(0, 0, canvas.width, canvas.height);
            }
        };

        const roundEndListener = (data) => {
            setGameState(prev => ({ ...prev, winner: data.winner, roundComplete: true, word: data.word }));
        };

        const roundStartListener = (newState) => {
            setGameState(newState);
            syncClearListener(); // Auto-clear board for new round
        };

        socket.on('drawing_sync', syncDrawListener);
        socket.on('drawing_clear_sync', syncClearListener);
        socket.on('drawing_round_over', roundEndListener);
        socket.on('drawing_round_start', roundStartListener);

        return () => {
            socket.off('drawing_sync', syncDrawListener);
            socket.off('drawing_clear_sync', syncClearListener);
            socket.off('drawing_round_over', roundEndListener);
            socket.off('drawing_round_start', roundStartListener);
        };
    }, [socket]);

    // --- 3. Drawing Interactions ---
    const startDrawing = ({ nativeEvent }) => {
        if (isSpectator || !isMyTurn || gameState.roundComplete) return;

        const { offsetX, offsetY } = nativeEvent;
        const context = contextRef.current;

        context.strokeStyle = color;
        context.lineWidth = brushSize;
        context.beginPath();
        context.moveTo(offsetX, offsetY);
        setIsDrawing(true);

        // Broadcast
        socket.emit('drawing_path', {
            roomId,
            pathData: { type: 'start', x: offsetX, y: offsetY, color, brushSize }
        });
    };

    const draw = ({ nativeEvent }) => {
        if (!isDrawing || !isMyTurn || gameState.roundComplete) return;

        const { offsetX, offsetY } = nativeEvent;
        const context = contextRef.current;

        context.lineTo(offsetX, offsetY);
        context.stroke();

        // Broadcast
        socket.emit('drawing_path', {
            roomId,
            pathData: { type: 'draw', x: offsetX, y: offsetY, color, brushSize }
        });
    };

    const stopDrawing = () => {
        if (!isDrawing || !isMyTurn) return;

        contextRef.current.closePath();
        setIsDrawing(false);

        // Broadcast
        socket.emit('drawing_path', {
            roomId,
            pathData: { type: 'end' }
        });
    };

    const clearCanvas = () => {
        if (isSpectator || !isMyTurn || gameState.roundComplete) return;

        const canvas = canvasRef.current;
        contextRef.current.clearRect(0, 0, canvas.width, canvas.height);

        socket.emit('drawing_clear', { roomId });
    };

    const nextRound = () => {
        if (isOffline && onLocalAction) {
            onLocalAction('next_round');
        } else {
            socket.emit('drawing_next_round', { roomId });
        }
    };

    if (!gameState) return <p>Loading state...</p>;

    // --- Render Details ---
    const colors = ['#00f2fe', '#fe0979', '#22c55e', '#fbbf24', '#ffffff', '#000000'];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>

            {/* Header / Game Status */}
            <div style={{ width: '600px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', padding: '10px 20px', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '12px', border: '1px solid #334155' }}>
                <div>
                    <h3 style={{ margin: 0, color: '#e2e8f0' }}>Drawing & Guessing</h3>
                    <p style={{ margin: '5px 0 0 0', fontSize: '0.9rem', color: isMyTurn ? '#00f2fe' : '#94a3b8' }}>
                        {isMyTurn ? "✏️ You are drawing!" : `🤔 ${gameState.drawer || 'Opponent'} is drawing. Guess in chat!`}
                    </p>
                </div>

                {isMyTurn && !gameState.roundComplete && (
                    <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase' }}>Secret Word</span>
                        {isOffline && hideWord ? (
                            <button onClick={() => setHideWord(false)} style={{ display: 'block', padding: '5px 10px', background: '#334155', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '5px' }}>Reveal Word</button>
                        ) : (
                            <div>
                                <h2 style={{ margin: 0, color: '#fbbf24', letterSpacing: '2px' }}>{gameState.word}</h2>
                                {isOffline && <button onClick={() => setHideWord(true)} style={{ padding: '2px 8px', fontSize: '0.7rem', background: '#e2e8f0', color: 'black', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Hide</button>}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Canvas Container */}
            <div style={{ position: 'relative' }}>
                <canvas
                    ref={canvasRef}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseOut={stopDrawing}
                    style={{
                        background: '#e2e8f0', // Slightly off-white canvas for contrast
                        borderRadius: '16px',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                        cursor: isSpectator ? 'not-allowed' : (isMyTurn ? 'crosshair' : 'not-allowed'),
                        border: `3px solid ${isSpectator ? '#334155' : (isMyTurn ? '#00f2fe' : '#334155')}`
                    }}
                />

                {/* Round Over Overlay */}
                {gameState.roundComplete && (
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(15, 23, 42, 0.85)', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                        <h1 style={{ color: '#22c55e', fontSize: '3rem', margin: 0, textShadow: '0 0 20px #22c55e' }}>🎉 WINNER 🎉</h1>
                        <p style={{ color: 'white', fontSize: '1.2rem', marginTop: '10px' }}>
                            <strong style={{ color: '#00f2fe' }}>{gameState.winner}</strong> guessed the word!
                        </p>
                        <h2 style={{ color: '#fbbf24', fontSize: '2.5rem', margin: '10px 0' }}>{gameState.word}</h2>

                        <button
                            onClick={nextRound}
                            style={{ marginTop: '20px', padding: '12px 30px', borderRadius: '8px', border: 'none', background: 'linear-gradient(to right, #00f2fe, #4facfe)', color: 'white', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0, 242, 254, 0.4)' }}
                        >
                            Start Next Round
                        </button>
                    </div>
                )}
            </div>

            {/* Toolbox (Only for Drawer) */}
            {isMyTurn && !gameState.roundComplete && (
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginTop: '20px', padding: '15px 25px', background: 'rgba(30, 41, 59, 0.8)', borderRadius: '16px', border: '1px solid #1e293b' }}>

                    {/* Colors */}
                    <div style={{ display: 'flex', gap: '10px' }}>
                        {colors.map(c => (
                            <div
                                key={c}
                                onClick={() => setColor(c)}
                                style={{
                                    width: '30px', height: '30px', borderRadius: '50%', background: c,
                                    cursor: 'pointer', border: color === c ? '3px solid white' : '2px solid transparent',
                                    boxShadow: color === c ? `0 0 10px ${c}` : 'none',
                                    transition: 'all 0.2s'
                                }}
                            />
                        ))}
                    </div>

                    <div style={{ width: '2px', height: '30px', background: '#334155' }}></div>

                    {/* Brush Size */}
                    <input
                        type="range"
                        min="2" max="25"
                        value={brushSize}
                        onChange={(e) => setBrushSize(e.target.value)}
                        style={{ cursor: 'pointer' }}
                    />

                    <div style={{ width: '2px', height: '30px', background: '#334155' }}></div>

                    {/* Clear Canvas */}
                    <button
                        onClick={clearCanvas}
                        style={{ background: '#ef4444', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        Clear
                    </button>

                    {isOffline && (
                        <button
                            onClick={() => onLocalAction('win')}
                            style={{ background: '#22c55e', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', marginLeft: 'auto' }}
                        >
                            Opponent Guessed It!
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default DrawingGame;
