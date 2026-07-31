import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import "./SettingsPanel.css";

export default function SettingsPanel() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  function handleLogout() {
    setOpen(false);
    logout();
    navigate("/login");
  }

  return (
    <div className="settings-panel">
      {open && (
        <div className="settings-menu card fade-in">
          {user ? (
            <div className="settings-menu-header">
              <span className="navbar-avatar">{user.name?.[0]?.toUpperCase() || "U"}</span>
              <div>
                <strong>{user.name}</strong>
                <span className="settings-menu-email">{user.email}</span>
              </div>
            </div>
          ) : (
            <div className="settings-menu-header">
              <strong>QuizWise</strong>
            </div>
          )}

          <div className="settings-menu-row">
            <span>Dark mode</span>
            <button
              type="button"
              className={`settings-switch ${theme === "dark" ? "on" : ""}`}
              onClick={toggleTheme}
              aria-label="Toggle dark mode"
            >
              <span className="settings-switch-knob" />
            </button>
          </div>

          {user && (
            <div className="settings-menu-row">
              <span>Role</span>
              <span className="navbar-role">{user.role}</span>
            </div>
          )}

          {user ? (
            <button type="button" className="btn btn-outline btn-block settings-logout" onClick={handleLogout}>
              Logout
            </button>
          ) : (
            <button type="button" className="btn btn-primary btn-block settings-logout" onClick={() => { setOpen(false); navigate("/login"); }}>
              Login
            </button>
          )}
        </div>
      )}

      <button
        type="button"
        className="settings-fab"
        onClick={() => setOpen((o) => !o)}
        aria-label="Settings"
      >
        ⚙️
      </button>
    </div>
  );
}
