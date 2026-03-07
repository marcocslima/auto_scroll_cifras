
import React, { useRef, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import useFaceScroll from '../hooks/useFaceScroll';
import { songs } from '../data/songs';

const Song = () => {
  const { id } = useParams();
  const song = songs.find(s => s.id === parseInt(id));

  const videoRef = useRef(null);
  const [sensitivity, setSensitivity] = useState(100);
  const [isCameraViewEnabled, setIsCameraViewEnabled] = useState(false);

  // Importando os novos controles do hook
  const { 
    scrollableRef, 
    setIsCameraEnabled, 
    isTrackingActive, 
    trackingStatus, 
    isScrollEnabled, 
    toggleScrollEnabled 
  } = useFaceScroll(videoRef, sensitivity);

  useEffect(() => {
    const requestCamera = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
        setIsCameraEnabled(true);
      } catch (error) {
        console.error('Error accessing camera:', error);
      }
    };
    requestCamera();
  }, [setIsCameraEnabled]);

  const increaseSensitivity = () => setSensitivity(s => s + 10);
  const decreaseSensitivity = () => setSensitivity(s => Math.max(10, s - 10));

  if (!song) {
    return <div className='text-white text-center pt-8'>Música não encontrada.</div>;
  }

  return (
    <div className='bg-gray-900 text-white min-h-screen'>
      <Link 
        to="/"
        className='absolute top-4 left-4 z-50 bg-gray-800/80 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors'
      >
        &larr; Voltar para Biblioteca
      </Link>

      <div ref={scrollableRef} className='overflow-y-scroll h-screen p-4 pt-20'>
        <div className='max-w-2xl mx-auto pb-24'>
          <h1 className='text-3xl font-bold mb-2'>{song.title}</h1>
          <h2 className='text-xl text-gray-400 mb-6'>{song.artist}</h2>
          <div className='text-lg leading-loose'>
            {song.lyrics.map((line, index) => (
              <p key={index} className='mb-4'>
                <span className='chord text-yellow-400'>{line.chord}</span>
                <br />
                <span className='lyric'>{line.lyric}</span>
              </p>
            ))}
          </div>
        </div>
      </div>
      
      {/* Controles da Câmera, Rolagem e Status */}
      <div className='absolute top-4 right-4 w-48 z-50'> {/* Aumentado o width para caber os botões */}
        <div className="flex flex-col items-stretch text-center gap-2">
            <div className="grid grid-cols-2 gap-2">
              {/* Botão para alternar a rolagem */}
              <button
                onClick={toggleScrollEnabled}
                className='bg-blue-600/80 text-white px-3 py-1.5 rounded-lg hover:bg-blue-500 transition-colors text-sm'
              >
                {isScrollEnabled ? 'Pausar Rolagem' : 'Ativar Rolagem'}
              </button>

              {/* Botão para alternar a visibilidade da câmera */}
              <button
                onClick={() => setIsCameraViewEnabled(prev => !prev)}
                className='bg-gray-800/80 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 transition-colors text-sm'
              >
                {isCameraViewEnabled ? 'Ocultar Câm' : 'Ver Câm'}
              </button>
            </div>
            
            {/* Status do monitoramento, sempre visível */}
            <p className='text-xs bg-gray-900/50 rounded p-1 w-full'>
              {trackingStatus}
            </p>
        </div>
        
        <video 
          ref={videoRef} 
          className={
            isCameraViewEnabled
              ? `w-full h-auto rounded-lg border-2 mt-2 ${isTrackingActive && isScrollEnabled ? 'border-green-500' : 'border-red-500'}`
              : 'absolute -left-full w-px h-px'
          }
          playsInline
          muted
          autoPlay
        />
      </div>

      <div className='fixed bottom-4 left-1/2 -translate-x-1/2 bg-gray-800/80 rounded-full flex items-center gap-4 px-4 py-2 text-white z-50'>
        <button onClick={decreaseSensitivity} className='text-2xl font-bold'>-</button>
        <span className='text-lg'>Sensibilidade: {sensitivity}</span>
        <button onClick={increaseSensitivity} className='text-2xl font-bold'>+</button>
      </div>
    </div>
  );
};

export default Song;
