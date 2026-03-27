
import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase/config';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { useSettings } from '../context/SettingsContext';

const Library = () => {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const {
    start, stop, isActive, isScrollEnabled,
    trackingStatus, videoStream, 
    setSensitivity, setDeadZoneGap, setDeadZoneCenter,
    trackingData, initialDeadZoneGap, initialDeadZoneCenter 
  } = useSettings();

  const [localSensitivity, setLocalSensitivity] = useState(30);
  const [localDeadZoneGap, setLocalDeadZoneGap] = useState(initialDeadZoneGap || 0.15);
  const [localDeadZoneCenter, setLocalDeadZoneCenter] = useState(initialDeadZoneCenter || 0.5);
  const [isCameraPreviewVisible, setIsCameraPreviewVisible] = useState(false);
  
  const displayVideoRef = useRef(null);
  const canvasRef = useRef(null);

  // Efeito para buscar as músicas do Firestore
  useEffect(() => {
    const q = query(collection(db, 'songs'), orderBy('title'));
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const songsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setSongs(songsData);
        setLoading(false);
      },
      (err) => {
        setError('Não foi possível carregar as músicas.');
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // ========= CORREÇÃO FINAL: LIMPEZA AO SAIR DA PÁGINA =========
  useEffect(() => {
    // Esta função de retorno é a chave. Ela será executada sempre que 
    // o usuário sair da página da Biblioteca.
    return () => {
      // Se a detecção estiver ativa, desliga tudo para garantir um estado limpo
      // na próxima página que for visitada.
      if (isActive) {
        stop();
      }
    };
    // Adicionamos `isActive` e `stop` como dependências por segurança.
  }, [isActive, stop]);


  // Efeito para ligar/desligar a câmera de calibração
  useEffect(() => {
    if (isCameraPreviewVisible) {
      start({ scroll: false }); // Modo calibração: câmera ligada, rolagem desligada
    } else {
      // Se a câmera for fechada (e a detecção estiver ativa), para tudo.
      if (isActive) {
        stop();
      }
    }
    // Adicionamos as dependências para seguir as boas práticas do React.
  }, [isCameraPreviewVisible, start, stop, isActive]);
  
  // Conecta o stream de vídeo ao elemento de vídeo local
  useEffect(() => {
    if (displayVideoRef.current && videoStream) displayVideoRef.current.srcObject = videoStream;
  }, [videoStream]);

  // Desenha as linhas de feedback no canvas (sem alterações de lógica)
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = displayVideoRef.current;
    if (!canvas || !video || !isCameraPreviewVisible || !trackingData || !isActive) return;

    const ctx = canvas.getContext('2d');
    const { width, height } = video.getBoundingClientRect();
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }

    ctx.clearRect(0, 0, width, height);
    
    const upperY = trackingData.thresholds.upper * height;
    const lowerY = trackingData.thresholds.lower * height;

    ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, upperY); ctx.lineTo(width, upperY); ctx.stroke();
    ctx.strokeStyle = '#ef4444'; ctx.beginPath(); ctx.moveTo(0, lowerY); ctx.lineTo(width, lowerY); ctx.stroke();

    if (trackingData.nosePosition) {
        const { x, y } = trackingData.nosePosition;
        ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(x * width, y * height, 5, 0, 2 * Math.PI); ctx.fill();
    }
  }, [trackingData, isActive, isCameraPreviewVisible]);

  const handleSensitivityChange = (e) => { const v = Number(e.target.value); setLocalSensitivity(v); setSensitivity(v); };
  const handleDeadZoneGapChange = (e) => { const v = Number(e.target.value); setLocalDeadZoneGap(v); setDeadZoneGap(v); };
  const handleDeadZoneCenterChange = (e) => { const v = Number(e.target.value); setLocalDeadZoneCenter(v); setDeadZoneCenter(v); };

  return (
    <div className="bg-gray-900 text-white min-h-screen">
      <div className="container mx-auto p-8">
        <h1 className="text-4xl font-bold mb-4 text-center">Biblioteca de Cifras</h1>
        <p className="text-center text-gray-400 mb-8">1. Calibre a rolagem. 2. Escolha uma música.</p>

        <div className="max-w-xl mx-auto">
            <details className="bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-4 mb-6">
                <summary className="cursor-pointer list-none text-center font-semibold text-blue-400 hover:text-blue-300">Calibração da Rolagem Facial</summary>
                <div className="mt-4 pt-4 border-t border-gray-700 space-y-4">
                    <button onClick={() => setIsCameraPreviewVisible(p => !p)} className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors">
                      {isCameraPreviewVisible ? 'Fechar Calibração' : 'Iniciar Calibração'}
                    </button>
                    <p className="text-sm text-gray-400 h-5 text-center">{isCameraPreviewVisible ? trackingStatus : "Calibração inativa"}</p>
                    
                    <div className={`flex justify-center overflow-hidden transition-all duration-500 ease-in-out ${isCameraPreviewVisible ? 'max-h-[480px] opacity-100 mt-4' : 'max-h-0 opacity-0'}`}>
                      <div className="relative w-full max-w-md bg-gray-900 rounded-lg shadow-inner">
                        <video ref={displayVideoRef} className="w-full h-auto rounded-lg" autoPlay playsInline muted />
                        <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full rounded-lg pointer-events-none" />
                      </div>
                    </div>
                    
                    <div className="pt-2">
                      <label htmlFor="sensitivity" className="block text-xs text-gray-400 mb-1">Sensibilidade: {localSensitivity}</label>
                      <input type="range" id="sensitivity" min="10" max="100" value={localSensitivity} onChange={handleSensitivityChange} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"/>
                    </div>

                    <div className="pt-2">
                      <label htmlFor="deadZoneGap" className="block text-xs text-gray-400 mb-1">Tamanho da Zona Morta: {Math.round(localDeadZoneGap * 100)}%</label>
                      <input type="range" id="deadZoneGap" min="0.05" max="0.4" step="0.01" value={localDeadZoneGap} onChange={handleDeadZoneGapChange} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"/>
                    </div>

                    <div className="pt-2">
                      <label htmlFor="deadZoneCenter" className="block text-xs text-gray-400 mb-1">Posição Vertical: {Math.round(localDeadZoneCenter * 100)}%</label>
                      <input type="range" id="deadZoneCenter" min="0.3" max="0.7" step="0.01" value={localDeadZoneCenter} onChange={handleDeadZoneCenterChange} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"/>
                    </div>
                </div>
            </details>
        </div>

        {loading && <p className="text-center">Carregando músicas...</p>}
        {error && <p className="text-center text-red-500">{error}</p>}
        {!loading && !error && (
          <div className="bg-gray-800 shadow-lg rounded-lg p-6 max-w-xl mx-auto">
            <ul className="divide-y divide-gray-700">
              {songs.length > 0 ? (
                songs.map(song => (
                  <li key={song.id} className="py-4">
                    <Link to={`/song/${song.id}`} className="block hover:bg-gray-700 p-4 rounded-lg transition-colors">
                      <h2 className="text-xl font-semibold text-blue-400">{song.title}</h2>
                      <p className="text-gray-400">{song.artist}</p>
                    </Link>
                  </li>
                ))
              ) : (
                <p className="text-center text-gray-400 py-4">Nenhuma música encontrada.</p>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default Library;
