# SmartQuiz — Product Requirements Document (PRD)

## 1. Overview
SmartQuiz is a web-based online quiz and assessment platform for interactive learning and evaluation. It supports semester-wise, subject-wise, and chapter-wise quizzes for students, with instant scoring and performance analytics. Faculty can create and manage quiz content.

## 2. Goals
- Let students practice/take quizzes organized by Semester → Subject → Chapter.
- Give instant results and performance analytics after every quiz attempt.
- Let faculty create, edit, and manage quiz questions easily.
- Deliver a fast, responsive, attractive, and accessible UI.

## 3. User Roles
### 3.1 Student
- Register / Login.
- Select Semester (Sem 1–Sem 7).
- Select Subject (filtered by chosen semester).
- Select Chapter within subject.
- Attempt a timer-based quiz.
- View instant result (score, correct/wrong, time taken).
- View performance analytics/history (past attempts, accuracy trend, weak chapters).

### 3.2 Faculty
- Register / Login.
- Create/Edit/Delete Semesters, Subjects, Chapters.
- Create/Edit/Delete Quiz Questions (with options, correct answer, marks, time limit).
- View student performance reports (per subject/chapter/student).

## 4. Core Features
1. **Auth** — Separate login/register flow for Student and Faculty, role-based redirect.
2. **Semester → Subject → Chapter navigation** — drill-down selection UI.
3. **Timer-based quiz engine** — countdown per quiz/question, auto-submit on timeout.
4. **Instant result generation** — score, percentage, correct/incorrect breakdown shown right after submission.
5. **Performance analytics** — dashboard with charts (score trend, subject-wise accuracy, attempt history).
6. **Faculty quiz management (CMS)** — CRUD for semesters/subjects/chapters/questions.
7. **Responsive design** — works on mobile, tablet, desktop.

## 5. Non-Functional Requirements
- Fast load (Vite-based React SPA).
- Secure auth (JWT-based sessions, hashed passwords).
- Data integrity (validated quiz attempts, no re-scoring tampering from client).
- Scalable schema to add new semesters/subjects/chapters without code changes.

## 6. Out of Scope (v1)
- Payments / subscriptions.
- Proctoring / anti-cheating webcam monitoring.
- Native mobile apps.

## 7. Success Metrics
- Quiz completion rate.
- Average score improvement across attempts.
- Faculty content creation turnaround time.
