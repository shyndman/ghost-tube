# Volume Monitoring & Split Architecture Context

## Current Status

We just implemented volume monitoring in `hass.ts` but discovered an architectural issue that led to a broader discussion about app-level vs video-level concerns.

## Volume Monitoring Implementation (Completed)

### Added Fields

```typescript
// Volume monitoring
private _currentVolume: number | null = null;
private _volumeMuted: boolean | null = null;
private _soundOutput: string | null = null;
private _volumeSubscription: any = null;
```

### Added Methods

- `initVolumeMonitoring()` - Subscribes to webOS volume changes
- `onVolumeChange()` - Handles volume change events with detailed logging
- Updated `logMetadataSummary()` to include volume fields
- Added cleanup in `destroy()` method

### webOS API Usage

```typescript
this._volumeSubscription = webOS.service.request(
  'luna://com.webos.service.audio',
  {
    method: 'master/getVolume',
    parameters: { subscribe: true },
    onSuccess: this.onVolumeChange.bind(this),
    onFailure: (error: any) => {
      /* retry logic */
    }
  }
);
```

### Type Declarations Added

```typescript
declare global {
  var webOS:
    | {
        service: {
          request: (
            service: string,
            options: {
              method: string;
              parameters?: any;
              onSuccess?: (response: any) => void;
              onFailure?: (error: any) => void;
            }
          ) => any;
        };
      }
    | undefined;
}
```

## Architectural Issue Discovered

### The Problem

Current implementation ties volume monitoring to individual video instances:

- User watches Video A → Volume subscription created
- User navigates to Video B → Volume subscription cancelled, new one created
- User navigates to Video C → Volume subscription cancelled, new one created
- User leaves /watch → Volume subscription cancelled

### The Issue

Volume is global TV state, not video-specific. This creates unnecessary subscription churn.

## Split Architecture Discussion

### Option 1: Split Monitoring (Preferred)

**AppHandler** (New):

- Volume monitoring (global TV state)
- Lifecycle: Created when app starts, destroyed when leaving YouTube entirely
- Persistent throughout YouTube app session

**VideoHandler** (Refactored from HomeAssistantHandler):

- Video-specific metadata (title, creator, duration, publishDate)
- Player state monitoring for current video
- Video element event handling
- Lifecycle: Created per video, destroyed on video navigation

### Benefits of Split

- Eliminates unnecessary volume subscription churn
- Better separation of concerns
- More maintainable architecture
- Sets foundation for future app-level features

## Player API removeEventListener Question

### The Assumption

Current code assumes YouTube Player API doesn't support `removeEventListener`:

```typescript
// Remove player listeners
if (this.player) {
  // Note: Player API doesn't support removeEventListener
  console.info('[HASS] Player listeners cannot be removed (API limitation)');
}
```

### The Challenge

- `YTPlayer extends HTMLElement` - should inherit standard DOM methods
- Comment might be incorrect assumption rather than tested reality
- If `removeEventListener` works, changes entire architecture discussion

### Test Plan

1. **Test 1**: Does method exist and run without exception?
2. **Test 2**: Does it actually stop events from firing?

If `removeEventListener` works, the listener accumulation problem we assumed might not exist.

## Volume Monitoring Features

### CEC Integration

- webOS volume APIs automatically handle HDMI CEC devices
- Volume control affects whatever audio device is currently active (TV speakers or CEC device)
- API transparently handles TV speakers vs soundbar/receiver volume

### Expected Volume Response Format

```typescript
{
  volume: number,        // Current volume level (0-100)
  muted: boolean,        // Mute status
  soundOutput: string,   // Active device ("external_arc", "tv_external_speaker", etc.)
  scenario: string,      // Audio scenario type
  subscribed: boolean    // Subscription status
}
```

## Next Steps (Paused)

1. Test Player API removeEventListener capability
2. Based on results, decide if split architecture is necessary
3. If split needed, implement AppHandler/VideoHandler separation
4. If not needed, keep current structure but improve lifecycle management

## Code Status

- Volume monitoring: ✅ Implemented and working
- TypeScript compilation: ✅ Passing
- ESLint: ✅ Passing
- Architecture: ⏸️ Paused pending Player API test results
