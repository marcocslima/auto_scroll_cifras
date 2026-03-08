
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

// Importa a nossa nova função de inicialização do Firebase
import { initializeOfflinePersistence } from './firebase/config.js';

// Pega o elemento raiz da página
const rootElement = document.getElementById('root');
const root = createRoot(rootElement);

// Exibe uma mensagem de carregamento inicial
root.render(
  <StrictMode>
    <p>Inicializando o aplicativo e o modo offline...</p>
  </StrictMode>
);

// Chama a função para ativar a persistência offline.
// O .then() garante que o código dentro dele só será executado
// DEPOIS que a ativação da persistência for concluída.
initializeOfflinePersistence().then(() => {
  // Agora que a persistência está pronta, renderiza o aplicativo principal
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});
