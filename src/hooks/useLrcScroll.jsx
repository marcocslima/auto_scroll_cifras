import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatMsToTimer, parseLRC, parseLrcMapping } from '../utils/lrcParser';

const PRE_ROLL_MS = 5000;

export const useLrcScroll = ({ lrcText, lrcMapping, resolveTargetByMapping }) => {
  const parsedLrc = useMemo(() => parseLRC(lrcText), [lrcText]);
  const parsedMapping = useMemo(() => parseLrcMapping(lrcMapping), [lrcMapping]);

  const initialOffsetMs = useMemo(() => {
    if (!parsedMapping.length) return 0;
    return Math.max(0, parsedMapping[0].timeMs - PRE_ROLL_MS);
  }, [parsedMapping]);

  const [isEnabled, setIsEnabled] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [activeLineIndex, setActiveLineIndex] = useState(-1);
  const [lastAppliedMappingIndex, setLastAppliedMappingIndex] = useState(-1);

  const startTimeRef = useRef(null);
  const elapsedBeforeStartRef = useRef(0);
  const animationRef = useRef(null);
  const lastAppliedIndexRef = useRef(-1);

  const stopAnimation = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  // Sincroniza o offset inicial sempre que o mapping mudar e o player não estiver rodando
  useEffect(() => {
    if (!isRunning) {
      elapsedBeforeStartRef.current = initialOffsetMs;
      setElapsedMs(initialOffsetMs);
      lastAppliedIndexRef.current = -1;
      setActiveLineIndex(-1);
      setLastAppliedMappingIndex(-1);
    }
  }, [initialOffsetMs, isRunning]);

  const applyMappingByElapsedTime = useCallback((timeInMs) => {
    if (!parsedMapping.length || !resolveTargetByMapping) return;

    let nextIndex = -1;
    for (let index = 0; index < parsedMapping.length; index += 1) {
      if (timeInMs >= parsedMapping[index].timeMs) nextIndex = index;
      else break;
    }

    if (nextIndex === lastAppliedIndexRef.current) return;

    if (nextIndex === -1) {
      lastAppliedIndexRef.current = -1;
      setLastAppliedMappingIndex(-1);
      setActiveLineIndex(-1);
      return;
    }

    const mappingItem = parsedMapping[nextIndex];
    const target = resolveTargetByMapping(mappingItem);

    if (!target) {
      lastAppliedIndexRef.current = nextIndex;
      setLastAppliedMappingIndex(nextIndex);
      return;
    }

    if (target.type === 'line') setActiveLineIndex(target.lineIndex);
    else setActiveLineIndex(-1);

    if (target.elementId) {
      const element = document.getElementById(target.elementId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: target.type === 'section' ? 'start' : 'center' });
      }
    }

    lastAppliedIndexRef.current = nextIndex;
    setLastAppliedMappingIndex(nextIndex);
  }, [parsedMapping, resolveTargetByMapping]);

  const play = useCallback(() => {
    if (!isEnabled || isRunning) return;
    startTimeRef.current = performance.now() - elapsedBeforeStartRef.current;
    setIsRunning(true);
  }, [isEnabled, isRunning]);

  const pause = useCallback(() => {
    if (!isRunning) return;
    setIsRunning(false);
    stopAnimation();
    if (startTimeRef.current !== null) {
      elapsedBeforeStartRef.current = performance.now() - startTimeRef.current;
      setElapsedMs(elapsedBeforeStartRef.current);
    }
  }, [isRunning, stopAnimation]);

  const reset = useCallback(() => {
    setIsRunning(false);
    stopAnimation();
    startTimeRef.current = null;
    elapsedBeforeStartRef.current = initialOffsetMs;
    lastAppliedIndexRef.current = -1;
    setElapsedMs(initialOffsetMs);
    setActiveLineIndex(-1);
    setLastAppliedMappingIndex(-1);
  }, [stopAnimation, initialOffsetMs]);

  const enable = useCallback(() => {
    setIsEnabled(true);
    reset();
  }, [reset]);

  const disable = useCallback(() => {
    setIsEnabled(false);
    reset();
  }, [reset]);

  useEffect(() => {
    if (!isRunning || !isEnabled) return undefined;

    const step = (now) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = now - elapsedBeforeStartRef.current;
      }
      const nextElapsed = now - startTimeRef.current;
      setElapsedMs(nextElapsed);
      applyMappingByElapsedTime(nextElapsed);
      animationRef.current = requestAnimationFrame(step);
    };

    animationRef.current = requestAnimationFrame(step);
    return () => stopAnimation();
  }, [isRunning, isEnabled, applyMappingByElapsedTime, stopAnimation]);

  useEffect(() => {
    if (!isEnabled || !parsedMapping.length) return;
    applyMappingByElapsedTime(elapsedMs);
  }, [isEnabled, parsedMapping, elapsedMs, applyMappingByElapsedTime]);

  useEffect(() => () => stopAnimation(), [stopAnimation]);

  return {
    isEnabled,
    isRunning,
    elapsedMs,
    elapsedLabel: formatMsToTimer(elapsedMs),
    activeLineIndex,
    parsedLrc,
    parsedMapping,
    lastAppliedMappingIndex,
    enable,
    disable,
    play,
    pause,
    reset,
  };
};