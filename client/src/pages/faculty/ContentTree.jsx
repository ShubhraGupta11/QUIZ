import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../api/apiClient";
import { useAuth } from "../../context/AuthContext";
import { getSubjectSuggestions } from "../../data/subjectCatalog";
import "./Faculty.css";

export default function ContentTree() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [semesters, setSemesters] = useState([]);
  const [subjectsBySemester, setSubjectsBySemester] = useState({});
  const [chaptersBySubject, setChaptersBySubject] = useState({});
  const [expandedSemesters, setExpandedSemesters] = useState(new Set());
  const [expandedSubjects, setExpandedSubjects] = useState(new Set());
  const [loadingSemesters, setLoadingSemesters] = useState(true);

  const [addingSubjectFor, setAddingSubjectFor] = useState(null); // semesterId
  const [newSubjectDept, setNewSubjectDept] = useState("");
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectCustomName, setNewSubjectCustomName] = useState("");

  const [addingChapterFor, setAddingChapterFor] = useState(null); // subjectId
  const [newChapterName, setNewChapterName] = useState("");

  useEffect(() => {
    apiClient.get("/semesters").then((res) => {
      setSemesters(res.data.data);
      setLoadingSemesters(false);
    });
  }, []);

  async function toggleSemester(sem) {
    const next = new Set(expandedSemesters);
    if (next.has(sem._id)) {
      next.delete(sem._id);
    } else {
      next.add(sem._id);
      if (!subjectsBySemester[sem._id]) {
        const res = await apiClient.get(`/subjects?semesterId=${sem._id}`);
        setSubjectsBySemester((prev) => ({ ...prev, [sem._id]: res.data.data }));
      }
    }
    setExpandedSemesters(next);
  }

  async function toggleSubject(subject) {
    const next = new Set(expandedSubjects);
    if (next.has(subject._id)) {
      next.delete(subject._id);
    } else {
      next.add(subject._id);
      if (!chaptersBySubject[subject._id]) {
        const res = await apiClient.get(`/chapters?subjectId=${subject._id}`);
        setChaptersBySubject((prev) => ({ ...prev, [subject._id]: res.data.data }));
      }
    }
    setExpandedSubjects(next);
  }

  async function refreshSubjects(semesterId) {
    const res = await apiClient.get(`/subjects?semesterId=${semesterId}`);
    setSubjectsBySemester((prev) => ({ ...prev, [semesterId]: res.data.data }));
  }

  async function refreshChapters(subjectId) {
    const res = await apiClient.get(`/chapters?subjectId=${subjectId}`);
    setChaptersBySubject((prev) => ({ ...prev, [subjectId]: res.data.data }));
  }

  async function handleAddSubject(semester) {
    const finalName = newSubjectName === "Other" ? newSubjectCustomName : newSubjectName;
    if (!finalName.trim() || !newSubjectDept) {
      alert("Please select a department and a subject name.");
      return;
    }
    try {
      await apiClient.post("/subjects", { name: finalName.trim(), semesterId: semester._id, department: newSubjectDept });
      setNewSubjectName("");
      setNewSubjectCustomName("");
      setAddingSubjectFor(null);
      await refreshSubjects(semester._id);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to add subject");
    }
  }

  async function handleAddChapter(subject) {
    if (!newChapterName.trim()) return;
    try {
      await apiClient.post("/chapters", { name: newChapterName.trim(), subjectId: subject._id });
      setNewChapterName("");
      setAddingChapterFor(null);
      await refreshChapters(subject._id);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to add chapter");
    }
  }

  function goTo(page, sem, sub, chap) {
    const params = new URLSearchParams();
    if (sem) params.set("semesterId", sem);
    if (sub) params.set("subjectId", sub);
    if (chap) params.set("chapterId", chap);
    navigate(`/faculty/${page}?${params.toString()}`);
  }

  const subjectNameOptions = (semester, department) => {
    if (!department) return null;
    return getSubjectSuggestions(department, semester.order);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow">Content Manager</span>
          <h1>Content Tree</h1>
          <p>Browse everything at a glance — click a chapter to manage its questions or host it live, without re-picking Semester → Subject → Chapter each time.</p>
        </div>
      </div>

      {loadingSemesters ? (
        <div className="empty-state">Loading...</div>
      ) : semesters.length === 0 ? (
        <div className="empty-state card">No semesters yet — head to the Semesters page to create one.</div>
      ) : (
        <div className="content-tree">
          {semesters.map((sem) => (
            <div className="ct-node ct-semester" key={sem._id}>
              <div className="ct-row" onClick={() => toggleSemester(sem)}>
                <span className="ct-toggle">{expandedSemesters.has(sem._id) ? "▾" : "▸"}</span>
                <span className="ct-label">🗂 {sem.name}</span>
                <span className="badge badge-teal">{sem.department}</span>
              </div>

              {expandedSemesters.has(sem._id) && (
                <div className="ct-children">
                  {(subjectsBySemester[sem._id] || []).map((sub) => (
                    <div className="ct-node ct-subject" key={sub._id}>
                      <div className="ct-row" onClick={() => toggleSubject(sub)}>
                        <span className="ct-toggle">{expandedSubjects.has(sub._id) ? "▾" : "▸"}</span>
                        <span className="ct-label">📘 {sub.name}</span>
                      </div>

                      {expandedSubjects.has(sub._id) && (
                        <div className="ct-children">
                          {(chaptersBySubject[sub._id] || []).map((chap) => (
                            <div className="ct-row ct-chapter" key={chap._id}>
                              <span className="ct-label">📑 {chap.name}</span>
                              <span className="badge badge-gold">{chap.questionCount ?? 0} question{chap.questionCount === 1 ? "" : "s"}</span>
                              <div className="ct-actions">
                                <button className="btn btn-outline btn-sm" onClick={() => goTo("questions", sem._id, sub._id, chap._id)}>
                                  📝 Manage Questions
                                </button>
                                <button className="btn btn-primary btn-sm" onClick={() => goTo("live", sem._id, sub._id, chap._id)}>
                                  ⚡ Host Live
                                </button>
                              </div>
                            </div>
                          ))}

                          {addingChapterFor === sub._id ? (
                            <div className="ct-row ct-add-form">
                              <input
                                autoFocus
                                placeholder="New chapter name"
                                value={newChapterName}
                                onChange={(e) => setNewChapterName(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleAddChapter(sub)}
                              />
                              <button className="btn btn-primary btn-sm" onClick={() => handleAddChapter(sub)}>Add</button>
                              <button className="btn btn-outline btn-sm" onClick={() => setAddingChapterFor(null)}>Cancel</button>
                            </div>
                          ) : (
                            <div className="ct-row ct-add-trigger" onClick={() => setAddingChapterFor(sub._id)}>
                              + Add Chapter
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  {addingSubjectFor === sem._id ? (
                    <div className="ct-row ct-add-form">
                      <select value={newSubjectDept} onChange={(e) => setNewSubjectDept(e.target.value)}>
                        <option value="">Department</option>
                        {(user?.departments || []).map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                      {subjectNameOptions(sem, newSubjectDept) ? (
                        <>
                          <select value={newSubjectName} onChange={(e) => setNewSubjectName(e.target.value)}>
                            <option value="">Select subject</option>
                            {subjectNameOptions(sem, newSubjectDept).map((n) => <option key={n} value={n}>{n}</option>)}
                          </select>
                          {newSubjectName === "Other" && (
                            <input
                              placeholder="Custom subject name"
                              value={newSubjectCustomName}
                              onChange={(e) => setNewSubjectCustomName(e.target.value)}
                            />
                          )}
                        </>
                      ) : (
                        <input
                          placeholder="Subject name"
                          value={newSubjectName}
                          onChange={(e) => setNewSubjectName(e.target.value)}
                        />
                      )}
                      <button className="btn btn-primary btn-sm" onClick={() => handleAddSubject(sem)}>Add</button>
                      <button className="btn btn-outline btn-sm" onClick={() => setAddingSubjectFor(null)}>Cancel</button>
                    </div>
                  ) : (
                    <div className="ct-row ct-add-trigger" onClick={() => setAddingSubjectFor(sem._id)}>
                      + Add Subject
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
