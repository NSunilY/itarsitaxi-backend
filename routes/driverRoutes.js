// routes/driverRoutes.js
const express = require('express');
const router = express.Router();
const Driver = require('../models/Driver');

const multer = require('multer');
const { storage } = require('../config/cloudinary');
const upload = multer({ storage });

// ✅ Get all drivers
router.get('/', async (req, res) => {
  try {
    const drivers = await Driver.find().sort({ createdAt: -1 });
    res.json(drivers);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch drivers.' });
  }
});

// ✅ Add new driver
router.post('/', async (req, res) => {
  try {
    const newDriver = new Driver(req.body);
    const savedDriver = await newDriver.save();
    res.status(201).json(savedDriver);
  } catch (err) {
    console.error('Add driver error:', err.message);
    res.status(500).json({ error: 'Failed to add driver.' });
  }
});

// ✅ Update driver
router.put('/:id', async (req, res) => {
  try {
    const updatedDriver = await Driver.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updatedDriver);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update driver.' });
  }
});

// ✅ Delete driver
router.delete('/:id', async (req, res) => {
  try {
    await Driver.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete driver.' });
  }
});

// ✅ Upload documents (RC, DL, Insurance, PUC)
router.post('/:id/upload', upload.fields([
  { name: 'rc' },
  { name: 'dl' },
  { name: 'insurance' },
  { name: 'puc' }
]), async (req, res) => {
  try {
    const updates = {};
    if (req.files.rc) updates.rcUrl = req.files.rc[0].path;
    if (req.files.dl) updates.dlUrl = req.files.dl[0].path;
    if (req.files.insurance) updates.insuranceUrl = req.files.insurance[0].path;
    if (req.files.puc) updates.pucUrl = req.files.puc[0].path;

    const driver = await Driver.findByIdAndUpdate(req.params.id, updates, { new: true });
    res.json(driver);
  } catch (err) {
    console.error('Upload error:', err.message);
    res.status(500).json({ error: 'Upload failed' });
  }
});

module.exports = router;

