// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const path = require('path');

dotenv.config();

const bookingRoutes = require('./routes/bookingRoutes');
const adminRoutes = require('./routes/adminRoutes');
const blogRoutes = require('./routes/blogRoutes');
const distanceRoutes = require('./routes/distance');
const testimonialRoutes = require('./routes/testimonialRoutes');
const driverRoutes = require('./routes/driverRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ Trust proxy (for HTTPS behind proxy like Render)
app.set('trust proxy', 1);

// ✅ Middleware
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ CORS setup
const allowedOrigins = [
  'http://localhost:3000',
  'https://itarsitaxi.in',
  'https://www.itarsitaxi.in'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log(`❌ CORS rejected for origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: false,
}));

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ✅ MongoDB Connection
const mongoURI = process.env.MONGODB_URI;
if (!mongoURI) {
  console.error('❌ MONGODB_URI not set');
  process.exit(1);
}

mongoose.connect(mongoURI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => {
    console.error('❌ MongoDB error:', err.message);
    process.exit(1);
  });

// ✅ API routes
app.use('/api/bookings', bookingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/distance', distanceRoutes);
app.use('/api/testimonials', testimonialRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/payment', paymentRoutes);

// ✅ Health check + debug
app.get('/api/ping', (req, res) => res.send('pong'));
app.get('/api/debug-env', (req, res) => {
  res.json({
    PHONEPE_CLIENT_ID: process.env.PHONEPE_CLIENT_ID || '❌ MISSING',
    PHONEPE_CLIENT_SECRET: process.env.PHONEPE_CLIENT_SECRET ? '✅ PRESENT' : '❌ MISSING',
    PHONEPE_MERCHANT_ID: process.env.PHONEPE_MERCHANT_ID || '❌ MISSING',
    PHONEPE_SALT_KEY: process.env.PHONEPE_SALT_KEY ? '✅ PRESENT' : '❌ MISSING',
    PHONEPE_SALT_INDEX: process.env.PHONEPE_SALT_INDEX || '❌ MISSING',
  });
});

// ✅ Serve frontend (assumes React build is in root /build folder)
const buildPath = path.join(__dirname, 'build');
app.use(express.static(buildPath));

// ✅ Safe fallback for all non-API routes
app.get('/*', (req, res) => {
  res.sendFile(path.join(buildPath, 'index.html'));
});

// ✅ Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

