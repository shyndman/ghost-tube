import { getPlayer, PlayerState, YTPlayer } from './player-api';

class HomeAssistantHandler {
  private videoId: string | null = null;
  private video: HTMLVideoElement | null = null;
  private player: YTPlayer | null = null;
  private destroyed = false;
  private lastReportedState: PlayerState | null = null;
  private lastReportedTime: number = 0;

  // Event handlers bound to instance
  private boundHandlers = {
    onPlayerStateChange: this.onPlayerStateChange.bind(this),
    onVideoPlay: this.onVideoPlay.bind(this),
    onVideoPause: this.onVideoPause.bind(this),
    onVideoTimeUpdate: this.onVideoTimeUpdate.bind(this),
    onVideoEnded: this.onVideoEnded.bind(this),
    onVideoDurationChange: this.onVideoDurationChange.bind(this),
    onVideoLoadedMetadata: this.onVideoLoadedMetadata.bind(this),
    onVideoSeeking: this.onVideoSeeking.bind(this),
    onVideoSeeked: this.onVideoSeeked.bind(this)
  };

  constructor(videoId: string) {
    this.videoId = videoId;
    console.info('[HASS] Creating HomeAssistantHandler for video:', videoId);
  }

  async init() {
    console.info('[HASS] Initializing HomeAssistantHandler...');
    
    // Get player element
    try {
      console.info('[HASS] Waiting for player element...');
      this.player = await getPlayer();
      console.info('[HASS] Player element found:', this.player);
      
      // Attach player state change listener
      this.player.addEventListener('onStateChange', this.boundHandlers.onPlayerStateChange);
      console.info('[HASS] Attached onStateChange listener to player');
    } catch (error) {
      console.error('[HASS] Failed to get player:', error);
    }

    // Get video element
    this.attachToVideo();
  }

  private attachToVideo() {
    console.info('[HASS] Looking for video element...');
    const video = document.querySelector('video');
    
    if (!video) {
      console.info('[HASS] No video element found, retrying in 500ms...');
      if (!this.destroyed) {
        setTimeout(() => this.attachToVideo(), 500);
      }
      return;
    }

    console.info('[HASS] Video element found:', video);
    console.info('[HASS] Video properties:', {
      duration: video.duration,
      currentTime: video.currentTime,
      paused: video.paused,
      ended: video.ended,
      readyState: video.readyState,
      networkState: video.networkState,
      currentSrc: video.currentSrc
    });

    this.video = video;

    // Attach all video event listeners
    video.addEventListener('play', this.boundHandlers.onVideoPlay);
    video.addEventListener('pause', this.boundHandlers.onVideoPause);
    video.addEventListener('timeupdate', this.boundHandlers.onVideoTimeUpdate);
    video.addEventListener('ended', this.boundHandlers.onVideoEnded);
    video.addEventListener('durationchange', this.boundHandlers.onVideoDurationChange);
    video.addEventListener('loadedmetadata', this.boundHandlers.onVideoLoadedMetadata);
    video.addEventListener('seeking', this.boundHandlers.onVideoSeeking);
    video.addEventListener('seeked', this.boundHandlers.onVideoSeeked);

    console.info('[HASS] Attached all video event listeners');
  }

  // Player API event handler
  private onPlayerStateChange(state: PlayerState) {
    const stateName = PlayerState[state] || 'UNKNOWN';
    console.info(`[HASS] Player state changed: ${stateName} (${state})`, {
      previousState: this.lastReportedState !== null ? PlayerState[this.lastReportedState] : 'none',
      timestamp: Date.now(),
      videoId: this.videoId
    });
    this.lastReportedState = state;
  }

  // Video element event handlers
  private onVideoPlay() {
    console.info('[HASS] Video PLAY event', {
      currentTime: this.video?.currentTime,
      duration: this.video?.duration,
      timestamp: Date.now()
    });
  }

  private onVideoPause() {
    console.info('[HASS] Video PAUSE event', {
      currentTime: this.video?.currentTime,
      duration: this.video?.duration,
      timestamp: Date.now()
    });
  }

  private onVideoTimeUpdate() {
    const currentTime = this.video?.currentTime || 0;
    // Only log significant time changes (every 5 seconds) to avoid spam
    if (Math.abs(currentTime - this.lastReportedTime) >= 5) {
      console.info('[HASS] Video time update', {
        currentTime,
        duration: this.video?.duration,
        progress: this.video?.duration ? (currentTime / this.video.duration * 100).toFixed(1) + '%' : 'N/A'
      });
      this.lastReportedTime = currentTime;
    }
  }

  private onVideoEnded() {
    console.info('[HASS] Video ENDED event', {
      finalTime: this.video?.currentTime,
      duration: this.video?.duration,
      timestamp: Date.now()
    });
  }

  private onVideoDurationChange() {
    console.info('[HASS] Video DURATION CHANGE event', {
      newDuration: this.video?.duration,
      currentTime: this.video?.currentTime,
      timestamp: Date.now()
    });
  }

  private onVideoLoadedMetadata() {
    console.info('[HASS] Video LOADED METADATA event', {
      duration: this.video?.duration,
      videoWidth: this.video?.videoWidth,
      videoHeight: this.video?.videoHeight,
      timestamp: Date.now()
    });
  }

  private onVideoSeeking() {
    console.info('[HASS] Video SEEKING event', {
      currentTime: this.video?.currentTime,
      timestamp: Date.now()
    });
  }

  private onVideoSeeked() {
    console.info('[HASS] Video SEEKED event', {
      newTime: this.video?.currentTime,
      timestamp: Date.now()
    });
  }

  destroy() {
    console.info('[HASS] Destroying HomeAssistantHandler...');
    this.destroyed = true;

    // Remove player listeners
    if (this.player) {
      // Note: Player API doesn't support removeEventListener
      console.info('[HASS] Player listeners cannot be removed (API limitation)');
    }

    // Remove video listeners
    if (this.video) {
      this.video.removeEventListener('play', this.boundHandlers.onVideoPlay);
      this.video.removeEventListener('pause', this.boundHandlers.onVideoPause);
      this.video.removeEventListener('timeupdate', this.boundHandlers.onVideoTimeUpdate);
      this.video.removeEventListener('ended', this.boundHandlers.onVideoEnded);
      this.video.removeEventListener('durationchange', this.boundHandlers.onVideoDurationChange);
      this.video.removeEventListener('loadedmetadata', this.boundHandlers.onVideoLoadedMetadata);
      this.video.removeEventListener('seeking', this.boundHandlers.onVideoSeeking);
      this.video.removeEventListener('seeked', this.boundHandlers.onVideoSeeked);
      console.info('[HASS] Removed all video event listeners');
    }

    this.video = null;
    this.player = null;
    console.info('[HASS] Cleanup complete');
  }
}

// Global instance management
declare global {
  interface Window {
    homeAssistant: HomeAssistantHandler | null;
  }
}

window.homeAssistant = null;

function uninitializeHomeAssistant() {
  console.info('[HASS] Uninitializing HomeAssistant...');
  if (!window.homeAssistant) {
    console.info('[HASS] No instance to uninitialize');
    return;
  }
  try {
    window.homeAssistant.destroy();
  } catch (err) {
    console.error('[HASS] destroy() failed:', err);
  }
  window.homeAssistant = null;
  console.info('[HASS] Uninitialization complete');
}

// URL change monitoring
window.addEventListener('hashchange', () => {
  const newURL = new URL(location.hash.substring(1), location.href);
  const pathname = newURL.pathname;
  const videoId = newURL.searchParams.get('v');
  
  console.info('[HASS] Hash change detected', {
    pathname,
    videoId,
    fullHash: location.hash,
    hasInstance: !!window.homeAssistant,
    currentVideoId: window.homeAssistant?.videoId
  });

  // Uninitialize when not on /watch
  if (pathname !== '/watch' && window.homeAssistant) {
    console.info('[HASS] Not on /watch page, uninitializing...');
    uninitializeHomeAssistant();
    return;
  }

  // Check if we need to reload for a new video
  const needsReload = videoId && (!window.homeAssistant || window.homeAssistant.videoId !== videoId);
  
  console.info('[HASS] Reload check', {
    needsReload,
    reason: !videoId ? 'no video ID' : 
            !window.homeAssistant ? 'no instance' : 
            window.homeAssistant.videoId !== videoId ? 'different video' : 
            'same video'
  });

  if (needsReload) {
    uninitializeHomeAssistant();
    console.info('[HASS] Creating new instance for video:', videoId);
    window.homeAssistant = new HomeAssistantHandler(videoId);
    window.homeAssistant.init();
  }
}, false);

// Initial check on load
console.info('[HASS] Module loaded, performing initial check...');
const initialURL = new URL(location.hash.substring(1), location.href);
if (initialURL.pathname === '/watch') {
  const videoId = initialURL.searchParams.get('v');
  if (videoId) {
    console.info('[HASS] Initial load on watch page with video:', videoId);
    window.homeAssistant = new HomeAssistantHandler(videoId);
    window.homeAssistant.init();
  }
}