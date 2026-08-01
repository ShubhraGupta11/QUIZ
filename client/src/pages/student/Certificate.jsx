import { useLocation, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import BackButton from "../../components/BackButton";
import "./Student.css";

export default function Certificate() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const data = location.state;

  if (!data) return <Navigate to="/student/dashboard" replace />;

  return (
    <div className="page container">
      <BackButton />
      <div className="no-print" style={{ maxWidth: 720, margin: "0 auto 20px", display: "flex", justifyContent: "flex-end", gap: 12 }}>
        <button className="btn btn-primary" onClick={() => window.print()}>🖨 Print / Save as PDF</button>
      </div>

      <div
        className="card"
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "56px 48px",
          textAlign: "center",
          border: "6px double var(--accent-ink)",
          background: "linear-gradient(135deg, #fdfcf7 0%, #f3f6f0 100%)",
        }}
      >
        <div style={{ fontSize: 13, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--ink-muted)" }}>
          Certificate of Achievement
        </div>
        <div style={{ fontSize: 40, margin: "20px 0 8px", fontFamily: "var(--font-display)" }}>🏆</div>
        <div style={{ fontSize: 14, color: "var(--ink-muted)" }}>This certifies that</div>
        <div style={{ fontSize: 30, fontWeight: 700, margin: "8px 0 16px", fontFamily: "var(--font-display)" }}>
          {user?.name}
        </div>
        <div style={{ fontSize: 15, color: "var(--ink-muted)" }}>
          has achieved a score of
        </div>
        <div style={{ fontSize: 26, fontWeight: 700, color: "var(--teal)", margin: "8px 0" }}>
          {Math.round(data.percent)}%
        </div>
        <div style={{ fontSize: 15, color: "var(--ink-muted)", marginBottom: 24 }}>
          in {data.chapterName} — {data.subjectName} ({data.semesterName})
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 32 }}>
          Issued on {new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })} · SmartQuiz
        </div>
      </div>

      <div className="no-print" style={{ maxWidth: 720, margin: "20px auto 0", textAlign: "center" }}>
        <button className="btn btn-outline" onClick={() => navigate("/student/dashboard")}>Back to Dashboard</button>
      </div>
    </div>
  );
}
