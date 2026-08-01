import { useEffect, useState, useCallback } from "react";
import apiClient from "../../api/apiClient";
import { getLiveSocket, disconnectLiveSocket } from "../../api/liveSocket";
import "./Faculty.css";

export default function LiveQuizHost() {
  const [semesters, setSemesters] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [selectedSemester, setSelectedSemester] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [chapterId, setChapterId] = useState("");

  const [newChapterName, setNewChapterName] = useState("");
  const [uploadFile, setUploadFile] = useState(null);
  const [genCount, setGenCount] = useState(10);
  const [genDifficulty, setGenDifficulty] = useState("mixed");
  const [isGenerating, setIsGenerating] = useState(false);
  const [genStatus, setGenStatus] = useState("");

  const [phase, setPhase] = useState("setup"); // setup -> lobby -> question -> leaderboard -> finished
  const [code, setCode] = useState("");
  const [players, setPlayers] = useState([]);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);
  const [finalResults, setFinalResults] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    apiClient.get("/semesters").then((res) => setSemesters(res.data.data));
  }, []);

  useEffect(() => {
    if (!selectedSemester) return setSubjects([]);
    apiClient.get(`/subjects?semesterId=${selectedSemester}`).then((res) => setSubjects(res.data.data));
  }, [selectedSemester]);

  useEffect(() => {
    if (!selectedSubject) return setChapters([]);
    apiClient.get(`/chapters?subjectId=${selectedSubject}`).then((res) => setChapters(res.data.data));
  }, [selectedSubject]);

  const socket = getLiveSocket();

  useEffect(() => {
    socket.on("lobby:update", ({ players }) => setPlayers(players));
    socket.on("question:show", ({ index, total, question }) => {
      setQuestionIndex(index);
      setTotalQuestions(total);
      setCurrentQuestion(question);
      setAnsweredCount(0);
      setPhase("question");
    });
    socket.on("host:answerReceived", ({ answeredCount }) => setAnsweredCount(answeredCount));
    socket.on("leaderboard:update", ({ leaderboard }) => {
      setLeaderboard(leaderboard);
      setPhase("leaderboard");
    });
    socket.on("quiz:finished", ({ results }) => {
      setFinalResults(results);
      setPhase("finished");
    });
    socket.on("live:error", ({ message }) => setError(message));

    return () => {
      socket.off("lobby:update");
      socket.off("question:show");
      socket.off("host:answerReceived");
      socket.off("leaderboard:update");
      socket.off("quiz:finished");
      socket.off("live:error");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startHostingWith(idToHost) {
    setError("");
    socket.connect();
    socket.emit("host:create", { chapterId: idToHost }, (res) => {
      if (!res.success) {
        setError(res.message);
        socket.disconnect();
        return;
      }
      setCode(res.code);
      setTotalQuestions(res.totalQuestions);
      setPhase("lobby");
    });
  }

  function startHosting() {
    if (!chapterId) return alert("Please select a chapter first.");
    startHostingWith(chapterId);
  }

  async function generateAndHost() {
    if (!uploadFile) return alert("Please choose a PDF or PPTX file first.");
    if (!selectedSubject) return alert("Please select a subject first.");

    setIsGenerating(true);
    setGenStatus("Reading document and generating questions...");
    setError("");

    try {
      let targetChapterId = chapterId;
      if (!targetChapterId) {
        if (!newChapterName.trim()) {
          alert("Please select an existing chapter or type a name for a new one.");
          setIsGenerating(false);
          setGenStatus("");
          return;
        }
        const chapRes = await apiClient.post("/chapters", { name: newChapterName.trim(), subjectId: selectedSubject });
        targetChapterId = chapRes.data.data._id;
      }

      const formData = new FormData();
      formData.append("chapterId", targetChapterId);
      formData.append("difficulty", genDifficulty);
      formData.append("count", genCount);
      formData.append("file", uploadFile);

      const genRes = await apiClient.post("/faculty/generate-mcqs", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setGenStatus(`Generated ${genRes.data.count} questions. Starting live session...`);
      setChapterId(targetChapterId);
      startHostingWith(targetChapterId);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to generate questions from the uploaded file.");
    } finally {
      setIsGenerating(false);
      setGenStatus("");
    }
  }

  const nextQuestion = useCallback(() => {
    socket.emit("host:next", { code }, (res) => {
      if (res.finished) setPhase("finished");
    });
  }, [socket, code]);

  function showLeaderboard() {
    socket.emit("host:showLeaderboard", { code });
  }

  function endSession() {
    socket.emit("host:end", { code }, () => {
      disconnectLiveSocket();
    });
  }

  function resetToSetup() {
    disconnectLiveSocket();
    setPhase("setup");
    setCode("");
    setPlayers([]);
    setFinalResults([]);
    setLeaderboard([]);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow">Live Quiz Battle</span>
          <h1>Host a Live Quiz</h1>
          <p>Run a real-time, Kahoot-style quiz for students to join and compete.</p>
        </div>
      </div>

      {error && <div className="empty-state" style={{ color: "var(--danger, red)" }}>{error}</div>}

      {phase === "setup" && (
        <div className="faculty-panel card">
          <div className="panel-header"><h3>Select a Chapter to Host</h3></div>
          <div className="inline-form" style={{ display: "flex", gap: 12 }}>
            <select value={selectedSemester} onChange={(e) => { setSelectedSemester(e.target.value); setSelectedSubject(""); setChapterId(""); }}>
              <option value="">Choose Semester</option>
              {semesters.map((s) => <option key={s._id} value={s._id}>{s.name} ({s.department})</option>)}
            </select>
            <select value={selectedSubject} disabled={!selectedSemester} onChange={(e) => { setSelectedSubject(e.target.value); setChapterId(""); }}>
              <option value="">Choose Subject</option>
              {subjects.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
            <select value={chapterId} disabled={!selectedSubject} onChange={(e) => setChapterId(e.target.value)}>
              <option value="">Choose Chapter</option>
              {chapters.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
            <button className="btn btn-primary" onClick={startHosting} disabled={!chapterId}>Start Live Session</button>
          </div>
        </div>
      )}

      {phase === "setup" && (
        <div className="faculty-panel card" style={{ marginTop: 24 }}>
          <div className="panel-header">
            <h3>Or Generate Questions On the Spot from PDF/PPT</h3>
            <span className="badge badge-teal">AI-powered</span>
          </div>
          <p style={{ fontSize: 13, color: "var(--muted-ink)", marginBottom: 16 }}>
            Upload a PDF or PPTX and questions will be generated strictly from its content, saved
            into the chapter above (or a new one), and the live session will start automatically.
            Select a Semester and Subject above first.
          </p>
          {!chapterId && (
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: "var(--muted-ink)", display: "block", marginBottom: 4 }}>
                New chapter name (used if no existing chapter is selected above)
              </label>
              <input
                placeholder="e.g. Chapter 5 - Networking"
                value={newChapterName}
                onChange={(e) => setNewChapterName(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
          )}
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="file"
              accept=".pdf,.pptx"
              onChange={(e) => setUploadFile(e.target.files[0])}
            />
            <select value={genCount} onChange={(e) => setGenCount(Number(e.target.value))}>
              <option value={10}>10 Questions</option>
              <option value={25}>25 Questions</option>
              <option value={50}>50 Questions</option>
            </select>
            <select value={genDifficulty} onChange={(e) => setGenDifficulty(e.target.value)}>
              <option value="mixed">Mixed Difficulty</option>
              <option value="easy">All Easy</option>
              <option value="medium">All Medium</option>
              <option value="hard">All Hard</option>
            </select>
            <button className="btn btn-primary" onClick={generateAndHost} disabled={isGenerating || !uploadFile || !selectedSubject}>
              {isGenerating ? "Generating..." : "✨ Generate & Start Live"}
            </button>
          </div>
          {genStatus && <p style={{ marginTop: 12, fontSize: 13, color: "var(--muted-ink)" }}>{genStatus}</p>}
        </div>
      )}

      {phase === "lobby" && (
        <div className="faculty-panel card" style={{ textAlign: "center", padding: 40 }}>
          <p style={{ fontSize: 14, color: "var(--muted-ink)" }}>Join Code</p>
          <div style={{ fontSize: 56, fontWeight: 800, letterSpacing: 6 }}>{code}</div>
          <p style={{ marginTop: 16 }}>{players.length} student{players.length === 1 ? "" : "s"} joined</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 16 }}>
            {players.map((p, i) => <span key={i} className="badge badge-teal">{p}</span>)}
          </div>
          <button className="btn btn-primary" style={{ marginTop: 24 }} onClick={nextQuestion} disabled={players.length === 0}>
            Start Quiz →
          </button>
        </div>
      )}

      {phase === "question" && currentQuestion && (
        <div className="faculty-panel card" style={{ padding: 32 }}>
          <p style={{ fontSize: 13, color: "var(--muted-ink)" }}>Question {questionIndex + 1} of {totalQuestions}</p>
          <h2 style={{ margin: "12px 0 20px" }}>{currentQuestion.text}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {currentQuestion.options.map((opt, i) => (
              <div key={i} className="badge" style={{ padding: 12, fontSize: 14 }}>
                {String.fromCharCode(65 + i)}) {opt}
              </div>
            ))}
          </div>
          <p style={{ marginTop: 20 }}>{answeredCount} / {players.length} answered</p>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={showLeaderboard}>
            Show Leaderboard →
          </button>
        </div>
      )}

      {phase === "leaderboard" && (
        <div className="faculty-panel card" style={{ padding: 32 }}>
          <h3>Leaderboard</h3>
          <div className="manage-list" style={{ marginTop: 16 }}>
            {leaderboard.map((p, i) => (
              <div className="manage-row" key={i}>
                <div className="manage-row-text">#{i + 1} {p.name}</div>
                <div>{p.score} pts</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
            <button className="btn btn-primary" onClick={nextQuestion}>Next Question →</button>
            <button className="btn btn-outline" onClick={endSession}>End Quiz</button>
          </div>
        </div>
      )}

      {phase === "finished" && (
        <div className="faculty-panel card" style={{ padding: 32 }}>
          <h3>🏆 Final Results</h3>
          <div className="manage-list" style={{ marginTop: 16 }}>
            {finalResults.map((p, i) => (
              <div className="manage-row" key={i}>
                <div className="manage-row-text">#{i + 1} {p.name}</div>
                <div>{p.score} pts · {p.correctCount}/{p.totalQuestions} correct</div>
              </div>
            ))}
          </div>
          <button className="btn btn-primary" style={{ marginTop: 24 }} onClick={resetToSetup}>Host Another Session</button>
        </div>
      )}
    </div>
  );
}
