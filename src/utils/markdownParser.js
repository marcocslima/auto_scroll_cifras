
// Converte o conteúdo Markdown em um objeto de música estruturado
export const parseMarkdownToSong = (markdown) => {
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
  return { title, artist, tone, chords: lyrics };
};

// Converte um objeto de música de volta para o formato Markdown
export const convertSongToMarkdown = (song) => {
  if (!song) return '';
  const title = song.title ? `# ${song.title}` : '';
  const artist = song.artist ? `## ${song.artist}` : '';
  const tone = song.tone ? `Tom: ${song.tone}` : '';
  
  const lyricsContent = (song.chords || []).map(line => {
    return line.chord ? `[${line.chord}] ${line.lyric}` : line.lyric;
  }).join('\n');

  return [title, artist, tone, '\n```text', lyricsContent, '```'].filter(Boolean).join('\n');
};
