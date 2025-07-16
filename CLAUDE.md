# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build and Package

- `npm run build` - Build production bundle
- `npm run build:dev` - Build development bundle with source maps
- `npm run package` - Create .ipk package file using ares-package
- `npm run build && npm run package` - Full build and package sequence

### Code Quality

- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking
- `npm run prettier-check` - Check code formatting

### Deployment and Testing

- `npm run deploy` - Build, package, and install on configured webOS device
- `npm run launch` - Launch the app on webOS device
- `npm run launch -- -p '{"contentTarget":"v=VIDEO_ID"}'` - Launch with specific video
- `npm run inspect` - Open developer tools for the app

### Utility Commands

- `npm run manifest` - Generate manifest file
- `npm run version` - Sync version across files

## Architecture Overview

This is a webOS application that provides an ad-free YouTube experience with additional features like SponsorBlock integration. The app works by injecting custom JavaScript into the YouTube TV interface.

### Entry Points

- `src/index.js` - Main application entry point, handles launch parameters
- `src/userScript.js` - User script that gets injected into YouTube, imports all feature modules
- `src/index.html` - Main HTML file loaded by webOS

### Core Systems

#### Configuration System (`src/config.js`)

- Centralized configuration management using localStorage
- Event-driven system for config changes using DocumentFragment events
- All feature toggles are managed through this system
- Key functions: `configRead()`, `configWrite()`, `configAddChangeListener()`

#### Player API (`src/player-api.ts`)

- TypeScript interface for YouTube's HTML5 player
- Provides typed access to video quality controls and player state
- `getPlayer()` function returns promise for player element
- `requireElement()` utility for waiting for DOM elements

#### Launch Handling (`src/utils.js`)

- Processes webOS launch parameters and deep links
- Handles voice commands and content targeting
- Supports direct video launches and search queries
- `handleLaunch()` constructs appropriate YouTube URLs

### Feature Modules

Each feature is implemented as a separate module imported by `userScript.js`:

- `adblock.js` - Advertisement blocking functionality
- `sponsorblock.js` - SponsorBlock integration for skipping segments
- `shorts.js` - YouTube Shorts removal from feeds
- `ui.js` - Custom UI elements and configuration screen
- `video-quality.ts` - Video quality enforcement
- `thumbnail-quality.ts` - Thumbnail quality enhancement
- `screensaver-fix.ts` - Prevents screensaver during playback
- `watch.js` - Watch page enhancements
- `hass.ts` - Home Assistant integration monitoring video player state

### Build System

- Webpack-based build with separate entry points for main app and user script
- Babel transpilation for webOS compatibility (nodeJS v0.12.2 on webOS 3.x)
- CSS processing with PostCSS and autoprefixer
- Source maps for development builds

### webOS Integration

- App ID: `youtube.leanback.v4`
- Privileged jail access for enhanced functionality
- Deep linking support for videos and search
- Voice command integration with LG ThinQ
- Configuration via GREEN button on remote

## Development Notes

### webOS Constraints

- Target platform uses very old nodeJS (v0.12.2)
- Avoid eval-based source maps (cause segfaults)
- Use inline-source-map for development builds
- Must transpile modern JavaScript features

### Testing

- No formal test suite - manual testing on webOS device required
- Use `npm run deploy` to install on configured device
- Configuration screen accessible via GREEN button
- Check browser console for debugging info

### Configuration System Pattern

When adding new features:

1. Add option to `configOptions` Map in `src/config.js`
2. Use `configRead(key)` to get current value
3. Use `configAddChangeListener(key, callback)` for reactive updates
4. Add UI toggle in `src/ui.js`

### Player Integration Pattern

For video player interactions:

1. Use `getPlayer()` from `player-api.ts`
2. Use `requireElement()` for waiting on DOM elements
3. Player state changes via `addEventListener('onStateChange')`
4. Quality controls via `setPlaybackQualityRange()`

## Security and Privacy

### Data Handling

- **Local Storage Only**: All configuration stored in browser localStorage
- **No User Tracking**: No analytics, telemetry, or user behavior tracking
- **No Credential Handling**: App relies entirely on YouTube's existing authentication
- **Privacy-Respecting**: Only necessary data is processed for functionality

### Network Communications

- **SponsorBlock API**: Optional calls to `https://sponsorblock.inf.re/api` for segment data
  - Only sends SHA256 hash of video ID (not the actual video ID)
  - Can be completely disabled in settings
  - No personal information transmitted
- **No External Tracking**: No communication with ad networks or analytics services
- **YouTube Only**: All other network requests are to YouTube's own APIs

### Ad Blocking Implementation

- **Client-Side Only**: Uses modified uBlock Origin rules applied locally
- **No External Filters**: Ad blocking rules are embedded in the application
- **YouTube-Specific**: Only filters YouTube's ad placement data structures
- **Transparent**: All blocking logic is visible in `src/adblock.js`

### User Control

- **Configurable Features**: All functionality can be disabled via GREEN button menu
- **Granular SponsorBlock**: Individual segment types can be enabled/disabled
- **Open Source**: Entire codebase is auditable and transparent
- **No Forced Features**: Users can disable any unwanted functionality

### Development Security

- **No Obfuscation**: All code is readable and well-documented
- **Standard Dependencies**: Uses only established, audited npm packages
- **Source Maps**: Generated for debugging and transparency
- **Community Maintained**: Open source project under webosbrew organization

## Debugging and Logging

### webOS Debugging Tools

- **Web Inspector**: Use `npm run inspect` to open Chrome DevTools-like interface for remote debugging
- **Console Access**: Full browser console, DOM inspector, network tab, and sources panel available
- **CLI Tools**: `ares-inspect`, `ares-launch`, `ares-device` for comprehensive debugging workflow

### Logging Practices

The project uses extensive console logging for debugging:

- **SponsorBlock**: `console.info(this.videoID, 'Got it:', result);`
- **UI Events**: `console.info('KEY:', charCode, keyCode);`
- **Config Changes**: `console.info('Config changed:', key, oldValue, newValue);`
- **Launch Events**: `console.info('webOS relaunch:', event.detail);`

### Debugging Workflow

1. **Deploy**: `npm run deploy` - Install on webOS device
2. **Launch**: `npm run launch` - Start application
3. **Inspect**: `npm run inspect` - Open debugging tools
4. **Test**: `npm run launch -- -p '{"contentTarget":"v=VIDEO_ID"}'` - Launch with specific video

### Platform-Specific Debugging Constraints

- **Old Runtime**: webOS 3.x uses Node.js v0.12.2 and Chromium 38
- **Source Maps**: Use inline-source-map in development to avoid segfaults
- **Remote Only**: All debugging done remotely via CLI tools
- **Performance**: Be mindful of excessive logging on low-spec devices

## MQTT Integration

### MQTT.js v1.14.1 Compatibility

- **Version Constraint**: Using MQTT.js v1.14.1 for Node.js v0.12.2 compatibility
- **Breaking Change**: MQTT.js v2.0.0+ dropped support for Node.js v0.8, v0.10, and v0.12
- **Status**: Installed but not yet implemented in application
- **LTS Support**: v1.x.x series maintained specifically for older Node.js versions

### Future Implementation Notes

When implementing MQTT functionality:

1. **Import**: `const mqtt = require('mqtt');`
2. **Connection**: `const client = mqtt.connect('mqtt://broker-url');`
3. **Features Available**:
   - Full MQTT 3.1.1 support
   - SSL/TLS connections
   - WebSocket support
   - QoS levels 0, 1, 2
   - Last Will and Testament (LWT)
   - Username/password authentication
   - Retained messages
   - Clean session support
   - Automatic reconnection

4. **Integration Pattern**: Follow existing module patterns in `src/hass.ts`
5. **Configuration**: Add MQTT settings to `src/config.js` configuration system
