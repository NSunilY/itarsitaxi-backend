// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Route imports
const bookingRoutes = require('./routes/bookingRoutes');
const adminRoutes = require('./routes/adminRoutes');
const blogRoutes = require('./routes/blogRoutes');
const distanceRoutes = require('./routes/distance');
const testimonialRoutes = require('./routes/testimonialRoutes'); // ✅ NEW
const driverRoutes = require('./routes/driverRoutes'); // ✅ NEW: Driver Panel

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ CORS Setup for Multiple Devices and Live Domain
app.use(cors({
  origin: ['http://localhost:3000', 'https://itarsitaxi.in'],
  credentials: true,
}));

// ✅ Optional fallback headers for CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://itarsitaxi.in');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  next();
});

// ✅ Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
app.use('/api/admin', adminRoutes); // 🔐 Admin login
app.use('/api/blogs', blogRoutes);
app.use('/api/distance', distanceRoutes);
app.use('/api/testimonials', testimonialRoutes); // ✅ Testimonials
app.use('/api/drivers', driverRoutes); // ✅ Driver Panel

// ✅ Root Health Check
app.get('/', (req, res) => {
  res.send('✅ ItarsiTaxi Backend is Live');
});

// ✅ Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

