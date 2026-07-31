import apiClient from './apiClient';

// Synchronous cache retrieval from localStorage to satisfy the synchronous frontend design
export function findSemester(id) {
  const cached = localStorage.getItem('smartquiz_cached_semesters');
  if (!cached) return null;
  const semesters = JSON.parse(cached);
  return semesters.find((s) => s.id === id);
}

export function findSubject(semesterId, subjectId) {
  const cached = localStorage.getItem('smartquiz_cached_subjects');
  if (!cached) return null;
  const subjects = JSON.parse(cached);
  return subjects.find((s) => s.id === subjectId);
}

// Fetch all semesters from Express API and cache them
export async function getSemesters() {
  try {
    const response = await apiClient.get('/semesters');
    const semesters = response.data.data.map((sem) => ({
      id: sem._id,
      name: sem.name,
      order: sem.order,
    }));
    // Persist in localStorage cache for synchronous queries
    localStorage.setItem('smartquiz_cached_semesters', JSON.stringify(semesters));
    return semesters;
  } catch (error) {
    console.error('Error fetching semesters:', error);
    // Fall back to localStorage if offline or error
    const cached = localStorage.getItem('smartquiz_cached_semesters');
    return cached ? JSON.parse(cached) : [];
  }
}

// Fetch subjects by semester from Express API and cache them
export async function getSubjects(semesterId) {
  try {
    const response = await apiClient.get(`/subjects?semesterId=${semesterId}`);
    const subjects = response.data.data.map((sub) => ({
      id: sub._id,
      name: sub.name,
      semesterId: sub.semesterId._id || sub.semesterId,
    }));
    
    // Merge into local cached subjects list
    const cachedRaw = localStorage.getItem('smartquiz_cached_subjects');
    let allSubjects = cachedRaw ? JSON.parse(cachedRaw) : [];
    // Filter out previous versions of subjects for this semester to prevent duplicates
    allSubjects = allSubjects.filter(sub => sub.semesterId !== semesterId).concat(subjects);
    
    localStorage.setItem('smartquiz_cached_subjects', JSON.stringify(allSubjects));
    return subjects;
  } catch (error) {
    console.error('Error fetching subjects:', error);
    const cachedRaw = localStorage.getItem('smartquiz_cached_subjects');
    const allSubjects = cachedRaw ? JSON.parse(cachedRaw) : [];
    return allSubjects.filter(sub => sub.semesterId === semesterId);
  }
}

// Fetch chapters by subject from Express API
export async function getChapters(subjectId) {
  try {
    const response = await apiClient.get(`/chapters?subjectId=${subjectId}`);
    return response.data.data.map((chap) => ({
      id: chap._id,
      name: chap.name,
      subjectId: chap.subjectId._id || chap.subjectId,
      questionCount: chap.questionCount || 0,
    }));
  } catch (error) {
    console.error('Error fetching chapters:', error);
    return [];
  }
}

// Fetch questions for a quiz by chapter from Express API
export async function getQuestions(chapterId, chapterName) {
  try {
    const response = await apiClient.get(`/questions?chapterId=${chapterId}`);
    return response.data.data.map((q) => ({
      id: q._id,
      text: q.text,
      options: q.options,
      correctIndex: q.correctOptionIndex, // Note: student role response won't have this, which is correct
      marks: q.marks,
      difficulty: q.difficulty
    }));
  } catch (error) {
    console.error('Error fetching questions:', error);
    return [];
  }
}
