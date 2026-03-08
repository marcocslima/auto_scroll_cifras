
import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import useFaceScroll from '../hooks/useFaceScroll';

const parseChords = (chordsString) => {
  try {
    const parsed = JSON.parse(chordsString);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("Erro ao parsear acordes:", e);
    return [];
  }
};

const Song = () => {
  const { id } = useParams();
  const [song, setSong] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [sensitivity, setSensitivityState] = useState(30);
  const [isCameraPreviewVisible, setIsCameraPreviewVisible] = useState(false);
  const displayVideoRef = useRef(null);

  const {
    start,
    stop,
    isActive,
    isScrollEnabled, // Manter o estado, mesmo sem o botão visível por enquanto
    toggleScroll, 
    trackingStatus,
    videoStream,
    setSensitivity
  } = useFaceScroll();

  useEffect(() => {
    const videoElement = displayVideoRef.current;
    if (videoElement && videoStream) {
      videoElement.srcObject = videoStream;
    } 
    return () => {
      if (videoElement && videoElement.srcObject) {
        videoElement.srcObject = null;
      }
    };
  }, [videoStream]);

  useEffect(() => {
    const fetchSong = async () => {
      setLoading(true);
      try {
        const songDocRef = doc(db, 'songs', id);
        const songSnapshot = await getDoc(songDocRef);
        if (songSnapshot.exists()) {
          const songData = songSnapshot.data();
          setSong({ id: songSnapshot.id, ...songData, chords: parseChords(songData.chords) });
        } else {
          setError('Música não encontrada.');
        }
      } catch (err) {
        console.error("Erro ao buscar música:", err);
        setError('Falha ao carregar a música.');
      }
      setLoading(false);
    };
    fetchSong();

    return () => {
      stop(); 
    };
  }, [id, stop]);

  const handleToggleFaceScroll = () => {
    if (isActive) {
      stop();
    } else {
      start();
    }
  };
  
  const handleSensitivityChange = (e) => {
      const value = Number(e.target.value);
      setSensitivityState(value);
      setSensitivity(value);
  };

  if (loading) return <div className="bg-gray-900 text-white min-h-screen flex items-center justify-center">Carregando...</div>;
  if (error) return <div className="bg-gray-900 text-white min-h-screen flex items-center justify-center">{error}</div>;
  if (!song) return null;

  return (
    <div className="bg-gray-900 text-white min-h-screen font-sans">
      
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <header className="mb-6 text-center">
           <Link to="/" className="text-blue-400 hover:text-blue-300 mb-4 inline-block">← Voltar para a Biblioteca</Link>
          <h1 className="text-4xl md:text-5xl font-bold break-words">{song.title}</h1>
          <p className="text-xl md:text-2xl text-gray-400 mt-2">{song.artist}</p>
          <p className="text-md text-gray-500 mt-1">Tom: {song.tone}</p>
        </header>

        {/* PAINEL DE CONTROLE REESTRUTURADO */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg mb-6 shadow-lg p-4 space-y-3">
          <button 
            onClick={handleToggleFaceScroll} 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors text-lg"
          >
            {isActive ? 'Parar Rolagem Facial' : 'Ativar Rolagem Facial'}
          </button>

          <p className="text-sm text-gray-400 h-5 text-center">{isActive ? trackingStatus : "Rolagem facial inativa"}</p>
          
          {isActive && (
            <details className="border-t border-gray-700 pt-3">
              <summary className="cursor-pointer list-none text-center text-blue-400 hover:text-blue-300">
                Configurações
              </summary>
              
              <div className="mt-4 space-y-4">
                <button 
                  onClick={() => setIsCameraPreviewVisible(prev => !prev)} 
                  className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors"
                >
                  {isCameraPreviewVisible ? 'Ocultar Câmera' : 'Mostrar Câmera'}
                </button>

                <div className="pt-2">
                  <label htmlFor="sensitivity" className="block text-xs text-gray-400 mb-1">Sensibilidade: {sensitivity}</label>
                  <input 
                    type="range" 
                    id="sensitivity" 
                    min="10" 
                    max="100" 
                    value={sensitivity}
                    onChange={handleSensitivityChange}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>
            </details>
          )}
        </div>

        {/* Container da Pré-visualização da Câmera (tamanho restaurado) */}
        <div className={`flex justify-center mb-6 overflow-hidden transition-all duration-500 ease-in-out ${isActive && isCameraPreviewVisible ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
            <video 
                ref={displayVideoRef}
                className="w-full max-w-md h-auto rounded-lg bg-gray-900 shadow-lg"
                autoPlay 
                playsInline
                muted
            />
        </div>

        {/* CONTEÚDO DA MÚSICA */}
        <main className="bg-gray-800 p-4 sm:p-6 md:p-8 rounded-lg shadow-lg text-lg leading-loose font-mono overflow-x-auto">
          {song.chords.length > 0 ? (
            song.chords.map((line, lineIndex) => (
              <div key={lineIndex} className="flex flex-wrap items-end mb-4">
                {line.map((segment, segmentIndex) => (
                  <div key={segmentIndex} className="mr-4 mb-2">
                    <span className="block h-6 font-bold text-blue-400">{segment.chord || ' '}</span>
                    <span className="whitespace-pre-wrap">{segment.lyric}</span>
                  </div>
                ))}
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
