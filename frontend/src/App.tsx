import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Chat from "./pages/Chat";
import Sharing from "./pages/Sharing";
import Demo from "./pages/Demo";
import Pitch from "./pages/Pitch";
import Developer from "./pages/Developer";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/demo" element={<Demo />} />
        <Route path="/pitch" element={<Pitch />} />
        <Route path="/developer" element={<Developer />} />
        <Route path="/mind/:id/chat" element={<Chat />} />
        <Route path="/mind/:id/sharing" element={<Sharing />} />
      </Routes>
    </Layout>
  );
}
