const GameHistory = require('../models/GameHistory');
const User = require('../models/User');
const { calculateElo } = require('./eloHelper');

/**
 * Saves a completed game to the MongoDB database.
 * 
 * @param {string} gameType - 'tictactoe', 'drawing', or 'territory'
 * @param {Array<string>} players - Array of usernames who played
 * @param {string} winner - Username of the winner, or 'Draw'
 * @param {Object} [scores] - Optional scores mapping (e.g. for Territory Grid)
 */
const saveGameHistory = async (gameType, players, winner, scores = {}) => {
    try {
        const history = new GameHistory({
            gameType,
            players,
            winner,
            scores
        });

        await history.save();
        console.log(`[GameHistory] Saved ${gameType} match. Winner: ${winner}`);
        // --- Stat Updating Logic ---
        // Only attempt to update stats if exactly 2 players are involved (standard 1v1 matchmaking)
        if (players.length === 2 && winner) {
            const user1 = await User.findOne({ username: players[0] });
            const user2 = await User.findOne({ username: players[1] });

            if (user1 && user2) {
                let score1, score2;

                if (winner === 'Draw') {
                    score1 = 0.5;
                    score2 = 0.5;
                } else if (winner === user1.username) {
                    score1 = 1;
                    score2 = 0;
                    user1.wins += 1;
                    user2.losses += 1;
                } else if (winner === user2.username) {
                    score1 = 0;
                    score2 = 1;
                    user1.losses += 1;
                    user2.wins += 1;
                }

                // Calculate Elo
                if (score1 !== undefined && score2 !== undefined) {
                    const eloResult = calculateElo(user1.rating, user2.rating, score1, score2);

                    user1.rating = eloResult.newRating1;
                    user2.rating = eloResult.newRating2;

                    await user1.save();
                    await user2.save();
                    console.log(`[GameHistory] Updated Stats - ${user1.username}: ${user1.rating} (Change: ${eloResult.change1 < 0 ? '' : '+'}${eloResult.change1}), ${user2.username}: ${user2.rating} (Change: ${eloResult.change2 < 0 ? '' : '+'}${eloResult.change2})`);
                }
            }
        }

    } catch (error) {
        console.error(`[GameHistory] Error saving match to DB:`, error);
    }
};

module.exports = { saveGameHistory };
