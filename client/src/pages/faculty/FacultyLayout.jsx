import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "./Faculty.css";

const links = [
  { to: "/faculty/dashboard", label: "Overview", icon: "📊" },
  { to: "/faculty/semesters", label: "Semesters", icon: "🗂" },
  { to: "/faculty/subjects", label: "Subjects", icon: "📘" },
  { to: "/faculty/chapters", label: "Chapters", icon: "📑" },
  { to: "/faculty/questions", label: "Questions", icon: "❓" },
  { to: "/faculty/reports", label: "Reports", icon: "📈" },
];

export default function FacultyLayout() {
  const { user } = useAuth();

  return (
    <div className="faculty-shell">
      <aside className="faculty-sidebar">
        <div className="faculty-sidebar-brand">
          <span className="navbar-logo">QW</span>
          <div>
            <strong>Faculty Panel</strong>
            <span>{user?.name}</span>
          </div>
        </div>
        <h4>Manage</h4>
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            className={({ isActive }) => `faculty-nav-link ${isActive ? "active" : ""}`}
          >
            <span>{l.icon}</span> {l.label}
          </NavLink>
        ))}
        <div className="faculty-sidebar-footer">
          <span className="badge badge-teal">Faculty</span>
        </div>
      </aside>
      <main className="faculty-content">
        <Outlet />
      </main>
    </div>
  );
}
