require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const net = require('net');
const connectDB = require('./config/db');

const app = express();
connectDB();

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.options('*', cors());

// ── Body parser ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/users',       require('./routes/users'));
app.use('/api/salespersons',require('./routes/salespersons'));
app.use('/api/dealers',     require('./routes/dealers'));
app.use('/api/products',    require('./routes/products'));
app.use('/api/orders',      require('./routes/orders'));
app.use('/api/lifting',     require('./routes/lifting'));
app.use('/api/collections', require('./routes/collections'));
app.use('/api/dashboard',   require('./routes/dashboard'));
app.use('/api/reports',     require('./routes/reports'));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'SFA API is running', time: new Date() });
});

// ── Serve React frontend (only when FRONTEND_DIST is set) ───────────────────
if (process.env.FRONTEND_DIST) {
  app.use(express.static(process.env.FRONTEND_DIST));
  app.get('*', (req, res) => {
    res.sendFile(path.join(process.env.FRONTEND_DIST, 'index.html'));
  });
}

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: err.message || 'Server Error' });
});

// ── Start server (auto-find free port for cPanel) ────────────────────────────
function isPortFree(port) {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', () => resolve(false))
      .once('listening', () => tester.close(() => resolve(true)))
      .listen(port, '0.0.0.0');
  });
}

async function startServer() {
  const preferredPort = parseInt(process.env.PORT) || 8000;
  const fallbackPorts = [preferredPort, 8080, 3000, 3001, 5000, 5001];

  for (const port of fallbackPorts) {
    if (await isPortFree(port)) {
      app.listen(port, '0.0.0.0', () => console.log(`SFA Server running on port ${port}`));
      return;
    }
  }
  console.error('No free port found. Please set PORT in .env to an available port.');
  process.exit(1);
}

startServer();
