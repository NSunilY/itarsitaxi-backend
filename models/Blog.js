const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema({
  title: String,
  excerpt: String,
  content: String,
  imageUrl: String,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Blog', blogSchema);

