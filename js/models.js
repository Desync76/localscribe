/**
 * Catalogue des modèles.
 *
 * Le poids téléchargé dépend du device : sur GPU on privilégie des variantes
 * plus précises, sur CPU des variantes quantifiées. Les tailles ci-dessous sont
 * la somme réelle (encodeur + décodeur) des fichiers ONNX servis par le Hub,
 * ce qui permet d'annoncer un chiffre exact dans l'interface.
 *
 * Choix de quantification :
 *  - CPU  : `q8` partout, seul compromis viable sans accélération matérielle.
 *  - GPU  : l'encodeur reste en pleine précision sur les petits modèles (il est
 *           sensible au bruit de quantification et pèse peu), le décodeur —
 *           bien plus gros — passe en q4. Small utilise un encodeur fp16 pour
 *           éviter les 336 Mo du fp32, et Turbo du q4f16 partout : son encodeur
 *           fp32 pèse 2,4 Go, inutilisable sur le web.
 */

export const MODELS = [
  {
    id: 'onnx-community/whisper-tiny',
    name: 'Tiny',
    key: 'tiny',
    wasm: { dtype: 'q8', mb: 39 },
    webgpu: { dtype: { encoder_model: 'fp32', decoder_model_merged: 'q4' }, mb: 114 },
  },
  {
    id: 'onnx-community/whisper-base',
    name: 'Base',
    key: 'base',
    wasm: { dtype: 'q8', mb: 73 },
    webgpu: { dtype: { encoder_model: 'fp32', decoder_model_merged: 'q4' }, mb: 197 },
    default: true,
  },
  {
    id: 'onnx-community/whisper-small',
    name: 'Small',
    key: 'small',
    wasm: { dtype: 'q8', mb: 237 },
    webgpu: { dtype: { encoder_model: 'fp16', decoder_model_merged: 'q4' }, mb: 391 },
  },
  {
    id: 'onnx-community/whisper-large-v3-turbo',
    name: 'Turbo',
    key: 'turbo',
    wasm: { dtype: 'q8', mb: 1035 },
    webgpu: { dtype: 'q4f16', mb: 537 },
  },
];

export function getModel(id) {
  return MODELS.find((model) => model.id === id) ?? MODELS.find((model) => model.default);
}

/** Configuration effective d'un modèle pour un device donné. */
export function getVariant(id, device) {
  const model = getModel(id);
  return device === 'webgpu' ? model.webgpu : model.wasm;
}

/** 537 -> "537 Mo" ; 1035 -> "1,0 Go" */
export function formatModelSize(mb) {
  return mb >= 1024
    ? `${(mb / 1024).toFixed(1).replace('.', ',')} Go`
    : `${mb} Mo`;
}
