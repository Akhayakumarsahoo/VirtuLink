import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Authentication from "./components/pages/Authentication";
import Home from "./components/pages/Home";
import { AuthProvider } from "./components/contexts/AuthContext";
import LandingPage from "./components/pages/LandingPage";
import Room from "./components/pages/Room";

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<Authentication />} />
          <Route path="/home" element={<Home />} />
          <Route path="/room/:roomId" element={<Room />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
