import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, Navigate } from "react-router-dom";
import CircularProgress from "../../components/CircularProgress";
import { useQuiz } from "../../context/QuizContext";
import apiClient from "../../api/apiClient";
import BackButton from "../../components/BackButton";
import "./Student.css";

export default function Result() {
  const location = useLocation();
  const navigate = useNavigate();
  const { saveAttempt } = useQuiz();
  const saved = useRef(false);
  const data = location.state;
  const [explanations, setExplanations] = useState({});
  const [explaining, setExplaining] = useState({});

  useEffect(() => {
    if (data && !saved.current && !data.practiceMode) {
      saveAttempt({
        chapterName: data.chapterName,
        subjectName: data.subjectName,
        semesterName: data.semesterName,
        total: data.total,
        correct: data.correct,
        timeTakenSec: data.timeTakenSec,
      });
      saved.current = true;
    }
  }, [data, saveAttempt]);

  if (!data) return <Navigate to="/student/dashboard" replace />;

  const percent = (data.correct / data.total) * 100;
  const isGood = percent >= 70;

  async function explainAnswer(i, r) {
    setExplaining((prev) => ({ ...prev, [i]: true }));
    try {
      const res = await apiClient.post("/faculty/explain", {
        questionText: r.questionText,
        options: r.options,
        correctOptionIndex: r.correctIndex,
        selectedOptionIndex: r.selected,
      });
      setExplanations((prev) => ({ ...prev, [i]: res.data.explanation }));
    } catch (error) {
      console.error("Failed to fetch explanation:", error);
      setExplanations((prev) => ({ ...prev, [i]: "Couldn't load an explanation right now. Please try again." }));
    } finally {
      setExplaining((prev) => ({ ...prev, [i]: false }));
    }
  }

  return (
    <div className="page container">
      <BackButton />
      <div className="result-shell">
        <div className="result-hero card fade-in">
          <CircularProgress percent={percent} color={isGood ? "var(--teal)" : "var(--accent)"} />
          <h1>{isGood ? "Great job! 🎉" : "Keep practicing! 💪"}</h1>
          <p>
            {data.semesterName} · {data.subjectName} · {data.chapterName}
            {data.practiceMode && " · Practice Mode (not saved to history)"}
          </p>

          <div className="result-stats">
            <div className="result-stat card correct">
              <div className="num">{data.correct}</div>
              <div className="label">Correct</div>
            </div>
            <div className="result-stat card wrong">
              <div className="num">{data.wrong}</div>
              <div className="label">Wrong</div>
            </div>
            <div className="result-stat card time">
              <div className="num">{data.timeTakenSec}s</div>
              <div className="label">Time Taken</div>
            </div>
          </div>

          <div className="result-actions">
            <button className="btn btn-outline" onClick={() => navigate("/student/dashboard")}>
              Try Another Chapter
            </button>
            <button className="btn btn-primary" onClick={() => navigate("/student/performance")}>
              View Performance
            </button>
            {!data.practiceMode && data.chapterId && (
              <button
                className="btn btn-outline"
                onClick={() => navigate(`/student/leaderboard/${data.chapterId}`, { state: { chapterName: data.chapterName } })}
              >
                🏆 View Leaderboard
              </button>
            )}
            <button className="btn btn-outline no-print" onClick={() => window.print()}>
              🖨 Print / Export Result
            </button>
          </div>
        </div>

        <div className="review-list">
          {data.review.map((r, i) => (
            <div key={i} className="review-item card" style={{ flexDirection: "column", alignItems: "stretch" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span className={`review-badge ${r.isCorrect ? "correct" : "wrong"}`}>
                  {r.isCorrect ? "✓" : "✕"}
                </span>
                <div style={{ flex: 1 }}>
                  <div className="q-text">
                    {i + 1}. {r.questionText}
                    {r.bookmarked && <span title="Bookmarked" style={{ marginLeft: 6 }}>★</span>}
                  </div>
                  <div className="a-text">
                    Your answer: {r.selected !== undefined && r.selected !== null ? r.options[r.selected] : "Not answered"}
                    {!r.isCorrect && <> · Correct: {r.options[r.correctIndex]}</>}
                    {r.timeTakenSec !== null && r.timeTakenSec !== undefined && <> · Time: {r.timeTakenSec}s</>}
                  </div>
                  {!r.isCorrect && (
                    <div className="no-print" style={{ marginTop: 8 }}>
                      {explanations[i] ? (
                        <div style={{ fontSize: 13, background: "var(--bg-alt)", padding: 10, borderRadius: 8, border: "1px solid var(--border-soft)" }}>
                          💡 {explanations[i]}
                        </div>
                      ) : (
                        <button
                          className="btn btn-outline"
                          style={{ padding: "6px 12px", fontSize: 12 }}
                          onClick={() => explainAnswer(i, r)}
                          disabled={explaining[i]}
                        >
                          {explaining[i] ? "Thinking..." : "✨ Explain this answer (AI)"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
