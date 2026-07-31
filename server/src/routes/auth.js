const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// Helper to generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'smartquiz_super_secret_jwt_key_2026', {
    expiresIn: '30d',
  });
};

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user (student or faculty)
 * @access  Public
 */
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, department, departments, semesterId } = req.body;
    const resolvedRole = role || 'student';

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please enter all fields' });
    }

    if (resolvedRole === 'student' && !department) {
      return res.status(400).json({ success: false, message: 'Please enter your department' });
    }
    if (resolvedRole === 'student' && !semesterId) {
      return res.status(400).json({ success: false, message: 'Please select your semester' });
    }

    const resolvedDepartments = Array.isArray(departments)
      ? departments.map((d) => d.trim()).filter(Boolean)
      : [];
    if (resolvedRole === 'faculty' && resolvedDepartments.length === 0) {
      return res.status(400).json({ success: false, message: 'Please select at least one department' });
    }

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    // Create user (password is encrypted pre-save hook)
    const user = await User.create({
      name,
      email,
      password,
      role: resolvedRole,
      department: resolvedRole === 'student' ? department : undefined,
      departments: resolvedRole === 'faculty' ? resolvedDepartments : undefined,
      semesterId: resolvedRole === 'student' ? semesterId : undefined,
    });

    if (user) {
      res.status(201).json({
        success: true,
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        departments: user.departments,
        semesterId: user.semesterId,
        token: generateToken(user._id),
      });
    } else {
      res.status(400).json({ success: false, message: 'Invalid user data' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user & get token
 * @access  Public
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please enter all fields' });
    }

    // Check for user email
    const user = await User.findOne({ email });

    if (user && role && user.role !== role) {
      return res.status(401).json({
        success: false,
        message: `This account is registered as ${user.role}. Please switch to the ${user.role} tab to log in.`,
      });
    }

    if (user && (await user.matchPassword(password))) {
      res.json({
        success: true,
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        departments: user.departments,
        semesterId: user.semesterId,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', protect, async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: req.user,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

module.exports = router;
