
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { db } from '../firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { useSettings } from '../context/SettingsContext';
import { useLrcScroll } from '../hooks/useLrcScroll'; // Importe o novo hook

// Função auxiliar para garantir que os acordes sejam sempre um array
const getChordsArray = (chordsData) => {
  if (Array.isArray(chordsData)) {
    // Converte formato antigo { chord: 'Am', lyric: '...' } para novo { chords: [...], lyric: '...' }
    return chordsData.map(item => {
      if (item.chords) return item; // Já no formato novo
      // Formato antigo: converte
      if (item.chord) {
        return { chords: [{ chord: item.chord, position: 0 }], lyric: item.lyric || '' };
      }
      return { chords: [], lyric: item.lyric || '' };
    });
  }
  if (typeof chordsData === 'string') {
    try {
      const parsed = JSON.parse(chordsData);
      return Array.isArray(parsed) ? getChordsArray(parsed) : [];
    } catch (e) { 
      console.error("Erro ao parsear acordes:", e); 
      return []; 
    }
  }
  return [];
};


// Componente que renderiza uma linha de cifra com acordes posicionados
const ChordLyricLine = ({ line, lineId }) => {
    const hasChords = line.chords && line.chords.length > 0;

    return (
        <div id={lineId} className="mb-1 relative"> 
            {hasChords && (
                <div className="text-amber-400 font-bold whitespace-pre-wrap" style={{ minHeight: '1.5em' }}>
                    {line.chords.map(c => c.chord).join(' ')}
                </div>
            )}
            <div className="whitespace-pre-wrap">
                {line.lyric || (hasChords ? '' : '\u00A0')}
            </div>
        </div>
    );
};


const Song = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [song, setSong] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState({});
  const [isLrcMode, setIsLrcMode] = useState(false); // Estado para o modo LRC

  const { start, stop, pause, resume, isScrollEnabled, trackingStatus } = useSettings();
  
  // Instancia o hook de scroll LRC
  const { start: startLrcScroll } = useLrcScroll({
    lrc: song?.syncedLyrics || '',
    chords: song?.chords || '',
    isPlaying: isLrcMode, // Ativa o scroll quando o modo LRC está ligado
  });

  // Busca os dados da música no Firestore
  useEffect(() => {
    const fetchSong = async () => {
      setLoading(true);
      try {
        const songDocRef = doc(db, 'songs', id);
        const songSnapshot = await getDoc(songDocRef);
        if (songSnapshot.exists()) {
          const songData = songSnapshot.data();
          // Transforma a cifra em string única para o hook
          const chordsString = getChordsArray(songData.chords).map(l => l.lyric || '').join('\n');
          setSong({ 
              id: songSnapshot.id, 
              ...songData, 
              chords: chordsString, // Armazena a cifra como string
              originalChords: getChordsArray(songData.chords) // Mantém o formato original para renderização
          });
        } else { setError('Música não encontrada.'); }
      } catch (err) { setError('Falha ao carregar a música.'); }
      setLoading(false);
    };
    fetchSong();
    return () => stop();
  }, [id, stop]);

  // Pré-processa os acordes para agrupar por seção
  const processedSections = useMemo(() => {
    if (!song || !song.originalChords) return [];

    const sections = [];
    let currentSection = { title: 'Início', lines: [] };

    song.originalChords.forEach((line, index) => {
      if (line.section) {
        if (currentSection.lines.length > 0 || currentSection.title !== 'Início') {
          sections.push(currentSection);
        }
        currentSection = { title: line.section, lines: [], isTab: line.section.toLowerCase().startsWith('tab') };
      } else {
        currentSection.lines.push({ ...line, id: `line-${index}` });
      }
    });
    sections.push(currentSection);

    const initialCollapsedState = {};
    sections.forEach((sec, index) => {
      if (sec.isTab) {
        initialCollapsedState[index] = true;
      }
    });
    setCollapsedSections(initialCollapsedState);

    return sections;
  }, [song]);

  const toggleSection = (index) => {
    setCollapsedSections(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const handleScrollAndPause = (scrollAction) => {
    if (!isScrollEnabled) { scrollAction(); return; }
    pause();
    scrollAction();
    setTimeout(() => { resume(); }, 1000);
  };

  const scrollToSection = (sectionId) => {
    handleScrollAndPause(() => {
      const element = document.getElementById(sectionId);
      if (element) { element.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
  };

  const scrollToTop = () => {
    handleScrollAndPause(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); });
  };

  useEffect(() => {
    const handleScroll = () => { setShowBackToTop(window.scrollY > 200); };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleToggleFaceScroll = () => { 
      if (isLrcMode) setIsLrcMode(false);
      if (isScrollEnabled) stop(); else start({ scroll: true }); 
  };

  const handleToggleLrcMode = () => {
      if (isScrollEnabled) stop();
      const newLrcMode = !isLrcMode;
      setIsLrcMode(newLrcMode);
      if (newLrcMode) {
        startLrcScroll();
      }
  };
  
  const handleGoBack = () => {
    stop();
    setIsLrcMode(false); // Desativa o LRC ao voltar
    if (song && song.artist) {
      navigate(`/?artist=${encodeURIComponent(song.artist)}`);
    } else {
      navigate('/');
    }
  };

  if (loading) return <div className="text-white min-h-screen flex items-center justify-center">Carregando...</div>;
  if (error) return <div className="text-white min-h-screen flex items-center justify-center">{error}</div>;
  if (!song) return null;

  return (
    <div className="text-white min-h-screen font-sans">
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <header className="mb-6 text-center">
            <div className="flex justify-center items-center gap-4 mb-4">
                <button onClick={handleGoBack} className="text-amber-400 hover:text-amber-300 inline-block">
                    {song.artist ? `← Voltar para ${song.artist}` : '← Voltar para a Biblioteca'}
                </button>
                <span className="text-gray-500">|</span>
                <Link to="/" onClick={() => { stop(); setIsLrcMode(false); }} className="text-amber-400 hover:text-amber-300 inline-block">
                    Página Inicial
                </Link>
            </div>
          <h1 className="text-4xl md:text-5xl font-bold break-words">{song.title}</h1>
          <p className="text-xl md:text-2xl text-gray-400 mt-2">{song.artist}</p>
          <p className="text-md text-gray-500 mt-1">Tom: {song.tone || 'Não especificado'}</p>
          <p className="text-sm text-gray-400 h-5 mt-4">
             {isLrcMode ? "Rolagem LRC ativa" : (isScrollEnabled ? trackingStatus : "Rolagem facial inativa")}
          </p>
        </header>

        <main className="bg-gray-800 p-4 sm:p-6 md:p-8 rounded-lg shadow-lg text-lg leading-relaxed font-mono overflow-x-auto">
          {processedSections.length > 0 ? (
            processedSections.map((section, sectionIndex) => (
              <div key={`section-${sectionIndex}`}>
                <h2 
                  id={`section-${sectionIndex}`}
                  onClick={() => section.isTab && toggleSection(sectionIndex)}
                  className={`font-sans text-xl font-bold text-amber-300 mt-8 mb-4 pt-2 border-t border-gray-700 ${section.isTab ? 'cursor-pointer' : ''}`}
                >
                  {section.title}
                  {section.isTab && <span className="text-sm font-normal text-gray-400 ml-3">{collapsedSections[sectionIndex] ? '(expandir)' : '(recolher)'}</span>}
                </h2>
                {(!section.isTab || !collapsedSections[sectionIndex]) && section.lines.map((line, lineIndex) => (
                  <ChordLyricLine key={line.id} line={line} lineId={line.id} />
                ))}
              </div>
            ))
          ) : (
            <p className="text-gray-400">Nenhuma cifra disponível para esta música.</p>
          )}
        </main>
      </div>
      
       <div className="fixed top-1/2 -translate-y-1/2 right-6 flex flex-col gap-3 z-40">
        {processedSections.filter(sec => sec.title !== 'Início').map((sec, index) => (
            <button 
              key={index} 
              onClick={() => scrollToSection(`section-${index}`)} 
              title={sec.title}
              className="bg-gray-700 hover:bg-gray-600 text-white font-bold text-xl rounded-full shadow-lg w-14 h-14 flex items-center justify-center transition-all duration-200 transform hover:scale-110">
              {sec.title.charAt(0).toUpperCase()}
            </button>
          ))}
        </div>

      <div className="fixed bottom-6 right-6 flex flex-col items-center space-y-4 z-50">
          {/* Botão para modo LRC */}
          {song.syncedLyrics && (
             <button onClick={handleToggleLrcMode} className={`text-white font-bold p-4 rounded-full shadow-lg transition-transform transform hover:scale-110 ${isLrcMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-600 hover:bg-gray-700'}`}>
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z"></path><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd"></path></svg>
             </button>
          )}

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
