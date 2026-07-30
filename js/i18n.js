/**
 * Internationalisation.
 *
 * L'anglais est la langue de repli ; le français s'active si le navigateur le
 * réclame. La détection se fait uniquement sur `navigator.languages`, jamais
 * sur l'adresse IP : c'est la préférence déclarée de la personne, c'est plus
 * fiable qu'une géolocalisation, et ça ne demande aucun service tiers.
 *
 * Un choix manuel est mémorisé et prime sur la détection.
 */

const STORAGE_KEY = 'localscribe-lang';

export const LOCALES = {
  en: {
    'html.lang': 'en',
    'meta.title': 'LocalScribe — Automatic subtitles, entirely in your browser',
    'meta.description': 'Turn any video or audio into SRT, VTT or plain-text subtitles. Everything runs on your machine — no upload, no account, no limits.',

    'header.tagline': 'Local transcription',
    'header.theme': 'Switch theme',
    'header.language': 'Language',

    'hero.kicker': 'No upload · No account · No limits',
    'hero.title': 'Your videos<br>into subtitles,<br><em>without leaving<br>your machine.</em>',
    'hero.standfirst': 'The transcription model is downloaded into this tab and runs on your own processor. Your file never reaches a server.',

    'facts.formats': 'Formats',
    'facts.languages': 'Languages',
    'facts.cost': 'Cost',
    'facts.cost.value': 'Free',

    'tool.drop': 'Drop',
    'dz.aria': 'Drop an audio or video file, or click to browse',
    'dz.title': 'Drop your file',
    'dz.sub': 'or click to browse',
    'file.change': 'Change',
    'run.label': 'Start transcription',
    'tool.defaults': 'Defaults: {model}, {language}.',
    'tool.edit': 'Change',

    'progress.stage': 'Running',
    'progress.preparing': 'Preparing',
    'progress.loadingModel': 'Loading the model',
    'progress.transcribing': 'Transcribing',
    'progress.modelSize': 'On first run, {size} is downloaded, then cached by your browser.',
    'progress.timeNote': 'Processing time depends on the file length and on your machine.',
    'progress.cancel': 'Cancel',

    'result.stage': 'Output',
    'result.title': 'Result',
    'result.stats': '{segments} segments · {words} words · {duration}',
    'result.download': 'Download .srt',
    'result.copy': 'Copy',
    'result.copied': 'Copied',
    'tabs.segments': 'Segments',
    'tabs.plain': 'Plain text',
    'result.restart': 'Transcribe another file',

    'error.stage': 'Error',
    'error.title': "That didn't work",
    'error.dismiss': 'Start over',

    'options.stage': 'Optional',
    'options.title': 'Settings',
    'options.hint': 'The defaults are fine in most cases.',

    'field.model': 'Model',
    'field.language': 'Spoken language',
    'field.task': 'Task',
    'field.device': 'Acceleration',
    'field.model.cache': 'Downloaded once, then cached.',
    'field.language.hint': 'Setting it explicitly improves the result noticeably.',
    'field.task.hint': 'Whisper only translates into English.',

    'task.transcribe': 'Transcribe',
    'task.translate': 'Translate to English',

    'device.auto': 'Automatic',
    'device.webgpu': 'WebGPU',
    'device.cpu': 'Processor',
    'device.detected': 'WebGPU detected — much faster.',
    'device.unavailable': 'WebGPU unavailable here: the processor will be used.',
    'device.badge.webgpu': 'WebGPU',
    'device.badge.cpu': 'Processor',

    'lang.auto': 'Auto-detect',
    'lang.fr': 'French', 'lang.en': 'English', 'lang.es': 'Spanish',
    'lang.de': 'German', 'lang.it': 'Italian', 'lang.pt': 'Portuguese',
    'lang.nl': 'Dutch', 'lang.ru': 'Russian', 'lang.ar': 'Arabic',
    'lang.ja': 'Japanese', 'lang.ko': 'Korean', 'lang.zh': 'Chinese',

    'model.tiny.tag': 'lightest',
    'model.tiny.note': 'Fastest, but the quality stays rough.',
    'model.base.tag': 'recommended',
    'model.base.note': 'The best balance of speed, size and accuracy.',
    'model.small.tag': 'more accurate',
    'model.small.note': 'Noticeably more faithful, for a slightly longer run.',
    'model.turbo.tag': 'best quality',
    'model.turbo.note': 'The best transcription available. WebGPU strongly advised.',

    'colophon.kicker': 'How it works',
    'colophon.1.title': 'Nothing leaves your machine',
    'colophon.1.body': 'There is no server. The model is downloaded once, then computes locally. Cut your connection after loading: it still works.',
    'colophon.2.title': 'No account, no quota',
    'colophon.2.body': 'No sign-up, no limit on length or number of files. A two-hour podcast goes through as easily as a thirty-second memo.',
    'colophon.3.title': 'Whisper, openly available',
    'colophon.3.body': 'The engine is the speech recognition model released by OpenAI, run here by transformers.js straight in the browser.',

    'err.notMedia': "That file doesn't look like audio or video.",
    'err.noWebAudio': 'Your browser does not support the Web Audio API.',
    'err.decode': "The audio in this file could not be read. Your browser doesn't support the format or codec — convert it to MP3 or WAV and try again.",
    'err.noSpeech': 'No speech was detected in this file.',
    'err.clipboard': 'Your browser denied clipboard access.',
    'err.workerBoot': 'The transcription engine failed to start.',
    'err.webgpu': 'Your browser could not use WebGPU. Switch acceleration to "Processor" in the settings.',
    'err.memory': 'Not enough memory for this model. Try a smaller one (Base or Tiny), or a shorter file.',
    'err.network': 'The model download failed. Check your connection and try again.',
  },

  fr: {
    'html.lang': 'fr',
    'meta.title': 'LocalScribe — Sous-titres automatiques, 100 % dans ton navigateur',
    'meta.description': "Transcris tes vidéos et audios en sous-titres SRT, VTT ou texte. Tout se passe sur ta machine : aucun fichier n'est envoyé sur Internet. Gratuit, sans compte, sans limite.",

    'header.tagline': 'Transcription locale',
    'header.theme': 'Changer de thème',
    'header.language': 'Langue',

    'hero.kicker': 'Aucun envoi · Aucun compte · Aucune limite',
    'hero.title': 'Tes vidéos<br>en sous-titres,<br><em>sans quitter<br>ta machine.</em>',
    'hero.standfirst': 'Le modèle de transcription est téléchargé dans cet onglet et tourne avec ton propre processeur. Ton fichier ne part sur aucun serveur.',

    'facts.formats': 'Formats',
    'facts.languages': 'Langues',
    'facts.cost': 'Coût',
    'facts.cost.value': '0 €',

    'tool.drop': 'Déposer',
    'dz.aria': 'Déposer un fichier audio ou vidéo, ou cliquer pour parcourir',
    'dz.title': 'Dépose ton fichier',
    'dz.sub': 'ou clique pour parcourir',
    'file.change': 'Changer',
    'run.label': 'Lancer la transcription',
    'tool.defaults': 'Réglages par défaut : {model}, {language}.',
    'tool.edit': 'Modifier',

    'progress.stage': 'En cours',
    'progress.preparing': 'Préparation',
    'progress.loadingModel': 'Chargement du modèle',
    'progress.transcribing': 'Transcription en cours',
    'progress.modelSize': 'Au premier lancement, {size} sont téléchargés puis gardés en cache par le navigateur.',
    'progress.timeNote': 'Le temps de traitement dépend de la longueur du fichier et de ta machine.',
    'progress.cancel': 'Annuler',

    'result.stage': 'Sortie',
    'result.title': 'Résultat',
    'result.stats': '{segments} segments · {words} mots · {duration}',
    'result.download': 'Télécharger .srt',
    'result.copy': 'Copier',
    'result.copied': 'Copié',
    'tabs.segments': 'Segments',
    'tabs.plain': 'Texte brut',
    'result.restart': 'Transcrire un autre fichier',

    'error.stage': 'Erreur',
    'error.title': "Ça n'a pas marché",
    'error.dismiss': 'Recommencer',

    'options.stage': 'Optionnel',
    'options.title': 'Réglages',
    'options.hint': 'Les valeurs par défaut conviennent dans la plupart des cas.',

    'field.model': 'Modèle',
    'field.language': 'Langue parlée',
    'field.task': 'Tâche',
    'field.device': 'Accélération',
    'field.model.cache': 'Téléchargé une fois, puis gardé en cache.',
    'field.language.hint': 'La préciser améliore nettement le résultat.',
    'field.task.hint': "Whisper ne traduit que vers l'anglais.",

    'task.transcribe': 'Transcrire',
    'task.translate': "Traduire vers l'anglais",

    'device.auto': 'Automatique',
    'device.webgpu': 'WebGPU',
    'device.cpu': 'Processeur',
    'device.detected': 'WebGPU détecté — beaucoup plus rapide.',
    'device.unavailable': 'WebGPU indisponible ici : le calcul se fera sur le processeur.',
    'device.badge.webgpu': 'WebGPU',
    'device.badge.cpu': 'Processeur',

    'lang.auto': 'Détection automatique',
    'lang.fr': 'Français', 'lang.en': 'Anglais', 'lang.es': 'Espagnol',
    'lang.de': 'Allemand', 'lang.it': 'Italien', 'lang.pt': 'Portugais',
    'lang.nl': 'Néerlandais', 'lang.ru': 'Russe', 'lang.ar': 'Arabe',
    'lang.ja': 'Japonais', 'lang.ko': 'Coréen', 'lang.zh': 'Chinois',

    'model.tiny.tag': 'le plus léger',
    'model.tiny.note': 'Le plus rapide, mais la qualité reste approximative.',
    'model.base.tag': 'recommandé',
    'model.base.note': 'Le meilleur compromis entre vitesse, poids et précision.',
    'model.small.tag': 'plus précis',
    'model.small.note': 'Nettement plus fidèle, pour un temps de calcul un peu plus long.',
    'model.turbo.tag': 'qualité maximale',
    'model.turbo.note': 'La meilleure transcription possible. WebGPU vivement conseillé.',

    'colophon.kicker': 'Le principe',
    'colophon.1.title': 'Rien ne sort de ta machine',
    'colophon.1.body': "Il n'y a pas de serveur. Le modèle est téléchargé une fois puis calcule en local. Coupe ta connexion après le chargement : ça fonctionne toujours.",
    'colophon.2.title': 'Ni compte, ni quota',
    'colophon.2.body': 'Aucune inscription, aucune limite de durée ni de nombre de fichiers. Un podcast de deux heures passe aussi bien qu\'un mémo de trente secondes.',
    'colophon.3.title': 'Whisper, en libre accès',
    'colophon.3.body': 'Le moteur est le modèle de reconnaissance vocale publié par OpenAI, exécuté ici par transformers.js directement dans le navigateur.',

    'err.notMedia': "Ce fichier n'a pas l'air d'être un audio ou une vidéo.",
    'err.noWebAudio': "Ton navigateur ne gère pas l'API Web Audio.",
    'err.decode': "Impossible de lire l'audio de ce fichier. Le format ou le codec n'est pas géré par ton navigateur — convertis-le en MP3 ou en WAV et réessaie.",
    'err.noSpeech': "Aucune parole n'a été détectée dans ce fichier.",
    'err.clipboard': "Ton navigateur a refusé l'accès au presse-papiers.",
    'err.workerBoot': 'Le moteur de transcription a planté au démarrage.',
    'err.webgpu': "Ton navigateur n'a pas réussi à utiliser WebGPU. Repasse l'accélération sur « Processeur » dans les réglages.",
    'err.memory': 'Mémoire insuffisante pour ce modèle. Essaie un modèle plus petit (Base ou Tiny), ou un fichier plus court.',
    'err.network': 'Le téléchargement du modèle a échoué. Vérifie ta connexion et réessaie.',
  },
};

export const SUPPORTED = Object.keys(LOCALES);
const FALLBACK = 'en';

let current = FALLBACK;

/**
 * Première langue du navigateur que l'on sait parler.
 * `navigator.languages` est classé par préférence : « fr-CA » doit reconnaître
 * « fr », d'où la comparaison sur la sous-balise primaire.
 */
export function detectLanguage() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && SUPPORTED.includes(stored)) return stored;

  const preferences = navigator.languages?.length
    ? navigator.languages
    : [navigator.language].filter(Boolean);

  for (const tag of preferences) {
    const primary = String(tag).toLowerCase().split('-')[0];
    if (SUPPORTED.includes(primary)) return primary;
  }

  return FALLBACK;
}

export function getLanguage() {
  return current;
}

/** Change la langue et met à jour la page. `persist` mémorise le choix. */
export function setLanguage(lang, { persist = false } = {}) {
  current = SUPPORTED.includes(lang) ? lang : FALLBACK;
  if (persist) localStorage.setItem(STORAGE_KEY, current);
  document.documentElement.lang = t('html.lang');
  applyTranslations();
  document.dispatchEvent(new CustomEvent('languagechange'));
}

/** Traduit une clé, en remplaçant les jetons {nom}. */
export function t(key, values) {
  const text = LOCALES[current]?.[key] ?? LOCALES[FALLBACK][key] ?? key;
  if (!values) return text;
  return text.replace(/\{(\w+)\}/g, (match, name) =>
    Object.hasOwn(values, name) ? values[name] : match);
}

/**
 * Applique les traductions au document.
 *   data-i18n       → contenu textuel
 *   data-i18n-html  → contenu riche (le titre contient des balises)
 *   data-i18n-attr  → "attribut:clé", séparés par des virgules
 */
export function applyTranslations(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });

  root.querySelectorAll('[data-i18n-html]').forEach((el) => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });

  root.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    el.dataset.i18nAttr.split(',').forEach((pair) => {
      const [attr, key] = pair.split(':').map((s) => s.trim());
      if (attr && key) el.setAttribute(attr, t(key));
    });
  });

  const title = document.querySelector('title');
  if (title) title.textContent = t('meta.title');

  const description = document.querySelector('meta[name="description"]');
  if (description) description.setAttribute('content', t('meta.description'));
}
