// routes/testimonialRoutes.js
const express = require("express");
const router = express.Router();
const Testimonial = require("../models/Testimonial");

// POST: Submit a testimonial
router.post("/", async (req, res) => {
  try {
    const { name, feedback, rating } = req.body;
    console.log("📩 Received testimonial:", { name, feedback, rating });

    if (!name || !feedback || rating === undefined) {
      console.warn("⚠️ Missing fields in testimonial submission.");
      return res.status(400).json({ success: false, message: "All fields are required." });
    }

    const testimonial = new Testimonial({ name, feedback, rating });
    await testimonial.save();
    console.log("✅ Testimonial saved.");
    res.status(201).json({ success: true });
  } catch (err) {
    console.error("❌ Error saving testimonial:", err);
    res.status(500).json({ success: false, message: "Failed to submit testimonial" });
  }
});

// GET: Fetch all testimonials
router.get("/", async (req, res) => {
  try {
    const testimonials = await Testimonial.find().sort({ createdAt: -1 });
    console.log(`📤 Returning ${testimonials.length} testimonials`);
    res.json(testimonials);
  } catch (err) {
    console.error("❌ Failed to fetch testimonials:", err);
    res.status(500).json({ message: "Failed to fetch testimonials" });
  }
});

module.exports = router;

