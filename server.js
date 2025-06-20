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

// Middleware
app.use(cors({
  origin: ['https://itarsitaxi.in'], // ✅ restrict to your frontend domain
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // for form-data

// Routes
app.use('/api', bookingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/blogs', blogRoutes); // ✅ add this if blog posting is failing

// Root route (helpful for Render test)
app.get('/', (req, res) => {
  res.send('✅ ItarsiTaxi Backend is Live and Running!');
});

// MongoDB Connection
const mongoURI = process.env.MONGODB_URI;
if (!mongoURI) {
  console.error("❌ MONGODB_URI not found in .env");
  process.exit(1);
}

mongoose.connect(mongoURI, {
  // These two are now optional in latest Mongoose versions
  // useNewUrlParser: true,
  // useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch((err) => {
  console.error('❌ MongoDB connection error:', err.message);
  process.exit(1);
});

// Start Server (IMPORTANT for Render)
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

