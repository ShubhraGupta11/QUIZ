import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { getQuestions } from "../../api/mockData";
import apiClient from "../../api/apiClient";
import Loader from "../../components/Loader";
import "./Student.css";

const TIME_PER_QUESTION = 30; // seconds

export default function Quiz() {
  const { semesterId, subjectId, chapterId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const meta = location.state || {};

  const practiceMode = !!meta.practiceMode;

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
    getQuestions(chapterId, meta.chapterName).then((data) => {
      setQuestions(data);
      setLoading(false);
    });
  }, [chapterId]);

  const question = questions[current];

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

  const [submitting, setSubmitting] = useState(false);

  async function finishQuiz() {
    setSubmitting(true);
    const timeTakenSec = Math.round((Date.now() - startedAt) / 1000);

    // Map answers object to ordered array matching the questions
    const answersArray = questions.map((q) => answers[q.id] !== undefined ? answers[q.id] : null);

    try {
      const res = await apiClient.post('/attempts', {
        chapterId,
        answers: answersArray,
        timeTaken: timeTakenSec,
        practice: practiceMode,
      });

      const { score, total, evaluation } = res.data.data;

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
    return <div className="page container"><div className="empty-state card">No questions found for this chapter.</div></div>;
  }

  const progressPercent = ((current + 1) / questions.length) * 100;
  const isLast = current === questions.length - 1;
  const isAnswered = answers[question.id] !== undefined;

  return (
    <div className="page container">
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
