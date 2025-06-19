const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const distanceRoutes = require('./routes/distance');
const blogRoutes = require('./routes/blogRoutes'); // ✅ Import Blog Routes

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());

// ✅ Connect MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/itarsitaxi', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// Routes
app.use('/api/distance', distanceRoutes);
app.use('/api/blogs', blogRoutes); // ✅ Mount Blog API

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});

