import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "../state/authStore";
import { useUiStore } from "../state/uiStore";
import { useStudySessionStore } from "../state/studySessionStore";
import { SyncIndicator } from "./SyncIndicator";

const navItems = [
  { to: "/bank", label: "Question Bank" },
  { to: "/study", label: "Study" },
  { to: "/stats", label: "Stats" },
  { to: "/import", label: "Import" },
];

export function AppShell() {
  const signOut = useAuthStore((s) => s.signOut);
  const { theme, toggleTheme } = useUiStore();
  const { session, questions, currentIndex } = useStudySessionStore();
  const location = useLocation();

  const showResumeBanner = session && !session.completedAt && location.pathname !== "/study/session";

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-3 py-2.5 sm:px-4 sm:py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="shrink-0 text-lg font-semibold">Recall</span>
            <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
              <SyncIndicator />
              <button
                onClick={toggleTheme}
                aria-label="Toggle night mode"
                className="shrink-0 rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                {theme === "dark" ? "☀️" : "🌙"}
              </button>
              <button
                onClick={() => signOut()}
                className="shrink-0 rounded-lg px-2 py-1.5 text-sm text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 sm:px-3"
              >
                Sign out
              </button>
            </div>
          </div>

          <nav className="-mx-3 flex gap-1 overflow-x-auto px-3 sm:mx-0 sm:px-0">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    isActive
                      ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                      : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      {showResumeBanner && (
        <div className="border-b border-indigo-100 bg-indigo-50 dark:border-indigo-900 dark:bg-indigo-950">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2">
            <span className="text-sm text-indigo-700 dark:text-indigo-300">
              Study session in progress — question {currentIndex + 1} of {questions.length}
            </span>
            <Link
              to="/study/session"
              className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700"
            >
              Resume
            </Link>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
