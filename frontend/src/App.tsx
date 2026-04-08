import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Chat from "./pages/Chat";
import Sharing from "./pages/Sharing";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/mind/:id/chat" element={<Chat />} />
        <Route path="/mind/:id/sharing" element={<Sharing />} />
      </Routes>
    </Layout>
  );
}
