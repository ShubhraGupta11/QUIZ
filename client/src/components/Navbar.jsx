import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import "./Navbar.css";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <div className="navbar-left">
          {location.pathname !== "/" && (
            <button
              type="button"
              className="btn btn-ghost navbar-back"
              onClick={() => navigate(-1)}
              aria-label="Go back"
            >
              ← Back
            </button>
          )}
          <Link to="/" className="navbar-brand">
            <span className="navbar-logo">QW</span>
            QuizWise
          </Link>
        </div>

        {user ? (
          <div className="navbar-right">
            <button
              type="button"
              className="btn btn-ghost navbar-theme-toggle"
              onClick={toggleTheme}
              aria-label="Toggle dark mode"
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
            <Link
              to={user.role === "student" ? "/student/dashboard" : "/faculty/dashboard"}
              className="navbar-link"
            >
              Dashboard
            </Link>
            {user.role === "student" && (
              <>
                <Link to="/student/performance" className="navbar-link">
                  Performance
                </Link>
                <Link to="/student/live" className="navbar-link">
                  ⚡ Live Quiz
                </Link>
              </>
            )}
            <span className="navbar-divider" />
            <span className="navbar-user">
              <span className="navbar-avatar">{user.name?.[0]?.toUpperCase() || "U"}</span>
              {user.name} <span className="navbar-role">{user.role}</span>
            </span>
            <button className="btn btn-outline navbar-logout" onClick={handleLogout}>
              Logout
            </button>
          </div>
        ) : (
          <div className="navbar-right">
            <button
              type="button"
              className="btn btn-ghost navbar-theme-toggle"
              onClick={toggleTheme}
              aria-label="Toggle dark mode"
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
            <Link to="/login" className="navbar-link">Login</Link>
            <button className="btn btn-primary navbar-logout" onClick={() => navigate("/register")}>
              Get started
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
