import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { getAvatar } from "../utils/avatar";
import NotificationBell from "./NotificationBell";
import "./Navbar.css";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [avatar, setAvatar] = useState(() => getAvatar(user?._id));

  useEffect(() => {
    setAvatar(getAvatar(user?._id));
    function onAvatarChanged() {
      setAvatar(getAvatar(user?._id));
    }
    window.addEventListener("avatar-changed", onAvatarChanged);
    return () => window.removeEventListener("avatar-changed", onAvatarChanged);
  }, [user?._id]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Link to="/" className="navbar-brand">
          <span className="navbar-logo">QW</span>
          QuizWise
        </Link>

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
              to={
                user.role === "student"
                  ? "/student/dashboard"
                  : user.role === "admin"
                  ? "/admin/overview"
                  : "/faculty/dashboard"
              }
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
                <NotificationBell />
              </>
            )}
            <span className="navbar-divider" />
            <span className="navbar-user">
              <span className="navbar-avatar">{avatar || user.name?.[0]?.toUpperCase() || "U"}</span>
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
