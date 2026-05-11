export interface Pricing {
  inputPerMTok: number;
  outputPerMTok: number;
  cacheReadPerMTok: number;
  cacheCreationPerMTok: number;
}

const PRICING_TABLE: Record<string, Pricing> = {
  "claude-opus-4-7": { inputPerMTok: 15, outputPerMTok: 75, cacheReadPerMTok: 1.5, cacheCreationPerMTok: 18.75 },
  "claude-opus-4-6": { inputPerMTok: 15, outputPerMTok: 75, cacheReadPerMTok: 1.5, cacheCreationPerMTok: 18.75 },
  "claude-sonnet-4-6": { inputPerMTok: 3, outputPerMTok: 15, cacheReadPerMTok: 0.3, cacheCreationPerMTok: 3.75 },
  "claude-sonnet-4-5": { inputPerMTok: 3, outputPerMTok: 15, cacheReadPerMTok: 0.3, cacheCreationPerMTok: 3.75 },
  "claude-haiku-4-5": { inputPerMTok: 1, outputPerMTok: 5, cacheReadPerMTok: 0.1, cacheCreationPerMTok: 1.25 },
  default: { inputPerMTok: 3, outputPerMTok: 15, cacheReadPerMTok: 0.3, cacheCreationPerMTok: 3.75 },
};

function priceFor(model: string | null | undefined): Pricing {
  if (!model) return PRICING_TABLE.default;
  const lower = model.toLowerCase();
  for (const key of Object.keys(PRICING_TABLE)) {
    if (lower.includes(key)) return PRICING_TABLE[key];
  }
  if (lower.includes("opus")) return PRICING_TABLE["claude-opus-4-7"];
  if (lower.includes("haiku")) return PRICING_TABLE["claude-haiku-4-5"];
  if (lower.includes("sonnet")) return PRICING_TABLE["claude-sonnet-4-6"];
  return PRICING_TABLE.default;
}

export function calcCost(args: {
  model: string | null | undefined;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}): number {
  const p = priceFor(args.model);
  const cost =
    (args.inputTokens / 1_000_000) * p.inputPerMTok +
    (args.outputTokens / 1_000_000) * p.outputPerMTok +
    (args.cacheReadTokens / 1_000_000) * p.cacheReadPerMTok +
    (args.cacheCreationTokens / 1_000_000) * p.cacheCreationPerMTok;
  return Math.round(cost * 100000) / 100000;
}

export function getContextLimit(model: string | null | undefined): number {
  if (!model) return 200_000;
  const lower = model.toLowerCase();
  if (lower.includes("[1m]") || lower.includes("1m")) return 1_000_000;
  return 200_000;
}
