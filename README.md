# MOM Hub

Plateforme d'outils du **Mutzig Ovalie Molsheim** (club de rugby alsacien).

## 🎯 Qu'est-ce que c'est ?

Le MOM Hub est une plateforme web qui regroupe les différents outils du club :
gestion des compositions d'équipes, suivi des matchs, bilans joueurs, statistiques, et plus à venir.

L'architecture repose sur :
- **Le MOM Core** : référentiels, schémas et fiches au format JSON, hébergés sur Google Drive
- **Le portail web** : page d'accueil HTML statique servant de point d'entrée
- **Les outils** : modules construits progressivement, qui s'appuient sur le Core

## 🌐 Accès au Hub

Une fois GitHub Pages activé, le Hub sera accessible à l'adresse :

```
https://[ton-nom-utilisateur-github].github.io/mom-hub/
```

## 📂 Structure du repo

```
mom-hub/
├── index.html        ← page d'accueil du Hub (portail)
├── README.md         ← ce fichier
└── (futurs modules à venir)
    ├── compos/       ← MOM Compos (compositions d'équipes)
    ├── suivi-match/  ← Suivi-Match
    ├── rapport/      ← Rapport
    ├── bilans/       ← Bilans joueurs/équipes
    └── stats/        ← Statistiques
```

## 🛠️ Stack technique

- **HTML/CSS/JavaScript** statique (pas de framework)
- **Google Drive** pour le MOM Core (JSON)
- **GitHub Pages** pour l'hébergement gratuit
- **Aucun backend** dans la version initiale

## 📝 Suivi du projet

Le projet est documenté dans le Drive partagé :
- Doctrine MOM Hub
- Audits des modules
- MOM Core (référentiels, schémas, fiches)

## 🔒 Visibilité

Repo privé pour l'instant, ouvert progressivement selon les phases :
- Phase 1-2 : Manu seul
- Phase 3+ : staff MOM
- 
- Phase 5 : membres et familles

## 📅 Statut

**Phase 1 — Mise en service du portail** (mai 2026)

