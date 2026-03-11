const { Server } = require('socket.io');
const { addToQueue, createPrivateRoom, joinPrivateRoom, handleDisconnect, handleReconnect, setPlayerReady, handleQuitGame, handleMatchOver, joinSpectator, activeRooms } = require('./roomManager');
const { handleTicTacToeMove } = require('./games/tictactoe');
const { handleDrawingGuess, startNewDrawingRound } = require('./games/drawing');
const { handleTerritoryAction } = require('./games/territory');

const initSocket = (server) => {
    const io = new Server(server, {
        cors: {
            origin: "http://localhost:5173", // Vite default port
            methods: ["GET", "POST"]
        }
    });

    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.id}`);

        // Handle joining the matchmaking queue
        socket.on('join_queue', ({ gameType, user }) => {
            if (user) {
                addToQueue(io, socket, gameType, user);
            }
        });

        // Handle private room creation
        socket.on('create_private_room', ({ gameType, user }) => {
            createPrivateRoom(io, socket, gameType, user);
        });

        // Handle joining private room via code
        socket.on('join_private_room', ({ inviteCode, user }) => {
            joinPrivateRoom(io, socket, inviteCode, user);
        });

        // Handle reconnection
        socket.on('reconnect_to_game', ({ roomId, username }) => {
            handleReconnect(io, socket, roomId, username);
        });

        // Handle explicitly joining an existing room (e.g., on mount or reconnect)
        socket.on('join_room', ({ roomId, username }) => {
            socket.join(roomId);
            console.log(`${socket.id} joined room: ${roomId}`);

            // If this user is already a known player in this room (e.g., page refresh
            // or React Strict Mode), update their socket ID and send back room state.
            const room = activeRooms.get(roomId);
            if (room && username) {
                const player = room.players.find(p => p.user.username === username);
                if (player) {
                    if (player.socketId !== socket.id) {
                        player.socketId = socket.id;
                        console.log(`[DEBUG] Updated socket for ${username} in room ${roomId}`);
                    }

                    // Send back room state so the client can restore opponent name,
                    // scores, and game status (fixes the missed match_found event).
                    socket.emit('room_joined', {
                        roomId,
                        gameType: room.gameType,
                        players: room.players.map(p => ({ ...p.user, isReady: p.isReady })),
                        state: room.state,
                        gameState: room.gameState,
                        scores: room.scores,
                        currentMatch: room.currentMatch,
                        totalMatches: room.totalMatches
                    });
                }
            }
        });

        // Handle joining as a spectator
        socket.on('join_spectator', ({ roomId, user }) => {
            joinSpectator(io, socket, roomId, user);
        });

        // Handle sending chat messages in a room
        socket.on('send_message', ({ roomId, message, user }) => {
            // First broadcast the message to the chat
            io.to(roomId).emit('receive_message', {
                user,
                message,
                time: new Date().toISOString()
            });

            // Then check if it triggers a win condition in a Drawing game
            handleDrawingGuess(io, roomId, activeRooms, user, message, { handleMatchOver });
        });

        // Chat improvements: Typing indicators
        socket.on('typing_start', ({ roomId, username }) => {
            socket.to(roomId).emit('player_typing', { username, isTyping: true });
        });

        socket.on('typing_stop', ({ roomId, username }) => {
            socket.to(roomId).emit('player_typing', { username, isTyping: false });
        });

        // --- Day 12: Player Synchronization ---

        // Handle a player marking themselves as ready
        socket.on('player_ready', ({ roomId, username }) => {
            const session = activeRooms.get(roomId);
            if (!session || session.state !== 'waiting') return; // Guard against ghost signals during active play

            const isGameReadyToStart = setPlayerReady(roomId, username);

            // Re-broadcast ready state to the room so the UI can update
            io.to(roomId).emit('player_ready_status', { username, isReady: true });

            // If both players are ready, trigger the game start signal
            if (isGameReadyToStart) {
                const session = activeRooms.get(roomId);
                console.log(`[${roomId}] Both players ready. Game starting...`);

                session.startMatch(io, session.gameState);

                io.to(roomId).emit('game_start', {
                    roomId,
                    message: "Both players are ready! The game will now begin.",
                    initialGameState: session.gameState
                });
            }
        });

        // Handle generic game actions (to be fully utilized in Week 3)
        // This accepts a payload and instantly broadcasts it to the room
        socket.on('game_action', ({ roomId, actionData }) => {
            // In a real game, you would validate the action against the gameState here
            // For now, we simply pass the action along to sync the clients
            socket.to(roomId).emit('game_state_update', actionData);
        });

        // --- WEEK 3: Tic Tac Toe Specific Events ---
        socket.on('tictactoe_move', (payload) => {
            handleTicTacToeMove(io, socket, payload.roomId, activeRooms, payload, { handleMatchOver });
        });

        // --- WEEK 3: Drawing Game Specific Events ---
        // Instantly rebroadcast drawing strokes to the other player
        socket.on('drawing_path', ({ roomId, pathData }) => {
            socket.to(roomId).emit('drawing_sync', pathData);
        });

        // Rebroadcast canvas clear command
        socket.on('drawing_clear', ({ roomId }) => {
            socket.to(roomId).emit('drawing_clear_sync');
        });

        // Trigger a new round (swapping roles)
        socket.on('drawing_next_round', ({ roomId }) => {
            startNewDrawingRound(io, roomId, activeRooms);
        });

        // --- WEEK 3: Territory Grid Specific Events ---
        socket.on('territory_action', (payload) => {
            handleTerritoryAction(io, socket, payload.roomId, activeRooms, payload, { handleMatchOver });
        });

        // Handle restarting a series
        socket.on('restart_series', ({ roomId }) => {
            const { handleRestartSeries } = require('./roomManager');
            handleRestartSeries(io, roomId);
        });

        // Handle disconnect
        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.id}`);
            handleDisconnect(io, socket);
        });
    });

    return io;
};

module.exports = { initSocket };
