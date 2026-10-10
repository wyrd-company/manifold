// ---
// relationships:
//   implements: operator-console
// ---
import { useEffect, useState } from "react";
import { Monitor, Sun, Moon } from "lucide-react";
import { Button } from "../ui/button.tsx";
const choices = ["System", "Light", "Dark"] as const;
export function ThemeToggle() {
  const [theme, setTheme] = useState(
    () =>
      choices.find((choice) => choice.toLowerCase() === localStorage.getItem("manifold.theme")) ??
      "System",
  );
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      document.documentElement.classList.toggle(
        "dark",
        theme === "Dark" || (theme === "System" && media.matches),
      );
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  const Icon = theme === "System" ? Monitor : theme === "Light" ? Sun : Moon;
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Theme: ${theme}`}
      onClick={() => {
        const next = choices[(choices.indexOf(theme) + 1) % choices.length]!;
        localStorage.setItem("manifold.theme", next.toLowerCase());
        setTheme(next);
      }}
    >
      <Icon />
    </Button>
  );
}
