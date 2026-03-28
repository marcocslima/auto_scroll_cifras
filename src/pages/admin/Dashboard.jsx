
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../firebase/config';
import { collection, addDoc, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import BulkUpload from '../../components/BulkUpload';

// Helper function to parse Markdown input into a song object
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
      // Regex to capture a chord in brackets and the rest as the lyric
      const match = line.match(/^\s*(?:\[(.*?)\])?\s*(.*)/);
      if (match) {
        lyrics.push({
          chord: match[1] || '', // Chord (e.g., "Am") or empty string
          lyric: match[2] || '', // Lyric
        });
      }
    }
  }

  // Fallback if title/artist not in markdown
  return { title, artist, lyrics };
};


// Helper function to convert a song object back to Markdown for editing
const convertSongToMarkdown = (song) => {
    if (!song || !song.title) return '';

    const title = `# ${song.title}`;
    const artist = `## ${song.artist}`;
    
    let lyrics_array = [];
    // The 'chords' field might be an array (new format) or a JSON string (old format)
    if (Array.isArray(song.chords)) {
        lyrics_array = song.chords;
    } else if (typeof song.chords === 'string') {
        try {
            // It might be a JSON string of the array of lyrics
            const parsed = JSON.parse(song.chords);
            // The old format might have been an array within an array
            if(Array.isArray(parsed) && Array.isArray(parsed[0])) {
                lyrics_array = parsed[0];
            } else if (Array.isArray(parsed)) {
                lyrics_array = parsed;
            }
        } catch (e) {
            // If it's not valid JSON, we can't do much.
            console.error("Could not parse 'chords' string to JSON:", song.chords);
            return `${title}\n${artist}\n\n\`\`\`text\n[ERRO AO LER CIFRA ANTIGA]\n\`\`\``;
        }
    }

    const lyricsContent = lyrics_array.map(line => {
        return line.chord ? `[${line.chord}] ${line.lyric}` : line.lyric;
    }).join('\n');

    return `${title}\n${artist}\n\n\`\`\`text\n${lyricsContent}\n\`\`\``;
};


const Dashboard = () => {
  // State for form
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [tone, setTone] = useState('');
  const [markdownContent, setMarkdownContent] = useState(''); // New state for markdown

  // State for song list and control
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingSongId, setEditingSongId] = useState(null);

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
    setEditingSongId(null);
  };

  // Prepare form for editing
  const handleEdit = (song) => {
    setEditingSongId(song.id);
    setTitle(song.title);
    setArtist(song.artist);
    setTone(song.tone);
    // Convert the song's lyrics array back to a markdown string
    const markdown = convertSongToMarkdown(song);
    setMarkdownContent(markdown);
  };

  // Save new song or update existing one
  const handleSave = async (e) => {
    e.preventDefault();

    // Parse the markdown content
    const parsedData = parseMarkdownToSong(markdownContent);
    
    // Use title/artist from markdown if available, otherwise use the input fields
    const finalTitle = parsedData.title || title;
    const finalArtist = parsedData.artist || artist;

    if (!finalTitle || !finalArtist || !tone || parsedData.lyrics.length === 0) {
      alert('Por favor, preencha o Tom e a Cifra em formato Markdown (com Título e Artista).');
      return;
    }
    
    // The 'chords' field in Firestore will store the parsed lyrics array
    const songData = { title: finalTitle, artist: finalArtist, tone, chords: parsedData.lyrics };

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
                  <label htmlFor="tone" className="block text-sm font-medium mb-2">Tom</label>
                  <input type="text" id="tone" value={tone} onChange={(e) => setTone(e.target.value)} className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg" required />
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

\`\`\`text
[Am] Letra da primeira linha
[C] Letra da segunda linha
...
\`\`\``
                  } 
                  required
                ></textarea>
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
        
        {/* Bulk Upload Component */}
        <div className="max-w-4xl mx-auto mb-10">
            <BulkUpload />
        </div>

        {/* List of Saved Songs */}
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
