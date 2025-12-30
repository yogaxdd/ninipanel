/**
 * Backup Routes
 * Manage server backups
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { servers, backups } = require('../utils/database');
const { authenticate } = require('../middleware/auth');
const containerManager = require('../services/container');

// Backup storage directory
const BACKUP_DIR = path.join(__dirname, '..', 'data', 'backups');
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Get all backups for a server
router.get('/server/:serverId', authenticate, async (req, res) => {
    try {
        const server = servers.getById(req.params.serverId);

        if (!server) {
            return res.status(404).json({ success: false, message: 'Server not found' });
        }

        if (req.user.role !== 'admin' && server.userId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const serverBackups = backups.findAllBy('serverId', req.params.serverId);

        // Sort by date descending
        serverBackups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json({ success: true, backups: serverBackups });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Create new backup
router.post('/server/:serverId', authenticate, async (req, res) => {
    try {
        const server = servers.getById(req.params.serverId);

        if (!server) {
            return res.status(404).json({ success: false, message: 'Server not found' });
        }

        if (req.user.role !== 'admin' && server.userId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const { name } = req.body;
        const backupName = name || `backup-${new Date().toISOString().slice(0, 10)}`;
        const filename = `${server.id}-${Date.now()}.tar.gz`;
        const filepath = path.join(BACKUP_DIR, filename);

        // Create backup record
        const backup = backups.create({
            serverId: server.id,
            userId: server.userId,
            name: backupName,
            filename,
            filepath,
            size: 0,
            status: 'creating'
        });

        // If container exists, create actual backup
        if (server.containerId) {
            try {
                const size = await containerManager.createBackup(server.containerId, filepath);
                backups.update(backup.id, {
                    status: 'completed',
                    size,
                    completedAt: new Date().toISOString()
                });
            } catch (err) {
                backups.update(backup.id, { status: 'failed', error: err.message });
            }
        } else {
            // Simulation mode - create a dummy backup
            const dummySize = Math.floor(Math.random() * 50 + 10) * 1024 * 1024; // 10-60 MB
            backups.update(backup.id, {
                status: 'completed',
                size: dummySize,
                simulation: true,
                completedAt: new Date().toISOString()
            });
        }

        res.json({ success: true, message: 'Backup created', backup: backups.getById(backup.id) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Download backup
router.get('/:id/download', authenticate, async (req, res) => {
    try {
        const backup = backups.getById(req.params.id);

        if (!backup) {
            return res.status(404).json({ success: false, message: 'Backup not found' });
        }

        const server = servers.getById(backup.serverId);
        if (req.user.role !== 'admin' && server?.userId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        if (backup.simulation) {
            // Simulation mode - return a dummy file info
            return res.json({
                success: true,
                message: 'Simulation mode - no actual file',
                backup
            });
        }

        if (!fs.existsSync(backup.filepath)) {
            return res.status(404).json({ success: false, message: 'Backup file not found' });
        }

        res.download(backup.filepath, backup.filename);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Restore from backup
router.post('/:id/restore', authenticate, async (req, res) => {
    try {
        const backup = backups.getById(req.params.id);

        if (!backup) {
            return res.status(404).json({ success: false, message: 'Backup not found' });
        }

        const server = servers.getById(backup.serverId);
        if (!server) {
            return res.status(404).json({ success: false, message: 'Server not found' });
        }

        if (req.user.role !== 'admin' && server.userId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        if (backup.status !== 'completed') {
            return res.status(400).json({ success: false, message: 'Backup is not completed' });
        }

        // Restore backup
        if (server.containerId && !backup.simulation) {
            try {
                await containerManager.restoreBackup(server.containerId, backup.filepath);
            } catch (err) {
                return res.status(500).json({ success: false, message: 'Restore failed: ' + err.message });
            }
        }

        res.json({ success: true, message: 'Backup restored successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Delete backup
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const backup = backups.getById(req.params.id);

        if (!backup) {
            return res.status(404).json({ success: false, message: 'Backup not found' });
        }

        const server = servers.getById(backup.serverId);
        if (req.user.role !== 'admin' && server?.userId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        // Delete file if exists
        if (fs.existsSync(backup.filepath)) {
            fs.unlinkSync(backup.filepath);
        }

        backups.delete(backup.id);

        res.json({ success: true, message: 'Backup deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
