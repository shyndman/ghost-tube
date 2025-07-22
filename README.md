# Ghost-Tube

> **Note:** This app's configuration is currently hardcoded for my personal setup. If you'd like a more configurable version or have other feature requests, please [create an issue](https://github.com/shyndman/ghost-tube/issues) and I'll be happy to implement it!

Enhanced YouTube TV app for webOS with Home Assistant integration

_Based on the excellent [youtube-webos](https://github.com/webosbrew/youtube-webos) project by webosbrew_

## Features

- **🏠 Home Assistant MQTT Integration** - Real-time playback state broadcasting and remote control
- **🎨 Custom Logo** - Replace YouTube logo with Ghost-Tube branding
- **📺 Enhanced YouTube Experience** - Features inherited from [youtube-webos](https://github.com/webosbrew/youtube-webos)
- [Autostart](#autostart)

**Note:** Configuration screen can be opened by pressing 🟩 GREEN button on the remote.

## Home Assistant Integration

Ghost-Tube integrates seamlessly with Home Assistant via MQTT:

- **Real-time state broadcasting**: Video title, creator, thumbnail, duration, playback position
- **Remote control**: Seek to specific position, play videos by ID
- **TV standby detection**: Automatically clears media state when TV is off
- **Auto-discovery**: Automatically configures Home Assistant media player entity

Requires the [shyndman/mqtt_media_player](https://github.com/shyndman/mqtt_media_player) custom component.

## Pre-requisites

- Official YouTube app needs to be uninstalled before installation.

## Installation

- Use [webOS Homebrew Channel](https://github.com/webosbrew/webos-homebrew-channel)
- Use [Device Manager app](https://github.com/webosbrew/dev-manager-desktop)
- Use [webOS TV CLI tools](https://webostv.developer.lge.com/develop/tools/cli-installation) -
  `ares-install youtube...ipk` (For more information on configuring the webOS CLI tools, see [below](#development-tv-setup))

## Configuration

Configuration screen can be opened by pressing 🟩 GREEN button on the remote.

### Autostart

In order to autostart an application the following command needs to be executed
via SSH or Telnet:

```sh
luna-send-pub -n 1 'luna://com.webos.service.eim/addDevice' '{"appId":"youtube.leanback.v4","pigImage":"","mvpdIcon":""}'
```

This will make "GhostTube" display as an eligible input application (next
to HDMI/Live TV, etc...), and, if it was the last selected input, it will be
automatically launched when turning on the TV.

This will also greatly increase startup performance, since it will be runnning
constantly in the background, at the cost of increased idle memory usage.
(so far, relatively unnoticable in normal usage)

In order to disable autostart run this:

```sh
luna-send-pub -n 1 'luna://com.webos.service.eim/deleteDevice' '{"appId":"youtube.leanback.v4"}'
```

## Building

- Clone the repository

```sh
git clone https://github.com/shyndman/ghost-tube.git
```

- Enter the folder and build the App, this will generate a `*.ipk` file.

```sh
cd ghost-tube

# Install dependencies (need to do this only when updating local repository / package.json is changed)
npm install

npm run build && npm run package
```

## Development TV setup

These instructions use the [webOS CLI tools](https://github.com/webos-tools/cli).
See <https://webostv.developer.lge.com/develop/tools/cli-introduction> for more information.

### Configuring webOS CLI tools with Developer Mode App

This is partially based on <https://webostv.developer.lge.com/develop/getting-started/developer-mode-app>.

- Install Developer Mode app from Content Store
- Enable Developer Mode
- Enable key server and download TV's private key: `http://TV_IP:9991/webos_rsa`
  The key must be saved under `~/.ssh` (or `%USERPROFILE%\.ssh` on Windows)
- Configure the device using `ares-setup-device` (`-a` may need to be replaced with `-m` if device named `webos` is already configured)
  - `PASSPHRASE` is the 6-character passphrase printed on screen in developer mode app
  - `privatekey` path is relative to `${HOME}/.ssh` (Windows: `%USERPROFILE%\.ssh`)

```sh
ares-setup-device -a webos -i "username=prisoner" -i "privatekey=webos_rsa" -i "passphrase=PASSPHRASE" -i "host=TV_IP" -i "port=9922"
```

### Configuring webOS CLI tools with Homebrew Channel / root

- Enable SSH in Homebrew Channel app
- Generate SSH key on developer machine (`ssh-keygen -t rsa`)
- Copy the private key (`id_rsa`) to the `~/.ssh` directory (or `%USERPROFILE%\.ssh` on Windows) on the local computer
- Append the public key (`id_rsa.pub`) to the `/home/root/.ssh/authorized_keys` file on the TV
- Configure the device using `ares-setup-device` (`-a` may need to be replaced with `-m` if device named `webos` is already configured)
  - `privatekey` path is relative to `${HOME}/.ssh` (Windows: `%USERPROFILE%\.ssh`)

```sh
ares-setup-device -a webos -i "username=root" -i "privatekey=id_rsa" -i "passphrase=SSH_KEY_PASSPHRASE" -i "host=TV_IP" -i "port=22"
```

## Installation

```sh
npm run deploy
```

## Launching

- The app will be available in the TV's app list. You can also launch it using the webOS CLI tools.

```sh
npm run launch
```

To jump immediately into some specific video use:

```sh
npm run launch -- -p '{"contentTarget":"v=F8PGWLvn1mQ"}'
```
