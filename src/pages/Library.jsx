
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { db } from '../firebase/config';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { useSettings } from '../context/SettingsContext';

// Componente da Biblioteca de Cifras
const Library = () => {
  // Estados da Biblioteca
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [songSearchTerm, setSongSearchTerm] = useState('');
  const [selectedArtist, setSelectedArtist] = useState(null);
  const location = useLocation();

  // Estados e Funções de Calibração (do useSettings)
  const { start, stop, isActive, trackingStatus, videoStream, setSensitivity, setDeadZoneGap, setDeadZoneCenter, trackingData, initialDeadZoneGap, initialDeadZoneCenter } = useSettings();
  const [localSensitivity, setLocalSensitivity] = useState(30);
  const [localDeadZoneGap, setLocalDeadZoneGap] = useState(initialDeadZoneGap || 0.15);
  const [localDeadZoneCenter, setLocalDeadZoneCenter] = useState(initialDeadZoneCenter || 0.5);
  const [isCameraPreviewVisible, setIsCameraPreviewVisible] = useState(false);
  const displayVideoRef = useRef(null);
  const canvasRef = useRef(null);

  // Efeito para buscar as músicas do Firestore
  useEffect(() => {
    const q = query(collection(db, 'songs'));
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        let songsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        songsData.sort((a, b) => {
          if (a.artist.toLowerCase() < b.artist.toLowerCase()) return -1;
          if (a.artist.toLowerCase() > b.artist.toLowerCase()) return 1;
          if (a.title.toLowerCase() < b.title.toLowerCase()) return -1;
          if (a.title.toLowerCase() > b.title.toLowerCase()) return 1;
          return 0;
        });
        setSongs(songsData);
        setLoading(false);
      },
      (err) => {
        console.error("Firebase Error:", err);
        setError('Não foi possível carregar as músicas. Verifique a conexão ou as regras do Firestore.');
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Efeito para lidar com o artista vindo da URL
  useEffect(() => {
    if (songs.length > 0) {
      const params = new URLSearchParams(location.search);
      const artistFromUrl = params.get('artist');
      if (artistFromUrl) {
        const artistExists = songs.some(song => song.artist === artistFromUrl);
        if (artistExists) {
          setSelectedArtist(artistFromUrl);
        }
      }
    }
  }, [songs, location.search]);

  // Limpeza da câmera ao sair da página
  useEffect(() => {
    return () => { if (isActive) stop(); };
  }, [isActive, stop]);

  // Efeito para ligar/desligar a câmera de calibração
  useEffect(() => {
    if (isCameraPreviewVisible) start({ scroll: false });
    else if (isActive) stop();
  }, [isCameraPreviewVisible, start, stop, isActive]);

  // Conecta o stream de vídeo ao elemento de vídeo
  useEffect(() => {
    if (displayVideoRef.current && videoStream) displayVideoRef.current.srcObject = videoStream;
  }, [videoStream]);

  // Efeito para desenhar o feedback de calibração no canvas
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
    
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, upperY); ctx.lineTo(width, upperY); ctx.stroke();
    
    ctx.strokeStyle = '#ef4444';
    ctx.beginPath(); ctx.moveTo(0, lowerY); ctx.lineTo(width, lowerY); ctx.stroke();
    if (trackingData.nosePosition) {
      const { x, y } = trackingData.nosePosition;
      ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(x * width, y * height, 5, 0, 2 * Math.PI); ctx.fill();
    }
  }, [trackingData, isActive, isCameraPreviewVisible]);

  const artists = useMemo(() => {
    const artistSet = new Set(songs.map(song => song.artist));
    return Array.from(artistSet);
  }, [songs]);

  const filteredArtists = artists.filter(artist => 
    artist.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const songsBySelectedArtist = songs.filter(song => 
    song.artist === selectedArtist &&
    song.title.toLowerCase().includes(songSearchTerm.toLowerCase())
  );

  const handleSelectArtist = (artist) => { setSelectedArtist(artist); setSearchTerm(''); };
  const handleClearArtist = () => { setSelectedArtist(null); setSongSearchTerm('') };
  const handleSensitivityChange = (e) => { const v = Number(e.target.value); setLocalSensitivity(v); setSensitivity(v); };
  const handleDeadZoneGapChange = (e) => { const v = Number(e.target.value); setLocalDeadZoneGap(v); setDeadZoneGap(v); };
  const handleDeadZoneCenterChange = (e) => { const v = Number(e.target.value); setLocalDeadZoneCenter(v); setDeadZoneCenter(v); };

  return (
    <div className="text-white min-h-screen font-sans">
      <div className="container mx-auto p-4 md:p-8">
        <h1 className="text-4xl font-bold mb-4 text-center">Biblioteca de Cifras</h1>
        <p className="text-center text-gray-400 mb-8">Encontre um artista ou calibre a rolagem facial.</p>

        <div className="max-w-2xl mx-auto">
          <details className="bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-4 mb-8">
            <summary className="cursor-pointer list-none text-center font-semibold text-amber-400 hover:text-amber-300">Calibração da Rolagem Facial</summary>
            <div className="mt-4 pt-4 border-t border-gray-700 space-y-4">
              <button onClick={() => setIsCameraPreviewVisible(p => !p)} className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors">{isCameraPreviewVisible ? 'Fechar Calibração' : 'Iniciar Calibração'}</button>
              <p className="text-sm text-gray-400 h-5 text-center">{isCameraPreviewVisible ? trackingStatus : "Calibração inativa"}</p>
              <div className={`flex justify-center overflow-hidden transition-all duration-500 ease-in-out ${isCameraPreviewVisible ? 'max-h-[480px] opacity-100 mt-4' : 'max-h-0 opacity-0'}`}>
                <div className="relative w-full max-w-md bg-gray-900 rounded-lg shadow-inner">
                  <video ref={displayVideoRef} className="w-full h-auto rounded-lg" autoPlay playsInline muted />
                  <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full rounded-lg pointer-events-none" />
                </div>
              </div>
              <div className="pt-2"><label htmlFor="sensitivity" className="block text-xs text-gray-400 mb-1">Sensibilidade: {localSensitivity}</label><input type="range" id="sensitivity" min="10" max="100" value={localSensitivity} onChange={handleSensitivityChange} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-500"/></div>
              <div className="pt-2"><label htmlFor="deadZoneGap" className="block text-xs text-gray-400 mb-1">Tamanho da Zona Morta: {Math.round(localDeadZoneGap * 100)}%</label><input type="range" id="deadZoneGap" min="0.05" max="0.4" step="0.01" value={localDeadZoneGap} onChange={handleDeadZoneGapChange} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-500"/></div>
              <div className="pt-2"><label htmlFor="deadZoneCenter" className="block text-xs text-gray-400 mb-1">Posição Vertical: {Math.round(localDeadZoneCenter * 100)}%</label><input type="range" id="deadZoneCenter" min="0.3" max="0.7" step="0.01" value={localDeadZoneCenter} onChange={handleDeadZoneCenterChange} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-500"/></div>
            </div>
          </details>
        </div>

        <div className="bg-gray-800 shadow-lg rounded-lg p-6 max-w-2xl mx-auto">
          {loading && <p className="text-center">Carregando biblioteca...</p>}
          {error && <p className="text-center text-red-500">{error}</p>}
          {!loading && !error && (
            <div>
              {selectedArtist ? (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-amber-400">{selectedArtist}</h2>
                    <button onClick={handleClearArtist} className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg text-sm">← Voltar aos artistas</button>
                  </div>
                  <input 
                    type="text"
                    placeholder="Digite o nome da música..."
                    value={songSearchTerm}
                    onChange={(e) => setSongSearchTerm(e.target.value)}
                    className="w-full bg-gray-900 text-white p-3 rounded-lg mb-4 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <ul className="divide-y divide-gray-700">
                    {songsBySelectedArtist.length > 0 ? (
                      songsBySelectedArtist.map(song => (
                        <li key={song.id} className="py-3">
                          <Link to={`/song/${song.id}`} className="block hover:bg-gray-700 p-3 rounded-lg transition-colors">
                            <h3 className="text-xl font-semibold text-gray-200 hover:text-amber-400">{song.title}</h3>
                          </Link>
                        </li>
                      ))
                    ) : (
                      <p className="text-center text-gray-400 py-4">Nenhuma música encontrada.</p>
                    )}
                  </ul>
                </div>
              ) : (
                <div>
                  <h2 className="text-2xl font-bold mb-4 text-center">Buscar por Artista</h2>
                  <input 
                    type="text"
                    placeholder="Digite o nome do artista..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-gray-900 text-white p-3 rounded-lg mb-4 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <ul className="divide-y divide-gray-700 max-h-96 overflow-y-auto">
                    {filteredArtists.length > 0 ? (
                      filteredArtists.map(artist => (
                        <li key={artist} onClick={() => handleSelectArtist(artist)} className="py-3 px-3 cursor-pointer hover:bg-gray-700 rounded-lg transition-colors">
                          <span className="text-lg text-gray-200 hover:text-amber-400">{artist}</span>
                        </li>
                      ))
                    ) : (
                      <p className="text-center text-gray-400 py-4">Nenhum artista encontrado.</p>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Library;
