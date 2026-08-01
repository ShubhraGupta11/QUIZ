const express = require('express');
const router = express.Router();
const Department = require('../models/Department');
const { protect, checkRole } = require('../middleware/auth');

const SEED_DEPARTMENTS = [
  'Computer Science',
  'Information Technology',
  'Electronics & Communication',
  'Electrical Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'MBA',
  'MCA',
];

// One-time lazy seed so existing registration/faculty flows keep working
// exactly as before, now backed by real data an Admin can manage.
let seeded = false;
async function ensureSeeded() {
  if (seeded) return;
  const count = await Department.countDocuments();
  if (count === 0) {
    await Department.insertMany(SEED_DEPARTMENTS.map((name) => ({ name })));
  }
  seeded = true;
}

/**
 * @route   GET /api/departments
 * @desc    List all departments (public — used by the registration form)
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    await ensureSeeded();
    const departments = await Department.find().sort({ name: 1 }).lean();
    res.status(200).json({ success: true, data: departments });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

/**
 * @route   POST /api/departments
 * @desc    Create a new department
 * @access  Private (Admin only)
 */
router.post('/', protect, checkRole('admin'), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Please provide a department name' });
    }
    const exists = await Department.findOne({ name: name.trim() });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Department already exists' });
    }
    const department = await Department.create({ name: name.trim() });
    res.status(201).json({ success: true, data: department });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

/**
 * @route   DELETE /api/departments/:id
 * @desc    Delete a department
 * @access  Private (Admin only)
 */
router.delete('/:id', protect, checkRole('admin'), async (req, res) => {
  try {
    const department = await Department.findByIdAndDelete(req.params.id);
    if (!department) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }
    res.status(200).json({ success: true, message: 'Department deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

module.exports = router;
