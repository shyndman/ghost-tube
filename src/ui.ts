/*global navigate*/
import {
  configAddChangeListener,
  configRead,
  configWrite,
  configGetDesc
} from './config.js';
import { getMqttManager } from './mqtt';
import './ui.css';
import { requireElement } from './player-api';
// @ts-ignore - Asset import handled by webpack
import customLogoUrl from '../assets/customLogo.2x.png';

declare global {
  interface Window {
    ytaf_showOptionsPanel: (visible?: boolean) => void;
  }
}

// Asset declarations are handled by webpack

type ColorButton = 'red' | 'green' | 'yellow' | 'blue';
type ArrowDirection = 'left' | 'up' | 'right' | 'down';

interface ConfigChangeEvent extends CustomEvent {
  detail: {
    newValue: boolean | string;
    oldValue: boolean | string;
  };
}

// Red, Green, Yellow, Blue
// 403,   404,    405,  406
// ---,   172,    170,  191
const colorCodeMap = new Map<number, ColorButton>([
  [403, 'red'],

  [404, 'green'],
  [172, 'green'],

  [405, 'yellow'],
  [170, 'yellow'],

  [406, 'blue'],
  [191, 'blue']
]);

/**
 * Returns the name of the color button associated with a code or null if not a color button.
 */
function getKeyColor(charCode: number): ColorButton | null {
  if (colorCodeMap.has(charCode)) {
    return colorCodeMap.get(charCode)!;
  }

  return null;
}

function createConfigCheckbox(key: string): HTMLLabelElement {
  const elmInput = document.createElement('input');
  elmInput.type = 'checkbox';
  elmInput.checked = configRead(key);

  const changeHandler = (evt: Event): void => {
    const target = evt.target as HTMLInputElement;
    configWrite(key, target.checked);
  };

  elmInput.addEventListener('change', changeHandler);

  configAddChangeListener(key, (evt: Event) => {
    const customEvt = evt as ConfigChangeEvent;
    elmInput.checked = customEvt.detail.newValue as boolean;
  });

  const elmLabel = document.createElement('label');
  elmLabel.appendChild(elmInput);
  // Use non-breaking space (U+00A0)
  elmLabel.appendChild(document.createTextNode('\u00A0' + configGetDesc(key)));

  return elmLabel;
}

function createConfigTextInput(key: string): HTMLLabelElement {
  const elmInput = document.createElement('input');
  elmInput.type = 'text';
  elmInput.value = configRead(key) as string;
  elmInput.classList.add('config-text-input');

  // Validate device name format (kebab-case)
  const validateDeviceName = (value: string): boolean => {
    return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value);
  };

  const updateValue = (): void => {
    const value = elmInput.value.trim();
    if (value && validateDeviceName(value)) {
      elmInput.classList.remove('invalid');
      configWrite(key, value);
    } else {
      elmInput.classList.add('invalid');
    }
  };

  elmInput.addEventListener('blur', updateValue);
  elmInput.addEventListener('keydown', (evt: KeyboardEvent) => {
    if (evt.keyCode === 13) {
      // Enter key
      evt.preventDefault();
      updateValue();
      elmInput.blur();
    }
  });

  configAddChangeListener(key, (evt: Event) => {
    const customEvt = evt as ConfigChangeEvent;
    elmInput.value = customEvt.detail.newValue as string;
  });

  const elmLabel = document.createElement('label');
  elmLabel.classList.add('config-text-label');

  const labelText = document.createElement('div');
  labelText.textContent = configGetDesc(key);
  labelText.classList.add('config-label-text');

  elmLabel.appendChild(labelText);
  elmLabel.appendChild(elmInput);

  return elmLabel;
}

function createMqttConfigSection(): HTMLDivElement {
  const configContainer = document.createElement('div');
  configContainer.classList.add('ytaf-mqtt-config');

  const configHeading = document.createElement('h2');
  configHeading.textContent = 'MQTT Configuration';
  configHeading.classList.add('config-section-heading');
  configContainer.appendChild(configHeading);

  // Add status section first
  const statusContainer = document.createElement('div');
  statusContainer.classList.add('ytaf-mqtt-status');

  const statusHeading = document.createElement('h3');
  statusHeading.textContent = 'Connection Status';
  statusHeading.classList.add('config-subsection-heading');
  statusContainer.appendChild(statusHeading);

  const statusText = document.createElement('div');
  statusText.classList.add('ytaf-mqtt-status-text');
  statusContainer.appendChild(statusText);

  // Function to update status display
  function updateMqttStatus(): void {
    try {
      const mqttManager = getMqttManager();
      const connectionState = mqttManager.getConnectionState();

      let statusHtml = `<strong>Status:</strong> ${connectionState.status}<br>`;

      if (connectionState.brokerUrl) {
        statusHtml += `<strong>Broker:</strong> ${connectionState.brokerUrl}<br>`;
      }

      if (connectionState.lastConnected) {
        statusHtml += `<strong>Last Connected:</strong> ${connectionState.lastConnected.toLocaleString()}<br>`;
      }

      if (connectionState.lastError) {
        statusHtml += `<strong>Last Error:</strong> ${connectionState.lastError}`;
      }

      statusText.innerHTML = statusHtml;
    } catch (error) {
      const err = error as Error;
      statusText.innerHTML = `<strong>Status:</strong> Error getting MQTT status<br><strong>Error:</strong> ${err.message}`;
    }
  }

  // Update status initially
  updateMqttStatus();

  // Update status every 5 seconds
  const statusInterval = setInterval(updateMqttStatus, 5000);

  // Store the interval so it can be cleaned up if needed
  (statusContainer as any)._statusInterval = statusInterval;

  configContainer.appendChild(statusContainer);

  // Add device name text input after status
  configContainer.appendChild(createConfigTextInput('mqttDeviceName'));

  return configContainer;
}

function createOptionsPanel(): HTMLDivElement {
  const elmContainer = document.createElement('div');

  elmContainer.classList.add('ytaf-ui-container');
  elmContainer.style['display'] = 'none';
  elmContainer.setAttribute('tabindex', '0');

  elmContainer.addEventListener(
    'focus',
    () => console.info('Options panel focused!'),
    true
  );
  elmContainer.addEventListener(
    'blur',
    () => console.info('Options panel blurred!'),
    true
  );

  elmContainer.addEventListener(
    'keydown',
    (evt: KeyboardEvent) => {
      console.info('Options panel key event:', evt.type, evt.charCode);

      if (getKeyColor(evt.charCode) === 'green') {
        return;
      }

      let handled = true;
      if (evt.keyCode === 13) {
        // "OK" button

        /**
         * The YouTube app generates these "OK" events from clicks (including
         * with the Magic Remote), and we don't want to send a duplicate click
         * event for those. Youtube uses the `Event` class instead of
         * `KeyboardEvent` so we check for that.
         * See issue #143 and #200 for context.
         */
        if (evt instanceof KeyboardEvent) {
          (document.activeElement as HTMLElement)?.click();
        }
      } else if (evt.keyCode === 27) {
        // Back button
        showOptionsPanel(false);
      } else {
        handled = false;
      }

      if (handled) {
        evt.preventDefault();
        evt.stopPropagation();
      }
    },
    true
  );

  const elmHeading = document.createElement('h1');
  elmHeading.textContent = 'GhostTube';
  elmContainer.appendChild(elmHeading);

  elmContainer.appendChild(createConfigCheckbox('upgradeThumbnails'));
  elmContainer.appendChild(createConfigCheckbox('removeShorts'));
  elmContainer.appendChild(createConfigCheckbox('forceHighResVideo'));
  elmContainer.appendChild(createConfigCheckbox('enableSponsorBlock'));

  // Add MQTT configuration section
  const mqttConfigSection = createMqttConfigSection();
  elmContainer.appendChild(mqttConfigSection);

  const elmBlock = document.createElement('blockquote');
  elmBlock.classList.add('sponsorblock-section');

  const sponsorBlockHeading = document.createElement('h2');
  sponsorBlockHeading.textContent = 'SponsorBlock Options';
  sponsorBlockHeading.classList.add('config-section-heading');
  elmBlock.appendChild(sponsorBlockHeading);

  elmBlock.appendChild(createConfigCheckbox('enableSponsorBlockSponsor'));
  elmBlock.appendChild(createConfigCheckbox('enableSponsorBlockIntro'));
  elmBlock.appendChild(createConfigCheckbox('enableSponsorBlockOutro'));
  elmBlock.appendChild(createConfigCheckbox('enableSponsorBlockInteraction'));
  elmBlock.appendChild(createConfigCheckbox('enableSponsorBlockSelfPromo'));
  elmBlock.appendChild(createConfigCheckbox('enableSponsorBlockMusicOfftopic'));
  elmBlock.appendChild(createConfigCheckbox('enableSponsorBlockPreview'));

  const elmSponsorLink = document.createElement('div');
  elmSponsorLink.innerHTML =
    '<small class="ytaf-ui-sponsor">Sponsor segments skipping - https://sponsor.ajay.app</small>';
  elmBlock.appendChild(elmSponsorLink);

  elmContainer.appendChild(elmBlock);

  return elmContainer;
}

const optionsPanel = createOptionsPanel();
document.body.appendChild(optionsPanel);

let optionsPanelVisible = false;

/**
 * Show or hide the options panel.
 */
function showOptionsPanel(visible: boolean = true): void {
  if (visible && !optionsPanelVisible) {
    console.info('Showing and focusing options panel!');
    optionsPanel.style.display = 'block';
    optionsPanel.focus();
    optionsPanelVisible = true;
  } else if (!visible && optionsPanelVisible) {
    console.info('Hiding options panel!');
    optionsPanel.style.display = 'none';
    optionsPanel.blur();
    optionsPanelVisible = false;
  }
}

window.ytaf_showOptionsPanel = showOptionsPanel;

const eventHandler = (evt: KeyboardEvent): boolean => {
  console.info(
    'Key event:',
    evt.type,
    evt.charCode,
    evt.keyCode,
    evt.defaultPrevented
  );

  if (getKeyColor(evt.charCode) === 'green') {
    console.info('Taking over!');

    evt.preventDefault();
    evt.stopPropagation();

    if (evt.type === 'keydown') {
      // Toggle visibility.
      showOptionsPanel(!optionsPanelVisible);
    }
    return false;
  }
  return true;
};

document.addEventListener('keydown', eventHandler, true);
document.addEventListener('keypress', eventHandler, true);
document.addEventListener('keyup', eventHandler, true);

export function showNotification(text: string, time: number = 3000): void {
  if (!document.querySelector('.ytaf-notification-container')) {
    console.info('Adding notification container');
    const c = document.createElement('div');
    c.classList.add('ytaf-notification-container');
    document.body.appendChild(c);
  }

  const elm = document.createElement('div');
  const elmInner = document.createElement('div');
  elmInner.innerText = text;
  elmInner.classList.add('message');
  elmInner.classList.add('message-hidden');
  elm.appendChild(elmInner);
  document.querySelector('.ytaf-notification-container')!.appendChild(elm);

  setTimeout(() => {
    elmInner.classList.remove('message-hidden');
  }, 100);
  setTimeout(() => {
    elmInner.classList.add('message-hidden');
    setTimeout(() => {
      elm.remove();
    }, 1000);
  }, time);
}

function applyUIFixes() {
  try {
    const bodyClasses = document.body.classList;

    const observer = new MutationObserver(function bodyClassCallback(
      _records,
      _observer
    ) {
      try {
        if (bodyClasses.contains('app-quality-root')) {
          bodyClasses.remove('app-quality-root');
        }
      } catch (e) {
        console.error('error in <body> class observer callback:', e);
      }
    });

    observer.observe(document.body, {
      subtree: false,
      childList: false,
      attributes: true,
      attributeFilter: ['class'],
      characterData: false
    });
  } catch (e) {
    console.error('error setting up <body> class observer:', e);
  }
}

/**
 * Initialize custom logo by overriding inline styles
 */
async function initCustomLogo(): Promise<void> {
  try {
    // Wait for the logo element to exist
    const logoEntity = await requireElement('ytlr-logo-entity', HTMLElement);

    // Function to update the thumbnail background
    const updateThumbnail = () => {
      const thumbnail = logoEntity.querySelector('ytlr-thumbnail-details');
      if (thumbnail instanceof HTMLElement) {
        // Override the inline style with our custom logo
        thumbnail.style.backgroundImage = `url(${customLogoUrl})`;
        return true;
      }
      return false;
    };

    // Try to update immediately
    if (!updateThumbnail()) {
      // If thumbnail doesn't exist yet, wait for it
      const observer = new MutationObserver((mutations, obs) => {
        if (updateThumbnail()) {
          obs.disconnect();
        }
      });

      observer.observe(logoEntity, {
        childList: true,
        subtree: true
      });
    }

    // Also watch for future changes that might reset the background
    const styleObserver = new MutationObserver(() => {
      updateThumbnail();
    });

    // Observe the logo entity for any changes that might affect the thumbnail
    styleObserver.observe(logoEntity, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style']
    });
  } catch (error) {
    console.error('Error initializing custom logo:', error);
  }
}

applyUIFixes();

// Initialize custom logo on page load
setTimeout(() => initCustomLogo(), 300);

// Re-apply custom logo on page changes
window.addEventListener('hashchange', () => {
  console.info('[UI] Hash change detected, re-applying custom logo');
  // Small delay to ensure DOM is ready after navigation
  setTimeout(() => initCustomLogo(), 300);
});

setTimeout(() => {
  showNotification('Press [GREEN] to open YTAF configuration screen');
}, 2000);
