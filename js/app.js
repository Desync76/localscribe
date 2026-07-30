/**
 * Interface de LocalScribe : sélection du fichier, pilotage du worker,
 * affichage et export des sous-titres.
 */

import { decodeAudioFile, formatBytes } from './audio.js';
import { normalizeChunks, formatDuration, EXPORTERS } from './subtitles.js';
import { MODELS, getModel, getVariant, formatModelSize } from './models.js';
import { enhanceSelects } from './select.js';
import { initReveals } from './reveal.js';
import { t, applyTranslations, detectLanguage, setLanguage } from './i18n.js';

const $ = (id) => document.getElementById(id);

const els = {
  dropzone: $('dropzone'),
  fileInput: $('file-input'),
  fileInfo: $('file-info'),
  fileName: $('file-name'),
  fileDetail: $('file-detail'),
  fileClear: $('file-clear'),

  model: $('opt-model'),
  modelHint: $('model-hint'),
  language: $('opt-language'),
  task: $('opt-task'),
  device: $('opt-device'),
  deviceHint: $('device-hint'),
  deviceBadge: $('device-badge'),
  summaryLine: $('summary-line'),
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
  file: null,
  audio: null,       // { samples, duration }
  chunks: [],        // segments normalisés
  worker: null,
  webgpu: false,
  downloads: new Map(),
  lastError: null,   // { key } ou { raw } — rejoué au changement de langue
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

  if (!state.webgpu) {
    els.device.querySelector('option[value="webgpu"]').disabled = true;
  }

  renderDevice();
  renderModelOptions();
}

/** Résout le choix « Automatique » en device concret. */
function resolveDevice() {
  const choice = els.device.value;
  if (choice === 'auto') return state.webgpu ? 'webgpu' : 'wasm';
  return choice;
}

function renderDevice() {
  els.deviceHint.textContent = state.webgpu ? t('device.detected') : t('device.unavailable');
  els.deviceBadge.textContent =
    resolveDevice() === 'webgpu' ? t('device.badge.webgpu') : t('device.badge.cpu');
}

/* ------------------------------------------------------------------ */
/* Modèles                                                              */
/* ------------------------------------------------------------------ */

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
    // Libellé court : le détail part dans l'aide sous le champ.
    option.textContent =
      `${model.name} · ${formatModelSize(getVariant(model.id, device).mb)} — ${t(`model.${model.key}.tag`)}`;
    option.selected = previous ? model.id === previous : Boolean(model.default);
    return option;
  }));

  renderModelHint();
  renderSummary();
}

function renderModelHint() {
  const model = getModel(els.model.value);
  els.modelHint.textContent = `${t(`model.${model.key}.note`)} ${t('field.model.cache')}`;
}

/** Rappel des réglages courants sous l'outil, pour éviter d'aller les chercher. */
function renderSummary() {
  const model = getModel(els.model.value);
  const size = formatModelSize(getVariant(model.id, resolveDevice()).mb);

  els.summaryLine.textContent = t('tool.defaults', {
    model: `${model.name} · ${size}`,
    language: els.language.value ? t(`lang.${els.language.value}`) : t('lang.auto'),
  });
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
    showError({ key: 'err.notMedia' });
    return;
  }

  hide(els.stepError);
  hide(els.stepResult);

  state.file = file;
  els.fileName.textContent = file.name;
  els.fileDetail.textContent = formatBytes(file.size);
  hide(els.dropzone);
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
    // Les modules bas niveau renvoient une clé, pas une phrase.
    showError({ key: error.message });
  }
}

function clearFile() {
  state.file = null;
  state.audio = null;
  els.fileInput.value = '';
  els.runBtn.disabled = true;
  hide(els.fileInfo);
  show(els.dropzone);
}

/* ------------------------------------------------------------------ */
/* Worker                                                               */
/* ------------------------------------------------------------------ */

function createWorker() {
  const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  worker.addEventListener('message', onWorkerMessage);
  worker.addEventListener('error', () => {
    showError({ key: 'err.workerBoot' });
    hide(els.stepProgress);
  });
  return worker;
}

function onWorkerMessage(event) {
  const { type, payload } = event.data;

  if (type === 'load-progress') {
    renderLoadProgress(payload);
  } else if (type === 'transcribe-start') {
    els.progressTitle.textContent = t('progress.transcribing');
    els.progressDetail.textContent = t('progress.timeNote');
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
    showError(payload);
  }
}

function run() {
  if (!state.audio) return;

  hide(els.stepResult);
  hide(els.stepError);
  show(els.stepProgress);

  const device = resolveDevice();
  const variant = getVariant(els.model.value, device);

  state.downloads.clear();
  els.downloadList.replaceChildren();
  els.progressBar.classList.remove('is-indeterminate');
  els.progressBar.style.width = '0%';
  els.progressTitle.textContent = t('progress.loadingModel');
  els.progressDetail.textContent =
    t('progress.modelSize', { size: formatModelSize(variant.mb) });

  els.stepProgress.scrollIntoView({ behavior: 'smooth', block: 'center' });

  state.worker ??= createWorker();
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

  els.downloadList.replaceChildren(...entries.map(([name, info]) => {
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
  }));

  const average = entries.length
    ? entries.reduce((sum, [, info]) => sum + info.progress, 0) / entries.length
    : 100;
  els.progressBar.style.width = `${Math.min(100, average)}%`;
}

function renderResult({ chunks }) {
  state.chunks = normalizeChunks(chunks, state.audio?.duration ?? 0);

  if (state.chunks.length === 0) {
    showError({ key: 'err.noSpeech' });
    return;
  }

  renderStats();

  els.viewSegments.replaceChildren(...state.chunks.map((chunk, index) => {
    const row = document.createElement('div');
    row.className = 'segment';
    // Décalage progressif : les segments apparaissent en cascade.
    row.style.setProperty('--i', String(Math.min(index, 12)));

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

function renderStats() {
  if (state.chunks.length === 0) return;

  const words = state.chunks.reduce(
    (sum, chunk) => sum + chunk.text.split(/\s+/).filter(Boolean).length, 0
  );

  els.resultStats.textContent = t('result.stats', {
    segments: state.chunks.length,
    words,
    duration: formatDuration(state.audio?.duration ?? 0),
  });
}

/** `error` est { key } (traduisible) ou { raw } (message technique brut). */
function showError(error) {
  state.lastError = error;
  els.errorMessage.textContent = error.key ? t(error.key) : error.raw;
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
    els.copyBtn.textContent = t('result.copied');
    setTimeout(() => { els.copyBtn.textContent = t('result.copy'); }, 1800);
  } catch {
    showError({ key: 'err.clipboard' });
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
/* Langue                                                               */
/* ------------------------------------------------------------------ */

/**
 * La langue est décidée une fois, au chargement, d'après le navigateur.
 * Personne n'a de bouton à chercher : le site parle déjà la bonne langue.
 */
function initLanguage() {
  setLanguage(detectLanguage());
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

// Le poids annoncé change avec l'accélération choisie.
els.device.addEventListener('change', () => {
  renderDevice();
  renderModelOptions();
});
els.model.addEventListener('change', () => {
  renderModelHint();
  renderSummary();
});
els.language.addEventListener('change', renderSummary);

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

/* ------------------------------------------------------------------ */
/* Démarrage                                                            */
/* ------------------------------------------------------------------ */

initTheme();
initLanguage();
applyTranslations();
await initDevice();
// Les menus sont construits après le premier remplissage des <option>.
enhanceSelects();
initReveals();
