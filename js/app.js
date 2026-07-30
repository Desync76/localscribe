/**
 * Interface de LocalScribe : sélection du fichier, pilotage du worker,
 * affichage et export des sous-titres.
 */

import { decodeAudioFile, formatBytes } from './audio.js';
import { normalizeChunks, formatDuration, EXPORTERS } from './subtitles.js';
import { MODELS, getVariant, formatModelSize } from './models.js';
import { fetchRemoteFile, RemoteError } from './remote.js';

const $ = (id) => document.getElementById(id);

const els = {
  dropzone: $('dropzone'),
  fileInput: $('file-input'),

  sourceFile: $('source-file'),
  sourceUrl: $('source-url'),
  urlInput: $('url-input'),
  urlLoad: $('url-load'),
  urlProgress: $('url-progress'),
  urlProgressBar: $('url-progress-bar'),
  urlProgressDetail: $('url-progress-detail'),

  fileInfo: $('file-info'),
  fileName: $('file-name'),
  fileDetail: $('file-detail'),
  fileClear: $('file-clear'),

  model: $('opt-model'),
  language: $('opt-language'),
  task: $('opt-task'),
  device: $('opt-device'),
  deviceHint: $('device-hint'),
  runBtn: $('run-btn'),

  stepProgress: $('step-progress'),
  progressTitle: $('progress-title'),
  progressBar: $('progress-bar'),
  progressDetail: $('progress-detail'),
  downloadList: $('download-list'),
  cancelBtn: $('cancel-btn'),

  stepResult: $('step-result'),
  resultStats: $('result-stats'),
  viewSegments: $('view-segments'),
  viewPlain: $('view-plain'),
  copyBtn: $('copy-btn'),
  restartBtn: $('restart-btn'),

  stepError: $('step-error'),
  errorMessage: $('error-message'),
  errorDismiss: $('error-dismiss'),

  themeToggle: $('theme-toggle'),
};

const state = {
  source: 'file',    // 'file' | 'url'
  file: null,
  audio: null,       // { samples, duration }
  chunks: [],        // segments normalisés
  worker: null,
  webgpu: false,
  downloads: new Map(),
};

/* ------------------------------------------------------------------ */
/* Détection WebGPU                                                     */
/* ------------------------------------------------------------------ */

async function detectWebGPU() {
  if (!navigator.gpu) return false;
  try {
    return Boolean(await navigator.gpu.requestAdapter());
  } catch {
    return false;
  }
}

async function initDevice() {
  state.webgpu = await detectWebGPU();

  els.deviceHint.textContent = state.webgpu
    ? 'WebGPU détecté — beaucoup plus rapide.'
    : "WebGPU indisponible ici : le calcul se fera sur le processeur.";

  if (!state.webgpu) {
    els.device.querySelector('option[value="webgpu"]').disabled = true;
  }

  renderModelOptions();
}

/** Résout le choix « Automatique » en device concret. */
function resolveDevice() {
  const choice = els.device.value;
  if (choice === 'auto') return state.webgpu ? 'webgpu' : 'wasm';
  return choice;
}

/**
 * (Re)construit la liste des modèles. Le poids annoncé dépend du device, donc
 * la liste est régénérée à chaque changement d'accélération — afficher une
 * taille CPU alors que le GPU en téléchargera trois fois plus serait mensonger.
 */
function renderModelOptions() {
  const device = resolveDevice();
  const previous = els.model.value;

  els.model.replaceChildren(...MODELS.map((model) => {
    const option = document.createElement('option');
    option.value = model.id;
    option.textContent =
      `${model.name} — ${model.note} (${formatModelSize(getVariant(model.id, device).mb)})`;
    option.selected = previous ? model.id === previous : Boolean(model.default);
    return option;
  }));
}

/* ------------------------------------------------------------------ */
/* Sélection du fichier                                                 */
/* ------------------------------------------------------------------ */

function isMediaFile(file) {
  return /^(audio|video)\//.test(file.type) ||
         /\.(mp3|wav|m4a|aac|ogg|opus|flac|mp4|webm|mov|mkv)$/i.test(file.name);
}

async function selectFile(file) {
  if (!file) return;

  if (!isMediaFile(file)) {
    showError("Ce fichier n'a pas l'air d'être un audio ou une vidéo.");
    return;
  }

  hide(els.stepError);
  hide(els.stepResult);

  state.file = file;
  els.fileName.textContent = file.name;
  els.fileDetail.textContent = `${formatBytes(file.size)} · décodage…`;
  hide(els.sourceFile);
  hide(els.sourceUrl);
  show(els.fileInfo);
  els.runBtn.disabled = true;

  try {
    // On décode tout de suite : ça valide le fichier et donne la durée réelle,
    // utile pour borner le dernier sous-titre.
    state.audio = await decodeAudioFile(file);
    els.fileDetail.textContent =
      `${formatBytes(file.size)} · ${formatDuration(state.audio.duration)}`;
    els.runBtn.disabled = false;
  } catch (error) {
    clearFile();
    showError(error.message);
  }
}

function clearFile() {
  state.file = null;
  state.audio = null;
  els.fileInput.value = '';
  els.runBtn.disabled = true;
  hide(els.fileInfo);
  hide(els.urlProgress);
  showSource(state.source);
}

/* ------------------------------------------------------------------ */
/* Source : appareil ou lien                                            */
/* ------------------------------------------------------------------ */

/** Affiche le panneau de la source choisie, sauf si un fichier est déjà prêt. */
function showSource(source) {
  state.source = source;

  document.querySelectorAll('.source-btn').forEach((btn) => {
    const active = btn.dataset.source === source;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', String(active));
  });

  const hasFile = Boolean(state.file);
  els.sourceFile.hidden = hasFile || source !== 'file';
  els.sourceUrl.hidden = hasFile || source !== 'url';
}

async function loadFromUrl() {
  const raw = els.urlInput.value.trim();
  if (!raw) return;

  hide(els.stepError);
  hide(els.stepResult);
  els.urlLoad.disabled = true;
  els.urlProgressBar.style.width = '0%';
  els.urlProgressDetail.textContent = 'Connexion…';
  show(els.urlProgress);

  try {
    const file = await fetchRemoteFile(raw, ({ loaded, total }) => {
      els.urlProgressDetail.textContent = total
        ? `Téléchargement — ${formatBytes(loaded)} / ${formatBytes(total)}`
        : `Téléchargement — ${formatBytes(loaded)}`;
      // Sans Content-Length, on ne peut pas calculer de pourcentage : la barre
      // reste alors en mouvement continu.
      els.urlProgressBar.classList.toggle('is-indeterminate', !total);
      if (total) els.urlProgressBar.style.width = `${(loaded / total) * 100}%`;
    });

    hide(els.urlProgress);
    els.urlProgressBar.classList.remove('is-indeterminate');
    await selectFile(file);
  } catch (error) {
    hide(els.urlProgress);
    els.urlProgressBar.classList.remove('is-indeterminate');
    showError(error instanceof RemoteError
      ? error.message
      : `Le téléchargement a échoué : ${error.message}`);
  } finally {
    els.urlLoad.disabled = false;
  }
}

/* ------------------------------------------------------------------ */
/* Worker                                                               */
/* ------------------------------------------------------------------ */

function createWorker() {
  const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  worker.addEventListener('message', onWorkerMessage);
  worker.addEventListener('error', (event) => {
    showError(event.message || 'Le moteur de transcription a planté au démarrage.');
    hide(els.stepProgress);
  });
  return worker;
}

function onWorkerMessage(event) {
  const { type, payload } = event.data;

  if (type === 'load-progress') {
    renderLoadProgress(payload);
  } else if (type === 'transcribe-start') {
    els.progressTitle.textContent = 'Transcription en cours…';
    els.progressDetail.textContent =
      'Le temps de traitement dépend de la longueur du fichier et de ta machine.';
    els.downloadList.replaceChildren();
    els.progressBar.style.width = '';
    els.progressBar.classList.add('is-indeterminate');
  } else if (type === 'result') {
    els.progressBar.classList.remove('is-indeterminate');
    hide(els.stepProgress);
    renderResult(payload);
  } else if (type === 'error') {
    els.progressBar.classList.remove('is-indeterminate');
    hide(els.stepProgress);
    showError(payload.message);
  }
}

function run() {
  if (!state.audio) return;

  hide(els.stepResult);
  hide(els.stepError);
  show(els.stepProgress);

  state.downloads.clear();
  els.downloadList.replaceChildren();
  els.progressBar.classList.remove('is-indeterminate');
  els.progressBar.style.width = '0%';
  els.progressTitle.textContent = 'Chargement du modèle…';
  els.progressDetail.textContent =
    'Au premier lancement, le modèle est téléchargé puis gardé en cache.';

  state.worker ??= createWorker();

  const device = resolveDevice();
  const variant = getVariant(els.model.value, device);

  els.progressDetail.textContent =
    `Au premier lancement, ${formatModelSize(variant.mb)} sont téléchargés puis ` +
    'gardés en cache par le navigateur.';

  state.worker.postMessage({
    type: 'transcribe',
    payload: {
      samples: state.audio.samples,
      model: els.model.value,
      device,
      dtype: variant.dtype,
      language: els.language.value,
      task: els.task.value,
    },
  });
}

function cancel() {
  // Une inférence en cours ne s'interrompt pas proprement : on tue le worker.
  state.worker?.terminate();
  state.worker = null;
  els.progressBar.classList.remove('is-indeterminate');
  hide(els.stepProgress);
}

/* ------------------------------------------------------------------ */
/* Rendu                                                                */
/* ------------------------------------------------------------------ */

function renderLoadProgress({ status, file, progress, loaded, total }) {
  if (status !== 'progress' && status !== 'done') return;

  if (status === 'done') {
    state.downloads.delete(file);
  } else {
    state.downloads.set(file, { progress: progress ?? 0, loaded, total });
  }

  const entries = [...state.downloads.entries()];

  const rows = entries.map(([name, info]) => {
    const row = document.createElement('div');
    row.className = 'download-row';

    const label = document.createElement('span');
    label.textContent = name;

    const value = document.createElement('span');
    value.textContent = info.total
      ? `${formatBytes(info.loaded)} / ${formatBytes(info.total)}`
      : `${Math.round(info.progress)} %`;

    row.append(label, value);
    return row;
  });

  els.downloadList.replaceChildren(...rows);

  const average = entries.length
    ? entries.reduce((sum, [, info]) => sum + info.progress, 0) / entries.length
    : 100;
  els.progressBar.style.width = `${Math.min(100, average)}%`;
}

function renderResult({ chunks }) {
  state.chunks = normalizeChunks(chunks, state.audio?.duration ?? 0);

  if (state.chunks.length === 0) {
    showError("Aucune parole n'a été détectée dans ce fichier.");
    return;
  }

  const words = state.chunks.reduce(
    (sum, chunk) => sum + chunk.text.split(/\s+/).filter(Boolean).length, 0
  );
  els.resultStats.textContent =
    `${state.chunks.length} segments · ${words} mots · ${formatDuration(state.audio.duration)}`;

  els.viewSegments.replaceChildren(...state.chunks.map((chunk) => {
    const row = document.createElement('div');
    row.className = 'segment';

    const time = document.createElement('time');
    time.textContent = `${formatDuration(chunk.start)} → ${formatDuration(chunk.end)}`;

    const text = document.createElement('p');
    text.textContent = chunk.text;

    row.append(time, text);
    return row;
  }));

  els.viewPlain.textContent = EXPORTERS.txt.build(state.chunks);

  show(els.stepResult);
  els.stepResult.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showError(message) {
  els.errorMessage.textContent = message;
  show(els.stepError);
  els.stepError.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ------------------------------------------------------------------ */
/* Export                                                               */
/* ------------------------------------------------------------------ */

function download(format) {
  const exporter = EXPORTERS[format];
  if (!exporter || state.chunks.length === 0) return;

  const base = (state.file?.name ?? 'transcription').replace(/\.[^.]+$/, '');
  const blob = new Blob([exporter.build(state.chunks)], { type: exporter.mime });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `${base}.${exporter.extension}`;
  link.click();

  // Révoquer dans la foulée coupe le téléchargement sur certains navigateurs :
  // on laisse le temps au clic d'être traité.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function copyText() {
  try {
    await navigator.clipboard.writeText(EXPORTERS.txt.build(state.chunks));
    els.copyBtn.textContent = 'Copié !';
    setTimeout(() => { els.copyBtn.textContent = 'Copier le texte'; }, 1800);
  } catch {
    showError("Ton navigateur a refusé l'accès au presse-papiers.");
  }
}

/* ------------------------------------------------------------------ */
/* Utilitaires d'affichage                                              */
/* ------------------------------------------------------------------ */

function show(el) { el.hidden = false; }
function hide(el) { el.hidden = true; }

/* ------------------------------------------------------------------ */
/* Thème                                                                */
/* ------------------------------------------------------------------ */

function initTheme() {
  const saved = localStorage.getItem('localscribe-theme');
  if (saved) document.documentElement.dataset.theme = saved;

  els.themeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.dataset.theme
      ? document.documentElement.dataset.theme === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches;

    const next = isDark ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('localscribe-theme', next);
  });
}

/* ------------------------------------------------------------------ */
/* Branchements                                                         */
/* ------------------------------------------------------------------ */

els.dropzone.addEventListener('click', () => els.fileInput.click());
els.dropzone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    els.fileInput.click();
  }
});

['dragenter', 'dragover'].forEach((name) => {
  els.dropzone.addEventListener(name, (event) => {
    event.preventDefault();
    els.dropzone.classList.add('is-over');
  });
});

['dragleave', 'drop'].forEach((name) => {
  els.dropzone.addEventListener(name, (event) => {
    event.preventDefault();
    els.dropzone.classList.remove('is-over');
  });
});

els.dropzone.addEventListener('drop', (event) => {
  selectFile(event.dataTransfer?.files?.[0]);
});

// Sans ça, un fichier lâché à côté de la zone remplacerait la page.
['dragover', 'drop'].forEach((name) => {
  window.addEventListener(name, (event) => event.preventDefault());
});

document.querySelectorAll('.source-btn').forEach((btn) => {
  btn.addEventListener('click', () => showSource(btn.dataset.source));
});

els.urlLoad.addEventListener('click', loadFromUrl);
els.urlInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    loadFromUrl();
  }
});

// Le poids annoncé change avec l'accélération choisie.
els.device.addEventListener('change', renderModelOptions);

els.fileInput.addEventListener('change', () => selectFile(els.fileInput.files[0]));
els.fileClear.addEventListener('click', clearFile);
els.runBtn.addEventListener('click', run);
els.cancelBtn.addEventListener('click', cancel);
els.restartBtn.addEventListener('click', () => {
  hide(els.stepResult);
  clearFile();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
els.errorDismiss.addEventListener('click', () => hide(els.stepError));
els.copyBtn.addEventListener('click', copyText);

document.querySelectorAll('[data-export]').forEach((btn) => {
  btn.addEventListener('click', () => download(btn.dataset.export));
});

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('is-active'));
    tab.classList.add('is-active');

    const wantsPlain = tab.dataset.view === 'plain';
    els.viewSegments.hidden = wantsPlain;
    els.viewPlain.hidden = !wantsPlain;
  });
});

initTheme();
initDevice();
showSource('file');
