const mongoose = require('mongoose');

const DoubtSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  chapterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chapter',
    required: true,
  },
  questionText: {
    type: String,
    trim: true,
  },
  message: {
    type: String,
    required: true,
    trim: true,
  },
  answer: {
    type: String,
    trim: true,
  },
  answeredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  status: {
    type: String,
    enum: ['open', 'answered'],
    default: 'open',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  answeredAt: {
    type: Date,
  },
});

module.exports = mongoose.model('Doubt', DoubtSchema);
