/**
 * JWT Authentication Middleware
 */

const jwt = require('jsonwebtoken');
const { users } = require('../utils/database');

const JWT_SECRET = process.env.JWT_SECRET || 'ninipanel-secret';

// Generate token
function generateToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

// Verify token middleware
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Token required' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = users.getById(decoded.id);

        if (!user) {
            return res.status(401).json({ success: false, message: 'User not found' });
        }

        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }
}

// Admin only middleware
function adminOnly(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    next();
}

// Optional auth (doesn't fail if no token)
function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            const user = users.getById(decoded.id);
            if (user) req.user = user;
        } catch (err) {
            // Ignore invalid token
        }
    }
    next();
}

module.exports = { generateToken, authenticate, adminOnly, optionalAuth };
