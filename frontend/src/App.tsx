import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppShell } from "./layout/AppShell";
import { Dashboard } from "./pages/Dashboard";

function Placeholder({ title }: { title: string }) {
  return (
    <div className="card p-6">
      <div className="text-sm text-zinc-400">{title}</div>
      <div className="text-xl font-semibold mt-1">Work in progress</div>
      <div className="text-zinc-500 mt-2">Qui ci mettiamo roba potente.</div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/workouts" element={<Placeholder title="Allenamenti" />} />
          <Route path="/records" element={<Placeholder title="Record" />} />
          <Route path="/ignored" element={<Placeholder title="Ignored" />} />
          <Route path="/settings" element={<Placeholder title="Settings" />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
