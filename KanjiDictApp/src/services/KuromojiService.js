/**
 * KuromojiService — Japanese morphological analyzer for compound word readings
 *
 * Loads kuromoji.js from jsDelivr CDN at runtime via a script tag injection.
 * Kuromoji tokenizes Japanese text into words and provides per-word readings,
 * solving the compound-reading problem: 行列 → ぎょうれつ (not こう+れつ).
 *
 * Dictionary files (~8 MB compressed) are loaded from CDN on first use and
 * cached by the browser.
 *
 * Platform: web only (kuromoji requires DOM APIs).
 */

import { Platform } from 'react-native';

const KUROMOJI_SCRIPT = 'https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/build/kuromoji.js';
const DICT_PATH       = 'https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict';

let _tokenizer = null;
let _promise   = null;

export const KUROMOJI_STATUS = {
  IDLE:    'idle',
  LOADING: 'loading',
  READY:   'ready',
  ERROR:   'error',
};

let _status    = KUROMOJI_STATUS.IDLE;
let _listeners = [];

function setStatus(s) {
  _status = s;
  _listeners.forEach(fn => fn(s));
}

export function subscribeKuromoji(fn) {
  _listeners.push(fn);
  fn(_status);
  return () => { _listeners = _listeners.filter(f => f !== fn); };
}

export function getKuromojiStatus() { return _status; }

/**
 * Load kuromoji tokenizer. Resolves with the tokenizer instance, or null on
 * native / error.  Safe to call multiple times — returns cached instance.
 */
export function loadKuromoji() {
  if (Platform.OS !== 'web') return Promise.resolve(null);
  if (_tokenizer) return Promise.resolve(_tokenizer);
  if (_promise)   return _promise;

  setStatus(KUROMOJI_STATUS.LOADING);

  _promise = new Promise((resolve, reject) => {
    // Inject kuromoji as a classic script — no import.meta issues
    const script = document.createElement('script');
    script.src = KUROMOJI_SCRIPT;

    script.onload = () => {
      window.kuromoji
        .builder({ dicPath: DICT_PATH })
        .build((err, tok) => {
          if (err) {
            console.error('[KuromojiService] build error:', err);
            setStatus(KUROMOJI_STATUS.ERROR);
            reject(err);
            return;
          }
          _tokenizer = tok;
          setStatus(KUROMOJI_STATUS.READY);
          resolve(tok);
        });
    };

    script.onerror = (e) => {
      console.error('[KuromojiService] script load error:', e);
      setStatus(KUROMOJI_STATUS.ERROR);
      reject(new Error('kuromoji script failed to load'));
    };

    document.head.appendChild(script);
  });

  return _promise;
}

/** Synchronous tokenize — returns null if tokenizer not ready yet */
export function tokenize(text) {
  if (!_tokenizer || !text) return null;
  return _tokenizer.tokenize(text);
}
