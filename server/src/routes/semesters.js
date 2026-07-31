const express = require('express');
const router = express.Router();
const Semester = require('../models/Semester');
const { protect, checkRole } = require('../middleware/auth');

const DEFAULT_SEMESTER_NAMES = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th'];

// A department may have no semesters yet if no faculty has created any manually.
// Auto-seed the standard Semester 1-7 the first time a department is queried, so
// students always see a full semester list at registration regardless of whether
// faculty has touched that department yet.
async function ensureDefaultSemesters(department) {
  const existing = await Semester.countDocuments({ department });
  if (existing > 0) return;
  await Semester.insertMany(
    DEFAULT_SEMESTER_NAMES.map((name, i) => ({ name, order: i + 1, department }))
  );
}

/**
 * @route   GET /api/semesters
 * @desc    Get semesters for a department, ordered by their designated sorting order.
 *          Public (used by the registration form before login) but requires a
 *          department query param since semesters are scoped per department.
 *          Logged-in faculty may omit it to see semesters across all their departments.
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const filter = {};

    if (req.query.department) {
      await ensureDefaultSemesters(req.query.department);
      filter.department = req.query.department;
    } else {
      // No department specified: try to scope to the logged-in user, if any
      const token = req.headers.authorization?.startsWith('Bearer')
        ? req.headers.authorization.split(' ')[1]
        : null;
      if (token) {
        try {
          const jwt = require('jsonwebtoken');
          const User = require('../models/User');
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'smartquiz_super_secret_jwt_key_2026');
          const user = await User.findById(decoded.id);
          if (user?.role === 'student') {
            await ensureDefaultSemesters(user.department);
            filter.department = user.department;
          } else if (user?.role === 'faculty') {
            await Promise.all((user.departments || []).map(ensureDefaultSemesters));
            filter.department = { $in: user.departments || [] };
          }
        } catch {
          // Invalid/missing token: fall through with no department filter
        }
      }
    }

    const semesters = await Semester.find(filter).sort({ order: 1 });
    res.status(200).json({ success: true, data: semesters });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

/**
 * @route   POST /api/semesters
 * @desc    Create a new semester in one of the faculty's own departments
 * @access  Private (Faculty only)
 */
router.post('/', protect, checkRole('faculty'), async (req, res) => {
  try {
    const { name, order, department } = req.body;
    if (!name || order === undefined || !department) {
      return res.status(400).json({ success: false, message: 'Please provide semester name, order, and department' });
    }

    if (!(req.user.departments || []).includes(department)) {
      return res.status(403).json({ success: false, message: 'You are not assigned to this department' });
    }

    const exists = await Semester.findOne({ name, department });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Semester name already exists in this department' });
    }

    const semester = await Semester.create({ name, order, department });
    res.status(201).json({ success: true, data: semester });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

/**
 * @route   DELETE /api/semesters/:id
 * @desc    Delete a semester (must belong to one of the faculty's own departments)
 * @access  Private (Faculty only)
 */
router.delete('/:id', protect, checkRole('faculty'), async (req, res) => {
  try {
    const semester = await Semester.findById(req.params.id);
    if (!semester) {
      return res.status(404).json({ success: false, message: 'Semester not found' });
    }
    if (!(req.user.departments || []).includes(semester.department)) {
      return res.status(403).json({ success: false, message: 'You are not assigned to this department' });
    }
    await semester.deleteOne();
    res.status(200).json({ success: true, message: 'Semester deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

module.exports = router;
