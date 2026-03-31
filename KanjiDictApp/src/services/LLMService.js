/**
 * LLMService — Qwen2.5-0.5B-Instruct via @xenova/transformers
 *
 * Runs entirely in-browser (WebAssembly backend).
 * On mobile browsers the model is downloaded once (~380 MB INT8 quantised)
 * and cached in IndexedDB — subsequent loads are instant.
 *
 * Primary capability used here: context-aware furigana generation.
 * Qwen2.5 understands compound readings (e.g. 今日→きょう, not にち+ひ)
 * which dictionary lookup cannot handle.
 */

import { Platform } from 'react-native';

// Status values exported for UI display
export const LLM_STATUS = {
  IDLE:    'idle',
  LOADING: 'loading',
  READY:   'ready',
  ERROR:   'error',
};

let _pipe    = null;
let _status  = LLM_STATUS.IDLE;
let _listeners = [];

function notify(status, progress) {
  _status = status;
  _listeners.forEach(fn => fn(status, progress));
}

/** Subscribe to status / progress updates */
export function subscribeLLM(fn) {
  _listeners.push(fn);
  fn(_status, 0); // fire immediately with current state
  return () => { _listeners = _listeners.filter(f => f !== fn); };
}

/** Load the model if not already loaded. Resolves when ready. */
export async function loadLLM(onProgress) {
  if (_pipe) return _pipe;
  if (_status === LLM_STATUS.LOADING) {
    // Already in flight — wait for it
    return new Promise((resolve, reject) => {
      const unsub = subscribeLLM((s) => {
        if (s === LLM_STATUS.READY)  { unsub(); resolve(_pipe); }
        if (s === LLM_STATUS.ERROR)  { unsub(); reject(new Error('LLM load failed')); }
      });
    });
  }

  if (Platform.OS !== 'web') {
    // On native, skip the web-based model — furigana falls back to DB lookup
    return null;
  }

  notify(LLM_STATUS.LOADING, 0);
  try {
    const { pipeline, env } = await import('@xenova/transformers');

    // Always fetch from HuggingFace Hub (caches in IndexedDB after first download)
    env.allowLocalModels  = false;
    env.useBrowserCache   = true;

    _pipe = await pipeline(
      'text-generation',
      'Xenova/Qwen2.5-0.5B-Instruct',
      {
        quantized: true,           // INT8 — ~380 MB, runs on mid-range phones
        progress_callback: (p) => {
          if (p.status === 'progress') {
            const pct = Math.round((p.loaded / p.total) * 100) || 0;
            notify(LLM_STATUS.LOADING, pct);
            onProgress?.(pct);
          }
        },
      }
    );

    notify(LLM_STATUS.READY, 100);
    return _pipe;
  } catch (err) {
    console.error('[LLMService] load error:', err);
    notify(LLM_STATUS.ERROR, 0);
    return null;
  }
}

/**
 * Generate furigana for a Japanese sentence.
 *
 * Returns the input text with HTML <ruby>/<rt> tags inserted by the model,
 * or null if the model is unavailable.
 *
 * Example output:
 *   "<ruby>今日<rt>きょう</rt></ruby>は<ruby>天気<rt>てんき</rt></ruby>がいいです。"
 */
export async function generateFurigana(text, onProgress) {
  if (!text?.trim() || Platform.OS !== 'web') return null;

  let pipe = _pipe;
  if (!pipe) {
    pipe = await loadLLM(onProgress);
    if (!pipe) return null;
  }

  const messages = [
    {
      role: 'system',
      content:
        'You are a Japanese furigana assistant. ' +
        'Add hiragana readings to EVERY kanji (including compounds) using HTML ruby tags: ' +
        '<ruby>漢字<rt>reading</rt></ruby>. ' +
        'Keep kana, punctuation, and Latin characters exactly as-is. ' +
        'Return ONLY the annotated text — no explanations, no extra words.',
    },
    {
      // One-shot example so the tiny model learns the exact format
      role: 'user',
      content: '今日は天気がとても良いです。',
    },
    {
      role: 'assistant',
      content:
        '<ruby>今日<rt>きょう</rt></ruby>は' +
        '<ruby>天気<rt>てんき</rt></ruby>がとても' +
        '<ruby>良<rt>よ</rt></ruby>いです。',
    },
    {
      role: 'user',
      content: text,
    },
  ];

  try {
    const out = await pipe(messages, {
      max_new_tokens: Math.min(text.length * 8, 512),
      do_sample:      false,
      temperature:    0.1,
      repetition_penalty: 1.1,
    });

    // The generated text is the last message in the thread
    const generated = out[0]?.generated_text;
    if (!generated) return null;

    // Extract the assistant reply (last item if it's an array of messages)
    const reply = Array.isArray(generated)
      ? generated[generated.length - 1]?.content
      : String(generated);

    // Basic sanity: reply must contain at least one ruby tag
    return reply?.includes('<ruby>') ? reply.trim() : null;
  } catch (err) {
    console.error('[LLMService] generate error:', err);
    return null;
  }
}

export function getLLMStatus() { return _status; }
