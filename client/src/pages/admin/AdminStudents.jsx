import { useEffect, useState } from "react";
import apiClient from "../../api/apiClient";
import BackButton from "../../components/BackButton";
import "../faculty/Faculty.css";

export default function AdminStudents() {
  const [students, setStudents] = useState([]);
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get("/departments").then((res) => setDepartments(res.data.data.map((d) => d.name)));
  }, []);

  function load() {
    setLoading(true);
    const query = departmentFilter ? `?department=${encodeURIComponent(departmentFilter)}` : "";
    apiClient.get(`/admin/students${query}`)
      .then((res) => setStudents(res.data.data))
      .catch((err) => console.error("Error loading students:", err))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [departmentFilter]);

  async function handleDelete(id) {
    if (!window.confirm("Delete this student account? This cannot be undone.")) return;
    try {
      await apiClient.delete(`/admin/users/${id}`);
      load();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete account");
    }
  }

  return (
    <div>
      <BackButton />
      <div className="page-header">
        <div>
          <span className="eyebrow">Platform administration</span>
          <h1>Student Accounts</h1>
          <p>View every student, optionally filtered by department.</p>
        </div>
        <div className="page-header-side">
          <span className="badge badge-teal">{students.length} total</span>
        </div>
      </div>

      <div className="faculty-panel card">
        <div className="panel-header">
          <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
            <option value="">All departments</option>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="empty-state">Loading...</div>
        ) : students.length === 0 ? (
          <div className="empty-state">No students found.</div>
        ) : (
          <div className="manage-list">
            {students.map((s) => (
              <div className="manage-row" key={s._id}>
                <div>
                  <div className="manage-row-text">{s.name}</div>
                  <div className="manage-row-sub">{s.email} · {s.department} · {s.semesterId?.name || "—"}</div>
                </div>
                <div className="manage-row-actions">
                  <button className="icon-btn danger" onClick={() => handleDelete(s._id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
