// ---
// relationships:
//   implements: operator-console
// ---
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { Button } from "../ui/button.tsx";
import { Kbd } from "../ui/kbd.tsx";
import { Dialog, DialogPopup, DialogTitle, DialogDescription } from "../ui/dialog.tsx";
import { navigation } from "./navigation.ts";
export function CommandSearch() {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState(0);
  const navigate = useNavigate();
  const items = navigation.filter((item) =>
    item.label.toLowerCase().includes(filter.toLowerCase()),
  );
  function choose(path: string) {
    void navigate({ to: path });
    setOpen(false);
  }
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  return (
    <>
      <Button
        variant="ghost"
        aria-label="Search pages"
        onClick={() => {
          setFilter("");
          setSelected(0);
          setOpen(true);
        }}
      >
        <Search />
        <span className="search-label">Search pages</span>
        <Kbd>⌘K</Kbd>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPopup className="command-dialog" bottomStickOnMobile={false}>
          <DialogTitle>Search pages</DialogTitle>
          <DialogDescription>Go to a screen in Manifold.</DialogDescription>
          <input
            aria-label="Search pages"
            autoFocus
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value);
              setSelected(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                setSelected((index) =>
                  items.length
                    ? (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length
                    : 0,
                );
              }
              if (event.key === "Enter" && items[selected]) {
                event.preventDefault();
                choose(items[selected].path);
              }
            }}
          />
          <div className="command-results">
            {items.map((item, index) => (
              <Button
                key={item.path}
                variant="ghost"
                className={selected === index ? "selected" : ""}
                onClick={() => choose(item.path)}
              >
                <item.icon />
                {item.label}
              </Button>
            ))}
            {items.length === 0 ? <p>No matching pages</p> : null}
          </div>
        </DialogPopup>
      </Dialog>
    </>
  );
}
