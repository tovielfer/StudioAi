import { AiProvider, GenerationType } from './constants';

/**
 * Single source of truth for what every model supports: which aspect ratios,
 * resolution tiers and quality levels are *honoured* by the underlying
 * provider. The same registry drives:
 *   - the create-form dropdowns (exposed via GET /generations/models),
 *   - attribute normalisation before persisting/pricing a generation,
 *   - per-provider request building (e.g. only send imageSize when supported).
 *
 * Encoding rule for each attribute list (sizes/qualities/resolutions):
 *   - []           -> attribute is NOT honoured by the model. It is stripped to
 *                     null on the backend and no selector is rendered.
 *   - [oneOption]  -> a single fixed honoured value (kept, but no selector).
 *   - [a, b, ...]  -> user-selectable; the selector is rendered.
 *
 * Adding a new size/resolution/quality, model or provider is done here in one
 * place instead of being scattered across the UI, pricing and provider code.
 */

export interface AttrOption {
  id: string;
  label: string;
}

/**
 * Default pricing for a model. The pricing seeder ({@link PricingSeederService})
 * derives the rows in `ai_pricing_rules` from this, insert-if-missing, so adding
 * a model means defining its price here too. Admin edits in the DB are never
 * overwritten.
 *
 * - `baseUsd` always seeds one model-default row (the safety net: any size,
 *   including new ones, falls back to it instead of crashing).
 * - `perSizeQuality` seeds detailed rows for models whose price varies by
 *   size/quality (OpenAI).
 * - `resolutionMultiplier` scales the price per resolution tier; combined with
 *   `perSizeQuality` it multiplies each row, and on its own it seeds
 *   resolution-only rows (Google Pro).
 */
export interface ModelPricing {
  baseUsd: number;
  margin?: number;
  referenceImageUsd?: number;
  creditCostOverride?: number | null;
  perSizeQuality?: Record<string, Record<string, number>>;
  resolutionMultiplier?: Record<string, number>;
  /**
   * Full measured cost table for models whose cost varies by *all three* of
   * size, resolution and quality in a way no uniform multiplier can express
   * (OpenAI gpt-image-2, billed by output tokens). Shape:
   * `size -> resolution -> quality -> baseUsd`. When present it takes precedence
   * over `perSizeQuality`/`resolutionMultiplier` and the seeder emits one row per
   * size×resolution×quality directly from these values.
   */
  perSizeResolutionQuality?: Record<
    string,
    Record<string, Record<string, number>>
  >;
  /**
   * Per-second provider cost (USD) for video models, split by whether native
   * audio is generated. Video is billed by duration, so the sell price is
   * `perSecond * durationSeconds * margin` — see {@link computeVideoSellUsd}.
   */
  videoPerSecondUsd?: { audioOff: number; audioOn: number };
  /**
   * Per-second provider cost (USD) keyed by resolution, for video models whose
   * cost varies materially by resolution (Seedance). Same per-second billing as
   * {@link videoPerSecondUsd}, but the rate is chosen by the selected resolution.
   * Takes precedence over `videoPerSecondUsd` when present.
   */
  videoPerSecondUsdByResolution?: Record<
    string,
    { audioOff: number; audioOn: number }
  >;
}

export interface ModelCapability {
  id: string;
  name: string;
  provider: AiProvider;
  type: GenerationType;
  sizes: AttrOption[];
  qualities: AttrOption[];
  resolutions: AttrOption[];
  pricing: ModelPricing;
  /**
   * Selectable clip durations (seconds) for video models. `[]`/undefined means
   * the model has a single fixed duration and no selector is rendered.
   */
  durations?: AttrOption[];
  /** Whether the model can generate native audio (renders an on/off toggle). */
  supportsAudio?: boolean;
  /**
   * Whether image-to-video accepts an end/tail frame in addition to the start
   * frame. Only some providers/tiers support it (e.g. Kling v3 and v2.1 pro),
   * so the create-form hides the end-frame slot and the provider drops the end
   * image for models where this is falsy.
   */
  supportsEndFrame?: boolean;
}

// Standard aspect ratios honoured by all Google image models
// (gemini-2.5-flash-image and gemini-3-pro-image).
const GOOGLE_SIZES: AttrOption[] = [
  { id: '1:1', label: '1:1 ריבוע' },
  { id: '16:9', label: '16:9 לרוחב' },
  { id: '9:16', label: '9:16 לאורך' },
  { id: '4:3', label: '4:3 סטנדרטי' },
  { id: '3:4', label: '3:4 פורטרט' },
  { id: '3:2', label: '3:2 צילום לרוחב' },
  { id: '2:3', label: '2:3 צילום לאורך' },
  { id: '4:5', label: '4:5 רשתות חברתיות' },
  { id: '5:4', label: '5:4 לרוחב קל' },
  { id: '21:9', label: '21:9 סינמטי' },
];

// Gemini 3.1 Flash Image (Nano Banana 2) additionally supports the extreme
// panoramic / strip ratios. Other Google models reject these.
const GOOGLE_FLASH_2_SIZES: AttrOption[] = [
  ...GOOGLE_SIZES,
  { id: '4:1', label: '4:1 פנורמה רחבה' },
  { id: '8:1', label: '8:1 רצועה רחבה' },
  { id: '1:4', label: '1:4 רצועה לאורך' },
  { id: '1:8', label: '1:8 רצועה צרה לאורך' },
];

const OPENAI_IMAGE_2_SIZES: AttrOption[] = [
  { id: '1:1', label: '1:1 ריבוע' },
  { id: '16:9', label: '16:9 לרוחב' },
  { id: '9:16', label: '9:16 לאורך' },
  { id: '4:3', label: '4:3 סטנדרטי' },
  { id: '3:4', label: '3:4 פורטרט' },
  { id: '3:2', label: '3:2 צילום לרוחב' },
  { id: '2:3', label: '2:3 צילום לאורך' },
  { id: '4:5', label: '4:5 רשתות חברתיות' },
  { id: '5:4', label: '5:4 לרוחב קל' },
  { id: '21:9', label: '21:9 סינמטי' },
  { id: '9:21', label: '9:21 סינמטי לאורך' },
];

const OPENAI_QUALITIES: AttrOption[] = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
  { id: 'auto', label: 'Auto' },
];

const RESOLUTION_TIERS: AttrOption[] = [
  { id: '1K', label: '1K – רגיל' },
  { id: '2K', label: '2K – גבוה' },
  { id: '4K', label: '4K – מקסימלי' },
];

const GOOGLE_FLASH_RESOLUTION_TIERS: AttrOption[] = [
  { id: '512', label: '512 – קטן' },
  ...RESOLUTION_TIERS,
];

// OpenAI gpt-image-1 has a single fixed resolution: it is still sent and priced
// as 1K, so it is encoded as one honoured value (no selector is rendered).
const FIXED_ONE_K: AttrOption[] = [{ id: '1K', label: '1K' }];

// Aspect ratios honoured by Kling video. For image-to-video the ratio is
// derived from the start image and ignored, but for text-to-video it is sent.
const KLING_SIZES: AttrOption[] = [
  { id: '16:9', label: '16:9 לרוחב' },
  { id: '9:16', label: '9:16 לאורך' },
  { id: '1:1', label: '1:1 ריבוע' },
];

// Kling v3 supports any whole number of seconds from 3 to 15.
const KLING_V3_DURATIONS: AttrOption[] = Array.from({ length: 13 }, (_, i) => {
  const sec = i + 3;
  return { id: String(sec), label: `${sec} שניות` };
});

// Kling v2.1 only accepts 5 or 10 seconds.
const KLING_V21_DURATIONS: AttrOption[] = [
  { id: '5', label: '5 שניות' },
  { id: '10', label: '10 שניות' },
];

// Aspect ratios honoured by Seedance (text-to-video). For image-to-video the
// ratio is inferred from the start image and this field is omitted.
const SEEDANCE_SIZES: AttrOption[] = [
  { id: '16:9', label: '16:9 לרוחב' },
  { id: '9:16', label: '9:16 לאורך' },
  { id: '1:1', label: '1:1 ריבוע' },
  { id: '21:9', label: '21:9 סינמטי' },
  { id: '4:3', label: '4:3 סטנדרטי' },
  { id: '3:4', label: '3:4 פורטרט' },
];

// Seedance 2.0 (standard) on Replicate supports the full tier range.
const SEEDANCE_2_RESOLUTIONS: AttrOption[] = [
  { id: '480p', label: '480p – מהיר' },
  { id: '720p', label: '720p – מאוזן' },
  { id: '1080p', label: '1080p – איכותי' },
  { id: '4k', label: '4K – מקסימלי' },
];

// Seedance 2.0 Fast/Mini on Replicate output up to 720p only.
const SEEDANCE_2_LITE_RESOLUTIONS: AttrOption[] = [
  { id: '480p', label: '480p – מהיר' },
  { id: '720p', label: '720p – מאוזן' },
];

// Seedance 2.0 accepts 4 to 15 seconds.
const SEEDANCE_V2_DURATIONS: AttrOption[] = Array.from(
  { length: 12 },
  (_, i) => {
    const sec = i + 4;
    return { id: String(sec), label: `${sec} שניות` };
  },
);

// Seedance 2.0 (standard) per-second provider cost (USD) by resolution, via
// Replicate. Audio is included in the rate, so audioOff and audioOn are equal.
// Shared by the standard text/image model and the reference-to-video model
// (image references only — the ×0.6 video-input discount doesn't apply here).
const SEEDANCE_V2_PER_SECOND: Record<
  string,
  { audioOff: number; audioOn: number }
> = {
  '480p': { audioOff: 0.08, audioOn: 0.08 },
  '720p': { audioOff: 0.18, audioOn: 0.18 },
  '1080p': { audioOff: 0.45, audioOn: 0.45 },
  '4k': { audioOff: 1.25, audioOn: 1.25 },
};

// Default base USD prices, mirroring the seed migrations so a fresh DB
// reproduces today's pricing. Admin edits in the DB take precedence at runtime.
// `auto` is priced the same as `high`: when OpenAI receives quality="auto" it
// routinely renders at high quality, so the measured cost matches `high`
// (~$0.167 at 1:1). Pricing auto as cheap (previously $0.04) sold every auto
// generation well below cost. Worst-case pricing avoids the loss.
const GPT_IMAGE_1_PRICING: ModelPricing = {
  baseUsd: 0.167,
  perSizeQuality: {
    '1:1': { low: 0.011, medium: 0.04, high: 0.167, auto: 0.167 },
    '16:9': { low: 0.016, medium: 0.06, high: 0.25, auto: 0.25 },
    '9:16': { low: 0.016, medium: 0.06, high: 0.25, auto: 0.25 },
  },
};

// Measured OpenAI gpt-image-2 output cost (USD) per aspect ratio × resolution ×
// quality. gpt-image-2 is billed by output tokens, so — unlike Google — the
// aspect ratio materially changes cost: narrow ratios (21:9/9:21) are far
// cheaper than the square. Each number was measured directly from real
// generations (output_tokens × $30/1M) and matches the official 1:1 1K figures
// (low $0.006 / medium $0.053 / high $0.211).
//
// This replaces the previous flat base × uniform 4K=×4 estimate, which ignored
// aspect ratio and badly over-charged narrow ratios (e.g. 9:21 4K high really
// costs $0.2459 but was sold as $0.844 ⇒ 625 credits). margin and the
// credit conversion still apply on top (see ai-pricing.service.ts).
//
// `auto` is priced the same as `high`: OpenAI renders quality="auto" at high
// quality, so pricing it cheaper would sell auto generations below cost.
type GptQualityCost = { low: number; medium: number; high: number };

const gpt2ResTable = (
  oneK: GptQualityCost,
  twoK: GptQualityCost,
  fourK: GptQualityCost,
): Record<string, Record<string, number>> => {
  const withAuto = (c: GptQualityCost) => ({
    low: c.low,
    medium: c.medium,
    high: c.high,
    auto: c.high,
  });
  return { '1K': withAuto(oneK), '2K': withAuto(twoK), '4K': withAuto(fourK) };
};

// Paired ratios (e.g. 16:9 / 9:16) share the same pixel count ⇒ same cost.
const GPT2_COST_SQUARE = gpt2ResTable(
  { low: 0.0059, medium: 0.0527, high: 0.2107 },
  { low: 0.0119, medium: 0.107, high: 0.4283 },
  { low: 0.0198, medium: 0.1779, high: 0.7117 },
);
const GPT2_COST_16_9 = gpt2ResTable(
  // 1K/2K medium measured directly ($0.0285 / $0.0426); low & high derived via
  // the quality rule (low = medium/9, high = medium×4). This corrects the old
  // anomaly where 1K and 2K were near-identical (2K low was even cheaper).
  { low: 0.00317, medium: 0.0285, high: 0.114 },
  { low: 0.00473, medium: 0.0426, high: 0.1704 },
  { low: 0.0111, medium: 0.1001, high: 0.4003 },
);
const GPT2_COST_4_3 = gpt2ResTable(
  { low: 0.004, medium: 0.0362, high: 0.1447 },
  { low: 0.0074, medium: 0.0667, high: 0.2668 },
  { low: 0.0144, medium: 0.1296, high: 0.5184 },
);
const GPT2_COST_3_2 = gpt2ResTable(
  { low: 0.0039, medium: 0.0354, high: 0.1415 },
  { low: 0.0063, medium: 0.057, high: 0.2279 },
  { low: 0.0136, medium: 0.1223, high: 0.4892 },
);
const GPT2_COST_4_5 = gpt2ResTable(
  { low: 0.0047, medium: 0.0424, high: 0.1696 },
  { low: 0.0081, medium: 0.0732, high: 0.2927 },
  { low: 0.0159, medium: 0.1431, high: 0.5724 },
);
const GPT2_COST_21_9 = gpt2ResTable(
  { low: 0.0023, medium: 0.0205, high: 0.0819 },
  { low: 0.0032, medium: 0.0289, high: 0.1156 },
  { low: 0.0068, medium: 0.0615, high: 0.2459 },
);

const GPT_IMAGE_2_PRICING: ModelPricing = {
  // Safety-net default for any unmeasured size (1:1 1K high).
  baseUsd: 0.2107,
  perSizeResolutionQuality: {
    '1:1': GPT2_COST_SQUARE,
    '16:9': GPT2_COST_16_9,
    '9:16': GPT2_COST_16_9,
    '4:3': GPT2_COST_4_3,
    '3:4': GPT2_COST_4_3,
    '3:2': GPT2_COST_3_2,
    '2:3': GPT2_COST_3_2,
    '4:5': GPT2_COST_4_5,
    '5:4': GPT2_COST_4_5,
    '21:9': GPT2_COST_21_9,
    '9:21': GPT2_COST_21_9,
  },
};

export const MODEL_REGISTRY: ModelCapability[] = [
  {
    id: 'gpt-image-2',
    name: 'gpt 2',
    provider: AiProvider.OPENAI,
    type: GenerationType.IMAGE,
    sizes: OPENAI_IMAGE_2_SIZES,
    qualities: OPENAI_QUALITIES,
    resolutions: RESOLUTION_TIERS,
    pricing: GPT_IMAGE_2_PRICING,
  },
  {
    id: 'gemini-3.1-flash-image',
    name: 'Nano Banana 2',
    provider: AiProvider.GOOGLE,
    type: GenerationType.IMAGE,
    sizes: GOOGLE_FLASH_2_SIZES,
    qualities: [],
    resolutions: GOOGLE_FLASH_RESOLUTION_TIERS,
    // Priced by resolution (Google charges more for 2K/4K). Previously flat,
    // which sold 2K/4K below cost ($0.101 / $0.151 charged as $0.067).
    pricing: {
      baseUsd: 0.0672,
      resolutionMultiplier: { '512': 0.67, '1K': 1, '2K': 1.5, '4K': 2.25 },
    },
  },
  {
    id: 'gemini-3-pro-image',
    name: 'Nano Banana Pro',
    provider: AiProvider.GOOGLE,
    type: GenerationType.IMAGE,
    sizes: GOOGLE_SIZES,
    // Google ignores quality entirely.
    qualities: [],
    resolutions: RESOLUTION_TIERS,
    // Priced by resolution only (Google ignores size/quality).
    pricing: {
      baseUsd: 0.134,
      resolutionMultiplier: { '1K': 1, '2K': 1, '4K': 1.79 },
    },
  },
  {
    id: 'gpt-image-1',
    name: 'gpt 1',
    provider: AiProvider.OPENAI,
    type: GenerationType.IMAGE,
    sizes: [
      { id: '1:1', label: '1024×1024 (ריבוע)' },
      { id: '16:9', label: '1536×1024 (לרוחב)' },
      { id: '9:16', label: '1024×1536 (לאורך)' },
    ],
    qualities: OPENAI_QUALITIES,
    resolutions: FIXED_ONE_K,
    pricing: GPT_IMAGE_1_PRICING,
  },
  {
    id: 'gemini-2.5-flash-image',
    name: 'Nano Banana',
    provider: AiProvider.GOOGLE,
    type: GenerationType.IMAGE,
    sizes: GOOGLE_SIZES,
    qualities: [],
    resolutions: [],
    pricing: { baseUsd: 0.039 },
  },
  {
    id: 'seedance-v2',
    name: 'Seedance 2.0',
    provider: AiProvider.REPLICATE,
    type: GenerationType.VIDEO,
    sizes: SEEDANCE_SIZES,
    qualities: [],
    resolutions: SEEDANCE_2_RESOLUTIONS,
    durations: SEEDANCE_V2_DURATIONS,
    // Seedance 2.0 generates synchronised audio; Replicate includes it in the
    // per-second rate, so audioOff and audioOn are equal.
    supportsAudio: true,
    // Replicate per-second rates (verified from the model page). Rates use the
    // text-to-video base; the 2.0× sell margin covers the slightly higher
    // image/video-input rate. ~40% cheaper than the previous fal route.
    pricing: {
      baseUsd: 0,
      referenceImageUsd: 0,
      videoPerSecondUsdByResolution: SEEDANCE_V2_PER_SECOND,
    },
  },
  {
    id: 'seedance-v2-fast',
    name: 'Seedance 2.0 Fast',
    provider: AiProvider.REPLICATE,
    type: GenerationType.VIDEO,
    sizes: SEEDANCE_SIZES,
    qualities: [],
    resolutions: SEEDANCE_2_LITE_RESOLUTIONS,
    durations: SEEDANCE_V2_DURATIONS,
    supportsAudio: true,
    // Faster mid-tier variant; up to 720p. Replicate verified rates.
    pricing: {
      baseUsd: 0,
      referenceImageUsd: 0,
      videoPerSecondUsdByResolution: {
        '480p': { audioOff: 0.07, audioOn: 0.07 },
        '720p': { audioOff: 0.15, audioOn: 0.15 },
      },
    },
  },
  {
    id: 'seedance-v2-mini',
    name: 'Seedance 2.0 Mini',
    provider: AiProvider.REPLICATE,
    type: GenerationType.VIDEO,
    sizes: SEEDANCE_SIZES,
    qualities: [],
    resolutions: SEEDANCE_2_LITE_RESOLUTIONS,
    durations: SEEDANCE_V2_DURATIONS,
    supportsAudio: true,
    // Lowest-cost variant (~half of standard); up to 720p. Replicate verified rates.
    pricing: {
      baseUsd: 0,
      referenceImageUsd: 0,
      videoPerSecondUsdByResolution: {
        '480p': { audioOff: 0.04, audioOn: 0.04 },
        '720p': { audioOff: 0.09, audioOn: 0.09 },
      },
    },
  },
  {
    id: 'kling-v3-standard',
    name: 'Kling Video v3 Standard',
    provider: AiProvider.FAL,
    type: GenerationType.VIDEO,
    sizes: KLING_SIZES,
    qualities: [],
    resolutions: [],
    durations: KLING_V3_DURATIONS,
    supportsAudio: true,
    supportsEndFrame: true,
    // Video is billed per second (see computeVideoSellUsd). fal cost: $0.084/s
    // silent, $0.126/s with audio. baseUsd is only the safety-net seed row.
    pricing: {
      baseUsd: 0,
      referenceImageUsd: 0,
      videoPerSecondUsd: { audioOff: 0.084, audioOn: 0.126 },
    },
  },
  {
    id: 'kling-v3-pro',
    name: 'Kling Video v3 Pro',
    provider: AiProvider.FAL,
    type: GenerationType.VIDEO,
    sizes: KLING_SIZES,
    qualities: [],
    resolutions: [],
    durations: KLING_V3_DURATIONS,
    supportsAudio: true,
    supportsEndFrame: true,
    // fal cost: $0.112/s silent, $0.168/s with audio.
    pricing: {
      baseUsd: 0,
      referenceImageUsd: 0,
      videoPerSecondUsd: { audioOff: 0.112, audioOn: 0.168 },
    },
  },
  {
    id: 'kling-v2.1-master',
    name: 'Kling Video v2.1 Master',
    provider: AiProvider.FAL,
    type: GenerationType.VIDEO,
    sizes: KLING_SIZES,
    qualities: [],
    resolutions: [],
    durations: KLING_V21_DURATIONS,
    supportsAudio: false,
    // fal cost: flat $0.28/s (no audio option on v2.1).
    pricing: {
      baseUsd: 0,
      referenceImageUsd: 0,
      videoPerSecondUsd: { audioOff: 0.28, audioOn: 0.28 },
    },
  },
  {
    id: 'kling-v2.1-pro',
    name: 'Kling Video v2.1 Pro',
    provider: AiProvider.FAL,
    type: GenerationType.VIDEO,
    sizes: KLING_SIZES,
    qualities: [],
    resolutions: [],
    durations: KLING_V21_DURATIONS,
    supportsAudio: false,
    // v2.1 pro is the only v2.1 tier that accepts an end/tail frame on fal.
    supportsEndFrame: true,
    // fal cost: flat $0.09/s. Image-to-video only (requires a start image).
    pricing: {
      baseUsd: 0,
      referenceImageUsd: 0,
      videoPerSecondUsd: { audioOff: 0.09, audioOn: 0.09 },
    },
  },
  {
    id: 'kling-v2.1-standard',
    name: 'Kling Video v2.1 Standard',
    provider: AiProvider.FAL,
    type: GenerationType.VIDEO,
    sizes: KLING_SIZES,
    qualities: [],
    resolutions: [],
    durations: KLING_V21_DURATIONS,
    supportsAudio: false,
    // fal cost: flat $0.05/s. Image-to-video only (requires a start image).
    pricing: {
      baseUsd: 0,
      referenceImageUsd: 0,
      videoPerSecondUsd: { audioOff: 0.05, audioOn: 0.05 },
    },
  },
  {
    id: 'seedance-v2-ref',
    name: 'Seedance 2.0 — ייחוס',
    provider: AiProvider.REPLICATE,
    type: GenerationType.VIDEO,
    sizes: SEEDANCE_SIZES,
    qualities: [],
    resolutions: SEEDANCE_2_RESOLUTIONS,
    durations: SEEDANCE_V2_DURATIONS,
    supportsAudio: true,
    // Reference-to-video via Replicate's bytedance/seedance-2.0 with up to 9
    // reference images (referenced in the prompt as [Image1]…). Images-only, so
    // it's billed identically to the standard model (no video-input discount).
    pricing: {
      baseUsd: 0,
      referenceImageUsd: 0,
      videoPerSecondUsdByResolution: SEEDANCE_V2_PER_SECOND,
    },
  },
];

export function getModelCapability(
  modelId?: string | null,
): ModelCapability | undefined {
  if (!modelId) return undefined;
  return MODEL_REGISTRY.find((m) => m.id === modelId);
}

/** Whether the model honours the 1K/2K/4K resolution tiers (selectable). */
export function modelSupportsResolution(modelId?: string | null): boolean {
  return (getModelCapability(modelId)?.resolutions.length ?? 0) > 1;
}

export interface NormalizedGenerationAttrs {
  quality: string | null;
  resolution: string | null;
}

/**
 * Picks the value that should actually be persisted/priced for an attribute,
 * based on what the model honours:
 *   - empty option list  -> null (provider ignores it)
 *   - value in the list   -> the value as-is
 *   - value not in list   -> the model's single fixed/default honoured value
 */
function pickAttr(options: AttrOption[], value: string | null | undefined): string | null {
  if (options.length === 0) return null;
  if (value != null && options.some((o) => o.id === value)) return value;
  return options[0].id;
}

/**
 * Returns the quality/resolution that should be persisted and priced for a
 * generation, after stripping parameters the model does not honour. Driven
 * entirely by {@link MODEL_REGISTRY} (no per-provider special-casing).
 *
 * Unknown models pass through unchanged, matching the previous behaviour for
 * providers that honour every attribute.
 */
export function normalizeAttrs(
  modelId: string | null | undefined,
  quality: string | null | undefined,
  resolution: string | null | undefined,
): NormalizedGenerationAttrs {
  const capability = getModelCapability(modelId);
  if (!capability) {
    return {
      quality: quality ?? null,
      resolution: resolution ?? null,
    };
  }

  return {
    quality: pickAttr(capability.qualities, quality),
    resolution: pickAttr(capability.resolutions, resolution),
  };
}

/**
 * Clamps a requested clip duration to a value the model actually supports.
 * Falls back to the model's first listed duration (or 5s) when unset/invalid,
 * so the provider never receives a duration the endpoint would reject.
 */
export function normalizeVideoDuration(
  modelId: string | null | undefined,
  durationSeconds: number | null | undefined,
): number {
  const allowed =
    getModelCapability(modelId)?.durations?.map((d) => Number(d.id)) ?? [];
  if (allowed.length === 0) return durationSeconds ?? 5;
  if (durationSeconds != null && allowed.includes(durationSeconds)) {
    return durationSeconds;
  }
  return allowed[0];
}

/** Whether the model has native-audio support (renders/sends the audio flag). */
export function modelSupportsAudio(modelId?: string | null): boolean {
  return Boolean(getModelCapability(modelId)?.supportsAudio);
}

/** Whether image-to-video accepts an end/tail frame in addition to the start. */
export function modelSupportsEndFrame(modelId?: string | null): boolean {
  return Boolean(getModelCapability(modelId)?.supportsEndFrame);
}

/**
 * Resolves the per-second audio-on/audio-off rates for a video model, honouring
 * resolution-keyed pricing (Seedance) when present and falling back to the flat
 * per-second rate (Kling). Returns `null` for models without per-second pricing.
 */
function resolveVideoRates(
  capability: ModelCapability | undefined,
  resolution: string | null | undefined,
): { audioOff: number; audioOn: number } | null {
  const pricing = capability?.pricing;
  if (!pricing) return null;
  const byResolution = pricing.videoPerSecondUsdByResolution;
  if (byResolution) {
    return (
      (resolution ? byResolution[resolution] : undefined) ??
      Object.values(byResolution)[0] ??
      null
    );
  }
  return pricing.videoPerSecondUsd ?? null;
}

/** Whether a model is priced per second of video (vs the rule table). */
export function modelHasVideoPricing(modelId?: string | null): boolean {
  const pricing = getModelCapability(modelId)?.pricing;
  return Boolean(
    pricing?.videoPerSecondUsd || pricing?.videoPerSecondUsdByResolution,
  );
}

/**
 * Sell price (USD) for a video generation: per-second provider cost × duration
 * × margin. The per-second rate may vary by resolution (Seedance). Audio is
 * only billed at the higher rate when the model supports it.
 * Returns `null` for non-video models, which price via the rule table instead.
 */
export function computeVideoSellUsd(
  modelId: string | null | undefined,
  durationSeconds: number,
  generateAudio: boolean,
  margin: number,
  resolution?: string | null,
): number | null {
  const capability = getModelCapability(modelId);
  const rates = resolveVideoRates(capability, resolution);
  if (!rates) return null;
  const audio = generateAudio && Boolean(capability?.supportsAudio);
  const perSecond = audio ? rates.audioOn : rates.audioOff;
  return perSecond * durationSeconds * margin;
}
