# MQTT Media Player v2.0 Migration Guide

This document describes the migration from GhostTube's original MQTT integration to the new v2.0 spec-compliant format.

## Overview

GhostTube v0.4.0 introduces a completely new MQTT integration that complies with the [ha-mqtt-discoverable MediaPlayer specification v2.0](https://github.com/shyndman/mqtt_media_player). This migration includes:

- **Split topic prefixes** for discovery and state
- **v2.0 spec-compliant discovery configuration**
- **User-configurable device naming**
- **Automatic feature detection**
- **No backward compatibility** - this is a complete breaking change

## What Changed

### Topic Structure

**Before (v1.x):**

```
Discovery: homeassistant/media_player/living_room_tv_youtube/config
State: homeassistant/media_player/living_room_tv_youtube/{topic}
```

**After (v2.0):**

```
Discovery: homeassistant/media_player/{device_name}/ghost-tube/config
State: ghost-tube/media_player/{device_name}/{topic}
```

### Configuration Fields

The discovery configuration now uses v2.0 spec-compliant field names:

| v1.x Field           | v2.0 Field                 | Purpose            |
| -------------------- | -------------------------- | ------------------ |
| `title_topic`        | `media_title_topic`        | Video title        |
| `artist_topic`       | `media_artist_topic`       | Channel name       |
| `albumart_topic`     | `media_image_url_topic`    | Video thumbnail    |
| `duration_topic`     | `media_duration_topic`     | Video duration     |
| `position_topic`     | `media_position_topic`     | Playback position  |
| `mediatype_topic`    | `media_content_type_topic` | Content type       |
| `playmedia_topic`    | `play_media_topic`         | Play media command |
| `state_topic`        | `state_topic`              | _(unchanged)_      |
| `availability_topic` | `availability_topic`       | _(unchanged)_      |
| `seek_topic`         | `seek_topic`               | _(unchanged)_      |
| `play_topic`         | `play_topic`               | _(unchanged)_      |
| `pause_topic`        | `pause_topic`              | _(unchanged)_      |
| `stop_topic`         | `stop_topic`               | _(unchanged)_      |

### User Configuration

A new configuration option is available in the GREEN button menu:

- **MQTT device name**: Configures the device identifier used in topic paths (default: `living-room-tv`)

## Device Naming

The device name affects:

- **Topic paths**: `ghost-tube/media_player/{device_name}/`
- **Discovery path**: `homeassistant/media_player/{device_name}/ghost-tube`
- **Entity ID**: `media_player.{device_name}_ghosttube`
- **Device display name**: Automatically formatted (e.g., `living-room-tv` → `Living Room TV`)

### Examples

| Config Value     | Entity ID                               | Display Name               | State Topics                              |
| ---------------- | --------------------------------------- | -------------------------- | ----------------------------------------- |
| `living-room-tv` | `media_player.living_room_tv_ghosttube` | `Living Room TV GhostTube` | `ghost-tube/media_player/living-room-tv/` |
| `bedroom-tv`     | `media_player.bedroom_tv_ghosttube`     | `Bedroom TV GhostTube`     | `ghost-tube/media_player/bedroom-tv/`     |
| `den`            | `media_player.den_ghosttube`            | `Den GhostTube`            | `ghost-tube/media_player/den/`            |

## Migration Steps

### For End Users

1. **Update GhostTube** to v0.4.0 or later
2. **Configure device name** (optional): Press GREEN button → set "MQTT device name"
3. **Remove old entity** from Home Assistant if needed
4. **Restart Home Assistant** to discover the new entity

### For Developers

No code changes are required - the migration is automatic when updating to v0.4.0.

## Home Assistant Integration

### Discovery Configuration Example

```json
{
  "name": "Living Room TV GhostTube",
  "unique_id": "living_room_tv_ghosttube",
  "availability_topic": "ghost-tube/media_player/living-room-tv/available",
  "state_topic": "ghost-tube/media_player/living-room-tv/state",
  "media_title_topic": "ghost-tube/media_player/living-room-tv/title",
  "media_artist_topic": "ghost-tube/media_player/living-room-tv/artist",
  "media_image_url_topic": "ghost-tube/media_player/living-room-tv/albumart",
  "media_duration_topic": "ghost-tube/media_player/living-room-tv/duration",
  "media_position_topic": "ghost-tube/media_player/living-room-tv/position",
  "media_content_type_topic": "ghost-tube/media_player/living-room-tv/mediatype",
  "videoid_topic": "ghost-tube/media_player/living-room-tv/videoid",
  "seek_topic": "ghost-tube/media_player/living-room-tv/seek",
  "play_media_topic": "ghost-tube/media_player/living-room-tv/playmedia",
  "play_topic": "ghost-tube/media_player/living-room-tv/play",
  "pause_topic": "ghost-tube/media_player/living-room-tv/pause",
  "stop_topic": "ghost-tube/media_player/living-room-tv/stop",
  "device": {
    "identifiers": ["webos_youtube_app_living-room-tv"],
    "name": "Living Room TV",
    "model": "GhostTube YouTube TV App",
    "manufacturer": "webOS",
    "sw_version": "0.4.0"
  }
}
```

### Automatic Feature Detection

Features are automatically detected based on available command topics:

- **Play/Pause/Stop**: Always supported
- **Seek**: Supported (seek_topic present)
- **Play Media**: Supported (play_media_topic present)
- **Volume**: Not supported (no volume topics)
- **Next/Previous**: Not supported (no track navigation topics)

## Troubleshooting

### Entity Not Appearing

1. Check MQTT broker connection in app logs
2. Verify Home Assistant MQTT integration is working
3. Check for discovery message in MQTT broker logs
4. Restart Home Assistant

### Old Entity Still Present

The old v1.x entity may persist in Home Assistant. To remove it:

1. Go to **Settings** → **Devices & Services** → **MQTT**
2. Find the old entity and delete it
3. Restart Home Assistant

### Topic Name Conflicts

If you have multiple GhostTube instances, ensure each has a unique device name in the configuration.

### Configuration Not Saving

Device name changes are applied immediately and trigger automatic republishing of discovery configuration.

## Technical Details

### Implementation

The migration involves:

- **Dynamic topic generation** based on user configuration
- **Real-time config updates** with automatic republishing
- **v2.0 spec compliance** for better Home Assistant integration
- **Backward incompatible** - no support for v1.x format

### Files Modified

- `src/config.js` - Added `mqttDeviceName` configuration option
- `src/mqtt.ts` - Complete rewrite of topic handling and discovery config
- `docs/mqtt-v2-migration-guide.md` - This documentation

## Version History

- **v0.3.8 and earlier**: Original MQTT integration (v1.x format)
- **v0.4.0**: New v2.0 spec-compliant MQTT integration with configurable device naming

## Support

For issues related to the MQTT v2.0 migration:

1. Check the app logs for MQTT connection errors
2. Verify Home Assistant MQTT integration is working
3. Ensure the [mqtt_media_player](https://github.com/shyndman/mqtt_media_player) custom component is v2.0 compatible
4. Report issues on the GhostTube GitHub repository
