import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getLiveSocket, disconnectLiveSocket } from "../../api/liveSocket";
import "./Student.css";
import "../../styles/liveQuiz.css";

export default function LiveQuizJoin() {
  const { code: codeFromUrl } = useParams(); // set only on the public /join/:code route
  const { user } = useAuth();
  const isGuestRoute = !!codeFromUrl && !user;

  const [code, setCode] = useState(codeFromUrl || "");
  const [guestName, setGuestName] = useState("");
  const [phase, setPhase] = useState("join"); // join -> lobby -> question -> answered -> reveal -> leaderboard -> finished
  const [error, setError] = useState("");
  const [chapterName, setChapterName] = useState("");
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [revealData, setRevealData] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [finalResults, setFinalResults] = useState([]);

  const timerRef = useRef(null);

  const socket = getLiveSocket();

  useEffect(() => {
    socket.on("question:show", ({ index, total, question }) => {
      setQuestionIndex(index);
      setTotalQuestions(total);
      setCurrentQuestion(question);
      setSelectedOption(null);
      setLastResult(null);
      setRevealData(null);
      setTimeLeft(question.timeLimitSec);
      setPhase("question");

      clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimeLeft((t) => (t > 0 ? t - 1 : 0));
      }, 1000);
    });

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
      socket.off("question:show");
      socket.off("question:reveal");
      socket.off("leaderboard:update");
      socket.off("quiz:finished");
      socket.off("live:error");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function joinWithCode(roomCode) {
    setError("");
    socket.connect();
    socket.emit("player:join", { code: roomCode }, (res) => {
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

  function joinRoom() {
    if (!code.trim()) return;
    joinWithCode(code.trim());
  }

  function joinAsGuest() {
    if (!guestName.trim()) return alert("Please enter your name.");
    if (!code.trim()) return alert("Missing room code.");
    getLiveSocket(guestName.trim()); // refresh the cached socket's auth before connecting
    joinWithCode(code.trim());
  }

  // A logged-in student who scanned the QR code joins automatically with
  // their real account — no name entry needed, and it counts toward their
  // real quiz history.
  useEffect(() => {
    if (codeFromUrl && user && phase === "join") {
      joinWithCode(codeFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeFromUrl, user]);

  function selectOption(optionIndex) {
    if (selectedOption !== null) return;
    setSelectedOption(optionIndex);
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

      {phase === "join" && isGuestRoute && (
        <div className="card" style={{ padding: 32, maxWidth: 420 }}>
          <label style={{ fontSize: 12, color: "var(--ink-muted)", display: "block", marginBottom: 8 }}>
            Room {code} — what's your name?
          </label>
          <input
            autoFocus
            placeholder="Enter your name"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && joinAsGuest()}
            style={{ fontSize: 18, textAlign: "center", width: "100%", padding: 12 }}
          />
          <button className="btn btn-primary btn-block" style={{ marginTop: 16 }} onClick={joinAsGuest}>
            Join Quiz →
          </button>
        </div>
      )}

      {phase === "join" && codeFromUrl && user && (
        <div className="card" style={{ padding: 32, textAlign: "center" }}>Joining as {user.name}...</div>
      )}

      {phase === "join" && !codeFromUrl && (
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
        <div className="lq-lobby">
          <div className="lq-pin-label">You're in!</div>
          <h2 style={{ marginTop: 8 }}>{chapterName}</h2>
          <p>{totalQuestions} questions · Waiting for host to start...</p>
        </div>
      )}

      {phase === "question" && currentQuestion && (
        <div className="card" style={{ padding: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--ink-muted)" }}>
            <span>Question {questionIndex + 1} of {totalQuestions}</span>
            <span>⏱ {timeLeft}s</span>
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
                <button
                  key={i}
                  className={`lq-tile ${selectedOption === i ? "selected" : ""}`}
                  style={{ background: tile.color }}
                  onClick={() => selectOption(i)}
                  disabled={selectedOption !== null}
                >
                  <span className={`lq-tile-shape ${tile.shape}`} />
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {phase === "answered" && lastResult && (
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <h2>{lastResult.isCorrect ? "✅ Correct!" : "❌ Incorrect"}</h2>
          <p style={{ fontSize: 20, marginTop: 8, fontWeight: 800 }}>+{lastResult.pointsAwarded} points</p>
          {lastResult.isCorrect && lastResult.streak >= 2 && (
            <div className="lq-streak-badge" style={{ marginTop: 12 }}>🔥 {lastResult.streak} in a row!</div>
          )}
          <p style={{ marginTop: 16, color: "var(--ink-muted)" }}>Waiting for other players...</p>
        </div>
      )}

      {phase === "reveal" && currentQuestion && revealData && (
        <div className="card" style={{ padding: 32 }}>
          <div className={`lq-reveal-banner ${lastResult?.isCorrect ? "correct" : "incorrect"}`}>
            Correct Answer: {currentQuestion.options[revealData.correctOptionIndex]}
          </div>
          <p style={{ textAlign: "center", color: "var(--ink-muted)" }}>Waiting for the host to continue...</p>
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
            <button className="btn btn-primary" style={{ marginTop: 24 }} onClick={leaveQuiz}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
