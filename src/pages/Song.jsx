
import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import useFaceScroll from '../hooks/useFaceScroll';

const getChordsArray = (chordsData) => {
  if (Array.isArray(chordsData)) return chordsData;
  if (typeof chordsData === 'string') {
    try {
      const parsed = JSON.parse(chordsData);
      if (Array.isArray(parsed) && Array.isArray(parsed[0])) return parsed.flat();
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      console.error("Erro ao parsear acordes da string:", e);
      return [];
    }
  }
  return [];
};

const Song = () => {
  const { id } = useParams();
  const [song, setSong] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [isCameraPreviewVisible, setIsCameraPreviewVisible] = useState(false);
  const displayVideoRef = useRef(null);
  const canvasRef = useRef(null);

  // --- HOOK DE ROLAGEM FACIAL COM CONTROLES AVANÇADOS ---
  const {
    start, stop, isActive, isScrollEnabled, toggleScroll, 
    trackingStatus, videoStream, 
    setSensitivity, setDeadZoneGap, setDeadZoneCenter,
    trackingData, initialDeadZoneGap, initialDeadZoneCenter 
  } = useFaceScroll();

  // --- ESTADOS LOCAIS PARA OS CONTROLES ---
  const [sensitivity, setSensitivityState] = useState(30);
  const [deadZoneGap, setDeadZoneGapState] = useState(initialDeadZoneGap || 0.15);
  const [deadZoneCenter, setDeadZoneCenterState] = useState(initialDeadZoneCenter || 0.5);

  // --- EFEITOS ---
  useEffect(() => {
    const videoElement = displayVideoRef.current;
    if (videoElement && videoStream) videoElement.srcObject = videoStream;
    return () => { if (videoElement && videoElement.srcObject) videoElement.srcObject = null; };
  }, [videoStream]);

  useEffect(() => {
    const fetchSong = async () => {
      setLoading(true);
      try {
        const songDocRef = doc(db, 'songs', id);
        const songSnapshot = await getDoc(songDocRef);
        if (songSnapshot.exists()) {
          const songData = songSnapshot.data();
          setSong({ id: songSnapshot.id, ...songData, chords: getChordsArray(songData.chords) });
        } else {
          setError('Música não encontrada.');
        }
      } catch (err) {
        setError('Falha ao carregar a música.');
      }
      setLoading(false);
    };
    fetchSong();
    return () => stop(); 
  }, [id, stop]);

  // Efeito para desenhar no Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = displayVideoRef.current;
    if (!canvas || !video || !isActive || !isCameraPreviewVisible || !trackingData) return;

    const ctx = canvas.getContext('2d');
    const { width, height } = video.getBoundingClientRect();

    if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
    }

    ctx.clearRect(0, 0, width, height);

    // Linha superior (azul)
    const upperY = trackingData.thresholds.upper * height;
    ctx.beginPath();
    ctx.moveTo(0, upperY);
    ctx.lineTo(width, upperY);
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Linha inferior (vermelha)
    const lowerY = trackingData.thresholds.lower * height;
    ctx.beginPath();
    ctx.moveTo(0, lowerY);
    ctx.lineTo(width, lowerY);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Posição do nariz (branco)
    if (trackingData.nosePosition) {
        const noseX = trackingData.nosePosition.x * width;
        const noseY = trackingData.nosePosition.y * height;
        ctx.beginPath();
        ctx.arc(noseX, noseY, 5, 0, 2 * Math.PI);
        ctx.fillStyle = 'white';
        ctx.fill();
    }
  }, [trackingData, isActive, isCameraPreviewVisible]);


  // --- HANDLERS DOS CONTROLES ---
  const handleToggleFaceScroll = () => isActive ? stop() : start();
  
  const handleSensitivityChange = (e) => {
      const value = Number(e.target.value);
      setSensitivityState(value);
      setSensitivity(value);
  };

  const handleDeadZoneGapChange = (e) => {
    const value = Number(e.target.value);
    setDeadZoneGapState(value);
    setDeadZoneGap(value);
  };
  
  const handleDeadZoneCenterChange = (e) => {
    const value = Number(e.target.value);
    setDeadZoneCenterState(value);
    setDeadZoneCenter(value);
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

        {/* PAINEL DE CONTROLE */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg mb-6 shadow-lg p-4 space-y-3">
          <button onClick={handleToggleFaceScroll} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors text-lg">
            {isActive ? 'Parar Rolagem Facial' : 'Ativar Rolagem Facial'}
          </button>
          <p className="text-sm text-gray-400 h-5 text-center">{isActive ? trackingStatus : "Rolagem facial inativa"}</p>
          
          {isActive && (
            <details className="border-t border-gray-700 pt-3" open>
              <summary className="cursor-pointer list-none text-center text-blue-400 hover:text-blue-300">Configurações</summary>
              <div className="mt-4 space-y-4">
                <button onClick={() => setIsCameraPreviewVisible(p => !p)} className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors">
                  {isCameraPreviewVisible ? 'Ocultar Câmera' : 'Mostrar Câmera'}
                </button>
                
                <div className="pt-2">
                  <label htmlFor="sensitivity" className="block text-xs text-gray-400 mb-1">Sensibilidade da Rolagem: {sensitivity}</label>
                  <input type="range" id="sensitivity" min="10" max="100" value={sensitivity} onChange={handleSensitivityChange} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"/>
                </div>

                <div className="pt-2">
                  <label htmlFor="deadZoneGap" className="block text-xs text-gray-400 mb-1">Tamanho da Zona Morta: {Math.round(deadZoneGap * 100)}%</label>
                  <input type="range" id="deadZoneGap" min="0.05" max="0.4" step="0.01" value={deadZoneGap} onChange={handleDeadZoneGapChange} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"/>
                </div>

                <div className="pt-2">
                  <label htmlFor="deadZoneCenter" className="block text-xs text-gray-400 mb-1">Posição Vertical da Zona Morta: {Math.round(deadZoneCenter * 100)}%</label>
                  <input type="range" id="deadZoneCenter" min="0.3" max="0.7" step="0.01" value={deadZoneCenter} onChange={handleDeadZoneCenterChange} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"/>
                </div>
              </div>
            </details>
          )}
        </div>

        {/* CONTAINER DA CÂMERA E CANVAS */}
        <div className={`flex justify-center mb-6 overflow-hidden transition-all duration-500 ease-in-out ${isActive && isCameraPreviewVisible ? 'max-h-[480px] opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="relative w-full max-w-md bg-gray-900 rounded-lg shadow-lg">
            <video ref={displayVideoRef} className="w-full h-auto rounded-lg" autoPlay playsInline muted />
            <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full rounded-lg pointer-events-none" />
          </div>
        </div>

        {/* CONTEÚDO DA MÚSICA */}
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
