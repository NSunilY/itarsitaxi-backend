// routes/adminRoutes.js
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");

// POST /api/admin/login
router.post("/login", (req, res) => {
  const { adminId, adminPassword } = req.body;

  if (
    adminId === process.env.ADMIN_ID &&
    adminPassword === process.env.ADMIN_PASSWORD
  ) {
    const token = jwt.sign(
      { adminId },
      process.env.JWT_SECRET || "fallback_secret",
      { expiresIn: "1d" }
    );

    return res.json({ success: true, token });
  }

  res.status(401).json({ success: false, message: "Invalid credentials" });
});

module.exports = router;

