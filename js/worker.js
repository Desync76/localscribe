/**
 * Worker de transcription.
 *
 * Tout le travail lourd (téléchargement du modèle puis inférence) se fait ici
 * pour que l'interface reste réactive. Aucune donnée ne sort de la machine :
 * seuls les poids du modèle sont téléchargés, depuis le CDN de Hugging Face.
 */

import {
  pipeline,
  env,
} from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';

// Les modèles viennent du Hub, jamais d'un chemin local servi par le site.
env.allowLocalModels = false;

/** Le pipeline est coûteux à construire : on le garde entre deux fichiers. */
let cached = { key: null, instance: null };

async function getTranscriber(model, device, onProgress) {
  const key = `${model}::${device}`;
  if (cached.key === key && cached.instance) return cached.instance;

  // Un changement de modèle rend l'ancien inutile : on libère la mémoire GPU.
  if (cached.instance) {
    await cached.instance.dispose?.();
    cached = { key: null, instance: null };
  }

  const instance = await pipeline('automatic-speech-recognition', model, {
    device,
    // Sur GPU l'encodeur reste en fp32 (sensible à la précision) tandis que le
    // décodeur, bien plus gros, est quantifié. Sur CPU, q8 partout.
    dtype: device === 'webgpu'
      ? { encoder_model: 'fp32', decoder_model_merged: 'q4' }
      : 'q8',
    progress_callback: onProgress,
  });

  cached = { key, instance };
  return instance;
}

self.addEventListener('message', async (event) => {
  const { type, payload } = event.data;
  if (type !== 'transcribe') return;

  const { samples, model, device, language, task } = payload;

  try {
    const transcriber = await getTranscriber(model, device, (progress) => {
      self.postMessage({ type: 'load-progress', payload: progress });
    });

    self.postMessage({ type: 'transcribe-start' });

    const output = await transcriber(samples, {
      // Whisper ne traite que 30 s à la fois : le pipeline découpe l'audio et
      // recolle les morceaux, le recouvrement évitant les mots coupés net.
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: true,
      language: language || null,
      task,
    });

    self.postMessage({
      type: 'result',
      payload: { text: output.text ?? '', chunks: output.chunks ?? [] },
    });
  } catch (error) {
    self.postMessage({
      type: 'error',
      payload: { message: describeError(error) },
    });
  }
});

/** Traduit les pannes les plus courantes en langage compréhensible. */
function describeError(error) {
  const message = String(error?.message ?? error);

  if (/webgpu|gpu adapter|requestDevice/i.test(message)) {
    return "Ton navigateur n'a pas réussi à utiliser WebGPU. Repasse " +
           "l'accélération sur « CPU » dans les réglages.";
  }
  if (/out of memory|allocation|RangeError/i.test(message)) {
    return 'Mémoire insuffisante pour ce modèle. Essaie un modèle plus petit ' +
           '(Base ou Tiny), ou un fichier plus court.';
  }
  if (/fetch|network|Failed to load|ERR_/i.test(message)) {
    return 'Le téléchargement du modèle a échoué. Vérifie ta connexion et réessaie.';
  }

  return message;
}
