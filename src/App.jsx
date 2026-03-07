
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Library from './pages/Library';
import Song from './pages/Song';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Library />} />
        <Route path="/song/:id" element={<Song />} />
      </Routes>
    </Router>
  );
}

export default App;
