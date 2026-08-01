import { useEffect, useState } from "react";
import apiClient from "../../api/apiClient";
import Loader from "../../components/Loader";
import "./Faculty.css";

export default function StudentDoubts() {
  const [doubts, setDoubts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replyDrafts, setReplyDrafts] = useState({});
  const [submitting, setSubmitting] = useState({});

  useEffect(() => {
    fetchDoubts();
  }, []);

  async function fetchDoubts() {
    setLoading(true);
    try {
      const res = await apiClient.get("/doubts/inbox");
      setDoubts(res.data.data);
    } catch (err) {
      console.error("Error fetching doubts inbox:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleReply(id) {
    const answer = (replyDrafts[id] || "").trim();
    if (!answer) return;
    setSubmitting((prev) => ({ ...prev, [id]: true }));
    try {
      await apiClient.put(`/doubts/${id}/answer`, { answer });
      setReplyDrafts((prev) => ({ ...prev, [id]: "" }));
      fetchDoubts();
    } catch (err) {
      console.error("Error answering doubt:", err);
      alert("Failed to send reply.");
    } finally {
      setSubmitting((prev) => ({ ...prev, [id]: false }));
    }
  }

  const openDoubts = doubts.filter((d) => d.status === "open");
  const answeredDoubts = doubts.filter((d) => d.status === "answered");

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow">Student support</span>
          <h1>Student Doubts</h1>
          <p className="sub">Answer questions students have asked about your chapters.</p>
        </div>
        <div className="page-header-side">
          <span className="badge badge-gold">{openDoubts.length} open</span>
          <span className="badge badge-teal">{answeredDoubts.length} answered</span>
        </div>
      </div>

      {loading ? (
        <Loader label="Loading doubts..." />
      ) : doubts.length === 0 ? (
        <div className="empty-state card">No doubts from students yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[...openDoubts, ...answeredDoubts].map((d) => (
            <div key={d._id} className="faculty-panel card">
              <div className="panel-header">
                <h3>{d.chapterId?.name || "Deleted Chapter"}</h3>
                <span className={`badge ${d.status === "open" ? "badge-gold" : "badge-teal"}`}>{d.status}</span>
              </div>
              <div style={{ fontSize: 13, marginBottom: 8 }}>
                <strong>{d.studentId?.name || "Deleted Student"}</strong> asked:
              </div>
              <div style={{ fontSize: 14, marginBottom: 12 }}>{d.message}</div>

              {d.status === "answered" ? (
                <div style={{ fontSize: 13, background: "var(--paper)", padding: 10, borderRadius: 8 }}>
                  Your reply: {d.answer}
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    placeholder="Write a reply..."
                    style={{ flex: 1 }}
                    value={replyDrafts[d._id] || ""}
                    onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [d._id]: e.target.value }))}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={() => handleReply(d._id)}
                    disabled={submitting[d._id] || !(replyDrafts[d._id] || "").trim()}
                  >
                    {submitting[d._id] ? "Sending..." : "Reply"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
