const mongoose = require('mongoose');

const SemesterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  department: {
    type: String,
    required: true,
    trim: true,
  },
  order: {
    type: Number,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// A semester name is unique within its own department, not globally
SemesterSchema.index({ name: 1, department: 1 }, { unique: true });

module.exports = mongoose.model('Semester', SemesterSchema);
