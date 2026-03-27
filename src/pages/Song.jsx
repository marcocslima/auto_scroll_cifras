
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { useSettings } from '../context/SettingsContext';

const getChordsArray = (chordsData) => {
  if (Array.isArray(chordsData)) return chordsData;
  if (typeof chordsData === 'string') {
    try {
      const parsed = JSON.parse(chordsData);
      if (Array.isArray(parsed) && Array.isArray(parsed[0])) return parsed.flat();
      if (Array.isArray(parsed)) return parsed;
    } catch (e) { console.error("Erro ao parsear acordes:", e); return []; }
  }
  return [];
};

const Song = () => {
  const { id } = useParams();
  const navigate = useNavigate(); // Hook para navegação programática
  const [song, setSong] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const { start, stop, isScrollEnabled, trackingStatus } = useSettings();

  useEffect(() => {
    const fetchSong = async () => {
      setLoading(true);
      try {
        const songDocRef = doc(db, 'songs', id);
        const songSnapshot = await getDoc(songDocRef);
        if (songSnapshot.exists()) {
          const songData = songSnapshot.data();
          setSong({ id: songSnapshot.id, ...songData, chords: getChordsArray(songData.chords) });
        } else { setError('Música não encontrada.'); }
      } catch (err) { setError('Falha ao carregar a música.'); }
      setLoading(false);
    };
    fetchSong();

    // Garante que tudo é desligado quando o usuário sai da página
    return () => stop();
  }, [id, stop]);

  const handleToggleFaceScroll = () => {
    if (isScrollEnabled) {
      stop(); 
    } else {
      start({ scroll: true });
    }
  };

  // ========= NOVA FUNÇÃO PARA NAVEGAÇÃO SEGURA =========
  const handleGoBack = () => {
    // 1. Desliga a câmera e a rolagem para evitar conflitos.
    stop();
    // 2. Navega para a página inicial.
    navigate('/');
  };


  if (loading) return <div className="bg-gray-900 text-white min-h-screen flex items-center justify-center">Carregando...</div>;
  if (error) return <div className="bg-gray-900 text-white min-h-screen flex items-center justify-center">{error}</div>;
  if (!song) return null;

  return (
    <div className="bg-gray-900 text-white min-h-screen font-sans">
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <header className="mb-6 text-center">
           {/* O Link foi substituído por um botão que chama a nova função */}
           <button onClick={handleGoBack} className="text-blue-400 hover:text-blue-300 mb-4 inline-block bg-transparent border-none p-0 cursor-pointer">
             ← Voltar para a Biblioteca
           </button>
          <h1 className="text-4xl md:text-5xl font-bold break-words">{song.title}</h1>
          <p className="text-xl md:text-2xl text-gray-400 mt-2">{song.artist}</p>
          <p className="text-md text-gray-500 mt-1">Tom: {song.tone}</p>
        </header>

        <div className="bg-gray-800 border border-gray-700 rounded-lg mb-6 shadow-lg p-4 space-y-3 max-w-xl mx-auto">
          <button onClick={handleToggleFaceScroll} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors text-lg">
            {isScrollEnabled ? 'Parar Rolagem Facial' : 'Ativar Rolagem Facial'}
          </button>
          <p className="text-sm text-gray-400 h-5 text-center">{isScrollEnabled ? trackingStatus : "Rolagem facial inativa"}</p>
        </div>

        <main className="bg-gray-800 p-4 sm:p-6 md:p-8 rounded-lg shadow-lg text-lg leading-loose font-mono overflow-x-auto">
          {song.chords && song.chords.length > 0 ? (
            song.chords.map((line, index) => (
                <div key={index} className="flex items-baseline mb-3">
                    <div className="w-20 flex-shrink-0"><span className="font-bold text-blue-400">{line.chord}</span></div>
                    <div className="flex-grow pl-4"><span className="whitespace-pre-wrap">{line.lyric}</span></div>
                </div>
            ))
          ) : (
            <p className="text-gray-400">Nenhuma cifra disponível para esta música.</p>
          )}
        </main>
      </div>
    </div>
  );
};

export default Song;
