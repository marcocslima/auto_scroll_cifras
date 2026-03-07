
import { useRef, useEffect, useState, useCallback } from 'react';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';

const useFaceScroll = (videoRef, sensitivity) => {
  const scrollableRef = useRef(null);
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [isTrackingActive, setIsTrackingActive] = useState(false);
  const [trackingStatus, setTrackingStatus] = useState('Aguardando câmera...');

  const [isScrollEnabled, setIsScrollEnabled] = useState(true); 

  const toggleScrollEnabled = useCallback(() => {
    setIsScrollEnabled(prev => !prev);
  }, []);

  useEffect(() => {
    if (!isCameraEnabled || !videoRef.current) {
      setTrackingStatus('Aguardando câmera...');
      return;
    }

    // Se a rolagem estiver desativada, desliga a câmera e o rastreamento.
    // A função de limpeza do useEffect anterior já terá chamado camera.stop().
    if (!isScrollEnabled) {
      setTrackingStatus('Rolagem desativada');
      setIsTrackingActive(false);
      return; // Impede a reinicialização da câmera
    }

    setTrackingStatus('Iniciando câmera...');

    const faceMesh = new FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });

    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    const camera = new Camera(videoRef.current, {
      onFrame: async () => {
        await faceMesh.send({ image: videoRef.current });
      },
      width: 1280,
      height: 720,
    });
    camera.start();

    const onResults = (results) => {
      const faceDetected = results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0;

      if (!faceDetected) {
        setTrackingStatus('Rosto não detectado');
        setIsTrackingActive(false);
        return;
      }
      
      setTrackingStatus('Rolagem Ativa');
      setIsTrackingActive(true);

      const nose = results.multiFaceLandmarks[0][1];
      if (!nose || !scrollableRef.current) return;

      const y = nose.y;
      const deadzone = 0.05;
      const scrollSpeed = sensitivity;

      if (y > 0.5 + deadzone) {
        const scrollAmount = (y - (0.5 + deadzone)) * scrollSpeed;
        scrollableRef.current.scrollTop += scrollAmount;
      } else if (y < 0.5 - deadzone) {
        const scrollAmount = ((0.5 - deadzone) - y) * scrollSpeed;
        scrollableRef.current.scrollTop -= scrollAmount;
      }
    };

    faceMesh.onResults(onResults);

    // Função de limpeza: será chamada quando o componente desmontar ou quando isScrollEnabled mudar
    return () => {
      camera.stop();
      faceMesh.close();
    };
  }, [isCameraEnabled, videoRef, sensitivity, isScrollEnabled]);

  return { scrollableRef, setIsCameraEnabled, isTrackingActive, trackingStatus, isScrollEnabled, toggleScrollEnabled };
};

export default useFaceScroll;
