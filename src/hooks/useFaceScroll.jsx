
import { useRef, useEffect, useState } from 'react';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';

const useFaceScroll = (videoRef, sensitivity) => {
  const scrollableRef = useRef(null);
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  // Novos estados para a lógica de auto-start/stop
  const [isTrackingActive, setIsTrackingActive] = useState(false);
  const [trackingStatus, setTrackingStatus] = useState('Aguardando câmera...');

  useEffect(() => {
    if (!isCameraEnabled || !videoRef.current) {
      setIsTrackingActive(false);
      setTrackingStatus('Aguardando câmera...');
      return;
    }

    setTrackingStatus('Posicione o rosto no centro');

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
        if (isTrackingActive) {
          setIsTrackingActive(false);
        }
        setTrackingStatus('Rosto não detectado');
        return;
      }

      const nose = results.multiFaceLandmarks[0][1];
      if (!nose || !scrollableRef.current) return;

      const y = nose.y;
      const activationZone = { top: 0.4, bottom: 0.6 };

      if (isTrackingActive) {
        setTrackingStatus('Rolagem Ativa');
        const deadzone = 0.05;
        const smoothFactor = 0.5;
        const scrollSpeed = sensitivity;

        if (y > 0.5 + deadzone) {
          const scrollAmount = (y - (0.5 + deadzone)) * scrollSpeed;
          scrollableRef.current.scrollTop += scrollAmount * smoothFactor;
        } else if (y < 0.5 - deadzone) {
          const scrollAmount = ((0.5 - deadzone) - y) * scrollSpeed;
          const returnScrollMultiplier = 1.5;
          scrollableRef.current.scrollTop -= scrollAmount * smoothFactor * returnScrollMultiplier;
        }
      } else {
        if (y > activationZone.top && y < activationZone.bottom) {
          setIsTrackingActive(true);
          setTrackingStatus('Rolagem Ativada!');
        } else {
          setTrackingStatus('Centralize o rosto para ativar');
        }
      }
    };

    faceMesh.onResults(onResults);

    return () => {
      camera.stop();
      faceMesh.close();
    };
  }, [isCameraEnabled, videoRef, sensitivity, isTrackingActive]);

  return { scrollableRef, setIsCameraEnabled, isTrackingActive, trackingStatus };
};

export default useFaceScroll;
