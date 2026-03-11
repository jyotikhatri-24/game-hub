const express = require('express');
const router = express.Router();
const GameHistory = require('../models/GameHistory');
const { protect } = require('../middleware/authMiddleware');

// @route   GET /api/history
// @desc    Get game history for the logged in user
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        const username = req.user.username;

        // Find all games where this user was one of the players
        const history = await GameHistory.find({
            players: username
        }).sort({ createdAt: -1 }); // Newest first

        res.json(history);
    } catch (error) {
        console.error('Error fetching game history:', error);
        res.status(500).json({ message: 'Server error fetching game history' });
    }
});

// @route   GET /api/history/recent
// @desc    Get last 10 global matches (cached)
// @access  Public
router.get('/recent', async (req, res) => {
    try {
        const { redisClient } = require('../config/redis');

        // 1. Check Cache
        if (redisClient.isOpen) {
            const cached = await redisClient.get('history:recent');
            if (cached) return res.json(JSON.parse(cached));
        }

        // 2. Query DB
        const recentMatches = await GameHistory.find()
            .sort({ createdAt: -1 })
            .limit(10);

        // 3. Cache Result (60 seconds)
        if (redisClient.isOpen) {
            await redisClient.setEx('history:recent', 60, JSON.stringify(recentMatches));
        }

        res.json(recentMatches);
    } catch (error) {
        console.error('Error fetching recent matches:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
