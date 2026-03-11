const { saveGameHistory } = require('../../utils/historyHelper');

const WORDS = [
    'apple', 'house', 'tree', 'car', 'sun',
    'moon', 'computer', 'cat', 'dog', 'mouse',
    'keyboard', 'ocean', 'mountain', 'coffee', 'book'
];

const getRandomWord = () => {
    return WORDS[Math.floor(Math.random() * WORDS.length)];
};

const initDrawingState = (player1, player2) => {
    // Randomly select drawer
    const isPlayer1Drawer = Math.random() > 0.5;

    return {
        word: getRandomWord(),
        drawer: isPlayer1Drawer ? player1.user.username : player2.user.username,
        guesser: isPlayer1Drawer ? player2.user.username : player1.user.username,
        winner: null,
        roundComplete: false,
        players: {
            p1: player1.user.username,
            p2: player2.user.username
        }
    };
};

// Check if a chat message matches the secret word
const handleDrawingGuess = (io, roomId, activeRooms, user, message, { handleMatchOver }) => {
    const room = activeRooms.get(roomId);
    if (!room || room.gameType !== 'drawing') return false;

    const gameState = room.gameState;
    if (gameState.roundComplete) return false;

    // Only the guesser can win by guessing
    if (user !== gameState.guesser) return false;

    // Normalize guess
    const guess = message.trim().toLowerCase();

    if (guess === gameState.word) {
        // Flag the round as over
        gameState.roundComplete = true;
        gameState.winner = user;

        // Restart turn timer for next drawer/round
        room.startTurnTimer(io);

        handleMatchOver(io, roomId, user);

        // Notify the room
        io.to(roomId).emit('drawing_round_over', {
            winner: user,
            word: gameState.word,
            message: `🎉 ${user} guessed the word correctly! It was: ${gameState.word} 🎉`
        });

        return true; // Indicate it was a winning guess
    }

    return false;
};

const startNewDrawingRound = (io, roomId, activeRooms) => {
    const room = activeRooms.get(roomId);
    if (!room || room.gameType !== 'drawing') return;

    // Swap roles and get new word
    const oldDrawer = room.gameState.drawer;
    const oldGuesser = room.gameState.guesser;

    room.gameState = {
        word: getRandomWord(),
        drawer: oldGuesser, // Swap!
        guesser: oldDrawer,
        winner: null,
        roundComplete: false,
        players: room.gameState.players
    };

    // Restart turn timer for the next round
    room.startTurnTimer(io);

    io.to(roomId).emit('drawing_round_start', room.gameState);
};

module.exports = {
    initDrawingState,
    handleDrawingGuess,
    startNewDrawingRound
};
