
/**
 * Converte uma string no formato LRC para um array de objetos.
 * @param {string} lrcString A string contendo a letra no formato LRC.
 * @returns {Array<{time: number, text: string}>} Um array de objetos, onde cada objeto representa uma linha da letra com seu tempo em segundos.
 */
export const parseLRC = (lrcString) => {
  if (!lrcString) {
    return [];
  }

  const lines = lrcString.split('\n');
  const result = [];

  for (const line of lines) {
    const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2})\](.*)/);
    if (match) {
      const [, minutes, seconds, milliseconds, text] = match;
      const time = parseInt(minutes, 10) * 60 + parseInt(seconds, 10) + parseInt(milliseconds, 10) / 100;
      result.push({ time, text: text.trim() });
    }
  }

  return result;
};
