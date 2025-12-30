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
        const { plan, duration, notes, customRam, customDisk } = req.body;

        const durationLabels = { daily: '1 Hari', weekly: '7 Hari', monthly: '30 Hari' };

        let planName, ram, disk, cpu, amount;

        if (plan === 'custom') {
            // Custom plan - price is Rp 25 per MB RAM per month
            ram = parseInt(customRam) || 100;
            disk = parseInt(customDisk) || 500;
            cpu = Math.ceil(ram / 100); // 1 CPU per 100MB RAM

            // Calculate price: Rp 25 per MB RAM per month
            const monthlyPrice = ram * 25;
            const prices = {
                daily: Math.ceil(monthlyPrice / 30),
                weekly: Math.ceil(monthlyPrice / 4),
                monthly: monthlyPrice
            };
            amount = prices[duration] || prices.monthly;
            planName = `Custom (${ram}MB RAM)`;
        } else {
            // Get plan details from settings
            const config = settings.getAll()[0];
            const planDetails = config?.plans?.[plan];

            if (!planDetails) {
                return res.status(400).json({ success: false, message: 'Invalid plan' });
            }

            planName = planDetails.name;
            ram = planDetails.ram;
            disk = planDetails.disk;
            cpu = planDetails.cpu;
            amount = planDetails[duration] || planDetails.daily;
        }

        const order = orders.create({
            userId: req.user.id,
            customerName: req.user.name,
            customerEmail: req.user.email,
            customerPhone: req.user.phone || '',
            plan,
            planName,
            duration,
            durationLabel: durationLabels[duration] || '1 Hari',
            ram,
            disk,
            cpu,
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

// Verify order (admin only) - Creates server + container on approval
router.put('/:id/verify', authenticate, adminOnly, async (req, res) => {
    try {
        const { action } = req.body; // 'approve' or 'reject'
        const order = orders.getById(req.params.id);

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (action === 'approve') {
            orders.update(order.id, { status: 'active' });

            // Auto-create server with Docker container
            const containerManager = require('../services/container');
            const { servers } = require('../utils/database');

            // Calculate expiry
            const durationDays = { daily: 1, weekly: 7, monthly: 30 };
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + (durationDays[order.duration] || 1));

            // Create server record
            const serverData = {
                userId: order.userId,
                orderId: order.id,
                name: `VPS-${order.id.substring(0, 6).toUpperCase()}`,
                plan: order.plan,
                planName: order.planName,
                ram: order.ram,
                disk: order.disk,
                cpu: order.cpu,
                status: 'creating',
                expiresAt: expiresAt.toISOString()
            };

            const server = servers.create(serverData);

            // Create Docker container
            const dockerAvailable = await containerManager.isAvailable();

            if (dockerAvailable) {
                try {
                    const containerId = await containerManager.createContainer(
                        server.id,
                        order.plan,
                        server.name,
                        order.ram,
                        order.disk
                    );

                    servers.update(server.id, {
                        containerId,
                        status: 'online',
                        ip: '127.0.0.1'
                    });
                } catch (err) {
                    console.error('Docker error:', err.message);
                    servers.update(server.id, { status: 'error', error: err.message });
                }
            } else {
                // Simulation mode
                servers.update(server.id, {
                    status: 'online',
                    ip: `192.168.1.${Math.floor(Math.random() * 254) + 1}`,
                    simulation: true
                });
            }

            res.json({
                success: true,
                message: 'Order approved and server created',
                order: orders.getById(order.id),
                server: servers.getById(server.id)
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
