import { Link, Route, Routes } from "react-router-dom";
import { Button } from "./components/Controls";
import { EmptyState, Loading } from "./components/Card";
import { Layout } from "./components/Layout";
import { useAuth } from "./state/auth";
import { LiveProvider } from "./state/live";
import { AuthShell } from "./pages/AuthShell";
import { Login } from "./pages/Login";
import { Setup } from "./pages/Setup";
import { Dashboard } from "./pages/Dashboard";
import { Modules } from "./pages/Modules";
import { Traffic } from "./pages/Traffic";
import { Clients } from "./pages/Clients";
import { Repositories } from "./pages/Repositories";
import { Storage } from "./pages/Storage";
import { Downloads } from "./pages/Downloads";
import { Statistics } from "./pages/Statistics";
import { Policies } from "./pages/Policies";
import { Settings } from "./pages/Settings";
import { Health } from "./pages/Health";

export function App() {
  const { phase, error, refresh } = useAuth();

  if (phase === "loading") {
    return (
      <div className="grid h-full place-items-center">
        <Loading label="Connecting to UniCache…" />
      </div>
    );
  }
  if (phase === "unreachable") {
    return (
      <AuthShell title="Server unreachable">
        <p className="mb-4 text-sm text-muted">{error ?? "The UniCache server did not answer."}</p>
        <Button variant="primary" onClick={() => void refresh()} className="w-full">
          Try again
        </Button>
      </AuthShell>
    );
  }
  if (phase === "setup") return <Setup />;
  if (phase === "login") return <Login />;

  return (
    <LiveProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/modules" element={<Modules />} />
          <Route path="/traffic" element={<Traffic />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/repositories" element={<Repositories />} />
          <Route path="/storage" element={<Storage />} />
          <Route path="/downloads" element={<Downloads />} />
          <Route path="/statistics" element={<Statistics />} />
          <Route path="/policies" element={<Policies />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/health" element={<Health />} />
          <Route
            path="*"
            element={<EmptyState title="Page not found" hint={<Link className="text-info underline" to="/">Back to the dashboard</Link>} />}
          />
        </Routes>
      </Layout>
    </LiveProvider>
  );
}
