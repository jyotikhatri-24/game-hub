import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { socket } from './socket';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import GameRoom from './pages/GameRoom';
import LocalGameRoom from './pages/LocalGameRoom';
import Leaderboard from './pages/Leaderboard';

function App() {
  useEffect(() => {
    // We attempt to connect if there's a user session
    const user = localStorage.getItem('user');
    if (user) {
      socket.connect();
    }

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/room/:id" element={<GameRoom />} />
        <Route path="/local/:id" element={<LocalGameRoom />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
      </Routes>
    </Router>
  );
}

export default App;
