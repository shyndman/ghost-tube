import mqtt from 'mqtt';
import { showNotification } from './ui';

// MQTT Configuration Constants
const MQTT_CONFIG = {
  broker: '192.168.86.29',
  port: 8083,
  username: undefined, // TODO: Set if needed
  password: undefined, // TODO: Set if needed
  clientId: 'youtube-webos-' + Math.random().toString(16).substring(2, 10),
  topicPrefix: 'homeassistant/media_player/living_room_tv_youtube'
} as const;

// Connection state tracking
interface MqttConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  lastConnected: Date | null;
  lastError: string | null;
  brokerUrl: string | null;
}

interface MediaState {
  state: 'playing' | 'paused' | 'stopped' | 'idle';
  position: number | null;
  title: string | null;
  artist: string | null;
  albumart: string | null;
  duration: number | null;
  mediatype: 'video';
}

interface SeekCommand {
  position: number; // Position in seconds
}

interface PlayMediaCommand {
  media_content_id: string; // YouTube video ID
  media_content_type?: string;
}

type MediaCommandCallback = (command: string, payload: string) => void;

class MqttManager {
  private client: mqtt.MqttClient | null = null;
  private connectionState: MqttConnectionState = {
    status: 'disconnected',
    lastConnected: null,
    lastError: null,
    brokerUrl: null
  };
  private topics = {
    available: `${MQTT_CONFIG.topicPrefix}/available`,
    state: `${MQTT_CONFIG.topicPrefix}/state`,
    position: `${MQTT_CONFIG.topicPrefix}/position`,
    title: `${MQTT_CONFIG.topicPrefix}/title`,
    artist: `${MQTT_CONFIG.topicPrefix}/artist`,
    albumart: `${MQTT_CONFIG.topicPrefix}/albumart`,
    duration: `${MQTT_CONFIG.topicPrefix}/duration`,
    mediatype: `${MQTT_CONFIG.topicPrefix}/mediatype`,
    // Command topics
    seek: `${MQTT_CONFIG.topicPrefix}/seek`,
    playmedia: `${MQTT_CONFIG.topicPrefix}/playmedia`,
    play: `${MQTT_CONFIG.topicPrefix}/play`,
    pause: `${MQTT_CONFIG.topicPrefix}/pause`,
    stop: `${MQTT_CONFIG.topicPrefix}/stop`,
    // Config topic for Home Assistant discovery
    config: `homeassistant/media_player/living_room_tv_youtube/config`
  };
  private notificationShown = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectDelay = 5000; // Start with 5 second delay
  private maxReconnectDelay = 60000; // Max 1 minute delay
  private positionUpdateInterval: NodeJS.Timeout | null = null;

  // Visibility change handling
  private isVisible = true;
  private onIdleStateCallback: (() => void) | null = null;
  private boundVisibilityChangeHandler = this.handleVisibilityChange.bind(this);

  // Media command callback
  private mediaCommandCallback: MediaCommandCallback | null = null;

  constructor() {
    console.info('[MQTT] Creating MqttManager...');
    this.initVisibilityChangeListener();
  }

  setOnIdleStateCallback(callback: () => void) {
    this.onIdleStateCallback = callback;
  }

  setMediaCommandCallback(callback: MediaCommandCallback) {
    this.mediaCommandCallback = callback;
  }

  private initVisibilityChangeListener() {
    document.addEventListener(
      'webkitvisibilitychange',
      this.boundVisibilityChangeHandler
    );
    console.info('[MQTT] WebKit visibility change listener initialized');
  }

  private handleVisibilityChange() {
    const wasVisible = this.isVisible;
    this.isVisible = !(document as any).webkitHidden;

    console.info(
      `[MQTT] Visibility changed: ${wasVisible ? 'visible' : 'hidden'} -> ${this.isVisible ? 'visible' : 'hidden'}`
    );

    if (wasVisible && !this.isVisible) {
      // App became hidden (TV standby)
      this.handleAppHidden();
    } else if (!wasVisible && this.isVisible) {
      // App became visible (TV active)
      this.handleAppVisible();
    }
  }

  private handleAppHidden() {
    console.info('[MQTT] App hidden - TV in standby mode');

    // Publish offline availability
    this.publishAvailability(false);

    // Clear media state by calling the idle state callback
    if (this.onIdleStateCallback) {
      this.onIdleStateCallback();
    }

    // Pause position updates to save bandwidth
    this.stopPositionUpdates();
  }

  private handleAppVisible() {
    console.info('[MQTT] App visible - TV active');

    // Publish online availability
    this.publishAvailability(true);

    // Resume position updates
    this.startPositionUpdates();
  }

  async connect(): Promise<void> {
    if (this.client && this.client.connected) {
      console.info('[MQTT] Already connected');
      return;
    }

    this.connectionState.status = 'connecting';
    this.connectionState.brokerUrl = `ws://${MQTT_CONFIG.broker}:${MQTT_CONFIG.port}`;

    console.info(
      '[MQTT] Connecting to broker:',
      this.connectionState.brokerUrl
    );

    try {
      const connectOptions: mqtt.IClientOptions = {
        clientId: MQTT_CONFIG.clientId,
        username: MQTT_CONFIG.username,
        password: MQTT_CONFIG.password,
        will: {
          topic: this.topics.available,
          payload: 'OFF',
          qos: 1,
          retain: true
        },
        reconnectPeriod: 0, // Disable automatic reconnection, we'll handle it manually
        connectTimeout: 10000,
        keepalive: 20,
        clean: true
      };

      this.client = mqtt.connect(
        this.connectionState.brokerUrl,
        connectOptions
      );

      this.client.on('connect', (connack) => {
        console.info('[MQTT] Connected to broker', connack);
        this.connectionState.status = 'connected';
        this.connectionState.lastConnected = new Date();
        this.connectionState.lastError = null;
        this.reconnectDelay = 5000; // Reset reconnect delay on successful connection

        // Show success notification if this is a reconnection
        if (this.notificationShown) {
          showNotification('MQTT connection restored');
        }
        this.notificationShown = false;

        // Publish availability
        this.publishAvailability(true);

        // Publish discovery configuration
        this.publishDiscoveryConfig();

        // Subscribe to command topics
        this.subscribeToCommands();

        // Start position updates
        this.startPositionUpdates();
      });

      this.client.on('error', (error) => {
        console.error('[MQTT] Connection error:', error);
        this.connectionState.status = 'error';
        this.connectionState.lastError = error.message;
        this.handleConnectionError(error);
      });

      this.client.on('close', () => {
        console.info('[MQTT] Connection closed');
        this.connectionState.status = 'disconnected';
        this.stopPositionUpdates();
        this.scheduleReconnect();
      });

      this.client.on('offline', () => {
        console.info('[MQTT] Client offline');
        this.connectionState.status = 'disconnected';
        this.stopPositionUpdates();
      });

      this.client.on('message', (topic, payload, packet) => {
        this.handleMessage(topic, payload, packet);
      });
    } catch (error) {
      console.error('[MQTT] Failed to create client:', error);
      this.connectionState.status = 'error';
      this.connectionState.lastError =
        error instanceof Error ? error.message : 'Unknown error';
      this.handleConnectionError(
        error instanceof Error ? error : new Error('Unknown error')
      );
    }
  }

  private handleConnectionError(error: Error): void {
    console.error('[MQTT] Connection error:', error.message);

    // Show notification only once
    if (!this.notificationShown) {
      showNotification(`MQTT connection failed: ${error.message}`);
      this.notificationShown = true;
    }

    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    console.info(`[MQTT] Scheduling reconnect in ${this.reconnectDelay}ms`);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);

    // Exponential backoff with max delay
    this.reconnectDelay = Math.min(
      this.reconnectDelay * 2,
      this.maxReconnectDelay
    );
  }

  private subscribeToCommands(): void {
    if (!this.client || !this.client.connected) return;

    const commandTopics = [
      this.topics.seek,
      this.topics.playmedia,
      this.topics.play,
      this.topics.pause,
      this.topics.stop
    ];

    commandTopics.forEach((topic) => {
      this.client!.subscribe(topic, { qos: 1 }, (error, granted) => {
        if (error) {
          console.error(`[MQTT] Failed to subscribe to ${topic}:`, error);
        } else {
          console.info(`[MQTT] Subscribed to ${topic}:`, granted);
        }
      });
    });
  }

  private handleMessage(
    topic: string,
    payload: Buffer,
    packet: mqtt.IPublishPacket
  ): void {
    try {
      const message = payload.toString();
      console.info(`[MQTT] Received message on ${topic}:`, message, packet);

      // Route command to callback if available
      if (this.mediaCommandCallback) {
        let command: string | null = null;

        if (topic === this.topics.seek) {
          command = 'seek';
        } else if (topic === this.topics.playmedia) {
          command = 'playmedia';
        } else if (topic === this.topics.play) {
          command = 'play';
        } else if (topic === this.topics.pause) {
          command = 'pause';
        } else if (topic === this.topics.stop) {
          command = 'stop';
        }

        if (command) {
          this.mediaCommandCallback(command, message);
        } else {
          console.warn(`[MQTT] Unknown topic: ${topic}`);
        }
      } else {
        console.warn('[MQTT] No media command callback registered');
      }
    } catch (error) {
      console.error('[MQTT] Error handling message:', error);
    }
  }

  private startPositionUpdates(): void {
    this.stopPositionUpdates(); // Clear any existing interval

    this.positionUpdateInterval = setInterval(() => {
      const video = document.querySelector('video') as HTMLVideoElement;
      if (video && !video.paused && !video.ended) {
        this.publishPosition(video.currentTime);
      }
    }, 5000); // Every 5 seconds
  }

  private stopPositionUpdates(): void {
    if (this.positionUpdateInterval) {
      clearInterval(this.positionUpdateInterval);
      this.positionUpdateInterval = null;
    }
  }

  private publishAvailability(available: boolean): void {
    this.publish(this.topics.available, available ? 'ON' : 'OFF', {
      retain: true
    });
  }

  private publishDiscoveryConfig(): void {
    const config = {
      name: 'Living Room TV GhostTube',
      unique_id: 'living_room_tv_ghosttube',

      // Availability
      availability_topic: this.topics.available,

      // State topics
      state_topic: this.topics.state,

      // Media information topics
      title_topic: this.topics.title,
      artist_topic: this.topics.artist,
      albumart_topic: this.topics.albumart,
      duration_topic: this.topics.duration,
      position_topic: this.topics.position,
      mediatype_topic: this.topics.mediatype,

      // Command topics
      seek_topic: this.topics.seek,
      playmedia_topic: this.topics.playmedia,
      play_topic: this.topics.play,
      play_payload: 'play',
      pause_topic: this.topics.pause,
      pause_payload: 'pause',
      stop_topic: this.topics.stop,
      stop_payload: 'stop',

      // Device information
      device: {
        identifiers: ['webos_youtube_app'],
        name: 'webOS YouTube App',
        model: 'YouTube TV App',
        manufacturer: 'webOS',
        sw_version: '0.3.8'
      }
    };

    const configPayload = JSON.stringify(config);
    this.publish(this.topics.config, configPayload, { retain: true });
    console.info('[MQTT] Published discovery configuration');
  }

  publishMediaState(state: MediaState): void {
    if (!this.client || !this.client.connected) return;

    // Always publish state
    this.publish(this.topics.state, state.state);

    // For idle state, explicitly clear all media fields with empty strings
    if (state.state === 'idle') {
      this.publish(this.topics.title, '');
      this.publish(this.topics.artist, '');
      this.publish(this.topics.albumart, '');
      this.publish(this.topics.duration, '');
      this.publish(this.topics.position, '');
    } else {
      // For non-idle states, publish actual values or empty strings
      this.publish(this.topics.title, state.title || '');
      this.publish(this.topics.artist, state.artist || '');
      this.publish(this.topics.albumart, state.albumart || '');
      this.publish(this.topics.duration, state.duration?.toString() || '');
    }

    this.publish(this.topics.mediatype, state.mediatype);

    console.info('[MQTT] Published media state:', state);
  }

  publishPosition(position: number): void {
    this.publish(this.topics.position, position.toString());
  }

  private publish(
    topic: string,
    payload: string,
    options: mqtt.IClientPublishOptions = {}
  ): void {
    if (!this.client || !this.client.connected) {
      console.warn('[MQTT] Cannot publish - not connected');
      return;
    }

    this.client.publish(
      topic,
      payload,
      { qos: 1, ...options },
      (error, packet) => {
        if (error) {
          console.error(`[MQTT] Failed to publish to ${topic}:`, error);
        } else if (packet) {
          console.debug(`[MQTT] Published to ${topic}:`, packet);
        }
      }
    );
  }

  getConnectionState(): MqttConnectionState {
    return { ...this.connectionState };
  }

  isConnected(): boolean {
    return this.client?.connected ?? false;
  }

  async disconnect(): Promise<void> {
    console.info('[MQTT] Disconnecting...');

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopPositionUpdates();

    // Remove visibility change listener
    document.removeEventListener(
      'webkitvisibilitychange',
      this.boundVisibilityChangeHandler
    );
    console.info('[MQTT] WebKit visibility change listener removed');

    if (this.client) {
      // Publish offline status before disconnecting
      if (this.client.connected) {
        this.publishAvailability(false);
      }

      return new Promise<void>((resolve) => {
        this.client!.end(false, {}, () => {
          console.info('[MQTT] Disconnected');
          resolve();
        });
        this.client = null;
      });
    }

    this.connectionState.status = 'disconnected';
  }
}

// Global instance
let mqttManager: MqttManager | null = null;

export function getMqttManager(): MqttManager {
  if (!mqttManager) {
    mqttManager = new MqttManager();
    // Auto-connect on first access
    mqttManager.connect().catch((error) => {
      console.error('[MQTT] Auto-connect failed:', error);
    });
  }
  return mqttManager;
}

export function destroyMqttManager(): void {
  if (mqttManager) {
    mqttManager.disconnect().catch((error) => {
      console.error('[MQTT] Error during disconnect:', error);
    });
    mqttManager = null;
  }
}

// Types for external use
export type { MediaState, MqttConnectionState };
export { MqttManager };
