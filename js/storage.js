// Storage wrapper for LocalStorage
const Storage = {
  // Keys
  KEYS: {
    USERS: 'ninipanel_users',
    ORDERS: 'ninipanel_orders',
    SERVERS: 'ninipanel_servers',
    TICKETS: 'ninipanel_tickets',
    SETTINGS: 'ninipanel_settings',
    CURRENT_USER: 'ninipanel_current_user',
    SESSION: 'ninipanel_session'
  },

  // Get data from storage
  get(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Storage get error:', e);
      return null;
    }
  },

  // Set data to storage
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('Storage set error:', e);
      return false;
    }
  },

  // Remove data from storage
  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.error('Storage remove error:', e);
      return false;
    }
  },

  // Initialize default data
  init() {
    // Initialize users if not exists
    if (!this.get(this.KEYS.USERS)) {
      this.set(this.KEYS.USERS, [
        {
          id: 'admin',
          name: 'Administrator',
          email: 'admin@ninipanel.com',
          phone: '08123456789',
          password: 'admin123',
          role: 'admin',
          createdAt: new Date().toISOString()
        }
      ]);
    }

    // Initialize orders if not exists
    if (!this.get(this.KEYS.ORDERS)) {
      this.set(this.KEYS.ORDERS, []);
    }

    // Initialize servers if not exists
    if (!this.get(this.KEYS.SERVERS)) {
      this.set(this.KEYS.SERVERS, []);
    }

    // Initialize tickets if not exists
    if (!this.get(this.KEYS.TICKETS)) {
      this.set(this.KEYS.TICKETS, []);
    }

    // Initialize settings if not exists
    if (!this.get(this.KEYS.SETTINGS)) {
      this.set(this.KEYS.SETTINGS, {
        siteName: 'NiniPanel',
        adminWhatsApp: '08123456789',
        qrisImage: '',
        plans: {
          starter: { name: 'Starter', ram: 20, disk: 100, cpu: 1, bandwidth: 10, daily: 500, weekly: 3000, monthly: 10000 },
          basic: { name: 'Basic', ram: 50, disk: 250, cpu: 1, bandwidth: 25, daily: 1000, weekly: 6000, monthly: 20000 },
          standard: { name: 'Standard', ram: 100, disk: 500, cpu: 2, bandwidth: 50, daily: 2000, weekly: 12000, monthly: 40000 },
          premium: { name: 'Premium', ram: 200, disk: 1024, cpu: 2, bandwidth: 100, daily: 4000, weekly: 25000, monthly: 80000 }
        }
      });
    }
  },

  // Generate unique ID
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  },

  // Get all users
  getUsers() {
    return this.get(this.KEYS.USERS) || [];
  },

  // Get user by email
  getUserByEmail(email) {
    const users = this.getUsers();
    return users.find(u => u.email.toLowerCase() === email.toLowerCase());
  },

  // Add user
  addUser(user) {
    const users = this.getUsers();
    user.id = this.generateId();
    user.createdAt = new Date().toISOString();
    users.push(user);
    return this.set(this.KEYS.USERS, users);
  },

  // Update user
  updateUser(id, updates) {
    const users = this.getUsers();
    const index = users.findIndex(u => u.id === id);
    if (index !== -1) {
      users[index] = { ...users[index], ...updates };
      return this.set(this.KEYS.USERS, users);
    }
    return false;
  },

  // Get all orders
  getOrders() {
    return this.get(this.KEYS.ORDERS) || [];
  },

  // Get orders by user
  getOrdersByUser(userId) {
    return this.getOrders().filter(o => o.userId === userId);
  },

  // Add order
  addOrder(order) {
    const orders = this.getOrders();
    order.id = this.generateId();
    order.createdAt = new Date().toISOString();
    order.status = 'pending'; // pending, paid, active, expired, cancelled
    orders.push(order);
    return this.set(this.KEYS.ORDERS, orders) ? order : null;
  },

  // Update order
  updateOrder(id, updates) {
    const orders = this.getOrders();
    const index = orders.findIndex(o => o.id === id);
    if (index !== -1) {
      orders[index] = { ...orders[index], ...updates };
      return this.set(this.KEYS.ORDERS, orders);
    }
    return false;
  },

  // Get all servers
  getServers() {
    return this.get(this.KEYS.SERVERS) || [];
  },

  // Get servers by user
  getServersByUser(userId) {
    return this.getServers().filter(s => s.userId === userId);
  },

  // Add server
  addServer(server) {
    const servers = this.getServers();
    server.id = this.generateId();
    server.createdAt = new Date().toISOString();
    server.status = 'offline';
    servers.push(server);
    return this.set(this.KEYS.SERVERS, servers) ? server : null;
  },

  // Update server
  updateServer(id, updates) {
    const servers = this.getServers();
    const index = servers.findIndex(s => s.id === id);
    if (index !== -1) {
      servers[index] = { ...servers[index], ...updates };
      return this.set(this.KEYS.SERVERS, servers);
    }
    return false;
  },

  // Delete server
  deleteServer(id) {
    const servers = this.getServers();
    const filtered = servers.filter(s => s.id !== id);
    return this.set(this.KEYS.SERVERS, filtered);
  },

  // Get all tickets
  getTickets() {
    return this.get(this.KEYS.TICKETS) || [];
  },

  // Get tickets by user
  getTicketsByUser(userId) {
    return this.getTickets().filter(t => t.userId === userId);
  },

  // Add ticket
  addTicket(ticket) {
    const tickets = this.getTickets();
    ticket.id = this.generateId();
    ticket.createdAt = new Date().toISOString();
    ticket.status = 'open';
    ticket.messages = ticket.messages || [];
    tickets.push(ticket);
    return this.set(this.KEYS.TICKETS, tickets) ? ticket : null;
  },

  // Update ticket
  updateTicket(id, updates) {
    const tickets = this.getTickets();
    const index = tickets.findIndex(t => t.id === id);
    if (index !== -1) {
      tickets[index] = { ...tickets[index], ...updates };
      return this.set(this.KEYS.TICKETS, tickets);
    }
    return false;
  },

  // Add message to ticket
  addTicketMessage(ticketId, message) {
    const tickets = this.getTickets();
    const index = tickets.findIndex(t => t.id === ticketId);
    if (index !== -1) {
      message.id = this.generateId();
      message.createdAt = new Date().toISOString();
      tickets[index].messages.push(message);
      return this.set(this.KEYS.TICKETS, tickets);
    }
    return false;
  },

  // Get settings
  getSettings() {
    return this.get(this.KEYS.SETTINGS) || {};
  },

  // Update settings
  updateSettings(updates) {
    const settings = this.getSettings();
    return this.set(this.KEYS.SETTINGS, { ...settings, ...updates });
  },

  // Get stats
  getStats() {
    const users = this.getUsers().filter(u => u.role !== 'admin');
    const orders = this.getOrders();
    const servers = this.getServers();
    
    const activeServers = servers.filter(s => s.status === 'online');
    const pendingOrders = orders.filter(o => o.status === 'pending');
    const totalRevenue = orders
      .filter(o => o.status === 'paid' || o.status === 'active')
      .reduce((sum, o) => sum + (o.amount || 0), 0);
    
    return {
      totalUsers: users.length,
      totalOrders: orders.length,
      totalServers: servers.length,
      activeServers: activeServers.length,
      pendingOrders: pendingOrders.length,
      totalRevenue
    };
  }
};

// Initialize storage on load
Storage.init();
