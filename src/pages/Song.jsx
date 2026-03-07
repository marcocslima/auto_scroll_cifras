
import React, { useRef, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import useFaceScroll from '../hooks/useFaceScroll';
import { songs } from '../data/songs';

const Song = () => {
  const { id } = useParams();
  const song = songs.find(s => s.id === parseInt(id));

  const videoRef = useRef(null);
  const [sensitivity, setSensitivity] = useState(100);
  // Pegando os novos estados do hook
  const { scrollableRef, setIsCameraEnabled, isTrackingActive, trackingStatus } = useFaceScroll(videoRef, sensitivity);

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
      
      {/* Feedback Visual da Câmera e Status */}
      <div className='absolute top-4 right-4 w-40 z-50'>
        <video 
          ref={videoRef} 
          className={`w-full h-auto rounded-lg border-2 ${isTrackingActive ? 'border-green-500' : 'border-red-500'}`}
          playsInline 
        />
        <p className='text-center text-xs mt-1 bg-gray-900/50 rounded p-1'>
          {trackingStatus}
        </p>
      </div>

      {/* Controles de Sensibilidade */}
      <div className='fixed bottom-4 left-1/2 -translate-x-1/2 bg-gray-800/80 rounded-full flex items-center gap-4 px-4 py-2 text-white z-50'>
        <button onClick={decreaseSensitivity} className='text-2xl font-bold'>-</button>
        <span className='text-lg'>Sensibilidade: {sensitivity}</span>
        <button onClick={increaseSensitivity} className='text-2xl font-bold'>+</button>
      </div>
    </div>
  );
};

export default Song;
