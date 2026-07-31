import { useEffect, useState } from "react";
import apiClient from "../../api/apiClient";
import Loader from "../../components/Loader";
import "./Faculty.css";

export default function ManageQuestions() {
  const [semesters, setSemesters] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [questions, setQuestions] = useState([]);
  
  // Selection States
  const [selectedSemester, setSelectedSemester] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [chapterId, setChapterId] = useState("");

  // Manual Question States
  const [text, setText] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [difficulty, setDifficulty] = useState("medium");
  
  // AI Generator States
  const [aiDifficulty, setAiDifficulty] = useState("mixed");
  const [aiCount, setAiCount] = useState(100);
  const [uploadFile, setUploadFile] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationLogs, setGenerationLogs] = useState("");
  const [loadingQuestions, setLoadingQuestions] = useState(false);

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

  // Fetch semesters
  async function fetchSemesters() {
    try {
      const res = await apiClient.get("/semesters");
      setSemesters(res.data.data);
    } catch (err) {
      console.error("Error fetching semesters", err);
    }
  }

  // Fetch subjects when semester changes
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
      setSelectedSubject("");
      setChapters([]);
      setChapterId("");
    } catch (err) {
      console.error("Error fetching subjects", err);
    }
  }

  // Fetch chapters when subject changes
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
      setChapterId("");
    } catch (err) {
      console.error("Error fetching chapters", err);
    }
  }

  // Fetch questions when chapter, search, or difficulty filter changes
  useEffect(() => {
    if (!chapterId) {
      setQuestions([]);
      return;
    }
    fetchQuestions(chapterId);
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

  // Import questions from a CSV file for this chapter
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

  // Generate a single AI question for the selected chapter
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

  // Manual Question Submit
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

      // Reload questions
      fetchQuestions(chapterId);

      // Reset fields
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

  // AI Question Generation (100 Questions)
  async function handleAIGenerate(e) {
    e.preventDefault();
    if (!chapterId) {
      alert("Please select a Semester, Subject, and Chapter to generate questions.");
      return;
    }

    const confirmGen = window.confirm(
      `You are about to automatically generate ${aiCount} MCQs for this chapter. This will create rich datasets directly in the database. Proceed?`
    );
    if (!confirmGen) return;

    setIsGenerating(true);
    setGenerationLogs(`Initializing smart quiz generator...\nPreparing structured examination prompts...\nCreating ${aiCount} questions in batches...`);

    const formData = new FormData();
    formData.append("chapterId", chapterId);
    formData.append("difficulty", aiDifficulty);
    formData.append("count", aiCount);
    if (uploadFile) {
      formData.append("file", uploadFile);
      setGenerationLogs((prev) => prev + `\nParsing course material file: ${uploadFile.name}...`);
    }

    try {
      const response = await apiClient.post("/faculty/generate-mcqs", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setGenerationLogs(
        (prev) =>
          prev +
          `\n\nSUCCESS: ${response.data.message}\nTotal questions saved to database: ${response.data.count}`
      );
      
      // Reload questions list
      fetchQuestions(chapterId);
      
      // Clear file upload
      setUploadFile(null);
      
      alert(`Successfully generated ${response.data.count} MCQs and stored them in your database!`);
    } catch (error) {
      console.error("AI Generation failed:", error);
      const errMsg = error.response?.data?.message || "Internal server error occurred.";
      setGenerationLogs((prev) => prev + `\n\nERROR FAILED: ${errMsg}`);
      alert(`AI MCQ generation failed: ${errMsg}`);
    } finally {
      setIsGenerating(false);
    }
  }

  // Delete Question
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

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow">Content manager</span>
          <h1>Questions & AI Generator</h1>
          <p>Create questions manually, or generate a batch of MCQs automatically.</p>
        </div>
        <div className="page-header-side">
          <span className="badge badge-teal">
            {questions.length} question{questions.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {/* Chapter Selection Panel */}
      <div className="faculty-panel card" style={{ marginBottom: 24 }}>
        <div className="panel-header">
          <h3>Select Semester, Subject & Chapter</h3>
        </div>
        <div className="inline-form" style={{ display: "flex", gap: "12px", width: "100%" }}>
          <select
            style={{ flex: 1 }}
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(e.target.value)}
          >
            <option value="">Choose Semester</option>
            {semesters.map((sem) => (
              <option key={sem._id} value={sem._id}>
                {sem.name} ({sem.department})
              </option>
            ))}
          </select>

          <select
            style={{ flex: 1 }}
            value={selectedSubject}
            disabled={!selectedSemester}
            onChange={(e) => setSelectedSubject(e.target.value)}
          >
            <option value="">Choose Subject</option>
            {subjects.map((sub) => (
              <option key={sub._id} value={sub._id}>
                {sub.name}
              </option>
            ))}
          </select>

          <select
            style={{ flex: 1 }}
            value={chapterId}
            disabled={!selectedSubject}
            onChange={(e) => setChapterId(e.target.value)}
          >
            <option value="">Choose Chapter</option>
            {chapters.map((chap) => (
              <option key={chap._id} value={chap._id}>
                {chap.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Split grid for Manual Entry & AI generation */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "24px" }}>
        
        {/* Manual Add Panel */}
        <div className="faculty-panel card" style={{ height: "fit-content" }}>
          <div className="panel-header">
            <h3>Add Question Manually</h3>
            <span className="badge badge-accent">Form entry</span>
          </div>
          <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
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

        {/* AI Generator Panel */}
        <div className="faculty-panel card" style={{ height: "fit-content", backgroundColor: "var(--panel)" }}>
          <div className="panel-header">
            <h3>Smart Quiz Generator</h3>
            <span className="badge badge-teal">Faculty privileges</span>
          </div>
          <form onSubmit={handleAIGenerate} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <label style={{ fontSize: "12px", color: "var(--muted-ink)", display: "block", marginBottom: "4px" }}>
                Number of Questions
              </label>
              <select value={aiCount} onChange={(e) => setAiCount(Number(e.target.value))}>
                <option value={10}>10 Questions</option>
                <option value={25}>25 Questions</option>
                <option value={50}>50 Questions</option>
                <option value={75}>75 Questions</option>
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
                Generate from Reference Document (Optional)
              </label>
              <input
                type="file"
                accept=".pdf,.ppt,.pptx"
                onChange={(e) => setUploadFile(e.target.files[0])}
                style={{ padding: "8px", border: "1px dashed var(--borders)", borderRadius: "8px", background: "white", width: "100%" }}
              />
              <span style={{ fontSize: "10px", color: "var(--muted-ink)", marginTop: "4px", display: "block" }}>
                Supports uploading textbook chapters or presentations (PDF, PPT, PPTX).
              </span>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{
                background: "linear-gradient(135deg, #132a16 0%, #2f5d50 100%)",
                color: "var(--accent)",
                border: "none",
                fontWeight: "bold",
                marginTop: "12px"
              }}
              disabled={!chapterId || isGenerating}
            >
              {isGenerating ? "Generating in Batches..." : `✨ Generate ${aiCount} MCQs automatically`}
            </button>

            <div style={{ display: "flex", gap: "8px", alignItems: "flex-end", borderTop: "1px dashed var(--borders)", paddingTop: "12px" }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: "11px", color: "var(--muted-ink)", display: "block" }}>Quick single-question generate</label>
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

            {isGenerating && (
              <div style={{ marginTop: "12px" }}>
                <Loader label={`Generating ${aiCount} questions in batches... Please wait.`} />
              </div>
            )}

            {generationLogs && (
              <div style={{ marginTop: "12px" }}>
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
                    border: "none"
                  }}
                />
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Bulk CSV import/export panel */}
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
          <div className="empty-state">No questions found in this chapter. Generate questions using the panel above!</div>
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
                    Difficulty: <span className="badge" style={{ background: q.difficulty === 'hard' ? 'var(--danger)' : q.difficulty === 'medium' ? 'var(--gold)' : 'var(--teal)', color: 'white', fontSize: '9px', padding: '2px 6px' }}>{q.difficulty}</span> · Marks: {q.marks}
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
