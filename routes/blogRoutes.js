const express = require('express');
const Blog = require('../models/Blog');
const router = express.Router();

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
  const blog = await Blog.findById(req.params.id);
  res.json(blog);
});

// POST - Add new blog
router.post('/add', async (req, res) => {
  const { title, excerpt, content, imageUrl } = req.body;

  try {
    const blog = new Blog({ title, excerpt, content, imageUrl });
    await blog.save();
    res.status(201).json({ message: 'Blog created successfully', blog });
  } catch (err) {
    res.status(400).json({ error: 'Failed to create blog' });
  }
});

// DELETE - Remove blog
router.delete('/:id', async (req, res) => {
  await Blog.findByIdAndDelete(req.params.id);
  res.json({ message: 'Blog deleted successfully' });
});

module.exports = router; // ✅ THIS LINE IS CRITICAL

