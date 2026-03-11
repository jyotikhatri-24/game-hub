const express = require('express');
const User = require('../models/User');

const router = express.Router();

const { redisClient } = require('../config/redis');

// GET /api/leaderboard
// Fetch top 50 users ranked by Elo rating
router.get('/', async (req, res) => {
    try {
        // 1. Try to get from Redis Cache first
        if (redisClient.isOpen) {
            const cachedData = await redisClient.get('leaderboard:top50');
            if (cachedData) {
                console.log('[DEBUG] Serving leaderboard from Redis cache');
                return res.json(JSON.parse(cachedData));
            }
        }

        // 2. Fallback to MongoDB
        const topPlayers = await User.find({}, 'username rating wins losses')
            .sort({ rating: -1 }) // Sort descending by rating
            .limit(50); // Top 50

        // 3. Store in Redis Cache for 5 minutes (300 seconds)
        if (redisClient.isOpen) {
            await redisClient.setEx('leaderboard:top50', 300, JSON.stringify(topPlayers));
            console.log('[DEBUG] Leaderboard cached to Redis');
        }

        res.json(topPlayers);
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({ message: 'Server error fetching leaderboard' });
    }
});

module.exports = router;
