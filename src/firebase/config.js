
import { initializeApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Your web app's Firebase configuration
// The values are read from environment variables for security
const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Auth and Firestore instances for use after initialization
export const auth = getAuth(app);
export const db = getFirestore(app);

/**
 * Asynchronous initialization function.
 * Enables offline persistence and returns a promise that resolves when everything is ready.
 * This should be called at the application's entry point (main.jsx) BEFORE rendering the app.
 */
export const initializeOfflinePersistence = () => {
  return enableIndexedDbPersistence(db)
    .then(() => {
      console.log("Offline persistence enabled successfully.");
    })
    .catch((err) => {
      if (err.code === 'failed-precondition') {
        console.warn("Firestore (info): Persistence could not be enabled, multiple tabs open?");
      } else if (err.code === 'unimplemented') {
        console.warn("Firestore (warning): The browser does not support offline persistence.");
      }
      return Promise.resolve(); // Continue app execution even if persistence fails
    });
};
