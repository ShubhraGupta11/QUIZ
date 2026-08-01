import { useEffect, useState } from "react";
import apiClient from "../../api/apiClient";
import BackButton from "../../components/BackButton";
import "../faculty/Faculty.css";

export default function AdminFaculty() {
  const [faculty, setFaculty] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editingDepts, setEditingDepts] = useState([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    Promise.all([
      apiClient.get("/admin/faculty"),
      apiClient.get("/departments"),
    ])
      .then(([facRes, deptRes]) => {
        setFaculty(facRes.data.data);
        setDepartments(deptRes.data.data.map((d) => d.name));
      })
      .catch((err) => console.error("Error loading faculty:", err))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function startEdit(f) {
    setEditingId(f._id);
    setEditingDepts(f.departments || []);
  }

  function toggleDept(d) {
    setEditingDepts((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  async function saveDepts(id) {
    if (editingDepts.length === 0) return alert("Select at least one department.");
    try {
      await apiClient.patch(`/admin/faculty/${id}/departments`, { departments: editingDepts });
      setEditingId(null);
      load();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update departments");
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this faculty account? This cannot be undone.")) return;
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
          <h1>Faculty Accounts</h1>
          <p>View every faculty member and adjust which departments they're assigned to.</p>
        </div>
        <div className="page-header-side">
          <span className="badge badge-teal">{faculty.length} total</span>
        </div>
      </div>

      {loading ? (
        <div className="empty-state">Loading...</div>
      ) : faculty.length === 0 ? (
        <div className="empty-state card">No faculty accounts yet.</div>
      ) : (
        <div className="manage-list">
          {faculty.map((f) => (
            <div className="manage-row" key={f._id} style={{ flexDirection: "column", alignItems: "stretch" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                <div>
                  <div className="manage-row-text">{f.name}</div>
                  <div className="manage-row-sub">{f.email}</div>
                </div>
                <div className="manage-row-actions">
                  {editingId === f._id ? (
                    <>
                      <button className="btn btn-primary btn-sm" onClick={() => saveDepts(f._id)}>Save</button>
                      <button className="btn btn-outline btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button className="btn btn-outline btn-sm" onClick={() => startEdit(f)}>Edit Departments</button>
                      <button className="icon-btn danger" onClick={() => handleDelete(f._id)}>Delete</button>
                    </>
                  )}
                </div>
              </div>

              {editingId === f._id ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                  {departments.map((d) => (
                    <label key={d} className="dept-dropdown-item" style={{ border: "1px solid var(--border-soft)", borderRadius: 8, padding: "6px 10px" }}>
                      <input type="checkbox" checked={editingDepts.includes(d)} onChange={() => toggleDept(d)} />
                      {d}
                    </label>
                  ))}
                </div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                  {(f.departments || []).map((d) => (
                    <span key={d} className="badge badge-teal">{d}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
