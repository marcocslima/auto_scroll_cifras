
import React, { useState, useEffect } from 'react';

const ChordEditor = ({ initialContent, onContentChange }) => {
  const [content, setContent] = useState(initialContent || '');

  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  const handleChange = (e) => {
    setContent(e.target.value);
    if (onContentChange) {
      onContentChange(e.target.value);
    }
  };

  return (
    <div>
      <textarea
        value={content}
        onChange={handleChange}
        rows="15"
        className="w-full bg-gray-700 text-white font-mono px-3 py-2 rounded-lg"
        placeholder={
`# Título da Música
## Nome do Artista

\`\`\`text
[Am] Letra da primeira linha
[C] Letra da segunda linha
...
\`\`\``
        }
        required
      />
    </div>
  );
};

export default ChordEditor;
