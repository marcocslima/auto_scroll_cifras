import { useState, useEffect, useRef } from 'react';
import { parseLRC } from '../utils/lrcParser';

export const useLrcScroll = ({ lrc, chords, isPlaying, offset = 3000 }) => {
  const [lrcLines, setLrcLines] = useState([]);
  const [chordLines, setChordLines] = useState([]);
  const [currentLine, setCurrentLine] = useState(-1);
  const [activeLineIndex, setActiveLineIndex] = useState(-1); // <<< NOVO: Índice da linha destacada
  const startTimeRef = useRef(null);
  const timeoutRef = useRef(null);
  const initialScrollDone = useRef(false);

  useEffect(() => {
    setLrcLines(parseLRC(lrc));
    setChordLines(chords.split('\n').map(line => line.trim()));
  }, [lrc, chords]);

  useEffect(() => {
    if (isPlaying && lrcLines.length > 0) {
      startTimeRef.current = performance.now() - (currentLine >= 0 ? lrcLines[currentLine].time * 1000 : -offset);
      if (!initialScrollDone.current) {
        scrollToFirstLine();
        initialScrollDone.current = true;
      }
      requestAnimationFrame(update);
    } else {
      clearTimeout(timeoutRef.current);
      setActiveLineIndex(-1); // <<< NOVO: Limpa o destaque quando não está tocando
      if (startTimeRef.current) {
        startTimeRef.current = null;
      }
    }

    return () => clearTimeout(timeoutRef.current);
  }, [isPlaying, lrcLines]);

  const update = () => {
    if (!isPlaying) return;

    const elapsedTime = performance.now() - startTimeRef.current;
    const currentLrcTime = elapsedTime / 1000;

    let nextLine = -1;
    for (let i = 0; i < lrcLines.length; i++) {
      if (currentLrcTime >= lrcLines[i].time) {
        nextLine = i;
      } else {
        break;
      }
    }

    if (nextLine !== currentLine) {
      setCurrentLine(nextLine);
      if (nextLine > -1) {
        const lrcText = lrcLines[nextLine].text.toLowerCase();
        const targetLineIndex = findClosestChordLine(lrcText, nextLine);
        setActiveLineIndex(targetLineIndex); // <<< NOVO: Define qual linha destacar

        if (targetLineIndex !== -1) {
          const element = document.getElementById(`line-${targetLineIndex}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      } else {
        setActiveLineIndex(-1); // <<< NOVO: Limpa se estiver antes da primeira linha
      }
    }

    if (isPlaying) {
      requestAnimationFrame(update);
    }
  };

  const scrollToFirstLine = () => {
    if (lrcLines.length > 0) {
      timeoutRef.current = setTimeout(() => {
        const firstLrcText = lrcLines[0].text.toLowerCase();
        const firstLineIndex = findClosestChordLine(firstLrcText, 0);
        if (firstLineIndex !== -1) {
          const element = document.getElementById(`line-${firstLineIndex}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }, offset);
    }
  };

  const findClosestChordLine = (lrcText, lrcIndex) => {
    if (!lrcText) return -1;

    let bestMatch = { index: -1, score: 0 };

    for (let i = 0; i < chordLines.length; i++) {
      const chordLineText = chordLines[i].toLowerCase();
      if (chordLineText.includes(lrcText)) {
        return i;
      }       
    }
    
    const approximateIndex = Math.floor(lrcIndex / lrcLines.length * chordLines.length);
    return Math.min(approximateIndex, chordLines.length - 1);
  };

  const start = () => {
    if (lrcLines.length > 0) {
      initialScrollDone.current = false; 
      setCurrentLine(-1);
      setActiveLineIndex(-1); // <<< NOVO: Limpa o destaque ao iniciar
    }
  };

  // Retorna o índice da linha ativa
  return { start, activeLineIndex };
};
