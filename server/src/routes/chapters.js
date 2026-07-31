const express = require('express');
const router = express.Router();
const Chapter = require('../models/Chapter');
const Question = require('../models/Question');
const Subject = require('../models/Subject');
const { protect, checkRole } = require('../middleware/auth');

/**
 * @route   GET /api/chapters
 * @desc    Get chapters (optionally filtered by subjectId)
 * @access  Private
 */
router.get('/', protect, async (req, res) => {
  try {
    const filter = {};
    if (req.query.subjectId) {
      filter.subjectId = req.query.subjectId;

      // Students may only browse chapters of a subject in their own department/semester
      if (req.user.role === 'student') {
        const subject = await Subject.findById(req.query.subjectId);
        if (
          !subject ||
          subject.department !== req.user.department ||
          String(subject.semesterId) !== String(req.user.semesterId)
        ) {
          return res.status(200).json({ success: true, data: [] });
        }
      }
    }
    const chapters = await Chapter.find(filter).populate('subjectId', 'name');

    // Attach the real question count for each chapter
    const counts = await Question.aggregate([
      { $match: { chapterId: { $in: chapters.map((c) => c._id) } } },
      { $group: { _id: '$chapterId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((c) => [String(c._id), c.count]));
    const chaptersWithCounts = chapters.map((c) => ({
      ...c.toObject(),
      questionCount: countMap.get(String(c._id)) || 0,
    }));

    res.status(200).json({ success: true, data: chaptersWithCounts });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

/**
 * @route   POST /api/chapters
 * @desc    Create a new chapter in a subject
 * @access  Private (Faculty only)
 */
router.post('/', protect, checkRole('faculty'), async (req, res) => {
  try {
    const { name, subjectId } = req.body;
    if (!name || !subjectId) {
      return res.status(400).json({ success: false, message: 'Please provide name and subjectId' });
    }

    const exists = await Chapter.findOne({ name, subjectId });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Chapter name already exists in this subject' });
    }

    const chapter = await Chapter.create({ name, subjectId });
    res.status(201).json({ success: true, data: chapter });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

/**
 * @route   DELETE /api/chapters/:id
 * @desc    Delete a chapter
 * @access  Private (Faculty only)
 */
router.delete('/:id', protect, checkRole('faculty'), async (req, res) => {
  try {
    const chapter = await Chapter.findByIdAndDelete(req.params.id);
    if (!chapter) {
      return res.status(404).json({ success: false, message: 'Chapter not found' });
    }
    res.status(200).json({ success: true, message: 'Chapter deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

module.exports = router;
