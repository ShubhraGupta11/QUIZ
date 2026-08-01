const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Chapter = require('../models/Chapter');
const Question = require('../models/Question');
const Attempt = require('../models/Attempt');
const manager = require('./liveQuizManager');

// Runs as Socket.IO connection middleware, BEFORE the client's 'connect' event
// fires. This guarantees authentication finishes (and socket.data.user is set)
// before the client can possibly emit anything — avoiding a race where a fast
// client emits an event before the server has registered its listeners.
async function socketAuthMiddleware(socket, next) {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication required'));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'smartquiz_super_secret_jwt_key_2026');
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return next(new Error('Authentication failed'));
    socket.data.user = user;
    next();
  } catch {
    next(new Error('Authentication failed'));
  }
}

function registerLiveQuizHandlers(io) {
  io.use(socketAuthMiddleware);

  // Closes the current question (called on timeout, on all-answered, or on
  // host skip) and broadcasts the correct answer + live answer-distribution
  // chart to everyone in the room. Idempotent — safe to call once per question.
  function closeQuestion(io, session) {
    if (session.status !== 'question') return;
    if (session.questionTimer) {
      clearTimeout(session.questionTimer);
      session.questionTimer = null;
    }
    session.status = 'reveal';

    const question = session.questions[session.currentIndex];
    io.to(`live:${session.code}`).emit('question:reveal', {
      correctOptionIndex: question.correctOptionIndex,
      distribution: manager.getAnswerDistribution(session),
      totalPlayers: session.players.size,
    });
  }

  io.on('connection', (socket) => {
    const user = socket.data.user;

    // Faculty hosts a new live session for a chapter
    socket.on('host:create', async ({ chapterId }, ack) => {
      try {
        if (user.role !== 'faculty') return ack?.({ success: false, message: 'Only faculty can host a live quiz' });

        const chapter = await Chapter.findById(chapterId).populate('subjectId');
        if (!chapter) return ack?.({ success: false, message: 'Chapter not found' });

        const questions = await Question.find({ chapterId }).sort({ _id: 1 });
        if (questions.length === 0) return ack?.({ success: false, message: 'This chapter has no questions yet' });

        const session = manager.createSession({
          hostSocketId: socket.id,
          hostUserId: user._id.toString(),
          chapterId,
          chapterName: chapter.name,
          questions,
        });

        socket.join(`live:${session.code}`);
        ack?.({ success: true, code: session.code, chapterName: chapter.name, totalQuestions: questions.length });
      } catch (err) {
        ack?.({ success: false, message: err.message });
      }
    });

    // Student joins a live session by code
    socket.on('player:join', ({ code }, ack) => {
      const session = manager.getSession(code);
      if (!session) return ack?.({ success: false, message: 'Invalid or expired room code' });
      if (session.status !== 'lobby') return ack?.({ success: false, message: 'This quiz has already started' });

      manager.addPlayer(session, socket.id, user._id.toString(), user.name);
      socket.join(`live:${code}`);
      socket.data.liveCode = code;

      ack?.({ success: true, chapterName: session.chapterName, totalQuestions: session.questions.length });
      io.to(`live:${code}`).emit('lobby:update', {
        players: Array.from(session.players.values()).map((p) => p.name),
      });
    });

    // Faculty starts / advances to the next question
    socket.on('host:next', ({ code }, ack) => {
      const session = manager.getSession(code);
      if (!session || session.hostSocketId !== socket.id) return ack?.({ success: false, message: 'Not authorized' });

      const question = manager.startQuestion(session);
      if (!question) {
        session.status = 'finished';
        io.to(`live:${code}`).emit('quiz:finished', { results: manager.getFinalResults(session) });
        return ack?.({ success: true, finished: true });
      }

      io.to(`live:${code}`).emit('question:show', {
        index: session.currentIndex,
        total: session.questions.length,
        question: manager.publicQuestion(question),
      });

      // Server-authoritative timer: auto-close the question when time runs out,
      // even if the host's browser tab is unfocused or a player never answers.
      session.questionTimer = setTimeout(() => {
        closeQuestion(io, session);
      }, manager.QUESTION_TIME_LIMIT_SEC * 1000);

      ack?.({ success: true, finished: false });
    });

    // Faculty can skip the remaining time on a question and reveal immediately
    socket.on('host:skip', ({ code }, ack) => {
      const session = manager.getSession(code);
      if (!session || session.hostSocketId !== socket.id) return ack?.({ success: false, message: 'Not authorized' });
      closeQuestion(io, session);
      ack?.({ success: true });
    });

    // Student submits an answer for the current question
    socket.on('player:answer', ({ code, optionIndex }, ack) => {
      const session = manager.getSession(code);
      if (!session) return ack?.({ success: false, message: 'Session not found' });

      const result = manager.submitAnswer(session, socket.id, optionIndex);
      if (!result) return ack?.({ success: false, message: 'Could not record answer' });

      ack?.(result);
      const answeredCount = [...session.players.values()].filter(
        (p) => p.answers[session.currentIndex] !== undefined
      ).length;
      io.to(session.hostSocketId).emit('host:answerReceived', {
        answeredCount,
        totalPlayers: session.players.size,
      });

      // Auto-close the moment every joined player has answered, instead of
      // waiting out the full timer.
      if (manager.allAnswered(session)) {
        closeQuestion(io, session);
      }
    });

    // Faculty reveals the leaderboard after the answer-reveal screen
    socket.on('host:showLeaderboard', ({ code }, ack) => {
      const session = manager.getSession(code);
      if (!session || session.hostSocketId !== socket.id) return ack?.({ success: false, message: 'Not authorized' });
      io.to(`live:${code}`).emit('leaderboard:update', { leaderboard: manager.getLeaderboard(session) });
      ack?.({ success: true });
    });

    // Faculty ends the session early and persists final scores as real Attempts
    socket.on('host:end', async ({ code }, ack) => {
      const session = manager.getSession(code);
      if (!session || session.hostSocketId !== socket.id) return ack?.({ success: false, message: 'Not authorized' });

      const results = manager.getFinalResults(session);
      session.status = 'finished';

      try {
        await Promise.all(
          results.map((r) =>
            Attempt.create({
              studentId: r.userId,
              chapterId: session.chapterId,
              score: r.correctCount * (session.questions[0]?.marks || 2),
              total: session.questions.length * (session.questions[0]?.marks || 2),
              timeTaken: 0,
              answers: session.questions.map((q, i) => {
                const player = [...session.players.values()].find((p) => p.userId === r.userId);
                return player?.answers[i]?.index ?? null;
              }),
            })
          )
        );
      } catch (err) {
        console.error('Error persisting live quiz attempts:', err.message);
      }

      io.to(`live:${code}`).emit('quiz:finished', { results });
      manager.removeSession(code);
      ack?.({ success: true });
    });

    socket.on('disconnect', () => {
      const code = socket.data.liveCode;
      if (code) {
        const session = manager.getSession(code);
        if (session) {
          manager.removePlayer(session, socket.id);
          io.to(`live:${code}`).emit('lobby:update', {
            players: Array.from(session.players.values()).map((p) => p.name),
          });
        }
      }
    });
  });
}

module.exports = { registerLiveQuizHandlers };
