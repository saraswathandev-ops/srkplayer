/**
 * BCP-47 language code → human-readable name (English + native script).
 *
 * Why a built-in map rather than `Intl.DisplayNames`:
 *   - Hermes ships ICU only on Android API 24+ AND with the intl variant
 *     enabled. Many low-end devices we target (Android 9–10 on MediaTek)
 *     hit `ReferenceError: Intl.DisplayNames is not defined`.
 *   - We only need ~40 codes for the audio-language picker; a static map
 *     is faster, deterministic, and lets us localise the *native* name too
 *     ("Tamil · தமிழ்") which Intl.DisplayNames cannot produce.
 */

export interface LanguageName {
  /** English name, e.g. "Tamil". */
  english: string;
  /** Native autonym, e.g. "தமிழ்". Empty when not different from English. */
  native: string;
}

// Two-letter ISO 639-1 → name. Lowercase keys.
const NAMES: Record<string, LanguageName> = {
  // ── Indic
  hi: { english: 'Hindi', native: 'हिन्दी' },
  ta: { english: 'Tamil', native: 'தமிழ்' },
  te: { english: 'Telugu', native: 'తెలుగు' },
  ml: { english: 'Malayalam', native: 'മലയാളം' },
  kn: { english: 'Kannada', native: 'ಕನ್ನಡ' },
  bn: { english: 'Bengali', native: 'বাংলা' },
  mr: { english: 'Marathi', native: 'मराठी' },
  gu: { english: 'Gujarati', native: 'ગુજરાતી' },
  pa: { english: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  ur: { english: 'Urdu', native: 'اُردُو' },
  or: { english: 'Odia', native: 'ଓଡ଼ିଆ' },
  as: { english: 'Assamese', native: 'অসমীয়া' },
  ne: { english: 'Nepali', native: 'नेपाली' },
  si: { english: 'Sinhala', native: 'සිංහල' },
  sd: { english: 'Sindhi', native: 'سنڌي' },
  sa: { english: 'Sanskrit', native: 'संस्कृतम्' },

  // ── Major world languages
  en: { english: 'English', native: '' },
  es: { english: 'Spanish', native: 'Español' },
  fr: { english: 'French', native: 'Français' },
  de: { english: 'German', native: 'Deutsch' },
  it: { english: 'Italian', native: 'Italiano' },
  pt: { english: 'Portuguese', native: 'Português' },
  ru: { english: 'Russian', native: 'Русский' },
  nl: { english: 'Dutch', native: 'Nederlands' },
  pl: { english: 'Polish', native: 'Polski' },
  tr: { english: 'Turkish', native: 'Türkçe' },
  ar: { english: 'Arabic', native: 'العربية' },
  fa: { english: 'Persian', native: 'فارسی' },
  he: { english: 'Hebrew', native: 'עברית' },
  el: { english: 'Greek', native: 'Ελληνικά' },
  sv: { english: 'Swedish', native: 'Svenska' },
  no: { english: 'Norwegian', native: 'Norsk' },
  da: { english: 'Danish', native: 'Dansk' },
  fi: { english: 'Finnish', native: 'Suomi' },
  cs: { english: 'Czech', native: 'Čeština' },
  hu: { english: 'Hungarian', native: 'Magyar' },
  ro: { english: 'Romanian', native: 'Română' },
  uk: { english: 'Ukrainian', native: 'Українська' },

  // ── East / South-East Asia
  zh: { english: 'Chinese', native: '中文' },
  ja: { english: 'Japanese', native: '日本語' },
  ko: { english: 'Korean', native: '한국어' },
  th: { english: 'Thai', native: 'ไทย' },
  vi: { english: 'Vietnamese', native: 'Tiếng Việt' },
  id: { english: 'Indonesian', native: 'Bahasa Indonesia' },
  ms: { english: 'Malay', native: 'Bahasa Melayu' },
  tl: { english: 'Filipino', native: 'Filipino' },
  my: { english: 'Burmese', native: 'မြန်မာ' },
  km: { english: 'Khmer', native: 'ខ្មែរ' },

  // ── Africa
  sw: { english: 'Swahili', native: 'Kiswahili' },
  am: { english: 'Amharic', native: 'አማርኛ' },
  yo: { english: 'Yoruba', native: 'Yorùbá' },
  ha: { english: 'Hausa', native: 'Hausa' },
  zu: { english: 'Zulu', native: 'isiZulu' },

  // ── Misc audio-stream sentinels seen in MKV files
  und: { english: 'Unknown', native: '' },
  mis: { english: 'Other', native: '' },
  zxx: { english: 'No linguistic content', native: '' },
  mul: { english: 'Multiple languages', native: '' },
};

// Three-letter ISO 639-2/B (bibliographic) and ISO 639-3 fall-backs commonly
// seen in MKV / FFmpeg-muxed files. Mapped to their 639-1 equivalent.
const ALIASES: Record<string, string> = {
  // Indic
  tam: 'ta', tel: 'te', mal: 'ml', kan: 'kn', ben: 'bn', mar: 'mr',
  guj: 'gu', pan: 'pa', urd: 'ur', hin: 'hi', ori: 'or', ory: 'or',
  asm: 'as', nep: 'ne', sin: 'si', snd: 'sd', san: 'sa',
  // Major
  eng: 'en', spa: 'es', fre: 'fr', fra: 'fr', ger: 'de', deu: 'de',
  ita: 'it', por: 'pt', rus: 'ru', dut: 'nl', nld: 'nl', pol: 'pl',
  tur: 'tr', ara: 'ar', per: 'fa', fas: 'fa', heb: 'he', gre: 'el',
  ell: 'el', swe: 'sv', nor: 'no', dan: 'da', fin: 'fi', cze: 'cs',
  ces: 'cs', hun: 'hu', rum: 'ro', ron: 'ro', ukr: 'uk',
  // Asia
  chi: 'zh', zho: 'zh', jpn: 'ja', kor: 'ko', tha: 'th', vie: 'vi',
  ind: 'id', may: 'ms', msa: 'ms', fil: 'tl', tgl: 'tl', bur: 'my',
  mya: 'my', khm: 'km',
  // Africa
  swa: 'sw', amh: 'am', yor: 'yo', hau: 'ha', zul: 'zu',
};

/**
 * Resolve a raw track language string to a normalised lowercase 2-letter code.
 * Handles `en-US`, `zh-Hans`, `tam`, etc.
 */
function normalise(code?: string | null): string | null {
  if (!code) return null;
  const raw = code.trim().toLowerCase();
  if (!raw) return null;
  // Strip region / script subtags: "en-US" → "en", "zh-Hans-CN" → "zh".
  const base = raw.split(/[-_]/)[0];
  if (NAMES[base]) return base;
  if (ALIASES[base]) return ALIASES[base];
  if (NAMES[raw]) return raw;
  if (ALIASES[raw]) return ALIASES[raw];
  return null;
}

/**
 * Public API. Always returns *something* — falls back to uppercased code for
 * unknown languages so the UI can still show a discriminator.
 */
export function getLanguageName(code?: string | null): LanguageName {
  const norm = normalise(code);
  if (norm && NAMES[norm]) return NAMES[norm];
  // Unknown — try Intl.DisplayNames if available, otherwise uppercase the
  // raw code so users still see "DEF" instead of nothing.
  if (code) {
    try {
      const Intl: any = (globalThis as any).Intl;
      if (Intl?.DisplayNames) {
        const display = new Intl.DisplayNames(['en'], { type: 'language' });
        const out = display.of(code);
        if (out && out !== code) {
          return { english: out, native: '' };
        }
      }
    } catch {
      /* ignore — engine without Intl.DisplayNames */
    }
    return { english: code.toUpperCase(), native: '' };
  }
  return { english: 'Unknown', native: '' };
}

/**
 * Format a track's language for compact display:
 *   "Tamil · தமிழ்"  if both available
 *   "Tamil"          if only english
 *   "und"            fallback
 */
export function formatLanguageLabel(code?: string | null): string {
  const { english, native } = getLanguageName(code);
  if (english && native && english !== native) return `${english} · ${native}`;
  return english || (code ?? 'Unknown');
}
