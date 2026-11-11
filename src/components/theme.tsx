"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !(dark ?? false);
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("theme", next ? "dark" : "light"); } catch {}
  }

  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="btn-secondary fixed bottom-5 right-5 z-50 h-11 w-11 !rounded-full !p-0 text-base shadow-lg"
    >
      {dark === null ? "🌗" : dark ? "🌙" : "☀️"}
    </button>
  );
}
