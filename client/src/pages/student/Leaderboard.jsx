import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import apiClient from "../../api/apiClient";
import Loader from "../../components/Loader";
import "./Student.css";

export default function Leaderboard() {
  const { chapterId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const meta = location.state || {};

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get(`/attempts/leaderboard/${chapterId}`)
      .then((res) => setRows(res.data.data))
      .catch((err) => console.error("Failed to load leaderboard:", err))
      .finally(() => setLoading(false));
  }, [chapterId]);

  return (
    <div className="page container">
      <button className="back-link" style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => navigate(-1)}>
        ← Back
      </button>
      <div className="page-header">
        <div>
          <span className="eyebrow">Rankings</span>
          <h1>Leaderboard{meta.chapterName ? ` · ${meta.chapterName}` : ""}</h1>
          <p>Top scorers for this chapter (best attempt per student).</p>
        </div>
      </div>

      {loading ? (
        <Loader label="Loading leaderboard..." />
      ) : rows.length === 0 ? (
        <div className="empty-state card">No attempts recorded for this chapter yet. Be the first!</div>
      ) : (
        <div className="chart-card card">
          <table className="attempt-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Student</th>
                <th>Score</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.studentId} style={r.isMe ? { background: "var(--accent-soft)" } : undefined}>
                  <td>{r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : r.rank === 3 ? "🥉" : r.rank}</td>
                  <td>{r.name}{r.isMe && " (You)"}</td>
                  <td>
                    <span className="score-pill good">
                      {r.score}/{r.total} ({Math.round((r.score / r.total) * 100)}%)
                    </span>
                  </td>
                  <td>{r.timeTaken}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
