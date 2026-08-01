import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import apiClient from "../../api/apiClient";
import BackButton from "../../components/BackButton";
import "../faculty/Faculty.css";

export default function AdminOverview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [counts, setCounts] = useState({
    students: 0, faculty: 0, departments: 0, subjects: 0, chapters: 0, questions: 0, attempts: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get("/admin/overview")
      .then((res) => setCounts(res.data.data))
      .catch((err) => console.error("Error loading admin overview:", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <BackButton />
      <div className="page-header">
        <div>
          <span className="eyebrow">Admin overview</span>
          <h1>Welcome, {user?.name} 👋</h1>
          <p className="sub">Platform-wide snapshot across every department.</p>
        </div>
      </div>

      <div className="faculty-stats">
        <div className="faculty-stat card">
          <div className="num">{loading ? "…" : counts.students}</div>
          <div className="label">Students</div>
        </div>
        <div className="faculty-stat card">
          <div className="num">{loading ? "…" : counts.faculty}</div>
          <div className="label">Faculty</div>
        </div>
        <div className="faculty-stat card">
          <div className="num">{loading ? "…" : counts.departments}</div>
          <div className="label">Departments</div>
        </div>
        <div className="faculty-stat card">
          <div className="num">{loading ? "…" : counts.subjects}</div>
          <div className="label">Subjects</div>
        </div>
        <div className="faculty-stat card">
          <div className="num">{loading ? "…" : counts.chapters}</div>
          <div className="label">Chapters</div>
        </div>
        <div className="faculty-stat card">
          <div className="num">{loading ? "…" : counts.questions}</div>
          <div className="label">Questions</div>
        </div>
        <div className="faculty-stat card">
          <div className="num">{loading ? "…" : counts.attempts}</div>
          <div className="label">Quiz Attempts</div>
        </div>
      </div>

      <div className="faculty-panel card">
        <div className="panel-header">
          <h3>Quick Actions</h3>
        </div>
        <div className="manage-list">
          <div className="manage-row">
            <div>
              <div className="manage-row-text">🏛 Manage Departments</div>
              <div className="manage-row-sub">Add, rename, or remove departments used across the whole platform</div>
            </div>
            <button className="btn btn-primary" onClick={() => navigate("/admin/departments")}>Go →</button>
          </div>
          <div className="manage-row">
            <div>
              <div className="manage-row-text">👨‍🏫 Manage Faculty</div>
              <div className="manage-row-sub">View faculty accounts and adjust their department assignments</div>
            </div>
            <button className="btn btn-outline" onClick={() => navigate("/admin/faculty")}>Go →</button>
          </div>
          <div className="manage-row">
            <div>
              <div className="manage-row-text">🌳 Browse Content Tree</div>
              <div className="manage-row-sub">See every department's semesters, subjects, chapters, and questions</div>
            </div>
            <button className="btn btn-outline" onClick={() => navigate("/admin/content")}>Go →</button>
          </div>
        </div>
      </div>
    </div>
  );
}
