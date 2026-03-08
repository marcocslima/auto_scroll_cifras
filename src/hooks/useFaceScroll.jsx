
import { useRef, useEffect, useState, useCallback } from 'react';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';

const useFaceScroll = (videoRef, sensitivity) => {
  const scrollableRef = useRef(null); // This ref can still be useful if you want to scroll a specific element in the future.
  
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [isScrollEnabled, setIsScrollEnabled] = useState(true);
  const [trackingStatus, setTrackingStatus] = useState('Aguardando câmera...');
  
  const isScrollEnabledRef = useRef(isScrollEnabled);
  const sensitivityRef = useRef(sensitivity);

  useEffect(() => {
    isScrollEnabledRef.current = isScrollEnabled;
  }, [isScrollEnabled]);

  useEffect(() => {
    sensitivityRef.current = sensitivity;
  }, [sensitivity]);

  const toggleScrollEnabled = useCallback(() => {
    setIsScrollEnabled(prev => !prev);
  }, []);

  useEffect(() => {
    if (!isCameraEnabled || !videoRef.current) {
      setTrackingStatus('Aguardando câmera...');
      return;
    }

    setTrackingStatus('Iniciando câmera...');
    let camera = null;

    const faceMesh = new FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });

    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    const onResults = (results) => {
      const faceDetected = results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0;

      if (!faceDetected) {
        setTrackingStatus('Rosto não detectado');
        return;
      }
      
      if (!isScrollEnabledRef.current) {
        setTrackingStatus('Rolagem pausada');
        return;
      }

      setTrackingStatus('Rolagem Ativa');

      const nose = results.multiFaceLandmarks[0][1];
      if (!nose) return;

      const y = nose.y;
      const deadzone = 0.05;
      const scrollSpeed = sensitivityRef.current;

      // Use window.scrollBy for global page scrolling
      if (y > 0.5 + deadzone) {
        const scrollAmount = (y - (0.5 + deadzone)) * scrollSpeed;
        window.scrollBy(0, scrollAmount);
      } else if (y < 0.5 - deadzone) {
        const scrollAmount = ((0.5 - deadzone) - y) * scrollSpeed;
        window.scrollBy(0, -scrollAmount);
      }
    };

    faceMesh.onResults(onResults);

    if (videoRef.current) {
        camera = new Camera(videoRef.current, {
            onFrame: async () => {
                if (videoRef.current) {
                    await faceMesh.send({ image: videoRef.current });
                }
            },
            width: 1280,
            height: 720,
        });
        camera.start();
    }
    
    return () => {
      if (camera) {
        camera.stop();
      }
      faceMesh.close();
      setTrackingStatus('Aguardando câmera...');
    };
  }, [isCameraEnabled, videoRef]);

  return { 
    scrollableRef, 
    isCameraEnabled, 
    setIsCameraEnabled, 
    trackingStatus, 
    isScrollEnabled, 
    toggleScrollEnabled 
  };
};

export default useFaceScroll;
