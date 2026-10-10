// ---
// relationships:
//   implements: operator-console
// ---
import { defineConfig } from "vite-plus";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  base: "/console/",
  plugins: [react(), tailwindcss()],
  build: { emptyOutDir: true },
});
