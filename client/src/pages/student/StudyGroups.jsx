import { useEffect, useState } from "react";
import apiClient from "../../api/apiClient";
import Loader from "../../components/Loader";
import BackButton from "../../components/BackButton";
import "./Student.css";

export default function StudyGroups() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newGroupName, setNewGroupName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeGroup, setActiveGroup] = useState(null);
  const [leaderboard, setLeaderboard] = useState(null);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  useEffect(() => {
    fetchGroups();
  }, []);

  async function fetchGroups() {
    setLoading(true);
    try {
      const res = await apiClient.get("/groups/mine");
      setGroups(res.data.data);
    } catch (err) {
      console.error("Error fetching groups:", err);
    } finally {
      setLoading(false);
    }
  }

  async function createGroup(e) {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setBusy(true);
    try {
      await apiClient.post("/groups", { name: newGroupName.trim() });
      setNewGroupName("");
      fetchGroups();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to create group.");
    } finally {
      setBusy(false);
    }
  }

  async function joinGroup(e) {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setBusy(true);
    try {
      await apiClient.post("/groups/join", { code: joinCode.trim() });
      setJoinCode("");
      fetchGroups();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to join group.");
    } finally {
      setBusy(false);
    }
  }

  async function viewLeaderboard(group) {
    setActiveGroup(group);
    setLoadingLeaderboard(true);
    try {
      const res = await apiClient.get(`/groups/${group._id}/leaderboard`);
      setLeaderboard(res.data.data);
    } catch (err) {
      console.error("Error loading group leaderboard:", err);
    } finally {
      setLoadingLeaderboard(false);
    }
  }

  return (
    <div className="page container">
      <BackButton />
      <div className="page-header">
        <div>
          <span className="eyebrow">Compete together</span>
          <h1>Study Groups</h1>
          <p>Create or join a group with friends and compare progress.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ marginBottom: 12, fontSize: 15 }}>Create a Group</h3>
          <form onSubmit={createGroup} style={{ display: "flex", gap: 8 }}>
            <input
              placeholder="Group name"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary" disabled={busy}>Create</button>
          </form>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ marginBottom: 12, fontSize: 15 }}>Join a Group</h3>
          <form onSubmit={joinGroup} style={{ display: "flex", gap: 8 }}>
            <input
              placeholder="Enter group code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary" disabled={busy}>Join</button>
          </form>
        </div>
      </div>

      {loading ? (
        <Loader label="Loading your groups..." />
      ) : groups.length === 0 ? (
        <div className="empty-state card">You're not in any study groups yet. Create one or join with a code!</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {groups.map((g) => (
            <div key={g._id} className="card" style={{ padding: 18, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 700 }}>{g.name}</div>
                <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                  Code: <strong>{g.code}</strong> · {g.members.length} member{g.members.length === 1 ? "" : "s"}
                </div>
              </div>
              <button className="btn btn-outline" onClick={() => viewLeaderboard(g)}>View Leaderboard →</button>
            </div>
          ))}
        </div>
      )}

      {activeGroup && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={() => { setActiveGroup(null); setLeaderboard(null); }}
        >
          <div className="card" style={{ maxWidth: 480, width: "100%", padding: 28, maxHeight: "80vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 16 }}>{activeGroup.name} — Leaderboard</h3>
            {loadingLeaderboard ? (
              <Loader label="Loading..." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {leaderboard?.members.map((m, i) => (
                  <div
                    key={m.studentId}
                    style={{
                      display: "flex", justifyContent: "space-between", padding: "8px 12px", borderRadius: 8,
                      background: m.isMe ? "var(--accent-soft)" : "transparent", fontSize: 13.5,
                    }}
                  >
                    <span>{i + 1}. {m.name}{m.isMe && " (You)"}</span>
                    <span>{m.avgPercent}% avg · {m.totalAttempts} quizzes</span>
                  </div>
                ))}
              </div>
            )}
            <button className="btn btn-outline" style={{ marginTop: 20 }} onClick={() => { setActiveGroup(null); setLeaderboard(null); }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
