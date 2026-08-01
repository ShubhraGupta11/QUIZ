import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import { useQuiz } from "../../context/QuizContext";
import BackButton from "../../components/BackButton";
import "./Student.css";

function scoreClass(percent) {
  if (percent >= 70) return "good";
  if (percent >= 40) return "mid";
  return "low";
}

export default function Performance() {
  const { attempts } = useQuiz();
  const navigate = useNavigate();

  const stats = useMemo(() => {
    if (attempts.length === 0) return null;
    const totalAttempts = attempts.length;
    const avgPercent =
      attempts.reduce((sum, a) => sum + (a.correct / a.total) * 100, 0) / totalAttempts;
    const bestPercent = Math.max(...attempts.map((a) => (a.correct / a.total) * 100));
    const subjectMap = {};
    attempts.forEach((a) => {
      subjectMap[a.subjectName] = subjectMap[a.subjectName] || { name: a.subjectName, correct: 0, total: 0 };
      subjectMap[a.subjectName].correct += a.correct;
      subjectMap[a.subjectName].total += a.total;
    });
    const subjectChart = Object.values(subjectMap).map((s) => ({
      name: s.name,
      accuracy: Math.round((s.correct / s.total) * 100),
    }));
    const trendChart = attempts.map((a, i) => ({
      name: `#${i + 1}`,
      score: Math.round((a.correct / a.total) * 100),
    }));

    // Current streak: consecutive most-recent attempts (by date) scoring >= 70%
    const sortedByDate = attempts.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
    let currentStreak = 0;
    for (let i = sortedByDate.length - 1; i >= 0; i--) {
      const pct = (sortedByDate[i].correct / sortedByDate[i].total) * 100;
      if (pct >= 70) currentStreak += 1;
      else break;
    }

    const badges = [];
    if (totalAttempts >= 1) badges.push({ icon: "🎯", label: "First Quiz" });
    if (totalAttempts >= 10) badges.push({ icon: "📚", label: "10 Quizzes Completed" });
    if (totalAttempts >= 25) badges.push({ icon: "🏅", label: "25 Quizzes Completed" });
    if (bestPercent === 100) badges.push({ icon: "💯", label: "Perfect Score" });
    if (currentStreak >= 3) badges.push({ icon: "🔥", label: `${currentStreak}-Quiz Streak (≥70%)` });
    if (avgPercent >= 80) badges.push({ icon: "⭐", label: "80%+ Average" });

    return { totalAttempts, avgPercent, bestPercent, subjectChart, trendChart, currentStreak, badges };
  }, [attempts]);

  return (
    <div className="page container">
      <BackButton />
      <div className="page-header">
        <div>
          <span className="eyebrow">Analytics</span>
          <h1>Your Performance</h1>
          <p>Track your quiz history, accuracy trends, and subject-wise strengths.</p>
        </div>
        {stats && (
          <div className="page-header-side">
            <span className="badge badge-teal">{stats.totalAttempts} attempts</span>
            <span className="badge badge-gold">{Math.round(stats.avgPercent)}% avg</span>
          </div>
        )}
      </div>

      {!stats ? (
        <div className="empty-state card">
          <p>No quiz attempts yet. Take a quiz to see your performance here!</p>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate("/student/dashboard")}>
            Start a Quiz
          </button>
        </div>
      ) : (
        <>
          <div className="stat-row">
            <div className="stat-box card">
              <div className="num">{stats.totalAttempts}</div>
              <div className="label">Quizzes Attempted</div>
            </div>
            <div className="stat-box card">
              <div className="num">{Math.round(stats.avgPercent)}%</div>
              <div className="label">Average Score</div>
            </div>
            <div className="stat-box card">
              <div className="num">{Math.round(stats.bestPercent)}%</div>
              <div className="label">Best Score</div>
            </div>
            <div className="stat-box card">
              <div className="num">🔥 {stats.currentStreak}</div>
              <div className="label">Current Streak</div>
            </div>
          </div>

          {stats.badges.length > 0 && (
            <div className="chart-card card">
              <h3>Badges Earned</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                {stats.badges.map((b) => (
                  <div
                    key={b.label}
                    className="badge badge-gold"
                    style={{ fontSize: 13, padding: "8px 14px", display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <span style={{ fontSize: 16 }}>{b.icon}</span> {b.label}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="chart-card card">
            <h3>Score Trend</h3>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={stats.trendChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e3d9c4" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="score" stroke="#c1440e" strokeWidth={3} dot={{ r: 4, fill: "#c1440e" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-card card">
            <h3>Subject-wise Accuracy</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={stats.subjectChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e3d9c4" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="accuracy" fill="#2f5d50" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-card card">
            <h3>Attempt History</h3>
            <table className="attempt-table">
              <thead>
                <tr>
                  <th>Chapter</th>
                  <th>Subject</th>
                  <th>Score</th>
                  <th>Time</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {attempts.slice().reverse().map((a) => {
                  const percent = Math.round((a.correct / a.total) * 100);
                  return (
                    <tr key={a.id}>
                      <td>{a.chapterName}</td>
                      <td>{a.subjectName}</td>
                      <td>
                        <span className={`score-pill ${scoreClass(percent)}`}>
                          {a.correct}/{a.total} ({percent}%)
                        </span>
                      </td>
                      <td>{a.timeTakenSec}s</td>
                      <td>{new Date(a.date).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
