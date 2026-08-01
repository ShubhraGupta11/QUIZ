import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import BackButton from "../../components/BackButton";
import "./Auth.css";

export default function Login() {
  const [role, setRole] = useState("student");
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.email || !form.password) {
      setError("Please fill in all fields.");
      return;
    }
    try {
      setError("");
      const userData = await login(form.email, form.password, role);
      navigate(userData.role === "student" ? "/student/dashboard" : "/faculty/dashboard");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="auth-page">
      <div style={{ position: "absolute", top: 88, left: 24 }}>
        <BackButton />
      </div>
      <div className="auth-wrapper">
        <div className="auth-illustration">
          {role === "student" ? (
            <>
              <span className="eyebrow">Welcome back</span>
              <h2>Pick up right where you left off.</h2>
              <p>
                Pick your semester, subject, and chapter — take a quick quiz and get
                instant results with detailed performance insights.
              </p>
              <ul className="auth-illustration-list">
                <li><span className="point-check">✓</span> Chapter-wise question banks</li>
                <li><span className="point-check">✓</span> Timer-based, exam-like quizzes</li>
                <li><span className="point-check">✓</span> Instant scoring & review</li>
                <li><span className="point-check">✓</span> Personal performance trends</li>
              </ul>
            </>
          ) : (
            <>
              <span className="eyebrow">Welcome back, Faculty</span>
              <h2>Manage your courses in one place.</h2>
              <p>
                Build question banks, generate MCQs with AI, and track class
                performance across every semester and subject.
              </p>
              <ul className="auth-illustration-list">
                <li><span className="point-check">✓</span> AI-generated question banks</li>
                <li><span className="point-check">✓</span> CSV bulk import & export</li>
                <li><span className="point-check">✓</span> Class performance reports</li>
                <li><span className="point-check">✓</span> Per-question item analysis</li>
              </ul>
            </>
          )}
          <div className="auth-illustration-stats">
            <div><strong>7</strong><span>Semesters</span></div>
            <div><strong>40+</strong><span>Subjects</span></div>
            <div><strong>1,200+</strong><span>Questions</span></div>
          </div>
        </div>
        <div className="auth-form-panel">
          <h2>Login</h2>
          <p className="auth-subtitle">Login as a Student or Faculty member</p>

          <div className="role-toggle">
            <button
              type="button"
              className={role === "student" ? "active" : ""}
              onClick={() => setRole("student")}
            >
              Student
            </button>
            <button
              type="button"
              className={role === "faculty" ? "active" : ""}
              onClick={() => setRole("faculty")}
            >
              Faculty
            </button>
          </div>

          {error && <div className="auth-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                name="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                name="password"
                placeholder="••••••••"
                value={form.password}
                onChange={handleChange}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-block">
              Login as {role === "student" ? "Student" : "Faculty"}
            </button>
          </form>

          <p className="auth-switch">
            Don't have an account? <Link to="/register">Register</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
