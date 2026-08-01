import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import apiClient from "../../api/apiClient";
import { getLiveSocket, disconnectLiveSocket } from "../../api/liveSocket";
import StepCard from "../../components/StepCard";
import BackButton from "../../components/BackButton";
import "./Faculty.css";
import "../../styles/liveQuiz.css";

export default function LiveQuizHost() {
  const [searchParams] = useSearchParams();
  // Deep-link support: /faculty/live?semesterId=&subjectId=&chapterId= lets
  // the Content Tree jump straight here with the chapter pre-selected.
  const pendingParams = useRef({
    semesterId: searchParams.get("semesterId") || "",
    subjectId: searchParams.get("subjectId") || "",
    chapterId: searchParams.get("chapterId") || "",
  });

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

  const [phase, setPhase] = useState("setup"); // setup -> lobby -> question -> reveal -> leaderboard -> finished
  const [code, setCode] = useState("");
  const [players, setPlayers] = useState([]);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [revealData, setRevealData] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [finalResults, setFinalResults] = useState([]);
  const [error, setError] = useState("");

  const timerRef = useRef(null);

  useEffect(() => {
    apiClient.get("/semesters").then((res) => {
      setSemesters(res.data.data);
      const pending = pendingParams.current.semesterId;
      if (pending && res.data.data.some((s) => s._id === pending)) {
        setSelectedSemester(pending);
      }
    });
  }, []);

  useEffect(() => {
    if (!selectedSemester) return setSubjects([]);
    apiClient.get(`/subjects?semesterId=${selectedSemester}`).then((res) => {
      setSubjects(res.data.data);
      const pending = pendingParams.current.subjectId;
      if (pending && res.data.data.some((s) => s._id === pending)) {
        setSelectedSubject(pending);
        pendingParams.current.semesterId = "";
      }
    });
  }, [selectedSemester]);

  useEffect(() => {
    if (!selectedSubject) return setChapters([]);
    apiClient.get(`/chapters?subjectId=${selectedSubject}`).then((res) => {
      setChapters(res.data.data);
      const pending = pendingParams.current.chapterId;
      if (pending && res.data.data.some((c) => c._id === pending)) {
        setChapterId(pending);
        pendingParams.current.subjectId = "";
        pendingParams.current.chapterId = "";
      }
    });
  }, [selectedSubject]);

  const socket = getLiveSocket();

  useEffect(() => {
    socket.on("lobby:update", ({ players }) => setPlayers(players));

    socket.on("question:show", ({ index, total, question }) => {
      setQuestionIndex(index);
      setTotalQuestions(total);
      setCurrentQuestion(question);
      setAnsweredCount(0);
      setRevealData(null);
      setTimeLeft(question.timeLimitSec);
      setPhase("question");

      clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimeLeft((t) => (t > 0 ? t - 1 : 0));
      }, 1000);
    });

    socket.on("host:answerReceived", ({ answeredCount }) => setAnsweredCount(answeredCount));

    socket.on("question:reveal", ({ correctOptionIndex, distribution, totalPlayers }) => {
      clearInterval(timerRef.current);
      setRevealData({ correctOptionIndex, distribution, totalPlayers });
      setPhase("reveal");
    });

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
      clearInterval(timerRef.current);
      socket.off("lobby:update");
      socket.off("question:show");
      socket.off("host:answerReceived");
      socket.off("question:reveal");
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

  function skipQuestion() {
    socket.emit("host:skip", { code });
  }

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
      {phase === "setup" && <BackButton />}
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
              {semesters.map((s) => (
                <button type="button" key={s._id} className="semester-card" onClick={() => { setSelectedSemester(s._id); setSelectedSubject(""); setChapterId(""); }}>
                  {s.name}
                  <div style={{ fontSize: 10, fontWeight: 400, marginTop: 2, opacity: 0.7 }}>{s.department}</div>
                </button>
              ))}
            </div>
          )}

          {selectedSemester && !selectedSubject && (
            <div className="grid-cards">
              {subjects.map((s) => (
                <StepCard key={s._id} title={s.name} subtitle="Tap to view chapters" icon="📘" onClick={() => { setSelectedSubject(s._id); setChapterId(""); }} />
              ))}
            </div>
          )}

          {selectedSubject && !chapterId && (
            <div className="grid-cards">
              {chapters.map((c) => (
                <StepCard key={c._id} title={c.name} subtitle="Tap to select for hosting" icon="📑" onClick={() => setChapterId(c._id)} />
              ))}
            </div>
          )}

          {chapterId && (
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={startHosting}>Start Live Session →</button>
          )}
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
        <div className="lq-lobby">
          <div className="lq-pin-label">Join at your device — Game PIN</div>
          <div className="lq-pin-code">{code}</div>

          <div className="lq-qr-box">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${window.location.origin}/join/${code}`)}`}
              alt="Scan to join"
              width={160}
              height={160}
            />
            <p style={{ fontSize: 12.5 }}>Scan to join instantly — no sign-in needed, just type your name.</p>
          </div>

          <p style={{ fontSize: 15 }}>{players.length} player{players.length === 1 ? "" : "s"} joined</p>
          <div className="lq-players-grid">
            {players.map((p, i) => <span key={i} className="lq-player-chip">{p}</span>)}
          </div>
          <button className="btn btn-primary" style={{ marginTop: 28 }} onClick={nextQuestion} disabled={players.length === 0}>
            Start Quiz →
          </button>
        </div>
      )}

      {phase === "question" && currentQuestion && (
        <div className="faculty-panel card" style={{ padding: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--muted-ink)" }}>
            <span>Question {questionIndex + 1} of {totalQuestions}</span>
            <span>{answeredCount} / {players.length} answered</span>
          </div>
          <div className="lq-timer-track">
            <div
              className={`lq-timer-fill ${timeLeft <= 5 ? "danger" : ""}`}
              style={{ width: `${(timeLeft / currentQuestion.timeLimitSec) * 100}%` }}
            />
          </div>
          <h2 className="lq-question-text">{currentQuestion.text}</h2>
          <div className="lq-tile-grid">
            {currentQuestion.options.map((opt, i) => {
              const tile = currentQuestion.tiles[i];
              return (
                <div key={i} className="lq-tile" style={{ background: tile.color, cursor: "default" }}>
                  <span className={`lq-tile-shape ${tile.shape}`} />
                  {opt}
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 20, justifyContent: "center" }}>
            <button className="btn btn-outline" onClick={skipQuestion}>Skip / Reveal Now</button>
          </div>
        </div>
      )}

      {phase === "reveal" && currentQuestion && revealData && (
        <div className="faculty-panel card" style={{ padding: 32 }}>
          <div className="lq-reveal-banner correct">
            ✅ Correct Answer: {currentQuestion.options[revealData.correctOptionIndex]}
          </div>
          {currentQuestion.options.map((opt, i) => {
            const count = revealData.distribution[i] || 0;
            const pct = revealData.totalPlayers > 0 ? Math.round((count / revealData.totalPlayers) * 100) : 0;
            const tile = currentQuestion.tiles[i];
            return (
              <div className="lq-dist-row" key={i}>
                <span className="lq-dist-label">{String.fromCharCode(65 + i)}</span>
                <div className="lq-dist-track">
                  <div className="lq-dist-fill" style={{ width: `${pct}%`, background: tile.color }}>
                    {count > 0 ? `${count} (${pct}%)` : ""}
                  </div>
                </div>
              </div>
            );
          })}
          <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={showLeaderboard}>
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
                <div className="manage-row-text">#{i + 1} {p.name} {p.streak >= 2 && <span className="lq-streak-badge" style={{ marginLeft: 8 }}>🔥 {p.streak}</span>}</div>
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
          <h3 style={{ textAlign: "center" }}>🏆 Final Results</h3>
          <div className="lq-podium">
            {finalResults[1] && (
              <div className="lq-podium-place silver">
                <div className="lq-podium-name">{finalResults[1].name}</div>
                <div className="lq-podium-score">{finalResults[1].score} pts</div>
                <div className="lq-podium-bar">2</div>
              </div>
            )}
            {finalResults[0] && (
              <div className="lq-podium-place gold">
                <div className="lq-podium-name">{finalResults[0].name}</div>
                <div className="lq-podium-score">{finalResults[0].score} pts</div>
                <div className="lq-podium-bar">1</div>
              </div>
            )}
            {finalResults[2] && (
              <div className="lq-podium-place bronze">
                <div className="lq-podium-name">{finalResults[2].name}</div>
                <div className="lq-podium-score">{finalResults[2].score} pts</div>
                <div className="lq-podium-bar">3</div>
              </div>
            )}
          </div>
          <div className="manage-list lq-rest-list">
            {finalResults.slice(3).map((p, i) => (
              <div className="manage-row" key={i}>
                <div className="manage-row-text">#{i + 4} {p.name}</div>
                <div>{p.score} pts · {p.correctCount}/{p.totalQuestions} correct</div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: "center" }}>
            <button className="btn btn-primary" style={{ marginTop: 24 }} onClick={resetToSetup}>Host Another Session</button>
          </div>
        </div>
      )}
    </div>
  );
}
