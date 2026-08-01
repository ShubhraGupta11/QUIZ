import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useQuiz } from "../../context/QuizContext";
import { getSubjects } from "../../api/mockData";
import apiClient from "../../api/apiClient";
import StepCard from "../../components/StepCard";
import Loader from "../../components/Loader";
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

      {lastAttempt?.chapterId && (
        <div className="card" style={{ padding: 20, marginBottom: 32, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 700 }}>Continue where you left off</div>
            <div style={{ fontSize: 13, color: "var(--ink-muted)" }}>
              {lastAttempt.subjectName} · {lastAttempt.chapterName} (practice mode, untimed)
            </div>
          </div>
          <button className="btn btn-primary" onClick={continuePractice}>Practice Again →</button>
        </div>
      )}

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
