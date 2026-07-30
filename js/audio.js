/**
 * Décodage audio côté navigateur.
 *
 * Whisper attend un signal mono en 16 kHz. En créant l'AudioContext avec
 * `sampleRate: 16000`, le navigateur rééchantillonne pendant le décodage :
 * pas besoin de bibliothèque externe.
 *
 * `decodeAudioData` sait lire les conteneurs vidéo courants (MP4, WebM) en
 * n'en extrayant que la piste audio. Les codecs disponibles dépendent du
 * navigateur, d'où le message d'erreur explicite en cas d'échec.
 */

export const TARGET_SAMPLE_RATE = 16000;

export async function decodeAudioFile(file) {
  const arrayBuffer = await file.arrayBuffer();

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) {
    throw new Error("Ton navigateur ne gère pas l'API Web Audio.");
  }

  const context = new AudioCtx({ sampleRate: TARGET_SAMPLE_RATE });

  let buffer;
  try {
    buffer = await context.decodeAudioData(arrayBuffer);
  } catch {
    throw new Error(
      "Impossible de lire l'audio de ce fichier. Le format ou le codec n'est " +
      'pas géré par ton navigateur — convertis-le en MP3 ou en WAV et réessaie.'
    );
  } finally {
    context.close();
  }

  return { samples: toMono(buffer), duration: buffer.duration };
}

/** Mixe les canaux en un seul, ce qu'attend le modèle. */
function toMono(buffer) {
  if (buffer.numberOfChannels === 1) {
    return buffer.getChannelData(0);
  }

  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);
  const mono = new Float32Array(left.length);

  // Moyenne des deux premiers canaux : suffisant pour de la parole, et c'est
  // ce que fait le pré-traitement de référence de Whisper.
  for (let i = 0; i < mono.length; i++) {
    mono[i] = (left[i] + right[i]) / 2;
  }

  return mono;
}

/** Octets -> "12,4 Mo". */
export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 o';

  const units = ['o', 'ko', 'Mo', 'Go'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;

  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1).replace('.', ',')} ${units[exponent]}`;
}
