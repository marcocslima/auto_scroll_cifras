
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { db } from '../firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { useSettings } from '../context/SettingsContext';

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
const ChordLyricLine = ({ line }) => {
  const hasChords = line.chords && line.chords.length > 0;
  
  // Se é um par acorde+letra (cifra-style com \n separando)
  if (line.isChordLyricPair && hasChords) {
    const parts = line.lyric.split('\n');
    const chordLineText = parts[0] || '';
    const lyricLineText = parts.length > 1 ? parts[1] : '';
    
    return (
      <div className="mb-1">
        <div className="text-amber-400 font-bold whitespace-pre" style={{ minHeight: '1.5em' }}>
          {chordLineText}
        </div>
        {lyricLineText && (
          <div className="whitespace-pre">
            {lyricLineText}
          </div>
        )}
      </div>
    );
  }

  // Se tem acordes inline (formato [Chord]) - renderiza com acordes acima
  if (hasChords && line.lyric) {
    // Constrói a linha de acordes com base nas posições
    const lyric = line.lyric;
    let chordDisplay = '';
    
    // Ordena por posição
    const sortedChords = [...line.chords].sort((a, b) => a.position - b.position);
    
    sortedChords.forEach(c => {
      while (chordDisplay.length < c.position) chordDisplay += ' ';
      chordDisplay += c.chord;
    });

    return (
      <div className="mb-1">
        <div className="text-amber-400 font-bold whitespace-pre" style={{ minHeight: '1.5em' }}>
          {chordDisplay}
        </div>
        <div className="whitespace-pre">
          {lyric}
        </div>
      </div>
    );
  }

  // Linha só de acordes (sem letra associada), como "Intro: G" ou linha solta de acordes
  if (hasChords && !line.lyric) {
    let chordDisplay = '';
    const sortedChords = [...line.chords].sort((a, b) => a.position - b.position);
    sortedChords.forEach(c => {
      while (chordDisplay.length < c.position) chordDisplay += ' ';
      chordDisplay += c.chord;
    });

    return (
      <div className="mb-1">
        <div className="text-amber-400 font-bold whitespace-pre">
          {chordDisplay}
        </div>
      </div>
    );
  }

  // Linha vazia
  if (!line.lyric && !hasChords) {
    return <div className="mb-1" style={{ minHeight: '1.5em' }}>&nbsp;</div>;
  }

  // Linha de letra pura (sem acordes)
  return (
    <div className="mb-1">
      <div className="whitespace-pre">{line.lyric}</div>
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

  const { start, stop, pause, resume, isScrollEnabled, trackingStatus } = useSettings();

  // Busca os dados da música no Firestore
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

  // Pré-processa os acordes para agrupar por seção
  const processedSections = useMemo(() => {
    if (!song || !song.chords) return [];

    const sections = [];
    let currentSection = { title: 'Início', lines: [] };

    song.chords.forEach((line, index) => {
      if (line.section) {
        // Salva a seção anterior se ela tiver linhas
        if (currentSection.lines.length > 0 || currentSection.title !== 'Início') {
          sections.push(currentSection);
        }
        // Inicia uma nova seção
        currentSection = { title: line.section, lines: [], isTab: line.section.toLowerCase().startsWith('tab') };
      } else {
        currentSection.lines.push({ ...line, id: `line-${index}` });
      }
    });
    // Adiciona a última seção processada
    sections.push(currentSection);

    // Inicializa o estado de colapso para todas as seções de tablatura
    const initialCollapsedState = {};
    sections.forEach((sec, index) => {
      if (sec.isTab) {
        initialCollapsedState[index] = true; // Começa recolhido
      }
    });
    setCollapsedSections(initialCollapsedState);

    return sections;
  }, [song]);

  const toggleSection = (index) => {
    setCollapsedSections(prev => ({ ...prev, [index]: !prev[index] }));
  };

  // ... (Restante das funções de navegação e scroll permanecem iguais)
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

  const handleToggleFaceScroll = () => { if (isScrollEnabled) stop(); else start({ scroll: true }); };
  
  const handleGoBack = () => {
    stop();
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
                <Link to="/" onClick={() => stop()} className="text-amber-400 hover:text-amber-300 inline-block">
                    Página Inicial
                </Link>
            </div>
          <h1 className="text-4xl md:text-5xl font-bold break-words">{song.title}</h1>
          <p className="text-xl md:text-2xl text-gray-400 mt-2">{song.artist}</p>
          <p className="text-md text-gray-500 mt-1">Tom: {song.tone || 'Não especificado'}</p>
          <p className="text-sm text-gray-400 h-5 mt-4">{isScrollEnabled ? trackingStatus : "Rolagem facial inativa"}</p>
        </header>

        <main className="bg-gray-800 p-4 sm:p-6 md:p-8 rounded-lg shadow-lg text-lg leading-relaxed font-mono overflow-x-auto">
          {processedSections.length > 0 ? (
            processedSections.map((section, index) => (
              <div key={`section-${index}`}>
                <h2 
                  id={`section-${index}`}
                  onClick={() => section.isTab && toggleSection(index)}
                  className={`font-sans text-xl font-bold text-amber-300 mt-8 mb-4 pt-2 border-t border-gray-700 ${section.isTab ? 'cursor-pointer' : ''}`}
                >
                  {section.title}
                  {section.isTab && <span className="text-sm font-normal text-gray-400 ml-3">{collapsedSections[index] ? '(clique para expandir)' : '(clique para recolher)'}</span>}
                </h2>
                {(!section.isTab || !collapsedSections[index]) && section.lines.map(line => (
                  <ChordLyricLine key={line.id} line={line} />
                ))}
              </div>
            ))
          ) : (
            <p className="text-gray-400">Nenhuma cifra disponível para esta música.</p>
          )}
        </main>
      </div>
      
      {/* Botões flutuantes (navegação de seção, scroll, etc) */}
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
