/**
 * Chargement d'un fichier distant à partir d'un lien.
 *
 * Limite incontournable : un navigateur ne peut lire une ressource servie par
 * un autre domaine que si ce domaine l'autorise explicitement (en-tête CORS
 * `Access-Control-Allow-Origin`). Sans serveur intermédiaire — et ce site n'en
 * a pas — il n'existe aucun contournement côté client.
 *
 * D'où le parti pris ici : détecter les cas voués à l'échec *avant* de lancer
 * la requête, et traduire les échecs restants en explications utilisables
 * plutôt qu'en « Failed to fetch ».
 */

/** Plateformes dont les médias ne sont jamais accessibles en direct. */
const STREAMING_HOSTS = [
  'youtube.com', 'youtu.be', 'music.youtube.com',
  'vimeo.com', 'dailymotion.com', 'twitch.tv',
  'tiktok.com', 'instagram.com', 'facebook.com', 'fb.watch',
  'x.com', 'twitter.com',
  'soundcloud.com', 'spotify.com', 'deezer.com', 'apple.com',
  'netflix.com', 'primevideo.com', 'disneyplus.com',
];

export class RemoteError extends Error {}

/** Renvoie le domaine sans `www.`, ou null si l'URL est inexploitable. */
function parseUrl(raw) {
  let url;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  return url;
}

function isStreamingHost(hostname) {
  const host = hostname.replace(/^www\./, '');
  return STREAMING_HOSTS.some((known) => host === known || host.endsWith(`.${known}`));
}

/** Déduit un nom de fichier propre à partir du chemin de l'URL. */
function fileNameFromUrl(url) {
  const last = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() ?? '');
  if (last && /\.[a-z0-9]{2,5}$/i.test(last)) return last;
  return `${url.hostname.replace(/^www\./, '')}-audio`;
}

/**
 * Télécharge un média distant et le renvoie sous forme de File.
 * `onProgress({ loaded, total })` est appelé pendant le transfert.
 */
export async function fetchRemoteFile(raw, onProgress = () => {}, signal) {
  const url = parseUrl(raw);

  if (!url) {
    throw new RemoteError(
      "Ce lien n'est pas valide. Il doit commencer par http:// ou https://."
    );
  }

  if (isStreamingHost(url.hostname)) {
    throw new RemoteError(
      `${url.hostname.replace(/^www\./, '')} ne permet pas de récupérer ses médias ` +
      'directement : il faudrait un serveur intermédiaire, ce que ce site n\'a pas ' +
      '(et c\'est justement ce qui lui permet d\'être gratuit et privé). ' +
      'Télécharge la vidéo sur ton appareil, puis dépose le fichier ici.'
    );
  }

  let response;
  try {
    response = await fetch(url, { signal, mode: 'cors', redirect: 'follow' });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    // fetch ne distingue pas un blocage CORS d'une panne réseau : on cite les
    // deux causes, la première étant de loin la plus fréquente.
    throw new RemoteError(
      "Le téléchargement a été refusé. Le serveur qui héberge ce fichier " +
      "n'autorise pas les autres sites à le lire (CORS), ou le lien est " +
      'injoignable. Essaie un lien direct vers le fichier, par exemple depuis ' +
      'archive.org, ou télécharge-le puis dépose-le ici.'
    );
  }

  if (!response.ok) {
    throw new RemoteError(
      `Le serveur a répondu ${response.status}${response.statusText ? ` (${response.statusText})` : ''}. ` +
      'Vérifie que le lien pointe bien vers un fichier existant.'
    );
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.startsWith('text/html')) {
    throw new RemoteError(
      "Ce lien renvoie une page web, pas un fichier audio ou vidéo. Il faut le " +
      'lien direct du média — celui qui se termine par .mp3, .mp4, .m4a…'
    );
  }

  const total = Number(response.headers.get('content-length')) || 0;
  const blob = await readWithProgress(response, total, onProgress);

  const type = contentType.split(';')[0] || blob.type || 'application/octet-stream';
  return new File([blob], fileNameFromUrl(url), { type });
}

/** Lit le corps de la réponse morceau par morceau pour afficher l'avancement. */
async function readWithProgress(response, total, onProgress) {
  if (!response.body) return response.blob();

  const reader = response.body.getReader();
  const chunks = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onProgress({ loaded, total });
  }

  return new Blob(chunks);
}
