// routes/testimonialRoutes.js
const express = require("express");
const router = express.Router();
const Testimonial = require("../models/Testimonial");

// POST: Submit a testimonial
router.post("/", async (req, res) => {
  try {
    const { name, feedback, rating } = req.body;
    const testimonial = new Testimonial({ name, feedback, rating });
    await testimonial.save();
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to submit testimonial" });
  }
});

// GET: Fetch all testimonials
router.get("/", async (req, res) => {
  try {
    const testimonials = await Testimonial.find().sort({ createdAt: -1 });
    res.json(testimonials);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch testimonials" });
  }
});

module.exports = router;

