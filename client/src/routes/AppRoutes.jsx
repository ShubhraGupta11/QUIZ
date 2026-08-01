import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import Navbar from "../components/Navbar";
import SettingsPanel from "../components/SettingsPanel";
import ProtectedRoute from "../components/ProtectedRoute";
import Loader from "../components/Loader";

import Home from "../pages/Home";
import Login from "../pages/auth/Login";
import Register from "../pages/auth/Register";

// Everything below is route-split: a visitor on Home/Login/Register never
// downloads Faculty or Student quiz-taking code, and students never download
// the Faculty panel's bundle (Live Quiz Battle, AI generation, etc). Each
// chunk loads on demand the first time its route is visited.
const StudentDashboard = lazy(() => import("../pages/student/StudentDashboard"));
const SubjectSelect = lazy(() => import("../pages/student/SubjectSelect"));
const ChapterSelect = lazy(() => import("../pages/student/ChapterSelect"));
const Quiz = lazy(() => import("../pages/student/Quiz"));
const Result = lazy(() => import("../pages/student/Result"));
const Performance = lazy(() => import("../pages/student/Performance"));
const Leaderboard = lazy(() => import("../pages/student/Leaderboard"));
const LiveQuizJoin = lazy(() => import("../pages/student/LiveQuizJoin"));
const GenerateQuiz = lazy(() => import("../pages/student/GenerateQuiz"));
const Flashcards = lazy(() => import("../pages/student/Flashcards"));
const DoubtChat = lazy(() => import("../pages/student/DoubtChat"));
const MyDoubts = lazy(() => import("../pages/student/MyDoubts"));
const StudyGroups = lazy(() => import("../pages/student/StudyGroups"));
const Certificate = lazy(() => import("../pages/student/Certificate"));

const FacultyLayout = lazy(() => import("../pages/faculty/FacultyLayout"));
const FacultyOverview = lazy(() => import("../pages/faculty/FacultyOverview"));
const ContentTree = lazy(() => import("../pages/faculty/ContentTree"));
const ManageSemesters = lazy(() => import("../pages/faculty/ManageSemesters"));
const ManageSubjects = lazy(() => import("../pages/faculty/ManageSubjects"));
const ManageChapters = lazy(() => import("../pages/faculty/ManageChapters"));
const ManageQuestions = lazy(() => import("../pages/faculty/ManageQuestions"));
const Reports = lazy(() => import("../pages/faculty/Reports"));
const LiveQuizHost = lazy(() => import("../pages/faculty/LiveQuizHost"));
const StudentDoubts = lazy(() => import("../pages/faculty/StudentDoubts"));

const AdminLayout = lazy(() => import("../pages/admin/AdminLayout"));
const AdminOverview = lazy(() => import("../pages/admin/AdminOverview"));
const AdminDepartments = lazy(() => import("../pages/admin/AdminDepartments"));
const AdminFaculty = lazy(() => import("../pages/admin/AdminFaculty"));
const AdminStudents = lazy(() => import("../pages/admin/AdminStudents"));
const AdminContentTree = lazy(() => import("../pages/admin/AdminContentTree"));
const AdminLiveSessions = lazy(() => import("../pages/admin/AdminLiveSessions"));

function PageLoader() {
  return (
    <div style={{ padding: "80px 20px", display: "flex", justifyContent: "center" }}>
      <Loader label="Loading..." />
    </div>
  );
}

export default function AppRoutes() {
  return (
    <>
      <Navbar />
      <SettingsPanel />
      <Suspense fallback={<PageLoader />}>
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
            path="/student/generate-quiz"
            element={<ProtectedRoute role="student"><GenerateQuiz /></ProtectedRoute>}
          />
          <Route
            path="/student/self-quiz"
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
          <Route
            path="/student/flashcards"
            element={<ProtectedRoute role="student"><Flashcards /></ProtectedRoute>}
          />
          <Route
            path="/student/ask-ai"
            element={<ProtectedRoute role="student"><DoubtChat /></ProtectedRoute>}
          />
          <Route
            path="/student/doubts"
            element={<ProtectedRoute role="student"><MyDoubts /></ProtectedRoute>}
          />
          <Route
            path="/student/groups"
            element={<ProtectedRoute role="student"><StudyGroups /></ProtectedRoute>}
          />
          <Route
            path="/student/certificate"
            element={<ProtectedRoute role="student"><Certificate /></ProtectedRoute>}
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
            <Route path="doubts" element={<StudentDoubts />} />
          </Route>

          <Route
            path="/admin"
            element={<ProtectedRoute role="admin"><AdminLayout /></ProtectedRoute>}
          >
            <Route path="overview" element={<AdminOverview />} />
            <Route path="departments" element={<AdminDepartments />} />
            <Route path="faculty" element={<AdminFaculty />} />
            <Route path="students" element={<AdminStudents />} />
            <Route path="content" element={<AdminContentTree />} />
            <Route path="reports" element={<Reports />} />
            <Route path="live-sessions" element={<AdminLiveSessions />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}
