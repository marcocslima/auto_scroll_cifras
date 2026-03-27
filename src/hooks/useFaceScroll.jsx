
import { useState, useEffect, useRef, useCallback } from 'react';
import { FaceMesh } from '@mediapipe/face_mesh';

// ====================================================================================
// HOOK DE ROLAGEM FACIAL - VERSÃO FINAL E ROBUSTA
// ====================================================================================
const useFaceScroll = ({
  sensitivity: initialSensitivity = 30,
  deadZoneGap: initialDeadZoneGap = 0.15, 
  deadZoneCenter: initialDeadZoneCenter = 0.5,
} = {}) => {
  // --- Estado e Refs ---
  const [isActive, setIsActive] = useState(false);
  const [isScrollEnabled, setIsScrollEnabled] = useState(false);
  const [trackingStatus, setTrackingStatus] = useState('Inativo');
  const [videoStream, setVideoStream] = useState(null);
  const [trackingData, setTrackingData] = useState({ thresholds: { upper: 0, lower: 0 }, nosePosition: null });

  // Refs para valores que mudam com frequência e para objetos que persistem
  const isScrollEnabledRef = useRef(isScrollEnabled);
  const sensitivityRef = useRef(initialSensitivity);
  const deadZoneGapRef = useRef(initialDeadZoneGap);
  const deadZoneCenterRef = useRef(initialDeadZoneCenter);
  const videoRef = useRef(null);
  const faceMeshRef = useRef(null);
  const animationFrameRef = useRef(null);
  const streamRef = useRef(null);

  // Sincroniza o ref com o estado de rolagem para acesso no loop de animação
  useEffect(() => {
    isScrollEnabledRef.current = isScrollEnabled;
  }, [isScrollEnabled]);

  // --- Funções de Controle (exportadas) ---
  const setSensitivity = (value) => { sensitivityRef.current = value; };
  const setDeadZoneGap = useCallback((value) => { deadZoneGapRef.current = value; }, []);
  const setDeadZoneCenter = useCallback((value) => { deadZoneCenterRef.current = value; }, []);

  // --- Lógica Principal ---

  // Função de limpeza: para tudo e reseta o estado
  const stop = useCallback(() => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject = null;
      videoRef.current.pause();
    }
    streamRef.current = null;
    setVideoStream(null);
    setIsActive(false);
    setIsScrollEnabled(false);
    setTrackingStatus('Inativo');
  }, []);

  // Função que processa os resultados da deteção facial
  const onResults = useCallback((results) => {
    const faceDetected = results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0;
    const nose = faceDetected ? results.multiFaceLandmarks[0][1] : null;
    
    const center = deadZoneCenterRef.current;
    const gap = deadZoneGapRef.current;
    const upperThreshold = center - gap / 2;
    const lowerThreshold = center + gap / 2;

    setTrackingData({ nosePosition: nose, thresholds: { upper: upperThreshold, lower: lowerThreshold } });

    if (!faceDetected) return setTrackingStatus('Rosto não detectado');
    
    // USA O REF: Garante que o valor mais recente seja lido, resolvendo o problema de "stale state"
    if (!isScrollEnabledRef.current) return setTrackingStatus('Calibração ativa. Rolagem pausada.');

    setTrackingStatus('Rolagem Ativa');

    const y = nose.y;
    let scrollAmount = 0;
    if (y < upperThreshold) scrollAmount = (y - upperThreshold) * sensitivityRef.current;
    else if (y > lowerThreshold) scrollAmount = (y - lowerThreshold) * sensitivityRef.current;

    if (scrollAmount !== 0) window.scrollBy(0, scrollAmount);
  }, []); // As dependências são refs, então esta função é estável e não precisa ser recriada

  // Loop de deteção que envia o vídeo para o FaceMesh
  const detectionLoop = useCallback(async () => {
    if (faceMeshRef.current && videoRef.current && !videoRef.current.paused) {
      await faceMeshRef.current.send({ image: videoRef.current });
    }
    animationFrameRef.current = requestAnimationFrame(detectionLoop);
  }, []);

  // Função para iniciar a deteção e a câmera
  const start = useCallback(async ({ scroll = false } = {}) => {
    // Define o estado de rolagem imediatamente
    setIsScrollEnabled(scroll);

    // Se a câmera já está ativa, não faz nada (a mudança de `isScrollEnabled` já foi feita)
    if (isActive) return;

    // Se a câmera está inativa, inicia o processo completo
    try {
      setTrackingStatus('Iniciando câmera...');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      streamRef.current = stream;
      setVideoStream(stream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onplaying = () => {
          setTrackingStatus('Iniciando detecção...');
          if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = requestAnimationFrame(detectionLoop);
        };
        setIsActive(true);
      }
    } catch (error) {
      console.error('Falha ao iniciar a detecção facial:', error);
      setTrackingStatus('Erro de câmera');
      stop(); // Limpa tudo em caso de erro
    }
  }, [isActive, detectionLoop, stop]);

  // Efeito principal que inicializa e limpa tudo
  useEffect(() => {
    const videoElement = document.createElement('video');
    videoElement.autoplay = true; videoElement.muted = true;
    videoElement.style.cssText = 'position: fixed; bottom: 0; left: 0; width: 1px; height: 1px; z-index: -1;';
    document.body.appendChild(videoElement);
    videoRef.current = videoElement;

    const faceMesh = new FaceMesh({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}` });
    faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
    faceMesh.onResults(onResults);
    faceMeshRef.current = faceMesh;

    // Função de limpeza que é chamada quando o hook é desmontado
    return () => {
      stop();
      if (faceMeshRef.current) faceMeshRef.current.close();
      if (videoElement.parentNode) document.body.removeChild(videoElement);
    };
  }, [onResults, stop]); // `onResults` e `stop` são estáveis

  return { 
    start, stop, isActive, isScrollEnabled, 
    trackingStatus, videoStream, 
    setSensitivity, setDeadZoneGap, setDeadZoneCenter, 
    trackingData, initialDeadZoneGap, initialDeadZoneCenter
  };
};

export default useFaceScroll;
