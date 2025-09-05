"use client";

import React, { useState, useEffect } from "react";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const storedTheme = localStorage.getItem("theme") as 'light' | 'dark' | null;
    if (storedTheme) {
      setTheme(storedTheme);
    }
  }, []);

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <>
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="px-4 py-2 rounded-lg border bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 shadow hover:bg-gray-200 dark:hover:bg-gray-700 transition"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? "🌙" : "☀️"}
        </button>
      </div>
      {children}
    </>
  );
}
