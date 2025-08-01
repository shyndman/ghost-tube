import { getMqttManager, type MediaState, type MqttManager } from './mqtt';
import { MediaController } from './media-controller';

export class AppHandler {
  private destroyed = false;

  // MQTT Manager
  private mqttManager: MqttManager;

  // Page state
  private _currentPage: string | null = null;
  private _isVideoPage = false;

  // MediaController management
  private _mediaController: MediaController | null = null;

  constructor() {
    console.info('[APP-HANDLER] Creating AppHandler...');
    this.mqttManager = getMqttManager();

    // Set up callback for when TV goes to standby
    this.mqttManager.setOnIdleStateCallback(() => {
      console.info('[APP-HANDLER] TV standby - publishing idle state');
      this.publishIdleState();
    });

    // Set up media command callback
    this.mqttManager.setMediaCommandCallback((command, payload) => {
      this.handleMediaCommand(command, payload);
    });

    this.init();
  }

  private init() {
    console.info('[APP-HANDLER] Initializing AppHandler...');

    // Initialize navigation monitoring
    this.initNavigationMonitoring();
  }

  private initNavigationMonitoring() {
    console.info('[APP-HANDLER] Initializing navigation monitoring...');

    // Check initial page state
    this.checkPageState();

    // Monitor hash changes
    window.addEventListener(
      'hashchange',
      () => {
        console.info('[APP-HANDLER] Hash change detected');
        this.checkPageState();
      },
      false
    );
  }

  private checkPageState() {
    const newURL = new URL(location.hash.substring(1), location.href);
    const pathname = newURL.pathname;
    const videoId = newURL.searchParams.get('v');

    console.info('[APP-HANDLER] Page state check:', {
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
      console.info('[APP-HANDLER] Navigated to video page');
      this._isVideoPage = true;
      this.createMediaController(videoId);
    } else if (!isVideoPage && this._isVideoPage) {
      // Left video page
      console.info('[APP-HANDLER] Left video page');
      this._isVideoPage = false;
      this.destroyMediaController();
      this.publishIdleState();
      console.info(`[APP-HANDLER] Current page: ${pathname} (playing nothing)`);
    } else if (isVideoPage && this._mediaController?.videoId !== videoId) {
      // Changed to different video
      console.info('[APP-HANDLER] Changed to different video');
      this.destroyMediaController();
      this.createMediaController(videoId!);
    }

    this.logAppState();
  }

  private createMediaController(videoId: string) {
    console.info(
      `[APP-HANDLER] Creating MediaController for video: ${videoId}`
    );
    this._mediaController = new MediaController(
      videoId,
      this,
      this.mqttManager
    );
    this._mediaController.init();
  }

  private destroyMediaController() {
    if (!this._mediaController) {
      console.info('[APP-HANDLER] No MediaController to destroy');
      return;
    }

    console.info('[APP-HANDLER] Destroying MediaController...');
    try {
      this._mediaController.destroy();
    } catch (error) {
      console.error('[APP-HANDLER] Error destroying MediaController:', error);
    }
    this._mediaController = null;
  }

  private handleMediaCommand(command: string, payload: string) {
    console.info(
      `[APP-HANDLER] Received media command: ${command} with payload: ${payload}`
    );

    if (!this._mediaController) {
      console.warn(
        '[APP-HANDLER] No MediaController available for command:',
        command
      );
      return;
    }

    switch (command) {
      case 'play':
        if (payload.trim() === 'play') {
          this._mediaController.handlePlayCommand();
        }
        break;
      case 'pause':
        if (payload.trim() === 'pause') {
          this._mediaController.handlePauseCommand();
        }
        break;
      case 'stop':
        if (payload.trim() === 'stop') {
          this._mediaController.handleStopCommand();
        }
        break;
      case 'seek':
        const position = parseInt(payload, 10);
        if (!isNaN(position)) {
          this._mediaController.handleSeekCommand(position);
        }
        break;
      case 'playmedia':
        let videoId: string;
        try {
          // Try to parse as JSON first
          const parsedCommand = JSON.parse(payload);
          videoId = parsedCommand.media_content_id;
        } catch {
          // If not JSON, treat as plain video ID
          videoId = payload.trim();
        }
        if (videoId) {
          this._mediaController.handlePlayMediaCommand(videoId);
        }
        break;
      default:
        console.warn(`[APP-HANDLER] Unknown media command: ${command}`);
    }
  }

  // Called by MediaController to report video state
  onVideoStateUpdate(videoState: any) {
    console.info(
      '[APP-HANDLER] Received video state update from MediaController'
    );
    this.logAppState();
    this.publishMqttState(videoState);
  }

  private publishMqttState(videoState: any) {
    try {
      if (!this.mqttManager.isConnected()) {
        console.debug(
          '[APP-HANDLER] MQTT not connected, skipping state publish'
        );
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
        mediatype: 'video',
        videoId: videoState.videoId
      };

      this.mqttManager.publishMediaState(mediaState);
      console.info('[APP-HANDLER] Published MQTT state:', mediaState);
    } catch (error) {
      console.error('[APP-HANDLER] Error publishing MQTT state:', error);
    }
  }

  private publishIdleState() {
    try {
      if (!this.mqttManager.isConnected()) {
        console.debug(
          '[APP-HANDLER] MQTT not connected, skipping idle state publish'
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
        mediatype: 'video',
        videoId: null
      };

      this.mqttManager.publishMediaState(idleState);
      console.info('[APP-HANDLER] Published MQTT idle state');
    } catch (error) {
      console.error('[APP-HANDLER] Error publishing MQTT idle state:', error);
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

    if (this._mediaController) {
      state.video = this._mediaController.getState();
    }

    console.info('[APP-HANDLER] Current app state:', state);
  }

  destroy() {
    console.info('[APP-HANDLER] Destroying AppHandler...');
    this.destroyed = true;

    // Destroy media controller if exists
    this.destroyMediaController();

    console.info('[APP-HANDLER] Cleanup complete');
  }
}
