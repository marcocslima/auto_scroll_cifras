
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../firebase/config';
import { collection, getDocs, query, where, doc, updateDoc, onSnapshot, orderBy, addDoc, deleteDoc } from 'firebase/firestore';
import BulkUpload from '../../components/BulkUpload';
// Import the centralized parser functions
import { parseMarkdownToSong, convertSongToMarkdown } from '../../utils/markdownParser';


const Dashboard = () => {
  // State for form
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [tone, setTone] = useState('');
  const [markdownContent, setMarkdownContent] = useState(''); // New state for markdown
  const [manualLyrics, setManualLyrics] = useState(''); // State for manual lyrics input

  // State for song list and control
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingSongId, setEditingSongId] = useState(null);

  // New state for lyric fetching
  const [isFetchingLyrics, setIsFetchingLyrics] = useState(false);
  const [fetchingProgress, setFetchingProgress] = useState('');


  const navigate = useNavigate();

  // Fetch songs in real-time
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

  // Reset form and exit edit mode
  const resetForm = () => {
    setTitle('');
    setArtist('');
    setTone('');
    setMarkdownContent('');
    setManualLyrics(''); // Reset manual lyrics
    setEditingSongId(null);
  };

  // Prepare form for editing
  const handleEdit = (song) => {
    setEditingSongId(song.id);
    setTitle(song.title);
    setArtist(song.artist);
    setTone(song.tone);
    setManualLyrics(song.lyrics || ''); // Populate manual lyrics field
    const markdown = convertSongToMarkdown(song);
    setMarkdownContent(markdown);
  };

  // Save new song or update existing one
  const handleSave = async (e) => {
    e.preventDefault();

    // Use the centralized parser
    const parsedData = parseMarkdownToSong(markdownContent);
    
    const finalTitle = parsedData.title || title;
    const finalArtist = parsedData.artist || artist;
    const finalTone = parsedData.tone || tone;

    if (!finalTitle || !finalArtist || !finalTone || !parsedData.chords || parsedData.chords.length === 0) {
      alert('Por favor, preencha o Tom e a Cifra em formato Markdown (com Título, Artista e Tom).');
      return;
    }
    
    const songData = { 
      title: finalTitle, 
      artist: finalArtist, 
      tone: finalTone, 
      chords: parsedData.chords,
      lyrics: manualLyrics || (editingSongId ? songs.find(s=>s.id === editingSongId).lyrics : null), // Keep existing lyrics if not manually changed
      firstLyricLine: manualLyrics ? getFirstLine(manualLyrics) : (editingSongId ? songs.find(s=>s.id === editingSongId).firstLyricLine : null)
    };

    try {
      if (editingSongId) {
        const songDoc = doc(db, 'songs', editingSongId);
        await updateDoc(songDoc, songData);
      } else {
        await addDoc(collection(db, 'songs'), songData);
      }
      resetForm();
    } catch (err) {
      console.error('Erro ao salvar:', err);
      alert('Ocorreu um erro ao salvar a música.');
    }
  };

  // Delete a song
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

  // --- START: FUNCTIONALITY TO FETCH LYRICS ---

  const getFirstLine = (lyrics) => {
      if (!lyrics) return "";
      const lines = lyrics.trim().split('\n');
      for (const line of lines) {
          if (line.trim()) return line.trim();
      }
      return "";
  };

  const handleFetchMissingLyrics = async () => {
      setIsFetchingLyrics(true);
      setFetchingProgress('Buscando músicas sem letra...');

      const songsRef = collection(db, 'songs');
      const querySnapshot = await getDocs(songsRef);
      
      const songsToUpdate = [];
      querySnapshot.forEach(doc => {
          const data = doc.data();
          if (!data.lyrics) {
              songsToUpdate.push({ id: doc.id, ...data });
          }
      });

      if (songsToUpdate.length === 0) {
          setFetchingProgress('Todas as músicas já possuem letra!');
          setTimeout(() => {
              setIsFetchingLyrics(false);
              setFetchingProgress('');
          }, 3000);
          return;
      }

      if (!window.confirm(`Encontradas ${songsToUpdate.length} músicas sem letra. Deseja buscar e atualizar todas agora?`)) {
          setIsFetchingLyrics(false);
          return;
      }

      let successCount = 0;
      let errorCount = 0;
      
      for (let i = 0; i < songsToUpdate.length; i++) {
          const song = songsToUpdate[i];
          const progressMsg = `(${i + 1}/${songsToUpdate.length}) Buscando: ${song.title}...`;
          setFetchingProgress(progressMsg);

          try {
              const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(song.artist)}/${encodeURIComponent(song.title)}`;
              const response = await fetch(url);

              if (response.ok) {
                  const data = await response.json();
                  const lyrics = data.lyrics;

                  if (lyrics) {
                      const firstLyricLine = getFirstLine(lyrics);
                      const songDocRef = doc(db, 'songs', song.id);
                      await updateDoc(songDocRef, {
                          lyrics,
                          firstLyricLine
                      });
                      successCount++;
                  } else {
                      errorCount++;
                  }
              } else {
                  errorCount++;
              }
          } catch (err) {
              errorCount++;
              console.error(`Erro crítico ao processar "${song.title}":`, err);
          }
      }

      setFetchingProgress(`Concluído! ${successCount} letras atualizadas, ${errorCount} falhas.`);
      setTimeout(() => {
          setIsFetchingLyrics(false);
          setFetchingProgress('');
      }, 5000);
  };
  // --- END: FUNCTIONALITY TO FETCH LYRICS ---

  // When editing, populate markdown field if empty from other fields
  useEffect(() => {
    if (!markdownContent && title && artist) {
        const placeholderMarkdown = `# ${title}\n## ${artist}\n\n\`\`\`text\n[Acorde] Letra da música...\n\`\`\``;
        setMarkdownContent(placeholderMarkdown);
    }
  }, [title, artist]);


  return (
    <div className="bg-gray-900 text-white min-h-screen">
      <header className="bg-gray-800 p-4 flex justify-between items-center shadow-md">
        <h1 className="text-xl font-bold">Painel de Administração</h1>
        <button onClick={handleLogout} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
          Sair
        </button>
      </header>
      
      <main className="p-8">
        {/* Form to Add/Edit Song */}
        <div className="max-w-4xl mx-auto mb-10">
          <div className="bg-gray-800 p-8 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold mb-6">{editingSongId ? 'Editando Música' : 'Adicionar Nova Música'}</h2>
            <form onSubmit={handleSave}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium mb-2">Título (Opcional, se no Markdown)</label>
                  <input type="text" id="title" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg" />
                </div>
                <div>
                  <label htmlFor="artist" className="block text-sm font-medium mb-2">Artista (Opcional, se no Markdown)</label>
                  <input type="text" id="artist" value={artist} onChange={(e) => setArtist(e.target.value)} className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg" />
                </div>
                <div>
                  <label htmlFor="tone" className="block text-sm font-medium mb-2">Tom (Opcional, se no Markdown)</label>
                  <input type="text" id="tone" value={tone} onChange={(e) => setTone(e.target.value)} className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg" />
                </div>
              </div>
              <div className="mb-6">
                <label htmlFor="markdownContent" className="block text-sm font-medium mb-2">Cifra (Formato Markdown)</label>
                <textarea 
                  id="markdownContent" 
                  value={markdownContent} 
                  onChange={(e) => setMarkdownContent(e.target.value)} 
                  rows="15" 
                  className="w-full bg-gray-700 text-white font-mono px-3 py-2 rounded-lg" 
                  placeholder={
`# Título da Música
## Nome do Artista
Tom: G

\`\`\`text
[Intro]
[Am] Letra da primeira linha
[C] Letra da segunda linha
...
\`\`\``
                  } 
                  required
                ></textarea>
              </div>

              {/* Manual Lyrics Input - visible only when editing */}
              {editingSongId && (
                  <div className="mb-6">
                      <label htmlFor="manualLyrics" className="block text-sm font-medium mb-2">
                          Letra Pura (Manual)
                          <span className="text-gray-400 text-xs ml-2">Preencha se a busca automática falhou ou para corrigir a letra.</span>
                      </label>
                      <textarea 
                          id="manualLyrics" 
                          value={manualLyrics} 
                          onChange={(e) => setManualLyrics(e.target.value)} 
                          rows="15" 
                          className="w-full bg-gray-700 text-white font-mono px-3 py-2 rounded-lg" 
                          placeholder="Cole aqui a letra pura da música, sem cifras..."
                      ></textarea>
                  </div>
              )}

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
        
        {/* Bulk Upload Component */}
        <div className="max-w-4xl mx-auto mb-10">
            <BulkUpload db={db} />
        </div>

        {/* List of Saved Songs */}
        <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Músicas Salvas</h2>
                <div className='flex items-center gap-4'>
                    {isFetchingLyrics && <p className='text-sm text-gray-400'>{fetchingProgress}</p>}
                    <button 
                        onClick={handleFetchMissingLyrics}
                        disabled={isFetchingLyrics}
                        className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
                    >
                        {isFetchingLyrics ? 'Buscando...' : 'Buscar Letras Faltantes'}
                    </button>
                </div>
            </div>
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
