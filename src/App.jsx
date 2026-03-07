
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Library from './pages/Library';
import Song from './pages/Song';
import Login from './pages/admin/Login';
import Dashboard from './pages/admin/Dashboard';

function App() {
  return (
    <Router>
      <Routes>
        {/* Rotas Públicas */}
        <Route path="/" element={<Library />} />
        <Route path="/song/:id" element={<Song />} />

        {/* Rotas de Administração */}
        <Route path="/admin/login" element={<Login />} />
        <Route path="/admin/dashboard" element={<Dashboard />} />

      </Routes>
    </Router>
  );
}

export default App;
