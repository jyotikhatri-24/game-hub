/**
 * Calculates new Elo ratings for two players after a match.
 * 
 * @param {number} rating1 - Player 1's current rating
 * @param {number} rating2 - Player 2's current rating
 * @param {number} score1 - Player 1's score (1 for win, 0.5 for draw, 0 for loss)
 * @param {number} score2 - Player 2's score (1 for win, 0.5 for draw, 0 for loss)
 * @param {number} kFactor - The K-factor determines how much ratings change (default 32)
 * @returns {Object} An object containing the new ratings: { newRating1, newRating2, change1, change2 }
 */
const calculateElo = (rating1, rating2, score1, score2, kFactor = 32) => {
    // Calculate expected scores
    const expected1 = 1 / (1 + Math.pow(10, (rating2 - rating1) / 400));
    const expected2 = 1 / (1 + Math.pow(10, (rating1 - rating2) / 400));

    // Calculate rating changes
    const change1 = Math.round(kFactor * (score1 - expected1));
    const change2 = Math.round(kFactor * (score2 - expected2));

    return {
        newRating1: Math.max(0, rating1 + change1), // Prevent negative ratings, though unlikely
        newRating2: Math.max(0, rating2 + change2),
        change1,
        change2
    };
};

module.exports = { calculateElo };
