/**
 * Tickets Routes
 */

const express = require('express');
const router = express.Router();
const { tickets, users } = require('../utils/database');
const { authenticate, adminOnly } = require('../middleware/auth');

// Get all tickets (admin) or user's tickets
router.get('/', authenticate, (req, res) => {
    let result;
    if (req.user.role === 'admin') {
        result = tickets.getAll();
    } else {
        result = tickets.findAllBy('userId', req.user.id);
    }

    result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ success: true, tickets: result });
});

// Get single ticket
router.get('/:id', authenticate, (req, res) => {
    const ticket = tickets.getById(req.params.id);

    if (!ticket) {
        return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    if (req.user.role !== 'admin' && ticket.userId !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.json({ success: true, ticket });
});

// Create ticket
router.post('/', authenticate, (req, res) => {
    try {
        const { category, subject, message } = req.body;

        if (!category || !subject || !message) {
            return res.status(400).json({ success: false, message: 'All fields required' });
        }

        const ticket = tickets.create({
            userId: req.user.id,
            category,
            subject,
            status: 'open',
            messages: [{
                sender: 'user',
                senderName: req.user.name,
                content: message,
                createdAt: new Date().toISOString()
            }]
        });

        res.json({ success: true, message: 'Ticket created', ticket });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Add message to ticket
router.post('/:id/message', authenticate, (req, res) => {
    try {
        const ticket = tickets.getById(req.params.id);

        if (!ticket) {
            return res.status(404).json({ success: false, message: 'Ticket not found' });
        }

        if (req.user.role !== 'admin' && ticket.userId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ success: false, message: 'Message required' });
        }

        const messages = ticket.messages || [];
        messages.push({
            sender: req.user.role === 'admin' ? 'admin' : 'user',
            senderName: req.user.name,
            content: message,
            createdAt: new Date().toISOString()
        });

        tickets.update(ticket.id, {
            messages,
            status: req.user.role === 'admin' ? 'replied' : 'open'
        });

        res.json({ success: true, message: 'Message added' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Close ticket
router.put('/:id/close', authenticate, (req, res) => {
    try {
        const ticket = tickets.getById(req.params.id);

        if (!ticket) {
            return res.status(404).json({ success: false, message: 'Ticket not found' });
        }

        if (req.user.role !== 'admin' && ticket.userId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        tickets.update(ticket.id, { status: 'closed' });

        res.json({ success: true, message: 'Ticket closed' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Delete ticket (admin only)
router.delete('/:id', authenticate, adminOnly, (req, res) => {
    try {
        const ticket = tickets.getById(req.params.id);

        if (!ticket) {
            return res.status(404).json({ success: false, message: 'Ticket not found' });
        }

        tickets.delete(ticket.id);

        res.json({ success: true, message: 'Ticket deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
