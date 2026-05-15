import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Chat from "./pages/Chat";
import Sharing from "./pages/Sharing";
import Demo from "./pages/Demo";
import Pitch from "./pages/Pitch";
import Architecture from "./pages/Architecture";
import Developer from "./pages/Developer";
import Docs from "./pages/Docs";
import Access from "./pages/Access";
import Deck from "./pages/Deck";

export default function App() {
  return (
    <Routes>
      {/* /deck is intentionally rendered BARE — no Layout chrome.
          Full-viewport presentation surface for screen recording. */}
      <Route path="/deck" element={<Deck />} />

      {/* Everything else gets the standard Layout (header / footer / nav). */}
      <Route path="*" element={<MainApp />} />
    </Routes>
  );
}

function MainApp() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/demo" element={<Demo />} />
        <Route path="/pitch" element={<Pitch />} />
        <Route path="/architecture" element={<Architecture />} />
        <Route path="/developer" element={<Developer />} />
        <Route path="/docs" element={<Docs />} />
        <Route path="/access/:capId" element={<Access />} />
        <Route path="/mind/:id/chat" element={<Chat />} />
        <Route path="/mind/:id/sharing" element={<Sharing />} />
      </Routes>
    </Layout>
  );
}
