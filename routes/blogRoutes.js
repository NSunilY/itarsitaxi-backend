const express = require('express');
const router = express.Router();
const multer = require('multer');
const { storage } = require('../config/cloudinary'); // ✅ Cloudinary Multer config
const upload = multer({ storage });

const Blog = require('../models/Blog');

// ✅ GET all blogs with pagination
router.get('/', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 6;
  const skip = (page - 1) * limit;

  try {
    const blogs = await Blog.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Blog.countDocuments();
    res.json({ blogs, total });
  } catch (error) {
    console.error('❌ Error fetching blogs:', error.message);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// ✅ GET single blog by ID
router.get('/:id', async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) {
      return res.status(404).json({ error: 'Blog not found' });
    }
    res.json(blog);
  } catch (err) {
    console.error('❌ Error fetching blog:', err.message);
    res.status(500).json({ error: 'Failed to fetch blog' });
  }
});

// ✅ POST - Add blog with image upload
router.post('/add', upload.single('image'), async (req, res) => {
  try {
    const { title, excerpt, content } = req.body;
    const imageUrl = req.file?.path || '';

    if (!title || !excerpt || !content || !imageUrl) {
      return res.status(400).json({ error: 'All fields including image are required' });
    }

    const blog = new Blog({ title, excerpt, content, imageUrl });
    await blog.save();

    res.status(201).json({ message: 'Blog created successfully', blog });
  } catch (err) {
    console.error('❌ Blog creation error:', err.message);
    res.status(500).json({ error: 'Failed to create blog. Check image format or server logs.' });
  }
});

// ✅ DELETE - Remove blog
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Blog.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Blog not found' });
    }
    res.json({ message: 'Blog deleted successfully' });
  } catch (err) {
    console.error('❌ Blog deletion error:', err.message);
    res.status(400).json({ error: 'Failed to delete blog' });
  }
});

module.exports = router;

