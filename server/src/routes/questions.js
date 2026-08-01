const express = require('express');
const router = express.Router();
const Question = require('../models/Question');
const Chapter = require('../models/Chapter');
const Subject = require('../models/Subject');
const { protect, checkRole } = require('../middleware/auth');

// Verify a chapter's subject belongs to the given student's department/semester
async function chapterMatchesStudent(chapterId, user) {
  const chapter = await Chapter.findById(chapterId);
  if (!chapter) return false;
  const subject = await Subject.findById(chapter.subjectId);
  if (!subject) return false;
  return subject.department === user.department && String(subject.semesterId) === String(user.semesterId);
}

// Simple string similarity (normalized Levenshtein) to flag near-duplicate questions
function similarity(a, b) {
  const s1 = a.toLowerCase().trim();
  const s2 = b.toLowerCase().trim();
  if (s1 === s2) return 1;
  const longer = s1.length >= s2.length ? s1 : s2;
  const shorter = s1.length >= s2.length ? s2 : s1;
  if (longer.length === 0) return 1;

  const costs = new Array(shorter.length + 1);
  for (let i = 0; i <= shorter.length; i++) costs[i] = i;
  for (let i = 1; i <= longer.length; i++) {
    let prev = costs[0];
    costs[0] = i;
    for (let j = 1; j <= shorter.length; j++) {
      const temp = costs[j];
      costs[j] = longer[i - 1] === shorter[j - 1]
        ? prev
        : Math.min(prev, costs[j], costs[j - 1]) + 1;
      prev = temp;
    }
  }
  return (longer.length - costs[shorter.length]) / longer.length;
}

// Minimal CSV helpers (no external dependency)
function toCSVField(value) {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

/**
 * @route   GET /api/questions
 * @desc    Get questions for a chapter (hides correctOptionIndex for students).
 *          Supports optional ?search= and ?difficulty= filters.
 * @access  Private
 */
router.get('/', protect, async (req, res) => {
  try {
    const { chapterId, search, difficulty } = req.query;
    if (!chapterId) {
      return res.status(400).json({ success: false, message: 'chapterId is required' });
    }

    if (req.user.role === 'student' && !(await chapterMatchesStudent(chapterId, req.user))) {
      return res.status(200).json({ success: true, data: [] });
    }

    const filter = { chapterId };
    if (search) filter.text = { $regex: search, $options: 'i' };
    if (difficulty) filter.difficulty = difficulty;

    let query = Question.find(filter);

    // Secure the correct answer index from students to prevent client-side inspection tampering
    if (req.user.role === 'student') {
      query = query.select('-correctOptionIndex');
    }

    const questions = await query.lean();
    res.status(200).json({ success: true, data: questions });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

/**
 * @route   GET /api/questions/export
 * @desc    Export all questions for a chapter as CSV
 * @access  Private (Faculty only)
 */
router.get('/export', protect, checkRole('faculty'), async (req, res) => {
  try {
    const { chapterId } = req.query;
    if (!chapterId) {
      return res.status(400).json({ success: false, message: 'chapterId is required' });
    }

    const questions = await Question.find({ chapterId }).sort({ _id: 1 });
    const header = ['text', 'optionA', 'optionB', 'optionC', 'optionD', 'correctOptionIndex', 'marks', 'difficulty'];
    const lines = [header.join(',')];

    questions.forEach((q) => {
      const opts = [0, 1, 2, 3].map((i) => toCSVField(q.options[i] ?? ''));
      lines.push([
        toCSVField(q.text),
        ...opts,
        q.correctOptionIndex,
        q.marks,
        q.difficulty,
      ].join(','));
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="questions-${chapterId}.csv"`);
    res.status(200).send(lines.join('\n'));
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

/**
 * @route   POST /api/questions/bulk-import
 * @desc    Bulk import questions for a chapter from CSV text
 *          (columns: text,optionA,optionB,optionC,optionD,correctOptionIndex,marks,difficulty)
 * @access  Private (Faculty only)
 */
router.post('/bulk-import', protect, checkRole('faculty'), async (req, res) => {
  try {
    const { chapterId, csv } = req.body;
    if (!chapterId || !csv) {
      return res.status(400).json({ success: false, message: 'chapterId and csv are required' });
    }

    const rows = parseCSV(csv.trim());
    if (rows.length < 2) {
      return res.status(400).json({ success: false, message: 'CSV must contain a header row and at least one data row' });
    }

    const header = rows[0].map((h) => h.trim().toLowerCase());
    const dataRows = rows.slice(1);

    const idx = {
      text: header.indexOf('text'),
      a: header.indexOf('optiona'),
      b: header.indexOf('optionb'),
      c: header.indexOf('optionc'),
      d: header.indexOf('optiond'),
      correct: header.indexOf('correctoptionindex'),
      marks: header.indexOf('marks'),
      difficulty: header.indexOf('difficulty'),
    };

    if (idx.text === -1 || idx.a === -1 || idx.b === -1 || idx.correct === -1) {
      return res.status(400).json({ success: false, message: 'CSV header must include at least: text, optionA, optionB, correctOptionIndex' });
    }

    const questionsToInsert = [];
    const errors = [];

    dataRows.forEach((row, i) => {
      const text = (row[idx.text] || '').trim();
      const options = [row[idx.a], row[idx.b], row[idx.c], row[idx.d]]
        .filter((v) => v !== undefined && v !== '');
      const correctOptionIndex = Number(row[idx.correct]);

      if (!text || options.length < 2 || Number.isNaN(correctOptionIndex)) {
        errors.push(`Row ${i + 2}: missing required fields, skipped.`);
        return;
      }

      questionsToInsert.push({
        chapterId,
        text,
        options,
        correctOptionIndex,
        marks: idx.marks !== -1 && row[idx.marks] ? Number(row[idx.marks]) || 2 : 2,
        difficulty: idx.difficulty !== -1 && row[idx.difficulty] ? row[idx.difficulty].trim() : 'medium',
      });
    });

    const saved = questionsToInsert.length > 0 ? await Question.insertMany(questionsToInsert) : [];

    res.status(201).json({
      success: true,
      message: `Imported ${saved.length} question(s).`,
      count: saved.length,
      errors,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

/**
 * @route   POST /api/questions
 * @desc    Create a new question manually. Warns (but does not block, unless force=false
 *          and a near-duplicate exists) about near-duplicate questions in the same chapter.
 * @access  Private (Faculty only)
 */
router.post('/', protect, checkRole('faculty'), async (req, res) => {
  try {
    const { chapterId, text, options, correctOptionIndex, marks, difficulty, force } = req.body;

    if (!chapterId || !text || !options || correctOptionIndex === undefined) {
      return res.status(400).json({ success: false, message: 'Please provide chapterId, text, options, and correctOptionIndex' });
    }

    if (!Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ success: false, message: 'Options must be an array of at least 2 answers' });
    }

    if (!force) {
      const existingQuestions = await Question.find({ chapterId }).select('text');
      const duplicate = existingQuestions.find((q) => similarity(q.text, text) >= 0.85);
      if (duplicate) {
        return res.status(409).json({
          success: false,
          duplicate: true,
          message: 'A very similar question already exists in this chapter.',
          existingText: duplicate.text,
        });
      }
    }

    const question = await Question.create({
      chapterId,
      text,
      options,
      correctOptionIndex,
      marks: marks || 2,
      difficulty: difficulty || 'medium',
    });

    res.status(201).json({ success: true, data: question });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

/**
 * @route   DELETE /api/questions/:id
 * @desc    Delete a question
 * @access  Private (Faculty only)
 */
router.delete('/:id', protect, checkRole('faculty', 'admin'), async (req, res) => {
  try {
    const question = await Question.findByIdAndDelete(req.params.id);
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }
    res.status(200).json({ success: true, message: 'Question deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

module.exports = router;
