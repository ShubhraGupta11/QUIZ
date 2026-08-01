// In-memory manager for Live Quiz Battle sessions. Sessions are short-lived
// (a single classroom session), so there's no need to persist them in MongoDB —
// only the final scores get written to the real Attempt collection when a
// session ends, so history/leaderboard/reports stay consistent with normal quizzes.

const QUESTION_TIME_LIMIT_SEC = 20;
const BASE_POINTS = 1000;
const SPEED_BONUS_MAX = 500;
const STREAK_BONUS_PER_STEP = 50; // extra points per consecutive correct answer, capped
const STREAK_BONUS_CAP = 250;

// Kahoot-style answer tile identity: shape + color, purely cosmetic but sent
// to the client so both host and player screens render identical tiles.
const TILE_STYLES = [
  { shape: 'triangle', color: '#e02929' },
  { shape: 'diamond', color: '#1368ce' },
  { shape: 'circle', color: '#d89e00' },
  { shape: 'square', color: '#26890c' },
];

const sessions = new Map(); // code -> session

function generateCode() {
  let code;
  do {
    code = Math.floor(100000 + Math.random() * 900000).toString();
  } while (sessions.has(code));
  return code;
}

function createSession({ hostSocketId, hostUserId, chapterId, chapterName, questions }) {
  const code = generateCode();
  const session = {
    code,
    hostSocketId,
    hostUserId,
    chapterId,
    chapterName,
    questions, // full question docs including correctOptionIndex (server-only, never sent to players)
    status: 'lobby', // lobby -> question -> reveal -> finished
    currentIndex: -1,
    questionStartedAt: null,
    questionTimer: null, // Node timeout handle for auto-close
    players: new Map(), // socketId -> { userId, name, score, streak, answers: [{ index, correct, timeMs, pointsAwarded }] }
  };
  sessions.set(code, session);
  return session;
}

function getSession(code) {
  return sessions.get(code);
}

function removeSession(code) {
  const session = sessions.get(code);
  if (session?.questionTimer) clearTimeout(session.questionTimer);
  sessions.delete(code);
}

function addPlayer(session, socketId, userId, name) {
  session.players.set(socketId, { userId, name, score: 0, streak: 0, answers: [] });
}

function removePlayer(session, socketId) {
  session.players.delete(socketId);
}

function startQuestion(session) {
  if (session.questionTimer) clearTimeout(session.questionTimer);
  session.currentIndex += 1;
  session.questionStartedAt = Date.now();
  session.status = 'question';
  return session.currentIndex < session.questions.length ? session.questions[session.currentIndex] : null;
}

function publicQuestion(question) {
  return {
    text: question.text,
    options: question.options,
    marks: question.marks,
    difficulty: question.difficulty,
    timeLimitSec: QUESTION_TIME_LIMIT_SEC,
    tiles: TILE_STYLES.slice(0, question.options.length),
  };
}

function allAnswered(session) {
  if (session.players.size === 0) return false;
  return [...session.players.values()].every((p) => p.answers[session.currentIndex] !== undefined);
}

function submitAnswer(session, socketId, optionIndex) {
  const player = session.players.get(socketId);
  if (!player) return null;

  const question = session.questions[session.currentIndex];
  if (!question) return null;

  // Ignore duplicate answers for the same question
  if (player.answers[session.currentIndex] !== undefined) return null;

  const timeMs = Date.now() - session.questionStartedAt;
  const timeSec = Math.min(timeMs / 1000, QUESTION_TIME_LIMIT_SEC);
  const isCorrect = optionIndex === question.correctOptionIndex;

  let pointsAwarded = 0;
  if (isCorrect) {
    const speedRatio = Math.max(0, 1 - timeSec / QUESTION_TIME_LIMIT_SEC);
    const speedBonus = Math.round(speedRatio * SPEED_BONUS_MAX);
    const streakBonus = Math.min(player.streak * STREAK_BONUS_PER_STEP, STREAK_BONUS_CAP);
    pointsAwarded = BASE_POINTS + speedBonus + streakBonus;
    player.streak += 1;
  } else {
    player.streak = 0;
  }

  player.answers[session.currentIndex] = { index: optionIndex, correct: isCorrect, timeMs, pointsAwarded };
  player.score += pointsAwarded;

  return {
    isCorrect,
    pointsAwarded,
    correctOptionIndex: question.correctOptionIndex,
    streak: player.streak,
  };
}

// Per-option answer counts for the current question, used to render Kahoot-style
// answer distribution bars on the host screen after a question closes.
function getAnswerDistribution(session) {
  const question = session.questions[session.currentIndex];
  const counts = new Array(question.options.length).fill(0);
  session.players.forEach((p) => {
    const answer = p.answers[session.currentIndex];
    if (answer && answer.index >= 0 && answer.index < counts.length) counts[answer.index] += 1;
  });
  return counts;
}

function getLeaderboard(session) {
  return Array.from(session.players.values())
    .map((p) => ({ name: p.name, score: p.score, streak: p.streak }))
    .sort((a, b) => b.score - a.score);
}

function getFinalResults(session) {
  return Array.from(session.players.entries())
    .map(([socketId, p]) => ({
      socketId,
      userId: p.userId,
      name: p.name,
      score: p.score,
      correctCount: p.answers.filter((a) => a?.correct).length,
      totalQuestions: session.questions.length,
    }))
    .sort((a, b) => b.score - a.score);
}

// Lightweight snapshot of every currently-running session, for Admin's
// platform-wide "Live Sessions" monitoring view. Never exposes correct
// answers or the host's socket id.
function getAllSessions() {
  return Array.from(sessions.values()).map((s) => ({
    code: s.code,
    chapterName: s.chapterName,
    status: s.status,
    playerCount: s.players.size,
    currentQuestion: s.currentIndex + 1,
    totalQuestions: s.questions.length,
  }));
}

module.exports = {
  QUESTION_TIME_LIMIT_SEC,
  createSession,
  getSession,
  removeSession,
  addPlayer,
  removePlayer,
  startQuestion,
  publicQuestion,
  submitAnswer,
  allAnswered,
  getAnswerDistribution,
  getLeaderboard,
  getFinalResults,
  getAllSessions,
};
