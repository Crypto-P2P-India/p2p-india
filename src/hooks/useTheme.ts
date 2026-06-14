import { useEffect } from "react";

export function useTheme() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
    try { localStorage.setItem("theme", "dark"); } catch {}
  }, []);

  return { theme: "dark" as const, toggle: () => {} };
}
