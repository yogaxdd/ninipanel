/**
 * JSON File Database
 * Simple file-based database for NiniPanel
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.join(__dirname, '..', 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

class Database {
    constructor(name) {
        this.name = name;
        this.filePath = path.join(DATA_DIR, `${name}.json`);
        this.data = this.load();
    }

    load() {
        try {
            if (fs.existsSync(this.filePath)) {
                const content = fs.readFileSync(this.filePath, 'utf8');
                return JSON.parse(content);
            }
        } catch (err) {
            console.error(`Error loading ${this.name}:`, err.message);
        }
        return [];
    }

    save() {
        try {
            fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
            return true;
        } catch (err) {
            console.error(`Error saving ${this.name}:`, err.message);
            return false;
        }
    }

    // Get all records
    getAll() {
        return this.data;
    }

    // Get by ID
    getById(id) {
        return this.data.find(item => item.id === id);
    }

    // Find by field
    findBy(field, value) {
        return this.data.find(item => item[field] === value);
    }

    // Find all by field
    findAllBy(field, value) {
        return this.data.filter(item => item[field] === value);
    }

    // Create new record
    create(record) {
        const newRecord = {
            id: uuidv4(),
            ...record,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        this.data.push(newRecord);
        this.save();
        return newRecord;
    }

    // Update record
    update(id, updates) {
        const index = this.data.findIndex(item => item.id === id);
        if (index === -1) return null;

        this.data[index] = {
            ...this.data[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };
        this.save();
        return this.data[index];
    }

    // Delete record
    delete(id) {
        const index = this.data.findIndex(item => item.id === id);
        if (index === -1) return false;

        this.data.splice(index, 1);
        this.save();
        return true;
    }
}

// Initialize databases
const users = new Database('users');
const orders = new Database('orders');
const servers = new Database('servers');
const tickets = new Database('tickets');
const settings = new Database('settings');
const startupConfigs = new Database('startupConfigs');
const backups = new Database('backups');

// Initialize default admin if not exists
if (!users.findBy('email', process.env.ADMIN_EMAIL || 'admin@ninipanel.com')) {
    const bcrypt = require('bcryptjs');
    users.create({
        name: 'Administrator',
        email: process.env.ADMIN_EMAIL || 'admin@ninipanel.com',
        password: bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin123', 10),
        phone: '08123456789',
        role: 'admin'
    });
    console.log('✅ Default admin created');
}

// Initialize default settings if not exists
if (settings.getAll().length === 0) {
    settings.create({
        id: 'main',
        siteName: 'NiniPanel',
        adminWhatsApp: '08123456789',
        qrisImage: '',
        plans: {
            starter: { name: 'Starter', ram: 20, disk: 100, cpu: 0.1, bandwidth: 10, daily: 500, weekly: 3000, monthly: 10000 },
            basic: { name: 'Basic', ram: 50, disk: 250, cpu: 0.25, bandwidth: 25, daily: 1000, weekly: 6000, monthly: 20000 },
            standard: { name: 'Standard', ram: 100, disk: 500, cpu: 0.5, bandwidth: 50, daily: 2000, weekly: 12000, monthly: 40000 },
            premium: { name: 'Premium', ram: 200, disk: 1024, cpu: 1, bandwidth: 100, daily: 4000, weekly: 25000, monthly: 80000 }
        }
    });
    console.log('✅ Default settings created');
}

module.exports = { users, orders, servers, tickets, settings, startupConfigs, backups, Database };
