const mongoose = require('mongoose');

const ChapterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  subjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Ensure unique chapter names per subject
ChapterSchema.index({ name: 1, subjectId: 1 }, { unique: true });

module.exports = mongoose.model('Chapter', ChapterSchema);






