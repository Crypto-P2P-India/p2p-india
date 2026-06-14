import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/useTheme";

const ThemeToggle = () => {
  const { theme, toggle } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      className="h-9 w-9"
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4 text-muted-foreground transition-transform hover:text-foreground" />
      ) : (
        <Moon className="h-4 w-4 text-muted-foreground transition-transform hover:text-foreground" />
      )}
    </Button>
  );
};

export default ThemeToggle;
