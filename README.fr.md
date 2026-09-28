# CI Failure Triage Agent

Un bot GitHub Actions qui lit les logs d'un CI en échec, demande à un LLM la cause probable, et poste le diagnostic en commentaire sur la pull request.

Construit pour comprendre comment l'IA agentique s'intègre dans un pipeline DevOps : **observer → raisonner → rapporter**, avec un humain qui décide quoi corriger.

## Démo : détecter un vrai bug

Le dépôt contient une petite application de coffee shop (`demo-app/`) avec une suite de tests Jest exécutée dans le CI. Elle contient une fonction `calculateOrderTotal` avec une règle : *10 % de remise quand la commande contient au moins 3 articles au total.*

Un bug subtil a été introduit : la remise était vérifiée **par ligne de commande** au lieu de la **quantité totale**. Ainsi, 3 cafés sur une même ligne recevaient la remise, mais pas 2 lattes + 1 croissant.

Ce qui s'est passé sur la pull request :

1. Le CI a exécuté les tests et l'un d'eux a échoué (`Expected: 9.45, Received: 10.5`)
2. Le bot a récupéré les logs, interrogé le LLM, et commenté avec le test en échec et les preuves
3. J'ai lu l'échec, trouvé la condition fautive, et je l'ai corrigée
4. Le CI est passé au vert

L'histoire complète est dans la [PR #3](https://github.com/khalillaabidi25-gif/ci-triage-agent/pull/3).

> Ajoutez ici une capture d'écran du commentaire du bot : `docs/bot-comment.png`

### Ce que m'a appris le fait que le bot se trompe en partie

Le bot a correctement trouvé le test en échec et cité les bonnes preuves. Mais la correction qu'il suggérait (compter `items.length`, ou modifier le test) était fausse : le test était correct et le bug se trouvait dans la fonction. Si le bot avait eu le droit d'appliquer lui-même sa correction, il aurait aggravé la situation.

C'est pourquoi il s'agit d'un agent de **diagnostic**, et non d'un agent autonome : il enquête et rapporte, et c'est un humain qui valide tout changement de code.

## Fonctionnement

```
Le CI échoue sur une PR
      │
      ▼
L'événement workflow_run déclenche le workflow de triage
      │
      ▼
Composite action :
  1. récupère les logs du job en échec (API REST GitHub)
  2. envoie le log à un LLM pour une analyse de cause racine (Groq)
  3. poste l'analyse en commentaire de la PR
```

Le workflow (`.github/workflows/ci-failure-triage.yml`) contient le déclencheur et transmet l'identifiant du run et les secrets à l'action (`action/action.yml`), car une composite action ne peut pas lire directement `github.*` ni `secrets.*`.

## Stack technique

- TypeScript / Node.js
- GitHub Actions (déclencheur `workflow_run`, composite action)
- Octokit (API REST GitHub)
- API Groq (compatible OpenAI), offre gratuite
- Jest (pour les tests de l'application de démo)

## Problèmes résolus en chemin

- **`Unrecognized named-value: 'github'`** : une composite action ne peut pas utiliser `github.*` ni `secrets.*`, et GitHub évalue `${{ }}` même dans le texte des descriptions. Les valeurs sont désormais transmises en inputs/env par le workflow appelant.
- **Erreur 404 sur le modèle** : le modèle Llama initial n'était plus disponible sur l'offre gratuite. Une 404 d'une API de LLM signifie souvent « modèle non disponible pour vous », et non « mauvaise clé ».
- **Erreur 404 sur la recherche de PR** : un endpoint dédié à la recherche de la PR échouait sans cesse. Le numéro de PR était déjà présent dans la réponse du workflow run, donc l'appel supplémentaire a été supprimé.

## Comment il a été construit

J'ai conçu le projet, dirigé un agent de code IA (OpenCode) pour l'implémenter par étapes, débogué les erreurs rencontrées, et écrit moi-même la correction du bug dans l'application de démo.

## L'essayer soi-même

1. Faites un fork du dépôt
2. Ajoutez un secret de dépôt nommé `GROQ_API_KEY` (clé gratuite sur [console.groq.com](https://console.groq.com))
3. Ouvrez une pull request qui casse un test. Le bot commente dès que le CI échoue
