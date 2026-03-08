
import React, { useState } from 'react';
import { db } from '../firebase/config';
import { collection, addDoc, writeBatch, doc } from 'firebase/firestore';

// ====================================================================================
// COMPONENTE PARA UPLOAD DE MÚSICAS EM LOTE
// ====================================================================================
const BulkUpload = () => {
  const [file, setFile] = useState(null);
  const [feedback, setFeedback] = useState({ message: '', type: '' }); // type: 'success' or 'error'
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setFeedback({ message: '', type: '' });
  };

  const handleUpload = async () => {
    if (!file) {
      setFeedback({ message: 'Por favor, selecione um arquivo JSON.', type: 'error' });
      return;
    }

    setIsUploading(true);
    setFeedback({ message: 'Lendo o arquivo...', type: 'info' });

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const songs = JSON.parse(e.target.result);
        
        if (!Array.isArray(songs)) {
            throw new Error('O arquivo JSON deve conter um array de músicas.');
        }

        setFeedback({ message: `Encontradas ${songs.length} músicas. Iniciando upload para o Firestore...`, type: 'info' });

        // Usar um lote (batch) é muito mais eficiente para múltiplas escritas
        const batch = writeBatch(db);
        const songsCollection = collection(db, 'songs');

        songs.forEach(song => {
          // Validação básica de cada objeto de música
          if (!song.title || !song.artist || !song.tone || !song.chords) {
            console.warn('Música ignorada por ter formato inválido:', song);
            return; // Pula esta música
          }
          const newSongRef = doc(songsCollection);
          batch.set(newSongRef, song);
        });

        await batch.commit();

        setFeedback({ message: `Sucesso! ${songs.length} músicas foram enviadas.`, type: 'success' });
        setFile(null); // Limpa o input

      } catch (error) {
        console.error("Erro no upload em lote:", error);
        setFeedback({ message: `Erro: ${error.message}. Verifique o console para mais detalhes.`, type: 'error' });
      }
      setIsUploading(false);
    };

    reader.onerror = () => {
        setFeedback({ message: 'Falha ao ler o arquivo.', type: 'error' });
        setIsUploading(false);
    };

    reader.readAsText(file);
  };

  // Define a cor da mensagem de feedback com base no tipo
  const feedbackColor = {
    error: 'text-red-500',
    success: 'text-green-500',
    info: 'text-blue-400'
  }[feedback.type] || 'text-gray-400';

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg mt-10 border border-gray-700">
      <h2 className="text-2xl font-bold mb-4 border-b border-gray-600 pb-2">Upload de Músicas em Lote</h2>
      <p className="text-gray-400 mb-4 text-sm">Selecione um arquivo <code className="bg-gray-900 p-1 rounded">.json</code> contendo um array de músicas para adicionar ao banco de dados.</p>
      
      <div className="flex items-center space-x-4">
        <input 
          type="file" 
          accept=".json"
          onChange={handleFileChange}
          disabled={isUploading}
          className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 disabled:opacity-50" 
        />
        <button 
          onClick={handleUpload} 
          disabled={!file || isUploading}
          className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {isUploading ? 'Enviando...' : 'Enviar Lote'}
        </button>
      </div>
      
      {feedback.message && (
        <p className={`mt-4 text-sm ${feedbackColor}`}>{feedback.message}</p>
      )}
    </div>
  );
};

export default BulkUpload;
