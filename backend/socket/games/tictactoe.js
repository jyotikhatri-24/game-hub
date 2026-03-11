const { saveGameHistory } = require('../../utils/historyHelper');

const WINNING_COMBINATIONS = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
    [0, 4, 8], [2, 4, 6]             // Diagonals
];

const checkWinner = (board) => {
    for (let combo of WINNING_COMBINATIONS) {
        const [a, b, c] = combo;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a]; // Returns 'X' or 'O'
        }
    }
    return null;
};

const checkDraw = (board) => {
    return board.every(cell => cell !== null);
};

const initTicTacToeState = (player1, player2) => {
    return {
        board: Array(9).fill(null),
        currentTurn: 'X', // X always goes first
        players: {
            'X': player1.user.username,
            'O': player2.user.username
        },
        winner: null,
        isDraw: false
    };
};

const handleTicTacToeMove = (io, socket, roomId, activeRooms, { index, player }, { handleMatchOver }) => {
    const room = activeRooms.get(roomId);
    if (!room || room.gameType !== 'tictactoe') return;

    const gameState = room.gameState;

    // Check if game is already over
    if (gameState.winner || gameState.isDraw) return;

    // Determine if the player making the move is 'X' or 'O'
    let playerSymbol = null;
    if (gameState.players['X'] === player) playerSymbol = 'X';
    else if (gameState.players['O'] === player) playerSymbol = 'O';

    // Validate turn
    if (playerSymbol !== gameState.currentTurn) return;

    // Validate move (cell must be empty)
    if (gameState.board[index] !== null) return;

    // Apply move
    gameState.board[index] = playerSymbol;

    // Check for win/draw
    const winnerSymbol = checkWinner(gameState.board);
    if (winnerSymbol) {
        gameState.winner = gameState.players[winnerSymbol];
        handleMatchOver(io, roomId, gameState.winner);
    } else if (checkDraw(gameState.board)) {
        gameState.isDraw = true;
        handleMatchOver(io, roomId, null, true);
    } else {
        // Swap turns
        gameState.currentTurn = gameState.currentTurn === 'X' ? 'O' : 'X';
    }

    // Broadcast updated state
    // Restart turn timer for the next player
    room.startTurnTimer(io);

    io.to(roomId).emit('tictactoe_state_update', gameState);
};

module.exports = {
    initTicTacToeState,
    handleTicTacToeMove
};
