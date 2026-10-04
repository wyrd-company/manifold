// ---
// relationships:
//   implements: operator-console
// ---
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router } from "./router.tsx";
import "./styles.css";
const client = new QueryClient();
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={client}>
    <RouterProvider router={router} />
  </QueryClientProvider>,
);
