const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Subject = require('../models/Subject');
const Chapter = require('../models/Chapter');
const Question = require('../models/Question');
const Department = require('../models/Department');
const Attempt = require('../models/Attempt');
const { protect, checkRole } = require('../middleware/auth');
const liveQuizManager = require('../live/liveQuizManager');

router.use(protect, checkRole('admin'));

/**
 * @route   GET /api/admin/overview
 * @desc    Platform-wide stats across every department
 */
router.get('/overview', async (req, res) => {
  try {
    const [studentCount, facultyCount, departmentCount, subjectCount, chapterCount, questionCount, attemptCount] =
      await Promise.all([
        User.countDocuments({ role: 'student' }),
        User.countDocuments({ role: 'faculty' }),
        Department.countDocuments(),
        Subject.countDocuments(),
        Chapter.countDocuments(),
        Question.countDocuments(),
        Attempt.countDocuments(),
      ]);

    res.status(200).json({
      success: true,
      data: {
        students: studentCount,
        faculty: facultyCount,
        departments: departmentCount,
        subjects: subjectCount,
        chapters: chapterCount,
        questions: questionCount,
        attempts: attemptCount,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

/**
 * @route   GET /api/admin/faculty
 * @desc    List every faculty account
 */
router.get('/faculty', async (req, res) => {
  try {
    const faculty = await User.find({ role: 'faculty' }).select('-password').sort({ createdAt: -1 }).lean();
    res.status(200).json({ success: true, data: faculty });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

/**
 * @route   PATCH /api/admin/faculty/:id/departments
 * @desc    Update which departments a faculty account is assigned to
 */
router.patch('/faculty/:id/departments', async (req, res) => {
  try {
    const { departments } = req.body;
    if (!Array.isArray(departments) || departments.length === 0) {
      return res.status(400).json({ success: false, message: 'Provide a non-empty departments array' });
    }
    const faculty = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'faculty' },
      { departments },
      { new: true, runValidators: true }
    ).select('-password');
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty not found' });
    res.status(200).json({ success: true, data: faculty });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

/**
 * @route   GET /api/admin/students
 * @desc    List every student account, optionally filtered by department/semesterId
 */
router.get('/students', async (req, res) => {
  try {
    const filter = { role: 'student' };
    if (req.query.department) filter.department = req.query.department;
    if (req.query.semesterId) filter.semesterId = req.query.semesterId;
    const students = await User.find(filter)
      .select('-password')
      .populate('semesterId', 'name')
      .sort({ createdAt: -1 })
      .lean();
    res.status(200).json({ success: true, data: students });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

/**
 * @route   DELETE /api/admin/users/:id
 * @desc    Delete any student or faculty account (not other admins)
 */
router.delete('/users/:id', async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ success: false, message: 'User not found' });
    if (target.role === 'admin') {
      return res.status(403).json({ success: false, message: 'Cannot delete another admin account' });
    }
    await target.deleteOne();
    res.status(200).json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

/**
 * @route   GET /api/admin/live-sessions
 * @desc    Snapshot of every currently-running Live Quiz session, platform-wide
 */
router.get('/live-sessions', (req, res) => {
  res.status(200).json({ success: true, data: liveQuizManager.getAllSessions() });
});

module.exports = router;
