import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext(null);

const STORAGE_KEY = "testly_theme";
const FONT_SIZE_KEY = "smartquiz_font_size";
const READING_FONT_KEY = "smartquiz_reading_font";

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem(STORAGE_KEY) || "light");
  const [fontSize, setFontSize] = useState(() => localStorage.getItem(FONT_SIZE_KEY) || "normal");
  const [readingFont, setReadingFont] = useState(() => localStorage.getItem(READING_FONT_KEY) === "true");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute("data-font-size", fontSize);
    localStorage.setItem(FONT_SIZE_KEY, fontSize);
  }, [fontSize]);

  useEffect(() => {
    document.documentElement.setAttribute("data-reading-font", String(readingFont));
    localStorage.setItem(READING_FONT_KEY, String(readingFont));
  }, [readingFont]);

  function toggleTheme() {
    setTheme((t) => (t === "light" ? "dark" : "light"));
  }

  function toggleFontSize() {
    setFontSize((s) => (s === "normal" ? "large" : "normal"));
  }

  function toggleReadingFont() {
    setReadingFont((r) => !r);
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, fontSize, toggleFontSize, readingFont, toggleReadingFont }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
