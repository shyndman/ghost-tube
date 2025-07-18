import { getPlayer, PlayerState, type YTPlayer } from './player-api';
import { getMqttManager, type MediaState, type MqttManager } from './mqtt';

class AppHandler {
  private destroyed = false;

  // MQTT Manager
  private mqttManager: MqttManager;

  // Page state
  private _currentPage: string | null = null;
  private _isVideoPage = false;

  // VideoHandler management
  private _videoHandler: VideoHandler | null = null;

  constructor() {
    console.info('[HASS-APP] Creating AppHandler...');
    this.mqttManager = getMqttManager();

    // Set up callback for when TV goes to standby
    this.mqttManager.setOnIdleStateCallback(() => {
      console.info('[HASS-APP] TV standby - publishing idle state');
      this.publishIdleState();
    });

    this.init();
  }

  private init() {
    console.info('[HASS-APP] Initializing AppHandler...');

    // Initialize navigation monitoring
    this.initNavigationMonitoring();
  }

  private initNavigationMonitoring() {
    console.info('[HASS-APP] Initializing navigation monitoring...');

    // Check initial page state
    this.checkPageState();

    // Monitor hash changes
    window.addEventListener(
      'hashchange',
      () => {
        console.info('[HASS-APP] Hash change detected');
        this.checkPageState();
      },
      false
    );
  }

  private checkPageState() {
    const newURL = new URL(location.hash.substring(1), location.href);
    const pathname = newURL.pathname;
    const videoId = newURL.searchParams.get('v');

    console.info('[HASS-APP] Page state check:', {
      pathname,
      videoId,
      fullHash: location.hash,
      previousPage: this._currentPage
    });

    // Update current page
    this._currentPage = pathname;

    // Check if we're on a video page
    const isVideoPage = pathname === '/watch' && !!videoId;

    if (isVideoPage && !this._isVideoPage) {
      // Transitioned to video page
      console.info('[HASS-APP] Navigated to video page');
      this._isVideoPage = true;
      this.createVideoHandler(videoId);
    } else if (!isVideoPage && this._isVideoPage) {
      // Left video page
      console.info('[HASS-APP] Left video page');
      this._isVideoPage = false;
      this.destroyVideoHandler();
      this.publishIdleState();
      console.info(`[HASS-APP] Current page: ${pathname} (playing nothing)`);
    } else if (isVideoPage && this._videoHandler?.videoId !== videoId) {
      // Changed to different video
      console.info('[HASS-APP] Changed to different video');
      this.destroyVideoHandler();
      this.createVideoHandler(videoId!);
    }

    this.logAppState();
  }

  private createVideoHandler(videoId: string) {
    console.info(`[HASS-APP] Creating VideoHandler for video: ${videoId}`);
    this._videoHandler = new VideoHandler(videoId, this, this.mqttManager);
    this._videoHandler.init();
  }

  private destroyVideoHandler() {
    if (!this._videoHandler) {
      console.info('[HASS-APP] No VideoHandler to destroy');
      return;
    }

    console.info('[HASS-APP] Destroying VideoHandler...');
    try {
      this._videoHandler.destroy();
    } catch (error) {
      console.error('[HASS-APP] Error destroying VideoHandler:', error);
    }
    this._videoHandler = null;
  }

  // Called by VideoHandler to report video state
  onVideoStateUpdate(videoState: any) {
    console.info('[HASS-APP] Received video state update from VideoHandler');
    this.logAppState();
    this.publishMqttState(videoState);
  }

  private publishMqttState(videoState: any) {
    try {
      if (!this.mqttManager.isConnected()) {
        console.debug('[HASS-APP] MQTT not connected, skipping state publish');
        return;
      }

      // Convert video state to MQTT media state format
      const mediaState: MediaState = {
        state: this.convertPlayerStateToMqtt(videoState.playerState),
        position: videoState.currentTime,
        title: videoState.title,
        artist: videoState.creator,
        albumart: videoState.thumbnail,
        duration: videoState.duration,
        mediatype: 'video'
      };

      this.mqttManager.publishMediaState(mediaState);
      console.info('[HASS-APP] Published MQTT state:', mediaState);
    } catch (error) {
      console.error('[HASS-APP] Error publishing MQTT state:', error);
    }
  }

  private publishIdleState() {
    try {
      if (!this.mqttManager.isConnected()) {
        console.debug(
          '[HASS-APP] MQTT not connected, skipping idle state publish'
        );
        return;
      }

      const idleState: MediaState = {
        state: 'idle',
        position: null,
        title: null,
        artist: null,
        albumart: null,
        duration: null,
        mediatype: 'video'
      };

      this.mqttManager.publishMediaState(idleState);
      console.info('[HASS-APP] Published MQTT idle state');
    } catch (error) {
      console.error('[HASS-APP] Error publishing MQTT idle state:', error);
    }
  }

  private convertPlayerStateToMqtt(
    playerState: string | null
  ): 'playing' | 'paused' | 'stopped' | 'idle' {
    switch (playerState) {
      case 'PLAYING':
        return 'playing';
      case 'PAUSED':
        return 'paused';
      case 'ENDED':
        return 'stopped';
      case 'BUFFERING':
        // Treat buffering as playing since it will resume
        return 'playing';
      case 'CUED':
      case 'UNSTARTED':
      default:
        return 'idle';
    }
  }

  private logAppState() {
    const state: any = {
      app: {
        currentPage: this._currentPage,
        isVideoPage: this._isVideoPage
      }
    };

    if (this._videoHandler) {
      state.video = this._videoHandler.getState();
    }

    console.info('[HASS-APP] Current app state:', state);
  }

  destroy() {
    console.info('[HASS-APP] Destroying AppHandler...');
    this.destroyed = true;

    // Destroy video handler if exists
    this.destroyVideoHandler();

    console.info('[HASS-APP] Cleanup complete');
  }
}

class VideoHandler {
  private _videoId: string;
  private _appHandler: AppHandler;
  private mqttManager: MqttManager;
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

  get videoId() {
    return this._videoId;
  }

  constructor(
    videoId: string,
    appHandler: AppHandler,
    mqttManager: MqttManager
  ) {
    this._videoId = videoId;
    this._appHandler = appHandler;
    this.mqttManager = mqttManager;
    console.info('[HASS-VIDEO] Creating VideoHandler for video:', videoId);
  }

  async init() {
    console.info('[HASS-VIDEO] Initializing VideoHandler...');

    // Get player element
    try {
      console.info('[HASS-VIDEO] Waiting for player element...');
      this.player = await getPlayer();
      console.info('[HASS-VIDEO] Player element found:', this.player);

      // Attach player state change listener
      this.player.addEventListener(
        'onStateChange',
        this.boundHandlers.onPlayerStateChange
      );
      console.info('[HASS-VIDEO] Attached onStateChange listener to player');
    } catch (error) {
      console.error('[HASS-VIDEO] Failed to get player:', error);
    }

    // Get video element
    this.attachToVideo();

    // Extract video metadata
    this.extractVideoMetadata();
  }

  private attachToVideo() {
    console.info('[HASS-VIDEO] Looking for video element...');
    const video = document.querySelector('video');

    if (!video) {
      console.info('[HASS-VIDEO] No video element found, retrying in 500ms...');
      if (!this.destroyed) {
        setTimeout(() => this.attachToVideo(), 500);
      }
      return;
    }

    console.info('[HASS-VIDEO] Video element found:', video);
    console.info('[HASS-VIDEO] Video properties:', {
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

    console.info('[HASS-VIDEO] Attached all video event listeners');
  }

  // Player API event handler
  private onPlayerStateChange(state: PlayerState) {
    const stateName = PlayerState[state] || 'UNKNOWN';
    console.info(`[HASS-VIDEO] Player state changed: ${stateName} (${state})`, {
      previousState:
        this.lastReportedState !== null
          ? PlayerState[this.lastReportedState]
          : 'none',
      timestamp: Date.now(),
      videoId: this._videoId
    });
    this.lastReportedState = state;
    this._appHandler.onVideoStateUpdate(this.getState());
  }

  // Video element event handlers
  private onVideoPlay() {
    console.info('[HASS-VIDEO] Video PLAY event', {
      currentTime: this.video?.currentTime,
      duration: this.video?.duration,
      timestamp: Date.now()
    });
    this._appHandler.onVideoStateUpdate(this.getState());
  }

  private onVideoPause() {
    console.info('[HASS-VIDEO] Video PAUSE event', {
      currentTime: this.video?.currentTime,
      duration: this.video?.duration,
      timestamp: Date.now()
    });
    this._appHandler.onVideoStateUpdate(this.getState());
  }

  private onVideoTimeUpdate() {
    const currentTime = this.video?.currentTime || 0;
    // Only log significant time changes (every 5 seconds) to avoid spam
    if (Math.abs(currentTime - this.lastReportedTime) >= 5) {
      console.info('[HASS-VIDEO] Video time update', {
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
    console.info('[HASS-VIDEO] Video ENDED event', {
      finalTime: this.video?.currentTime,
      duration: this.video?.duration,
      timestamp: Date.now()
    });
    this._appHandler.onVideoStateUpdate(this.getState());
  }

  private onVideoDurationChange() {
    console.info('[HASS-VIDEO] Video DURATION CHANGE event', {
      newDuration: this.video?.duration,
      currentTime: this.video?.currentTime,
      timestamp: Date.now()
    });
  }

  private onVideoLoadedMetadata() {
    console.info('[HASS-VIDEO] Video LOADED METADATA event', {
      duration: this.video?.duration,
      videoWidth: this.video?.videoWidth,
      videoHeight: this.video?.videoHeight,
      timestamp: Date.now()
    });

    // Capture video duration
    if (this.video?.duration) {
      this._videoDuration = this.video.duration;
      console.info(
        '[HASS-VIDEO] Video duration captured:',
        this._videoDuration,
        'seconds'
      );
      this._appHandler.onVideoStateUpdate(this.getState());
    }
  }

  private onVideoSeeking() {
    console.info('[HASS-VIDEO] Video SEEKING event', {
      currentTime: this.video?.currentTime,
      timestamp: Date.now()
    });
  }

  private onVideoSeeked() {
    console.info('[HASS-VIDEO] Video SEEKED event', {
      newTime: this.video?.currentTime,
      timestamp: Date.now()
    });
  }

  // Video metadata extraction methods
  private extractVideoMetadata() {
    console.info('[HASS-VIDEO] Extracting video metadata...');
    this.extractVideoTitle();
    this.extractVideoThumbnail();
    this.extractCreatorName();
    this.extractPublishDate();
  }

  private extractVideoTitle() {
    console.info('[HASS-VIDEO] Looking for video title...');

    // Try to find title element on YouTube TV watch page
    const titleElement = document.querySelector(
      'yt-formatted-string.ytFormattedStringHost.ytLrVideoTitleTrayTitleText'
    );

    if (!titleElement) {
      console.info('[HASS-VIDEO] No title element found, retrying in 500ms...');
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
      console.info('[HASS-VIDEO] Video title extracted:', title);
      this._appHandler.onVideoStateUpdate(this.getState());
    } else {
      console.info(
        '[HASS-VIDEO] Title element found but no text content, retrying in 500ms...'
      );
      if (!this.destroyed) {
        setTimeout(() => this.extractVideoTitle(), 500);
      }
    }
  }

  private extractVideoThumbnail() {
    console.info('[HASS-VIDEO] Extracting video thumbnail...');

    // Construct thumbnail URL from video ID (most reliable method)
    if (this._videoId) {
      this._videoThumbnail = `https://i.ytimg.com/vi/${this._videoId}/hqdefault.jpg`;
      console.info('[HASS-VIDEO] Video thumbnail URL:', this._videoThumbnail);
    } else {
      console.info(
        '[HASS-VIDEO] No video ID available for thumbnail construction'
      );
    }
  }

  private extractCreatorName() {
    console.info('[HASS-VIDEO] Looking for creator name...');

    // Try to find creator name in the metadata line
    const metadataLine = document.querySelector('ytlr-video-metadata-line');
    if (!metadataLine) {
      console.info('[HASS-VIDEO] No metadata line found, retrying in 500ms...');
      if (!this.destroyed) {
        setTimeout(() => this.extractCreatorName(), 500);
      }
      return;
    }

    const creatorElement = metadataLine.querySelector(
      'yt-formatted-string.ytLrVideoMetadataLineDetailTexts:first-child'
    );

    if (!creatorElement) {
      console.info(
        '[HASS-VIDEO] No creator element found, retrying in 500ms...'
      );
      if (!this.destroyed) {
        setTimeout(() => this.extractCreatorName(), 500);
      }
      return;
    }

    const creatorName = creatorElement.textContent?.trim() || null;

    if (creatorName) {
      this._creatorName = creatorName;
      console.info('[HASS-VIDEO] Creator name extracted:', creatorName);
      this._appHandler.onVideoStateUpdate(this.getState());
    } else {
      console.info(
        '[HASS-VIDEO] Creator element found but no text content, retrying in 500ms...'
      );
      if (!this.destroyed) {
        setTimeout(() => this.extractCreatorName(), 500);
      }
    }
  }

  private extractPublishDate() {
    console.info('[HASS-VIDEO] Looking for publish date...');

    // Try to find publish date in the metadata line (last detail text element)
    const metadataLine = document.querySelector('ytlr-video-metadata-line');
    if (!metadataLine) {
      console.info('[HASS-VIDEO] No metadata line found, retrying in 500ms...');
      if (!this.destroyed) {
        setTimeout(() => this.extractPublishDate(), 500);
      }
      return;
    }

    const dateElement = metadataLine.querySelector(
      'yt-formatted-string[aria-label]'
    );

    if (!dateElement) {
      console.info('[HASS-VIDEO] No date element found, retrying in 500ms...');
      if (!this.destroyed) {
        setTimeout(() => this.extractPublishDate(), 500);
      }
      return;
    }

    const publishDate = dateElement.textContent?.trim() || null;
    const ariaLabel = dateElement.getAttribute('aria-label');

    if (publishDate) {
      this._publishDate = publishDate;
      console.info('[HASS-VIDEO] Publish date extracted:', publishDate);
      if (ariaLabel) {
        console.info('[HASS-VIDEO] Full publish date (aria-label):', ariaLabel);
      }
      this._appHandler.onVideoStateUpdate(this.getState());
    } else {
      console.info(
        '[HASS-VIDEO] Date element found but no text content, retrying in 500ms...'
      );
      if (!this.destroyed) {
        setTimeout(() => this.extractPublishDate(), 500);
      }
    }
  }

  getState() {
    return {
      videoId: this._videoId,
      title: this._videoTitle,
      creator: this._creatorName,
      publishDate: this._publishDate,
      thumbnail: this._videoThumbnail,
      duration: this._videoDuration,
      playerState:
        this.lastReportedState !== null
          ? PlayerState[this.lastReportedState]
          : null,
      currentTime: this.video?.currentTime || null,
      timestamp: Date.now()
    };
  }

  destroy() {
    console.info('[HASS-VIDEO] Destroying VideoHandler...');
    this.destroyed = true;

    // Remove player listeners
    if (this.player) {
      this.player.removeEventListener(
        'onStateChange',
        this.boundHandlers.onPlayerStateChange
      );
      console.info('[HASS-VIDEO] Player listeners removed');
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
      console.info('[HASS-VIDEO] Removed all video event listeners');
    }

    // Reset metadata
    this._videoTitle = null;
    this._videoThumbnail = null;
    this._videoDuration = null;
    this._creatorName = null;
    this._publishDate = null;

    this.video = null;
    this.player = null;
    console.info('[HASS-VIDEO] Cleanup complete');
  }
}

// Global instance management
declare global {
  interface Window {
    appHandler: AppHandler | null;
  }
}

// Create single AppHandler instance
window.appHandler = new AppHandler();

// Cleanup function for app shutdown
function destroyAppHandler() {
  console.info('[HASS-APP] Destroying global AppHandler...');
  if (window.appHandler) {
    try {
      window.appHandler.destroy();
    } catch (error) {
      console.error('[HASS-APP] Error destroying AppHandler:', error);
    }
    window.appHandler = null;
  }
}

// Optional: Add cleanup on page unload
window.addEventListener('beforeunload', destroyAppHandler);
