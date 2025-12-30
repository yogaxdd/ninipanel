/**
 * Startup Configuration Routes
 * Manage server startup settings
 */

const express = require('express');
const router = express.Router();
const { servers, startupConfigs } = require('../utils/database');
const { authenticate } = require('../middleware/auth');

// Get startup config for a server
router.get('/:serverId', authenticate, async (req, res) => {
    try {
        const server = servers.getById(req.params.serverId);

        if (!server) {
            return res.status(404).json({ success: false, message: 'Server not found' });
        }

        if (req.user.role !== 'admin' && server.userId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        // Get or create default startup config
        let config = startupConfigs.findBy('serverId', req.params.serverId);

        if (!config) {
            config = {
                serverId: req.params.serverId,
                startupCommand: 'npm start',
                dockerImage: 'node:18-alpine',
                envVariables: [],
                gitRepo: '',
                gitBranch: 'main',
                gitUsername: '',
                gitToken: '',
                commandRun: 'npm start'
            };
        }

        res.json({ success: true, config });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Update startup config
router.put('/:serverId', authenticate, async (req, res) => {
    try {
        const server = servers.getById(req.params.serverId);

        if (!server) {
            return res.status(404).json({ success: false, message: 'Server not found' });
        }

        if (req.user.role !== 'admin' && server.userId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const { startupCommand, dockerImage, envVariables, gitRepo, gitBranch, gitUsername, gitToken, commandRun } = req.body;

        let config = startupConfigs.findBy('serverId', req.params.serverId);

        const configData = {
            serverId: req.params.serverId,
            startupCommand: startupCommand || '',
            dockerImage: dockerImage || 'node:18-alpine',
            envVariables: envVariables || [],
            gitRepo: gitRepo || '',
            gitBranch: gitBranch || 'main',
            gitUsername: gitUsername || '',
            gitToken: gitToken || '',
            commandRun: commandRun || 'npm start'
        };

        if (config) {
            config = startupConfigs.update(config.id, configData);
        } else {
            config = startupConfigs.create(configData);
        }

        res.json({ success: true, message: 'Startup config updated', config });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Get available Docker images
router.get('/:serverId/images', authenticate, (req, res) => {
    const images = [
        { id: 'node:18-alpine', name: 'NodeJS (Versi 18)' },
        { id: 'node:20-alpine', name: 'NodeJS (Versi 20)' },
        { id: 'python:3.11-alpine', name: 'Python (Versi 3.11)' },
        { id: 'python:3.12-alpine', name: 'Python (Versi 3.12)' },
        { id: 'golang:1.21-alpine', name: 'Golang (Versi 1.21)' },
        { id: 'php:8.2-alpine', name: 'PHP (Versi 8.2)' },
        { id: 'ruby:3.2-alpine', name: 'Ruby (Versi 3.2)' },
        { id: 'alpine:latest', name: 'Alpine Linux' },
        { id: 'ubuntu:22.04', name: 'Ubuntu 22.04' }
    ];

    res.json({ success: true, images });
});

module.exports = router;
