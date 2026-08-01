import { useEffect, useState } from "react";
import { getLiveSocket, disconnectLiveSocket } from "../../api/liveSocket";
import "./Student.css";

export default function LiveQuizJoin() {
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState("join"); // join -> lobby -> question -> answered -> leaderboard -> finished
  const [error, setError] = useState("");
  const [chapterName, setChapterName] = useState("");
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [lastResult, setLastResult] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [finalResults, setFinalResults] = useState([]);

  const socket = getLiveSocket();

  useEffect(() => {
    socket.on("question:show", ({ index, total, question }) => {
      setQuestionIndex(index);
      setTotalQuestions(total);
      setCurrentQuestion(question);
      setTimeLeft(question.timeLimitSec);
      setLastResult(null);
      setPhase("question");
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
      socket.off("question:show");
      socket.off("leaderboard:update");
      socket.off("quiz:finished");
      socket.off("live:error");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== "question" || timeLeft <= 0) return;
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, timeLeft]);

  function joinRoom() {
    if (!code.trim()) return;
    setError("");
    socket.connect();
    socket.emit("player:join", { code: code.trim() }, (res) => {
      if (!res.success) {
        setError(res.message);
        socket.disconnect();
        return;
      }
      setChapterName(res.chapterName);
      setTotalQuestions(res.totalQuestions);
      setPhase("lobby");
    });
  }

  function selectOption(optionIndex) {
    socket.emit("player:answer", { code: code.trim(), optionIndex }, (res) => {
      setLastResult(res);
      setPhase("answered");
    });
  }

  function leaveQuiz() {
    disconnectLiveSocket();
    setPhase("join");
    setCode("");
  }

  return (
    <div className="page container">
      <div className="page-header">
        <div>
          <span className="eyebrow">Live Quiz Battle</span>
          <h1>Join a Live Quiz</h1>
          <p>Enter the code your faculty shared to join the live session.</p>
        </div>
      </div>

      {error && <div className="empty-state card" style={{ color: "var(--danger, red)" }}>{error}</div>}

      {phase === "join" && (
        <div className="card" style={{ padding: 32, maxWidth: 420 }}>
          <label style={{ fontSize: 12, color: "var(--ink-muted)", display: "block", marginBottom: 8 }}>Join Code</label>
          <input
            placeholder="e.g. 482913"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            style={{ fontSize: 20, letterSpacing: 4, textAlign: "center", width: "100%", padding: 12 }}
          />
          <button className="btn btn-primary btn-block" style={{ marginTop: 16 }} onClick={joinRoom}>
            Join Quiz
          </button>
        </div>
      )}

      {phase === "lobby" && (
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <h2>{chapterName}</h2>
          <p>{totalQuestions} questions · Waiting for host to start...</p>
        </div>
      )}

      {phase === "question" && currentQuestion && (
        <div className="card" style={{ padding: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <span>Question {questionIndex + 1} of {totalQuestions}</span>
            <span className={timeLeft <= 5 ? "quiz-timer danger" : "quiz-timer"}>⏱ {timeLeft}s</span>
          </div>
          <h2 style={{ marginBottom: 20 }}>{currentQuestion.text}</h2>
          <div className="option-list">
            {currentQuestion.options.map((opt, i) => (
              <button key={i} className="option-item" onClick={() => selectOption(i)}>
                <span className="option-letter">{String.fromCharCode(65 + i)}</span>
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === "answered" && lastResult && (
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <h2>{lastResult.isCorrect ? "✅ Correct!" : "❌ Incorrect"}</h2>
          <p style={{ fontSize: 18, marginTop: 8 }}>+{lastResult.pointsAwarded} points</p>
          <p style={{ marginTop: 16, color: "var(--ink-muted)" }}>Waiting for the host to continue...</p>
        </div>
      )}

      {phase === "leaderboard" && (
        <div className="card" style={{ padding: 32 }}>
          <h3>Leaderboard</h3>
          <div className="manage-list" style={{ marginTop: 16 }}>
            {leaderboard.map((p, i) => (
              <div className="manage-row" key={i}>
                <div className="manage-row-text">#{i + 1} {p.name}</div>
                <div>{p.score} pts</div>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 16, color: "var(--ink-muted)" }}>Waiting for the next question...</p>
        </div>
      )}

      {phase === "finished" && (
        <div className="card" style={{ padding: 32 }}>
          <h3>🏆 Final Results</h3>
          <div className="manage-list" style={{ marginTop: 16 }}>
            {finalResults.map((p, i) => (
              <div className="manage-row" key={i}>
                <div className="manage-row-text">#{i + 1} {p.name}</div>
                <div>{p.score} pts · {p.correctCount}/{p.totalQuestions} correct</div>
              </div>
            ))}
          </div>
          <button className="btn btn-primary" style={{ marginTop: 24 }} onClick={leaveQuiz}>Done</button>
        </div>
      )}
    </div>
  );
}
