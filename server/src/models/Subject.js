const mongoose = require('mongoose');

const SubjectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  semesterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Semester',
    required: true,
  },
  department: {
    type: String,
    required: true,
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Ensure a subject name is unique per semester within a department
SubjectSchema.index({ name: 1, semesterId: 1, department: 1 }, { unique: true });

module.exports = mongoose.model('Subject', SubjectSchema);
