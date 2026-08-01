const express = require('express');
const router = express.Router();
const Subject = require('../models/Subject');
const Chapter = require('../models/Chapter');
const Question = require('../models/Question');
const { protect, checkRole } = require('../middleware/auth');

/**
 * @route   GET /api/stats/faculty-overview
 * @desc    Aggregate counts (semesters/subjects/chapters/questions) for the
 *          logged-in faculty's own department(s), computed in a small fixed
 *          number of queries instead of the client fetching chapters per
 *          subject one request at a time.
 * @access  Private (Faculty only)
 */
router.get('/faculty-overview', protect, checkRole('faculty'), async (req, res) => {
  try {
    const departments = req.user.departments || [];

    const subjects = await Subject.find({ department: { $in: departments } })
      .select('_id semesterId')
      .lean();
    const subjectIds = subjects.map((s) => s._id);
    const distinctSemesters = new Set(subjects.map((s) => String(s.semesterId)));

    const chapters = await Chapter.find({ subjectId: { $in: subjectIds } }).select('_id').lean();
    const chapterIds = chapters.map((c) => c._id);

    const questionCount = await Question.countDocuments({ chapterId: { $in: chapterIds } });

    res.status(200).json({
      success: true,
      data: {
        semesters: distinctSemesters.size,
        subjects: subjects.length,
        chapters: chapters.length,
        questions: questionCount,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

module.exports = router;
