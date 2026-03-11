const GameSession = require('./GameSession');
const { initTicTacToeState } = require('./games/tictactoe');
const { initDrawingState } = require('./games/drawing');
const { initTerritoryState } = require('./games/territory');

const queues = {
    tictactoe: [],
    drawing: [],
    territory: []
};
const activeRooms = new Map();
const privateRooms = new Map(); // Maps inviteCode -> roomId
const disconnectionTimers = new Map(); // Maps socketId -> timeoutId

const generateInviteCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
};

const addToQueue = (io, socket, gameType, user) => {
    // Basic validation
    if (!queues[gameType]) return;

    // Check if user is already in queue
    const existingIndex = queues[gameType].findIndex(p => p.socketId === socket.id);
    if (existingIndex !== -1) return;

    // Add player to queue
    queues[gameType].push({
        socketId: socket.id,
        user: user,
    });

    console.log(`[DEBUG] ${user.username} joined ${gameType} queue. Queue size: ${queues[gameType].length}`);

    // Check for match
    if (queues[gameType].length >= 2) {
        const p1 = queues[gameType][0];
        const p2Index = queues[gameType].findIndex(p => p.user.username !== p1.user.username);

        if (p2Index !== -1) {
            const player1 = queues[gameType].splice(0, 1)[0];
            const player2 = queues[gameType].splice(p2Index - 1, 1)[0];

            console.log(`[DEBUG] Matching ${player1.user.username} with ${player2.user.username}`);

            // Generate unique room ID
            const roomId = `${gameType}_${Date.now()}_${Math.random().toString(36).substring(7)}`;

            // Initialize specific game state
            let initialGameState = {};
            if (gameType === 'tictactoe') {
                initialGameState = initTicTacToeState(player1, player2);
            } else if (gameType === 'drawing') {
                initialGameState = initDrawingState(player1, player2);
            } else if (gameType === 'territory') {
                initialGameState = initTerritoryState(player1, player2);
            }

            // Create GameSession
            const session = new GameSession(roomId, gameType, 3, handleMatchOver);
            session.addPlayer(player1.socketId, player1.user);
            session.addPlayer(player2.socketId, player2.user);
            session.gameState = initialGameState;

            activeRooms.set(roomId, session);

            // Join both sockets to the room
            const socket1 = io.sockets.sockets.get(player1.socketId);
            const socket2 = io.sockets.sockets.get(player2.socketId);

            console.log(`[DEBUG] Found Socket 1: ${!!socket1}, Found Socket 2: ${!!socket2}`);

            if (socket1 && socket2) {
                socket1.join(roomId);
                socket2.join(roomId);

                // Notify both players
                io.to(roomId).emit('match_found', {
                    roomId,
                    gameType,
                    players: [player1.user, player2.user]
                });

                console.log(`Match found! Room: ${roomId}`);
            }
        }
    }
};

const createPrivateRoom = (io, socket, gameType, user) => {
    if (!queues[gameType]) return;

    const roomId = `private_${gameType}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const inviteCode = generateInviteCode();

    const session = new GameSession(roomId, gameType, 3, handleMatchOver);
    session.addPlayer(socket.id, user);
    session.inviteCode = inviteCode;
    session.isPrivate = true;
    session.status = 'waiting';

    activeRooms.set(roomId, session);
    privateRooms.set(inviteCode, roomId);
    socket.join(roomId);

    socket.emit('private_room_created', { roomId, inviteCode });
    console.log(`[DEBUG] Private room created: ${roomId} with code ${inviteCode}`);
};

const joinPrivateRoom = (io, socket, inviteCode, user) => {
    const roomId = privateRooms.get(inviteCode);
    if (!roomId) {
        socket.emit('error_message', { message: 'Invalid invite code.' });
        return;
    }

    const room = activeRooms.get(roomId);
    if (!room || room.players.length >= 2) {
        socket.emit('error_message', { message: 'Room is full or no longer exists.' });
        return;
    }

    // Add player to session
    room.addPlayer(socket.id, user);
    room.status = 'full';
    socket.join(roomId);

    // Initialize game state now that we have two players
    const player1 = room.players[0];
    const player2 = room.players[1];

    if (room.gameType === 'tictactoe') {
        room.gameState = initTicTacToeState(player1, player2);
    } else if (room.gameType === 'drawing') {
        room.gameState = initDrawingState(player1, player2);
    } else if (room.gameType === 'territory') {
        room.gameState = initTerritoryState(player1, player2);
    }

    io.to(roomId).emit('match_found', {
        roomId,
        gameType: room.gameType,
        players: room.players.map(p => p.user),
        isPrivate: true
    });

    console.log(`[DEBUG] Player ${user.username} joined private room ${roomId}`);
};

const handleDisconnect = (io, socket) => {
    // 1. Remove from all matchmaking queues
    Object.keys(queues).forEach(type => {
        queues[type] = queues[type].filter(p => p.socketId !== socket.id);
    });

    // 2. Handle disconnection during an active game
    activeRooms.forEach((room, roomId) => {
        const playerIndex = room.players.findIndex(p => p.socketId === socket.id);

        if (playerIndex !== -1) {
            console.log(`[DEBUG] Player ${room.players[playerIndex].user.username} disconnected from room ${roomId}`);

            // Check if the overall series is finished
            const isSeriesOver = room.state === 'finished';

            if (!isSeriesOver) {
                // Award victory to the remaining player if they don't reconnect
                const gracePeriod = 30000; // 30 seconds

                console.log(`[DEBUG] Player ${room.players[playerIndex].user.username} disconnected. Starting ${gracePeriod}ms grace period.`);

                io.to(roomId).emit('opponent_reconnecting', {
                    username: room.players[playerIndex].user.username,
                    timeout: gracePeriod
                });

                const timerId = setTimeout(() => {
                    const currentRoom = activeRooms.get(roomId);
                    if (!currentRoom) return;

                    const player = currentRoom.players[playerIndex];
                    const stillMissing = !player.socketId || player.socketId === socket.id;

                    if (stillMissing) {
                        const remainingPlayer = currentRoom.players.find(p => p.socketId !== null && p.socketId !== undefined);
                        if (remainingPlayer) {
                            const winnerUsername = remainingPlayer.user.username;
                            const loserUsername = player.user.username;

                            console.log(`[FORFEIT] ${loserUsername} failed to reconnect. ${winnerUsername} wins series.`);

                            const { saveGameHistory } = require('../utils/historyHelper');
                            saveGameHistory(currentRoom.gameType, [winnerUsername, loserUsername], winnerUsername);

                            io.to(roomId).emit('opponent_disconnected', {
                                winner: winnerUsername,
                                message: `Your opponent (${loserUsername}) failed to reconnect. You win by forfeit!`
                            });
                        }
                        activeRooms.delete(roomId);
                        if (currentRoom.inviteCode) privateRooms.delete(currentRoom.inviteCode);
                    }
                }, gracePeriod);

                disconnectionTimers.set(socket.id, timerId);
            } else {
                // Game was already over, just cleanup if last person left
                const othersPresent = room.players.some(p => p.socketId !== socket.id && p.socketId);
                if (!othersPresent) {
                    activeRooms.delete(roomId);
                    if (room.inviteCode) privateRooms.delete(room.inviteCode);
                }
            }

            // Mark player as disconnected in room
            room.players[playerIndex].socketId = null;
        }
    });
};

const handleReconnect = (io, socket, roomId, username) => {
    const room = activeRooms.get(roomId);
    if (!room) {
        socket.emit('error_message', { message: 'Room no longer exists.' });
        return;
    }

    const playerIndex = room.players.findIndex(p => p.user.username === username);
    if (playerIndex === -1) return;

    // Clear any pending forfeit timer
    const oldSocketId = room.players[playerIndex].socketId;
    if (disconnectionTimers.has(oldSocketId)) {
        clearTimeout(disconnectionTimers.get(oldSocketId));
        disconnectionTimers.delete(oldSocketId);
    }

    // Update with new socket ID
    room.players[playerIndex].socketId = socket.id;
    socket.join(roomId);

    console.log(`[DEBUG] Player ${username} reconnected to room ${roomId}`);

    socket.emit('reconnect_success', {
        gameState: room.gameState,
        gameType: room.gameType,
        players: room.players.map(p => ({ ...p.user, isReady: p.isReady })),
        state: room.state,
        scores: room.scores,
        currentMatch: room.currentMatch,
        totalMatches: room.totalMatches
    });

    // Notify opponent
    socket.to(roomId).emit('opponent_reconnected', { username });
};

function handleMatchOver(io, roomId, winner, isDraw = false) {
    const session = activeRooms.get(roomId);
    if (!session) return;

    const result = session.handleMatchOver(winner, isDraw);

    // 2. Broadcast score update
    io.to(roomId).emit('match_score_update', {
        scores: session.scores,
        currentMatch: session.currentMatch,
        totalMatches: session.totalMatches,
        state: session.state
    });

    // 4. Check if series is over
    if (result.seriesOver) {
        io.to(roomId).emit('series_end', {
            winner: result.winner,
            finalScores: session.scores
        });
    } else {
        // Countdown for next round
        let countdown = 3;
        const interval = setInterval(() => {
            io.to(roomId).emit('next_match_countdown', { seconds: countdown });
            countdown--;
            if (countdown < 0) {
                clearInterval(interval);
                // Reset readiness for next match on frontend
                io.to(roomId).emit('player_ready_status', { reset: true });
            }
        }, 1000);
    }
};

const handleQuitGame = (io, socket, roomId, username) => {
    const session = activeRooms.get(roomId);
    if (!session) return;

    const player = session.players.find(p => p.user.username === username);
    if (!player) return;

    const opponent = session.players.find(p => p.user.username !== username);
    if (!opponent) return;

    console.log(`[DEBUG] Player ${username} quit. Awarding win to ${opponent.user.username}`);

    io.to(roomId).emit('player_quit', {
        quitter: username,
        winner: opponent.user.username,
        message: `${username} has quit the game. ${opponent.user.username} wins!`
    });

    handleMatchOver(io, roomId, opponent.user.username);
};

const joinSpectator = (io, socket, roomId, user) => {
    const session = activeRooms.get(roomId);
    if (!session) {
        socket.emit('error_message', { message: 'Room no longer exists.' });
        return;
    }

    session.addSpectator(socket.id, user);
    socket.join(roomId);

    socket.emit('spectator_joined', {
        roomId,
        gameType: session.gameType,
        players: session.players.map(p => p.user),
        gameState: session.gameState,
        scores: session.scores,
        currentMatch: session.currentMatch,
        totalMatches: session.totalMatches
    });

    console.log(`[DEBUG] Spectator ${user.username} joined room ${roomId}`);
};

const setPlayerReady = (roomId, username) => {
    const session = activeRooms.get(roomId);
    if (!session) return false;

    const allReady = session.setReady(username);

    // If it's a new match starting, we might need to reset the gameState
    if (allReady && session.currentMatch > 1) {
        const player1 = session.players[0];
        const player2 = session.players[1];
        if (session.gameType === 'tictactoe') {
            session.gameState = initTicTacToeState(player1, player2);
        } else if (session.gameType === 'drawing') {
            session.gameState = initDrawingState(player1, player2);
        } else if (session.gameType === 'territory') {
            session.gameState = initTerritoryState(player1, player2);
        }
    }

    return allReady;
};

// --- Day 13: Room Scalability - Inactive Room Cleanup ---
// Run every 1 minute to cleanup rooms that have been inactive for > 10 minutes
setInterval(() => {
    const INACTIVE_THRESHOLD = 600000; // 10 minutes
    const now = Date.now();

    activeRooms.forEach((session, roomId) => {
        if (now - session.lastActivity > INACTIVE_THRESHOLD) {
            console.log(`[CLEANUP] Removing inactive room: ${roomId}`);
            activeRooms.delete(roomId);
            if (session.inviteCode) {
                privateRooms.delete(session.inviteCode);
            }
        }
    });
}, 60000);

const handleRestartSeries = (io, roomId) => {
    const session = activeRooms.get(roomId);
    if (!session) return;

    session.restartSeries();

    io.to(roomId).emit('match_score_update', {
        scores: session.scores,
        currentMatch: session.currentMatch,
        totalMatches: session.totalMatches,
        state: session.state
    });

    io.to(roomId).emit('player_ready_status', { reset: true });
};

module.exports = {
    addToQueue,
    createPrivateRoom,
    joinPrivateRoom,
    handleDisconnect,
    handleReconnect,
    setPlayerReady,
    handleMatchOver,
    handleQuitGame,
    handleRestartSeries,
    joinSpectator,
    activeRooms
};
