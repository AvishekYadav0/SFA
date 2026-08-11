require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const connectDB = require('./config/db');

const app = express();
connectDB();

app.use(cors({ origin: true, credentials: true, methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));
app.options('*', cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Routes ────────────────────────────────────────────────────────────────────
const { collections, visits, dashboard, reports } = require('./routes/combined');
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/users',        require('./routes/users'));
app.use('/api/dealers',      require('./routes/dealers'));
app.use('/api/products',     require('./routes/products'));
app.use('/api/orders',       require('./routes/orders'));
app.use('/api/sales',        require('./routes/sales'));
app.use('/api/collections',  collections);
app.use('/api/collection-plans', require('./routes/collectionPlans'));
app.use('/api/visits',       visits);
app.use('/api/dashboard',    dashboard);
app.use('/api/reports',      reports);
app.use('/api/dealer-portal', require('./routes/dealerPortal'));

// Keep old routes working if they exist
try { app.use('/api/salespersons', require('./routes/salespersons')); } catch {}
try { app.use('/api/lifting',      require('./routes/lifting'));      } catch {}
try { app.use('/api/targets',      require('./routes/targets'));      } catch {}
try { app.use('/api/notifications',require('./routes/notifications'));} catch {}

app.get('/api/health', (req, res) => res.json({ success: true, message: 'SFA API running', time: new Date() }));

if (process.env.FRONTEND_DIST) {
  app.use(express.static(process.env.FRONTEND_DIST));
  app.get('*', (req, res) => res.sendFile(path.join(process.env.FRONTEND_DIST, 'index.html')));
}

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: err.message || 'Server Error' });
});

const DEFAULT_PORT = parseInt(process.env.PORT) || 8000;
const MAX_TRIES = 10;

function startServer(port, attemptsLeft = MAX_TRIES) {
  const server = app.listen(port, '0.0.0.0', () => console.log(`✅ SFA Server running on port ${port}`));
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${port} in use.`);
      if (attemptsLeft > 1) {
        const nextPort = port + 1;
        console.log(`Trying port ${nextPort}...`);
        setTimeout(() => startServer(nextPort, attemptsLeft - 1), 200);
      } else {
        console.error(`No available ports after ${MAX_TRIES} attempts. Run: lsof -ti:${port} | xargs kill -9`);
        process.exit(1);
      }
    } else {
      console.error(err);
      process.exit(1);
    }
  });
}

startServer(DEFAULT_PORT);
