const express = require('express');
const router = express.Router();
const Subject = require('../models/Subject');
const { protect, checkRole } = require('../middleware/auth');

/**
 * @route   GET /api/subjects
 * @desc    Get subjects (optionally filtered by semesterId)
 * @access  Private
 */
router.get('/', protect, async (req, res) => {
  try {
    const filter = {};

    if (req.user.role === 'student') {
      // Students only ever see subjects for their own department and semester
      filter.department = req.user.department;
      filter.semesterId = req.user.semesterId;
    } else {
      // Faculty are scoped to all of their assigned departments; semester and
      // a specific department are optional narrowing filters
      filter.department = { $in: req.user.departments || [] };
      if (req.query.department && (req.user.departments || []).includes(req.query.department)) {
        filter.department = req.query.department;
      }
      if (req.query.semesterId) {
        filter.semesterId = req.query.semesterId;
      }
    }

    const subjects = await Subject.find(filter).populate('semesterId', 'name');
    res.status(200).json({ success: true, data: subjects });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

/**
 * @route   POST /api/subjects
 * @desc    Create a new subject in a semester
 * @access  Private (Faculty only)
 */
router.post('/', protect, checkRole('faculty'), async (req, res) => {
  try {
    const { name, semesterId, department } = req.body;
    if (!name || !semesterId || !department) {
      return res.status(400).json({ success: false, message: 'Please provide name, semesterId, and department' });
    }

    if (!(req.user.departments || []).includes(department)) {
      return res.status(403).json({ success: false, message: 'You are not assigned to this department' });
    }

    const exists = await Subject.findOne({ name, semesterId, department });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Subject name already exists in this semester' });
    }

    const subject = await Subject.create({ name, semesterId, department });
    res.status(201).json({ success: true, data: subject });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

/**
 * @route   DELETE /api/subjects/:id
 * @desc    Delete a subject
 * @access  Private (Faculty only)
 */
router.delete('/:id', protect, checkRole('faculty'), async (req, res) => {
  try {
    const subject = await Subject.findByIdAndDelete(req.params.id);
    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }
    res.status(200).json({ success: true, message: 'Subject deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

module.exports = router;
