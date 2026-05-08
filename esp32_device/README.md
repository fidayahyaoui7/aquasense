# ESP32 AquaSense Device

Firmware ESP32-CAM pour le projet AquaSense — capture et envoi automatique d'images de compteur d'eau.

## Configuration

1. Copiez le fichier de configuration exemple :
   ```bash
   cp config_wifi.example.h config_wifi.h
   ```
2. Éditez `config_wifi.h` avec vos identifiants WiFi et l'IP du serveur backend.

> **⚠️ Important** : `config_wifi.h` est dans `.gitignore` — ne le commitez jamais !

## Prérequis matériels

- ESP32-CAM (AI-Thinker module)
- Module caméra OV2640
- Alimentation 5V / 500mA minimum

## Flashage

1. Ouvrez `esp32_device.ino` dans l'IDE Arduino
2. Sélectionnez la carte : **Tools → Board → ESP32 Wrover Module**
3. Sélectionnez le port COM correspondant
4. Téléversez (`Ctrl+U`)

## Architecture

- Connexion WiFi avec ping de surveillance
- Capture photo via caméra OV2640
- Envoi HTTP POST vers `POST /readings/esp32/device/{DEVICE_ID}`
- Intervalle configurable entre captures (défaut : 60s)

## Identifiant device

Modifiez `DEVICE_ID` dans le code source (ligne ~14) pour correspondre au device enregistré dans le backend.
