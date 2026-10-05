# 🧠 TicTacBrain

**Quiz QCM en mode série.** Choisis un thème, enchaîne les bonnes réponses… et ne te trompe jamais : une seule erreur et ta série retombe à zéro.

PWA installable sur mobile, utilisable hors ligne, sans compte ni serveur.

## Le jeu

- **Thèmes et sous-thèmes** : joue un sous-thème précis (*Développement › Java*), **tout un thème** (tous ses sous-thèmes mélangés, plus dur), ou **tout mélanger** (tous les thèmes).
- **Mode série** : 🔥 ta série monte à chaque bonne réponse, 🏆 ton record est gardé par mode et par chrono.
- **💡 Comprendre** : après chaque réponse, une modale explique la bonne réponse (avec un lien pour approfondir).
- **⏱️ Chrono** optionnel : ∞, 10 s, 30 s ou 1 min par question. Le temps continue de tourner si tu quittes l'app pour chercher la réponse 😉
- **Anti-triche / anti-par-cœur** :
  - l'ordre des questions **et** l'ordre des réponses sont tirés au hasard à chaque partie ;
  - les questions que tu n'as jamais vues (ou pas depuis longtemps) passent en priorité, donc on ne recommence pas toujours par les mêmes ;
  - plus la série monte, plus les questions sont difficiles.
- **Clavier** (desktop) : `1`–`4` ou `A`–`D` pour répondre, `Entrée` pour continuer, `E` pour l'explication.

Les statistiques et records sont stockés localement sur l'appareil (localStorage).

## Les questions

Elles vivent dans [`questions/`](questions/), **un fichier JSON par sous-thème** :

```
questions/<theme>/_theme.json        ← nom, icône, couleur du thème
questions/<theme>/<sous-theme>.json  ← nom, icône + la liste des questions
```

```json
{
  "question": "Que renvoie `typeof null` en JavaScript ?",
  "answer": "`\"object\"`",
  "wrong": ["`\"null\"`", "`\"undefined\"`", "`\"number\"`"],
  "explanation": "C'est un bug historique du langage, conservé pour la compatibilité…",
  "difficulty": 1
}
```

Ajouter une question = ajouter un objet dans un fichier ; ajouter un sous-thème = ajouter un fichier ; ajouter un thème = ajouter un dossier. Au build, tout est validé puis transformé en petits fichiers statiques chargés à la demande. 👉 **[Guide de contribution](CONTRIBUTING.md)**

Banque actuelle : 4 thèmes, 17 sous-thèmes, 425 questions (lancer `npm run validate` pour le détail).

## Développement

Prérequis : Node.js ≥ 20.19.

```bash
npm install
npm run dev        # http://localhost:5173 (rechargement auto quand un JSON de questions change)
npm run validate   # valide la banque de questions
npm test           # tests unitaires (logique de tirage, validateur)
npm run build      # build de production dans dist/
npm run preview    # sert dist/ (pour tester la PWA et le hors-ligne)
```

Stack : [Vite](https://vite.dev) + [Preact](https://preactjs.com) + TypeScript, [vite-plugin-pwa](https://vite-pwa-org.netlify.app) (service worker Workbox : toutes les questions sont précachées). Aucune dépendance runtime à part Preact (~13 Ko gzip au total).

```
src/
├── app.tsx              routes (#/, #/t/<theme>, #/play/<mode>)
├── screens/             Home, ThemeScreen, Quiz
├── components/          Modal, Rich (markdown léger), TimerPicker, UpdateToast
└── lib/
    ├── game.ts          mélange, choix de la prochaine question, difficulté progressive
    ├── storage.ts       records, statistiques, questions déjà vues
    └── data.ts          chargement du catalogue et des questions
scripts/question-bank.mjs  validation + génération de data/*.json (CI et plugin Vite)
schemas/                   JSON Schema des fichiers de questions (autocomplétion VS Code)
```

## Déploiement

Le workflow [`deploy.yml`](.github/workflows/deploy.yml) publie l'app sur **GitHub Pages** à chaque push sur `main`. À activer une fois : *Settings → Pages → Build and deployment → Source : GitHub Actions*. L'app est alors disponible sur `https://<utilisateur>.github.io/<repo>/`.

Les chemins sont relatifs et le routage passe par le hash (`#/…`) : le dossier `dist/` fonctionne tel quel sur n'importe quel hébergement statique (Netlify, Vercel, Cloudflare Pages…).

Quand de nouvelles questions sont déployées, l'app installée affiche « ✨ Nouvelle version disponible ».

## Idées pour la suite

- Revoir les questions ratées (mode « révision »)
- Défi entre amis : partager un lien avec une graine aléatoire pour jouer la même série
- Statistiques par sous-thème (taux de réussite, questions les plus ratées)
