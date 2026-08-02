const express = require('express');
const router = express.Router();
const multer = require('multer');
const pdfParse = require('pdf-parse');
const AdmZip = require('adm-zip');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { protect, checkRole } = require('../middleware/auth');
const Chapter = require('../models/Chapter');
const Question = require('../models/Question');

// Multer configuration for file uploads (in-memory storage)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === 'application/pdf' ||
      file.mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ) {
      cb(null, true);
    } else if (file.mimetype === 'application/vnd.ms-powerpoint') {
      cb(new Error('Legacy .ppt files are not supported for text extraction — please save as .pptx and re-upload.'), false);
    } else {
      cb(new Error('Only PDF and PPTX files are supported'), false);
    }
  },
});

// Helper to extract text from PDF buffer
async function extractTextFromPDF(buffer) {
  try {
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw new Error('Failed to parse PDF file');
  }
}

// Helper to extract real text content from a .pptx file. PPTX is a zip archive
// of XML — each slide's spoken/visible text lives in <a:t> tags in
// ppt/slides/slideN.xml. Legacy binary .ppt files aren't zip-based and can't be
// parsed this way, so those are rejected with a clear message asking for .pptx.
function extractTextFromPPTX(buffer) {
  const zip = new AdmZip(buffer);
  const slideEntries = zip
    .getEntries()
    .filter((e) => /^ppt\/slides\/slide\d+\.xml$/.test(e.entryName))
    .sort((a, b) => {
      const numA = parseInt(a.entryName.match(/slide(\d+)\.xml/)[1], 10);
      const numB = parseInt(b.entryName.match(/slide(\d+)\.xml/)[1], 10);
      return numA - numB;
    });

  if (slideEntries.length === 0) {
    throw new Error('No slides found in this PPTX file.');
  }

  const slideTexts = slideEntries.map((entry, i) => {
    const xml = entry.getData().toString('utf8');
    const matches = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]);
    return `--- Slide ${i + 1} ---\n${matches.join(' ')}`;
  });

  return slideTexts.join('\n\n');
}

// Ask OpenRouter's free-tier LLM to generate a batch of MCQs as raw JSON.
// Used when GEMINI_API_KEY isn't set (or Gemini errors out), so generation
// still reflects the real subject/semester/chapter context instead of
// falling straight to generic templates.
async function generateWithOpenRouter(prompt) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free',
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenRouter error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  let text = data.choices?.[0]?.message?.content?.trim() || '';
  if (text.startsWith('```')) {
    text = text.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
  }
  return text;
}

// Fallback generator when no AI provider is configured or all providers fail
function generateMockQuestions(chapterName, count, difficulty) {
  const diff = difficulty || 'medium';
  const mockQuestions = [];

  // Generic template bank
  const templates = [
    {
      text: "Which of the following is a key feature of {chapter}?",
      options: ["Increased latency", "Robust validation and efficiency", "No support for indexing", "Single-threaded constraints"],
      correctOptionIndex: 1,
    },
    {
      text: "In the context of {chapter}, what does the term 'optimization' primarily refer to?",
      options: ["Making the code harder to read", "Improving execution speed and reducing memory footprint", "Adding more decorative comments", "Converting all variables to global scope"],
      correctOptionIndex: 1,
    },
    {
      text: "What is a common bottleneck encountered in {chapter} implementations?",
      options: ["CPU cache alignment", "Excessive network roundtrips", "Disk I/O and unindexed lookups", "All of the above"],
      correctOptionIndex: 3,
    },
    {
      text: "Which protocol or standard is most commonly associated with {chapter}?",
      options: ["SMTP", "HTTP/JSON", "IEEE 802.11", "RFC 793 (TCP)"],
      correctOptionIndex: 1,
    },
    {
      text: "What is the time complexity of a standard search operation in a balanced structure under {chapter}?",
      options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
      correctOptionIndex: 1,
    }
  ];

  for (let i = 0; i < count; i++) {
    const template = templates[i % templates.length];
    const qText = template.text.replace('{chapter}', chapterName);
    mockQuestions.push({
      text: `${qText} (Auto-generated Question #${i + 1})`,
      options: [...template.options],
      correctOptionIndex: template.correctOptionIndex,
      marks: 2,
      difficulty: diff === 'mixed' ? ['easy', 'medium', 'hard'][i % 3] : diff
    });
  }

  return mockQuestions;
}

/**
 * @route   POST /api/faculty/generate-mcqs
 * @desc    Generate 100 MCQs automatically for a chapter via Gemini AI (or PDF/PPT content)
 * @access  Private (Faculty only)
 */
router.post(
  '/generate-mcqs',
  protect,
  checkRole('faculty'),
  upload.single('file'),
  async (req, res) => {
    try {
      const { chapterId, difficulty = 'mixed' } = req.body;
      const requestedCount = Math.min(Math.max(parseInt(req.body.count, 10) || 100, 5), 100);

      if (!chapterId) {
        return res.status(400).json({ success: false, message: 'chapterId is required' });
      }

      // Fetch chapter details for rich contextual prompting
      const chapter = await Chapter.findById(chapterId).populate({
        path: 'subjectId',
        populate: { path: 'semesterId' }
      });

      if (!chapter) {
        return res.status(404).json({ success: false, message: 'Chapter not found' });
      }

      const chapterName = chapter.name;
      const subjectName = chapter.subjectId ? chapter.subjectId.name : 'General Subject';
      const semesterName = (chapter.subjectId && chapter.subjectId.semesterId)
        ? chapter.subjectId.semesterId.name
        : 'General Semester';

      let docContext = '';
      if (req.file) {
        try {
          docContext = req.file.mimetype === 'application/pdf'
            ? await extractTextFromPDF(req.file.buffer)
            : extractTextFromPPTX(req.file.buffer);
        } catch (extractErr) {
          return res.status(400).json({ success: false, message: 'Failed to read the uploaded file: ' + extractErr.message });
        }
        if (!docContext || !docContext.trim()) {
          return res.status(400).json({ success: false, message: 'Could not extract any text from the uploaded file. It may be scanned/image-based or empty.' });
        }
        // Limit context size to avoid exceeding LLM context token limits
        if (docContext.length > 50000) {
          docContext = docContext.substring(0, 50000) + '... [content truncated]';
        }
      }

      const geminiKey = process.env.GEMINI_API_KEY;
      const genAI = geminiKey ? new GoogleGenerativeAI(geminiKey) : null;
      const geminiModel = genAI ? genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }) : null;

      // Fetch already-existing questions in this chapter so new questions don't repeat them.
      const existingQuestions = await Question.find({ chapterId: chapter._id }).select('text').limit(300);
      const seenTexts = new Set(existingQuestions.map((q) => normalizeText(q.text)));
      const existingTextsForPrompt = existingQuestions.slice(0, 40).map((q) => q.text);

      // Split into batches of at most 20 (smaller batches = faster individual responses,
      // and running them in PARALLEL below, instead of sequentially, is what actually
      // makes bulk generation fast).
      const MAX_BATCH = 20;
      const batchSizes = [];
      let remaining = requestedCount;
      while (remaining > 0) {
        const size = Math.min(MAX_BATCH, remaining);
        batchSizes.push(size);
        remaining -= size;
      }
      const difficulties = batchSizes.map((_, i) => {
        if (difficulty !== 'mixed') return difficulty;
        const cycle = ['easy', 'medium', 'medium', 'hard'];
        return cycle[i % cycle.length];
      });

      console.log(`Starting AI generation for chapter: "${chapterName}" (${requestedCount} questions) in ${batchSizes.length} parallel batch(es)...`);

      function buildPrompt(batchSize, batchDiff, avoidList) {
        return `You are an expert college professor and academic examiner.
Generate exactly ${batchSize} high-quality Multiple Choice Questions (MCQs) for the chapter "${chapterName}" under the subject "${subjectName}" for students of "${semesterName}".
The difficulty of this batch of questions must be: ${batchDiff.toUpperCase()}.

${docContext ? `IMPORTANT: The following is the exact reference material uploaded by the instructor. You MUST read and understand this material first, and base every question strictly and only on facts, definitions, examples, and concepts explicitly present in this text. Spread your questions across DIFFERENT sections/paragraphs of the text below so they cover the whole document, not just the beginning. Do NOT introduce outside knowledge, do NOT make up details not present in the text, and do NOT ask about anything the text does not cover. Every correct answer must be directly verifiable from this text.\n\n---START REFERENCE TEXT---\n${docContext}\n---END REFERENCE TEXT---\n\n` : `Base the questions on standard, factually correct academic knowledge of "${chapterName}" as taught under "${subjectName}" for "${semesterName}".\n\n`}
${avoidList && avoidList.length ? `Do NOT repeat, rephrase, or duplicate any of these already-existing questions:\n${avoidList.map((t) => `- ${t}`).join('\n')}\n\n` : ''}
Vary the phrasing and question style (definitions, application, comparison, cause-effect, scenario-based) so consecutive questions never look alike.

Each question must contain:
1. "text": The question string.
2. "options": An array of exactly 4 strings.
3. "correctOptionIndex": A number between 0 and 3 corresponding to the correct answer option index.
4. "marks": A number value of 2.
5. "difficulty": A string value of "${batchDiff}".

Return the output as a strict raw JSON array of objects without any markdown formatting wrappers (DO NOT wrap in \`\`\`json or \`\`\`). The JSON structure must match this format:
[
  {
    "text": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctOptionIndex": 1,
    "marks": 2,
    "difficulty": "${batchDiff}"
  }
]`;
      }

      const BATCH_TIMEOUT_MS = 25000;

      async function runBatch(batchSize, batchDiff, batchIndex) {
        const prompt = buildPrompt(batchSize, batchDiff, existingTextsForPrompt);

        const callAI = async () => {
          let cleanJson = null;
          if (geminiModel) {
            const result = await geminiModel.generateContent(prompt);
            cleanJson = result.response.text().trim();
          } else {
            cleanJson = await generateWithOpenRouter(prompt);
          }
          if (!cleanJson) throw new Error('No AI provider configured (set GEMINI_API_KEY or OPENROUTER_API_KEY)');
          if (cleanJson.startsWith('```')) {
            cleanJson = cleanJson.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
          }
          const parsed = JSON.parse(cleanJson);
          if (!Array.isArray(parsed)) throw new Error('Response is not a JSON array');
          return parsed;
        };

        const result = await withTimeout(callAI, BATCH_TIMEOUT_MS);

        if (result) {
          console.log(`Batch ${batchIndex + 1}/${batchSizes.length}: generated ${result.length} questions via ${geminiModel ? 'Gemini' : 'OpenRouter'}`);
          return result;
        }

        // AI failed or timed out for this batch — fall back to content-grounded
        // questions built directly from the uploaded document (if any) rather than
        // generic templates, so the fallback still reflects what was uploaded.
        console.log(`Batch ${batchIndex + 1}/${batchSizes.length}: AI failed/timed out, using fallback`);
        if (docContext) {
          const grounded = generateContentGroundedQuestions(docContext, batchSize, batchDiff);
          if (grounded.length > 0) return grounded;
        }
        return generateMockQuestions(chapterName, batchSize, batchDiff);
      }

      const batchResults = await Promise.all(
        batchSizes.map((batchSize, i) => runBatch(batchSize, difficulties[i], i))
      );

      let generatedQuestions = dedupeQuestions(batchResults.flat(), seenTexts);

      // If duplicates/failures left us short, top up (also deduped) until we hit the count
      // or we run out of reasonable attempts.
      let topUpAttempts = 0;
      while (generatedQuestions.length < requestedCount && topUpAttempts < 3) {
        const stillNeeded = requestedCount - generatedQuestions.length;
        const topUpDiff = difficulty === 'mixed' ? 'medium' : difficulty;
        const topUp = docContext
          ? generateContentGroundedQuestions(docContext, stillNeeded * 2, topUpDiff)
          : generateMockQuestions(chapterName, stillNeeded * 2, topUpDiff);
        const deduped = dedupeQuestions(topUp, seenTexts);
        generatedQuestions = generatedQuestions.concat(deduped);
        topUpAttempts += 1;
        if (deduped.length === 0) break; // can't generate more unique content, stop trying
      }

      // Ensure we truncate to exactly the requested count if there was any drift
      if (generatedQuestions.length > requestedCount) {
        generatedQuestions = generatedQuestions.slice(0, requestedCount);
      }

      // Normalize shape and attach a temporary client-side id — NOTHING is saved to the
      // database here. Generation only produces a preview; the faculty reviews it and
      // explicitly chooses which questions to upload via POST /api/questions/bulk-save.
      const previewQuestions = generatedQuestions.map((q, i) => ({
        tempId: `gen-${Date.now()}-${i}`,
        text: q.text,
        options: q.options && q.options.length === 4 ? q.options : ['Option A', 'Option B', 'Option C', 'Option D'],
        correctOptionIndex: typeof q.correctOptionIndex === 'number' && q.correctOptionIndex >= 0 && q.correctOptionIndex <= 3 ? q.correctOptionIndex : 0,
        marks: q.marks || 2,
        difficulty: q.difficulty || 'medium',
      }));

      return res.status(200).json({
        success: true,
        message: `Generated ${previewQuestions.length} MCQs for chapter "${chapterName}". Review them and choose which to upload.`,
        count: previewQuestions.length,
        questions: previewQuestions,
      });

    } catch (error) {
      console.error('Error generating MCQs:', error);
      res.status(500).json({ success: false, message: 'Server error generating MCQs: ' + error.message });
    }
  }
);

/**
 * @route   POST /api/faculty/generate-single
 * @desc    Generate (and save) a single question for a chapter via Gemini AI
 * @access  Private (Faculty only)
 */
router.post('/generate-single', protect, checkRole('faculty'), async (req, res) => {
  try {
    const { chapterId, difficulty = 'medium' } = req.body;
    if (!chapterId) {
      return res.status(400).json({ success: false, message: 'chapterId is required' });
    }

    const chapter = await Chapter.findById(chapterId).populate({
      path: 'subjectId',
      populate: { path: 'semesterId' }
    });
    if (!chapter) {
      return res.status(404).json({ success: false, message: 'Chapter not found' });
    }

    const chapterName = chapter.name;
    const subjectName = chapter.subjectId ? chapter.subjectId.name : 'General Subject';
    const semesterName = (chapter.subjectId && chapter.subjectId.semesterId)
      ? chapter.subjectId.semesterId.name
      : 'General Semester';
    const geminiKey = process.env.GEMINI_API_KEY;

    // Avoid regenerating a question that already exists in this chapter.
    const existingQuestions = await Question.find({ chapterId: chapter._id }).select('text').limit(300);
    const seenTexts = new Set(existingQuestions.map((q) => normalizeText(q.text)));
    const existingTextsForPrompt = existingQuestions.slice(0, 40).map((q) => q.text);

    const prompt = `Generate exactly 1 high-quality Multiple Choice Question for the chapter "${chapterName}" under subject "${subjectName}" for students of "${semesterName}".
Difficulty: ${difficulty}.
${existingTextsForPrompt.length ? `Do NOT repeat or rephrase any of these already-existing questions:\n${existingTextsForPrompt.map((t) => `- ${t}`).join('\n')}\n\n` : ''}Return strict raw JSON (no markdown) matching:
{"text": "...", "options": ["A","B","C","D"], "correctOptionIndex": 0, "marks": 2, "difficulty": "${difficulty}"}`;

    let question;
    try {
      let cleanJson = null;
      if (geminiKey) {
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await withTimeout(() => model.generateContent(prompt).then((r) => r.response.text().trim()), 20000);
        cleanJson = result;
        if (cleanJson && cleanJson.startsWith('```')) {
          cleanJson = cleanJson.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
        }
      } else {
        cleanJson = await withTimeout(() => generateWithOpenRouter(prompt), 20000);
      }
      if (!cleanJson) throw new Error('No AI provider configured or request timed out');
      question = JSON.parse(cleanJson);
      if (seenTexts.has(normalizeText(question.text))) {
        throw new Error('AI returned a duplicate question, using fallback instead');
      }
    } catch (err) {
      console.error('Single question AI generation failed, using fallback:', err.message);
      // Try a few mock candidates until we find one not already in the chapter
      const candidates = generateMockQuestions(chapterName, 5, difficulty);
      question = candidates.find((c) => !seenTexts.has(normalizeText(c.text))) || candidates[0];
    }

    const saved = await Question.create({
      chapterId: chapter._id,
      text: question.text,
      options: question.options && question.options.length === 4 ? question.options : ['Option A', 'Option B', 'Option C', 'Option D'],
      correctOptionIndex: typeof question.correctOptionIndex === 'number' ? question.correctOptionIndex : 0,
      marks: question.marks || 2,
      difficulty: question.difficulty || difficulty,
    });

    res.status(201).json({ success: true, data: saved });
  } catch (error) {
    console.error('Error generating single question:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

/**
 * @route   POST /api/faculty/explain
 * @desc    Explain why an answer is correct/incorrect using OpenRouter (free-tier LLM)
 * @access  Private (Student or Faculty)
 */
router.post('/explain', protect, async (req, res) => {
  try {
    const { questionText, options, correctOptionIndex, selectedOptionIndex } = req.body;

    if (!questionText || !Array.isArray(options) || correctOptionIndex === undefined) {
      return res.status(400).json({ success: false, message: 'questionText, options, and correctOptionIndex are required' });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    const correctAnswer = options[correctOptionIndex];
    const selectedAnswer = typeof selectedOptionIndex === 'number' ? options[selectedOptionIndex] : 'No answer selected';

    if (!apiKey) {
      return res.status(200).json({
        success: true,
        explanation: `The correct answer is "${correctAnswer}". Set OPENROUTER_API_KEY on the server to enable detailed AI explanations.`,
        fallback: true,
      });
    }

    const prompt = `Question: ${questionText}
Options: ${options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join(', ')}
Correct answer: ${correctAnswer}
Student's answer: ${selectedAnswer}

In 3-4 short sentences, explain clearly why "${correctAnswer}" is the correct answer${selectedAnswer !== correctAnswer ? ` and why "${selectedAnswer}" is incorrect` : ''}. Keep it simple for a student.`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenRouter API error:', response.status, errText);
      return res.status(200).json({
        success: true,
        explanation: `The correct answer is "${correctAnswer}". (AI explanation service temporarily unavailable.)`,
        fallback: true,
      });
    }

    const data = await response.json();
    const explanation = data.choices?.[0]?.message?.content?.trim() || `The correct answer is "${correctAnswer}".`;

    res.status(200).json({ success: true, explanation, fallback: false });
  } catch (error) {
    console.error('Error explaining answer:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

// Split raw text into clean, reasonably-sized sentences to build content-grounded
// fallback questions when no AI provider is available or the AI call fails.
function extractSentences(text) {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 40 && s.length <= 220);
}

const STOPWORDS = new Set([
  'because', 'through', 'without', 'between', 'however', 'therefore', 'various',
  'similar', 'include', 'includes', 'including', 'different', 'general', 'several',
  'example', 'examples', 'system', 'systems', 'process', 'processes', 'function',
  'functions', 'about', 'their', 'these', 'those', 'other', 'which', 'where',
]);

function pickDistinctiveWord(sentence) {
  const words = sentence.match(/[A-Za-z][A-Za-z-]{5,}/g) || [];
  const candidates = words.filter((w) => !STOPWORDS.has(w.toLowerCase()));
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.length - a.length);
  return candidates[0];
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Normalize question text for duplicate detection (case/punctuation/whitespace-insensitive)
function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Remove questions that duplicate each other or any text already in `seenSet`.
// Mutates seenSet with every kept question's normalized text.
function dedupeQuestions(questions, seenSet) {
  const kept = [];
  for (const q of questions) {
    const key = normalizeText(q.text);
    if (!key || seenSet.has(key)) continue;
    seenSet.add(key);
    kept.push(q);
  }
  return kept;
}

// Race a promise against a timeout; on timeout (or rejection) resolve with null
// instead of throwing, so one slow/stuck AI call can't stall the whole batch set.
function withTimeout(promiseFactory, ms) {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) { settled = true; resolve(null); }
    }, ms);
    promiseFactory()
      .then((val) => { if (!settled) { settled = true; clearTimeout(timer); resolve(val); } })
      .catch((err) => {
        if (!settled) { settled = true; clearTimeout(timer); console.error('AI batch call failed:', err.message); resolve(null); }
      });
  });
}

// Content-grounded fallback: builds fill-in-the-blank style MCQs directly from
// the uploaded notes text (no AI needed), so questions genuinely vary with
// whatever the student uploads instead of repeating a static template bank.
function generateContentGroundedQuestions(text, count, difficulty) {
  const sentences = shuffle(extractSentences(text));
  const pool = [];
  for (const sentence of sentences) {
    const word = pickDistinctiveWord(sentence);
    if (word) pool.push({ sentence, word });
    if (pool.length >= count * 3) break;
  }
  if (pool.length === 0) return [];

  const allWords = [...new Set(pool.map((p) => p.word))];
  const selected = shuffle(pool).slice(0, count);
  const diff = difficulty === 'mixed' ? 'medium' : difficulty || 'medium';

  return selected.map(({ sentence, word }) => {
    const blanked = sentence.replace(new RegExp(`\\b${word}\\b`, 'i'), '_____');
    const distractorPool = allWords.filter((w) => w.toLowerCase() !== word.toLowerCase());
    const distractors = shuffle(distractorPool).slice(0, 3);
    while (distractors.length < 3) distractors.push(`Option ${distractors.length + 2}`);
    const options = shuffle([word, ...distractors]);
    return {
      text: `Fill in the blank based on your notes: "${blanked}"`,
      options,
      correctOptionIndex: options.indexOf(word),
      marks: 2,
      difficulty: diff,
    };
  });
}

/**
 * @route   POST /api/ai/generate-from-notes
 * @desc    Generate a one-off practice quiz strictly from student-uploaded notes
 *          (PDF/PPTX file or pasted text). Not saved to the shared question bank —
 *          returned directly (with answers) for an immediate self-practice quiz.
 * @access  Private (Student or Faculty)
 */
router.post('/generate-from-notes', protect, upload.single('file'), async (req, res) => {
  try {
    const { notesText, difficulty = 'mixed' } = req.body;
    const requestedCount = Math.min(Math.max(parseInt(req.body.count, 10) || 10, 5), 20);

    let docContext = '';
    if (req.file) {
      try {
        docContext = req.file.mimetype === 'application/pdf'
          ? await extractTextFromPDF(req.file.buffer)
          : extractTextFromPPTX(req.file.buffer);
      } catch (extractErr) {
        return res.status(400).json({ success: false, message: 'Failed to read the uploaded file: ' + extractErr.message });
      }
    } else if (notesText && notesText.trim()) {
      docContext = notesText.trim();
    }

    if (!docContext || docContext.trim().length < 50) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a PDF/PPTX or paste at least a few sentences of notes to generate a quiz from.',
      });
    }
    if (docContext.length > 50000) {
      docContext = docContext.substring(0, 50000) + '... [content truncated]';
    }

    const prompt = `You are a strict exam question generator. Using ONLY the study notes below, generate exactly ${requestedCount} multiple choice questions that test understanding of THIS SPECIFIC material.
Rules:
- Every question and correct answer must be directly verifiable from the notes text. Do NOT invent facts not present in the text.
- Spread the questions across different parts/topics of the notes so they are not repetitive.
- Vary phrasing and question style (definitions, application, comparisons, cause/effect) instead of reusing the same sentence structure.
- Difficulty level: ${difficulty === 'mixed' ? 'a mix of easy, medium, and hard' : difficulty}.

---START NOTES---
${docContext}
---END NOTES---

Each question object must contain:
1. "text": the question string.
2. "options": an array of exactly 4 strings.
3. "correctOptionIndex": a number 0-3 for the correct option.
4. "marks": 2.
5. "difficulty": "easy", "medium", or "hard".

Return ONLY a strict raw JSON array (no markdown fences) matching:
[{"text": "...", "options": ["A","B","C","D"], "correctOptionIndex": 0, "marks": 2, "difficulty": "medium"}]`;

    let questions = [];
    const geminiKey = process.env.GEMINI_API_KEY;

    if (geminiKey) {
      try {
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent(prompt);
        let cleanJson = result.response.text().trim();
        if (cleanJson.startsWith('```')) {
          cleanJson = cleanJson.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
        }
        const parsed = JSON.parse(cleanJson);
        if (Array.isArray(parsed)) questions = parsed;
      } catch (err) {
        console.error('Gemini notes-quiz generation failed:', err.message);
      }
    }

    if (questions.length === 0) {
      try {
        const cleanJson = await generateWithOpenRouter(prompt);
        if (cleanJson) {
          const parsed = JSON.parse(cleanJson);
          if (Array.isArray(parsed)) questions = parsed;
        }
      } catch (err) {
        console.error('OpenRouter notes-quiz generation failed:', err.message);
      }
    }

    if (questions.length === 0) {
      questions = generateContentGroundedQuestions(docContext, requestedCount, difficulty);
    }

    questions = questions.slice(0, requestedCount).map((q, i) => ({
      id: `notes-${Date.now()}-${i}`,
      text: q.text,
      options: Array.isArray(q.options) && q.options.length >= 2 ? q.options : ['Option A', 'Option B', 'Option C', 'Option D'],
      correctOptionIndex: typeof q.correctOptionIndex === 'number' ? q.correctOptionIndex : 0,
      marks: q.marks || 2,
      difficulty: q.difficulty || (difficulty === 'mixed' ? 'medium' : difficulty),
    }));

    if (questions.length === 0) {
      return res.status(422).json({
        success: false,
        message: 'Could not generate questions from the provided content. Try a longer or clearer document.',
      });
    }

    res.status(200).json({ success: true, questions, count: questions.length });
  } catch (error) {
    console.error('Error generating quiz from notes:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

/**
 * @route   POST /api/faculty/chat
 * @desc    AI doubt-solving chatbot (OpenRouter free-tier LLM). Stateless — the
 *          client sends the recent message history each time.
 * @access  Private (Student or Faculty)
 */
router.post('/chat', protect, async (req, res) => {
  try {
    const { messages, chapterName } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ success: false, message: 'messages array is required' });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return res.status(200).json({
        success: true,
        reply: "AI chat isn't configured yet — ask your faculty to set OPENROUTER_API_KEY on the server to enable this.",
        fallback: true,
      });
    }

    const systemPrompt = `You are a friendly, patient study assistant helping a student understand${chapterName ? ` "${chapterName}"` : ' their coursework'}. Keep answers clear, concise (under 150 words unless the student asks for more detail), and encouraging. If you don't know something, say so honestly instead of making it up.`;

    const chatMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.slice(-10).map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content).slice(0, 2000) })),
    ];

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free',
        messages: chatMessages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenRouter chat error:', response.status, errText);
      return res.status(200).json({
        success: true,
        reply: "Sorry, the AI assistant is temporarily unavailable. Please try again in a moment.",
        fallback: true,
      });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content?.trim() || "Sorry, I couldn't come up with an answer to that.";

    res.status(200).json({ success: true, reply, fallback: false });
  } catch (error) {
    console.error('Error in AI chat:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

/**
 * @route   POST /api/faculty/chapter-summary
 * @desc    AI-generated short summary/key-points for a chapter, built from its
 *          question bank (so it reflects what's actually being tested).
 * @access  Private (Student or Faculty)
 */
router.post('/chapter-summary', protect, async (req, res) => {
  try {
    const { chapterId } = req.body;
    if (!chapterId) {
      return res.status(400).json({ success: false, message: 'chapterId is required' });
    }

    const chapter = await Chapter.findById(chapterId);
    if (!chapter) {
      return res.status(404).json({ success: false, message: 'Chapter not found' });
    }

    const questions = await Question.find({ chapterId }).select('text').limit(30);
    if (questions.length === 0) {
      return res.status(200).json({
        success: true,
        summary: `No questions exist for "${chapter.name}" yet, so a summary can't be generated. Try uploading notes to generate a quiz first.`,
        fallback: true,
      });
    }

    const topicList = questions.map((q) => `- ${q.text}`).join('\n');
    const prompt = `Based on the following exam questions from the chapter "${chapter.name}", write a short study summary (5-8 bullet points) of the key concepts a student should know. Do not answer the questions — infer the underlying topics and summarize them for revision.

${topicList}

Return plain text bullet points (using "-"), no markdown headers, under 200 words.`;

    let summary = null;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (geminiKey) {
      try {
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent(prompt);
        summary = result.response.text().trim();
      } catch (err) {
        console.error('Gemini chapter-summary failed:', err.message);
      }
    }

    if (!summary) {
      try {
        summary = await generateWithOpenRouter(prompt);
      } catch (err) {
        console.error('OpenRouter chapter-summary failed:', err.message);
      }
    }

    if (!summary) {
      summary = `Key topics covered in "${chapter.name}" (based on its question bank):\n` +
        questions.slice(0, 8).map((q) => `- ${q.text.replace(/\?$/, '')}`).join('\n');
    }

    res.status(200).json({ success: true, summary, fallback: false });
  } catch (error) {
    console.error('Error generating chapter summary:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

module.exports = router;
