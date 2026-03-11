const mongoose = require('mongoose');

const gameHistorySchema = new mongoose.Schema({
    gameType: {
        type: String,
        required: true,
        enum: ['tictactoe', 'drawing', 'territory']
    },
    players: [{
        type: String,
        required: true
    }],
    winner: {
        type: String,
        required: true, // username or 'Draw'
    },
    scores: {
        type: Map,
        of: Number,
        default: {} // Optional: specific to games like Territory Grid
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('GameHistory', gameHistorySchema);
