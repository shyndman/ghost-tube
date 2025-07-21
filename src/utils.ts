const CONTENT_INTENT_REGEX = /^.+(?=Content)/g;

interface LaunchParams {
  target?: string;
  contentTarget?: string | ContentTargetObject;
  storeCaller?: string;
  subReason?: string;
  voiceEngine?: string;
}

interface ContentTargetObject {
  intent: string;
  intentParam: string;
}

declare global {
  interface Window {
    launchParams?: string;
  }
}

export function extractLaunchParams(): LaunchParams {
  if (window.launchParams) {
    return JSON.parse(window.launchParams);
  } else {
    return {};
  }
}

function getYTURL(): URL {
  const ytURL = new URL('https://www.youtube.com/tv#/');
  ytURL.searchParams.append('env_forceFullAnimation', '1');
  ytURL.searchParams.append('env_enableWebSpeech', '1');
  ytURL.searchParams.append('env_enableVoice', '1');
  return ytURL;
}

/**
 * Creates a new URLSearchPrams with the contents of `a` and `b`
 * @param {URLSearchParams} a
 * @param {URLSearchParams} b
 * @returns {URLSearchParams}
 */
function concatSearchParams(
  a: URLSearchParams,
  b: URLSearchParams
): URLSearchParams {
  return new URLSearchParams([...a.entries(), ...b.entries()]);
}

export function handleLaunch(params: LaunchParams): void {
  console.info('handleLaunch', params);
  let ytURL: URL | string = getYTURL();

  // We use our custom "target" param, since launches with "contentTarget"
  // parameter do not respect "handlesRelaunch" appinfo option. We still
  // fallback to "contentTarget" if our custom param is not specified.
  //
  let { target, contentTarget = target } = params;

  /** TODO: Handle google assistant
   * Sample: {contentTarget: "v=v=<ID>", storeCaller: "voice", subReason: "voiceAgent", voiceEngine: "googleAssistant"}
   */

  switch (typeof contentTarget) {
    case 'string': {
      if (contentTarget.indexOf(ytURL.origin) === 0) {
        console.info('Launching from direct contentTarget');
        ytURL = contentTarget;
      } else {
        // Out of app dial launch with second screen on home: { contentTarget: 'pairingCode=<UUID>&theme=cl&dialLaunch=watch' }
        console.info('Launching from partial contentTarget');
        if (contentTarget.indexOf('v=v=') === 0)
          contentTarget = contentTarget.substring(2);

        ytURL.search = concatSearchParams(
          (ytURL as URL).searchParams,
          new URLSearchParams(contentTarget)
        ).toString();
      }
      break;
    }
    case 'object': {
      console.info('Voice launch');

      const { intent, intentParam } = contentTarget as ContentTargetObject;
      // Ctrl+F tvhtml5LaunchUrlComponentChanged & REQUEST_ORIGIN_GOOGLE_ASSISTANT in base.js for info
      const search = (ytURL as URL).searchParams;
      // contentTarget.intent's seen so far: PlayContent, SearchContent
      const voiceContentIntent = intent
        .match(CONTENT_INTENT_REGEX)?.[0]
        ?.toLowerCase();

      search.set('inApp', 'true');
      search.set('vs', '9'); // Voice System is VOICE_SYSTEM_LG_THINKQ
      voiceContentIntent && search.set('va', voiceContentIntent);

      // order is important
      search.append('launch', 'voice');
      voiceContentIntent === 'search' && search.append('launch', 'search');

      search.set('vq', intentParam);
      break;
    }
    default: {
      console.info('Default launch');
    }
  }

  window.location.href = ytURL.toString();
}

/**
 * Wait for a child element to be added for which a predicate is true.
 *
 * When `observeAttributes` is false, the predicate is checked only when a node
 * is first added. If you want the predicate to run every time an attribute is
 * modified, set `observeAttributes` to true.
 * @template {Node} T
 * @param {Element} parent Root of tree to watch
 * @param {(node: Node) => node is T} predicate Function that checks whether its argument is the desired element
 * @param {boolean} observeAttributes Also run predicate on attribute changes
 * @param {AbortSignal=} abortSignal Signal that can be used to stop waiting
 * @return {Promise<T>} Matched element
 */
export async function waitForChildAdd<T extends Node>(
  parent: Element,
  predicate: (node: Node) => node is T,
  observeAttributes: boolean,
  abortSignal?: AbortSignal
): Promise<T> {
  return new Promise((resolve, reject) => {
    const obs = new MutationObserver((mutations) => {
      for (const mut of mutations) {
        switch (mut.type) {
          case 'attributes': {
            if (predicate(mut.target!)) {
              obs.disconnect();
              resolve(mut.target! as T);
              return;
            }
            break;
          }
          case 'childList': {
            for (const node of Array.from(mut.addedNodes)) {
              if (predicate(node)) {
                obs.disconnect();
                resolve(node as T);
                return;
              }
            }
            break;
          }
        }
      }
    });

    if (abortSignal) {
      abortSignal.addEventListener('abort', () => {
        obs.disconnect();
        reject(new Error('aborted'));
      });
    }

    obs.observe(parent, {
      subtree: true,
      attributes: observeAttributes,
      childList: true
    });
  });
}

interface DOMSettleOptions {
  delay?: number;
  timeout?: number;
}

export function waitForDOMToSettle(
  element: Element = document.body,
  options: DOMSettleOptions = {}
): Promise<void> {
  const { delay = 300, timeout } = options;

  const settlePromise = new Promise<void>((resolve) => {
    let timeoutId: number;

    const observer = new MutationObserver((mutations: MutationRecord[]) => {
      // Clear any existing timeout
      clearTimeout(timeoutId);

      // Set a new timeout
      timeoutId = window.setTimeout(() => {
        // DOM hasn't changed for 'delay' ms, so it's settled
        observer.disconnect();
        resolve();
      }, delay);
    });

    // Start observing the provided element
    observer.observe(element, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeOldValue: false,
      characterData: false
    });
  });

  // If timeout is specified, race against it
  if (timeout) {
    return Promise.race([
      settlePromise,
      new Promise<void>((_, reject) =>
        setTimeout(
          () => reject(new Error(`DOM did not settle within ${timeout}ms`)),
          timeout
        )
      )
    ]);
  }

  return settlePromise;
}
