import { createContext, useContext, useEffect, useState } from "react";
import apiClient from "../api/apiClient";

const AuthContext = createContext(null);

const STORAGE_KEY = "smartquiz_user";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setUser(JSON.parse(stored));
    }
    setLoading(false);
  }, []);

  async function login(email, password, role) {
    try {
      const response = await apiClient.post('/auth/login', { email, password, role });
      const userData = response.data;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
      setUser(userData);
      return userData;
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to login. Check your credentials.';
      throw new Error(msg);
    }
  }

  async function register(name, email, password, role, department, semesterId, departments) {
    try {
      const response = await apiClient.post('/auth/register', { name, email, password, role, department, semesterId, departments });
      const userData = response.data;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
      setUser(userData);
      return userData;
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to register. Please try again.';
      throw new Error(msg);
    }
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

