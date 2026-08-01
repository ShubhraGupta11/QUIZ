// In-memory manager for Live Quiz Battle sessions. Sessions are short-lived
// (a single classroom session), so there's no need to persist them in MongoDB —
// only the final scores get written to the real Attempt collection when a
// session ends, so history/leaderboard/reports stay consistent with normal quizzes.

const QUESTION_TIME_LIMIT_SEC = 20;
const BASE_POINTS = 1000;
const SPEED_BONUS_MAX = 500;

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
    status: 'lobby', // lobby -> active -> finished
    currentIndex: -1,
    questionStartedAt: null,
    players: new Map(), // socketId -> { userId, name, score, answers: [{ index, correct, timeMs }] }
  };
  sessions.set(code, session);
  return session;
}

function getSession(code) {
  return sessions.get(code);
}

function removeSession(code) {
  sessions.delete(code);
}

function addPlayer(session, socketId, userId, name) {
  session.players.set(socketId, { userId, name, score: 0, answers: [] });
}

function removePlayer(session, socketId) {
  session.players.delete(socketId);
}

function startQuestion(session) {
  session.currentIndex += 1;
  session.questionStartedAt = Date.now();
  return session.currentIndex < session.questions.length ? session.questions[session.currentIndex] : null;
}

function publicQuestion(question) {
  return {
    text: question.text,
    options: question.options,
    marks: question.marks,
    difficulty: question.difficulty,
    timeLimitSec: QUESTION_TIME_LIMIT_SEC,
  };
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
    pointsAwarded = Math.round(BASE_POINTS + speedRatio * SPEED_BONUS_MAX);
  }

  player.answers[session.currentIndex] = { index: optionIndex, correct: isCorrect, timeMs };
  player.score += pointsAwarded;

  return { isCorrect, pointsAwarded, correctOptionIndex: question.correctOptionIndex };
}

function getLeaderboard(session) {
  return Array.from(session.players.values())
    .map((p) => ({ name: p.name, score: p.score }))
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
  getLeaderboard,
  getFinalResults,
};
