# LocalScribe

**Transforme n'importe quelle vidéo ou audio en sous-titres — sans rien envoyer sur Internet.**

Dépose un fichier, récupère un `.srt`. Le modèle de transcription (Whisper) est
téléchargé dans le navigateur et tourne **sur la machine du visiteur**. Aucun
serveur, aucun compte, aucune limite.

👉 **[Essayer en ligne](https://desync76.github.io/localscribe/)**

> 🤖 **Projet vibe codé.** Ce dépôt a été conçu et écrit en binôme avec une IA
> (Claude Code), du premier fichier jusqu'au déploiement. Chaque étape a été
> testée dans un vrai navigateur avant d'être poussée, et tout est public ici —
> à lire, critiquer et forker librement.

---

## Pourquoi

Les services de transcription en ligne demandent une inscription, limitent la
durée des fichiers, ou font payer — et surtout, ils reçoivent tes fichiers sur
leurs serveurs. Pour un cours enregistré, un entretien ou une réunion, ça n'est
pas anodin.

LocalScribe fait le calcul dans l'onglet. Une fois le modèle chargé, tu peux
couper ta connexion : ça continue de marcher.

## Fonctionnalités

- **Entrée** : MP3, WAV, M4A, OGG, FLAC, MP4, WebM… (audio et vidéo)
- **Sortie** : `.srt`, `.vtt`, texte brut, ou copie dans le presse-papiers
- **Langues** : une centaine, avec détection automatique possible
- **Traduction** vers l'anglais en un clic
- **4 modèles** au choix, de Tiny à Large v3 Turbo
- **Accélération WebGPU** quand le navigateur la propose, repli automatique sur
  le processeur sinon
- Interface responsive, thème clair/sombre

### Modèles et poids réels

Le poids téléchargé dépend de l'accélération : le GPU charge des poids plus
précis que le CPU. L'interface affiche la taille correspondant au réglage
choisi, et le modèle est mis en cache après le premier chargement.

| Modèle | CPU (q8) | WebGPU |
|---|---:|---:|
| Tiny | 39 Mo | 114 Mo |
| **Base** *(défaut)* | **73 Mo** | **197 Mo** |
| Small | 237 Mo | 391 Mo |
| Large v3 Turbo | 1,0 Go | 537 Mo |

Le détail des quantifications retenues est commenté dans
[`js/models.js`](js/models.js). En résumé : `q8` partout sur CPU ; sur GPU
l'encodeur reste précis sur les petits modèles et le décodeur passe en `q4`,
tandis que Turbo utilise `q4f16` — son encodeur pleine précision pèse 2,4 Go,
inutilisable sur le web.

### Pourquoi pas de chargement depuis un lien

Un navigateur ne peut lire une ressource servie par un autre domaine que si ce
domaine l'autorise explicitement (en-tête CORS). YouTube et les plateformes de
streaming ne l'autorisent pas, et il n'existe aucun contournement côté client :
il faudrait un serveur intermédiaire, ce qui ferait perdre au projet sa
gratuité et sa garantie de confidentialité. Le glisser-déposer reste donc la
seule entrée — et c'est aussi le seul mode qui garantit que rien ne transite
par le réseau.

## Comment ça marche

```
fichier ──► Web Audio API ──► Float32Array 16 kHz mono
                                      │
                                      ▼
                            Web Worker (thread séparé)
                                      │
                          transformers.js + Whisper ONNX
                                      │
                                      ▼
                       segments horodatés ──► SRT / VTT / TXT
```

Trois points valent d'être notés :

1. **Le décodage audio n'utilise aucune bibliothèque.** Créer l'`AudioContext`
   avec `sampleRate: 16000` fait rééchantillonner le navigateur pendant le
   décodage, ce qu'attend exactement Whisper.
2. **L'inférence tourne dans un Web Worker**, sinon l'onglet se fige pendant
   toute la transcription.
3. **Les poids viennent du CDN de Hugging Face**, pas de ce dépôt. Le site ne
   pèse que quelques dizaines de kilo-octets, et le modèle est mis en cache par
   le navigateur après le premier chargement.

## Développement

Aucune dépendance, aucune étape de build. Il faut simplement un serveur HTTP
local — les modules ES et les Web Workers ne fonctionnent pas en `file://` :

```bash
npx serve .
```

Puis ouvrir l'adresse affichée.

### Structure

```
index.html          interface
css/style.css       styles (thème clair/sombre)
js/app.js           interactions, pilotage du worker, exports
js/worker.js        chargement du modèle et inférence
js/models.js        catalogue des modèles (quantifications et poids)
js/audio.js         décodage et rééchantillonnage
js/subtitles.js     génération SRT / VTT / TXT
```

## Compatibilité

| Navigateur | CPU (WASM) | WebGPU |
|---|---|---|
| Chrome / Edge | ✅ | ✅ |
| Firefox | ✅ | partiel |
| Safari 17+ | ✅ | selon version |
| Mobile | ✅ (petits modèles) | rare |

Sur mobile, s'en tenir à Tiny ou Base : les gros modèles dépassent la mémoire
allouée aux onglets.

## Pistes d'amélioration

- [ ] Progression fine pendant la transcription (segment par segment)
- [ ] Lecteur avec sous-titres synchronisés pour relire avant export
- [ ] Édition des segments dans la page
- [ ] Découpage intelligent des lignes trop longues (limite de caractères)
- [ ] Traitement par lot de plusieurs fichiers
- [ ] Interface en anglais

## Crédits

- [Whisper](https://github.com/openai/whisper) — OpenAI, licence MIT
- [transformers.js](https://github.com/huggingface/transformers.js) — Hugging Face
- Modèles ONNX : [onnx-community](https://huggingface.co/onnx-community)

## Licence

MIT — voir [LICENSE](LICENSE).
