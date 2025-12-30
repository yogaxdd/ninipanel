/**
 * Authentication Routes
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { users } = require('../utils/database');
const { generateToken, authenticate } = require('../middleware/auth');

// Register
router.post('/register', async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: 'Name, email, and password required' });
        }

        // Check if email exists
        if (users.findBy('email', email.toLowerCase())) {
            return res.status(400).json({ success: false, message: 'Email already registered' });
        }

        // Create user
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = users.create({
            name,
            email: email.toLowerCase(),
            phone: phone || '',
            password: hashedPassword,
            role: 'user'
        });

        // Generate token
        const token = generateToken(user);

        res.json({
            success: true,
            message: 'Registration successful',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password required' });
        }

        // Find user
        const user = users.findBy('email', email.toLowerCase());
        if (!user) {
            return res.status(401).json({ success: false, message: 'Email not found' });
        }

        // Check password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ success: false, message: 'Invalid password' });
        }

        // Generate token
        const token = generateToken(user);

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Get current user
router.get('/me', authenticate, (req, res) => {
    res.json({
        success: true,
        user: {
            id: req.user.id,
            name: req.user.name,
            email: req.user.email,
            phone: req.user.phone,
            role: req.user.role
        }
    });
});

// Update profile
router.put('/me', authenticate, async (req, res) => {
    try {
        const { name, phone } = req.body;

        const updated = users.update(req.user.id, { name, phone });

        res.json({
            success: true,
            message: 'Profile updated',
            user: {
                id: updated.id,
                name: updated.name,
                email: updated.email,
                phone: updated.phone,
                role: updated.role
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Change password
router.put('/password', authenticate, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        // Verify current password
        const validPassword = await bcrypt.compare(currentPassword, req.user.password);
        if (!validPassword) {
            return res.status(400).json({ success: false, message: 'Current password is incorrect' });
        }

        // Update password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        users.update(req.user.id, { password: hashedPassword });

        res.json({ success: true, message: 'Password changed successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
