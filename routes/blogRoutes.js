const express = require('express');
const Blog = require('../models/Blog');
const router = express.Router();
const multer = require('multer');
const { storage } = require('../config/cloudinary'); // ✅ Cloudinary setup
const upload = multer({ storage });

// GET all blogs with pagination
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
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// GET single blog by ID
router.get('/:id', async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    res.json(blog);
  } catch (err) {
    res.status(404).json({ error: 'Blog not found' });
  }
});

// POST - Add new blog with image upload
router.post('/add', upload.single('image'), async (req, res) => {
  try {
    const { title, excerpt, content } = req.body;
    const imageUrl = req.file?.path || '';

    const blog = new Blog({ title, excerpt, content, imageUrl });
    await blog.save();

    res.status(201).json({ message: 'Blog created successfully', blog });
  } catch (err) {
    console.error('❌ Blog creation error:', err.message);
    res.status(400).json({ error: 'Failed to create blog. Image upload may have failed.' });
  }
});

// DELETE - Remove blog
router.delete('/:id', async (req, res) => {
  try {
    await Blog.findByIdAndDelete(req.params.id);
    res.json({ message: 'Blog deleted successfully' });
  } catch (err) {
    res.status(400).json({ error: 'Failed to delete blog' });
  }
});

module.exports = router;

