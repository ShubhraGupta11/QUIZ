import { useEffect, useState } from "react";
import apiClient from "../../api/apiClient";
import BackButton from "../../components/BackButton";
import "../faculty/Faculty.css";

export default function AdminDepartments() {
  const [departments, setDepartments] = useState([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  function loadDepartments() {
    setLoading(true);
    apiClient.get("/departments")
      .then((res) => setDepartments(res.data.data))
      .catch((err) => console.error("Error loading departments:", err))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadDepartments(); }, []);

  async function handleAdd(e) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await apiClient.post("/departments", { name: name.trim() });
      setName("");
      loadDepartments();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to add department");
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this department? Faculty/students already assigned to it will keep the name on their profile, but it will disappear from new signup/creation dropdowns.")) return;
    try {
      await apiClient.delete(`/departments/${id}`);
      loadDepartments();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete department");
    }
  }

  return (
    <div>
      <BackButton />
      <div className="page-header">
        <div>
          <span className="eyebrow">Platform administration</span>
          <h1>Departments</h1>
          <p>Manage the master department list used across registration, faculty setup, and content creation.</p>
        </div>
        <div className="page-header-side">
          <span className="badge badge-teal">{departments.length} total</span>
        </div>
      </div>

      <div className="faculty-panel card">
        <div className="panel-header"><h3>Add new department</h3></div>
        <form className="inline-form" onSubmit={handleAdd}>
          <input
            placeholder="e.g. Biotechnology"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" disabled={loading}>Add</button>
        </form>

        {departments.length === 0 ? (
          <div className="empty-state">No departments yet. Add one above.</div>
        ) : (
          <div className="manage-list">
            {departments.map((d) => (
              <div className="manage-row" key={d._id}>
                <div className="manage-row-text">{d.name}</div>
                <div className="manage-row-actions">
                  <button className="icon-btn danger" onClick={() => handleDelete(d._id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
