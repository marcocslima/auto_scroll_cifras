
import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import useFaceScroll from '../hooks/useFaceScroll';

// Função auxiliar para parsear os acordes de forma segura
const parseChords = (chordsString) => {
  try {
    const parsed = JSON.parse(chordsString);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return []; 
  }
};

// ====================================================================================
// COMPONENTE DA PÁGINA DA MÚSICA (AGORA UM CLIENTE SIMPLES DO HOOK)
// ====================================================================================
const Song = () => {
  const { id } = useParams();
  const [song, setSong] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // --- Estado da UI ---
  const [sensitivity, setSensitivityState] = useState(30);
  const [isCameraPreviewVisible, setIsCameraPreviewVisible] = useState(true);
  const displayVideoRef = useRef(null);

  // --- API do Hook de Rolagem Facial ---
  const {
    start,
    stop,
    isActive,
    isScrollEnabled,
    toggleScroll,
    trackingStatus,
    videoStream,
    setSensitivity
  } = useFaceScroll();

  // --- Efeitos ---

  // Conecta o stream de vídeo do hook ao elemento <video> da UI
  useEffect(() => {
    const videoElement = displayVideoRef.current;
    if (videoElement && videoStream) {
      videoElement.srcObject = videoStream;
    } 
    // Limpeza: desassocia o stream quando ele para
    return () => {
      if (videoElement && videoElement.srcObject) {
        videoElement.srcObject = null;
      }
    };
  }, [videoStream]);

  // Busca os dados da música do Firestore
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

    // Função de limpeza para garantir que o hook pare quando o usuário navega para fora da página
    return () => {
      stop(); 
    };
  }, [id, stop]); // `stop` é estável e não causa re-execução


  // --- Handlers de UI ---

  // Botão principal que inicia e para tudo
  const handleToggleFaceScroll = () => {
    if (isActive) {
      stop();
    } else {
      start();
    }
  };
  
  // Handler para o controle deslizante de sensibilidade
  const handleSensitivityChange = (e) => {
      const value = Number(e.target.value);
      setSensitivityState(value);
      setSensitivity(value); // Atualiza a sensibilidade no hook
  };

  // --- Renderização ---

  if (loading) return <div className="bg-gray-900 text-white min-h-screen flex items-center justify-center">Carregando...</div>;
  if (error) return <div className="bg-gray-900 text-white min-h-screen flex items-center justify-center">{error}</div>;
  if (!song) return null;

  return (
    // Layout principal simples, permite a rolagem natural da página
    <div className="bg-gray-900 text-white min-h-screen">
      
      {/* PAINEL DE CONTROLE FLUTUANTE */}
      <div className="fixed bottom-4 right-4 bg-gray-800 border border-gray-700 p-4 rounded-lg shadow-2xl z-50 w-64">
        
        {/* Pré-visualização da Câmera */}
        <video 
          ref={displayVideoRef}
          className={`w-full h-auto rounded-md bg-gray-900 transition-all duration-300 ${isActive && isCameraPreviewVisible ? 'opacity-100 mb-3' : 'h-0 opacity-0'}`}
          autoPlay 
          playsInline
          muted
        />
        
        <div className="text-center space-y-2">
          <p className="text-sm text-gray-400 h-5">{isActive ? trackingStatus : "Rolagem Inativa"}</p>
          
          <button onClick={handleToggleFaceScroll} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
            {isActive ? 'Parar Rolagem Facial' : 'Ativar Rolagem Facial'}
          </button>
          
          {isActive && (
            <>
              <button onClick={() => setIsCameraPreviewVisible(prev => !prev)} className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors">
                {isCameraPreviewVisible ? 'Ocultar Câmera' : 'Mostrar Câmera'}
              </button>

              <button onClick={toggleScroll} className={`w-full font-bold py-2 px-4 rounded-lg text-sm transition-colors ${isScrollEnabled ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
                {isScrollEnabled ? 'Rolagem Ativa' : 'Rolagem Pausada'}
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
            </>
          )}
        </div>
      </div>

      {/* CONTEÚDO DA MÚSICA */}
      <div className="max-w-4xl mx-auto p-4 md:p-8 pb-48"> {/* Padding no final para não ser coberto pelo painel */}
        <header className="mb-8 text-center">
           <Link to="/" className="text-blue-400 hover:text-blue-300 mb-4 inline-block">← Voltar para a Biblioteca</Link>
          <h1 className="text-4xl md:text-5xl font-bold break-words">{song.title}</h1>
          <p className="text-xl md:text-2xl text-gray-400 mt-2">{song.artist}</p>
          <p className="text-md text-gray-500 mt-1">Tom: {song.tone}</p>
        </header>

        <main className="bg-gray-800 p-6 md:p-8 rounded-lg shadow-lg text-lg leading-loose font-mono overflow-x-auto">
          {song.chords.length > 0 ? (
            song.chords.map((line, lineIndex) => (
              <div key={lineIndex} className="flex flex-row items-end mb-6">
                {line.map((segment, segmentIndex) => (
                  <div key={segmentIndex} className="flex-shrink-0 mr-4">
                    <span className="block h-6 font-bold text-blue-400">
                      {segment.chord || ' '}
                    </span>
                    <span className="whitespace-pre">
                      {segment.lyric}
                    </span>
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
