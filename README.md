# Centauri Live Studio

<p align="center"><img src="renderer/assets/apexploit-logo.png" width="180" alt="Logo ApeXploit"></p>

Application créée par **ApeXploit**.

Application desktop macOS Apple Silicon et Windows x64 pour la caméra MJPEG de l'Elegoo Centauri Carbon.

Fonctions : détection réseau, aperçu, diagnostic des ports 3030/3031, profils 480p/720p, multidiffusion YouTube/Twitch/Facebook/TikTok, journal FFmpeg et clés non persistantes.

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
