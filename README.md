# NiniPanel - VPS Selling Panel 🚀

Panel jualan VPS mini production-ready dengan backend Node.js dan Docker.

## Requirements

- Node.js 18+
- Docker (optional, untuk real containers)
- npm

## Quick Start

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Configure Environment

Edit `server/.env`:

```env
PORT=3000
JWT_SECRET=ganti-dengan-secret-anda
ADMIN_EMAIL=admin@ninipanel.com
ADMIN_PASSWORD=admin123
```

### 3. Run Server

```bash
npm start
```

Server akan running di `http://localhost:3000`

### 4. Login

- **Admin**: admin@ninipanel.com / admin123
- **User**: Daftar lewat halaman register

---

## Features

| Feature | Status |
|---------|--------|
| Landing Page | ✅ |
| Auth (Login/Register) | ✅ |
| Order VPS | ✅ |
| QRIS Payment | ✅ |
| Client Dashboard | ✅ |
| Server Management | ✅ |
| Terminal Console | ✅ |
| File Manager | ✅ |
| Support Tickets | ✅ |
| Admin Panel | ✅ |

---

## Architecture

```
ninipanel/
├── index.html          # Landing
├── styles.css          # Styles
├── order.html          # Order page
├── payment.html        # Payment
├── auth/               # Login/Register
├── client/             # Client area
├── admin/              # Admin panel
├── js/
│   └── api.js          # Frontend API client
├── server/
│   ├── index.js        # Express server
│   ├── routes/         # API routes
│   ├── services/       # Docker manager
│   ├── middleware/     # JWT auth
│   └── utils/          # Database
├── data/               # JSON database
└── uploads/            # Uploaded files
```

---

## API Endpoints

### Auth
- `POST /api/auth/register` - Register
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Orders
- `GET /api/orders` - List orders
- `POST /api/orders` - Create order
- `POST /api/orders/:id/proof` - Upload payment proof
- `PUT /api/orders/:id/verify` - Verify order (admin)

### Servers
- `GET /api/servers` - List servers
- `POST /api/servers` - Create server
- `POST /api/servers/:id/start` - Start
- `POST /api/servers/:id/stop` - Stop
- `POST /api/servers/:id/restart` - Restart

### Files
- `GET /api/files/:serverId` - List files
- `POST /api/files/:serverId/write` - Write file

### Terminal
- `WS /api/terminal/:serverId` - WebSocket terminal

---

## With Docker (Production)

Jika Docker tersedia, server akan otomatis:
- Membuat container untuk setiap VPS
- Limit RAM/CPU sesuai paket
- Real terminal access
- Real file manager

Tanpa Docker, panel tetap berjalan dalam **simulation mode**.

---

## Deploy ke VPS

```bash
# 1. Clone/upload files ke VPS
# 2. Install Node.js 18+
# 3. Install Docker (optional)
# 4. Run:

cd ninipanel/server
npm install
npm start

# Atau dengan PM2:
npm install -g pm2
pm2 start index.js --name ninipanel
pm2 save
```

---

## License

MIT © 2024 NiniPanel
