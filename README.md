# Centauri Live Studio

<p align="center"><img src="renderer/assets/apexploit-logo.png" width="180" alt="Logo ApeXploit"></p>

Application créée par **ApeXploit**.

Application desktop macOS Apple Silicon et Windows x64 pour la caméra MJPEG de l'Elegoo Centauri Carbon.

Fonctions : détection réseau, aperçu, diagnostic des ports 3030/3031, profils 480p/720p, multidiffusion YouTube/Twitch/Facebook/TikTok, journal FFmpeg et clés non persistantes.
La version 1.6 ajoute la reconnexion automatique (jusqu'à cinq tentatives), l'état individuel des destinations et la sauvegarde facultative des clés avec le chiffrement natif du système.
La version 1.7 ajoute un assistant de première configuration, la mémorisation des préférences non sensibles et l'enregistrement local simultané en MKV avec choix du dossier.
La version 1.8 ajoute les réglages de contraste, luminosité, saturation et netteté, un overlay ApeXploit facultatif et les statistiques FPS, débit cible et vitesse d'encodage.

## Développement

```sh
npm install
npm start
```

## Paquets

```sh
npm run dist:mac
npm run dist:win
```

FFmpeg peut être installé directement depuis l'écran **Diagnostic**. Sur macOS, l'application pilote Homebrew ; sur Windows, elle utilise `winget` et le paquet `Gyan.FFmpeg.Essentials`. La progression et les éventuelles erreurs sont affichées dans le journal intégré.

## Indépendance

Ce projet est indépendant et n'est ni affilié, ni approuvé, ni édité par Elegoo. Elegoo et Centauri Carbon sont des marques de leurs propriétaires respectifs.
