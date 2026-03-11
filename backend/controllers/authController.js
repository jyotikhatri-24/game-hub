const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'fallback_secret', {
        expiresIn: '30d',
    });
};

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
    console.log('[AUTH] Registering user:', req.body.username, req.body.email);
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            console.log('[AUTH] Missing fields');
            return res.status(400).json({ message: 'Please add all fields' });
        }

        // Check if user exists
        console.time('[AUTH] User existence check');
        const userExists = await User.findOne({ $or: [{ email }, { username }] });
        console.timeEnd('[AUTH] User existence check');

        if (userExists) {
            const field = userExists.email === email ? 'Email' : 'Username';
            return res.status(400).json({ message: `${field} already exists` });
        }

        // Hash password
        console.time('[AUTH] Password hashing');
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        console.timeEnd('[AUTH] Password hashing');

        // Create user
        console.time('[AUTH] User creation in DB');
        const user = await User.create({
            username,
            email,
            password: hashedPassword,
        });
        console.timeEnd('[AUTH] User creation in DB');

        if (user) {
            res.status(201).json({
                _id: user.id,
                username: user.username,
                email: user.email,
                token: generateToken(user._id),
            });
        } else {
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        console.error('[AUTH ERROR] Registration failed:', error);
        res.status(500).json({ message: 'Server Error: ' + error.message });
    }
};

// @desc    Authenticate a user
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check for user email
        const user = await User.findOne({ email });

        if (user && (await bcrypt.compare(password, user.password))) {
            res.json({
                _id: user.id,
                username: user.username,
                email: user.email,
                token: generateToken(user._id),
            });
        } else {
            res.status(401).json({ message: 'Invalid credentials' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get user data
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
    try {
        // req.user is set in authMiddleware
        res.status(200).json({
            id: req.user.id,
            username: req.user.username,
            email: req.user.email,
            wins: req.user.wins,
            losses: req.user.losses,
            rating: req.user.rating
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = {
    registerUser,
    loginUser,
    getMe,
};
