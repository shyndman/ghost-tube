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
- `npm run build-deploy-inspect` - Complete workflow: build, package, deploy, launch, and start inspector

### Browser Automation (MCP)

- `npm run mcp:playwright` - Start Playwright MCP server for browser automation

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
- Babel transpilation for modern JavaScript features (targeting Node.js v8.12.0 on webOS TV 6.0+)
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

- Target platform uses Node.js v8.12.0 (webOS TV 6.0+)
- Chromium 79 web engine with modern JavaScript support
- Use inline-source-map for development builds
- Native ES6+ support (async/await, classes, arrow functions)

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

- **Modern Runtime**: webOS TV 6.0+ uses Node.js v8.12.0 and Chromium 79
- **Source Maps**: Use inline-source-map in development for best compatibility
- **Remote Only**: All debugging done remotely via CLI tools
- **Performance**: Modern hardware supports more extensive debugging features

## MQTT Integration

### MQTT.js Modern Version

- **Current Version**: MQTT.js v4.3.8 (modern version with Node.js v8.12.0+ support)
- **Upgrade Complete**: Upgraded from legacy v1.14.1 to modern v4.x
- **Status**: Installed but not yet implemented in application
- **Benefits**: Promise-based API, better TypeScript support, enhanced reconnection logic, improved error handling

### Future Implementation Notes

When implementing MQTT functionality:

1. **Import**: `const mqtt = require('mqtt');` or `import mqtt from 'mqtt';`
2. **Connection**: `const client = mqtt.connect('mqtt://broker-url');`
3. **Modern API**: Supports both callback and Promise-based patterns
4. **Features Available (v4.x)**:

   - Full MQTT 3.1.1 support
   - SSL/TLS connections
   - WebSocket support
   - QoS levels 0, 1, 2
   - Last Will and Testament (LWT)
   - Username/password authentication
   - Retained messages
   - Clean session support
   - Automatic reconnection with exponential backoff
   - Better TypeScript definitions
   - Stream-based architecture
   - Improved error handling and debugging

5. **Integration Pattern**: Follow existing module patterns in `src/hass.ts`
6. **Configuration**: Add MQTT settings to `src/config.js` configuration system

## Browser Automation with MCP

### Playwright MCP Integration

- **Package**: `@playwright/mcp` installed as development dependency
- **Configuration**: `playwright-mcp.config.json` configures Firefox browser with localhost-only access
- **Security**: Network access restricted to localhost origins only for safety

### MCP Workflow Commands

- **MCP Server**: Configure `@playwright/mcp` in Claude Code settings with config file `playwright-mcp.config.json`
- **Development Workflow**: `npm run build-deploy-inspect` - Complete sequence:
  1. Build app with webpack (`npm run build`)
  2. Package app as .ipk (`npm run package`)
  3. Deploy app to webOS device (`npm run deploy`)
  4. Launch app on device (`npm run launch`)
  5. Start webOS inspector (`npm run inspect`) and capture localhost URL

### Integration with Claude Code

The MCP integration enables Claude Code to:

- **Automate webOS debugging**: Control browser to navigate inspector interface
- **Extract live metadata**: Analyze running YouTube app state and player data
- **Debug features**: Test adblock, sponsorblock, and other modules in real-time
- **Network analysis**: Monitor API calls and data flow on actual webOS hardware
- **DOM inspection**: Examine YouTube TV interface structure as it runs

### Configuration Files

- **`playwright-mcp.config.json`**: MCP server configuration with Firefox and localhost restrictions
- **`tools/build-deploy-inspect.js`**: Development workflow script for complete build and deployment

### Usage Pattern

1. Configure Playwright MCP server in Claude Code settings
2. Run `npm run build-deploy-inspect` to deploy app and start inspector
3. Wait for "Inspector URL captured" message with localhost URL
4. Ask Claude Code to use MCP browser tools to navigate to inspector URL and automate debugging tasks
