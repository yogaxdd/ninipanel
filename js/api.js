/**
 * NiniPanel API Client
 * Connects frontend to backend API
 */

const API = {
    baseUrl: '/api',
    token: localStorage.getItem('ninipanel_token'),

    // Set token
    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('ninipanel_token', token);
        } else {
            localStorage.removeItem('ninipanel_token');
        }
    },

    // Get headers
    getHeaders() {
        const headers = { 'Content-Type': 'application/json' };
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        return headers;
    },

    // Generic request
    async request(method, endpoint, body = null) {
        const options = {
            method,
            headers: this.getHeaders()
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(`${this.baseUrl}${endpoint}`, options);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Request failed');
        }

        return data;
    },

    // Auth
    async login(email, password) {
        const data = await this.request('POST', '/auth/login', { email, password });
        if (data.success && data.token) {
            this.setToken(data.token);
            localStorage.setItem('ninipanel_user', JSON.stringify(data.user));
        }
        return data;
    },

    async register(userData) {
        const data = await this.request('POST', '/auth/register', userData);
        if (data.success && data.token) {
            this.setToken(data.token);
            localStorage.setItem('ninipanel_user', JSON.stringify(data.user));
        }
        return data;
    },

    async getMe() {
        return this.request('GET', '/auth/me');
    },

    logout() {
        this.setToken(null);
        localStorage.removeItem('ninipanel_user');
        window.location.href = '/index.html';
    },

    isLoggedIn() {
        return !!this.token;
    },

    getUser() {
        const user = localStorage.getItem('ninipanel_user');
        return user ? JSON.parse(user) : null;
    },

    isAdmin() {
        const user = this.getUser();
        return user?.role === 'admin';
    },

    requireLogin() {
        if (!this.isLoggedIn()) {
            window.location.href = '/auth/login.html';
            return false;
        }
        return true;
    },

    requireAdmin() {
        if (!this.isLoggedIn() || !this.isAdmin()) {
            window.location.href = '/index.html';
            return false;
        }
        return true;
    },

    // Orders
    async getOrders() {
        return this.request('GET', '/orders');
    },

    async getOrder(id) {
        return this.request('GET', `/orders/${id}`);
    },

    async createOrder(orderData) {
        return this.request('POST', '/orders', orderData);
    },

    async uploadPaymentProof(orderId, file) {
        const formData = new FormData();
        formData.append('proof', file);

        const response = await fetch(`${this.baseUrl}/orders/${orderId}/proof`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.token}` },
            body: formData
        });
        return response.json();
    },

    async verifyOrder(orderId, action) {
        return this.request('PUT', `/orders/${orderId}/verify`, { action });
    },

    // Servers
    async getServers() {
        return this.request('GET', '/servers');
    },

    async getServer(id) {
        return this.request('GET', `/servers/${id}`);
    },

    async createServer(orderId) {
        return this.request('POST', '/servers', { orderId });
    },

    async startServer(id) {
        return this.request('POST', `/servers/${id}/start`);
    },

    async stopServer(id) {
        return this.request('POST', `/servers/${id}/stop`);
    },

    async restartServer(id) {
        return this.request('POST', `/servers/${id}/restart`);
    },

    async deleteServer(id) {
        return this.request('DELETE', `/servers/${id}`);
    },

    async getServerStats(id) {
        return this.request('GET', `/servers/${id}/stats`);
    },

    // Files
    async listFiles(serverId, path = '/root') {
        return this.request('GET', `/files/${serverId}?path=${encodeURIComponent(path)}`);
    },

    async readFile(serverId, path) {
        return this.request('GET', `/files/${serverId}/read?path=${encodeURIComponent(path)}`);
    },

    async writeFile(serverId, path, content) {
        return this.request('POST', `/files/${serverId}/write`, { path, content });
    },

    async createDirectory(serverId, path) {
        return this.request('POST', `/files/${serverId}/mkdir`, { path });
    },

    async deleteFile(serverId, path) {
        return this.request('DELETE', `/files/${serverId}?path=${encodeURIComponent(path)}`);
    },

    // Tickets
    async getTickets() {
        return this.request('GET', '/tickets');
    },

    async getTicket(id) {
        return this.request('GET', `/tickets/${id}`);
    },

    async createTicket(ticketData) {
        return this.request('POST', '/tickets', ticketData);
    },

    async addTicketMessage(id, message) {
        return this.request('POST', `/tickets/${id}/message`, { message });
    },

    async closeTicket(id) {
        return this.request('PUT', `/tickets/${id}/close`);
    },

    // Settings
    async getPublicSettings() {
        return this.request('GET', '/settings/public');
    },

    async getSettings() {
        return this.request('GET', '/settings');
    },

    async updateSettings(settingsData) {
        return this.request('PUT', '/settings', settingsData);
    },

    async uploadQris(file) {
        const formData = new FormData();
        formData.append('qris', file);

        const response = await fetch(`${this.baseUrl}/settings/qris`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.token}` },
            body: formData
        });
        return response.json();
    },

    async getStats() {
        return this.request('GET', '/settings/stats');
    },

    // Terminal WebSocket
    connectTerminal(serverId, onData, onError) {
        const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/terminal/${serverId}?token=${this.token}`;
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log('Terminal connected');
        };

        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.type === 'output') {
                onData(msg.data);
            } else if (msg.type === 'error') {
                onError(msg.message);
            }
        };

        ws.onerror = (error) => {
            onError('Connection error');
        };

        ws.onclose = () => {
            console.log('Terminal disconnected');
        };

        return {
            send(data) {
                ws.send(JSON.stringify({ type: 'input', data }));
            },
            resize(rows, cols) {
                ws.send(JSON.stringify({ type: 'resize', rows, cols }));
            },
            close() {
                ws.close();
            }
        };
    }
};
