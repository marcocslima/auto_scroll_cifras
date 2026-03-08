
import { useState, useEffect, useRef, useCallback } from 'react';
import { FaceMesh } from '@mediapipe/face_mesh';

// ====================================================================================
// HOOK AUTÔNOMO E ROBUSTO PARA ROLAGEM FACIAL - VERSÃO FINAL
// Arquitetura baseada em eventos e com vídeo de detecção sempre ativo.
// ====================================================================================
const useFaceScroll = ({ sensitivity: initialSensitivity = 30 } = {}) => {
  // --- Refs Internas --- 
  const streamRef = useRef(null);
  const videoRef = useRef(null);
  const faceMeshRef = useRef(null);
  const animationFrameRef = useRef(null);
  const sensitivityRef = useRef(initialSensitivity);

  // --- Estado Público ---
  const [isActive, setIsActive] = useState(false);
  const [isScrollEnabled, setIsScrollEnabled] = useState(true);
  const [trackingStatus, setTrackingStatus] = useState('Inativo');
  const [videoStream, setVideoStream] = useState(null);

  const setSensitivity = (value) => {
    sensitivityRef.current = value;
  };

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
    if (!faceDetected) {
      setTrackingStatus('Rosto não detectado');
      return;
    }
    if (!isScrollEnabled) {
      setTrackingStatus('Rolagem pausada');
      return;
    }

    setTrackingStatus('Rolagem Ativa');
    const nose = results.multiFaceLandmarks[0][1];
    if (!nose) return;

    const y = nose.y;
    const deadzone = 0.05;
    const scrollSpeed = sensitivityRef.current;
    let scrollAmount = 0;

    if (y > 0.5 + deadzone) {
      scrollAmount = (y - (0.5 + deadzone)) * scrollSpeed;
    } else if (y < 0.5 - deadzone) {
      scrollAmount = -((0.5 - deadzone) - y) * scrollSpeed;
    }

    if (scrollAmount !== 0) {
      window.scrollBy(0, scrollAmount);
    }
  }, [isScrollEnabled]);

  // Loop de detecção principal
  const detectionLoop = useCallback(async () => {
    if (faceMeshRef.current && videoRef.current && !videoRef.current.paused) {
        try {
            await faceMeshRef.current.send({ image: videoRef.current });
        } catch(error) {
            console.error("MediaPipe send failed:", error);
        }
    }
    animationFrameRef.current = requestAnimationFrame(detectionLoop);
  }, []);
  
  // Inicialização do hook (executado uma única vez)
  useEffect(() => {
    const videoElement = document.createElement('video');
    videoElement.autoplay = true;
    videoElement.muted = true;
    // **A CORREÇÃO CRÍTICA:** Manter o vídeo "visível" para o navegador, mas imperceptível para o usuário.
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
      if (faceMeshRef.current) {
        faceMeshRef.current.close();
      }
      if (videoElement.parentNode) {
        document.body.removeChild(videoElement);
      }
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
      
      // O evento `onplaying` é a maneira mais robusta de garantir que o vídeo está pronto
      videoElement.onplaying = () => {
        setTrackingStatus('Iniciando detecção...');
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        animationFrameRef.current = requestAnimationFrame(detectionLoop);
      };

      setIsActive(true);

    } catch (error) {
      console.error('Falha ao iniciar a rolagem facial:', error);
      setTrackingStatus('Erro de câmera');
      cleanup();
    }
  }, [cleanup, detectionLoop, isActive]);

  const stop = useCallback(() => {
    cleanup();
  }, [cleanup]);

  const toggleScroll = useCallback(() => {
    setIsScrollEnabled(prev => !prev);
  }, []);

  return { start, stop, isActive, isScrollEnabled, toggleScroll, trackingStatus, videoStream, setSensitivity };
};

export default useFaceScroll;
