
import React, { createContext, useContext } from 'react';
import useFaceScroll from '../hooks/useFaceScroll';

// 1. Criação do Contexto
const SettingsContext = createContext();

// Hook customizado para facilitar o uso do contexto
export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings deve ser usado dentro de um SettingsProvider');
  }
  return context;
};

// 2. Criação do Provedor
export const SettingsProvider = ({ children }) => {
  // O hook useFaceScroll agora vive aqui, no nível mais alto.
  // Seus valores e controles serão compartilhados com toda a aplicação.
  const faceScroll = useFaceScroll();

  // O valor do provedor inclui tudo o que o useFaceScroll retorna.
  // Qualquer componente filho poderá acessar `start`, `stop`, `setSensitivity`, etc.
  return (
    <SettingsContext.Provider value={faceScroll}>
      {children}
    </SettingsContext.Provider>
  );
};
