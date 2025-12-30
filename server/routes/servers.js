/**
 * Servers Routes
 * Manage VPS containers
 */

const express = require('express');
const router = express.Router();
const { servers, orders, users, settings } = require('../utils/database');
const { authenticate, adminOnly } = require('../middleware/auth');
const containerManager = require('../services/container');

// Get all servers (admin) or user's servers
router.get('/', authenticate, async (req, res) => {
    try {
        let result;
        if (req.user.role === 'admin') {
            result = servers.getAll();
        } else {
            result = servers.findAllBy('userId', req.user.id);
        }

        // Get live status for each server
        for (const server of result) {
            if (server.containerId) {
                const status = await containerManager.getContainerStatus(server.containerId);
                server.status = status.running ? 'online' : 'offline';
            }
        }

        res.json({ success: true, servers: result });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Get single server
router.get('/:id', authenticate, async (req, res) => {
    try {
        const server = servers.getById(req.params.id);

        if (!server) {
            return res.status(404).json({ success: false, message: 'Server not found' });
        }

        if (req.user.role !== 'admin' && server.userId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        // Get live status
        if (server.containerId) {
            const status = await containerManager.getContainerStatus(server.containerId);
            server.status = status.running ? 'online' : 'offline';

            // Get stats if running
            if (status.running) {
                server.stats = await containerManager.getContainerStats(server.containerId);
            }
        }

        res.json({ success: true, server });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Create server from order (admin only)
router.post('/', authenticate, adminOnly, async (req, res) => {
    try {
        const { orderId } = req.body;

        const order = orders.getById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.status !== 'active') {
            return res.status(400).json({ success: false, message: 'Order not approved yet' });
        }

        // Check if server already exists for this order
        if (servers.findBy('orderId', orderId)) {
            return res.status(400).json({ success: false, message: 'Server already exists for this order' });
        }

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

        // Check if Docker is available
        const dockerAvailable = await containerManager.isAvailable();

        if (dockerAvailable) {
            // Create Docker container
            try {
                const containerId = await containerManager.createContainer(
                    server.id,
                    order.plan,
                    server.name,
                    order.ram,  // Pass RAM for custom plans
                    order.disk  // Pass disk for custom plans
                );

                // Container is already started in createContainer
                servers.update(server.id, {
                    containerId,
                    status: 'online',
                    ip: '127.0.0.1' // Would be dynamic in production
                });
            } catch (err) {
                console.error('Docker error:', err.message);
                servers.update(server.id, { status: 'error', error: err.message });
            }
        } else {
            // No Docker - simulation mode
            servers.update(server.id, {
                status: 'online',
                ip: `192.168.1.${Math.floor(Math.random() * 254) + 1}`,
                simulation: true
            });
        }

        res.json({ success: true, message: 'Server created', server: servers.getById(server.id) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Start server
router.post('/:id/start', authenticate, async (req, res) => {
    try {
        const server = servers.getById(req.params.id);

        if (!server) {
            return res.status(404).json({ success: false, message: 'Server not found' });
        }

        if (req.user.role !== 'admin' && server.userId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        if (server.containerId) {
            await containerManager.startContainer(server.containerId);
        }

        servers.update(server.id, { status: 'online' });

        res.json({ success: true, message: 'Server started' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Stop server
router.post('/:id/stop', authenticate, async (req, res) => {
    try {
        const server = servers.getById(req.params.id);

        if (!server) {
            return res.status(404).json({ success: false, message: 'Server not found' });
        }

        if (req.user.role !== 'admin' && server.userId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        if (server.containerId) {
            await containerManager.stopContainer(server.containerId);
        }

        servers.update(server.id, { status: 'offline' });

        res.json({ success: true, message: 'Server stopped' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Restart server
router.post('/:id/restart', authenticate, async (req, res) => {
    try {
        const server = servers.getById(req.params.id);

        if (!server) {
            return res.status(404).json({ success: false, message: 'Server not found' });
        }

        if (req.user.role !== 'admin' && server.userId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        if (server.containerId) {
            await containerManager.restartContainer(server.containerId);
        }

        servers.update(server.id, { status: 'online' });

        res.json({ success: true, message: 'Server restarted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Delete server (admin only)
router.delete('/:id', authenticate, adminOnly, async (req, res) => {
    try {
        const server = servers.getById(req.params.id);

        if (!server) {
            return res.status(404).json({ success: false, message: 'Server not found' });
        }

        // Delete container if exists
        if (server.containerId) {
            await containerManager.deleteContainer(server.containerId);
        }

        servers.delete(server.id);

        res.json({ success: true, message: 'Server deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Get server stats
router.get('/:id/stats', authenticate, async (req, res) => {
    try {
        const server = servers.getById(req.params.id);

        if (!server) {
            return res.status(404).json({ success: false, message: 'Server not found' });
        }

        if (req.user.role !== 'admin' && server.userId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        let stats = { cpu: 0, memory: { used: 0, limit: 0, percent: 0 } };

        if (server.containerId) {
            stats = await containerManager.getContainerStats(server.containerId);
        } else {
            // Simulation mode
            stats = {
                cpu: Math.random() * 30 + 5,
                memory: {
                    used: server.ram * 0.4 * 1024 * 1024,
                    limit: server.ram * 1024 * 1024,
                    percent: 40 + Math.random() * 20
                }
            };
        }

        res.json({ success: true, stats });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
