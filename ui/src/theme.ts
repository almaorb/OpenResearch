import { useSyncExternalStore } from "react";
import { getAlmaTheme, readAlmaBus, type AlmaTheme } from "./api";

/** `editor` wears the Alma IDE's own theme; it is offered inside the IDE only. */
export type ThemePreference = "system" | "light" | "dark" | "editor";

const STORAGE_KEY = "orx:theme";
/** The last theme the editor handed over, so a reload paints it before asking again. */
const EDITOR_THEME_KEY = "orx:editor-theme";
const EDITOR_POLL_MS = 1_500;

function readStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system" || stored === "editor") {
      return stored;
    }
  } catch {
    // localStorage may be unavailable (private mode, etc.); fall back to system.
  }
  return "system";
}

function readStoredEditorTheme(): AlmaTheme | null {
  try {
    const stored = localStorage.getItem(EDITOR_THEME_KEY);
    if (!stored) return null;
    const parsed: unknown = JSON.parse(stored);
    if (parsed && typeof parsed === "object" && "colors" in parsed && "appearance" in parsed) {
      return parsed as AlmaTheme;
    }
  } catch {
    // A stale or unreadable copy only means the first paint is the built-in palette.
  }
  return null;
}

let preference: ThemePreference = readStoredPreference();
let editorTheme: AlmaTheme | null = readStoredEditorTheme();
/** Whether this dashboard is inside the Alma IDE; set once the runtime says so. */
let editorAvailable = false;
let editorPoll: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function resolveTheme(pref: ThemePreference): "light" | "dark" {
  if (pref === "editor") return editorTheme?.appearance ?? "dark";
  if (pref !== "system") return pref;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/** The variable names theme.css declares; anything else the editor sends is ignored. */
const EDITOR_VARIABLES = new Set([
  "base", "canvas", "panel", "surface", "surface-bright", "highlight", "chat-annotation-highlight",
  "text", "subtext", "muted", "primary", "primary-subtle", "border", "border-variant",
  "accent-orange", "accent-red", "accent-teal", "accent-blue", "accent-amber", "accent-green", "accent-purple",
  "accent-green-subtle", "accent-amber-subtle", "accent-teal-subtle", "accent-red-subtle", "accent-blue-subtle",
  "accent-purple-subtle", "skill-blue", "skill-blue-subtle", "skill-blue-slash", "dots-muted", "dots-strong",
  "term-bg", "term-foreground", "term-selection", "editor-selection",
  "syntax-comment", "syntax-text", "syntax-red", "syntax-orange", "syntax-green", "syntax-yellow",
  "syntax-cyan", "syntax-purple", "syntax-blue",
]);

// The editor's palette goes on the root element's inline style, above both
// stylesheets' `:root` blocks, and comes off again when another preference
// is chosen so the built-in palette shows through.
function applyResolvedTheme(): void {
  const root = document.documentElement;
  root.dataset.theme = resolveTheme(preference);
  const wearing = preference === "editor" ? editorTheme : null;
  for (const name of EDITOR_VARIABLES) {
    const value = wearing?.colors[name];
    if (value) root.style.setProperty(`--${name}`, value);
    else root.style.removeProperty(`--${name}`);
  }
  if (wearing) {
    root.style.setProperty("--sans", `"${wearing.fonts.sans}", -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif`);
    root.style.setProperty("--mono", `"${wearing.fonts.mono}", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`);
  } else {
    root.style.removeProperty("--sans");
    root.style.removeProperty("--mono");
  }
}

async function fetchEditorTheme(): Promise<void> {
  try {
    const reply = await getAlmaTheme();
    if (!reply.ok) return;
    editorTheme = reply;
    try {
      localStorage.setItem(EDITOR_THEME_KEY, JSON.stringify(reply));
    } catch {
      // Non-fatal: the next load asks the editor again before its first paint.
    }
    if (preference === "editor") {
      applyResolvedTheme();
      for (const listener of listeners) listener();
    }
  } catch {
    // The editor answers the next poll; the last theme stays on until then.
  }
}

// A theme change in the editor is one bus line; polling the bus is what the
// orb's transcript already does, so the page notices within a beat.
function startEditorPoll(): void {
  if (editorPoll) return;
  let cursor = 0;
  void fetchEditorTheme();
  editorPoll = setInterval(() => {
    void (async () => {
      try {
        const reply = await readAlmaBus(cursor);
        if (!reply.ok) return;
        const first = cursor === 0;
        cursor = reply.next_since;
        if (first) return;
        const changed = reply.events.some(
          (event) => event.source === "editor" && event.text.startsWith("theme changed"),
        );
        if (changed) await fetchEditorTheme();
      } catch {
        // Missing one poll only delays the change by a beat.
      }
    })();
  }, EDITOR_POLL_MS);
}

function stopEditorPoll(): void {
  if (!editorPoll) return;
  clearInterval(editorPoll);
  editorPoll = null;
}

/**
 * Called once the runtime says this orx was started by the Alma IDE. With
 * nothing chosen yet the dashboard wears the editor's theme from then on;
 * a preference a person picked is kept.
 */
export function setEditorThemeAvailable(available: boolean): void {
  if (editorAvailable === available) return;
  editorAvailable = available;
  if (available) {
    let chosen: string | null = null;
    try {
      chosen = localStorage.getItem(STORAGE_KEY);
    } catch {
      // Treated as nothing chosen.
    }
    if (chosen === null) {
      preference = "editor";
      applyResolvedTheme();
    }
  } else if (preference === "editor") {
    preference = "system";
    applyResolvedTheme();
  }
  syncEditorPoll();
  for (const listener of listeners) listener();
}

export function isEditorThemeAvailable(): boolean {
  return editorAvailable;
}

function syncEditorPoll(): void {
  if (editorAvailable && preference === "editor") startEditorPoll();
  else stopEditorPoll();
}

export function setThemePreference(next: ThemePreference): void {
  preference = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Non-fatal: the in-memory preference still applies for this session.
  }
  applyResolvedTheme();
  syncEditorPoll();
  for (const listener of listeners) listener();
}

export function getThemePreference(): ThemePreference {
  return preference;
}

/** The preference as another orx can take it: the editor's theme becomes its appearance. */
export function getPortableThemePreference(): "system" | "light" | "dark" {
  return preference === "editor" ? resolveTheme(preference) : preference;
}

// Keep "system" mode in sync when the OS theme flips while the app is open,
// regardless of which view is mounted.
window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", () => {
    if (preference === "system") applyResolvedTheme();
  });

// The inline script in index.html sets the initial data-theme before paint;
// re-assert it here in case that script was blocked.
applyResolvedTheme();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** What the preference comes to on screen, for components that only know light from dark. */
export function useResolvedTheme(): "light" | "dark" {
  const resolved = () => resolveTheme(preference);
  return useSyncExternalStore(subscribe, resolved, resolved);
}

/** Whether the editor's theme is on offer: true inside the Alma IDE. */
export function useEditorThemeAvailable(): boolean {
  return useSyncExternalStore(subscribe, isEditorThemeAvailable, isEditorThemeAvailable);
}

/** Current theme preference, reflected on <html data-theme> and persisted. */
export function useThemePreference(): [
  ThemePreference,
  (next: ThemePreference) => void,
] {
  const value = useSyncExternalStore(
    subscribe,
    () => preference,
    () => preference,
  );
  return [value, setThemePreference];
}
