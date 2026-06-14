import { useEffect } from "react";

export function useTheme() {
  useEffect(() => {
    document.documentElement.classList.remove("dark");
    try { localStorage.setItem("theme", "light"); } catch {}
  }, []);

  return { theme: "light" as const, toggle: () => {} };
}
