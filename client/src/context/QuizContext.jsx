import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuth } from "./AuthContext";
import apiClient from "../api/apiClient";

const QuizContext = createContext(null);

export function QuizProvider({ children }) {
  const [attempts, setAttempts] = useState([]);
  const { user } = useAuth();

  const fetchAttempts = useCallback(async () => {
    if (!user || user.role !== 'student') {
      setAttempts([]);
      return;
    }
    try {
      const response = await apiClient.get('/attempts/me');
      const mapped = response.data.data.map((att) => ({
        id: att._id,
        chapterName: att.chapterId?.name || "Deleted Chapter",
        subjectName: att.chapterId?.subjectId?.name || "Deleted Subject",
        semesterName: att.chapterId?.subjectId?.semesterId?.name || "Deleted Semester",
        correct: Math.round(att.score / 2), // Assuming 2 marks per question
        total: Math.round(att.total / 2),
        timeTakenSec: att.timeTaken,
        date: att.createdAt,
      }));
      setAttempts(mapped);
    } catch (error) {
      console.error('Error fetching attempts:', error);
    }
  }, [user]);

  useEffect(() => {
    fetchAttempts();
  }, [fetchAttempts]);

  // Keep saveAttempt for compatibility, but we just trigger fetchAttempts to refresh history
  const saveAttempt = useCallback(async () => {
    await fetchAttempts();
  }, [fetchAttempts]);

  return (
    <QuizContext.Provider value={{ attempts, saveAttempt, fetchAttempts }}>
      {children}
    </QuizContext.Provider>
  );
}

export function useQuiz() {
  return useContext(QuizContext);
}

