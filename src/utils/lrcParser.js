const LRC_LINE_REGEX = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]([^[]*)/g;

export const normalizeSectionKey = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

export const parseTimestampToMs = (timestamp) => {
  if (typeof timestamp !== 'string') return null;

  const trimmed = timestamp.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?$/);
  if (!match) return null;

  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  const decimalPart = match[3] || '0';

  if (Number.isNaN(minutes) || Number.isNaN(seconds) || seconds > 59) return null;

  // LRC normalmente usa centésimos (2 dígitos), mas aceitamos 1-3 dígitos
  const ms = Number(decimalPart.padEnd(3, '0').slice(0, 3));
  return minutes * 60 * 1000 + seconds * 1000 + ms;
};

export const formatMsToTimer = (ms) => {
  const safeMs = Math.max(0, Math.floor(ms));
  const totalSeconds = Math.floor(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((safeMs % 1000) / 10);

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
};

export const parseLRC = (lrcString) => {
  if (!lrcString || typeof lrcString !== 'string') return [];

  const entries = [];
  const lines = lrcString.split(/\r?\n/);

  lines.forEach((rawLine) => {
    const textLine = rawLine.trim();
    if (!textLine) return;

    let match;
    while ((match = LRC_LINE_REGEX.exec(textLine)) !== null) {
      const minutes = Number(match[1]);
      const seconds = Number(match[2]);
      const rawDecimal = match[3] || '0';
      const text = (match[4] || '').trim();

      if (Number.isNaN(minutes) || Number.isNaN(seconds) || seconds > 59) continue;

      const milliseconds = Number(rawDecimal.padEnd(3, '0').slice(0, 3));
      const timeMs = minutes * 60 * 1000 + seconds * 1000 + milliseconds;

      entries.push({
        timeMs,
        timeLabel: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${rawDecimal.padEnd(2, '0').slice(0, 2)}`,
        text,
      });
    }

    LRC_LINE_REGEX.lastIndex = 0;
  });

  return entries.sort((a, b) => a.timeMs - b.timeMs);
};

const parseLineTarget = (value) => {
  if (typeof value !== 'string') return null;

  const directLineMatch = value.match(/^line-(\d+)$/i);
  if (directLineMatch) return { type: 'line', lineIndex: Number(directLineMatch[1]) };

  const linhaMatch = value.match(/^linha\s*-?\s*(\d+)$/i);
  if (linhaMatch) return { type: 'line', lineIndex: Math.max(0, Number(linhaMatch[1]) - 1) };

  const plainNumberMatch = value.match(/^\d+$/);
  if (plainNumberMatch) return { type: 'line', lineIndex: Math.max(0, Number(value) - 1) };

  return null;
};

export const parseLrcMapping = (mappingInput) => {
  if (!mappingInput) return [];

  let mappingObject = mappingInput;
  if (typeof mappingInput === 'string') {
    try {
      mappingObject = JSON.parse(mappingInput);
    } catch (error) {
      console.warn('lrcMapping inválido (JSON malformado):', error);
      return [];
    }
  }

  if (typeof mappingObject !== 'object' || Array.isArray(mappingObject)) return [];

  return Object.entries(mappingObject)
    .map(([timestamp, target]) => {
      const timeMs = parseTimestampToMs(timestamp);
      if (timeMs === null) return null;

      const targetValue = String(target || '').trim();
      const lineTarget = parseLineTarget(targetValue);
      if (lineTarget) {
        return {
          timeMs,
          timestamp,
          targetRaw: targetValue,
          targetType: lineTarget.type,
          lineIndex: lineTarget.lineIndex,
        };
      }

      const sectionMatch = targetValue.match(/^section-(\d+)$/i);
      if (sectionMatch) {
        return {
          timeMs,
          timestamp,
          targetRaw: targetValue,
          targetType: 'section',
          sectionIndex: Number(sectionMatch[1]),
          sectionKey: null,
        };
      }

      return {
        timeMs,
        timestamp,
        targetRaw: targetValue,
        targetType: 'section',
        sectionIndex: null,
        sectionKey: normalizeSectionKey(targetValue),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.timeMs - b.timeMs);
};
