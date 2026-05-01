
import { parseLRC } from './lrcParser';

// Normaliza o texto para uma comparação mais confiável.
const normalizeText = (text = '') => {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
};

/**
 * Cria uma lista de pares {letra, acordes} a partir da cifra original.
 * Isso lida com o padrão comum de uma linha de acordes seguida por uma linha de letra.
 * @param {Array} originalChords - A estrutura de dados original da cifra.
 * @returns {Array<{normalized: string, chords: Array}>}
 */
const createChordList = (originalChords) => {
    const list = [];
    if (!originalChords) return list;

    let pendingChords = [];

    originalChords.forEach(line => {
        const hasLyrics = line.lyric && line.lyric.trim() !== '';
        const hasChords = line.chords && line.chords.length > 0;

        // Caso 1: A linha contém apenas acordes. Guardamos eles.
        if (hasChords && !hasLyrics) {
            pendingChords = line.chords;
        } 
        // Caso 2: A linha contém letra.
        else if (hasLyrics) {
            const normalizedLyric = normalizeText(line.lyric);
            // Associa a letra aos acordes que estavam "pendentes" da linha anterior.
            const chordsForThisLine = pendingChords.length > 0 ? pendingChords : [];
            
            list.push({
                normalized: normalizedLyric,
                chords: chordsForThisLine
            });
            
            // Limpa os acordes pendentes, pois já foram usados.
            pendingChords = [];
        } 
        // Caso 3: Linha vazia. Limpa os acordes pendentes.
        else {
            pendingChords = [];
        }
    });
    return list;
};

/**
 * Funde a letra LRC com os acordes da cifra.
 * A função agora lida corretamente com letras repetidas (refrões).
 * @param {string} lrcString - A letra no formato LRC.
 * @param {Array} originalChords - A cifra original.
 * @returns {Array<{time: number, lyric: string, chords: Array, id: string}>}
 */
export const mergeLrcWithChords = (lrcString, originalChords) => {
    const lrcLines = parseLRC(lrcString);
    const chordList = createChordList(originalChords);
    const usedChordListIndexes = new Set(); // Controla os acordes já usados

    if (!lrcString) return [];

    return lrcLines.map((lrcLine, index) => {
        const normalizedLrcText = normalizeText(lrcLine.text);
        let foundChords = [];

        // Procura pela primeira correspondência de letra *não utilizada* na lista de acordes.
        let matchIndex = -1;
        for (let i = 0; i < chordList.length; i++) {
            if (!usedChordListIndexes.has(i) && chordList[i].normalized === normalizedLrcText) {
                matchIndex = i;
                break;
            }
        }
        
        if (matchIndex !== -1) {
            foundChords = chordList[matchIndex].chords;
            usedChordListIndexes.add(matchIndex); // Marca como usado para não repetir em outro refrão.
        }

        return {
            time: lrcLine.time,
            lyric: lrcLine.text,
            chords: foundChords,
            id: `lrc-line-${index}`
        };
    });
};
