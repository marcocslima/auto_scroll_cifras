
import { useState, useEffect, useRef, useCallback } from 'react';
import { FaceMesh } from '@mediapipe/face_mesh';

// ====================================================================================
// HOOK PARA ROLAGEM FACIAL COM FEEDBACK VISUAL
// ====================================================================================
const useFaceScroll = ({
  sensitivity: initialSensitivity = 30,
  deadZone: initialDeadZone = 0.15, // Default gap size
} = {}) => {
  // --- Refs Internas --- 
  const streamRef = useRef(null);
  const videoRef = useRef(null);
  const faceMeshRef = useRef(null);
  const animationFrameRef = useRef(null);
  const sensitivityRef = useRef(initialSensitivity);
  const deadZoneGapRef = useRef(initialDeadZone);

  // --- Estado Público ---
  const [isActive, setIsActive] = useState(false);
  const [isScrollEnabled, setIsScrollEnabled] = useState(true);
  const [trackingStatus, setTrackingStatus] = useState('Inativo');
  const [videoStream, setVideoStream] = useState(null);

  // Estado para os dados de rastreamento que serão usados na UI
  const [trackingData, setTrackingData] = useState({
    nosePosition: { x: 0.5, y: 0.5 }, // Posição do nariz (0-1)
    thresholds: { upper: 0.5 - initialDeadZone / 2, lower: 0.5 + initialDeadZone / 2 },
  });

  // --- Funções de Controle Públicas ---
  const setSensitivity = (value) => {
    sensitivityRef.current = value;
  };

  const setDeadZoneGap = useCallback((value) => {
    deadZoneGapRef.current = value;
  }, []);

  // Função de limpeza robusta para parar tudo
  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      const videoElement = videoRef.current;
      videoElement.srcObject = null;
      videoElement.onplaying = null; 
      videoElement.pause();
    }
    setVideoStream(null);
    setIsActive(false);
    setTrackingStatus('Inativo');
  }, []);

  // Função para processar os resultados da detecção
  const onResults = useCallback((results) => {
    const faceDetected = results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0;
    const nose = faceDetected ? results.multiFaceLandmarks[0][1] : null;
    
    // Calcula as linhas limite com base na configuração atual
    const currentDeadZone = deadZoneGapRef.current;
    const upperThreshold = 0.5 - currentDeadZone / 2;
    const lowerThreshold = 0.5 + currentDeadZone / 2;

    // Atualiza os dados de rastreamento para a UI (sempre)
    setTrackingData({
      nosePosition: nose ? { x: nose.x, y: nose.y } : { x: 0.5, y: 0.5 },
      thresholds: { upper: upperThreshold, lower: lowerThreshold },
    });

    if (!faceDetected) {
      setTrackingStatus('Rosto não detectado');
      return;
    }

    if (!isScrollEnabled) {
      setTrackingStatus('Rolagem pausada');
      return;
    }

    setTrackingStatus('Rolagem Ativa');

    const y = nose.y;
    const scrollSpeed = sensitivityRef.current;
    let scrollAmount = 0;

    // Lógica de rolagem baseada nas linhas limite
    if (y < upperThreshold) {
      // Rolar para cima (o valor é negativo)
      scrollAmount = (y - upperThreshold) * scrollSpeed;
    } else if (y > lowerThreshold) {
      // Rolar para baixo
      scrollAmount = (y - lowerThreshold) * scrollSpeed;
    }

    if (scrollAmount !== 0) {
      window.scrollBy(0, scrollAmount);
    }
  }, [isScrollEnabled]);

  // Loop de detecção principal
  const detectionLoop = useCallback(async () => {
    if (faceMeshRef.current && videoRef.current && !videoRef.current.paused) {
      await faceMeshRef.current.send({ image: videoRef.current });
    }
    animationFrameRef.current = requestAnimationFrame(detectionLoop);
  }, []);
  
  // Inicialização do hook (executado uma única vez)
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

  // Função para INICIAR a rolagem
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

  // Retorna os controles e os novos dados de rastreamento
  return { 
    start, stop, isActive, isScrollEnabled, toggleScroll, 
    trackingStatus, videoStream, setSensitivity, setDeadZoneGap, 
    trackingData, initialDeadZone 
  };
};

export default useFaceScroll;
