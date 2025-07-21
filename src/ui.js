/*global navigate*/
import './spatial-navigation-polyfill.js';
import {
  configAddChangeListener,
  configRead,
  configWrite,
  configGetDesc
} from './config.js';
import { getMqttManager } from './mqtt';
import './ui.css';
import customLogoUrl from '../assets/customLogo.2x.png';

// We handle key events ourselves.
window.__spatialNavigation__.keyMode = 'NONE';

const ARROW_KEY_CODE = { 37: 'left', 38: 'up', 39: 'right', 40: 'down' };

// Red, Green, Yellow, Blue
// 403,   404,    405,  406
// ---,   172,    170,  191
const colorCodeMap = new Map([
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
 * @param {number} charCode KeyboardEvent.charCode property from event
 * @returns {string | null} Color name or null
 */
function getKeyColor(charCode) {
  if (colorCodeMap.has(charCode)) {
    return colorCodeMap.get(charCode);
  }

  return null;
}

function createConfigCheckbox(key) {
  const elmInput = document.createElement('input');
  elmInput.type = 'checkbox';
  elmInput.checked = configRead(key);

  /** @type {(evt: Event) => void} */
  const changeHandler = (evt) => {
    configWrite(key, evt.target.checked);
  };

  elmInput.addEventListener('change', changeHandler);

  configAddChangeListener(key, (evt) => {
    elmInput.checked = evt.detail.newValue;
  });

  const elmLabel = document.createElement('label');
  elmLabel.appendChild(elmInput);
  // Use non-breaking space (U+00A0)
  elmLabel.appendChild(document.createTextNode('\u00A0' + configGetDesc(key)));

  return elmLabel;
}

function createMqttStatusSection() {
  const statusContainer = document.createElement('div');
  statusContainer.classList.add('ytaf-mqtt-status');
  statusContainer.style.marginTop = '20px';
  statusContainer.style.padding = '10px';
  statusContainer.style.border = '1px solid #444';
  statusContainer.style.borderRadius = '5px';

  const statusHeading = document.createElement('h3');
  statusHeading.textContent = 'MQTT Status';
  statusHeading.style.margin = '0 0 10px 0';
  statusHeading.style.fontSize = '14px';
  statusContainer.appendChild(statusHeading);

  const statusText = document.createElement('div');
  statusText.classList.add('ytaf-mqtt-status-text');
  statusText.style.fontSize = '12px';
  statusText.style.lineHeight = '1.4';
  statusContainer.appendChild(statusText);

  // Function to update status display
  function updateMqttStatus() {
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
      statusText.innerHTML = `<strong>Status:</strong> Error getting MQTT status<br><strong>Error:</strong> ${error.message}`;
    }
  }

  // Update status initially
  updateMqttStatus();

  // Update status every 5 seconds
  const statusInterval = setInterval(updateMqttStatus, 5000);

  // Store the interval so it can be cleaned up if needed
  statusContainer._statusInterval = statusInterval;

  return statusContainer;
}

function createOptionsPanel() {
  const elmContainer = document.createElement('div');

  elmContainer.classList.add('ytaf-ui-container');
  elmContainer.style['display'] = 'none';
  elmContainer.setAttribute('tabindex', 0);

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
    (evt) => {
      console.info('Options panel key event:', evt.type, evt.charCode);

      if (getKeyColor(evt.charCode) === 'green') {
        return;
      }

      if (evt.keyCode in ARROW_KEY_CODE) {
        navigate(ARROW_KEY_CODE[evt.keyCode]);
      } else if (evt.keyCode === 13) {
        // "OK" button

        /**
         * The YouTube app generates these "OK" events from clicks (including
         * with the Magic Remote), and we don't want to send a duplicate click
         * event for those. Youtube uses the `Event` class instead of
         * `KeyboardEvent` so we check for that.
         * See issue #143 and #200 for context.
         */
        if (evt instanceof KeyboardEvent) {
          document.activeElement.click();
        }
      } else if (evt.keyCode === 27) {
        // Back button
        showOptionsPanel(false);
      }

      evt.preventDefault();
      evt.stopPropagation();
    },
    true
  );

  const elmHeading = document.createElement('h1');
  elmHeading.textContent = 'WebOS YouTube Extended';
  elmContainer.appendChild(elmHeading);

  elmContainer.appendChild(createConfigCheckbox('enableAdBlock'));
  elmContainer.appendChild(createConfigCheckbox('upgradeThumbnails'));
  elmContainer.appendChild(createConfigCheckbox('customLogo'));
  elmContainer.appendChild(createConfigCheckbox('showWatch'));
  elmContainer.appendChild(createConfigCheckbox('removeShorts'));
  elmContainer.appendChild(createConfigCheckbox('forceHighResVideo'));
  elmContainer.appendChild(createConfigCheckbox('enableSponsorBlock'));

  const elmBlock = document.createElement('blockquote');

  elmBlock.appendChild(createConfigCheckbox('enableSponsorBlockSponsor'));
  elmBlock.appendChild(createConfigCheckbox('enableSponsorBlockIntro'));
  elmBlock.appendChild(createConfigCheckbox('enableSponsorBlockOutro'));
  elmBlock.appendChild(createConfigCheckbox('enableSponsorBlockInteraction'));
  elmBlock.appendChild(createConfigCheckbox('enableSponsorBlockSelfPromo'));
  elmBlock.appendChild(createConfigCheckbox('enableSponsorBlockMusicOfftopic'));
  elmBlock.appendChild(createConfigCheckbox('enableSponsorBlockPreview'));

  elmContainer.appendChild(elmBlock);

  const elmSponsorLink = document.createElement('div');
  elmSponsorLink.innerHTML =
    '<small class="ytaf-ui-sponsor">Sponsor segments skipping - https://sponsor.ajay.app</small>';
  elmContainer.appendChild(elmSponsorLink);

  // Add MQTT status section
  const mqttStatusSection = createMqttStatusSection();
  elmContainer.appendChild(mqttStatusSection);

  return elmContainer;
}

const optionsPanel = createOptionsPanel();
document.body.appendChild(optionsPanel);

let optionsPanelVisible = false;

/**
 * Show or hide the options panel.
 * @param {boolean} [visible=true] Whether to show the options panel.
 */
function showOptionsPanel(visible) {
  visible ??= true;

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

const eventHandler = (evt) => {
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

export function showNotification(text, time = 3000) {
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
  document.querySelector('.ytaf-notification-container').appendChild(elm);

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

/**
 * Initialize ability to replace YouTube logo with custom logo.
 */
function initCustomLogo() {
  const style = document.createElement('style');
  document.head.appendChild(style);

  let customLogoElement = null;

  /** @type {(replace: boolean) => void} */
  const setCustomLogo = (replace) => {
    // Always hide the original logo when custom logo is enabled
    const visibility = replace ? 'hidden' : 'visible';
    style.textContent = `ytlr-logo-entity { visibility: ${visibility}; }`;

    if (replace) {
      // Find the original logo to copy its positioning
      const originalLogo = document.querySelector('ytlr-logo-entity');

      if (originalLogo && !customLogoElement) {
        customLogoElement = document.createElement('img');
        customLogoElement.src = customLogoUrl;
        customLogoElement.className = 'ytaf-custom-logo ytLrLogoEntityAppLevel';

        // Copy the positioning from the original logo
        const originalStyles = originalLogo.style;
        customLogoElement.style.cssText = `
          position: absolute;
          left: ${originalStyles.left};
          width: ${originalStyles.width};
          top: 2rem;
          z-index: 1000;
          pointer-events: none;
        `;

        // Append to the same parent as the original logo
        originalLogo.parentElement.appendChild(customLogoElement);
      }

      if (customLogoElement) {
        customLogoElement.style.display = 'block';
      }
    } else if (customLogoElement) {
      // Hide custom logo
      customLogoElement.style.display = 'none';
    }
  };

  setCustomLogo(configRead('customLogo'));

  configAddChangeListener('customLogo', (evt) => {
    setCustomLogo(evt.detail.newValue);
  });
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

applyUIFixes();
initCustomLogo();

setTimeout(() => {
  showNotification('Press [GREEN] to open YTAF configuration screen');
}, 2000);
