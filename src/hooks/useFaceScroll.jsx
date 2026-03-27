
import { useState, useEffect, useRef, useCallback } from 'react';
import { FaceMesh } from '@mediapipe/face_mesh';

// ====================================================================================
// HOOK PARA ROLAGEM FACIAL COM FEEDBACK VISUAL E CONTROLES AVANÇADOS
// ====================================================================================
const useFaceScroll = ({
  sensitivity: initialSensitivity = 30,
  deadZoneGap: initialDeadZoneGap = 0.15, // Default gap size
  deadZoneCenter: initialDeadZoneCenter = 0.5, // Default vertical center
} = {}) => {
  // --- Refs Internas para controle em tempo real ---
  const streamRef = useRef(null);
  const videoRef = useRef(null);
  const faceMeshRef = useRef(null);
  const animationFrameRef = useRef(null);
  const sensitivityRef = useRef(initialSensitivity);
  const deadZoneGapRef = useRef(initialDeadZoneGap);
  const deadZoneCenterRef = useRef(initialDeadZoneCenter);

  // --- Estado Público ---
  const [isActive, setIsActive] = useState(false);
  const [isScrollEnabled, setIsScrollEnabled] = useState(true);
  const [trackingStatus, setTrackingStatus] = useState('Inativo');
  const [videoStream, setVideoStream] = useState(null);
  const [trackingData, setTrackingData] = useState({
    nosePosition: { x: 0.5, y: 0.5 },
    thresholds: { 
      upper: initialDeadZoneCenter - initialDeadZoneGap / 2, 
      lower: initialDeadZoneCenter + initialDeadZoneGap / 2 
    },
  });

  // --- Funções de Controle Públicas ---
  const setSensitivity = (value) => { sensitivityRef.current = value; };
  const setDeadZoneGap = useCallback((value) => { deadZoneGapRef.current = value; }, []);
  const setDeadZoneCenter = useCallback((value) => { deadZoneCenterRef.current = value; }, []);

  // --- Lógica Principal ---
  const cleanup = useCallback(() => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.pause();
    }
    setVideoStream(null);
    setIsActive(false);
    setTrackingStatus('Inativo');
  }, []);

  const onResults = useCallback((results) => {
    const faceDetected = results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0;
    const nose = faceDetected ? results.multiFaceLandmarks[0][1] : null;
    
    // Calcula as linhas limite com base em AMBOS os controles (amplitude e centro)
    const center = deadZoneCenterRef.current;
    const gap = deadZoneGapRef.current;
    const upperThreshold = center - gap / 2;
    const lowerThreshold = center + gap / 2;

    // Atualiza os dados de rastreamento para a UI (sempre)
    setTrackingData({
      nosePosition: nose ? { x: nose.x, y: nose.y } : { x: 0.5, y: 0.5 },
      thresholds: { upper: upperThreshold, lower: lowerThreshold },
    });

    if (!faceDetected) return setTrackingStatus('Rosto não detectado');
    if (!isScrollEnabled) return setTrackingStatus('Rolagem pausada');

    setTrackingStatus('Rolagem Ativa');

    const y = nose.y;
    let scrollAmount = 0;

    if (y < upperThreshold) {
      scrollAmount = (y - upperThreshold) * sensitivityRef.current;
    } else if (y > lowerThreshold) {
      scrollAmount = (y - lowerThreshold) * sensitivityRef.current;
    }

    if (scrollAmount !== 0) window.scrollBy(0, scrollAmount);

  }, [isScrollEnabled]);

  const detectionLoop = useCallback(async () => {
    if (faceMeshRef.current && videoRef.current && !videoRef.current.paused) {
      await faceMeshRef.current.send({ image: videoRef.current });
    }
    animationFrameRef.current = requestAnimationFrame(detectionLoop);
  }, []);
  
  useEffect(() => {
    const videoElement = document.createElement('video');
    videoElement.autoplay = true;
    videoElement.muted = true;
    videoElement.style.cssText = 'position: fixed; bottom: 0; left: 0; width: 1px; height: 1px; z-index: -1;';
    document.body.appendChild(videoElement);
    videoRef.current = videoElement;

    const faceMesh = new FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });
    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    faceMesh.onResults(onResults);
    faceMeshRef.current = faceMesh;

    return () => {
      cleanup();
      if (faceMeshRef.current) faceMeshRef.current.close();
      if (videoElement.parentNode) document.body.removeChild(videoElement);
    };
  }, [cleanup, onResults]);

  const start = useCallback(async () => {
    if (isActive) return;
    try {
      setTrackingStatus('Iniciando câmera...');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      streamRef.current = stream;
      setVideoStream(stream);
      
      const videoElement = videoRef.current;
      videoElement.srcObject = stream;
      
      videoElement.onplaying = () => {
        setTrackingStatus('Iniciando detecção...');
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = requestAnimationFrame(detectionLoop);
      };
      setIsActive(true);
    } catch (error) {
      console.error('Falha ao iniciar a rolagem facial:', error);
      setTrackingStatus('Erro de câmera');
      cleanup();
    }
  }, [cleanup, detectionLoop, isActive]);

  const stop = useCallback(() => cleanup(), [cleanup]);
  const toggleScroll = useCallback(() => setIsScrollEnabled(prev => !prev), []);

  return { 
    start, stop, isActive, isScrollEnabled, toggleScroll, 
    trackingStatus, videoStream, 
    setSensitivity, setDeadZoneGap, setDeadZoneCenter, 
    trackingData, initialDeadZoneGap, initialDeadZoneCenter
  };
};

export default useFaceScroll;
