
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// A configuração do seu projeto Firebase
const firebaseConfig = {
  apiKey: "AIzaSyA8idPjUMLgXIa_jEccTBoNgMCaqyeD9os",
  authDomain: "autoscrollcifras.firebaseapp.com",
  projectId: "autoscrollcifras",
  storageBucket: "autoscrollcifras.firebasestorage.app",
  messagingSenderId: "687618882909",
  appId: "1:687618882909:web:9ab80e74bd72107a613cb4"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Exporta os serviços que vamos usar no restante da aplicação
export const auth = getAuth(app);
export const db = getFirestore(app);
