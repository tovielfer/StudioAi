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

// Google models support a wider aspect-ratio set. This practical set is offered
// across all Google image models.
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

// Nano Banana 2 (3.1 Flash) and Nano Banana Pro additionally support the
// cinematic vertical ratio.
const GOOGLE_EXTENDED_SIZES: AttrOption[] = [
  ...GOOGLE_SIZES,
  { id: '9:21', label: '9:21 סינמטי לאורך' },
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
  { id: 'auto', label: 'Auto – ברירת מחדל' },
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
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
const GPT_IMAGE_1_PRICING: ModelPricing = {
  baseUsd: 0.04,
  perSizeQuality: {
    '1:1': { low: 0.011, medium: 0.04, high: 0.167, auto: 0.04 },
    '16:9': { low: 0.016, medium: 0.06, high: 0.25, auto: 0.06 },
    '9:16': { low: 0.016, medium: 0.06, high: 0.25, auto: 0.06 },
  },
};

const GPT_IMAGE_2_PRICING: ModelPricing = {
  baseUsd: 0.05,
  perSizeQuality: Object.fromEntries(
    OPENAI_IMAGE_2_SIZES.map((size) => [
      size.id,
      { low: 0.015, medium: 0.05, high: 0.22, auto: 0.05 },
    ]),
  ) as Record<string, Record<string, number>>,
  resolutionMultiplier: { '1K': 1, '2K': 4, '4K': 8 },
};

export const MODEL_REGISTRY: ModelCapability[] = [
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
    id: 'gemini-3-pro-image',
    name: 'Nano Banana Pro',
    provider: AiProvider.GOOGLE,
    type: GenerationType.IMAGE,
    sizes: GOOGLE_EXTENDED_SIZES,
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
    id: 'gemini-3.1-flash-image',
    name: 'Nano Banana 2',
    provider: AiProvider.GOOGLE,
    type: GenerationType.IMAGE,
    sizes: GOOGLE_EXTENDED_SIZES,
    qualities: [],
    resolutions: GOOGLE_FLASH_RESOLUTION_TIERS,
    // Flat price regardless of size/resolution.
    pricing: { baseUsd: 0.0672 },
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
    // Flat credit cost (margin/baseUsd unused).
    pricing: {
      baseUsd: 0,
      margin: 1,
      referenceImageUsd: 0,
      creditCostOverride: 50,
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
