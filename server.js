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

// ✅ Trust proxy (for Render/HTTPS)
app.set('trust proxy', 1);

// ✅ Middleware
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ CORS
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

// ✅ Fallback headers for CORS preflight
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
  console.error('❌ MONGODB_URI not set in .env');
  process.exit(1);
}
mongoose.connect(mongoURI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB error:', err.message);
    process.exit(1);
  });

// ✅ API Routes
app.use('/api/bookings', bookingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/distance', distanceRoutes);
app.use('/api/testimonials', testimonialRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/payment', paymentRoutes);

// ✅ Health check routes
app.get('/', (req, res) => {
  res.send('✅ ItarsiTaxi Backend is Live');
});

app.get('/api/ping', (req, res) => {
  res.status(200).send('pong');
});

app.get('/api/debug-env', (req, res) => {
  res.json({
    PHONEPE_CLIENT_ID: process.env.PHONEPE_CLIENT_ID || '❌ MISSING',
    PHONEPE_CLIENT_SECRET: process.env.PHONEPE_CLIENT_SECRET ? '✅ PRESENT' : '❌ MISSING',
    PHONEPE_MERCHANT_ID: process.env.PHONEPE_MERCHANT_ID || '❌ MISSING',
    PHONEPE_SALT_KEY: process.env.PHONEPE_SALT_KEY ? '✅ PRESENT' : '❌ MISSING',
    PHONEPE_SALT_INDEX: process.env.PHONEPE_SALT_INDEX || '❌ MISSING',
  });
});

// ✅ Serve React frontend (if deployed together)
const buildPath = path.join(__dirname, 'client', 'build'); // <-- adjust if your build folder is elsewhere
app.use(express.static(buildPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(buildPath, 'index.html'));
});

// ✅ Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

