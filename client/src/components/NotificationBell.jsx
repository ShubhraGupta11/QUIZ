import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuiz } from "../context/QuizContext";
import apiClient from "../api/apiClient";

const SEEN_KEY = "smartquiz_seen_doubt_answers";

export default function NotificationBell() {
  const { attempts } = useQuiz();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [answeredDoubts, setAnsweredDoubts] = useState([]);

  useEffect(() => {
    apiClient
      .get("/doubts/me")
      .then((res) => setAnsweredDoubts(res.data.data.filter((d) => d.status === "answered")))
      .catch(() => {});
  }, []);

  const revisionCount = useMemo(() => {
    const byChapter = new Map();
    attempts.forEach((a) => {
      if (!a.chapterId) return;
      const existing = byChapter.get(a.chapterId);
      if (!existing || new Date(a.date) > new Date(existing.date)) byChapter.set(a.chapterId, a);
    });
    const now = Date.now();
    return Array.from(byChapter.values()).filter((a) => {
      const percent = (a.correct / a.total) * 100;
      const daysAgo = Math.floor((now - new Date(a.date)) / 86400000);
      return daysAgo >= 7 || percent < 60;
    }).length;
  }, [attempts]);

  const seenIds = useMemo(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]"));
    } catch {
      return new Set();
    }
  }, [open]);

  const unseenDoubts = answeredDoubts.filter((d) => !seenIds.has(d._id));
  const totalCount = revisionCount + unseenDoubts.length;

  function markSeen() {
    localStorage.setItem(SEEN_KEY, JSON.stringify(answeredDoubts.map((d) => d._id)));
  }

  function toggle() {
    setOpen((o) => {
      if (!o) markSeen();
      return !o;
    });
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={toggle}
        aria-label="Notifications"
        style={{ position: "relative", fontSize: 16 }}
      >
        🔔
        {totalCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: -2,
              right: -2,
              background: "var(--danger)",
              color: "#fff",
              borderRadius: "50%",
              fontSize: 10,
              width: 16,
              height: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
            }}
          >
            {totalCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="card fade-in"
          style={{
            position: "absolute",
            right: 0,
            top: "110%",
            width: 300,
            padding: 12,
            zIndex: 50,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {revisionCount > 0 && (
            <div
              style={{ fontSize: 13, padding: 10, background: "var(--bg-alt)", borderRadius: 8, cursor: "pointer" }}
              onClick={() => { setOpen(false); navigate("/student/dashboard"); }}
            >
              ⏰ {revisionCount} chapter{revisionCount === 1 ? "" : "s"} need revision
            </div>
          )}
          {unseenDoubts.map((d) => (
            <div
              key={d._id}
              style={{ fontSize: 13, padding: 10, background: "var(--bg-alt)", borderRadius: 8, cursor: "pointer" }}
              onClick={() => { setOpen(false); navigate("/student/doubts"); }}
            >
              💬 Faculty answered your doubt on {d.chapterId?.name || "a chapter"}
            </div>
          ))}
          {totalCount === 0 && (
            <div style={{ fontSize: 13, color: "var(--ink-muted)", textAlign: "center", padding: 10 }}>
              You're all caught up!
            </div>
          )}
        </div>
      )}
    </div>
  );
}
