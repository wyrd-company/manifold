// ---
// relationships:
//   implements: operator-console
// ---
const choice = localStorage.getItem("manifold.theme");
document.documentElement.classList.toggle(
  "dark",
  choice === "dark" || (choice !== "light" && matchMedia("(prefers-color-scheme: dark)").matches),
);
