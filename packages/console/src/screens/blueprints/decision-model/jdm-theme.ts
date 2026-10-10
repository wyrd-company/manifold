// ---
// relationships:
//   implements: operator-console
// ---
import { useEffect, useState } from "react";
import type { JdmConfigProviderProps } from "@gorules/jdm-editor";
const read = () => {
  const root = document.documentElement,
    style = getComputedStyle(root);
  const token = (name: string) => style.getPropertyValue(`--${name}`).trim();
  return {
    mode: root.classList.contains("dark") ? ("dark" as const) : ("light" as const),
    token: {
      colorPrimary: token("primary"),
      colorBgContainer: token("card"),
      colorBgElevated: token("popover"),
      colorBorder: token("input"),
      colorText: token("foreground"),
      colorTextSecondary: token("muted-foreground"),
      colorError: token("error"),
      colorWarning: token("warning"),
      fontFamily: token("font-sans"),
      fontFamilyCode: token("font-mono"),
      borderRadius: 6,
    },
  } satisfies JdmConfigProviderProps["theme"];
};
export function useJdmTheme() {
  const [theme, setTheme] = useState(read);
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(read()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);
  return theme;
}
