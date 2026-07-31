import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import apiClient from "../../api/apiClient";
import "./Faculty.css";

export default function FacultyOverview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [counts, setCounts] = useState({ semesters: 0, subjects: 0, chapters: 0, questions: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadCounts() {
      try {
        const subjectsRes = await apiClient.get("/subjects");
        const subjects = subjectsRes.data.data;

        const distinctSemesters = new Set(
          subjects.map((s) => s.semesterId?._id || s.semesterId).filter(Boolean)
        );

        const chaptersPerSubject = await Promise.all(
          subjects.map((s) => apiClient.get(`/chapters?subjectId=${s._id}`))
        );
        const chapters = chaptersPerSubject.flatMap((res) => res.data.data);
        const questionTotal = chapters.reduce((sum, ch) => sum + (ch.questionCount || 0), 0);

        if (!cancelled) {
          setCounts({
            semesters: distinctSemesters.size,
            subjects: subjects.length,
            chapters: chapters.length,
            questions: questionTotal,
          });
        }
      } catch (err) {
        console.error("Error loading faculty overview counts:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadCounts();
    return () => { cancelled = true; };
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow">Faculty overview</span>
          <h1>Welcome, {user?.name} 👋</h1>
          <p className="sub">Here's a quick snapshot of your quiz content.</p>
        </div>
        <div className="page-header-side">
          {(user?.departments || []).map((d) => (
            <span key={d} className="badge badge-teal">{d}</span>
          ))}
          <span className="badge badge-gold">{loading ? "…" : counts.questions} questions live</span>
        </div>
      </div>

      <div className="faculty-stats">
        <div className="faculty-stat card">
          <div className="num">{counts.semesters}</div>
          <div className="label">Semesters</div>
        </div>
        <div className="faculty-stat card">
          <div className="num">{counts.subjects}</div>
          <div className="label">Subjects</div>
        </div>
        <div className="faculty-stat card">
          <div className="num">{counts.chapters}</div>
          <div className="label">Chapters</div>
        </div>
        <div className="faculty-stat card">
          <div className="num">{counts.questions}</div>
          <div className="label">Questions</div>
        </div>
      </div>

      <div className="faculty-panel card">
        <div className="panel-header">
          <h3>Quick Actions</h3>
          <span className="badge badge-accent">3 shortcuts</span>
        </div>
        <div className="manage-list">
          <div className="manage-row">
            <div>
              <div className="manage-row-text">Add a new Semester</div>
              <div className="manage-row-sub">Create a semester before adding its subjects</div>
            </div>
            <button className="btn btn-outline" onClick={() => navigate("/faculty/semesters")}>Go →</button>
          </div>
          <div className="manage-row">
            <div>
              <div className="manage-row-text">Add a new Subject</div>
              <div className="manage-row-sub">Attach a subject to an existing semester</div>
            </div>
            <button className="btn btn-outline" onClick={() => navigate("/faculty/subjects")}>Go →</button>
          </div>
          <div className="manage-row">
            <div>
              <div className="manage-row-text">Create Quiz Questions</div>
              <div className="manage-row-sub">Author and tag questions for any chapter</div>
            </div>
            <button className="btn btn-outline" onClick={() => navigate("/faculty/questions")}>Go →</button>
          </div>
        </div>
      </div>
    </div>
  );
}
