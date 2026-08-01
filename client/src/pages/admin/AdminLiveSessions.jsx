import { useEffect, useState } from "react";
import apiClient from "../../api/apiClient";
import BackButton from "../../components/BackButton";
import "../faculty/Faculty.css";

export default function AdminLiveSessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  function load() {
    apiClient.get("/admin/live-sessions")
      .then((res) => setSessions(res.data.data))
      .catch((err) => console.error("Error loading live sessions:", err))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000); // light polling — sessions are ephemeral, no socket needed here
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <BackButton />
      <div className="page-header">
        <div>
          <span className="eyebrow">Platform administration</span>
          <h1>Live Sessions</h1>
          <p>Currently-running Live Quiz Battles across the whole platform. Refreshes automatically every 5s.</p>
        </div>
        <div className="page-header-side">
          <span className="badge badge-teal">{sessions.length} active</span>
        </div>
      </div>

      {loading ? (
        <div className="empty-state">Loading...</div>
      ) : sessions.length === 0 ? (
        <div className="empty-state card">No live sessions running right now.</div>
      ) : (
        <div className="manage-list">
          {sessions.map((s) => (
            <div className="manage-row" key={s.code}>
              <div>
                <div className="manage-row-text">Room {s.code} — {s.chapterName}</div>
                <div className="manage-row-sub">
                  Status: {s.status} · Question {s.currentQuestion}/{s.totalQuestions} · {s.playerCount} player{s.playerCount === 1 ? "" : "s"}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
