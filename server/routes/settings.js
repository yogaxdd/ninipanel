/**
 * Settings Routes
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { settings, users, orders, servers, tickets } = require('../utils/database');
const { authenticate, adminOnly, optionalAuth } = require('../middleware/auth');

// Upload directory for QRIS
const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'qris');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, `qris${path.extname(file.originalname)}`)
});
const upload = multer({ storage });

// Get public settings (for ordering)
router.get('/public', optionalAuth, (req, res) => {
    const config = settings.getAll()[0] || {};

    res.json({
        success: true,
        settings: {
            siteName: config.siteName || 'NiniPanel',
            adminWhatsApp: config.adminWhatsApp || '',
            qrisImage: config.qrisImage || '',
            plans: config.plans || {}
        }
    });
});

// Get all settings (admin)
router.get('/', authenticate, adminOnly, (req, res) => {
    const config = settings.getAll()[0] || {};
    res.json({ success: true, settings: config });
});

// Update settings (admin)
router.put('/', authenticate, adminOnly, (req, res) => {
    try {
        const config = settings.getAll()[0];
        const { siteName, adminWhatsApp, plans } = req.body;

        const updates = {};
        if (siteName) updates.siteName = siteName;
        if (adminWhatsApp) updates.adminWhatsApp = adminWhatsApp;
        if (plans) updates.plans = plans;

        settings.update(config.id, updates);

        res.json({ success: true, message: 'Settings updated' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Upload QRIS image (admin)
router.post('/qris', authenticate, adminOnly, upload.single('qris'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const config = settings.getAll()[0];
        settings.update(config.id, {
            qrisImage: `/uploads/qris/${req.file.filename}`
        });

        res.json({ success: true, message: 'QRIS uploaded' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Get dashboard stats (admin)
router.get('/stats', authenticate, adminOnly, (req, res) => {
    const allUsers = users.getAll().filter(u => u.role !== 'admin');
    const allOrders = orders.getAll();
    const allServers = servers.getAll();
    const allTickets = tickets.getAll();

    const totalRevenue = allOrders
        .filter(o => o.status === 'active' || o.status === 'paid')
        .reduce((sum, o) => sum + (o.amount || 0), 0);

    res.json({
        success: true,
        stats: {
            totalUsers: allUsers.length,
            activeServers: allServers.filter(s => s.status === 'online').length,
            pendingOrders: allOrders.filter(o => o.status === 'pending' || o.status === 'pending_verification').length,
            totalRevenue,
            openTickets: allTickets.filter(t => t.status === 'open').length
        }
    });
});

module.exports = router;
