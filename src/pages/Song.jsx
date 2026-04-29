import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { db } from '../firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { useSettings } from '../context/SettingsContext';
import { useLrcScroll } from '../hooks/useLrcScroll';
import { normalizeSectionKey } from '../utils/lrcParser';

const getChordsArray = (chordsData) => {
  if (Array.isArray(chordsData)) {
    return chordsData.map((item) => {
      if (item.chords) return item;
      if (item.chord) return { chords: [{ chord: item.chord, position: 0 }], lyric: item.lyric || '' };
      return { chords: [], lyric: item.lyric || '' };
    });
  }

  if (typeof chordsData === 'string') {
    try {
      const parsed = JSON.parse(chordsData);
      return Array.isArray(parsed) ? getChordsArray(parsed) : [];
    } catch (error) {
      console.error('Erro ao parsear acordes:', error);
      return [];
    }
  }

  return [];
};

const ChordLyricLine = ({ line, isHighlighted }) => {
  const hasChords = line.chords && line.chords.length > 0;
  const highlightClass = isHighlighted ? 'text-yellow-300' : '';

  if (line.isChordLyricPair && hasChords) {
    const parts = line.lyric.split('\n');
    const chordLineText = parts[0] || '';
    const lyricLineText = parts.length > 1 ? parts[1] : '';

    return (
      <div id={line.id} className={`mb-1 transition-colors duration-300 ${highlightClass}`}>
        <div className="text-amber-400 font-bold whitespace-pre" style={{ minHeight: '1.5em' }}>
          {chordLineText}
        </div>
        {lyricLineText && <div className="whitespace-pre">{lyricLineText}</div>}
      </div>
    );
  }

  if (hasChords && line.lyric) {
    const sortedChords = [...line.chords].sort((a, b) => a.position - b.position);
    let chordDisplay = '';

    sortedChords.forEach((chord) => {
      while (chordDisplay.length < chord.position) chordDisplay += ' ';
      chordDisplay += chord.chord;
    });

    return (
      <div id={line.id} className={`mb-1 transition-colors duration-300 ${highlightClass}`}>
        <div className="text-amber-400 font-bold whitespace-pre" style={{ minHeight: '1.5em' }}>
          {chordDisplay}
        </div>
        <div className="whitespace-pre">{line.lyric}</div>
      </div>
    );
  }

  if (hasChords && !line.lyric) {
    const sortedChords = [...line.chords].sort((a, b) => a.position - b.position);
    let chordDisplay = '';

    sortedChords.forEach((chord) => {
      while (chordDisplay.length < chord.position) chordDisplay += ' ';
      chordDisplay += chord.chord;
    });

    return (
      <div id={line.id} className={`mb-1 transition-colors duration-300 ${highlightClass}`}>
        <div className="text-amber-400 font-bold whitespace-pre">{chordDisplay}</div>
      </div>
    );
  }

  if (!line.lyric && !hasChords) {
    return (
      <div id={line.id} className={`mb-1 transition-colors duration-300 ${highlightClass}`} style={{ minHeight: '1.5em' }}>
        &nbsp;
      </div>
    );
  }

  return (
    <div id={line.id} className={`mb-1 transition-colors duration-300 ${highlightClass}`}>
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
      } catch (fetchError) {
        console.error(fetchError);
        setError('Falha ao carregar a música.');
      }
      setLoading(false);
    };

    fetchSong();
    return () => stop();
  }, [id, stop]);

  const processedSections = useMemo(() => {
    if (!song || !song.chords) return [];

    const sections = [];
    let currentSection = {
      title: 'Início',
      lines: [],
      isTab: false,
      domId: 'section-0',
      index: 0,
      normalizedTitle: normalizeSectionKey('Início'),
    };
    let globalLineIndex = 0;
    let sectionIndex = 0;

    song.chords.forEach((line) => {
      if (line.section) {
        if (currentSection.lines.length > 0 || currentSection.title !== 'Início') {
          sections.push(currentSection);
        }

        sectionIndex += 1;
        currentSection = {
          title: line.section,
          lines: [],
          isTab: line.section.toLowerCase().startsWith('tab'),
          domId: `section-${sectionIndex}`,
          index: sectionIndex,
          normalizedTitle: normalizeSectionKey(line.section),
        };
      } else {
        currentSection.lines.push({
          ...line,
          id: `line-${globalLineIndex}`,
          globalIndex: globalLineIndex,
        });
        globalLineIndex += 1;
      }
    });

    sections.push(currentSection);

    return sections;
  }, [song]);

  useEffect(() => {
    const initialCollapsedState = {};
    processedSections.forEach((section) => {
      if (section.isTab) {
        initialCollapsedState[section.index] = true;
      }
    });
    setCollapsedSections(initialCollapsedState);
  }, [processedSections]);

  const sectionLookup = useMemo(() => {
    const lookup = {};
    processedSections.forEach((section) => {
      lookup[section.normalizedTitle] = section;
    });
    return lookup;
  }, [processedSections]);

  const allLines = useMemo(
    () => processedSections.flatMap((section) => section.lines),
    [processedSections],
  );

  const resolveTargetByMapping = useCallback((mappingItem) => {
    if (!mappingItem) return null;

    if (mappingItem.targetType === 'line') {
      const matchedLine = allLines.find((line) => line.globalIndex === mappingItem.lineIndex);
      if (!matchedLine) return null;

      return {
        type: 'line',
        lineIndex: matchedLine.globalIndex,
        elementId: matchedLine.id,
      };
    }

    let targetSection = null;

    if (typeof mappingItem.sectionIndex === 'number') {
      targetSection = processedSections.find((section) => section.index === mappingItem.sectionIndex) || null;
    } else if (mappingItem.sectionKey) {
      targetSection = sectionLookup[mappingItem.sectionKey] || null;
    }

    if (!targetSection) return null;

    if (targetSection.isTab && collapsedSections[targetSection.index]) {
      setCollapsedSections((previous) => ({
        ...previous,
        [targetSection.index]: false,
      }));
    }

    return {
      type: 'section',
      lineIndex: -1,
      elementId: targetSection.domId,
    };
  }, [allLines, processedSections, sectionLookup, collapsedSections]);

  const {
    isEnabled: isLrcMode,
    isRunning: isLrcRunning,
    elapsedLabel,
    activeLineIndex,
    parsedLrc,
    parsedMapping,
    enable: enableLrcMode,
    disable: disableLrcMode,
    play: playLrc,
    pause: pauseLrc,
    reset: resetLrc,
  } = useLrcScroll({
    lrcText: song?.syncedLyrics || '',
    lrcMapping: song?.lrcMapping || null,
    resolveTargetByMapping,
  });

  const handleScrollAndPause = (scrollAction) => {
    if (!isScrollEnabled) {
      scrollAction();
      return;
    }

    pause();
    scrollAction();
    setTimeout(() => resume(), 1000);
  };

  const scrollToSection = (sectionId) => {
    handleScrollAndPause(() => {
      const element = document.getElementById(sectionId);
      if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const scrollToTop = () => {
    handleScrollAndPause(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  };

  useEffect(() => {
    const handleScroll = () => setShowBackToTop(window.scrollY > 200);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleToggleFaceScroll = () => {
    if (isLrcMode) {
      disableLrcMode();
    }

    if (isScrollEnabled) stop();
    else start({ scroll: true });
  };

  const handleToggleLrcMode = () => {
    if (isScrollEnabled) stop();

    if (isLrcMode) {
      disableLrcMode();
      return;
    }

    enableLrcMode();
  };

  const handleGoBack = () => {
    stop();
    disableLrcMode();

    if (song?.artist) {
      navigate(`/?artist=${encodeURIComponent(song.artist)}`);
      return;
    }

    navigate('/');
  };

  const lrcStatusText = useMemo(() => {
    if (!isLrcMode) return isScrollEnabled ? trackingStatus : 'Rolagem facial inativa';
    if (!parsedMapping.length) return 'Modo LRC ativo (sem lrcMapping válido)';
    return isLrcRunning ? 'Modo LRC em execução' : 'Modo LRC pronto';
  }, [isLrcMode, parsedMapping.length, isLrcRunning, isScrollEnabled, trackingStatus]);

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
            <Link to="/" onClick={() => { stop(); disableLrcMode(); }} className="text-amber-400 hover:text-amber-300 inline-block">
              Página Inicial
            </Link>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold break-words">{song.title}</h1>
          <p className="text-xl md:text-2xl text-gray-400 mt-2">{song.artist}</p>
          <p className="text-md text-gray-500 mt-1">Tom: {song.tone || 'Não especificado'}</p>
          <p className="text-sm text-gray-400 h-5 mt-4">{lrcStatusText}</p>
        </header>

        {isLrcMode && (
          <section className="mb-6 bg-blue-900/30 border border-blue-500/40 rounded-lg p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm text-blue-200">Tempo atual</p>
                <p className="text-2xl font-mono text-white">{elapsedLabel}</p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={playLrc}
                  disabled={!parsedMapping.length || isLrcRunning}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded"
                >
                  Play
                </button>
                <button
                  onClick={pauseLrc}
                  disabled={!isLrcRunning}
                  className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded"
                >
                  Pause
                </button>
                <button
                  onClick={resetLrc}
                  className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded"
                >
                  Reset
                </button>
              </div>
            </div>

            <div className="mt-3 text-xs text-gray-300 space-y-1">
              <p>Timestamps LRC parseados: <strong>{parsedLrc.length}</strong></p>
              <p>Mapeamentos válidos (lrcMapping): <strong>{parsedMapping.length}</strong></p>
              {!parsedMapping.length && (
                <p className="text-yellow-300">
                  Dica: configure o campo <code className="bg-black/30 px-1 rounded">lrcMapping</code> no Firebase para habilitar a navegação sincronizada.
                </p>
              )}
            </div>
          </section>
        )}

        <main className="bg-gray-800 p-4 sm:p-6 md:p-8 rounded-lg shadow-lg text-lg leading-relaxed font-mono overflow-x-auto">
          {processedSections.length > 0 ? (
            processedSections.map((section) => (
              <div key={section.domId}>
                <h2
                  id={section.domId}
                  onClick={() => section.isTab && setCollapsedSections((previous) => ({ ...previous, [section.index]: !previous[section.index] }))}
                  className={`font-sans text-xl font-bold text-amber-300 mt-8 mb-4 pt-2 border-t border-gray-700 ${section.isTab ? 'cursor-pointer' : ''}`}
                >
                  {section.title}
                  {section.isTab && (
                    <span className="text-sm font-normal text-gray-400 ml-3">
                      {collapsedSections[section.index] ? '(clique para expandir)' : '(clique para recolher)'}
                    </span>
                  )}
                </h2>

                {(!section.isTab || !collapsedSections[section.index]) && section.lines.map((line) => (
                  <ChordLyricLine key={line.id} line={line} isHighlighted={line.globalIndex === activeLineIndex} />
                ))}
              </div>
            ))
          ) : (
            <p className="text-gray-400">Nenhuma cifra disponível para esta música.</p>
          )}
        </main>
      </div>

      <div className="fixed top-1/2 -translate-y-1/2 right-6 flex flex-col gap-3 z-40">
        {processedSections
          .filter((section) => section.title !== 'Início')
          .map((section) => (
            <button
              key={section.domId}
              onClick={() => scrollToSection(section.domId)}
              title={section.title}
              className="bg-gray-700 hover:bg-gray-600 text-white font-bold text-xl rounded-full shadow-lg w-14 h-14 flex items-center justify-center transition-all duration-200 transform hover:scale-110"
            >
              {section.title.charAt(0).toUpperCase()}
            </button>
          ))}
      </div>

      <div className="fixed bottom-6 right-6 flex flex-col items-center space-y-4 z-50">
        {song.syncedLyrics && (
          <button
            onClick={handleToggleLrcMode}
            title="Ativar/Desativar modo LRC"
            className={`text-white font-bold p-4 rounded-full shadow-lg transition-transform transform hover:scale-110 ${isLrcMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-600 hover:bg-gray-700'}`}
          >
            <span className="text-sm">LRC</span>
          </button>
        )}

        <button
          onClick={handleToggleFaceScroll}
          className={`text-white font-bold p-4 rounded-full shadow-lg transition-transform transform hover:scale-110 ${isScrollEnabled ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'}`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Right-pointing_white_arrow_in_blue_rounded_square.svg/1280px-Right-pointing_white_arrow_in_blue_rounded_square.svg.png"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9A2.25 2.25 0 0013.5 5.25h-9A2.25 2.25 0 002.25 7.5v9A2.25 2.25 0 004.5 18.75z" /></svg>
        </button>

        {showBackToTop && (
          <button onClick={scrollToTop} className="bg-gray-700 hover:bg-gray-600 text-white font-bold p-4 rounded-full shadow-lg transition-opacity duration-300">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="https://www.shutterstock.com/shutterstock/photos/2502973615/display_1500/stock-vector-two-and-three-arrows-merging-silhouette-icon-clipart-image-isolated-on-white-background-2502973615.jpg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default Song;
