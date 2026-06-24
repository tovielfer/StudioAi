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
    id: 'kling-v3-standard',
    name: 'Kling Video v3 Standard',
    provider: AiProvider.FAL,
    type: GenerationType.VIDEO,
    sizes: [
      { id: '16:9', label: '16:9 לרוחב' },
      { id: '9:16', label: '9:16 לאורך' },
      { id: '1:1', label: '1:1 ריבוע' },
    ],
    qualities: [],
    resolutions: [],
    // Flat credit cost (margin/baseUsd unused). Rescaled to the new credit unit
    // (credit = ILS 0.01): 185 credits = ILS 1.85, matching the previous
    // ~$0.50 sell price.
    pricing: {
      baseUsd: 0,
      margin: 1,
      referenceImageUsd: 0,
      creditCostOverride: 185,
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
