import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { getSubjects, getChapters } from "../../api/mockData";
import apiClient from "../../api/apiClient";
import Loader from "../../components/Loader";
import BackButton from "../../components/BackButton";
import "./Student.css";

export default function MyDoubts() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [doubts, setDoubts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.semesterId) getSubjects(user.semesterId).then(setSubjects);
    fetchDoubts();
  }, [user]);

  useEffect(() => {
    if (!selectedSubject) { setChapters([]); setChapterId(""); return; }
    getChapters(selectedSubject).then(setChapters);
    setChapterId("");
  }, [selectedSubject]);

  async function fetchDoubts() {
    setLoading(true);
    try {
      const res = await apiClient.get("/doubts/me");
      setDoubts(res.data.data);
    } catch (err) {
      console.error("Error fetching doubts:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!chapterId || !message.trim()) {
      alert("Please choose a chapter and write your doubt.");
      return;
    }
    setSubmitting(true);
    try {
      await apiClient.post("/doubts", { chapterId, message: message.trim() });
      setMessage("");
      fetchDoubts();
    } catch (err) {
      console.error("Error submitting doubt:", err);
      alert(err.response?.data?.message || "Failed to submit doubt.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page container">
      <BackButton />
      <div className="page-header">
        <div>
          <span className="eyebrow">Ask faculty</span>
          <h1>My Doubts</h1>
          <p>Ask your faculty a question about a chapter and get a direct answer.</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 640, padding: 24, marginBottom: 32 }}>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 12 }}>
            <select style={{ flex: 1 }} value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)}>
              <option value="">Choose Subject</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select style={{ flex: 1 }} value={chapterId} disabled={!selectedSubject} onChange={(e) => setChapterId(e.target.value)}>
              <option value="">Choose Chapter</option>
              {chapters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <textarea
            rows={3}
            placeholder="Write your doubt here..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--border-soft)" }}
          />
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Sending..." : "Send to Faculty"}
          </button>
        </form>
      </div>

      {loading ? (
        <Loader label="Loading your doubts..." />
      ) : doubts.length === 0 ? (
        <div className="empty-state card">You haven't asked any doubts yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {doubts.map((d) => (
            <div key={d._id} className="review-item card" style={{ flexDirection: "column", alignItems: "stretch" }}>
              <div className="q-text">{d.chapterId?.name || "Deleted Chapter"}</div>
              <div className="a-text" style={{ marginBottom: 8 }}>{d.message}</div>
              {d.status === "answered" ? (
                <div style={{ fontSize: 13, background: "var(--bg-alt)", padding: 10, borderRadius: 8, border: "1px solid var(--border-soft)" }}>
                  💬 <strong>{d.answeredBy?.name || "Faculty"}:</strong> {d.answer}
                </div>
              ) : (
                <span className="badge badge-gold" style={{ alignSelf: "flex-start" }}>Waiting for faculty reply</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
