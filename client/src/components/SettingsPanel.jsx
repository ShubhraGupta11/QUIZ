import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { AVATAR_EMOJIS, getAvatar, setAvatar } from "../utils/avatar";
import "./SettingsPanel.css";

export default function SettingsPanel() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme, fontSize, toggleFontSize, readingFont, toggleReadingFont } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [avatar, setAvatarState] = useState(() => getAvatar(user?._id));

  function handleLogout() {
    setOpen(false);
    logout();
    navigate("/login");
  }

  function pickAvatar(emoji) {
    setAvatar(user._id, emoji);
    setAvatarState(emoji);
    window.dispatchEvent(new Event("avatar-changed"));
  }

  return (
    <div className="settings-panel">
      {open && (
        <div className="settings-menu card fade-in">
          {user ? (
            <div className="settings-menu-header">
              <span className="navbar-avatar">{avatar || user.name?.[0]?.toUpperCase() || "U"}</span>
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

          <div className="settings-menu-row">
            <span>Larger text</span>
            <button
              type="button"
              className={`settings-switch ${fontSize === "large" ? "on" : ""}`}
              onClick={toggleFontSize}
              aria-label="Toggle larger text"
            >
              <span className="settings-switch-knob" />
            </button>
          </div>

          <div className="settings-menu-row">
            <span>Reading-friendly font</span>
            <button
              type="button"
              className={`settings-switch ${readingFont ? "on" : ""}`}
              onClick={toggleReadingFont}
              aria-label="Toggle reading-friendly font"
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

          {user && (
            <div style={{ padding: "8px 0" }}>
              <span style={{ fontSize: 12, color: "var(--ink-muted)", display: "block", marginBottom: 6 }}>Avatar</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {AVATAR_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => pickAvatar(emoji)}
                    style={{
                      fontSize: 18,
                      padding: 6,
                      borderRadius: 8,
                      border: avatar === emoji ? "2px solid var(--accent)" : "1px solid var(--border-soft)",
                      background: "var(--bg)",
                      cursor: "pointer",
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
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
