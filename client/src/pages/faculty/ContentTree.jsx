import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../api/apiClient";
import { useAuth } from "../../context/AuthContext";
import { getSubjectSuggestions } from "../../data/subjectCatalog";
import StepCard from "../../components/StepCard";
import "./Faculty.css";

export default function ContentTree() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Drill-down state: null semester/subject = showing the level above it
  const [semesters, setSemesters] = useState([]);
  const [loadingSemesters, setLoadingSemesters] = useState(true);

  const [activeSemester, setActiveSemester] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);

  const [activeSubject, setActiveSubject] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [loadingChapters, setLoadingChapters] = useState(false);

  const [addingSubject, setAddingSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectCustomName, setNewSubjectCustomName] = useState("");

  const [addingChapter, setAddingChapter] = useState(false);
  const [newChapterName, setNewChapterName] = useState("");

  useEffect(() => {
    apiClient.get("/semesters").then((res) => {
      setSemesters(res.data.data);
      setLoadingSemesters(false);
    });
  }, []);

  function openSemester(sem) {
    setActiveSemester(sem);
    setActiveSubject(null);
    setLoadingSubjects(true);
    apiClient.get(`/subjects?semesterId=${sem._id}`).then((res) => {
      setSubjects(res.data.data);
      setLoadingSubjects(false);
    });
  }

  function refreshSubjects() {
    if (!activeSemester) return;
    apiClient.get(`/subjects?semesterId=${activeSemester._id}`).then((res) => setSubjects(res.data.data));
  }

  function openSubject(sub) {
    setActiveSubject(sub);
    setLoadingChapters(true);
    apiClient.get(`/chapters?subjectId=${sub._id}`).then((res) => {
      setChapters(res.data.data);
      setLoadingChapters(false);
    });
  }

  function refreshChapters() {
    if (!activeSubject) return;
    apiClient.get(`/chapters?subjectId=${activeSubject._id}`).then((res) => setChapters(res.data.data));
  }

  async function handleAddSubject() {
    const finalName = newSubjectName === "Other" ? newSubjectCustomName : newSubjectName;
    if (!finalName.trim()) return alert("Please enter a subject name.");
    try {
      await apiClient.post("/subjects", { name: finalName.trim(), semesterId: activeSemester._id, department: activeSemester.department });
      setNewSubjectName("");
      setNewSubjectCustomName("");
      setAddingSubject(false);
      refreshSubjects();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to add subject");
    }
  }

  async function handleAddChapter() {
    if (!newChapterName.trim()) return;
    try {
      await apiClient.post("/chapters", { name: newChapterName.trim(), subjectId: activeSubject._id });
      setNewChapterName("");
      setAddingChapter(false);
      refreshChapters();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to add chapter");
    }
  }

  function goTo(page, chapterId) {
    const params = new URLSearchParams({
      semesterId: activeSemester._id,
      subjectId: activeSubject._id,
      chapterId,
    });
    navigate(`/faculty/${page}?${params.toString()}`);
  }

  const nameOptions = activeSemester ? getSubjectSuggestions(activeSemester.department, activeSemester.order) : null;

  // Group semesters by department for clearly separated sections
  const semestersByDept = semesters.reduce((acc, sem) => {
    (acc[sem.department] = acc[sem.department] || []).push(sem);
    return acc;
  }, {});

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow">Content Manager</span>
          <h1>Content Tree</h1>
          <p>Browse by department and semester — click into a chapter to manage its questions or host it live.</p>
        </div>
      </div>

      {/* Breadcrumb */}
      {(activeSemester || activeSubject) && (
        <div className="ct-breadcrumb">
          <span onClick={() => { setActiveSemester(null); setActiveSubject(null); }}>All Departments</span>
          {activeSemester && (
            <>
              {" › "}
              <span onClick={() => setActiveSubject(null)}>{activeSemester.department} · {activeSemester.name}</span>
            </>
          )}
          {activeSubject && (
            <>
              {" › "}
              <span className="current">{activeSubject.name}</span>
            </>
          )}
        </div>
      )}

      {/* Level 1: Departments -> Semester cards */}
      {!activeSemester && (
        loadingSemesters ? (
          <div className="empty-state">Loading...</div>
        ) : semesters.length === 0 ? (
          <div className="empty-state card">No semesters yet — head to the Semesters page to create one.</div>
        ) : (
          Object.entries(semestersByDept).map(([dept, sems]) => (
            <div key={dept} style={{ marginBottom: 32 }}>
              <div className="section-eyebrow-row"><span className="eyebrow">🏛 {dept}</span></div>
              <div className="grid-cards">
                {sems.map((sem) => (
                  <StepCard
                    key={sem._id}
                    title={sem.name}
                    subtitle="Tap to view subjects"
                    icon="🗂"
                    onClick={() => openSemester(sem)}
                  />
                ))}
              </div>
            </div>
          ))
        )
      )}

      {/* Level 2: Subject cards within the chosen semester */}
      {activeSemester && !activeSubject && (
        <div>
          {loadingSubjects ? (
            <div className="empty-state">Loading...</div>
          ) : (
            <div className="grid-cards">
              {subjects.map((sub) => (
                <StepCard
                  key={sub._id}
                  title={sub.name}
                  subtitle="Tap to view chapters"
                  icon="📘"
                  onClick={() => openSubject(sub)}
                />
              ))}
            </div>
          )}

          <div className="faculty-panel card" style={{ marginTop: 20 }}>
            {addingSubject ? (
              <div className="ct-add-form">
                {nameOptions ? (
                  <>
                    <select value={newSubjectName} onChange={(e) => setNewSubjectName(e.target.value)}>
                      <option value="">Select subject</option>
                      {nameOptions.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                    {newSubjectName === "Other" && (
                      <input placeholder="Custom subject name" value={newSubjectCustomName} onChange={(e) => setNewSubjectCustomName(e.target.value)} />
                    )}
                  </>
                ) : (
                  <input placeholder="Subject name" value={newSubjectName} onChange={(e) => setNewSubjectName(e.target.value)} />
                )}
                <button className="btn btn-primary btn-sm" onClick={handleAddSubject}>Add</button>
                <button className="btn btn-outline btn-sm" onClick={() => setAddingSubject(false)}>Cancel</button>
              </div>
            ) : (
              <div className="ct-add-trigger" onClick={() => setAddingSubject(true)}>+ Add Subject to {activeSemester.name}</div>
            )}
          </div>
        </div>
      )}

      {/* Level 3: Chapter cards within the chosen subject */}
      {activeSubject && (
        <div>
          {loadingChapters ? (
            <div className="empty-state">Loading...</div>
          ) : chapters.length === 0 ? (
            <div className="empty-state card">No chapters yet in this subject.</div>
          ) : (
            <div className="ct-chapter-list">
              {chapters.map((chap) => (
                <div className="ct-row ct-chapter" key={chap._id}>
                  <span className="ct-label">📑 {chap.name}</span>
                  <span className="badge badge-gold">{chap.questionCount ?? 0} question{chap.questionCount === 1 ? "" : "s"}</span>
                  <div className="ct-actions">
                    <button className="btn btn-outline btn-sm" onClick={() => goTo("questions", chap._id)}>📝 Manage Questions</button>
                    <button className="btn btn-primary btn-sm" onClick={() => goTo("live", chap._id)}>⚡ Host Live</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="faculty-panel card" style={{ marginTop: 20 }}>
            {addingChapter ? (
              <div className="ct-add-form">
                <input autoFocus placeholder="New chapter name" value={newChapterName} onChange={(e) => setNewChapterName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddChapter()} />
                <button className="btn btn-primary btn-sm" onClick={handleAddChapter}>Add</button>
                <button className="btn btn-outline btn-sm" onClick={() => setAddingChapter(false)}>Cancel</button>
              </div>
            ) : (
              <div className="ct-add-trigger" onClick={() => setAddingChapter(true)}>+ Add Chapter to {activeSubject.name}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
