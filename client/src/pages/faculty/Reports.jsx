import { useEffect, useState } from "react";
import apiClient from "../../api/apiClient";
import Loader from "../../components/Loader";
import BackButton from "../../components/BackButton";
import "./Faculty.css";

function toCSV(rows) {
  const header = ["Student", "Email", "Semester", "Subject", "Chapter", "Score", "Total", "Percent", "Time (s)", "Date"];
  const lines = [header.join(",")];
  rows.forEach((r) => {
    const percent = r.total > 0 ? Math.round((r.score / r.total) * 100) : 0;
    lines.push([
      r.studentId?.name || "Deleted Student",
      r.studentId?.email || "",
      r.chapterId?.subjectId?.semesterId?.name || "",
      r.chapterId?.subjectId?.name || "",
      r.chapterId?.name || "Deleted Chapter",
      r.score,
      r.total,
      `${percent}%`,
      r.timeTaken,
      new Date(r.createdAt).toLocaleString(),
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
  });
  return lines.join("\n");
}

export default function Reports() {
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Item analysis selectors
  const [semesters, setSemesters] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [selectedSemester, setSelectedSemester] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedChapter, setSelectedChapter] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);

  useEffect(() => {
    apiClient
      .get("/attempts/reports")
      .then((res) => setAttempts(res.data.data))
      .catch((err) => console.error("Error loading reports:", err))
      .finally(() => setLoading(false));
    apiClient.get("/semesters").then((res) => setSemesters(res.data.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedSemester) { setSubjects([]); setSelectedSubject(""); return; }
    apiClient.get(`/subjects?semesterId=${selectedSemester}`).then((res) => setSubjects(res.data.data)).catch(() => {});
    setSelectedSubject("");
    setChapters([]);
    setSelectedChapter("");
  }, [selectedSemester]);

  useEffect(() => {
    if (!selectedSubject) { setChapters([]); setSelectedChapter(""); return; }
    apiClient.get(`/chapters?subjectId=${selectedSubject}`).then((res) => setChapters(res.data.data)).catch(() => {});
    setSelectedChapter("");
  }, [selectedSubject]);

  useEffect(() => {
    if (!selectedChapter) { setAnalysis(null); return; }
    setLoadingAnalysis(true);
    apiClient
      .get(`/attempts/analysis/${selectedChapter}`)
      .then((res) => setAnalysis(res.data.data))
      .catch((err) => console.error("Error loading analysis:", err))
      .finally(() => setLoadingAnalysis(false));
  }, [selectedChapter]);

  const totalAttempts = attempts.length;
  const avgPercent = totalAttempts > 0
    ? Math.round(attempts.reduce((sum, a) => sum + (a.total > 0 ? (a.score / a.total) * 100 : 0), 0) / totalAttempts)
    : 0;
  const uniqueStudents = new Set(attempts.map((a) => a.studentId?._id).filter(Boolean)).size;

  function handleExportReportsCSV() {
    const csv = toCSV(attempts);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "class-reports.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  return (
    <div>
      <BackButton />
      <div className="page-header">
        <div>
          <span className="eyebrow">Analytics</span>
          <h1>Student Reports</h1>
          <p className="sub">Class-wide performance and per-question item analysis.</p>
        </div>
        <div className="page-header-side">
          <span className="badge badge-teal">{totalAttempts} attempts</span>
          <span className="badge badge-gold">{uniqueStudents} students</span>
        </div>
      </div>

      {loading ? (
        <Loader label="Loading reports..." />
      ) : (
        <>
          <div className="stat-row" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 20, marginBottom: 24 }}>
            <div className="stat-box card" style={{ padding: 24 }}>
              <div className="num" style={{ fontSize: 28, fontWeight: 700 }}>{totalAttempts}</div>
              <div className="label">Total Attempts</div>
            </div>
            <div className="stat-box card" style={{ padding: 24 }}>
              <div className="num" style={{ fontSize: 28, fontWeight: 700 }}>{uniqueStudents}</div>
              <div className="label">Unique Students</div>
            </div>
            <div className="stat-box card" style={{ padding: 24 }}>
              <div className="num" style={{ fontSize: 28, fontWeight: 700 }}>{avgPercent}%</div>
              <div className="label">Class Average</div>
            </div>
          </div>

          <div className="faculty-panel card" style={{ marginBottom: 24 }}>
            <div className="panel-header">
              <h3>All Attempts</h3>
              <button className="btn btn-outline" onClick={handleExportReportsCSV} disabled={attempts.length === 0}>
                📤 Export CSV
              </button>
            </div>
            {attempts.length === 0 ? (
              <div className="empty-state">No student attempts recorded yet.</div>
            ) : (
              <div style={{ maxHeight: 420, overflowY: "auto" }}>
                <table className="attempt-table" style={{ width: "100%", fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: 8 }}>Student</th>
                      <th style={{ textAlign: "left", padding: 8 }}>Chapter</th>
                      <th style={{ textAlign: "left", padding: 8 }}>Score</th>
                      <th style={{ textAlign: "left", padding: 8 }}>Time</th>
                      <th style={{ textAlign: "left", padding: 8 }}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attempts.map((a) => {
                      const percent = a.total > 0 ? Math.round((a.score / a.total) * 100) : 0;
                      return (
                        <tr key={a._id} style={{ borderTop: "1px solid var(--borders)" }}>
                          <td style={{ padding: 8 }}>{a.studentId?.name || "Deleted Student"}</td>
                          <td style={{ padding: 8 }}>
                            {a.chapterId?.subjectId?.semesterId?.name} · {a.chapterId?.subjectId?.name} · {a.chapterId?.name || "Deleted Chapter"}
                          </td>
                          <td style={{ padding: 8 }}>{a.score}/{a.total} ({percent}%)</td>
                          <td style={{ padding: 8 }}>{a.timeTaken}s</td>
                          <td style={{ padding: 8 }}>{new Date(a.createdAt).toLocaleDateString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="faculty-panel card">
            <div className="panel-header">
              <h3>Item Analysis (per question accuracy)</h3>
            </div>
            <div className="inline-form" style={{ display: "flex", gap: "12px", width: "100%", marginBottom: 16 }}>
              <select style={{ flex: 1 }} value={selectedSemester} onChange={(e) => setSelectedSemester(e.target.value)}>
                <option value="">Choose Semester</option>
                {semesters.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
              <select style={{ flex: 1 }} value={selectedSubject} disabled={!selectedSemester} onChange={(e) => setSelectedSubject(e.target.value)}>
                <option value="">Choose Subject</option>
                {subjects.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
              <select style={{ flex: 1 }} value={selectedChapter} disabled={!selectedSubject} onChange={(e) => setSelectedChapter(e.target.value)}>
                <option value="">Choose Chapter</option>
                {chapters.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>

            {!selectedChapter ? (
              <div className="empty-state">Choose a Semester → Subject → Chapter to view item analysis.</div>
            ) : loadingAnalysis ? (
              <Loader label="Loading analysis..." />
            ) : !analysis || analysis.length === 0 ? (
              <div className="empty-state">No questions found for this chapter.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 500, overflowY: "auto" }}>
                {analysis.map((q, idx) => (
                  <div key={q.questionId} className="manage-row" style={{ flexDirection: "column", alignItems: "stretch", padding: 12, borderBottom: "1px solid var(--borders)" }}>
                    <div style={{ fontWeight: "bold", marginBottom: 4 }}>{idx + 1}. {q.text}</div>
                    <div style={{ fontSize: 12, color: "var(--muted-ink)", marginBottom: 6 }}>
                      Attempted: {q.attemptedCount} · Correct: {q.correctCount} ·{" "}
                      {q.accuracy === null ? (
                        <span>No attempts yet</span>
                      ) : (
                        <span style={{ fontWeight: 700, color: q.accuracy < 40 ? "var(--danger)" : q.accuracy < 70 ? "var(--gold)" : "var(--teal)" }}>
                          {q.accuracy}% accuracy {q.accuracy < 40 && "⚠️ Hard for students"}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 12 }}>
                      {q.options.map((opt, oIdx) => (
                        <div key={oIdx} style={{ color: oIdx === q.correctOptionIndex ? "var(--teal)" : "var(--muted-ink)" }}>
                          {String.fromCharCode(65 + oIdx)}) {opt} {oIdx === q.correctOptionIndex && "✓"} — {q.optionCounts[oIdx]} picked
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
