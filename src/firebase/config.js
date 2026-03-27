
import { initializeApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyA8idPjUMLgXIa_jEccTBoNgMCaqyeD9os",
  authDomain: "autoscrollcifras.firebaseapp.com",
  projectId: "autoscrollcifras",
  storageBucket: "autoscrollcifras.firebasestorage.app",
  messagingSenderId: "687618882909",
  appId: "1:687618882909:web:9ab80e74bd72107a613cb4"
};

// Inicializa o app do Firebase
const app = initializeApp(firebaseConfig);

// Exporta as instâncias de Auth e Firestore para serem usadas após a inicialização
export const auth = getAuth(app);
export const db = getFirestore(app);

/**
 * Função de inicialização assíncrona.
 * Ativa a persistência offline e retorna uma promessa que resolve quando tudo está pronto.
 * Isso deve ser chamado no ponto de entrada do aplicativo (main.jsx) ANTES de renderizar o app.
 */
export const initializeOfflinePersistence = () => {
  return enableIndexedDbPersistence(db)
    .then(() => {
      console.log("Persistência offline ativada com sucesso.");
    })
    .catch((err) => {
      if (err.code === 'failed-precondition') {
        console.warn("Firestore (info): A persistência não foi ativada, múltiplas abas abertas?");
      } else if (err.code === 'unimplemented') {
        console.warn("Firestore (aviso): O navegador não suporta persistência offline.");
      }
      return Promise.resolve(); // Continua a execução do app mesmo se a persistência falhar
    });
};
