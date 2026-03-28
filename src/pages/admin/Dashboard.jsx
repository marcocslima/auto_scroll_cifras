
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../firebase/config';
import { collection, addDoc, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import BulkUpload from '../../components/BulkUpload';
import ChordEditor from '../../components/ChordEditor';

// Analisa o conteúdo Markdown para extrair título, artista e linhas da cifra
const parseMarkdownToSong = (markdown) => {
  const lines = markdown.split('\n');
  let title = '';
  let artist = '';
  const lyrics = [];
  let isInsideLyricsBlock = false;

  for (const line of lines) {
    if (line.startsWith('# ')) {
      title = line.substring(2).trim();
      continue;
    }
    if (line.startsWith('## ')) {
      artist = line.substring(3).trim();
      continue;
    }
    if (line.trim() === '```text') {
      isInsideLyricsBlock = true;
      continue;
    }
    if (line.trim() === '```') {
      isInsideLyricsBlock = false;
      continue;
    }
    if (isInsideLyricsBlock) {
      const match = line.match(/^\[(.*?)\]\s*(.*)/);
      if (match) {
        lyrics.push({ chord: match[1] || '', lyric: match[2] || '' });
      } else {
        lyrics.push({ chord: '', lyric: line });
      }
    }
  }
  return { title, artist, lyrics };
};

// Converte um objeto de música de volta para o formato Markdown
const convertSongToMarkdown = (song) => {
  if (!song || !song.title) return '';
  const title = `# ${song.title}`;
  const artist = `## ${song.artist}`;
  let lyrics_array = song.chords || [];

  const lyricsContent = lyrics_array.map(line => {
    return line.chord ? `[${line.chord}] ${line.lyric}` : line.lyric;
  }).join('\n');

  return `${title}\n${artist}\n\n\`\`\`text\n${lyricsContent}\n\`\`\``;
};

const Dashboard = () => {
  // Estados do formulário e da UI
  const [tone, setTone] = useState('');
  const [markdownContent, setMarkdownContent] = useState('');
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingSongId, setEditingSongId] = useState(null);
  const navigate = useNavigate();

  // Busca as músicas em tempo real
  useEffect(() => {
    const q = query(collection(db, 'songs'), orderBy('title'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const songsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSongs(songsData);
      setLoading(false);
    }, (err) => {
      console.error('Firebase read error:', err);
      setError('Falha ao carregar as músicas.');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Reseta o formulário
  const resetForm = () => {
    setTone('');
    setMarkdownContent('');
    setEditingSongId(null);
  };

  // Prepara o formulário para edição
  const handleEdit = (song) => {
    setEditingSongId(song.id);
    setTone(song.tone);
    setMarkdownContent(convertSongToMarkdown(song));
  };

  // Salva ou atualiza uma música
  const handleSave = async (e) => {
    e.preventDefault();
    const parsedData = parseMarkdownToSong(markdownContent);

    if (!parsedData.title || !parsedData.artist || !tone || parsedData.lyrics.length === 0) {
      alert('Por favor, preencha o Tom, Título, Artista e a Cifra no editor.');
      return;
    }

    const songData = { 
      title: parsedData.title, 
      artist: parsedData.artist, 
      tone, 
      chords: parsedData.lyrics 
    };

    try {
      if (editingSongId) {
        await updateDoc(doc(db, 'songs', editingSongId), songData);
      } else {
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
              <div className="mb-6">
                <label htmlFor="tone" className="block text-sm font-medium mb-2">Tom</label>
                <input type="text" id="tone" value={tone} onChange={(e) => setTone(e.target.value)} className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg" required />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Editor de Cifra</label>
                <ChordEditor
                  initialContent={markdownContent}
                  onContentChange={setMarkdownContent}
                />
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
        
        <BulkUpload />

        <div className="max-w-4xl mx-auto mt-10">
          <h2 className="text-2xl font-bold mb-6">Músicas Salvas</h2>
          <div className="bg-gray-800 p-8 rounded-lg shadow-lg">
            {loading && <p>Carregando...</p>}
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
            {songs.length === 0 && !loading && <p className="text-center mt-4">Nenhuma música cadastrada.</p>}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
