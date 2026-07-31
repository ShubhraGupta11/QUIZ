import { useEffect, useState, useCallback } from "react";
import apiClient from "../../api/apiClient";
import "./Faculty.css";

export default function ManagePanel({ type, title, description, parentOptions, parentLabel, onRefreshParent, departmentOptions, getNameOptions }) {
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [customName, setCustomName] = useState("");
  const [parentId, setParentId] = useState("");
  const [department, setDepartment] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedParent = parentOptions?.find((p) => p.id === parentId) || null;
  const nameOptions = getNameOptions ? getNameOptions(department, selectedParent) : null;

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (departmentOptions && department) params.set("department", department);
      if (parentOptions && parentId) {
        const parentKey = type === "subjects" ? "semesterId" : type === "chapters" ? "subjectId" : null;
        if (parentKey) params.set(parentKey, parentId);
      }
      const query = params.toString() ? `?${params.toString()}` : "";
      const res = await apiClient.get(`/${type}${query}`);
      const mapped = res.data.data.map((item) => ({
        id: item._id,
        name: item.name,
        parentName: item.semesterId?.name || item.subjectId?.name || null,
        parentId: item.semesterId?._id || item.subjectId?._id || null,
        department: item.department || null,
        order: item.order,
        questionCount: item.questionCount,
      }));
      setItems(mapped);
    } catch (err) {
      console.error(`Error loading ${type}:`, err);
    } finally {
      setLoading(false);
    }
  }, [type, department, departmentOptions, parentId, parentOptions]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  async function handleAdd(e) {
    e.preventDefault();
    const finalName = nameOptions ? (name === "Other" ? customName : name) : name;
    if (!finalName.trim()) return;
    if (parentOptions && !parentId) {
      alert(`Please select a ${parentLabel}`);
      return;
    }
    if (departmentOptions && !department) {
      alert("Please select a department");
      return;
    }

    try {
      const body = { name: finalName.trim() };
      if (type === "semesters") {
        body.order = items.length + 1;
        body.department = department;
      } else if (type === "subjects") {
        body.semesterId = parentId;
        body.department = department;
      } else if (type === "chapters") {
        body.subjectId = parentId;
      }

      await apiClient.post(`/${type}`, body);
      setName("");
      setCustomName("");
      setParentId("");
      await loadItems();
      if (onRefreshParent) onRefreshParent(department);
      alert(`${title.toLowerCase().replace(/s$/, "")} added successfully!`);
    } catch (error) {
      console.error(`Error adding ${type}:`, error);
      alert(error.response?.data?.message || `Failed to add ${type}`);
    }
  }

  async function handleDelete(id) {
    const confirmDelete = window.confirm(`Are you sure you want to delete this ${title.toLowerCase().replace(/s$/, "")}?`);
    if (!confirmDelete) return;

    try {
      await apiClient.delete(`/${type}/${id}`);
      await loadItems();
      if (onRefreshParent) onRefreshParent(department);
      alert("Deleted successfully!");
    } catch (error) {
      console.error(`Error deleting ${type}:`, error);
      alert(error.response?.data?.message || `Failed to delete ${type}`);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow">Content manager</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className="page-header-side">
          <span className="badge badge-teal">{items.length} total</span>
        </div>
      </div>

      <div className="faculty-panel card">
        <div className="panel-header">
          <h3>Add new {title.toLowerCase().replace(/s$/, "")}</h3>
        </div>
        <form className="inline-form" onSubmit={handleAdd}>
          {departmentOptions && (
            <select
              value={department}
              onChange={(e) => {
                const dept = e.target.value;
                setDepartment(dept);
                setParentId("");
                setName("");
                setCustomName("");
                if (onRefreshParent) onRefreshParent(dept);
              }}
            >
              <option value="">Select Department</option>
              {departmentOptions.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          )}
          {parentOptions && (
            <select
              value={parentId}
              onChange={(e) => {
                setParentId(e.target.value);
                setName("");
                setCustomName("");
              }}
            >
              <option value="">Select {parentLabel}</option>
              {parentOptions.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
          {nameOptions ? (
            <>
              <select value={name} onChange={(e) => setName(e.target.value)}>
                <option value="">Select {title.toLowerCase().replace(/s$/, "")}</option>
                {nameOptions.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              {name === "Other" && (
                <input
                  placeholder="Enter custom name"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                />
              )}
            </>
          ) : (
            <input
              placeholder={`New ${title.toLowerCase().replace(/s$/, "")} name`}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
          <button type="submit" className="btn btn-primary" disabled={loading}>Add</button>
        </form>

        {items.length === 0 ? (
          <div className="empty-state">No {title.toLowerCase()} created yet. Add one above.</div>
        ) : (
          <div className="manage-list">
            {items.map((item) => (
              <div className="manage-row" key={item.id}>
                <div>
                  <div className="manage-row-text">{item.name}</div>
                  {item.department && <div className="manage-row-sub">Department: {item.department}</div>}
                  {item.parentName && <div className="manage-row-sub">{parentLabel}: {item.parentName}</div>}
                  {type === "semesters" && item.order !== undefined && (
                    <div className="manage-row-sub">Order: {item.order}</div>
                  )}
                  {type === "chapters" && item.questionCount !== undefined && (
                    <div className="manage-row-sub">{item.questionCount} question{item.questionCount === 1 ? "" : "s"}</div>
                  )}
                </div>
                <div className="manage-row-actions">
                  <button className="icon-btn danger" onClick={() => handleDelete(item.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
