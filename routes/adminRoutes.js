// routes/adminRoutes.js

const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");

// POST /api/admin/login
router.post("/login", (req, res) => {
  const { username, password } = req.body;

  // Match against .env
  if (
    username === process.env.ADMIN_ID &&
    password === process.env.ADMIN_PASSWORD
  ) {
    const token = jwt.sign({ username }, process.env.JWT_SECRET || "fallback_secret", {
      expiresIn: "1d",
    });

    return res.json({ success: true, token });
  }

  res.status(401).json({ success: false, message: "Invalid credentials" });
});

module.exports = router;

