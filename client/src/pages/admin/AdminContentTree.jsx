import { useEffect, useState } from "react";
import apiClient from "../../api/apiClient";
import BackButton from "../../components/BackButton";
import StepCard from "../../components/StepCard";
import "../faculty/Faculty.css";

// Admin's read-only cross-department browse: Department -> Semester -> Subject
// -> Chapter, with delete-only moderation (no create — content authoring stays
// with Faculty, who own the department-scoped creation flows).
export default function AdminContentTree() {
  const [semesters, setSemesters] = useState([]);
  const [loadingSemesters, setLoadingSemesters] = useState(true);

  const [activeSemester, setActiveSemester] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);

  const [activeSubject, setActiveSubject] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [loadingChapters, setLoadingChapters] = useState(false);

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

  function openSubject(sub) {
    setActiveSubject(sub);
    setLoadingChapters(true);
    apiClient.get(`/chapters?subjectId=${sub._id}`).then((res) => {
      setChapters(res.data.data);
      setLoadingChapters(false);
    });
  }

  async function deleteSemester(sem) {
    if (!window.confirm(`Delete semester "${sem.name}" (${sem.department})? This does not cascade-delete its subjects.`)) return;
    await apiClient.delete(`/semesters/${sem._id}`);
    setSemesters((prev) => prev.filter((s) => s._id !== sem._id));
  }

  async function deleteSubject(sub) {
    if (!window.confirm(`Delete subject "${sub.name}"? This does not cascade-delete its chapters.`)) return;
    await apiClient.delete(`/subjects/${sub._id}`);
    setSubjects((prev) => prev.filter((s) => s._id !== sub._id));
  }

  async function deleteChapter(chap) {
    if (!window.confirm(`Delete chapter "${chap.name}"? This does not cascade-delete its questions.`)) return;
    await apiClient.delete(`/chapters/${chap._id}`);
    setChapters((prev) => prev.filter((c) => c._id !== chap._id));
  }

  const semestersByDept = semesters.reduce((acc, sem) => {
    (acc[sem.department] = acc[sem.department] || []).push(sem);
    return acc;
  }, {});

  return (
    <div>
      <BackButton />
      <div className="page-header">
        <div>
          <span className="eyebrow">Platform administration</span>
          <h1>Content Tree (All Departments)</h1>
          <p>Browse every department's content. Delete for moderation — content creation stays with Faculty.</p>
        </div>
      </div>

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

      {!activeSemester && (
        loadingSemesters ? (
          <div className="empty-state">Loading...</div>
        ) : semesters.length === 0 ? (
          <div className="empty-state card">No content created on the platform yet.</div>
        ) : (
          Object.entries(semestersByDept).map(([dept, sems]) => (
            <div key={dept} style={{ marginBottom: 32 }}>
              <div className="section-eyebrow-row"><span className="eyebrow">🏛 {dept}</span></div>
              <div className="grid-cards">
                {sems.map((sem) => (
                  <div key={sem._id} style={{ position: "relative" }}>
                    <StepCard title={sem.name} subtitle="Tap to view subjects" icon="🗂" onClick={() => openSemester(sem)} />
                    <button
                      className="icon-btn danger"
                      style={{ position: "absolute", top: 10, right: 10 }}
                      onClick={(e) => { e.stopPropagation(); deleteSemester(sem); }}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )
      )}

      {activeSemester && !activeSubject && (
        loadingSubjects ? (
          <div className="empty-state">Loading...</div>
        ) : subjects.length === 0 ? (
          <div className="empty-state card">No subjects in this semester yet.</div>
        ) : (
          <div className="grid-cards">
            {subjects.map((sub) => (
              <div key={sub._id} style={{ position: "relative" }}>
                <StepCard title={sub.name} subtitle="Tap to view chapters" icon="📘" onClick={() => openSubject(sub)} />
                <button
                  className="icon-btn danger"
                  style={{ position: "absolute", top: 10, right: 10 }}
                  onClick={(e) => { e.stopPropagation(); deleteSubject(sub); }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )
      )}

      {activeSubject && (
        loadingChapters ? (
          <div className="empty-state">Loading...</div>
        ) : chapters.length === 0 ? (
          <div className="empty-state card">No chapters in this subject yet.</div>
        ) : (
          <div className="ct-chapter-list">
            {chapters.map((chap) => (
              <div className="ct-row ct-chapter" key={chap._id}>
                <span className="ct-label">📑 {chap.name}</span>
                <span className="badge badge-gold">{chap.questionCount ?? 0} question{chap.questionCount === 1 ? "" : "s"}</span>
                <button className="icon-btn danger" onClick={() => deleteChapter(chap)}>Delete</button>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
