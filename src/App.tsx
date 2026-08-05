import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuthStore } from "./state/authStore";
import { AuthPage } from "./auth/AuthPage";
import { AppShell } from "./components/AppShell";
import { BankPage } from "./features/questions/BankPage";
import { StudySetupPage } from "./features/study-setup/StudySetupPage";
import { StudySessionPage } from "./features/study-session/StudySessionPage";
import { SessionSummaryPage } from "./features/study-session/SessionSummaryPage";
import { StatsPage } from "./features/stats/StatsPage";
import { ImportPage } from "./features/import/ImportPage";
import { useResumeSession } from "./features/study-session/useResumeSession";
import { useSyncEngine } from "./sync/useSyncEngine";

function AuthedApp() {
  useSyncEngine();
  useResumeSession();
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/bank" replace />} />
        <Route path="/bank" element={<BankPage />} />
        <Route path="/study" element={<StudySetupPage />} />
        <Route path="/study/session" element={<StudySessionPage />} />
        <Route path="/study/summary/:sessionId" element={<SessionSummaryPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="*" element={<Navigate to="/bank" replace />} />
      </Route>
    </Routes>
  );
}

function App() {
  const { session, isLocalOnly, initializing, init } = useAuthStore();

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (initializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    );
  }

  if (!session && !isLocalOnly) return <AuthPage />;

  return <AuthedApp />;
}

export default App;
