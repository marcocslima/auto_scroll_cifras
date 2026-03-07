
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../firebase/config';
import { collection, addDoc, onSnapshot, query, orderBy, doc, deleteDoc } from 'firebase/firestore';

const Dashboard = () => {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [tone, setTone] = useState('');
  const [chords, setChords] = useState('');
  
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    const q = query(collection(db, 'songs'), orderBy('title'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const songsData = [];
      querySnapshot.forEach((doc) => {
        songsData.push({ id: doc.id, ...doc.data() });
      });
      setSongs(songsData);
      setLoading(false);
    }, (err) => {
      console.error('Firebase read error:', err);
      setError('Falha ao carregar as músicas.');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate('/admin/login');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!title || !artist || !tone || !chords) {
      alert('Por favor, preencha todos os campos.');
      return;
    }
    try {
      await addDoc(collection(db, 'songs'), { title, artist, tone, chords });
      setTitle('');
      setArtist('');
      setTone('');
      setChords('');
    } catch (err) {
      console.error('Erro ao salvar a música:', err);
      alert('Ocorreu um erro ao salvar a música.');
    }
  };

  const handleDelete = async (songId) => {
    if (window.confirm('Tem certeza que deseja excluir esta música?')) {
      try {
        await deleteDoc(doc(db, 'songs', songId));
      } catch (err) {
        console.error('Erro ao excluir a música:', err);
        alert('Ocorreu um erro ao excluir a música.');
      }
    }
  };

  return (
    <div className="bg-gray-900 text-white min-h-screen">
      <header className="bg-gray-800 p-4 flex justify-between items-center shadow-md">
        <h1 className="text-xl font-bold">Painel de Administração</h1>
        <button onClick={handleLogout} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
          Sair
        </button>
      </header>
      
      <main className="p-8">
        <div className="max-w-4xl mx-auto mb-10">
          <div className="bg-gray-800 p-8 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold mb-6">Adicionar Nova Música</h2>
            <form onSubmit={handleSave}>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium mb-2">Título</label>
                  <input type="text" id="title" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg" required />
                </div>
                <div>
                  <label htmlFor="artist" className="block text-sm font-medium mb-2">Artista</label>
                  <input type="text" id="artist" value={artist} onChange={(e) => setArtist(e.target.value)} className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg" required />
                </div>
                <div>
                  <label htmlFor="tone" className="block text-sm font-medium mb-2">Tom</label>
                  <input type="text" id="tone" value={tone} onChange={(e) => setTone(e.target.value)} className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg" required />
                </div>
              </div>
              <div className="mb-6">
                <label htmlFor="chords" className="block text-sm font-medium mb-2">Cifra</label>
                <textarea id="chords" value={chords} onChange={(e) => setChords(e.target.value)} rows="15" className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg" placeholder='Ex: [ { "chord": "Am", "lyric": "Letra da música" } ]' required></textarea>
              </div>
              <div className="text-right">
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition-colors">
                  Salvar Música
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold mb-6">Músicas Salvas</h2>
          <div className="bg-gray-800 p-8 rounded-lg shadow-lg">
            {loading && <p>Carregando músicas...</p>}
            {error && <p className='text-red-500'>{error}</p>}
            {!loading && !error && (
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="p-3">Título</th>
                    <th className="p-3">Artista</th>
                    <th className="p-3">Tom</th>
                    <th className="p-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {songs.map((song) => (
                    <tr key={song.id} className="hover:bg-gray-700">
                      <td className="p-3">{song.title}</td>
                      <td className="p-3">{song.artist}</td>
                      <td className="p-3">{song.tone}</td>
                      <td className="p-3">
                        <button className="text-blue-400 hover:text-blue-300 mr-4">Editar</button>
                        <button onClick={() => handleDelete(song.id)} className="text-red-400 hover:text-red-300">Excluir</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
             {songs.length === 0 && !loading && <p className="text-center mt-4">Nenhuma música cadastrada ainda.</p>}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
