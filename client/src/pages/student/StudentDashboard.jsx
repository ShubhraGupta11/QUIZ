import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useQuiz } from "../../context/QuizContext";
import { getSubjects } from "../../api/mockData";
import apiClient from "../../api/apiClient";
import StepCard from "../../components/StepCard";
import Loader from "../../components/Loader";
import BackButton from "../../components/BackButton";
import "./Student.css";

export default function StudentDashboard() {
  const { user } = useAuth();
  const { attempts } = useQuiz();
  const navigate = useNavigate();

  const [subjects, setSubjects] = useState([]);
  const [semesterName, setSemesterName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.semesterId) return;
    getSubjects(user.semesterId).then((data) => {
      setSubjects(data);
      setLoading(false);
    });
    apiClient.get("/semesters").then((res) => {
      const mine = res.data.data.find((s) => s._id === user.semesterId);
      if (mine) setSemesterName(mine.name);
    });
  }, [user]);

  const avgPercent =
    attempts.length > 0
      ? Math.round(
          attempts.reduce((sum, a) => sum + (a.correct / a.total) * 100, 0) / attempts.length
        )
      : null;
  const bestPercent =
    attempts.length > 0
      ? Math.round(Math.max(...attempts.map((a) => (a.correct / a.total) * 100)))
      : null;

  const lastAttempt = attempts[0]; // backend already sorts newest-first

  // Spaced repetition: chapters last attempted 7+ days ago, or scored below 60% last time
  const revisionReminders = (() => {
    const byChapter = new Map();
    attempts.forEach((a) => {
      if (!a.chapterId) return;
      const existing = byChapter.get(a.chapterId);
      if (!existing || new Date(a.date) > new Date(existing.date)) byChapter.set(a.chapterId, a);
    });
    const now = Date.now();
    return Array.from(byChapter.values())
      .map((a) => ({ ...a, percent: Math.round((a.correct / a.total) * 100), daysAgo: Math.floor((now - new Date(a.date)) / 86400000) }))
      .filter((a) => a.daysAgo >= 7 || a.percent < 60)
      .sort((a, b) => a.percent - b.percent)
      .slice(0, 3);
  })();

  function continuePractice() {
    if (!lastAttempt?.chapterId) return;
    navigate(`/student/${lastAttempt.semesterId}/${lastAttempt.subjectId}/${lastAttempt.chapterId}/quiz`, {
      state: {
        chapterName: lastAttempt.chapterName,
        subjectName: lastAttempt.subjectName,
        semesterName: lastAttempt.semesterName,
        practiceMode: true,
      },
    });
  }

  return (
    <div className="page container">
      <BackButton />
      <div className="page-header">
        <div>
          <span className="eyebrow">Student dashboard</span>
          <h1>Hi {user?.name?.split(" ")[0]}, ready to practice? 👋</h1>
          <p>
            You've completed {attempts.length} quiz{attempts.length === 1 ? "" : "zes"} so far.{" "}
            {attempts.length > 0 && (
              <span style={{ color: "var(--accent-ink)", cursor: "pointer", fontWeight: 600, borderBottom: "1.5px solid var(--accent)" }} onClick={() => navigate("/student/performance")}>
                View performance →
              </span>
            )}
          </p>
        </div>
        <div className="page-header-side">
          <span className="badge badge-teal">{user?.role}</span>
          <span className="badge badge-gold">⚡ <span onClick={() => navigate("/student/live")} style={{ cursor: "pointer" }}>Live Quiz</span></span>
        </div>
      </div>

      <div className="dashboard-summary">
        <div className="stat-block">
          <span className="stat-value">{attempts.length}</span>
          <span className="stat-label">Quizzes taken</span>
        </div>
        <div className="stat-block">
          <span className="stat-value">{avgPercent !== null ? `${avgPercent}%` : "—"}</span>
          <span className="stat-label">Average score</span>
        </div>
        <div className="stat-block">
          <span className="stat-value">{bestPercent !== null ? `${bestPercent}%` : "—"}</span>
          <span className="stat-label">Best score</span>
        </div>
      </div>

      {revisionReminders.length > 0 && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>⏰ Time to Revise</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {revisionReminders.map((a) => (
              <div key={a.chapterId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13.5, gap: 12, flexWrap: "wrap" }}>
                <span>
                  <strong>{a.chapterName}</strong> ({a.subjectName}) — {a.percent}% last time, {a.daysAgo === 0 ? "attempted today" : `${a.daysAgo} day${a.daysAgo === 1 ? "" : "s"} ago`}
                </span>
                <button
                  className="btn btn-outline"
                  style={{ padding: "6px 14px", fontSize: 12 }}
                  onClick={() =>
                    navigate(`/student/${a.semesterId}/${a.subjectId}/${a.chapterId}/quiz`, {
                      state: { chapterName: a.chapterName, subjectName: a.subjectName, semesterName: a.semesterName, practiceMode: true },
                    })
                  }
                >
                  Revise Now →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="quick-links-row" style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <button className="btn btn-outline" onClick={() => navigate("/student/flashcards")}>🗂 Flashcards</button>
        <button className="btn btn-outline" onClick={() => navigate("/student/ask-ai")}>✨ Ask AI a Doubt</button>
        <button className="btn btn-outline" onClick={() => navigate("/student/doubts")}>💬 My Doubts</button>
      </div>

      {lastAttempt?.chapterId && (
        <div className="card" style={{ padding: 20, marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 700 }}>Continue where you left off</div>
            <div style={{ fontSize: 13, color: "var(--ink-muted)" }}>
              {lastAttempt.subjectName} · {lastAttempt.chapterName} (practice mode, untimed)
            </div>
          </div>
          <button className="btn btn-primary" onClick={continuePractice}>Practice Again →</button>
        </div>
      )}

      <div
        className="card"
        style={{
          padding: 20,
          marginBottom: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          background: "linear-gradient(135deg, #132a16 0%, #2f5d50 100%)",
          color: "var(--accent)",
        }}
      >
        <div>
          <div style={{ fontWeight: 700 }}>✨ No quiz for your chapter?</div>
          <div style={{ fontSize: 13, opacity: 0.85 }}>
            Upload your notes (PDF/PPTX) or paste text — AI builds a practice quiz just for you.
          </div>
        </div>
        <button
          className="btn btn-primary"
          style={{ background: "var(--accent)", color: "#132a16", border: "none", fontWeight: 700 }}
          onClick={() => navigate("/student/generate-quiz")}
        >
          Generate Quiz from Notes →
        </button>
      </div>

      <div className="section-eyebrow-row">
        <span className="eyebrow">Your subjects{semesterName ? ` — ${semesterName}` : ""}</span>
      </div>

      {loading ? (
        <Loader label="Loading your subjects..." />
      ) : subjects.length === 0 ? (
        <div className="empty-state card">No subjects available for your semester yet. Check back once your faculty adds one.</div>
      ) : (
        <div className="grid-cards">
          {subjects.map((sub) => (
            <StepCard
              key={sub.id}
              title={sub.name}
              subtitle="Tap to view chapters"
              icon={sub.name[0]}
              onClick={() => navigate(`/student/${user.semesterId}/${sub.id}/chapters`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
