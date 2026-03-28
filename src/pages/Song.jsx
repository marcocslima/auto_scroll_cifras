
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { useSettings } from '../context/SettingsContext';

const getChordsArray = (chordsData) => {
  if (Array.isArray(chordsData)) return chordsData;
  if (typeof chordsData === 'string') {
    try {
      const parsed = JSON.parse(chordsData);
      return Array.isArray(parsed) ? (Array.isArray(parsed[0]) ? parsed.flat() : parsed) : [];
    } catch (e) { 
      console.error("Erro ao parsear acordes:", e); 
      return []; 
    }
  }
  return [];
};

const Song = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [song, setSong] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showBackToTop, setShowBackToTop] = useState(false);

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
    return () => stop();
  }, [id, stop]);

  const sections = useMemo(() => {
    if (!song || !song.chords) return [];
    let sectionCounter = 0;
    const seenSections = {};
    return song.chords
      .filter(line => line.section)
      .map((sec) => {
        const sectionId = `section-${sectionCounter++}`;
        return { ...sec, sectionId };
      });
  }, [song]);

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  useEffect(() => {
    const handleScroll = () => { setShowBackToTop(window.scrollY > 200); };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleToggleFaceScroll = () => { if (isScrollEnabled) stop(); else start({ scroll: true }); };
  const handleGoBack = () => { stop(); navigate('/'); };
  const scrollToTop = () => { window.scrollTo({ top: 0, behavior: 'smooth' }); };

  if (loading) return <div className="text-white min-h-screen flex items-center justify-center">Carregando...</div>;
  if (error) return <div className="text-white min-h-screen flex items-center justify-center">{error}</div>;
  if (!song) return null;

  return (
    <div className="text-white min-h-screen font-sans">
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <header className="mb-6 text-center">
          <button onClick={handleGoBack} className="text-amber-400 hover:text-amber-300 mb-4 inline-block">← Voltar para a Biblioteca</button>
          <h1 className="text-4xl md:text-5xl font-bold break-words">{song.title}</h1>
          <p className="text-xl md:text-2xl text-gray-400 mt-2">{song.artist}</p>
          <p className="text-md text-gray-500 mt-1">Tom: {song.tone || 'Não especificado'}</p>
          <p className="text-sm text-gray-400 h-5 mt-4">{isScrollEnabled ? trackingStatus : "Rolagem facial inativa"}</p>
        </header>

        <main className="bg-gray-800 p-4 sm:p-6 md:p-8 rounded-lg shadow-lg text-lg leading-loose font-mono overflow-x-auto">
          {song.chords && song.chords.length > 0 ? (
            song.chords.map((line, index) => {
              if (line.section) {
                 let cumulativeIndex = 0;
                 for (let i = 0; i < index; i++) {
                   if (song.chords[i].section) {
                     cumulativeIndex++;
                   }
                 }
                return (
                  <h2 key={`section-title-${index}`} id={`section-${cumulativeIndex}`} className="font-sans text-xl font-bold text-amber-300 mt-8 mb-4 pt-2 border-t border-gray-700">
                    {line.section}
                  </h2>
                );
              }
              return (
                <div key={index} className="flex items-baseline mb-3">
                  <div className="w-20 flex-shrink-0"><span className="font-bold text-amber-400">{line.chord}</span></div>
                  <div className="flex-grow pl-4"><span className="whitespace-pre-wrap">{line.lyric}</span></div>
                </div>
              );
            })
          ) : (
            <p className="text-gray-400">Nenhuma cifra disponível para esta música.</p>
          )}
        </main>
      </div>
      
      {/* Floating Section Navigation */}
      {sections.length > 0 && (
        <div className="fixed top-1/2 -translate-y-1/2 right-6 flex flex-col gap-3 z-40"> {/* Lower z-index to avoid overlap */}
          {sections.map((sec, index) => (
            <button 
              key={index} 
              onClick={() => scrollToSection(sec.sectionId)} 
              title={sec.section} // Tooltip for accessibility
              className="bg-gray-700 hover:bg-gray-600 text-white font-bold text-xl rounded-full shadow-lg w-14 h-14 flex items-center justify-center transition-all duration-200 transform hover:scale-110">
              {sec.section.charAt(0).toUpperCase()}
            </button>
          ))}
        </div>
      )}

      {/* Other Floating Buttons */}
      <div className="fixed bottom-6 right-6 flex flex-col items-center space-y-4 z-50">
        <button onClick={handleToggleFaceScroll} className={`text-white font-bold p-4 rounded-full shadow-lg transition-transform transform hover:scale-110 ${isScrollEnabled ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'}`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9A2.25 2.25 0 0013.5 5.25h-9A2.25 2.25 0 002.25 7.5v9A2.25 2.25 0 004.5 18.75z"></path></svg>
        </button>
        {showBackToTop && (
          <button onClick={scrollToTop} className="bg-gray-700 hover:bg-gray-600 text-white font-bold p-4 rounded-full shadow-lg transition-opacity duration-300">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18"></path></svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default Song;
