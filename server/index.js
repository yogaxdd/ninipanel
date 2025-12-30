/**
 * NiniPanel Backend Server
 * Production-ready Express server with Docker integration
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const expressWs = require('express-ws');

const app = express();
expressWs(app);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..')));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/servers', require('./routes/servers'));
app.use('/api/files', require('./routes/files'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/terminal', require('./routes/terminal'));
app.use('/api/startup', require('./routes/startup'));
app.use('/api/backups', require('./routes/backups'));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error'
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════╗
║         NiniPanel Server v1.0            ║
╠══════════════════════════════════════════╣
║  🚀 Server running on port ${PORT}            ║
║  📁 Frontend: http://localhost:${PORT}        ║
║  🔌 API: http://localhost:${PORT}/api         ║
╚══════════════════════════════════════════╝
  `);
});

module.exports = app;
