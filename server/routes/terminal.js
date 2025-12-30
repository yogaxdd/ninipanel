/**
 * Terminal WebSocket Route
 * Real-time terminal access to containers
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { servers, users } = require('../utils/database');
const containerManager = require('../services/container');

const JWT_SECRET = process.env.JWT_SECRET || 'ninipanel-secret';

// WebSocket terminal endpoint
router.ws('/:serverId', async (ws, req) => {
    const { serverId } = req.params;
    const token = req.query.token;

    // Verify token
    let user;
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        user = users.getById(decoded.id);
        if (!user) throw new Error('User not found');
    } catch (err) {
        ws.send(JSON.stringify({ type: 'error', message: 'Authentication failed' }));
        ws.close();
        return;
    }

    // Get server
    const server = servers.getById(serverId);
    if (!server) {
        ws.send(JSON.stringify({ type: 'error', message: 'Server not found' }));
        ws.close();
        return;
    }

    // Check access
    if (user.role !== 'admin' && server.userId !== user.id) {
        ws.send(JSON.stringify({ type: 'error', message: 'Access denied' }));
        ws.close();
        return;
    }

    // Check if server is online
    if (server.status !== 'online') {
        ws.send(JSON.stringify({ type: 'error', message: 'Server is offline' }));
        ws.close();
        return;
    }

    // Welcome message
    ws.send(JSON.stringify({
        type: 'output',
        data: `\r\n\x1b[32mConnected to ${server.name}\x1b[0m\r\n`
    }));
    ws.send(JSON.stringify({
        type: 'output',
        data: `\x1b[33mPlan: ${server.planName} | RAM: ${server.ram}MB | CPU: ${server.cpu}\x1b[0m\r\n\r\n`
    }));

    // If real container exists
    if (server.containerId) {
        try {
            const docker = containerManager.getDocker();
            const container = docker.getContainer(server.containerId);

            // Create exec for interactive shell
            const exec = await container.exec({
                Cmd: ['/bin/sh'],
                AttachStdin: true,
                AttachStdout: true,
                AttachStderr: true,
                Tty: true
            });

            const stream = await exec.start({ hijack: true, stdin: true, Tty: true });

            // Stream output to websocket
            stream.on('data', (chunk) => {
                ws.send(JSON.stringify({ type: 'output', data: chunk.toString() }));
            });

            // Handle websocket messages
            ws.on('message', (msg) => {
                try {
                    const data = JSON.parse(msg);
                    if (data.type === 'input') {
                        stream.write(data.data);
                    } else if (data.type === 'resize') {
                        exec.resize({ h: data.rows, w: data.cols });
                    }
                } catch (err) {
                    console.error('WS message error:', err.message);
                }
            });

            // Cleanup on close
            ws.on('close', () => {
                stream.end();
            });

        } catch (err) {
            ws.send(JSON.stringify({ type: 'error', message: 'Failed to attach to container' }));
            console.error('Terminal error:', err.message);
        }
    } else {
        // Simulation mode - echo commands
        ws.send(JSON.stringify({
            type: 'output',
            data: '\x1b[36m[Simulation Mode - No real container]\x1b[0m\r\n\r\nroot@vps:~# '
        }));

        let commandBuffer = '';

        ws.on('message', (msg) => {
            try {
                const data = JSON.parse(msg);
                if (data.type === 'input') {
                    const char = data.data;

                    if (char === '\r' || char === '\n') {
                        // Execute command
                        const output = simulateCommand(commandBuffer.trim());
                        ws.send(JSON.stringify({ type: 'output', data: '\r\n' + output + '\r\nroot@vps:~# ' }));
                        commandBuffer = '';
                    } else if (char === '\x7f') {
                        // Backspace
                        if (commandBuffer.length > 0) {
                            commandBuffer = commandBuffer.slice(0, -1);
                            ws.send(JSON.stringify({ type: 'output', data: '\b \b' }));
                        }
                    } else {
                        // Regular character
                        commandBuffer += char;
                        ws.send(JSON.stringify({ type: 'output', data: char }));
                    }
                }
            } catch (err) {
                console.error('WS message error:', err.message);
            }
        });
    }
});

// Simulate command output
function simulateCommand(cmd) {
    const commands = {
        'ls': 'public_html  logs  .bashrc  .profile  config.json',
        'pwd': '/root',
        'whoami': 'root',
        'date': new Date().toString(),
        'uptime': ' 12:00:00 up 5 days,  2:30,  1 user,  load average: 0.08, 0.03, 0.01',
        'free -m': '              total        used        free\nMem:           100          40          60\nSwap:            0           0           0',
        'df -h': 'Filesystem      Size  Used Avail Use% Mounted on\n/dev/vda1       500M  100M  400M  20% /',
        'clear': '\x1b[2J\x1b[H',
        'help': 'Available commands: ls, pwd, whoami, date, uptime, free, df, clear, echo',
        '': ''
    };

    if (cmd.startsWith('echo ')) {
        return cmd.substring(5);
    }

    if (cmd.startsWith('cat ')) {
        return 'cat: Permission denied (simulation mode)';
    }

    return commands[cmd] || `sh: ${cmd}: command not found`;
}

module.exports = router;
