
import React, { useState } from 'react';
import { db } from '../firebase/config';
import { collection, writeBatch, doc } from 'firebase/firestore';

// Helper function to parse Markdown into a song object
const parseMarkdownToSong = (markdown) => {
  const lines = markdown.split('\n');
  let title = '';
  let artist = '';
  let tone = '';
  const lyrics = [];
  let isInsideLyricsBlock = false;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('# ')) {
      title = trimmedLine.substring(2).trim();
    } else if (trimmedLine.startsWith('## ')) {
      artist = trimmedLine.substring(3).trim();
    } else if (trimmedLine.toLowerCase().startsWith('tom:')) {
      tone = trimmedLine.substring(4).trim();
    } else if (trimmedLine === '```text') {
      isInsideLyricsBlock = true;
    } else if (trimmedLine === '```') {
      isInsideLyricsBlock = false;
    } else if (isInsideLyricsBlock) {
      const match = line.match(/^\s*(?:\[(.*?)\])?\s*(.*)/);
      if (match) {
        lyrics.push({ chord: match[1] || '', lyric: match[2] || '' });
      }
    }
  }
  return { title, artist, tone: tone || '', chords: lyrics }; // Garante que o tom seja ao menos uma string vazia
};


// Component for bulk uploading songs from a Markdown file
const BulkUpload = () => {
  const [file, setFile] = useState(null);
  const [feedback, setFeedback] = useState({ message: '', type: '' });
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setFeedback({ message: '', type: '' });
  };

  const handleUpload = async () => {
    if (!file) {
      setFeedback({ message: 'Por favor, selecione um arquivo de texto (.txt, .md).', type: 'error' });
      return;
    }

    setIsUploading(true);
    setFeedback({ message: 'Lendo o arquivo...', type: 'info' });

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        let content = e.target.result;

        // Normalize file content: remove BOM, normalize line endings
        if (content.charCodeAt(0) === 0xFEFF) {
          content = content.slice(1);
        }
        content = content.replace(/\r\n/g, '\n');

        // Split songs by '---' on its own line, allowing for surrounding whitespace
        const songMarkdowns = content.split(/^\s*---\s*$/m);

        if (songMarkdowns.length === 0 || (songMarkdowns.length === 1 && songMarkdowns[0].trim() === '')) {
          throw new Error("O arquivo parece estar vazio ou não contém o separador '---' entre as músicas.");
        }

        setFeedback({ message: `Encontradas ${songMarkdowns.length} músicas. Processando e enviando...`, type: 'info' });

        const batch = writeBatch(db);
        const songsCollection = collection(db, 'songs');
        let processedCount = 0;

        songMarkdowns.forEach(markdown => {
          if (markdown.trim() === '') return;

          const song = parseMarkdownToSong(markdown);
          
          // O campo 'tom' agora é opcional
          if (song.title && song.artist && song.chords.length > 0) {
            const newSongRef = doc(songsCollection);
            batch.set(newSongRef, song);
            processedCount++;
          } else {
            console.warn('Música ignorada por formato incompleto (requer título, artista e cifra):', markdown);
          }
        });

        if (processedCount === 0) {
             throw new Error("Nenhuma música válida foi encontrada no arquivo. Verifique se o formato inclui título, artista e a cifra entre \`\`\`text...\`\`\`.");
        }

        await batch.commit();

        setFeedback({ message: `Sucesso! ${processedCount} de ${songMarkdowns.length} músicas foram enviadas.`, type: 'success' });
        // Limpa o input de arquivo para permitir o re-upload do mesmo arquivo
        if (document.getElementById('bulk-upload-input')) {
          document.getElementById('bulk-upload-input').value = '';
        }
        setFile(null);

      } catch (error) {
        console.error("Erro no upload em lote:", error);
        setFeedback({ message: `Erro: ${error.message}.`, type: 'error' });
      }
      setIsUploading(false);
    };

    reader.onerror = () => {
        setFeedback({ message: 'Falha ao ler o arquivo.', type: 'error' });
        setIsUploading(false);
    };

    reader.readAsText(file);
  };

  const feedbackColor = {
    error: 'text-red-500',
    success: 'text-green-500',
    info: 'text-blue-400'
  }[feedback.type] || 'text-gray-400';

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg mt-10 border border-gray-700">
      <h2 className="text-2xl font-bold mb-4 border-b border-gray-600 pb-2">Upload de Músicas em Lote</h2>
      <div className="mb-4 text-sm text-gray-400 space-y-2">
        <p>Selecione um arquivo (<code className="bg-gray-900 p-1 rounded">.txt</code> ou <code className="bg-gray-900 p-1 rounded">.md</code>) com uma ou mais cifras.</p>
        <p>Use <code className="bg-gray-900 p-1 rounded">---</code> em uma linha para separar as músicas.</p>
        <pre className="bg-gray-900 p-3 rounded-md text-xs overflow-x-auto">
          # Título\n## Artista\nTom: C (Opcional)\n\n```text\n[Am] Letra...\n```
        </pre>
      </div>
      
      <div className="flex items-center space-x-4">
        <input 
          id="bulk-upload-input"
          type="file" 
          accept=".txt,.md,text/plain"
          onChange={handleFileChange}
          disabled={isUploading}
          className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 disabled:opacity-50" 
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
