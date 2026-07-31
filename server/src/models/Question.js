const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
  chapterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chapter',
    required: true,
  },
  text: {
    type: String,
    required: true,
    trim: true,
  },
  options: {
    type: [String],
    required: true,
    validate: [
      (val) => val.length >= 2,
      'A question must have at least 2 options.'
    ],
  },
  correctOptionIndex: {
    type: Number,
    required: true,
    min: 0,
  },
  marks: {
    type: Number,
    default: 2,
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Question', QuestionSchema);
