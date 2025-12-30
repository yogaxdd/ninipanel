/**
 * Files Routes
 * File manager for VPS containers
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { servers } = require('../utils/database');
const { authenticate } = require('../middleware/auth');
const containerManager = require('../services/container');

// Temp upload directory
const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'temp');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir });

// List files in directory
router.get('/:serverId', authenticate, async (req, res) => {
    try {
        const server = servers.getById(req.params.serverId);

        if (!server) {
            return res.status(404).json({ success: false, message: 'Server not found' });
        }

        if (req.user.role !== 'admin' && server.userId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const dirPath = req.query.path || '/root';

        let files = [];

        if (server.containerId) {
            files = await containerManager.listFiles(server.containerId, dirPath);
        } else {
            // Simulation mode
            files = [
                { name: 'public_html', type: 'directory', permissions: 'drwxr-xr-x', size: '-', modified: 'Dec 29 12:00' },
                { name: 'logs', type: 'directory', permissions: 'drwxr-xr-x', size: '-', modified: 'Dec 29 10:00' },
                { name: '.bashrc', type: 'file', permissions: '-rw-r--r--', size: '3.7K', modified: 'Dec 29 11:00' },
                { name: 'config.json', type: 'file', permissions: '-rw-r--r--', size: '1.2K', modified: 'Dec 29 14:30' }
            ];
        }

        res.json({ success: true, path: dirPath, files });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Read file content
router.get('/:serverId/read', authenticate, async (req, res) => {
    try {
        const server = servers.getById(req.params.serverId);

        if (!server) {
            return res.status(404).json({ success: false, message: 'Server not found' });
        }

        if (req.user.role !== 'admin' && server.userId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const filePath = req.query.path;
        if (!filePath) {
            return res.status(400).json({ success: false, message: 'Path required' });
        }

        let content = '';

        if (server.containerId) {
            content = await containerManager.exec(server.containerId, `cat "${filePath}" 2>/dev/null`);
        } else {
            // Simulation
            content = '# Simulation Mode\nThis is a simulated file content.';
        }

        res.json({ success: true, path: filePath, content });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Write file content
router.post('/:serverId/write', authenticate, async (req, res) => {
    try {
        const server = servers.getById(req.params.serverId);

        if (!server) {
            return res.status(404).json({ success: false, message: 'Server not found' });
        }

        if (req.user.role !== 'admin' && server.userId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const { path: filePath, content } = req.body;
        if (!filePath) {
            return res.status(400).json({ success: false, message: 'Path required' });
        }

        if (server.containerId) {
            // Write content to file
            const escapedContent = content.replace(/'/g, "'\\''");
            await containerManager.exec(server.containerId, `echo '${escapedContent}' > "${filePath}"`);
        }

        res.json({ success: true, message: 'File saved' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Create directory
router.post('/:serverId/mkdir', authenticate, async (req, res) => {
    try {
        const server = servers.getById(req.params.serverId);

        if (!server) {
            return res.status(404).json({ success: false, message: 'Server not found' });
        }

        if (req.user.role !== 'admin' && server.userId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const { path: dirPath } = req.body;
        if (!dirPath) {
            return res.status(400).json({ success: false, message: 'Path required' });
        }

        if (server.containerId) {
            await containerManager.exec(server.containerId, `mkdir -p "${dirPath}"`);
        }

        res.json({ success: true, message: 'Directory created' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Delete file/directory
router.delete('/:serverId', authenticate, async (req, res) => {
    try {
        const server = servers.getById(req.params.serverId);

        if (!server) {
            return res.status(404).json({ success: false, message: 'Server not found' });
        }

        if (req.user.role !== 'admin' && server.userId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const filePath = req.query.path;
        if (!filePath) {
            return res.status(400).json({ success: false, message: 'Path required' });
        }

        // Safety check
        if (filePath === '/' || filePath === '/root') {
            return res.status(400).json({ success: false, message: 'Cannot delete root directory' });
        }

        if (server.containerId) {
            await containerManager.exec(server.containerId, `rm -rf "${filePath}"`);
        }

        res.json({ success: true, message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Upload file
router.post('/:serverId/upload', authenticate, upload.single('file'), async (req, res) => {
    try {
        const server = servers.getById(req.params.serverId);

        if (!server) {
            return res.status(404).json({ success: false, message: 'Server not found' });
        }

        if (req.user.role !== 'admin' && server.userId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const destPath = req.body.path || '/root';
        const fileName = req.file.originalname;

        if (server.containerId) {
            // Copy file to container using docker cp
            const containerManager = require('../services/container');
            const docker = containerManager.getDocker();
            const container = docker.getContainer(server.containerId);

            const fileContent = fs.readFileSync(req.file.path);
            await container.putArchive(req.file.path, { path: destPath });
        }

        // Cleanup temp file
        fs.unlinkSync(req.file.path);

        res.json({ success: true, message: 'File uploaded' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
