import { getPlayer, PlayerState, type YTPlayer } from './player-api';
import type { AppHandler } from './app-handler';
import type { MqttManager } from './mqtt';

export class MediaController {
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
    console.info(
      '[MEDIA-CONTROLLER] Creating MediaController for video:',
      videoId
    );
  }

  async init() {
    console.info('[MEDIA-CONTROLLER] Initializing MediaController...');

    // Get player element
    try {
      console.info('[MEDIA-CONTROLLER] Waiting for player element...');
      this.player = await getPlayer();
      console.info('[MEDIA-CONTROLLER] Player element found:', this.player);

      // Attach player state change listener
      this.player.addEventListener(
        'onStateChange',
        this.boundHandlers.onPlayerStateChange
      );
      console.info(
        '[MEDIA-CONTROLLER] Attached onStateChange listener to player'
      );
    } catch (error) {
      console.error('[MEDIA-CONTROLLER] Failed to get player:', error);
    }

    // Get video element
    this.attachToVideo();

    // Extract video metadata
    this.extractVideoMetadata();
  }

  private attachToVideo() {
    console.info('[MEDIA-CONTROLLER] Looking for video element...');
    const video = document.querySelector('video');

    if (!video) {
      console.info(
        '[MEDIA-CONTROLLER] No video element found, retrying in 500ms...'
      );
      if (!this.destroyed) {
        setTimeout(() => this.attachToVideo(), 500);
      }
      return;
    }

    console.info('[MEDIA-CONTROLLER] Video element found:', video);
    console.info('[MEDIA-CONTROLLER] Video properties:', {
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

    console.info('[MEDIA-CONTROLLER] Attached all video event listeners');
  }

  // Media control command handlers
  handlePlayCommand(): void {
    try {
      console.info('[MEDIA-CONTROLLER] Play command received');

      if (this.video) {
        this.video
          .play()
          .then(() => {
            console.info('[MEDIA-CONTROLLER] Video playback started');
          })
          .catch((error) => {
            console.error(
              '[MEDIA-CONTROLLER] Error starting video playback:',
              error
            );
          });
      } else {
        console.warn(
          '[MEDIA-CONTROLLER] No video element found for play command'
        );
      }
    } catch (error) {
      console.error('[MEDIA-CONTROLLER] Error handling play command:', error);
    }
  }

  handlePauseCommand(): void {
    try {
      console.info('[MEDIA-CONTROLLER] Pause command received');

      if (this.video) {
        this.video.pause();
        console.info('[MEDIA-CONTROLLER] Video playback paused');
      } else {
        console.warn(
          '[MEDIA-CONTROLLER] No video element found for pause command'
        );
      }
    } catch (error) {
      console.error('[MEDIA-CONTROLLER] Error handling pause command:', error);
    }
  }

  handleStopCommand(): void {
    try {
      console.info('[MEDIA-CONTROLLER] Stop command received');

      // Navigate to YouTube home page to stop current video
      window.location.hash = '#/';
      console.info('[MEDIA-CONTROLLER] Navigated to YouTube home page');
    } catch (error) {
      console.error('[MEDIA-CONTROLLER] Error handling stop command:', error);
    }
  }

  handleSeekCommand(position: number): void {
    try {
      console.info(
        `[MEDIA-CONTROLLER] Seeking to position: ${position} seconds`
      );

      if (this.video) {
        this.video.currentTime = position;
        console.info(`[MEDIA-CONTROLLER] Seeked to ${position} seconds`);
      } else {
        console.warn(
          '[MEDIA-CONTROLLER] No video element found for seek command'
        );
      }
    } catch (error) {
      console.error('[MEDIA-CONTROLLER] Error handling seek command:', error);
    }
  }

  handlePlayMediaCommand(videoId: string): void {
    try {
      console.info(`[MEDIA-CONTROLLER] Playing video: ${videoId}`);

      // Navigate to the video
      const newUrl = `#/watch?v=${videoId}`;
      window.location.hash = newUrl;
      console.info(`[MEDIA-CONTROLLER] Navigated to ${newUrl}`);
    } catch (error) {
      console.error(
        '[MEDIA-CONTROLLER] Error handling playmedia command:',
        error
      );
    }
  }

  // Player API event handler
  private onPlayerStateChange(state: PlayerState) {
    const stateName = PlayerState[state] || 'UNKNOWN';
    console.info(
      `[MEDIA-CONTROLLER] Player state changed: ${stateName} (${state})`,
      {
        previousState:
          this.lastReportedState !== null
            ? PlayerState[this.lastReportedState]
            : 'none',
        timestamp: Date.now(),
        videoId: this._videoId
      }
    );
    this.lastReportedState = state;
    this._appHandler.onVideoStateUpdate(this.getState());
  }

  // Video element event handlers
  private onVideoPlay() {
    console.info('[MEDIA-CONTROLLER] Video PLAY event', {
      currentTime: this.video?.currentTime,
      duration: this.video?.duration,
      timestamp: Date.now()
    });
    this._appHandler.onVideoStateUpdate(this.getState());
  }

  private onVideoPause() {
    console.info('[MEDIA-CONTROLLER] Video PAUSE event', {
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
      console.info('[MEDIA-CONTROLLER] Video time update', {
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
    console.info('[MEDIA-CONTROLLER] Video ENDED event', {
      finalTime: this.video?.currentTime,
      duration: this.video?.duration,
      timestamp: Date.now()
    });
    this._appHandler.onVideoStateUpdate(this.getState());
  }

  private onVideoDurationChange() {
    console.info('[MEDIA-CONTROLLER] Video DURATION CHANGE event', {
      newDuration: this.video?.duration,
      currentTime: this.video?.currentTime,
      timestamp: Date.now()
    });
  }

  private onVideoLoadedMetadata() {
    console.info('[MEDIA-CONTROLLER] Video LOADED METADATA event', {
      duration: this.video?.duration,
      videoWidth: this.video?.videoWidth,
      videoHeight: this.video?.videoHeight,
      timestamp: Date.now()
    });

    // Capture video duration
    if (this.video?.duration) {
      this._videoDuration = this.video.duration;
      console.info(
        '[MEDIA-CONTROLLER] Video duration captured:',
        this._videoDuration,
        'seconds'
      );
      this._appHandler.onVideoStateUpdate(this.getState());
    }
  }

  private onVideoSeeking() {
    console.info('[MEDIA-CONTROLLER] Video SEEKING event', {
      currentTime: this.video?.currentTime,
      timestamp: Date.now()
    });
  }

  private onVideoSeeked() {
    console.info('[MEDIA-CONTROLLER] Video SEEKED event', {
      newTime: this.video?.currentTime,
      timestamp: Date.now()
    });
  }

  // Video metadata extraction methods
  private extractVideoMetadata() {
    console.info('[MEDIA-CONTROLLER] Extracting video metadata...');
    this.extractVideoTitle();
    this.extractVideoThumbnail();
    this.extractCreatorName();
    this.extractPublishDate();
  }

  private extractVideoTitle() {
    console.info('[MEDIA-CONTROLLER] Looking for video title...');

    // Try to find title element on YouTube TV watch page
    const titleElement = document.querySelector(
      'yt-formatted-string.ytFormattedStringHost.ytLrVideoTitleTrayTitleText'
    );

    if (!titleElement) {
      console.info(
        '[MEDIA-CONTROLLER] No title element found, retrying in 500ms...'
      );
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
      console.info('[MEDIA-CONTROLLER] Video title extracted:', title);
      this._appHandler.onVideoStateUpdate(this.getState());
    } else {
      console.info(
        '[MEDIA-CONTROLLER] Title element found but no text content, retrying in 500ms...'
      );
      if (!this.destroyed) {
        setTimeout(() => this.extractVideoTitle(), 500);
      }
    }
  }

  private extractVideoThumbnail() {
    console.info('[MEDIA-CONTROLLER] Extracting video thumbnail...');

    // Construct thumbnail URL from video ID (most reliable method)
    if (this._videoId) {
      this._videoThumbnail = `https://i.ytimg.com/vi/${this._videoId}/hqdefault.jpg`;
      console.info(
        '[MEDIA-CONTROLLER] Video thumbnail URL:',
        this._videoThumbnail
      );
    } else {
      console.info(
        '[MEDIA-CONTROLLER] No video ID available for thumbnail construction'
      );
    }
  }

  private extractCreatorName() {
    console.info('[MEDIA-CONTROLLER] Looking for creator name...');

    // Try to find creator name in the metadata line
    const metadataLine = document.querySelector('ytlr-video-metadata-line');
    if (!metadataLine) {
      console.info(
        '[MEDIA-CONTROLLER] No metadata line found, retrying in 500ms...'
      );
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
        '[MEDIA-CONTROLLER] No creator element found, retrying in 500ms...'
      );
      if (!this.destroyed) {
        setTimeout(() => this.extractCreatorName(), 500);
      }
      return;
    }

    const creatorName = creatorElement.textContent?.trim() || null;

    if (creatorName) {
      this._creatorName = creatorName;
      console.info('[MEDIA-CONTROLLER] Creator name extracted:', creatorName);
      this._appHandler.onVideoStateUpdate(this.getState());
    } else {
      console.info(
        '[MEDIA-CONTROLLER] Creator element found but no text content, retrying in 500ms...'
      );
      if (!this.destroyed) {
        setTimeout(() => this.extractCreatorName(), 500);
      }
    }
  }

  private extractPublishDate() {
    console.info('[MEDIA-CONTROLLER] Looking for publish date...');

    // Try to find publish date in the metadata line (last detail text element)
    const metadataLine = document.querySelector('ytlr-video-metadata-line');
    if (!metadataLine) {
      console.info(
        '[MEDIA-CONTROLLER] No metadata line found, retrying in 500ms...'
      );
      if (!this.destroyed) {
        setTimeout(() => this.extractPublishDate(), 500);
      }
      return;
    }

    const dateElement = metadataLine.querySelector(
      'yt-formatted-string[aria-label]'
    );

    if (!dateElement) {
      console.info(
        '[MEDIA-CONTROLLER] No date element found, retrying in 500ms...'
      );
      if (!this.destroyed) {
        setTimeout(() => this.extractPublishDate(), 500);
      }
      return;
    }

    const publishDate = dateElement.textContent?.trim() || null;
    const ariaLabel = dateElement.getAttribute('aria-label');

    if (publishDate) {
      this._publishDate = publishDate;
      console.info('[MEDIA-CONTROLLER] Publish date extracted:', publishDate);
      if (ariaLabel) {
        console.info(
          '[MEDIA-CONTROLLER] Full publish date (aria-label):',
          ariaLabel
        );
      }
      this._appHandler.onVideoStateUpdate(this.getState());
    } else {
      console.info(
        '[MEDIA-CONTROLLER] Date element found but no text content, retrying in 500ms...'
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
    console.info('[MEDIA-CONTROLLER] Destroying MediaController...');
    this.destroyed = true;

    // Remove player listeners
    if (this.player) {
      this.player.removeEventListener(
        'onStateChange',
        this.boundHandlers.onPlayerStateChange
      );
      console.info('[MEDIA-CONTROLLER] Player listeners removed');
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
      console.info('[MEDIA-CONTROLLER] Removed all video event listeners');
    }

    // Reset metadata
    this._videoTitle = null;
    this._videoThumbnail = null;
    this._videoDuration = null;
    this._creatorName = null;
    this._publishDate = null;

    this.video = null;
    this.player = null;
    console.info('[MEDIA-CONTROLLER] Cleanup complete');
  }
}
