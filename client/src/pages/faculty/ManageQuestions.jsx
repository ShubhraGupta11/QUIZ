import { useEffect, useMemo, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import apiClient from "../../api/apiClient";
import Loader from "../../components/Loader";
import StepCard from "../../components/StepCard";
import BackButton from "../../components/BackButton";
import "./Faculty.css";

const TABS = [
  { id: "ai", label: "✨ AI Generator", desc: "Generate MCQs from a topic or an uploaded PDF/PPTX" },
  { id: "manual", label: "✍️ Manual Entry", desc: "Add a single question by hand" },
  { id: "csv", label: "📄 Bulk CSV", desc: "Import/export the whole question bank" },
];

const DIFF_COLORS = { easy: "var(--teal)", medium: "var(--gold)", hard: "var(--danger)" };

export default function ManageQuestions() {
  const [searchParams] = useSearchParams();
  // Deep-link support: /faculty/questions?semesterId=&subjectId=&chapterId=
  const pendingParams = useRef({
    semesterId: searchParams.get("semesterId") || "",
    subjectId: searchParams.get("subjectId") || "",
    chapterId: searchParams.get("chapterId") || "",
  });

  const [semesters, setSemesters] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [questions, setQuestions] = useState([]);

  // Selection States
  const [selectedSemester, setSelectedSemester] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [chapterId, setChapterId] = useState("");

  const [activeTab, setActiveTab] = useState("ai");

  // Manual Question States
  const [text, setText] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [difficulty, setDifficulty] = useState("medium");

  // AI Generator States
  const [aiDifficulty, setAiDifficulty] = useState("mixed");
  const [aiCount, setAiCount] = useState(20);
  const [uploadFile, setUploadFile] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationLogs, setGenerationLogs] = useState("");
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  // AI Preview (review-before-upload) state
  const [previewQuestions, setPreviewQuestions] = useState([]); // [{tempId, text, options, correctOptionIndex, marks, difficulty, selected}]
  const [isUploadingPreview, setIsUploadingPreview] = useState(false);

  // Search / filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState("");

  // Single-question AI regen state
  const [regenDifficulty, setRegenDifficulty] = useState("medium");
  const [isRegenerating, setIsRegenerating] = useState(false);

  // CSV import state
  const [csvFile, setCsvFile] = useState(null);
  const [isImporting, setIsImporting] = useState(false);

  // Load initial dropdown structure
  useEffect(() => {
    fetchSemesters();
  }, []);

  async function fetchSemesters() {
    try {
      const res = await apiClient.get("/semesters");
      setSemesters(res.data.data);
      const pending = pendingParams.current.semesterId;
      if (pending && res.data.data.some((s) => s._id === pending)) {
        setSelectedSemester(pending);
      }
    } catch (err) {
      console.error("Error fetching semesters", err);
    }
  }

  useEffect(() => {
    if (!selectedSemester) {
      setSubjects([]);
      setSelectedSubject("");
      setChapters([]);
      setChapterId("");
      return;
    }
    fetchSubjects(selectedSemester);
  }, [selectedSemester]);

  async function fetchSubjects(semId) {
    try {
      const res = await apiClient.get(`/subjects?semesterId=${semId}`);
      setSubjects(res.data.data);
      const pending = pendingParams.current.subjectId;
      if (pending && res.data.data.some((s) => s._id === pending)) {
        setSelectedSubject(pending);
        pendingParams.current.semesterId = "";
      } else {
        setSelectedSubject("");
        setChapters([]);
        setChapterId("");
      }
    } catch (err) {
      console.error("Error fetching subjects", err);
    }
  }

  useEffect(() => {
    if (!selectedSubject) {
      setChapters([]);
      setChapterId("");
      return;
    }
    fetchChapters(selectedSubject);
  }, [selectedSubject]);

  async function fetchChapters(subId) {
    try {
      const res = await apiClient.get(`/chapters?subjectId=${subId}`);
      setChapters(res.data.data);
      const pending = pendingParams.current.chapterId;
      if (pending && res.data.data.some((c) => c._id === pending)) {
        setChapterId(pending);
        pendingParams.current.subjectId = "";
        pendingParams.current.chapterId = "";
      } else {
        setChapterId("");
      }
    } catch (err) {
      console.error("Error fetching chapters", err);
    }
  }

  useEffect(() => {
    if (!chapterId) {
      setQuestions([]);
      return;
    }
    fetchQuestions(chapterId);
    setPreviewQuestions([]); // clear stale preview when switching chapters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId, searchTerm, filterDifficulty]);

  async function fetchQuestions(chapId) {
    setLoadingQuestions(true);
    try {
      const params = new URLSearchParams({ chapterId: chapId });
      if (searchTerm.trim()) params.append("search", searchTerm.trim());
      if (filterDifficulty) params.append("difficulty", filterDifficulty);
      const res = await apiClient.get(`/questions?${params.toString()}`);
      setQuestions(res.data.data);
    } catch (err) {
      console.error("Error fetching questions", err);
    } finally {
      setLoadingQuestions(false);
    }
  }

  const stats = useMemo(() => {
    const s = { total: questions.length, easy: 0, medium: 0, hard: 0 };
    questions.forEach((q) => { if (s[q.difficulty] !== undefined) s[q.difficulty] += 1; });
    return s;
  }, [questions]);

  // Export questions in this chapter as CSV
  async function handleExportCSV() {
    try {
      const res = await apiClient.get(`/questions/export?chapterId=${chapterId}`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `questions-${chapterId}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error exporting CSV", err);
      alert("Failed to export questions as CSV.");
    }
  }

  async function handleImportCSV(e) {
    e.preventDefault();
    if (!chapterId || !csvFile) {
      alert("Please select a chapter and a CSV file to import.");
      return;
    }
    setIsImporting(true);
    try {
      const csvText = await csvFile.text();
      const res = await apiClient.post("/questions/bulk-import", { chapterId, csv: csvText });
      alert(`Imported ${res.data.count} question(s).${res.data.errors?.length ? `\n${res.data.errors.length} row(s) skipped.` : ""}`);
      setCsvFile(null);
      fetchQuestions(chapterId);
    } catch (err) {
      console.error("Error importing CSV", err);
      alert(err.response?.data?.message || "Failed to import CSV.");
    } finally {
      setIsImporting(false);
    }
  }

  async function handleRegenerateSingle() {
    if (!chapterId) {
      alert("Please select a chapter first.");
      return;
    }
    setIsRegenerating(true);
    try {
      await apiClient.post("/faculty/generate-single", { chapterId, difficulty: regenDifficulty });
      fetchQuestions(chapterId);
    } catch (err) {
      console.error("Error generating single question", err);
      alert(err.response?.data?.message || "Failed to generate question.");
    } finally {
      setIsRegenerating(false);
    }
  }

  function updateOption(i, value) {
    const next = [...options];
    next[i] = value;
    setOptions(next);
  }

  async function handleAdd(e, force = false) {
    if (e && e.preventDefault) e.preventDefault();
    if (!chapterId || !text.trim() || options.some((o) => !o.trim())) {
      alert("Please fill all fields, options, and select a chapter.");
      return;
    }
    try {
      await apiClient.post("/questions", {
        chapterId,
        text: text.trim(),
        options,
        correctOptionIndex: correctIndex,
        difficulty,
        force,
      });
      fetchQuestions(chapterId);
      setText("");
      setOptions(["", "", "", ""]);
      setCorrectIndex(0);
      setDifficulty("medium");
      alert("Question added successfully!");
    } catch (error) {
      if (error.response?.status === 409 && error.response.data?.duplicate) {
        const confirmAdd = window.confirm(
          `A very similar question already exists:\n"${error.response.data.existingText}"\n\nAdd it anyway?`
        );
        if (confirmAdd) {
          handleAdd(null, true);
          return;
        }
        return;
      }
      console.error("Failed to add question:", error);
      alert(error.response?.data?.message || "Failed to create question");
    }
  }

  // Step 1: Generate a batch of AI questions into a REVIEW/PREVIEW list.
  // Nothing is saved to the database yet — the faculty picks what to keep.
  async function handleAIGenerate(e) {
    e.preventDefault();
    if (!chapterId) {
      alert("Please select a Semester, Subject, and Chapter to generate questions.");
      return;
    }

    setIsGenerating(true);
    setPreviewQuestions([]);
    setGenerationLogs(
      uploadFile
        ? `Reading uploaded file: ${uploadFile.name}...\nExtracting text content...\nGenerating ${aiCount} questions strictly from the document...`
        : `Reading chapter/subject/semester context...\nGenerating ${aiCount} questions...`
    );

    const formData = new FormData();
    formData.append("chapterId", chapterId);
    formData.append("difficulty", aiDifficulty);
    formData.append("count", aiCount);
    if (uploadFile) formData.append("file", uploadFile);

    try {
      const response = await apiClient.post("/faculty/generate-mcqs", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const generated = (response.data.questions || []).map((q) => ({ ...q, selected: true }));
      setPreviewQuestions(generated);
      setGenerationLogs(
        (prev) => prev + `\n\nDONE: ${response.data.message}\nReview the questions below, then click "Upload to Question Bank".`
      );
      setUploadFile(null);
    } catch (error) {
      console.error("AI Generation failed:", error);
      const errMsg = error.response?.data?.message || "Internal server error occurred.";
      setGenerationLogs((prev) => prev + `\n\nERROR: ${errMsg}`);
      alert(`AI MCQ generation failed: ${errMsg}`);
    } finally {
      setIsGenerating(false);
    }
  }

  // Step 2: Faculty reviews/edits the preview, then explicitly uploads the selected ones.
  async function handleUploadPreview() {
    const selected = previewQuestions.filter((q) => q.selected);
    if (selected.length === 0) {
      alert("Select at least one question to upload.");
      return;
    }
    setIsUploadingPreview(true);
    try {
      const payload = selected.map(({ text, options, correctOptionIndex, marks, difficulty }) => ({
        text, options, correctOptionIndex, marks, difficulty,
      }));
      const res = await apiClient.post("/questions/bulk-save", { chapterId, questions: payload });
      alert(res.data.message);
      setPreviewQuestions([]);
      setGenerationLogs("");
      fetchQuestions(chapterId);
    } catch (err) {
      console.error("Error uploading generated questions", err);
      alert(err.response?.data?.message || "Failed to upload questions.");
    } finally {
      setIsUploadingPreview(false);
    }
  }

  function discardPreview() {
    if (previewQuestions.length && !window.confirm("Discard all generated questions without uploading?")) return;
    setPreviewQuestions([]);
    setGenerationLogs("");
  }

  function togglePreviewSelect(tempId) {
    setPreviewQuestions((prev) => prev.map((q) => (q.tempId === tempId ? { ...q, selected: !q.selected } : q)));
  }

  function toggleSelectAllPreview(selected) {
    setPreviewQuestions((prev) => prev.map((q) => ({ ...q, selected })));
  }

  function updatePreviewField(tempId, field, value) {
    setPreviewQuestions((prev) => prev.map((q) => (q.tempId === tempId ? { ...q, [field]: value } : q)));
  }

  function updatePreviewOption(tempId, optIdx, value) {
    setPreviewQuestions((prev) =>
      prev.map((q) => {
        if (q.tempId !== tempId) return q;
        const nextOptions = [...q.options];
        nextOptions[optIdx] = value;
        return { ...q, options: nextOptions };
      })
    );
  }

  function removeFromPreview(tempId) {
    setPreviewQuestions((prev) => prev.filter((q) => q.tempId !== tempId));
  }

  async function handleDelete(id) {
    const confirmDelete = window.confirm("Are you sure you want to delete this question?");
    if (!confirmDelete) return;
    try {
      await apiClient.delete(`/questions/${id}`);
      setQuestions((prev) => prev.filter((q) => q._id !== id));
      alert("Question deleted successfully!");
    } catch (error) {
      console.error("Error deleting question:", error);
      alert("Failed to delete question.");
    }
  }

  const selectedPreviewCount = previewQuestions.filter((q) => q.selected).length;

  return (
    <div>
      <BackButton />
      <div className="page-header">
        <div>
          <span className="eyebrow">Content manager</span>
          <h1>Questions & AI Generator</h1>
          <p>Create questions manually, or generate a batch of MCQs automatically — review before they go live.</p>
        </div>
        <div className="page-header-side">
          <span className="badge badge-teal">
            {questions.length} question{questions.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {/* Chapter Selection Panel — card-based drill-down */}
      <div className="faculty-panel card" style={{ marginBottom: 24 }}>
        <div className="panel-header">
          <h3>Select Semester, Subject & Chapter</h3>
        </div>

        {(selectedSemester || selectedSubject || chapterId) && (
          <div className="ct-breadcrumb">
            <span onClick={() => { setSelectedSemester(""); setSelectedSubject(""); setChapterId(""); }}>All Semesters</span>
            {selectedSemester && (
              <>
                {" › "}
                <span onClick={() => { setSelectedSubject(""); setChapterId(""); }}>
                  {semesters.find((s) => s._id === selectedSemester)?.name} ({semesters.find((s) => s._id === selectedSemester)?.department})
                </span>
              </>
            )}
            {selectedSubject && (
              <>
                {" › "}
                <span onClick={() => setChapterId("")}>{subjects.find((s) => s._id === selectedSubject)?.name}</span>
              </>
            )}
            {chapterId && (
              <>
                {" › "}
                <span className="current">{chapters.find((c) => c._id === chapterId)?.name}</span>
              </>
            )}
          </div>
        )}

        {!selectedSemester && (
          <div className="semester-card-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))" }}>
            {semesters.map((sem) => (
              <button type="button" key={sem._id} className="semester-card" onClick={() => setSelectedSemester(sem._id)}>
                {sem.name}
                <div style={{ fontSize: 10, fontWeight: 400, marginTop: 2, opacity: 0.7 }}>{sem.department}</div>
              </button>
            ))}
          </div>
        )}

        {selectedSemester && !selectedSubject && (
          <div className="grid-cards">
            {subjects.map((sub) => (
              <StepCard key={sub._id} title={sub.name} subtitle="Tap to view chapters" icon="📘" onClick={() => setSelectedSubject(sub._id)} />
            ))}
          </div>
        )}

        {selectedSubject && !chapterId && (
          <div className="grid-cards">
            {chapters.map((chap) => (
              <StepCard
                key={chap._id}
                title={chap.name}
                subtitle={`${chap.questionCount ?? 0} question${chap.questionCount === 1 ? "" : "s"}`}
                icon="📑"
                onClick={() => setChapterId(chap._id)}
              />
            ))}
          </div>
        )}
      </div>

      {chapterId && (
        <>
          {/* Chapter question-bank stats */}
          <div className="faculty-stats" style={{ marginBottom: 24 }}>
            <div className="faculty-stat card"><div className="num">{stats.total}</div><div className="label">Total Questions</div></div>
            <div className="faculty-stat card"><div className="num" style={{ color: DIFF_COLORS.easy }}>{stats.easy}</div><div className="label">Easy</div></div>
            <div className="faculty-stat card"><div className="num" style={{ color: DIFF_COLORS.medium }}>{stats.medium}</div><div className="label">Medium</div></div>
            <div className="faculty-stat card"><div className="num" style={{ color: DIFF_COLORS.hard }}>{stats.hard}</div><div className="label">Hard</div></div>
          </div>

          {/* Tab switcher */}
          <div className="qtabs card" style={{ marginBottom: 24, padding: 8 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`btn ${activeTab === t.id ? "btn-primary" : "btn-outline"}`}
                  style={{ flex: "1 1 200px" }}
                  onClick={() => setActiveTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 12, color: "var(--muted-ink)", margin: "10px 4px 2px" }}>
              {TABS.find((t) => t.id === activeTab)?.desc}
            </p>
          </div>

          {/* AI GENERATOR TAB */}
          {activeTab === "ai" && (
            <div className="faculty-panel card" style={{ marginBottom: 24, backgroundColor: "var(--panel)" }}>
              <div className="panel-header">
                <h3>Smart Quiz Generator</h3>
                <span className="badge badge-teal">Faculty privileges</span>
              </div>
              <form onSubmit={handleAIGenerate} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                <div>
                  <label style={{ fontSize: "12px", color: "var(--muted-ink)", display: "block", marginBottom: "4px" }}>
                    Number of Questions
                  </label>
                  <select value={aiCount} onChange={(e) => setAiCount(Number(e.target.value))}>
                    <option value={5}>5 Questions</option>
                    <option value={10}>10 Questions</option>
                    <option value={20}>20 Questions</option>
                    <option value={40}>40 Questions</option>
                    <option value={60}>60 Questions</option>
                    <option value={100}>100 Questions</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "12px", color: "var(--muted-ink)", display: "block", marginBottom: "4px" }}>
                    Target Difficulty
                  </label>
                  <select value={aiDifficulty} onChange={(e) => setAiDifficulty(e.target.value)}>
                    <option value="mixed">Mixed (Easy, Medium, Hard)</option>
                    <option value="easy">All Easy</option>
                    <option value="medium">All Medium</option>
                    <option value="hard">All Hard</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "12px", color: "var(--muted-ink)", display: "block", marginBottom: "4px" }}>
                    Reference Document (Optional)
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.ppt,.pptx"
                    onChange={(e) => setUploadFile(e.target.files[0])}
                    style={{ padding: "8px", border: "1px dashed var(--borders)", borderRadius: "8px", background: "white", width: "100%" }}
                  />
                  <span style={{ fontSize: "10px", color: "var(--muted-ink)", marginTop: "4px", display: "block" }}>
                    Questions are strictly based on this file when uploaded.
                  </span>
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{
                      background: "linear-gradient(135deg, #132a16 0%, #2f5d50 100%)",
                      color: "var(--accent)",
                      border: "none",
                      fontWeight: "bold",
                      width: "100%",
                    }}
                    disabled={!chapterId || isGenerating}
                  >
                    {isGenerating ? "Generating..." : `✨ Generate ${aiCount} MCQs (Preview First)`}
                  </button>
                </div>

                <div style={{ gridColumn: "1 / -1", display: "flex", gap: "8px", alignItems: "flex-end", borderTop: "1px dashed var(--borders)", paddingTop: "12px" }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: "11px", color: "var(--muted-ink)", display: "block" }}>Quick single-question generate (saved instantly)</label>
                    <select value={regenDifficulty} onChange={(e) => setRegenDifficulty(e.target.value)}>
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={handleRegenerateSingle}
                    disabled={!chapterId || isRegenerating}
                  >
                    {isRegenerating ? "Generating..." : "➕ Generate 1 Question"}
                  </button>
                </div>
              </form>

              {isGenerating && (
                <div style={{ marginTop: "16px" }}>
                  <Loader label={`Generating ${aiCount} questions... Please wait.`} />
                </div>
              )}

              {generationLogs && (
                <div style={{ marginTop: "16px" }}>
                  <label style={{ fontSize: "11px", color: "var(--muted-ink)", display: "block", marginBottom: "4px" }}>System Log Output</label>
                  <textarea
                    readOnly
                    rows={4}
                    value={generationLogs}
                    style={{
                      width: "100%",
                      fontSize: "11px",
                      fontFamily: "monospace",
                      backgroundColor: "#1e2e1f",
                      color: "#b9f24d",
                      padding: "8px",
                      borderRadius: "8px",
                      border: "none",
                    }}
                  />
                </div>
              )}

              {/* REVIEW / PREVIEW LIST — nothing saved yet */}
              {previewQuestions.length > 0 && (
                <div style={{ marginTop: 24, borderTop: "2px solid var(--borders)", paddingTop: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
                    <div>
                      <h3 style={{ margin: 0 }}>Review Generated Questions</h3>
                      <p style={{ fontSize: 12, color: "var(--muted-ink)", margin: "4px 0 0" }}>
                        Nothing has been saved yet. Edit, deselect, or delete anything before uploading.
                      </p>
                    </div>
                    <span className="badge badge-accent">{selectedPreviewCount}/{previewQuestions.length} selected</span>
                  </div>

                  <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                    <button type="button" className="btn-sm btn-outline" onClick={() => toggleSelectAllPreview(true)}>Select All</button>
                    <button type="button" className="btn-sm btn-outline" onClick={() => toggleSelectAllPreview(false)}>Deselect All</button>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 520, overflowY: "auto", paddingRight: 6 }}>
                    {previewQuestions.map((q, idx) => (
                      <div
                        key={q.tempId}
                        className="manage-row"
                        style={{
                          alignItems: "flex-start",
                          padding: 14,
                          flexDirection: "column",
                          gap: 10,
                          opacity: q.selected ? 1 : 0.5,
                          borderColor: q.selected ? "var(--teal)" : "var(--borders)",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, width: "100%" }}>
                          <input type="checkbox" checked={q.selected} onChange={() => togglePreviewSelect(q.tempId)} style={{ marginTop: 6 }} />
                          <div style={{ flex: 1 }}>
                            <textarea
                              rows={2}
                              value={q.text}
                              onChange={(e) => updatePreviewField(q.tempId, "text", e.target.value)}
                              style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--borders)", fontWeight: 600, fontSize: 13 }}
                            />
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 8 }}>
                              {q.options.map((opt, oIdx) => (
                                <div key={oIdx} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <input
                                    type="radio"
                                    name={`correct-${q.tempId}`}
                                    checked={q.correctOptionIndex === oIdx}
                                    onChange={() => updatePreviewField(q.tempId, "correctOptionIndex", oIdx)}
                                  />
                                  <input
                                    value={opt}
                                    onChange={(e) => updatePreviewOption(q.tempId, oIdx, e.target.value)}
                                    style={{ flex: 1, fontSize: 12, padding: "4px 6px" }}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                          <select
                            value={q.difficulty}
                            onChange={(e) => updatePreviewField(q.tempId, "difficulty", e.target.value)}
                            style={{ fontSize: 11, padding: "3px 6px" }}
                          >
                            <option value="easy">Easy</option>
                            <option value="medium">Medium</option>
                            <option value="hard">Hard</option>
                          </select>
                          <button type="button" className="icon-btn danger" onClick={() => removeFromPreview(q.tempId)}>
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ flex: 1 }}
                      disabled={selectedPreviewCount === 0 || isUploadingPreview}
                      onClick={handleUploadPreview}
                    >
                      {isUploadingPreview
                        ? "Uploading..."
                        : `⬆️ Upload ${selectedPreviewCount} Question${selectedPreviewCount === 1 ? "" : "s"} to Question Bank`}
                    </button>
                    <button type="button" className="btn btn-outline" onClick={discardPreview} disabled={isUploadingPreview}>
                      Discard All
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MANUAL ENTRY TAB */}
          {activeTab === "manual" && (
            <div className="faculty-panel card" style={{ marginBottom: 24 }}>
              <div className="panel-header">
                <h3>Add Question Manually</h3>
                <span className="badge badge-accent">Form entry</span>
              </div>
              <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: 640 }}>
                <div>
                  <label style={{ fontSize: "12px", color: "var(--muted-ink)", display: "block", marginBottom: "4px" }}>Question Text</label>
                  <textarea
                    rows={2}
                    placeholder="Enter question text here..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--borders)" }}
                    required
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {options.map((opt, i) => (
                    <div key={i}>
                      <label style={{ fontSize: "11px", color: "var(--muted-ink)", display: "block" }}>Option {String.fromCharCode(65 + i)}</label>
                      <input
                        placeholder={`Answer option ${String.fromCharCode(65 + i)}`}
                        value={opt}
                        onChange={(e) => updateOption(i, e.target.value)}
                        required
                      />
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", gap: "12px" }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: "11px", color: "var(--muted-ink)", display: "block" }}>Correct Option</label>
                    <select value={correctIndex} onChange={(e) => setCorrectIndex(Number(e.target.value))}>
                      {options.map((_, i) => (
                        <option key={i} value={i}>Option {String.fromCharCode(65 + i)}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: "11px", color: "var(--muted-ink)", display: "block" }}>Difficulty</label>
                    <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                </div>

                <button type="submit" className="btn btn-primary" style={{ marginTop: "12px" }} disabled={!chapterId}>
                  Add Question
                </button>
              </form>
            </div>
          )}

          {/* BULK CSV TAB */}
          {activeTab === "csv" && (
            <div className="faculty-panel card" style={{ marginBottom: 24 }}>
              <div className="panel-header">
                <h3>Bulk Import / Export (CSV)</h3>
                <span className="badge badge-accent">Faculty tools</span>
              </div>
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "flex-end" }}>
                <div style={{ flex: "1 1 260px" }}>
                  <label style={{ fontSize: "11px", color: "var(--muted-ink)", display: "block", marginBottom: "4px" }}>
                    Import CSV (columns: text, optionA, optionB, optionC, optionD, correctOptionIndex, marks, difficulty)
                  </label>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setCsvFile(e.target.files[0])}
                    style={{ padding: "8px", border: "1px dashed var(--borders)", borderRadius: "8px", background: "white", width: "100%" }}
                  />
                </div>
                <button className="btn btn-outline" onClick={handleImportCSV} disabled={!chapterId || !csvFile || isImporting}>
                  {isImporting ? "Importing..." : "📥 Import CSV"}
                </button>
                <button className="btn btn-outline" onClick={handleExportCSV} disabled={!chapterId || questions.length === 0}>
                  📤 Export CSV
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Questions list for selected Chapter */}
      <div className="manage-list card">
        <div className="panel-header" style={{ borderBottom: "1px solid var(--borders)", paddingBottom: "12px", marginBottom: "12px" }}>
          <h3>Questions in Chapter</h3>
          <span className="badge badge-accent">Review questions ({questions.length})</span>
        </div>

        {chapterId && (
          <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
            <input
              placeholder="Search questions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ flex: "1 1 220px" }}
            />
            <select value={filterDifficulty} onChange={(e) => setFilterDifficulty(e.target.value)} style={{ flex: "0 0 160px" }}>
              <option value="">All difficulties</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        )}

        {!chapterId ? (
          <div className="empty-state">Please choose a Semester → Subject → Chapter to display questions list.</div>
        ) : loadingQuestions ? (
          <Loader label="Loading questions from database..." />
        ) : questions.length === 0 ? (
          <div className="empty-state">No questions found in this chapter. Generate questions using the AI Generator tab above!</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "500px", overflowY: "auto", paddingRight: "8px" }}>
            {questions.map((q, idx) => (
              <div className="manage-row" key={q._id} style={{ alignItems: "flex-start", padding: "12px", borderBottom: "1px solid var(--borders)" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
                    {idx + 1}. {q.text}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "12px", marginBottom: "8px" }}>
                    {q.options.map((opt, oIdx) => (
                      <div key={oIdx} style={{ color: oIdx === q.correctOptionIndex ? "var(--teal)" : "var(--muted-ink)", fontWeight: oIdx === q.correctOptionIndex ? "bold" : "normal" }}>
                        {String.fromCharCode(65 + oIdx)}) {opt} {oIdx === q.correctOptionIndex && "✓"}
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--muted-ink)" }}>
                    Difficulty: <span className="badge" style={{ background: DIFF_COLORS[q.difficulty] || "var(--teal)", color: "white", fontSize: "9px", padding: "2px 6px" }}>{q.difficulty}</span> · Marks: {q.marks}
                  </div>
                </div>
                <div className="manage-row-actions">
                  <button className="icon-btn danger" onClick={() => handleDelete(q._id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
