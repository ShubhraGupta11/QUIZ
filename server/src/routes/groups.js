const express = require('express');
const router = express.Router();
const Group = require('../models/Group');
const Attempt = require('../models/Attempt');
const { protect, checkRole } = require('../middleware/auth');

/**
 * @route   POST /api/groups
 * @desc    Create a study group (creator auto-joins)
 * @access  Private (Student only)
 */
router.post('/', protect, checkRole('student'), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'name is required' });
    }

    let group;
    // Retry on the rare code collision instead of trusting a single random draw
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        group = await Group.create({ name: name.trim(), createdBy: req.user._id, members: [req.user._id] });
        break;
      } catch (err) {
        if (err.code !== 11000) throw err;
      }
    }
    if (!group) {
      return res.status(500).json({ success: false, message: 'Could not generate a unique group code, please try again.' });
    }

    res.status(201).json({ success: true, data: group });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

/**
 * @route   POST /api/groups/join
 * @desc    Join a study group by its code
 * @access  Private (Student only)
 */
router.post('/join', protect, checkRole('student'), async (req, res) => {
  try {
    const { code } = req.body;
    if (!code || !code.trim()) {
      return res.status(400).json({ success: false, message: 'code is required' });
    }

    const group = await Group.findOne({ code: code.trim().toUpperCase() });
    if (!group) {
      return res.status(404).json({ success: false, message: 'No group found with that code' });
    }

    if (!group.members.some((m) => String(m) === String(req.user._id))) {
      group.members.push(req.user._id);
      await group.save();
    }

    res.status(200).json({ success: true, data: group });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

/**
 * @route   GET /api/groups/mine
 * @desc    List groups the current student belongs to
 * @access  Private (Student only)
 */
router.get('/mine', protect, checkRole('student'), async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user._id }).populate('members', 'name email');
    res.status(200).json({ success: true, data: groups });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

/**
 * @route   GET /api/groups/:id/leaderboard
 * @desc    Group members ranked by overall average score across all their attempts
 * @access  Private (member only)
 */
router.get('/:id/leaderboard', protect, checkRole('student'), async (req, res) => {
  try {
    const group = await Group.findById(req.params.id).populate('members', 'name email');
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }
    if (!group.members.some((m) => String(m._id) === String(req.user._id))) {
      return res.status(403).json({ success: false, message: 'You are not a member of this group' });
    }

    const memberStats = await Promise.all(
      group.members.map(async (member) => {
        const attempts = await Attempt.find({ studentId: member._id });
        const totalAttempts = attempts.length;
        const avgPercent = totalAttempts > 0
          ? Math.round(attempts.reduce((sum, a) => sum + (a.total > 0 ? (a.score / a.total) * 100 : 0), 0) / totalAttempts)
          : 0;
        return { studentId: member._id, name: member.name, totalAttempts, avgPercent, isMe: String(member._id) === String(req.user._id) };
      })
    );

    memberStats.sort((a, b) => b.avgPercent - a.avgPercent || b.totalAttempts - a.totalAttempts);

    res.status(200).json({ success: true, data: { group: { _id: group._id, name: group.name, code: group.code }, members: memberStats } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

module.exports = router;
