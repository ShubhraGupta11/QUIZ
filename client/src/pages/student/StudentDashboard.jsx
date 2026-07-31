import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useQuiz } from "../../context/QuizContext";
import SemesterSelect from "./SemesterSelect";
import "./Student.css";

export default function StudentDashboard() {
  const { user } = useAuth();
  const { attempts } = useQuiz();
  const navigate = useNavigate();

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
          <span className="badge badge-gold">Sem-wise practice</span>
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

      <div className="section-eyebrow-row">
        <span className="eyebrow">Choose your semester</span>
      </div>
      <SemesterSelect embedded />
    </div>
  );
}
