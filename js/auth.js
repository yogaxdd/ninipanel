// Authentication module
const Auth = {
    // Login user
    async login(email, password, remember = false) {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 500));

        const user = Storage.getUserByEmail(email);

        if (!user) {
            return { success: false, message: 'Email tidak ditemukan.' };
        }

        if (user.password !== password) {
            return { success: false, message: 'Password salah.' };
        }

        // Create session
        const session = {
            userId: user.id,
            email: user.email,
            role: user.role,
            createdAt: new Date().toISOString(),
            expiresAt: remember
                ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
                : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 1 day
        };

        Storage.set(Storage.KEYS.SESSION, session);
        Storage.set(Storage.KEYS.CURRENT_USER, {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role
        });

        return { success: true, user: Storage.get(Storage.KEYS.CURRENT_USER) };
    },

    // Register new user
    async register(userData) {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 500));

        // Check if email already exists
        const existingUser = Storage.getUserByEmail(userData.email);
        if (existingUser) {
            return { success: false, message: 'Email sudah terdaftar.' };
        }

        // Create user
        const user = {
            name: userData.name,
            email: userData.email,
            phone: userData.phone,
            password: userData.password,
            role: 'user'
        };

        Storage.addUser(user);

        return { success: true, message: 'Registrasi berhasil.' };
    },

    // Logout user
    logout() {
        Storage.remove(Storage.KEYS.SESSION);
        Storage.remove(Storage.KEYS.CURRENT_USER);
        window.location.href = '../auth/login.html';
    },

    // Check if user is logged in
    isLoggedIn() {
        const session = Storage.get(Storage.KEYS.SESSION);
        if (!session) return false;

        // Check if session expired
        if (new Date(session.expiresAt) < new Date()) {
            this.logout();
            return false;
        }

        return true;
    },

    // Get current user
    getCurrentUser() {
        return Storage.get(Storage.KEYS.CURRENT_USER);
    },

    // Check if current user is admin
    isAdmin() {
        const user = this.getCurrentUser();
        return user && user.role === 'admin';
    },

    // Require login - redirect if not logged in
    requireLogin() {
        if (!this.isLoggedIn()) {
            window.location.href = '../auth/login.html';
            return false;
        }
        return true;
    },

    // Require admin - redirect if not admin
    requireAdmin() {
        if (!this.isLoggedIn()) {
            window.location.href = '../auth/login.html';
            return false;
        }
        if (!this.isAdmin()) {
            window.location.href = '../client/dashboard.html';
            return false;
        }
        return true;
    },

    // Update current user data
    updateCurrentUser(updates) {
        const currentUser = this.getCurrentUser();
        if (currentUser) {
            Storage.set(Storage.KEYS.CURRENT_USER, { ...currentUser, ...updates });
            Storage.updateUser(currentUser.id, updates);
        }
    },

    // Change password
    async changePassword(currentPassword, newPassword) {
        const currentUser = this.getCurrentUser();
        if (!currentUser) {
            return { success: false, message: 'User tidak ditemukan.' };
        }

        const users = Storage.getUsers();
        const user = users.find(u => u.id === currentUser.id);

        if (!user || user.password !== currentPassword) {
            return { success: false, message: 'Password lama salah.' };
        }

        Storage.updateUser(currentUser.id, { password: newPassword });
        return { success: true, message: 'Password berhasil diubah.' };
    }
};
