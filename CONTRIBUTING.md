# Contribuer à TicTacBrain

La meilleure contribution : **des questions**. Pas besoin de toucher au code : tout est dans des fichiers JSON, et l'app les récupère automatiquement au prochain déploiement.

> Pas à l'aise avec Git ? Ouvre une issue avec le formulaire **« 💡 Proposer une question »**, quelqu'un l'ajoutera pour toi.

## Où sont les questions ?

```
questions/
├── developpement/          ← un dossier = un thème (le nom du dossier est son id)
│   ├── _theme.json         ← nom, icône, couleur du thème
│   ├── cloud.json          ← un fichier = un sous-thème (le nom du fichier est son id)
│   ├── java.json
│   └── …
├── hacking/
│   ├── _theme.json
│   ├── web.json
│   └── …
└── …
```

Un sous-thème = un fichier : les fichiers restent petits, les pull requests lisibles, et les conflits rares. Le mode « Tout le thème » mélange automatiquement tous les sous-thèmes du dossier.

## Ajouter une question

Ouvre le fichier du sous-thème et ajoute un objet dans `questions` :

```json
{
  "question": "Quelle commande permet de retrouver un commit « perdu » après un `git reset --hard` ?",
  "answer": "`git reflog`",
  "wrong": ["`git log --all`", "`git fsck --lost`", "`git restore`"],
  "explanation": "Le **reflog** garde la trace de chaque déplacement de HEAD, même vers un commit qui n'est plus référencé…",
  "difficulty": 2,
  "source": "https://git-scm.com/docs/git-reflog"
}
```

| Champ | Obligatoire | Description |
|---|---|---|
| `question` | ✅ | L'énoncé (600 caractères max). |
| `answer` | ✅ | **La** bonne réponse. Pas besoin de choisir sa position : l'app mélange les choix à chaque affichage. |
| `wrong` | ✅ | Les mauvaises réponses, de 1 à 5 (3 idéalement). |
| `explanation` | ✅ | Ce qu'on lit dans la modale « 💡 Comprendre ». C'est le cœur de l'apprentissage, soigne-la. |
| `difficulty` | | `1` facile, `2` moyen (par défaut), `3` difficile. Les questions difficiles arrivent quand la série monte. |
| `source` | | Un lien pour approfondir (doc officielle, Wikipédia…). |

**Markdown léger** dans `question` et `explanation` : `` `code` ``, `**gras**`, blocs de code avec ```` ``` ```` (écrire `\n` pour les retours à la ligne dans le JSON). Dans les réponses : `` `code` `` et `**gras**` uniquement.

Exemple de question avec du code :

```json
{
  "question": "Qu'affiche ce code ?\n```js\nconsole.log([10, 1, 2].sort())\n```",
  "answer": "`[1, 10, 2]`",
  "wrong": ["`[1, 2, 10]`", "`[10, 2, 1]`", "`[2, 1, 10]`"],
  "explanation": "Sans fonction de comparaison, `sort()` compare les éléments **comme des chaînes**…",
  "difficulty": 2
}
```

## Les règles d'or d'une bonne question

Le jeu est en mode série : une erreur et on retombe à zéro. Une question ambiguë est donc frustrante.

1. **Une seule bonne réponse, indiscutable.** Vérifie qu'aucune « mauvaise » réponse n'est défendable.
2. **Des mauvaises réponses crédibles**, de même nature et de longueur proche de la bonne (sinon la plus longue/détaillée se devine).
3. **Pas de « Toutes les réponses ci-dessus » / « Aucune »** : les choix sont mélangés. Pour la même raison, l'explication ne doit pas parler de « la dernière proposition » ou de l'« option B » : nomme la réponse.
4. **Pas de faits périssables** : prix, records en cours, « la dernière version »… Ou alors datés (« En 2022, … »).
5. **Une explication qui apprend quelque chose**, lisible par un curieux qui découvre le sujet :
   - le **contexte** en une phrase (à quoi sert la notion, où on la rencontre) ;
   - **pourquoi c'est juste**, en définissant chaque terme technique ;
   - un **exemple concret** (situation réelle, mini-calcul, extrait de commande ou de config) ;
   - si utile, **pourquoi le piège principal est faux**.

   Vise 450 à 900 caractères, en phrases courtes.
6. Pour les questions de code : **exécute le code** pour vérifier la sortie.

## Ajouter un sous-thème ou un thème

- **Sous-thème** : crée `questions/<theme>/<id>.json` (minuscules, chiffres et tirets) :

  ```json
  {
    "$schema": "../../schemas/subtheme.schema.json",
    "name": "Docker",
    "icon": "🐳",
    "description": "Images, conteneurs, volumes et Dockerfile.",
    "order": 7,
    "questions": []
  }
  ```

  Vise **au moins 20 questions** : en dessous, on revoit vite les mêmes questions.

- **Thème** : crée un dossier `questions/<id>/` avec un `_theme.json` :

  ```json
  {
    "$schema": "../../schemas/theme.schema.json",
    "name": "Histoire",
    "icon": "🏛️",
    "description": "De l'Antiquité à nos jours.",
    "color": "#0ea5e9",
    "order": 5
  }
  ```

## Vérifier avant d'envoyer

```bash
npm install
npm run validate   # vérifie toutes les questions (format, doublons, réponse présente dans les mauvaises…)
npm run dev        # lance l'app en local, rechargée à chaque modification d'un JSON
```

Le validateur te dit précisément quoi corriger, par exemple :

```
❌ questions/hacking/web.json › question 12 : clé inconnue « explication » (clés possibles : question, answer, wrong, explanation, difficulty, source)
```

La CI lance la même validation sur chaque pull request : une PR avec un JSON invalide ne peut pas casser l'app.

💡 Dans VS Code, l'autocomplétion et la validation des champs fonctionnent directement grâce aux schémas de `schemas/` (configurés dans `.vscode/settings.json`).

## Modifier une question existante

Corriger une coquille ou une réponse est bienvenu ! Note : l'identifiant d'une question est calculé à partir de son énoncé, donc modifier l'énoncé la fait simplement considérer comme « jamais vue » par les joueurs. Aucun impact sur les records.
