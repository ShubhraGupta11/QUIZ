import { Routes, Route } from "react-router-dom";
import Navbar from "../components/Navbar";
import SettingsPanel from "../components/SettingsPanel";
import ProtectedRoute from "../components/ProtectedRoute";

import Home from "../pages/Home";
import Login from "../pages/auth/Login";
import Register from "../pages/auth/Register";

import StudentDashboard from "../pages/student/StudentDashboard";
import SubjectSelect from "../pages/student/SubjectSelect";
import ChapterSelect from "../pages/student/ChapterSelect";
import Quiz from "../pages/student/Quiz";
import Result from "../pages/student/Result";
import Performance from "../pages/student/Performance";
import Leaderboard from "../pages/student/Leaderboard";
import LiveQuizJoin from "../pages/student/LiveQuizJoin";

import FacultyLayout from "../pages/faculty/FacultyLayout";
import FacultyOverview from "../pages/faculty/FacultyOverview";
import ContentTree from "../pages/faculty/ContentTree";
import ManageSemesters from "../pages/faculty/ManageSemesters";
import ManageSubjects from "../pages/faculty/ManageSubjects";
import ManageChapters from "../pages/faculty/ManageChapters";
import ManageQuestions from "../pages/faculty/ManageQuestions";
import Reports from "../pages/faculty/Reports";
import LiveQuizHost from "../pages/faculty/LiveQuizHost";

export default function AppRoutes() {
  return (
    <>
      <Navbar />
      <SettingsPanel />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route
          path="/student/dashboard"
          element={<ProtectedRoute role="student"><StudentDashboard /></ProtectedRoute>}
        />
        <Route
          path="/student/:semesterId/subjects"
          element={<ProtectedRoute role="student"><SubjectSelect /></ProtectedRoute>}
        />
        <Route
          path="/student/:semesterId/:subjectId/chapters"
          element={<ProtectedRoute role="student"><ChapterSelect /></ProtectedRoute>}
        />
        <Route
          path="/student/:semesterId/:subjectId/:chapterId/quiz"
          element={<ProtectedRoute role="student"><Quiz /></ProtectedRoute>}
        />
        <Route
          path="/student/result"
          element={<ProtectedRoute role="student"><Result /></ProtectedRoute>}
        />
        <Route
          path="/student/performance"
          element={<ProtectedRoute role="student"><Performance /></ProtectedRoute>}
        />
        <Route
          path="/student/leaderboard/:chapterId"
          element={<ProtectedRoute role="student"><Leaderboard /></ProtectedRoute>}
        />
        <Route
          path="/student/live"
          element={<ProtectedRoute role="student"><LiveQuizJoin /></ProtectedRoute>}
        />
        {/* Public QR-scan join — no login required, guests join by name only */}
        <Route path="/join/:code" element={<LiveQuizJoin />} />

        <Route
          path="/faculty"
          element={<ProtectedRoute role="faculty"><FacultyLayout /></ProtectedRoute>}
        >
          <Route path="dashboard" element={<FacultyOverview />} />
          <Route path="content" element={<ContentTree />} />
          <Route path="semesters" element={<ManageSemesters />} />
          <Route path="subjects" element={<ManageSubjects />} />
          <Route path="chapters" element={<ManageChapters />} />
          <Route path="questions" element={<ManageQuestions />} />
          <Route path="reports" element={<Reports />} />
          <Route path="live" element={<LiveQuizHost />} />
        </Route>
      </Routes>
    </>
  );
}
