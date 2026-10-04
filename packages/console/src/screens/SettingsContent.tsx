// ---
// relationships:
//   implements: operator-console
// ---
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, Outlet } from "@tanstack/react-router";
import { Button } from "../ui/button.tsx";
import { settingsTabs } from "../shell/navigation.ts";
export function SettingsContent() {
  return (
    <>
      <nav aria-label="Settings" className="tabs">
        {settingsTabs.map((tab) => (
          <Link
            key={tab.path}
            to={tab.path}
            activeProps={{ className: "active", "aria-current": "page" }}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      <Outlet />
    </>
  );
}
export function GeneralContent() {
  const [token, setToken] = useState("");
  const [configured, setConfigured] = useState(() =>
    Boolean(localStorage.getItem("manifold.operatorToken")),
  );
  const client = useQueryClient();
  const [message, setMessage] = useState("");
  return (
    <section className="general-settings">
      <h2>General</h2>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          localStorage.setItem("manifold.operatorToken", token);
          setToken("");
          setConfigured(true);
          setMessage("Operator token saved.");
          client.removeQueries({ queryKey: ["actors"] });
        }}
      >
        <label htmlFor="operator-token">Operator token</label>
        <input
          id="operator-token"
          type="password"
          autoComplete="off"
          value={token}
          placeholder={configured ? "A token is set" : "Enter operator token"}
          onChange={(event) => setToken(event.target.value)}
        />
        <div className="form-actions">
          <Button type="submit" disabled={!token}>
            Save
          </Button>
          {configured ? (
            <Button
              variant="destructive-outline"
              onClick={() => {
                localStorage.removeItem("manifold.operatorToken");
                setToken("");
                setConfigured(false);
                setMessage("Operator token forgotten.");
                client.removeQueries({ queryKey: ["actors"] });
              }}
            >
              Forget
            </Button>
          ) : null}
        </div>
        <p role="status" className="muted">
          {message}
        </p>
      </form>
    </section>
  );
}
