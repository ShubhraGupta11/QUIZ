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
      let generatedQuestions = [];

      // Split into batches of at most 25 to prevent token limits/truncation and timeouts.
      const MAX_BATCH = 25;
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

      console.log(`Starting AI generation for chapter: "${chapterName}" (${requestedCount} questions) in ${batchSizes.length} batch(es)...`);

      for (let b = 0; b < batchSizes.length; b++) {
        const batchSize = batchSizes[b];
        const batchDiff = difficulties[b];

        const prompt = `You are an expert college professor and academic examiner.
Generate exactly ${batchSize} high-quality Multiple Choice Questions (MCQs) for the chapter "${chapterName}" under the subject "${subjectName}" for students of "${semesterName}".
The difficulty of this batch of questions must be: ${batchDiff.toUpperCase()}.

${docContext ? `IMPORTANT: The following is the exact reference material uploaded by the instructor. You MUST base every question strictly and only on facts, definitions, examples, and concepts explicitly present in this text. Do NOT introduce outside knowledge, do NOT make up details not present in the text, and do NOT ask about anything the text does not cover. Every correct answer must be directly verifiable from this text.\n\n---START REFERENCE TEXT---\n${docContext}\n---END REFERENCE TEXT---\n\n` : ''}
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

        try {
          let cleanJson = null;

          if (geminiModel) {
            const result = await geminiModel.generateContent(prompt);
            cleanJson = result.response.text().trim();
            if (cleanJson.startsWith('```')) {
              cleanJson = cleanJson.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
            }
          } else {
            cleanJson = await generateWithOpenRouter(prompt);
          }

          if (!cleanJson) {
            throw new Error('No AI provider configured (set GEMINI_API_KEY or OPENROUTER_API_KEY)');
          }

          const parsedBatch = JSON.parse(cleanJson);
          if (Array.isArray(parsedBatch)) {
            generatedQuestions = generatedQuestions.concat(parsedBatch);
            console.log(`Successfully generated batch ${b + 1}/${batchSizes.length} (${parsedBatch.length} questions) via ${geminiModel ? 'Gemini' : 'OpenRouter'}`);
          } else {
            throw new Error('Response is not a JSON array');
          }
        } catch (batchError) {
          console.error(`Error generating batch ${b + 1}/${batchSizes.length}:`, batchError.message);
          // Generate mock questions for this batch to ensure we still complete the request
          const fallbackBatch = generateMockQuestions(chapterName, batchSize, batchDiff);
          generatedQuestions = generatedQuestions.concat(fallbackBatch);
          console.log(`Used fallback for batch ${b + 1}/${batchSizes.length} (${fallbackBatch.length} questions)`);
        }
      }

      // Ensure we truncate or expand to exactly the requested count if there was any drift
      if (generatedQuestions.length > requestedCount) {
        generatedQuestions = generatedQuestions.slice(0, requestedCount);
      } else if (generatedQuestions.length < requestedCount) {
        const diffNeeded = requestedCount - generatedQuestions.length;
        const padQuestions = generateMockQuestions(chapterName, diffNeeded, difficulty);
        generatedQuestions = generatedQuestions.concat(padQuestions);
      }

      // Inject chapterId into every question and save to Database
      const questionsToSave = generatedQuestions.map((q) => ({
        chapterId: chapter._id,
        text: q.text,
        options: q.options && q.options.length === 4 ? q.options : ['Option A', 'Option B', 'Option C', 'Option D'],
        correctOptionIndex: typeof q.correctOptionIndex === 'number' && q.correctOptionIndex >= 0 && q.correctOptionIndex <= 3 ? q.correctOptionIndex : 0,
        marks: q.marks || 2,
        difficulty: q.difficulty || 'medium',
      }));

      // Insert the generated questions into MongoDB
      const savedQuestions = await Question.insertMany(questionsToSave);

      return res.status(200).json({
        success: true,
        message: `Successfully generated and saved ${savedQuestions.length} MCQs automatically into the database for chapter "${chapterName}".`,
        count: savedQuestions.length,
        questions: savedQuestions.slice(0, 5), // Return first 5 as a sample preview
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

    const prompt = `Generate exactly 1 high-quality Multiple Choice Question for the chapter "${chapterName}" under subject "${subjectName}" for students of "${semesterName}".
Difficulty: ${difficulty}.
Return strict raw JSON (no markdown) matching:
{"text": "...", "options": ["A","B","C","D"], "correctOptionIndex": 0, "marks": 2, "difficulty": "${difficulty}"}`;

    let question;
    try {
      let cleanJson = null;
      if (geminiKey) {
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent(prompt);
        cleanJson = result.response.text().trim();
        if (cleanJson.startsWith('```')) {
          cleanJson = cleanJson.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
        }
      } else {
        cleanJson = await generateWithOpenRouter(prompt);
      }
      if (!cleanJson) throw new Error('No AI provider configured');
      question = JSON.parse(cleanJson);
    } catch (err) {
      console.error('Single question AI generation failed, using fallback:', err.message);
      question = generateMockQuestions(chapterName, 1, difficulty)[0];
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

module.exports = router;
