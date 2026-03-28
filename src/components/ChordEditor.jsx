
import React, { useState, useEffect } from 'react';

// Helper to parse markdown into a structured object
const parseMarkdown = (markdown) => {
  if (!markdown) return { title: '', artist: '', lines: [{ chord: '', lyric: '' }] };

  const markdownLines = markdown.split('\n');
  let title = '';
  let artist = '';
  const lines = [];
  let inLyricsBlock = false;

  for (const line of markdownLines) {
    if (line.startsWith('# ')) {
      title = line.substring(2).trim();
    } else if (line.startsWith('## ')) {
      artist = line.substring(3).trim();
    } else if (line.trim() === '```text') {
      inLyricsBlock = true;
    } else if (line.trim() === '```') {
      inLyricsBlock = false;
    } else if (inLyricsBlock) {
      const match = line.match(/^\[(.*?)\]\s*(.*)/);
      if (match) {
        lines.push({ chord: match[1], lyric: match[2] });
      } else {
        lines.push({ chord: '', lyric: line });
      }
    }
  }

  // If there are no lines, add a default empty one
  if (lines.length === 0) {
      lines.push({ chord: '', lyric: '' });
  }

  return { title, artist, lines };
};

// Helper to convert the structured object back to markdown
const toMarkdown = ({ title, artist, lines }) => {
  const lyrics = lines.map(line => {
    if (line.chord) {
      return `[${line.chord}] ${line.lyric}`;
    }
    return line.lyric;
  }).join('\n');

  return `# ${title}\n## ${artist}\n\n\`\`\`text\n${lyrics}\n\`\`\``;
};

const ChordEditor = ({ initialContent, onContentChange }) => {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [lines, setLines] = useState([{ chord: '', lyric: '' }]);

  // Effect to parse incoming markdown from props
  useEffect(() => {
    if (initialContent) {
      const { title, artist, lines } = parseMarkdown(initialContent);
      setTitle(title);
      setArtist(artist);
      setLines(lines);
    }
  }, [initialContent]);

  // Effect to notify parent component of changes
  useEffect(() => {
    const markdown = toMarkdown({ title, artist, lines });
    if (onContentChange) {
      onContentChange(markdown);
    }
  }, [title, artist, lines, onContentChange]);

  const handleLineChange = (index, field, value) => {
    const newLines = [...lines];
    newLines[index][field] = value;
    setLines(newLines);
  };

  const addLine = () => {
    setLines([...lines, { chord: '', lyric: '' }]);
  };

  const removeLine = (index) => {
    const newLines = lines.filter((_, i) => i !== index);
    setLines(newLines);
  };

  return (
    <div className="space-y-4">
      {/* Title and Artist Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="editor-title" className="block text-sm font-medium mb-1">Título</label>
          <input
            id="editor-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg"
            placeholder="Título da Música"
          />
        </div>
        <div>
          <label htmlFor="editor-artist" className="block text-sm font-medium mb-1">Artista</label>
          <input
            id="editor-artist"
            type="text"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg"
            placeholder="Nome do Artista"
          />
        </div>
      </div>

      {/* Lyrics Editor */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">Cifra e Letra</label>
        {lines.map((line, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              type="text"
              value={line.chord}
              onChange={(e) => handleLineChange(index, 'chord', e.target.value)}
              className="bg-gray-600 text-white w-20 text-center px-2 py-1 rounded-md"
              placeholder="Cifra"
            />
            <input
              type="text"
              value={line.lyric}
              onChange={(e) => handleLineChange(index, 'lyric', e.target.value)}
              className="w-full bg-gray-700 text-white px-3 py-1 rounded-lg"
              placeholder="Letra da linha"
            />
            <button
              type="button"
              onClick={() => removeLine(index)}
              className="bg-red-600 text-white px-2 py-1 rounded-md hover:bg-red-700"
            >
              &times;
            </button>
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="text-left">
        <button
          type="button"
          onClick={addLine}
          className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700"
        >
          Adicionar Linha
        </button>
      </div>
    </div>
  );
};

export default ChordEditor;
