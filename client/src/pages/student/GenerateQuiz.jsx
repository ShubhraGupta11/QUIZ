import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import apiClient from "../../api/apiClient";
import Loader from "../../components/Loader";
import BackButton from "../../components/BackButton";
import "./Student.css";

export default function GenerateQuiz() {
  const navigate = useNavigate();
  const location = useLocation();
  const meta = location.state || {};

  const [file, setFile] = useState(null);
  const [notesText, setNotesText] = useState("");
  const [difficulty, setDifficulty] = useState("mixed");
  const [count, setCount] = useState(10);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate(e) {
    e.preventDefault();
    setError("");

    if (!file && !notesText.trim()) {
      setError("Please upload a PDF/PPTX file or paste some notes first.");
      return;
    }

    setIsGenerating(true);
    try {
      const formData = new FormData();
      if (file) formData.append("file", file);
      if (notesText.trim()) formData.append("notesText", notesText.trim());
      formData.append("difficulty", difficulty);
      formData.append("count", count);

      const res = await apiClient.post("/faculty/generate-from-notes", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // Normalize into the {id, text, options, correctIndex, marks, difficulty} shape Quiz.jsx expects
      const questions = res.data.questions.map((q) => ({
        id: q.id,
        text: q.text,
        options: q.options,
        correctIndex: q.correctOptionIndex,
        marks: q.marks,
        difficulty: q.difficulty,
      }));

      navigate("/student/self-quiz", {
        state: {
          selfQuiz: true,
          questions,
          chapterName: meta.chapterName || "Your Notes",
          subjectName: meta.subjectName || "AI Self-Quiz",
          semesterName: meta.semesterName || "Generated from notes",
        },
        replace: true,
      });
    } catch (err) {
      console.error("Failed to generate quiz from notes:", err);
      setError(err.response?.data?.message || "Failed to generate a quiz from your notes. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="page container">
      <BackButton />
      <div className="page-header">
        <div>
          <span className="eyebrow">AI-powered</span>
          <h1>Generate a Quiz from Your Notes</h1>
          <p>
            No quiz available for a chapter? Upload your own notes (PDF/PPTX) or paste text, and AI will build a
            practice quiz strictly from that content — never the same quiz twice, since it's based on what you upload.
          </p>
        </div>
      </div>

      <div className="faculty-panel card" style={{ maxWidth: 640 }}>
        <form onSubmit={handleGenerate} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, color: "var(--muted-ink)", display: "block", marginBottom: 4 }}>
              Upload Notes (PDF or PPTX)
            </label>
            <input
              type="file"
              accept=".pdf,.pptx"
              onChange={(e) => setFile(e.target.files[0])}
              style={{ padding: 8, border: "1px dashed var(--borders)", borderRadius: 8, background: "white", width: "100%" }}
            />
          </div>

          <div style={{ textAlign: "center", fontSize: 12, color: "var(--muted-ink)" }}>— or —</div>

          <div>
            <label style={{ fontSize: 12, color: "var(--muted-ink)", display: "block", marginBottom: 4 }}>
              Paste Notes Text
            </label>
            <textarea
              rows={6}
              placeholder="Paste your notes, textbook excerpt, or lecture summary here..."
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--border-soft)" }}
            />
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: "var(--muted-ink)", display: "block", marginBottom: 4 }}>Difficulty</label>
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                <option value="mixed">Mixed</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: "var(--muted-ink)", display: "block", marginBottom: 4 }}>
                Number of Questions
              </label>
              <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={20}>20</option>
              </select>
            </div>
          </div>

          {error && <div style={{ color: "var(--danger)", fontSize: 13 }}>{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={isGenerating}>
            {isGenerating ? "Generating your quiz..." : "✨ Generate & Start Quiz"}
          </button>

          {isGenerating && <Loader label="Reading your notes and building questions..." />}
        </form>
      </div>
    </div>
  );
}
