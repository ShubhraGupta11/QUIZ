import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useParams, useLocation, useSearchParams } from "react-router-dom";
import { getQuestions } from "../../api/mockData";
import apiClient from "../../api/apiClient";
import Loader from "../../components/Loader";
import BackButton from "../../components/BackButton";
import { useAuth } from "../../context/AuthContext";
import "./Student.css";

const TIME_PER_QUESTION = 30; // seconds

function shuffleOptions(question) {
  const indices = question.options.map((_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const options = indices.map((i) => question.options[i]);
  const correctIndex = question.correctIndex !== undefined ? indices.indexOf(question.correctIndex) : undefined;
  return { ...question, options, correctIndex };
}

export default function Quiz() {
  const { semesterId, subjectId, chapterId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const meta = location.state || {};

  // Challenge-a-friend: a shared quiz link can carry ?beat=<percent>&from=<name>
  const beatTarget = searchParams.get("beat") ? Number(searchParams.get("beat")) : null;
  const challengedBy = searchParams.get("from") || null;

  const practiceMode = !!meta.practiceMode;
  const negativeMarking = !!meta.negativeMarking;
  // Self-quiz: questions generated on-the-fly from student-uploaded notes.
  // They aren't in the DB, so scoring happens locally and nothing is persisted.
  const isSelfQuiz = !!meta.selfQuiz && Array.isArray(meta.questions);
  // Saved progress lets a student close mid-quiz and pick up where they left off
  const progressKey = user?._id && chapterId ? `smartquiz_progress_${user._id}_${chapterId}` : null;

  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [bookmarked, setBookmarked] = useState({});
  const [timeLeft, setTimeLeft] = useState(TIME_PER_QUESTION);
  const [startedAt] = useState(Date.now());
  const [questionStartedAt, setQuestionStartedAt] = useState(Date.now());
  const [timePerQuestion, setTimePerQuestion] = useState({});

  useEffect(() => {
    if (isSelfQuiz) {
      setQuestions(meta.questions);
      setLoading(false);
      return;
    }
    getQuestions(chapterId, meta.chapterName).then((data) => {
      const shuffled = data.map(shuffleOptions);
      setQuestions(shuffled);
      setLoading(false);

      // Offer to resume saved progress for this chapter, if any
      if (progressKey) {
        try {
          const saved = JSON.parse(localStorage.getItem(progressKey) || "null");
          if (saved && saved.answers && Object.keys(saved.answers).length > 0) {
            if (window.confirm("You have an unfinished attempt for this chapter. Resume where you left off?")) {
              setAnswers(saved.answers);
              setCurrent(Math.min(saved.current || 0, shuffled.length - 1));
              setBookmarked(saved.bookmarked || {});
            } else {
              localStorage.removeItem(progressKey);
            }
          }
        } catch {
          // ignore corrupt saved progress
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId, isSelfQuiz]);

  // Autosave progress as the student answers questions (skipped for self-quiz/practice-only sessions without a real chapter)
  useEffect(() => {
    if (!progressKey || isSelfQuiz || loading || questions.length === 0) return;
    localStorage.setItem(progressKey, JSON.stringify({ answers, current, bookmarked }));
  }, [progressKey, isSelfQuiz, loading, questions.length, answers, current, bookmarked]);

  const question = questions[current];

  // Keyboard shortcuts: 1-4 pick an option, Enter/→ advance
  useEffect(() => {
    function onKeyDown(e) {
      if (!question || loading) return;
      if (["1", "2", "3", "4"].includes(e.key)) {
        const idx = Number(e.key) - 1;
        if (idx < question.options.length) selectOption(idx);
      } else if ((e.key === "Enter" || e.key === "ArrowRight") && answers[question.id] !== undefined) {
        goNext();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question, answers, loading]);

  const goNext = useCallback(() => {
    setTimePerQuestion((prev) => ({
      ...prev,
      [current]: Math.round((Date.now() - questionStartedAt) / 1000),
    }));
    setTimeLeft(TIME_PER_QUESTION);
    setQuestionStartedAt(Date.now());
    if (current < questions.length - 1) {
      setCurrent((c) => c + 1);
    } else {
      finishQuiz();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, questions, questionStartedAt]);

  useEffect(() => {
    if (loading || questions.length === 0 || practiceMode) return;
    if (timeLeft <= 0) {
      goNext();
      return;
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, loading, questions.length, goNext, practiceMode]);

  function selectOption(index) {
    setAnswers((prev) => ({ ...prev, [question.id]: index }));
  }

  function toggleBookmark() {
    setBookmarked((prev) => ({ ...prev, [question.id]: !prev[question.id] }));
  }

  function readAloud() {
    if (!("speechSynthesis" in window) || !question) return;
    window.speechSynthesis.cancel();
    const optionsText = question.options.map((o, i) => `Option ${String.fromCharCode(65 + i)}: ${o}.`).join(" ");
    const utterance = new SpeechSynthesisUtterance(`${question.text}. ${optionsText}`);
    window.speechSynthesis.speak(utterance);
  }

  const [submitting, setSubmitting] = useState(false);

  async function finishQuiz() {
    setSubmitting(true);
    const timeTakenSec = Math.round((Date.now() - startedAt) / 1000);

    // Map answers object to ordered array matching the questions
    const answersArray = questions.map((q) => answers[q.id] !== undefined ? answers[q.id] : null);

    if (isSelfQuiz) {
      // Score locally against the correct answers embedded in the generated questions —
      // there's no DB-backed question bank to trust here, so no server round-trip needed.
      let score = 0;
      let total = 0;
      const review = questions.map((q, i) => {
        const studentAnswer = answersArray[i];
        const marks = q.marks || 2;
        const isCorrect = studentAnswer === q.correctIndex;
        if (isCorrect) score += marks;
        total += marks;
        return {
          questionText: q.text,
          options: q.options,
          selected: studentAnswer,
          correctIndex: q.correctIndex,
          isCorrect,
          bookmarked: !!bookmarked[q.id],
          timeTakenSec: timePerQuestion[i] ?? null,
        };
      });

      navigate("/student/result", {
        state: {
          total: questions.length,
          correct: review.filter((r) => r.isCorrect).length,
          wrong: questions.length - review.filter((r) => r.isCorrect).length,
          timeTakenSec,
          review,
          chapterName: meta.chapterName || "Your Notes",
          subjectName: meta.subjectName || "AI Self-Quiz",
          semesterName: meta.semesterName || "Generated from notes",
          practiceMode: true,
        },
        replace: true,
      });
      return;
    }

    try {
      const res = await apiClient.post('/attempts', {
        chapterId,
        answers: answersArray,
        timeTaken: timeTakenSec,
        practice: practiceMode,
        negativeMarking,
      });

      const { score, total, evaluation } = res.data.data;
      if (progressKey) localStorage.removeItem(progressKey);

      // Map evaluation to the review structure expected by Result.jsx
      const review = evaluation.map((item, i) => ({
        questionText: item.text,
        options: item.options,
        selected: item.studentAnswer,
        correctIndex: item.correctOptionIndex,
        isCorrect: item.isCorrect,
        bookmarked: !!bookmarked[questions[i]?.id],
        timeTakenSec: timePerQuestion[i] ?? null,
      }));

      navigate("/student/result", {
        state: {
          total: questions.length,
          correct: evaluation.filter(e => e.isCorrect).length,
          wrong: questions.length - evaluation.filter(e => e.isCorrect).length,
          timeTakenSec,
          review,
          chapterName: meta.chapterName,
          subjectName: meta.subjectName,
          semesterName: meta.semesterName,
          semesterId,
          subjectId,
          chapterId,
          practiceMode,
          beatTarget,
          challengedBy,
          negativeMarking,
          scoreMarks: score,
          totalMarks: total,
        },
        replace: true,
      });
    } catch (error) {
      console.error("Failed to submit quiz attempt:", error);
      alert("Failed to submit quiz attempt. Please try again.");
      setSubmitting(false);
    }
  }

  if (loading) return <div className="page container"><Loader label="Preparing your quiz..." /></div>;

  if (questions.length === 0) {
    return (
      <div className="page container">
        <div className="empty-state card">
          <p>No questions found for this chapter yet.</p>
          <button
            className="btn btn-primary"
            style={{ marginTop: 16 }}
            onClick={() => navigate("/student/generate-quiz", { state: { chapterName: meta.chapterName, subjectName: meta.subjectName, semesterName: meta.semesterName } })}
          >
            ✨ Generate a quiz from your notes (AI)
          </button>
        </div>
      </div>
    );
  }

  const progressPercent = ((current + 1) / questions.length) * 100;
  const isLast = current === questions.length - 1;
  const isAnswered = answers[question.id] !== undefined;

  return (
    <div className="page container">
      <BackButton />
      <div className="quiz-shell">
        <div className="quiz-top">
          <span className="quiz-progress-text">
            Question {current + 1} of {questions.length} · {meta.chapterName}
            {practiceMode && <span className="badge badge-teal" style={{ marginLeft: 8 }}>Practice Mode</span>}
          </span>
          {practiceMode ? (
            <div className="quiz-timer">Untimed</div>
          ) : (
            <div className={`quiz-timer ${timeLeft <= 10 ? "danger" : ""}`}>
              ⏱ {timeLeft}s
            </div>
          )}
        </div>

        <div className="progress-bar-track">
          <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
        </div>

        <div className="question-card card fade-in" key={question.id}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <h2 style={{ flex: 1 }}>{question.text}</h2>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                className="icon-btn"
                onClick={readAloud}
                title="Read question aloud"
                style={{ fontSize: 18, lineHeight: 1, background: "none", border: "none", cursor: "pointer" }}
              >
                🔊
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={toggleBookmark}
                title={bookmarked[question.id] ? "Remove bookmark" : "Bookmark this question"}
                style={{ fontSize: 20, lineHeight: 1, background: "none", border: "none", cursor: "pointer" }}
              >
                {bookmarked[question.id] ? "★" : "☆"}
              </button>
            </div>
          </div>
          <div className="option-list">
            {question.options.map((opt, i) => (
              <button
                key={i}
                className={`option-item ${answers[question.id] === i ? "selected" : ""}`}
                onClick={() => selectOption(i)}
              >
                <span className="option-letter">{String.fromCharCode(65 + i)}</span>
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div className="quiz-nav">
          <button className="btn btn-outline" onClick={finishQuiz}>
            End Quiz
          </button>
          <button className="btn btn-primary" onClick={goNext} disabled={!isAnswered}>
            {isLast ? "Submit Quiz" : "Next Question"}
          </button>
        </div>
      </div>
    </div>
  );
}
