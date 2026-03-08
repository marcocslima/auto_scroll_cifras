
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../firebase/config';
import { collection, addDoc, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc } from 'firebase/firestore';

const Dashboard = () => {
  // Estado do formulário
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [tone, setTone] = useState('');
  const [chords, setChords] = useState('');
  
  // Estado da lista de músicas e controle
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingSongId, setEditingSongId] = useState(null); // ID da música em edição

  const navigate = useNavigate();

  // Busca músicas em tempo real
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

  // Limpa o formulário e sai do modo de edição
  const resetForm = () => {
    setTitle('');
    setArtist('');
    setTone('');
    setChords('');
    setEditingSongId(null);
  };

  // Prepara o formulário para edição
  const handleEdit = (song) => {
    setEditingSongId(song.id);
    setTitle(song.title);
    setArtist(song.artist);
    setTone(song.tone);
    setChords(song.chords);
  };

  // Salva uma nova música ou atualiza uma existente
  const handleSave = async (e) => {
    e.preventDefault();
    if (!title || !artist || !tone || !chords) {
      alert('Por favor, preencha todos os campos.');
      return;
    }
    
    const songData = { title, artist, tone, chords };

    try {
      if (editingSongId) {
        // Atualiza a música existente
        const songDoc = doc(db, 'songs', editingSongId);
        await updateDoc(songDoc, songData);
      } else {
        // Adiciona uma nova música
        await addDoc(collection(db, 'songs'), songData);
      }
      resetForm();
    } catch (err) {
      console.error('Erro ao salvar:', err);
      alert('Ocorreu um erro ao salvar a música.');
    }
  };

  // Exclui uma música
  const handleDelete = async (songId) => {
    if (window.confirm('Tem certeza que deseja excluir esta música?')) {
      try {
        await deleteDoc(doc(db, 'songs', songId));
      } catch (err) {
        console.error('Erro ao excluir:', err);
        alert('Ocorreu um erro ao excluir a música.');
      }
    }
  };
  
  // Logout
    const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate('/admin/login');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
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
            <h2 className="text-2xl font-bold mb-6">{editingSongId ? 'Editando Música' : 'Adicionar Nova Música'}</h2>
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
                <textarea id="chords" value={chords} onChange={(e) => setChords(e.target.value)} rows="15" className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg" placeholder='Formato: [{"chord":"Am","lyric":"Letra..."}]' required></textarea>
              </div>
              <div className="text-right flex justify-end gap-4">
                {editingSongId && (
                  <button type="button" onClick={resetForm} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-6 rounded-lg transition-colors">
                    Cancelar
                  </button>
                )}
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition-colors">
                  {editingSongId ? 'Atualizar Música' : 'Salvar Música'}
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
              <div className="overflow-x-auto">
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
                        <td className="p-3 flex gap-4">
                          <button onClick={() => handleEdit(song)} className="text-blue-400 hover:text-blue-300">Editar</button>
                          <button onClick={() => handleDelete(song.id)} className="text-red-400 hover:text-red-300">Excluir</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
             {songs.length === 0 && !loading && <p className="text-center mt-4">Nenhuma música cadastrada ainda.</p>}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
