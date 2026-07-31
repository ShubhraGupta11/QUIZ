# SmartQuiz — Technical Requirements Document (TRD)

## 1. Architecture
- **Frontend**: React (Vite) SPA, React Router v6 for navigation, Context API for global state (auth, quiz session).
- **Backend**: Node.js + Express REST API.
- **Database**: MongoDB (Mongoose) — flexible schema for semesters/subjects/chapters/questions.
- **Auth**: JWT access tokens, bcrypt password hashing, role-based middleware (student/faculty).

## 2. Frontend Structure
```
client/
  src/
    api/            # axios instance + API call functions
    assets/         # images, icons
    components/      # shared UI (Navbar, Card, Button, Loader, Timer, ProtectedRoute)
    context/         # AuthContext, QuizContext
    pages/
      auth/          # Login, Register (role-aware)
      student/       # SemesterSelect, SubjectSelect, ChapterSelect, Quiz, Result, Performance, Dashboard
      faculty/       # FacultyDashboard, ManageSemesters, ManageSubjects, ManageChapters, ManageQuestions, Reports
    routes/          # AppRoutes.jsx
    styles/          # global theme (CSS variables, light theme)
    App.jsx
    main.jsx
```

## 3. Backend Structure
```
server/
  src/
    config/db.js
    models/          # User, Semester, Subject, Chapter, Question, Attempt
    controllers/
    routes/
    middleware/      # auth, role guard, error handler
    server.js
```

## 4. Data Model (high level)
- **User**: name, email, password(hash), role(student|faculty)
- **Semester**: name (Sem 1..Sem 7), order
- **Subject**: name, semesterId
- **Chapter**: name, subjectId
- **Question**: chapterId, text, options[], correctOptionIndex, marks, difficulty
- **Attempt**: studentId, chapterId, score, total, timeTaken, answers[], createdAt

## 5. Key API Endpoints
- `POST /api/auth/register`, `POST /api/auth/login`
- `GET /api/semesters`
- `GET /api/subjects?semesterId=`
- `GET /api/chapters?subjectId=`
- `GET /api/questions?chapterId=`
- `POST /api/attempts` — submit quiz, server computes score
- `GET /api/attempts/me` — student performance history
- Faculty CRUD: `/api/faculty/semesters`, `/api/faculty/subjects`, `/api/faculty/chapters`, `/api/faculty/questions`

## 6. Quiz Scoring Rule
Scoring is always computed server-side from stored correct answers — client never trusts its own score to prevent tampering.

## 7. Tech Stack Versions (target)
- React 18, Vite 5, react-router-dom 6
- Node 18+, Express 4
- MongoDB 7, Mongoose 8
- Recharts (for analytics charts)
