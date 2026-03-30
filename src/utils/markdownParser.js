
// Lista de acordes válidos para detecção
const CHORD_PATTERN = /^[A-G][#b]?(?:m|dim|aug|maj|sus|add|°|º)?[0-9]?(?:\([^)]*\))?(?:\/[A-G][#b]?)?$/;

// Verifica se um token é um acorde válido
const isChord = (token) => {
  // Remove pontos finais comuns em cifras
  const cleaned = token.replace(/\.+$/, '');
  return CHORD_PATTERN.test(cleaned);
};

// Verifica se uma linha contém apenas acordes (e espaços)
const isChordOnlyLine = (line) => {
  const trimmed = line.trim();
  if (!trimmed) return false;
  
  // Linhas que começam com palavras-chave especiais como "Intro:", "Solo:" são tratadas como texto
  if (/^(Intro|Solo|Refrão|Coda|Bridge|Ponte|Final|Riff)\s*:/i.test(trimmed)) return false;
  
  // Linhas entre parênteses com acordes (ex: "( G C Em D )") - tratar como texto/instrução
  if (/^\(.*\)$/.test(trimmed)) return false;
  
  const tokens = trimmed.split(/\s+/);
  return tokens.length > 0 && tokens.every(t => isChord(t));
};

// Extrai acordes e suas posições de coluna de uma linha de acordes
const extractChordPositions = (chordLine) => {
  const chords = [];
  const regex = /\S+/g;
  let match;
  while ((match = regex.exec(chordLine)) !== null) {
    chords.push({ chord: match[0], position: match.index });
  }
  return chords;
};

// Extrai acordes no formato [Chord] inline com a letra
const parseInlineChords = (line) => {
  const chords = [];
  let lyric = '';
  let currentPos = 0;
  const regex = /\[([^\]]+)\]/g;
  let match;
  
  while ((match = regex.exec(line)) !== null) {
    // Adiciona o texto antes do acorde à letra
    const textBefore = line.substring(currentPos, match.index);
    lyric += textBefore;
    
    // Registra a posição do acorde na letra resultante
    chords.push({ chord: match[1], position: lyric.length });
    currentPos = match.index + match[0].length;
  }
  
  // Adiciona o texto restante após o último acorde
  lyric += line.substring(currentPos);
  
  return { chords, lyric };
};

// Converte o conteúdo Markdown em um objeto de música estruturado
export const parseMarkdownToSong = (markdown) => {
  const lines = markdown.split('\n');
  let title = '';
  let artist = '';
  let tone = '';
  const lyrics = [];
  let isInsideLyricsBlock = false;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith('# ')) {
      title = trimmedLine.substring(2).trim();
      i++;
    } else if (trimmedLine.startsWith('## ')) {
      artist = trimmedLine.substring(3).trim();
      i++;
    } else if (trimmedLine.toLowerCase().startsWith('tom:')) {
      tone = trimmedLine.substring(4).trim();
      i++;
    } else if (trimmedLine === '```text') {
      isInsideLyricsBlock = true;
      i++;
    } else if (trimmedLine === '```') {
      isInsideLyricsBlock = false;
      i++;
    } else if (isInsideLyricsBlock) {
      // Verifica se a linha contém acordes no formato [chord]
      if (/\[[^\]]+\]/.test(line)) {
        const { chords, lyric } = parseInlineChords(line);
        lyrics.push({ chords, lyric: lyric.trim() });
        i++;
      }
      // Verifica se é uma linha somente de acordes (formato cifra)
      else if (isChordOnlyLine(line)) {
        const chordPositions = extractChordPositions(line);
        
        // Olha a próxima linha para ver se é a letra associada
        const nextLine = (i + 1 < lines.length) ? lines[i + 1] : '';
        const nextTrimmed = nextLine.trim();
        
        // Se a próxima linha é letra (não é acorde, não é fechamento de bloco, não é vazia)
        if (nextTrimmed && nextTrimmed !== '```' && !isChordOnlyLine(nextLine)) {
          lyrics.push({ chords: chordPositions, lyric: line.trimEnd() + '\n' + nextLine.trimEnd(), isChordLyricPair: true });
          i += 2; // Pula a linha de acordes E a linha de letra
        } else {
          // Linha de acordes sem letra associada
          lyrics.push({ chords: chordPositions, lyric: line.trimEnd(), isChordLyricPair: false });
          i++;
        }
      }
      // Linha vazia
      else if (!trimmedLine) {
        lyrics.push({ chords: [], lyric: '' });
        i++;
      }
      // Linha de letra pura (sem acordes)
      else {
        lyrics.push({ chords: [], lyric: line.trimEnd() });
        i++;
      }
    } else {
      i++;
    }
  }
  
  return { title, artist, tone, chords: lyrics };
};

// Converte um objeto de música de volta para o formato Markdown (cifra-style)
export const convertSongToMarkdown = (song) => {
  if (!song) return '';
  const title = song.title ? `# ${song.title}` : '';
  const artist = song.artist ? `## ${song.artist}` : '';
  const tone = song.tone ? `Tom: ${song.tone}` : '';
  
  const lyricsContent = (song.chords || []).map(line => {
    if (line.isChordLyricPair && line.chords && line.chords.length > 0) {
      // Reconstrói a linha de acordes com posicionamento por coluna
      let chordLine = '';
      line.chords.forEach(c => {
        while (chordLine.length < c.position) chordLine += ' ';
        chordLine += c.chord;
      });
      // Divide o lyric no \n para obter a linha da letra separada
      const parts = line.lyric.split('\n');
      return parts.length > 1 ? chordLine + '\n' + parts[1] : chordLine + '\n' + line.lyric;
    }
    
    if (line.chords && line.chords.length > 0 && !line.isChordLyricPair) {
      // Linha só de acordes
      return line.lyric;
    }
    
    // Linha de letra pura ou vazia
    return line.lyric;
  }).join('\n');

  return [title, artist, tone, '\n```text', lyricsContent, '```'].filter(Boolean).join('\n');
};
