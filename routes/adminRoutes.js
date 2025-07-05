// routes/adminRoutes.js
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const Booking = require("../models/Booking");

// ✅ Middleware to verify token
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "No token provided" });

  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.JWT_SECRET || "fallback_secret", (err, decoded) => {
    if (err) return res.status(403).json({ message: "Invalid or expired token" });
    req.admin = decoded;
    next();
  });
};

// ✅ Login route
router.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
  ) {
    const token = jwt.sign(
      { username },
      process.env.JWT_SECRET || "fallback_secret",
      { expiresIn: "1d" }
    );
    return res.json({ success: true, token });
  }

  res.status(401).json({ success: false, message: "Invalid credentials" });
});

// ✅ GET /api/admin/bookings — Protected route
router.get("/bookings", verifyToken, async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const summary = {
      total: bookings.length,
      today: bookings.filter(b => new Date(b.createdAt) >= today).length,
      revenue: bookings.reduce((acc, b) => acc + (b.totalFare || 0), 0),
      byCarType: [],
    };

    const countByType = {};
    bookings.forEach((b) => {
      const type = b.carType || "Unknown";
      countByType[type] = (countByType[type] || 0) + 1;
    });

    summary.byCarType = Object.entries(countByType).map(([type, count]) => ({
      type,
      count,
    }));

    res.json({ bookings, summary });
  } catch (err) {
    console.error("❌ Error in /admin/bookings:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Mark booking as completed
router.put("/bookings/:id/complete", verifyToken, async (req, res) => {
  try {
    const updated = await Booking.findByIdAndUpdate(
      req.params.id,
      { status: "completed" },
      { new: true }
    );
    if (!updated) return res.status(404).json({ success: false, message: "Booking not found" });
    res.json({ success: true, booking: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to update booking" });
  }
});

// ✅ Delete a booking
router.delete("/bookings/:id", verifyToken, async (req, res) => {
  try {
    const deleted = await Booking.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: "Booking not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to delete booking" });
  }
});

module.exports = router;

