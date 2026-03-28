
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { SettingsProvider } from './context/SettingsContext'; // Importa o Provedor
import Library from './pages/Library';
import Song from './pages/Song';
import Login from './pages/admin/Login';
import Dashboard from './pages/admin/Dashboard';
import PrivateRoute from './components/PrivateRoute';

function App() {
  return (
    // O SettingsProvider agora envolve toda a aplicação
    <SettingsProvider>
      <Router>
        <Routes>
          {/* Rotas Públicas */}
          <Route path="/" element={<Library />} />
          <Route path="/song/:id" element={<Song />} />

          {/* Rotas de Administração */}
          <Route path="/admin/login" element={<Login />} />
          <Route 
            path="/admin/dashboard"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />

        </Routes>
      </Router>
    </SettingsProvider>
  );
}

export default App;
