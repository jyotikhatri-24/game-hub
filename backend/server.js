const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const historyRoutes = require('./routes/historyRoutes');
const leaderboardRoutes = require('./routes/leaderboardRoutes');
const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { redisClient, connectRedis } = require('./config/redis');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;
const connectDB = require('./config/db');

// Connect to Database
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Request logging for debugging
app.use((req, res, next) => {
    const start = Date.now();
    console.log(`[${new Date().toISOString()}] START ${req.method} ${req.url}`);
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[${new Date().toISOString()}] FINISH ${req.method} ${req.url} ${res.statusCode} (${duration}ms)`);
    });
    next();
});

// Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

// Test Endpoint for Load Testing
app.get('/api/test', (req, res) => {
    res.json({ message: 'Load test endpoint working' });
});

// Redis Setup (Scalability)
connectRedis();

// Rate Limiting (Prevent Abuse)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per `window`
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests from this IP, please try again after 15 minutes' }
});

// Apply rate limiter to all API routes
app.use('/api', limiter);

// Route logger
app.use('/api', (req, res, next) => {
    console.log(`[DEBUG] Entry: ${req.method} ${req.originalUrl}`);
    next();
});

// Auth Routes
app.use('/api/auth', require('./routes/authRoutes'));
// History Routes
app.use('/api/history', historyRoutes); // Added this line
// Leaderboard Routes
app.use('/api/leaderboard', leaderboardRoutes);

// Start Server
const http = require('http');
const { initSocket } = require('./socket/socketSetup');

const server = http.createServer(app);

// Initialize Socket.io
initSocket(server);

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
