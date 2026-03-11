const { saveGameHistory } = require('../../utils/historyHelper');

const initTerritoryState = (player1, player2) => {
    return {
        // 100 cells (10x10 grid). Each cell has owner (username or null) and strength (0-3).
        board: Array.from({ length: 100 }, () => ({ owner: null, strength: 0 })),
        scores: {
            [player1.user.username]: 0,
            [player2.user.username]: 0
        },
        players: {
            p1: player1.user.username,
            p2: player2.user.username
        },
        winner: null,
        isDraw: false
    };
};

const handleTerritoryAction = (io, socket, roomId, activeRooms, { index, player }, { handleMatchOver }) => {
    const room = activeRooms.get(roomId);
    if (!room || room.gameType !== 'territory') return;

    const gameState = room.gameState;

    // Reject if game is over
    if (gameState.winner || gameState.isDraw) return;

    const cell = gameState.board[index];

    // 1. Unowned Cell -> Claim it
    if (cell.owner === null) {
        cell.owner = player;
        cell.strength = 1;
    }
    // 2. Owned by Player -> Reinforce it (max strength 3)
    else if (cell.owner === player) {
        cell.strength = Math.min(3, cell.strength + 1);
    }
    // 3. Owned by Opponent -> Attack it
    else if (cell.owner !== player) {
        cell.strength -= 1;
        // If broken, becomes neutral
        if (cell.strength === 0) {
            cell.owner = null;
        }
    }

    // Recalculate Scores (Fully owned cells)
    let p1Score = 0;
    let p2Score = 0;
    let neutralCount = 0;

    gameState.board.forEach(c => {
        if (c.owner === gameState.players.p1) p1Score++;
        else if (c.owner === gameState.players.p2) p2Score++;
        else neutralCount++;
    });

    gameState.scores[gameState.players.p1] = p1Score;
    gameState.scores[gameState.players.p2] = p2Score;

    // Check Win Condition (No neutral cells left)
    if (neutralCount === 0) {
        if (p1Score > p2Score) {
            gameState.winner = gameState.players.p1;
        } else if (p2Score > p1Score) {
            gameState.winner = gameState.players.p2;
        } else {
            gameState.isDraw = true;
        }

        gameState.scores[gameState.players.p1] = p1Score;
        gameState.scores[gameState.players.p2] = p2Score;

        handleMatchOver(io, roomId, gameState.isDraw ? null : gameState.winner, gameState.isDraw);
    }

    // Restart turn timer
    room.startTurnTimer(io);

    // Broadcast the updated state to both players
    io.to(roomId).emit('territory_sync', gameState);
};

module.exports = {
    initTerritoryState,
    handleTerritoryAction
};
