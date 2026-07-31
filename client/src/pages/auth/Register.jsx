import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import apiClient from "../../api/apiClient";
import "./Auth.css";

const DEPARTMENTS = [
  "Computer Science",
  "Information Technology",
  "Electronics & Communication",
  "Electrical Engineering",
  "Mechanical Engineering",
  "Civil Engineering",
  "MBA",
  "MCA",
];

export default function Register() {
  const [role, setRole] = useState("student");
  const [form, setForm] = useState({ name: "", email: "", password: "", department: "", semesterId: "" });
  const [departments, setDepartments] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [error, setError] = useState("");
  const { register } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (role !== "student" || !form.department) {
      setSemesters([]);
      return;
    }
    apiClient
      .get(`/semesters?department=${encodeURIComponent(form.department)}`)
      .then((res) => setSemesters(res.data.data.map((s) => ({ id: s._id, name: s.name }))))
      .catch((err) => console.error("Error fetching semesters:", err));
  }, [role, form.department]);

  function handleChange(e) {
    const { name, value } = e.target;
    if (name === "department") {
      setForm({ ...form, department: value, semesterId: "" });
    } else {
      setForm({ ...form, [name]: value });
    }
  }

  function toggleDepartment(dept) {
    setDepartments((prev) =>
      prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept]
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) {
      setError("Please fill in all fields.");
      return;
    }

    if (role === "student" && !form.department) {
      setError("Please select your department.");
      return;
    }
    if (role === "student" && !form.semesterId) {
      setError("Please select your semester.");
      return;
    }
    if (role === "faculty" && departments.length === 0) {
      setError("Please select at least one department.");
      return;
    }

    try {
      setError("");
      const userData = await register(
        form.name,
        form.email,
        form.password,
        role,
        role === "student" ? form.department : undefined,
        form.semesterId,
        role === "faculty" ? departments : undefined
      );
      navigate(userData.role === "student" ? "/student/dashboard" : "/faculty/dashboard");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-wrapper">
        <div className="auth-illustration">
          {role === "student" ? (
            <>
              <span className="eyebrow">New here</span>
              <h2>Set up your account in under a minute.</h2>
              <p>
                Create your student account to start practicing chapter-wise
                quizzes and track your performance over time.
              </p>
              <ul className="auth-illustration-list">
                <li><span className="point-check">✓</span> Free for students</li>
                <li><span className="point-check">✓</span> No setup, start in one step</li>
                <li><span className="point-check">✓</span> Timer-based, exam-like quizzes</li>
                <li><span className="point-check">✓</span> Personal performance trends</li>
              </ul>
            </>
          ) : (
            <>
              <span className="eyebrow">New here</span>
              <h2>Set up your faculty account in under a minute.</h2>
              <p>
                Create your faculty account to build question banks, generate
                MCQs with AI, and manage assessments for your course syllabus.
              </p>
              <ul className="auth-illustration-list">
                <li><span className="point-check">✓</span> AI-generated question banks</li>
                <li><span className="point-check">✓</span> CSV bulk import & export</li>
                <li><span className="point-check">✓</span> Class performance reports</li>
                <li><span className="point-check">✓</span> Built for real course syllabi</li>
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
          <h2>Create Account</h2>
          <p className="auth-subtitle">Register as a Student or Faculty member</p>

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
              <label>Full Name</label>
              <input
                type="text"
                name="name"
                placeholder="Your name"
                value={form.name}
                onChange={handleChange}
              />
            </div>
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
            {role === "student" ? (
              <>
                <div className="form-group">
                  <label>Department</label>
                  <select name="department" value={form.department} onChange={handleChange}>
                    <option value="">Select your department</option>
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Semester</label>
                  <select name="semesterId" value={form.semesterId} onChange={handleChange}>
                    <option value="">Select your semester</option>
                    {semesters.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <div className="form-group">
                <label>Department(s)</label>
                <details className="dept-dropdown">
                  <summary>
                    {departments.length === 0 ? "Select department(s)" : departments.join(", ")}
                  </summary>
                  <div className="dept-dropdown-list">
                    {DEPARTMENTS.map((d) => (
                      <label key={d} className="dept-dropdown-item">
                        <input
                          type="checkbox"
                          checked={departments.includes(d)}
                          onChange={() => toggleDepartment(d)}
                        />
                        {d}
                      </label>
                    ))}
                  </div>
                </details>
                <small style={{ display: "block", marginTop: 6, color: "var(--ink-muted)" }}>
                  Select every department you teach in.
                </small>
              </div>
            )}
            <button type="submit" className="btn btn-primary btn-block">
              Create {role === "student" ? "Student" : "Faculty"} Account
            </button>
          </form>

          <p className="auth-switch">
            Already have an account? <Link to="/login">Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
