import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Home.css";

const STATS = [
  { value: "7", label: "Semesters covered" },
  { value: "40+", label: "Subjects mapped" },
  { value: "1,200+", label: "Practice questions" },
  { value: "92%", label: "Avg. completion rate" },
];

const STEPS = [
  {
    num: "01",
    title: "Pick semester & subject",
    body: "Choose exactly where you are in the syllabus — no digging through irrelevant material.",
  },
  {
    num: "02",
    title: "Drill into a chapter",
    body: "Every chapter has its own focused question set, so you practice what you actually need.",
  },
  {
    num: "03",
    title: "Take the timed quiz",
    body: "A clean, distraction-free quiz runs on the clock — same pressure as the real exam.",
  },
  {
    num: "04",
    title: "Review honest analytics",
    body: "See your score, your weak topics, and how you're trending attempt over attempt.",
  },
];

const AUDIENCES = [
  {
    tag: "For students",
    title: "Practice with intent, not noise",
    points: [
      "Chapter-level filtering across 7 semesters",
      "Timer-based quizzes that mirror exam conditions",
      "Instant scoring with a full answer review",
      "Personal performance dashboard & trend chart",
    ],
  },
  {
    tag: "For faculty",
    title: "Build and manage assessments fast",
    points: [
      "Manage semesters, subjects & chapters in one panel",
      "Bulk question authoring with tagging",
      "Class-wide reports and per-student breakdowns",
      "Reusable question bank across sections",
    ],
  },
];

const QUOTES = [
  {
    quote: "Cut my revision time in half — I only touch the chapters I'm actually weak in.",
    who: "Final-year student, Sem 7",
  },
  {
    quote: "Setting up a chapter test for 3 sections used to take an evening. Now it's minutes.",
    who: "Faculty, Computer Engineering",
  },
  {
    quote: "The trend chart is the first thing that actually told me where I was slipping.",
    who: "Sem 4 student",
  },
];

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();

  function handleStart() {
    if (!user) return navigate("/login");
    navigate(user.role === "student" ? "/student/dashboard" : "/faculty/dashboard");
  }

  return (
    <div className="home">
      <div className="hero-panel">
        <div className="hero-inner">
        <div className="hero-grid">
          <div className="hero-copy">
            <span className="hero-pill">✨ Announcing QuizWise Beta 2.0 →</span>
            <h1>
              All-in-one practice<br />
              for your <span>syllabus</span>,<br />
              chapter by chapter.
            </h1>
            <p className="hero-lede">
              Pick your semester, your subject, your chapter — QuizWise builds the
              test around exactly what you're studying. Instant scoring, honest
              analytics, zero fluff.
            </p>
            <div className="hero-actions">
              <button className="btn btn-primary" onClick={handleStart}>
                {user ? "Go to dashboard" : "Start practicing"} →
              </button>
              {!user && (
                <button className="btn btn-on-dark" onClick={() => navigate("/login")}>
                  I already have an account
                </button>
              )}
            </div>
          </div>

          <div className="hero-visual">
            <div className="mock-card mock-card-main">
              <span className="mock-label">Data Structures · Linked Lists</span>
              <h3>Question 4 of 5</h3>
              <div className="mock-progress-row">
                <div className="mock-progress">
                  <div className="mock-progress-fill" style={{ width: "70%" }} />
                </div>
                <span className="mock-label">00:18</span>
              </div>
              <div className="mock-progress-row">
                <div className="mock-progress">
                  <div className="mock-progress-fill" style={{ width: "45%", background: "var(--dark)" }} />
                </div>
                <span className="mock-label">Accuracy 82%</span>
              </div>
            </div>
            <div className="mock-card mock-score">
              <span className="mock-score-val">86%</span>
              <span className="mock-label">Last attempt · DBMS</span>
            </div>
          </div>
        </div>

        <div className="trusted-row">
          <span className="trusted-label">Built for real course syllabi across departments</span>
          <div className="trusted-logos">
            <span>CSE</span>
            <span>IT</span>
            <span>ENTC</span>
            <span>MECH</span>
            <span>CIVIL</span>
          </div>
        </div>
        </div>
      </div>

      <div className="container home-stats">
        {STATS.map((s) => (
          <div className="stat-block" key={s.label}>
            <span className="stat-value">{s.value}</span>
            <span className="stat-label">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="container home-section">
        <div className="section-eyebrow-row">
          <span className="eyebrow">How it works</span>
        </div>
        <h2 className="home-section-title">From syllabus to score in four steps</h2>
        <div className="steps-grid">
          {STEPS.map((s) => (
            <div className="hiw-step" key={s.num}>
              <span className="hiw-step-num">{s.num}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="container home-section">
        <div className="section-eyebrow-row">
          <span className="eyebrow">Why QuizWise</span>
        </div>
        <div className="home-features">
          <div className="feature-row">
            <span className="feature-num">01</span>
            <div>
              <h3>Drill down to the exact chapter</h3>
              <p>Semester → Subject → Chapter. No scrolling through an entire syllabus to find what you need.</p>
            </div>
          </div>
          <div className="feature-row">
            <span className="feature-num">02</span>
            <div>
              <h3>Timer keeps you honest</h3>
              <p>Every question runs on the clock, just like the real exam — auto-submits if time runs out.</p>
            </div>
          </div>
          <div className="feature-row">
            <span className="feature-num">03</span>
            <div>
              <h3>See where you're actually weak</h3>
              <p>Score trends and subject-wise accuracy, tracked attempt over attempt — not just a final grade.</p>
            </div>
          </div>
          <div className="feature-row">
            <span className="feature-num">04</span>
            <div>
              <h3>Faculty stay in control</h3>
              <p>Every quiz is built from a faculty-managed question bank — organized, tagged, and reusable.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container home-audiences">
        {AUDIENCES.map((a) => (
          <div className="audience-card" key={a.tag}>
            <span className="badge badge-accent">{a.tag}</span>
            <h3>{a.title}</h3>
            <ul className="audience-points">
              {a.points.map((p) => (
                <li key={p}>
                  <span className="point-check">✓</span> {p}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="container home-quotes">
        <div className="section-eyebrow-row">
          <span className="eyebrow">From people using it</span>
        </div>
        <div className="quotes-grid">
          {QUOTES.map((q) => (
            <div className="quote-card" key={q.who}>
              <p className="quote-text">&ldquo;{q.quote}&rdquo;</p>
              <span className="quote-who">{q.who}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="container home-cta">
        <div className="cta-panel">
          <div>
            <span className="hero-pill">Ready when you are</span>
            <h2>Start your next practice session in under a minute.</h2>
          </div>
          <button className="btn btn-primary" onClick={handleStart}>
            {user ? "Go to dashboard" : "Get started free"} →
          </button>
        </div>
      </div>

      <footer className="home-footer">
        <div className="container home-footer-inner">
          <div className="footer-brand">
            <span className="navbar-logo">QW</span>
            <div>
              <strong>QuizWise</strong>
              <p>Chapter-wise practice, built for real syllabi.</p>
            </div>
          </div>
          <div className="footer-cols">
            <div>
              <span className="footer-col-title">Platform</span>
              <span>Student practice</span>
              <span>Faculty panel</span>
              <span>Performance analytics</span>
            </div>
            <div>
              <span className="footer-col-title">Coverage</span>
              <span>Semester 1 – 7</span>
              <span>40+ subjects</span>
              <span>1,200+ questions</span>
            </div>
            <div>
              <span className="footer-col-title">Support</span>
              <span>Help center</span>
              <span>Contact faculty admin</span>
              <span>Report an issue</span>
            </div>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© {new Date().getFullYear()} QuizWise. Built for students, by students.</span>
        </div>
      </footer>
    </div>
  );
}
