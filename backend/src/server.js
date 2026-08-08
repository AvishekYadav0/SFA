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

const PORT = parseInt(process.env.PORT) || 8000;
const server = app.listen(PORT, '0.0.0.0', () => console.log(`✅ SFA Server running on port ${PORT}`));
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} in use. Run: lsof -ti:${PORT} | xargs kill -9`);
    process.exit(1);
  }
});
