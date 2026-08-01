import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "../faculty/Faculty.css";

const links = [
  { to: "/admin/overview", label: "Overview", icon: "📊" },
  { to: "/admin/departments", label: "Departments", icon: "🏛" },
  { to: "/admin/faculty", label: "Faculty", icon: "👨‍🏫" },
  { to: "/admin/students", label: "Students", icon: "🎓" },
  { to: "/admin/content", label: "Content Tree", icon: "🌳" },
  { to: "/admin/reports", label: "Reports", icon: "📈" },
  { to: "/admin/live-sessions", label: "Live Sessions", icon: "⚡" },
];

export default function AdminLayout() {
  const { user } = useAuth();

  return (
    <div className="faculty-shell">
      <aside className="faculty-sidebar">
        <div className="faculty-sidebar-brand">
          <span className="navbar-logo">QW</span>
          <div>
            <strong>Admin Panel</strong>
            <span>{user?.name}</span>
          </div>
        </div>
        <h4>Platform</h4>
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
          <span className="badge badge-gold">Admin</span>
        </div>
      </aside>
      <main className="faculty-content">
        <Outlet />
      </main>
    </div>
  );
}
