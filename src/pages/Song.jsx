
import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import useFaceScroll from '../hooks/useFaceScroll';

const parseChords = (chordsString) => {
  try {
    return JSON.parse(chordsString);
  } catch (e) {
    console.error("Erro ao parsear a cifra:", e);
    return [];
  }
};

const Song = () => {
  const { id } = useParams();
  const [song, setSong] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [sensitivity, setSensitivity] = useState(30);

  const videoRef = useRef(null);
  const {
    scrollableRef,
    isCameraEnabled,
    setIsCameraEnabled,
    trackingStatus,
    isScrollEnabled,
    toggleScrollEnabled,
  } = useFaceScroll(videoRef, sensitivity);

  useEffect(() => {
    const fetchSong = async () => {
      setLoading(true);
      setError(null);
      try {
        const songDoc = doc(db, 'songs', id);
        const songSnapshot = await getDoc(songDoc);

        if (songSnapshot.exists()) {
          const songData = songSnapshot.data();
          const parsedChords = parseChords(songData.chords);
          setSong({ id: songSnapshot.id, ...songData, chords: parsedChords });
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
  }, [id]);

  if (loading) {
    return <div className="bg-gray-900 text-white min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  if (error) {
    return <div className="bg-gray-900 text-white min-h-screen flex items-center justify-center">{error}</div>;
  }

  return (
    <div className="bg-gray-900 text-white min-h-screen" ref={scrollableRef}>
      {/* ==== PAINEL DE CONTROLE COMPLETO ==== */}
      <div className="fixed bottom-4 right-4 bg-gray-900 bg-opacity-80 border border-gray-700 p-4 rounded-lg shadow-2xl z-50 w-60">
        <video ref={videoRef} className={`w-full h-auto rounded-md mb-2 ${isCameraEnabled ? 'block' : 'hidden'}`} autoPlay playsInline></video>
        
        <div className="text-center">
          <p className="text-xs text-gray-400 mb-2 h-4">{trackingStatus}</p>
          
          <button onClick={() => setIsCameraEnabled(prev => !prev)} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg text-sm mb-2 transition-colors">
            {isCameraEnabled ? 'Desativar Câmera' : 'Ativar Câmera'}
          </button>
          
          {isCameraEnabled && (
            <>
              <button onClick={toggleScrollEnabled} className={`w-full font-bold py-2 px-4 rounded-lg text-sm transition-colors mb-2 ${isScrollEnabled ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
                {isScrollEnabled ? 'Rolagem Ativa' : 'Rolagem Inativa'}
              </button>

              <div className="mt-2">
                <label htmlFor="sensitivity" className="block text-xs text-gray-400 mb-1">Sensibilidade: {sensitivity}</label>
                <input 
                  type="range" 
                  id="sensitivity" 
                  min="5" 
                  max="50" 
                  value={sensitivity}
                  onChange={(e) => setSensitivity(Number(e.target.value))} 
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 md:p-8 pb-40"> {/* Added padding-bottom to avoid overlap */}
        <header className="mb-8 text-center">
           <Link to="/" className="text-blue-400 hover:text-blue-300 mb-4 inline-block">← Voltar para a Biblioteca</Link>
          <h1 className="text-3xl md:text-5xl font-bold break-words">{song.title}</h1>
          <p className="text-lg md:text-xl text-gray-400 mt-2">{song.artist}</p>
          <p className="text-md text-gray-500 mt-1">Tom: {song.tone}</p>
        </header>

        <main className="bg-gray-800 p-4 md:p-8 rounded-lg shadow-lg text-lg leading-loose font-mono overflow-x-auto">
          {song.chords?.map((line, lineIndex) => (
            <div key={lineIndex} className="flex flex-row items-end mb-6">
              {line.map((segment, segmentIndex) => (
                <div key={segmentIndex} className="flex-shrink-0">
                  <span className="block h-6 font-bold text-blue-400">
                    {segment.chord}
                  </span>
                  <span className="whitespace-pre">
                    {segment.lyric}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </main>
      </div>
    </div>
  );
};

export default Song;
