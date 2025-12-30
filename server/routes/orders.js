/**
 * Orders Routes
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { orders, settings } = require('../utils/database');
const { authenticate, adminOnly } = require('../middleware/auth');

// Setup upload directory
const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'proofs');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer config
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `proof-${Date.now()}${ext}`);
    }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Get all orders (admin) or user's orders
router.get('/', authenticate, (req, res) => {
    let result;
    if (req.user.role === 'admin') {
        result = orders.getAll();
    } else {
        result = orders.findAllBy('userId', req.user.id);
    }

    // Sort by date desc
    result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ success: true, orders: result });
});

// Get single order
router.get('/:id', authenticate, (req, res) => {
    const order = orders.getById(req.params.id);

    if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Check ownership
    if (req.user.role !== 'admin' && order.userId !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.json({ success: true, order });
});

// Create order
router.post('/', authenticate, (req, res) => {
    try {
        const { plan, duration, notes } = req.body;

        // Get plan details from settings
        const config = settings.getAll()[0];
        const planDetails = config?.plans?.[plan];

        if (!planDetails) {
            return res.status(400).json({ success: false, message: 'Invalid plan' });
        }

        const durationLabels = { daily: '1 Hari', weekly: '7 Hari', monthly: '30 Hari' };
        const amount = planDetails[duration] || planDetails.daily;

        const order = orders.create({
            userId: req.user.id,
            customerName: req.user.name,
            customerEmail: req.user.email,
            customerPhone: req.user.phone,
            plan,
            planName: planDetails.name,
            duration,
            durationLabel: durationLabels[duration] || '1 Hari',
            ram: planDetails.ram,
            disk: planDetails.disk,
            cpu: planDetails.cpu,
            amount,
            status: 'pending',
            notes: notes || ''
        });

        res.json({ success: true, message: 'Order created', order });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Upload payment proof
router.post('/:id/proof', authenticate, upload.single('proof'), (req, res) => {
    try {
        const order = orders.getById(req.params.id);

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.userId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        // Update order
        orders.update(order.id, {
            status: 'pending_verification',
            paymentProof: `/uploads/proofs/${req.file.filename}`,
            paymentDate: new Date().toISOString()
        });

        res.json({ success: true, message: 'Payment proof uploaded' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Verify order (admin only)
router.put('/:id/verify', authenticate, adminOnly, (req, res) => {
    try {
        const { action } = req.body; // 'approve' or 'reject'
        const order = orders.getById(req.params.id);

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (action === 'approve') {
            orders.update(order.id, { status: 'active' });

            // Server will be created by servers route
            res.json({
                success: true,
                message: 'Order approved',
                order: orders.getById(order.id)
            });
        } else {
            orders.update(order.id, { status: 'cancelled' });
            res.json({ success: true, message: 'Order rejected' });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Cancel order
router.delete('/:id', authenticate, (req, res) => {
    try {
        const order = orders.getById(req.params.id);

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (req.user.role !== 'admin' && order.userId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        if (order.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'Cannot cancel this order' });
        }

        orders.update(order.id, { status: 'cancelled' });

        res.json({ success: true, message: 'Order cancelled' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
