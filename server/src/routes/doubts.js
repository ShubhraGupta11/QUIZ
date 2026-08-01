const express = require('express');
const router = express.Router();
const Doubt = require('../models/Doubt');
const Chapter = require('../models/Chapter');
const Subject = require('../models/Subject');
const { protect, checkRole } = require('../middleware/auth');

/**
 * @route   POST /api/doubts
 * @desc    Student asks a doubt about a chapter/question
 * @access  Private (Student only)
 */
router.post('/', protect, checkRole('student'), async (req, res) => {
  try {
    const { chapterId, questionText, message } = req.body;
    if (!chapterId || !message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'chapterId and message are required' });
    }

    const doubt = await Doubt.create({
      studentId: req.user._id,
      chapterId,
      questionText,
      message: message.trim(),
    });

    res.status(201).json({ success: true, data: doubt });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

/**
 * @route   GET /api/doubts/me
 * @desc    Student's own doubts (with faculty answers if any)
 * @access  Private (Student only)
 */
router.get('/me', protect, checkRole('student'), async (req, res) => {
  try {
    const doubts = await Doubt.find({ studentId: req.user._id })
      .populate('chapterId', 'name')
      .populate('answeredBy', 'name')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: doubts });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

/**
 * @route   GET /api/doubts/inbox
 * @desc    Faculty view of open/answered doubts for their own department(s)
 * @access  Private (Faculty or Admin)
 */
router.get('/inbox', protect, checkRole('faculty', 'admin'), async (req, res) => {
  try {
    const subjectFilter = req.user.role === 'admin'
      ? {}
      : { department: { $in: req.user.departments || [] } };
    const ownSubjects = await Subject.find(subjectFilter).select('_id');
    const ownChapters = await Chapter.find({ subjectId: { $in: ownSubjects.map((s) => s._id) } }).select('_id');

    const doubts = await Doubt.find({ chapterId: { $in: ownChapters.map((c) => c._id) } })
      .populate('studentId', 'name email')
      .populate('chapterId', 'name')
      .sort({ status: 1, createdAt: -1 });

    res.status(200).json({ success: true, data: doubts });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

/**
 * @route   PUT /api/doubts/:id/answer
 * @desc    Faculty answers a student's doubt
 * @access  Private (Faculty or Admin)
 */
router.put('/:id/answer', protect, checkRole('faculty', 'admin'), async (req, res) => {
  try {
    const { answer } = req.body;
    if (!answer || !answer.trim()) {
      return res.status(400).json({ success: false, message: 'answer is required' });
    }

    const doubt = await Doubt.findByIdAndUpdate(
      req.params.id,
      { answer: answer.trim(), answeredBy: req.user._id, status: 'answered', answeredAt: new Date() },
      { new: true }
    );

    if (!doubt) {
      return res.status(404).json({ success: false, message: 'Doubt not found' });
    }

    res.status(200).json({ success: true, data: doubt });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

module.exports = router;
