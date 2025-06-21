// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const bookingRoutes = require('./routes/bookingRoutes');
const adminRoutes = require('./routes/admin');
const blogRoutes = require('./routes/blogRoutes'); // if you're using blogs
const distanceRoutes = require('./routes/distance'); // if using distance API

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ CORS Middleware — place this BEFORE all other middlewares/routes
app.use(cors({
  origin: 'https://itarsitaxi.in', // ✅ Your production frontend domain
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
}));

// Body parser middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/bookings', bookingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/distance', distanceRoutes); // ✅ don't forget this if you're using it

// Health Check Route
app.get('/', (req, res) => {
  res.send('✅ ItarsiTaxi Backend is Live and Running!');
});

// MongoDB Connection
const mongoURI = process.env.MONGODB_URI;
if (!mongoURI) {
  console.error("❌ MONGODB_URI not found in .env");
  process.exit(1);
}

mongoose.connect(mongoURI)
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

