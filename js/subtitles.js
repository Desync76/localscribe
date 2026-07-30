/**
 * Mise en forme des sous-titres.
 * Whisper renvoie des segments { timestamp: [debut, fin], text }.
 * La fin du dernier segment est parfois `null` : on retombe alors sur la
 * durée réelle de l'audio.
 */

const DEFAULT_SEGMENT_DURATION = 2;

/** Secondes -> "HH:MM:SS,mmm" (SRT) ou "HH:MM:SS.mmm" (VTT). */
export function formatTimestamp(seconds, separator = ',') {
  const total = Math.max(0, Number(seconds) || 0);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  const ms = Math.round((total - Math.floor(total)) * 1000);

  const pad = (n, size = 2) => String(n).padStart(size, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}${separator}${pad(ms, 3)}`;
}

/** Secondes -> "12:34", pour l'affichage à l'écran. */
export function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/**
 * Nettoie les segments bruts : bornes manquantes, blancs superflus,
 * segments vides. `fallbackEnd` est la durée de l'audio.
 */
export function normalizeChunks(chunks, fallbackEnd = 0) {
  if (!Array.isArray(chunks)) return [];

  return chunks
    .map((chunk, i) => {
      const [rawStart, rawEnd] = chunk.timestamp ?? [];
      const start = Number.isFinite(rawStart) ? rawStart : 0;

      // Priorité pour la borne de fin : la valeur donnée, sinon le début du
      // segment suivant, sinon la durée de l'audio, sinon un défaut.
      let end = rawEnd;
      if (!Number.isFinite(end)) {
        const nextStart = chunks[i + 1]?.timestamp?.[0];
        if (Number.isFinite(nextStart)) end = nextStart;
        else if (fallbackEnd > start) end = fallbackEnd;
        else end = start + DEFAULT_SEGMENT_DURATION;
      }

      return { start, end: Math.max(end, start), text: (chunk.text ?? '').trim() };
    })
    .filter((chunk) => chunk.text.length > 0);
}

/** Sous-titres SubRip (.srt). */
export function toSRT(chunks) {
  return chunks
    .map((chunk, i) =>
      `${i + 1}\n` +
      `${formatTimestamp(chunk.start, ',')} --> ${formatTimestamp(chunk.end, ',')}\n` +
      `${chunk.text}\n`
    )
    .join('\n');
}

/** Sous-titres WebVTT (.vtt), le format des balises <track> HTML. */
export function toVTT(chunks) {
  const body = chunks
    .map((chunk) =>
      `${formatTimestamp(chunk.start, '.')} --> ${formatTimestamp(chunk.end, '.')}\n` +
      `${chunk.text}\n`
    )
    .join('\n');

  return `WEBVTT\n\n${body}`;
}

/** Texte seul, un paragraphe par blanc marqué dans le flux. */
export function toTXT(chunks) {
  return chunks.map((chunk) => chunk.text).join(' ').replace(/\s+/g, ' ').trim();
}

export const EXPORTERS = {
  srt: { build: toSRT, extension: 'srt', mime: 'text/plain;charset=utf-8' },
  vtt: { build: toVTT, extension: 'vtt', mime: 'text/vtt;charset=utf-8' },
  txt: { build: toTXT, extension: 'txt', mime: 'text/plain;charset=utf-8' },
};
