import { getPlayer, PlayerState, type YTPlayer } from './player-api';

class HomeAssistantHandler {
  private _videoId: string | null = null;
  private video: HTMLVideoElement | null = null;
  private player: YTPlayer | null = null;
  private destroyed = false;
  private lastReportedState: PlayerState | null = null;
  private lastReportedTime: number = 0;

  // Video metadata
  private _videoTitle: string | null = null;
  private _videoThumbnail: string | null = null;
  private _videoDuration: number | null = null;
  private _creatorName: string | null = null;
  private _publishDate: string | null = null;

  // Volume monitoring
  private _currentVolume: number | null = null;
  private _volumeMuted: boolean | null = null;
  private _soundOutput: string | null = null;
  private _volumeSubscription: any = null;

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
    this._videoId = videoId;
    console.info('[HASS] Creating HomeAssistantHandler for video:', videoId);
  }

  get videoId() {
    return this._videoId;
  }

  async init() {
    console.info('[HASS] Initializing HomeAssistantHandler...');

    // Get player element
    try {
      console.info('[HASS] Waiting for player element...');
      this.player = await getPlayer();
      console.info('[HASS] Player element found:', this.player);

      // Attach player state change listener
      this.player.addEventListener(
        'onStateChange',
        this.boundHandlers.onPlayerStateChange
      );
      console.info('[HASS] Attached onStateChange listener to player');
    } catch (error) {
      console.error('[HASS] Failed to get player:', error);
    }

    // Get video element
    this.attachToVideo();

    // Extract video metadata
    this.extractVideoMetadata();

    // Initialize volume monitoring
    this.initVolumeMonitoring();
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
    video.addEventListener(
      'durationchange',
      this.boundHandlers.onVideoDurationChange
    );
    video.addEventListener(
      'loadedmetadata',
      this.boundHandlers.onVideoLoadedMetadata
    );
    video.addEventListener('seeking', this.boundHandlers.onVideoSeeking);
    video.addEventListener('seeked', this.boundHandlers.onVideoSeeked);

    console.info('[HASS] Attached all video event listeners');
  }

  // Player API event handler
  private onPlayerStateChange(state: PlayerState) {
    const stateName = PlayerState[state] || 'UNKNOWN';
    console.info(`[HASS] Player state changed: ${stateName} (${state})`, {
      previousState:
        this.lastReportedState !== null
          ? PlayerState[this.lastReportedState]
          : 'none',
      timestamp: Date.now(),
      videoId: this._videoId
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
        progress: this.video?.duration
          ? ((currentTime / this.video.duration) * 100).toFixed(1) + '%'
          : 'N/A'
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

    // Capture video duration
    if (this.video?.duration) {
      this._videoDuration = this.video.duration;
      console.info(
        '[HASS] Video duration captured:',
        this._videoDuration,
        'seconds'
      );
      this.logMetadataSummary();
    }
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

  // Video metadata extraction methods
  private extractVideoMetadata() {
    console.info('[HASS] Extracting video metadata...');
    this.extractVideoTitle();
    this.extractVideoThumbnail();
    this.extractCreatorName();
    this.extractPublishDate();
  }

  private extractVideoTitle() {
    console.info('[HASS] Looking for video title...');

    // Try to find title element on YouTube TV watch page
    const titleElement = document.querySelector(
      'yt-formatted-string.ytFormattedStringHost.ytLrVideoTitleTrayTitleText'
    );

    if (!titleElement) {
      console.info('[HASS] No title element found, retrying in 500ms...');
      if (!this.destroyed) {
        setTimeout(() => this.extractVideoTitle(), 500);
      }
      return;
    }

    const title =
      titleElement.textContent?.trim() ||
      titleElement.getAttribute('data-title') ||
      null;

    if (title) {
      this._videoTitle = title;
      console.info('[HASS] Video title extracted:', title);
      this.logMetadataSummary();
    } else {
      console.info(
        '[HASS] Title element found but no text content, retrying in 500ms...'
      );
      if (!this.destroyed) {
        setTimeout(() => this.extractVideoTitle(), 500);
      }
    }
  }

  private extractVideoThumbnail() {
    console.info('[HASS] Extracting video thumbnail...');

    // Construct thumbnail URL from video ID (most reliable method)
    if (this._videoId) {
      this._videoThumbnail = `https://i.ytimg.com/vi/${this._videoId}/hqdefault.jpg`;
      console.info('[HASS] Video thumbnail URL:', this._videoThumbnail);
    } else {
      console.info('[HASS] No video ID available for thumbnail construction');
    }
  }

  private extractCreatorName() {
    console.info('[HASS] Looking for creator name...');

    // Try to find creator name in the metadata line
    const metadataLine = document.querySelector('ytlr-video-metadata-line');
    if (!metadataLine) {
      console.info('[HASS] No metadata line found, retrying in 500ms...');
      if (!this.destroyed) {
        setTimeout(() => this.extractCreatorName(), 500);
      }
      return;
    }

    const creatorElement = metadataLine.querySelector(
      'yt-formatted-string.ytLrVideoMetadataLineDetailTexts:first-child'
    );

    if (!creatorElement) {
      console.info('[HASS] No creator element found, retrying in 500ms...');
      if (!this.destroyed) {
        setTimeout(() => this.extractCreatorName(), 500);
      }
      return;
    }

    const creatorName = creatorElement.textContent?.trim() || null;

    if (creatorName) {
      this._creatorName = creatorName;
      console.info('[HASS] Creator name extracted:', creatorName);
      this.logMetadataSummary();
    } else {
      console.info(
        '[HASS] Creator element found but no text content, retrying in 500ms...'
      );
      if (!this.destroyed) {
        setTimeout(() => this.extractCreatorName(), 500);
      }
    }
  }

  private extractPublishDate() {
    console.info('[HASS] Looking for publish date...');

    // Try to find publish date in the metadata line (last detail text element)
    const metadataLine = document.querySelector('ytlr-video-metadata-line');
    if (!metadataLine) {
      console.info('[HASS] No metadata line found, retrying in 500ms...');
      if (!this.destroyed) {
        setTimeout(() => this.extractPublishDate(), 500);
      }
      return;
    }

    const dateElement = metadataLine.querySelector(
      'yt-formatted-string[aria-label]'
    );

    if (!dateElement) {
      console.info('[HASS] No date element found, retrying in 500ms...');
      if (!this.destroyed) {
        setTimeout(() => this.extractPublishDate(), 500);
      }
      return;
    }

    const publishDate = dateElement.textContent?.trim() || null;
    const ariaLabel = dateElement.getAttribute('aria-label');

    if (publishDate) {
      this._publishDate = publishDate;
      console.info('[HASS] Publish date extracted:', publishDate);
      if (ariaLabel) {
        console.info('[HASS] Full publish date (aria-label):', ariaLabel);
      }
      this.logMetadataSummary();
    } else {
      console.info(
        '[HASS] Date element found but no text content, retrying in 500ms...'
      );
      if (!this.destroyed) {
        setTimeout(() => this.extractPublishDate(), 500);
      }
    }
  }

  private initVolumeMonitoring() {
    console.info('[HASS] Initializing volume monitoring...');

    // Check if webOS service is available
    if (typeof webOS === 'undefined' || !webOS.service) {
      console.info(
        '[HASS] webOS service not available, skipping volume monitoring'
      );
      return;
    }

    try {
      // Subscribe to volume changes
      this._volumeSubscription = webOS.service.request(
        'luna://com.webos.service.audio',
        {
          method: 'master/getVolume',
          parameters: { subscribe: true },
          onSuccess: this.onVolumeChange.bind(this),
          onFailure: (error: any) => {
            console.error(
              '[HASS] Volume monitoring subscription failed:',
              error
            );
            // Retry subscription after 5 seconds
            if (!this.destroyed) {
              setTimeout(() => this.initVolumeMonitoring(), 5000);
            }
          }
        }
      );
      console.info('[HASS] Volume monitoring subscription initiated');
    } catch (error) {
      console.error('[HASS] Failed to initiate volume monitoring:', error);
    }
  }

  private onVolumeChange(response: any) {
    console.info('[HASS] Volume change event:', {
      volume: response.volume,
      muted: response.muted,
      soundOutput: response.soundOutput,
      scenario: response.scenario,
      subscribed: response.subscribed,
      timestamp: Date.now()
    });

    // Update volume state
    const volumeChanged = this._currentVolume !== response.volume;
    const muteChanged = this._volumeMuted !== response.muted;
    const outputChanged = this._soundOutput !== response.soundOutput;

    this._currentVolume = response.volume || null;
    this._volumeMuted = response.muted || null;
    this._soundOutput = response.soundOutput || null;

    // Log specific changes
    if (volumeChanged) {
      console.info(`[HASS] Volume level changed: ${this._currentVolume}`);
    }
    if (muteChanged) {
      console.info(
        `[HASS] Mute status changed: ${this._volumeMuted ? 'MUTED' : 'UNMUTED'}`
      );
    }
    if (outputChanged) {
      console.info(`[HASS] Sound output changed: ${this._soundOutput}`);
    }

    this.logMetadataSummary();
  }

  private logMetadataSummary() {
    // Log complete metadata when we have all pieces
    if (
      this._videoTitle &&
      this._videoThumbnail &&
      this._videoDuration &&
      this._creatorName &&
      this._publishDate
    ) {
      console.info('[HASS] Complete video metadata collected:', {
        videoId: this._videoId,
        title: this._videoTitle,
        thumbnail: this._videoThumbnail,
        duration: this._videoDuration,
        creatorName: this._creatorName,
        publishDate: this._publishDate,
        currentVolume: this._currentVolume,
        volumeMuted: this._volumeMuted,
        soundOutput: this._soundOutput,
        timestamp: Date.now()
      });
    }
  }

  destroy() {
    console.info('[HASS] Destroying HomeAssistantHandler...');
    this.destroyed = true;

    // Cancel volume monitoring subscription
    if (this._volumeSubscription) {
      try {
        if (typeof this._volumeSubscription.cancel === 'function') {
          this._volumeSubscription.cancel();
          console.info('[HASS] Volume monitoring subscription cancelled');
        }
      } catch (error) {
        console.error('[HASS] Failed to cancel volume subscription:', error);
      }
    }

    // Remove player listeners
    if (this.player) {
      this.player.removeEventListener(
        'onStateChange',
        this.boundHandlers.onPlayerStateChange
      );
      console.info('[HASS] Player listeners removed');
    }

    // Remove video listeners
    if (this.video) {
      this.video.removeEventListener('play', this.boundHandlers.onVideoPlay);
      this.video.removeEventListener('pause', this.boundHandlers.onVideoPause);
      this.video.removeEventListener(
        'timeupdate',
        this.boundHandlers.onVideoTimeUpdate
      );
      this.video.removeEventListener('ended', this.boundHandlers.onVideoEnded);
      this.video.removeEventListener(
        'durationchange',
        this.boundHandlers.onVideoDurationChange
      );
      this.video.removeEventListener(
        'loadedmetadata',
        this.boundHandlers.onVideoLoadedMetadata
      );
      this.video.removeEventListener(
        'seeking',
        this.boundHandlers.onVideoSeeking
      );
      this.video.removeEventListener(
        'seeked',
        this.boundHandlers.onVideoSeeked
      );
      console.info('[HASS] Removed all video event listeners');
    }

    // Reset metadata
    this._videoTitle = null;
    this._videoThumbnail = null;
    this._videoDuration = null;
    this._creatorName = null;
    this._publishDate = null;
    this._currentVolume = null;
    this._volumeMuted = null;
    this._soundOutput = null;
    this._volumeSubscription = null;

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
window.addEventListener(
  'hashchange',
  () => {
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
    const needsReload =
      videoId &&
      (!window.homeAssistant || window.homeAssistant.videoId !== videoId);

    console.info('[HASS] Reload check', {
      needsReload,
      reason: !videoId
        ? 'no video ID'
        : !window.homeAssistant
          ? 'no instance'
          : window.homeAssistant.videoId !== videoId
            ? 'different video'
            : 'same video'
    });

    if (needsReload) {
      uninitializeHomeAssistant();
      console.info('[HASS] Creating new instance for video:', videoId);
      window.homeAssistant = new HomeAssistantHandler(videoId);
      window.homeAssistant.init();
    }
  },
  false
);

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
