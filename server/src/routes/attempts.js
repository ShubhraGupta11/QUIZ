const express = require('express');
const router = express.Router();
const Attempt = require('../models/Attempt');
const Question = require('../models/Question');
const Chapter = require('../models/Chapter');
const Subject = require('../models/Subject');
const User = require('../models/User');
const { protect, checkRole } = require('../middleware/auth');

/**
 * @route   POST /api/attempts
 * @desc    Submit a completed quiz attempt and calculate score server-side
 * @access  Private (Students only)
 */
router.post('/', protect, checkRole('student'), async (req, res) => {
  try {
    const { chapterId, answers, timeTaken, practice, negativeMarking } = req.body;

    if (!chapterId || !answers || timeTaken === undefined) {
      return res.status(400).json({ success: false, message: 'Please provide chapterId, answers array, and timeTaken' });
    }

    // Ensure the chapter belongs to this student's own department/semester
    const chapterForCheck = await Chapter.findById(chapterId);
    const subjectForCheck = chapterForCheck ? await Subject.findById(chapterForCheck.subjectId) : null;
    if (
      !subjectForCheck ||
      subjectForCheck.department !== req.user.department ||
      String(subjectForCheck.semesterId) !== String(req.user.semesterId)
    ) {
      return res.status(403).json({ success: false, message: 'This chapter is not available for your semester/department' });
    }

    // Fetch the correct answers from the database to prevent client tampering
    const questions = await Question.find({ chapterId }).sort({ _id: 1 });
    if (questions.length === 0) {
      return res.status(404).json({ success: false, message: 'No questions found for this chapter' });
    }

    let score = 0;
    let totalMarks = 0;
    const evaluation = [];

    // Evaluate answers. With negative marking on, each wrong (but attempted) answer
    // deducts 1 mark — unanswered questions are never penalized.
    questions.forEach((question, index) => {
      const studentAnswer = answers[index];
      const wasAnswered = studentAnswer !== undefined && studentAnswer !== null;
      const isCorrect = studentAnswer === question.correctOptionIndex;
      const questionMarks = question.marks || 2;

      if (isCorrect) {
        score += questionMarks;
      } else if (negativeMarking && wasAnswered) {
        score -= 1;
      }
      totalMarks += questionMarks;

      evaluation.push({
        questionId: question._id,
        text: question.text,
        options: question.options,
        studentAnswer: studentAnswer !== undefined ? studentAnswer : null,
        correctOptionIndex: question.correctOptionIndex,
        isCorrect,
        marks: questionMarks,
      });
    });

    score = Math.max(0, score);

    // In practice mode, skip persisting the attempt so it doesn't affect history/leaderboards
    let attempt = null;
    if (!practice) {
      attempt = await Attempt.create({
        studentId: req.user._id,
        chapterId,
        score,
        total: totalMarks,
        timeTaken,
        answers,
      });
    }

    res.status(201).json({
      success: true,
      data: {
        attemptId: attempt ? attempt._id : null,
        practice: !!practice,
        score,
        total: totalMarks,
        timeTaken,
        evaluation,
        createdAt: attempt ? attempt.createdAt : new Date(),
      },
    });
  } catch (error) {
    console.error('Error submitting quiz attempt:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

/**
 * @route   GET /api/attempts/me
 * @desc    Get current student's attempt history
 * @access  Private (Student only)
 */
router.get('/me', protect, checkRole('student'), async (req, res) => {
  try {
    const attempts = await Attempt.find({ studentId: req.user._id })
      .populate({
        path: 'chapterId',
        select: 'name',
        populate: {
          path: 'subjectId',
          select: 'name',
          populate: {
            path: 'semesterId',
            select: 'name'
          }
        },
      })
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: attempts });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

/**
 * @route   GET /api/attempts/reports
 * @desc    Get aggregate class performance reports. Faculty see only their own
 *          department(s); Admin sees every department platform-wide.
 * @access  Private (Faculty or Admin)
 */
router.get('/reports', protect, checkRole('faculty', 'admin'), async (req, res) => {
  try {
    // Admins see every department; faculty are scoped to their own department(s)
    const subjectFilter = req.user.role === 'admin'
      ? {}
      : { department: { $in: req.user.departments || [] } };
    const ownSubjects = await Subject.find(subjectFilter).select('_id');
    const ownChapters = await Chapter.find({ subjectId: { $in: ownSubjects.map((s) => s._id) } }).select('_id');

    const attempts = await Attempt.find({ chapterId: { $in: ownChapters.map((c) => c._id) } })
      .populate('studentId', 'name email')
      .populate({
        path: 'chapterId',
        select: 'name',
        populate: {
          path: 'subjectId',
          select: 'name',
          populate: {
            path: 'semesterId',
            select: 'name'
          }
        },
      })
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: attempts });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

/**
 * @route   GET /api/attempts/leaderboard/:chapterId
 * @desc    Top scorers for a chapter (best attempt per student)
 * @access  Private
 */
router.get('/leaderboard/:chapterId', protect, async (req, res) => {
  try {
    const { chapterId } = req.params;
    const attempts = await Attempt.find({ chapterId: chapterId })
      .populate('studentId', 'name email')
      .sort({ score: -1, timeTaken: 1 });

    // Keep only each student's best attempt
    const bestByStudent = new Map();
    attempts.forEach((a) => {
      if (!a.studentId) return;
      const key = String(a.studentId._id);
      const existing = bestByStudent.get(key);
      if (!existing || a.score > existing.score || (a.score === existing.score && a.timeTaken < existing.timeTaken)) {
        bestByStudent.set(key, a);
      }
    });

    const leaderboard = Array.from(bestByStudent.values())
      .sort((a, b) => b.score - a.score || a.timeTaken - b.timeTaken)
      .slice(0, 20)
      .map((a, index) => ({
        rank: index + 1,
        studentId: a.studentId._id,
        name: a.studentId.name,
        score: a.score,
        total: a.total,
        timeTaken: a.timeTaken,
        isMe: String(a.studentId._id) === String(req.user._id),
      }));

    res.status(200).json({ success: true, data: leaderboard });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

/**
 * @route   GET /api/attempts/analysis/:chapterId
 * @desc    Per-question item analysis (accuracy, common wrong answer) for a chapter
 * @access  Private (Faculty only)
 */
router.get('/analysis/:chapterId', protect, checkRole('faculty', 'admin'), async (req, res) => {
  try {
    const { chapterId } = req.params;
    const questions = await Question.find({ chapterId }).sort({ _id: 1 });
    const attempts = await Attempt.find({ chapterId });

    const analysis = questions.map((q, index) => {
      let correctCount = 0;
      let attemptedCount = 0;
      const optionCounts = new Array(q.options.length).fill(0);

      attempts.forEach((att) => {
        const ans = att.answers[index];
        if (ans === null || ans === undefined) return;
        attemptedCount += 1;
        if (ans >= 0 && ans < optionCounts.length) optionCounts[ans] += 1;
        if (ans === q.correctOptionIndex) correctCount += 1;
      });

      return {
        questionId: q._id,
        text: q.text,
        difficulty: q.difficulty,
        correctOptionIndex: q.correctOptionIndex,
        options: q.options,
        attemptedCount,
        correctCount,
        accuracy: attemptedCount > 0 ? Math.round((correctCount / attemptedCount) * 100) : null,
        optionCounts,
      };
    });

    res.status(200).json({ success: true, data: analysis });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

/**
 * @route   GET /api/attempts/class-average/:chapterId
 * @desc    Average score percentage across all students for a chapter
 * @access  Private
 */
router.get('/class-average/:chapterId', protect, async (req, res) => {
  try {
    const { chapterId } = req.params;
    const attempts = await Attempt.find({ chapterId });

    if (attempts.length === 0) {
      return res.status(200).json({ success: true, data: { averagePercent: null, attemptCount: 0 } });
    }

    const totalPercent = attempts.reduce((sum, a) => sum + (a.total > 0 ? (a.score / a.total) * 100 : 0), 0);
    const averagePercent = Math.round(totalPercent / attempts.length);

    res.status(200).json({ success: true, data: { averagePercent, attemptCount: attempts.length } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

module.exports = router;
