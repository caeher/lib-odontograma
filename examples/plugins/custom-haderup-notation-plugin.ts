import { createPlugin } from "@odontogram/core";

const HADERUP_MAP: Record<string, { symbol: string; accessible: string }> = {
  // Permanent Upper Right (Quadrant 1): 1+ .. 8+
  "18": { symbol: "8+", accessible: "Haderup Upper Right 8" },
  "17": { symbol: "7+", accessible: "Haderup Upper Right 7" },
  "16": { symbol: "6+", accessible: "Haderup Upper Right 6" },
  "15": { symbol: "5+", accessible: "Haderup Upper Right 5" },
  "14": { symbol: "4+", accessible: "Haderup Upper Right 4" },
  "13": { symbol: "3+", accessible: "Haderup Upper Right 3" },
  "12": { symbol: "2+", accessible: "Haderup Upper Right 2" },
  "11": { symbol: "1+", accessible: "Haderup Upper Right 1" },

  // Permanent Upper Left (Quadrant 2): +1 .. +8
  "21": { symbol: "+1", accessible: "Haderup Upper Left 1" },
  "22": { symbol: "+2", accessible: "Haderup Upper Left 2" },
  "23": { symbol: "+3", accessible: "Haderup Upper Left 3" },
  "24": { symbol: "+4", accessible: "Haderup Upper Left 4" },
  "25": { symbol: "+5", accessible: "Haderup Upper Left 5" },
  "26": { symbol: "+6", accessible: "Haderup Upper Left 6" },
  "27": { symbol: "+7", accessible: "Haderup Upper Left 7" },
  "28": { symbol: "+8", accessible: "Haderup Upper Left 8" },

  // Permanent Lower Left (Quadrant 3): -1 .. -8
  "31": { symbol: "-1", accessible: "Haderup Lower Left 1" },
  "32": { symbol: "-2", accessible: "Haderup Lower Left 2" },
  "33": { symbol: "-3", accessible: "Haderup Lower Left 3" },
  "34": { symbol: "-4", accessible: "Haderup Lower Left 4" },
  "35": { symbol: "-5", accessible: "Haderup Lower Left 5" },
  "36": { symbol: "-6", accessible: "Haderup Lower Left 6" },
  "37": { symbol: "-7", accessible: "Haderup Lower Left 7" },
  "38": { symbol: "-8", accessible: "Haderup Lower Left 8" },

  // Permanent Lower Right (Quadrant 4): 1- .. 8-
  "41": { symbol: "1-", accessible: "Haderup Lower Right 1" },
  "42": { symbol: "2-", accessible: "Haderup Lower Right 2" },
  "43": { symbol: "3-", accessible: "Haderup Lower Right 3" },
  "44": { symbol: "4-", accessible: "Haderup Lower Right 4" },
  "45": { symbol: "5-", accessible: "Haderup Lower Right 5" },
  "46": { symbol: "6-", accessible: "Haderup Lower Right 6" },
  "47": { symbol: "7-", accessible: "Haderup Lower Right 7" },
  "48": { symbol: "8-", accessible: "Haderup Lower Right 8" },

  // Primary Upper Right (Quadrant 5): 01+ .. 05+
  "55": { symbol: "05+", accessible: "Haderup Primary Upper Right 5" },
  "54": { symbol: "04+", accessible: "Haderup Primary Upper Right 4" },
  "53": { symbol: "03+", accessible: "Haderup Primary Upper Right 3" },
  "52": { symbol: "02+", accessible: "Haderup Primary Upper Right 2" },
  "51": { symbol: "01+", accessible: "Haderup Primary Upper Right 1" },

  // Primary Upper Left (Quadrant 6): +01 .. +05
  "61": { symbol: "+01", accessible: "Haderup Primary Upper Left 1" },
  "62": { symbol: "+02", accessible: "Haderup Primary Upper Left 2" },
  "63": { symbol: "+03", accessible: "Haderup Primary Upper Left 3" },
  "64": { symbol: "+04", accessible: "Haderup Primary Upper Left 4" },
  "65": { symbol: "+05", accessible: "Haderup Primary Upper Left 5" },

  // Primary Lower Left (Quadrant 7): -01 .. -05
  "71": { symbol: "-01", accessible: "Haderup Primary Lower Left 1" },
  "72": { symbol: "-02", accessible: "Haderup Primary Lower Left 2" },
  "73": { symbol: "-03", accessible: "Haderup Primary Lower Left 3" },
  "74": { symbol: "-04", accessible: "Haderup Primary Lower Left 4" },
  "75": { symbol: "-05", accessible: "Haderup Primary Lower Left 5" },

  // Primary Lower Right (Quadrant 8): 01- .. 05-
  "81": { symbol: "01-", accessible: "Haderup Primary Lower Right 1" },
  "82": { symbol: "02-", accessible: "Haderup Primary Lower Right 2" },
  "83": { symbol: "03-", accessible: "Haderup Primary Lower Right 3" },
  "84": { symbol: "04-", accessible: "Haderup Primary Lower Right 4" },
  "85": { symbol: "05-", accessible: "Haderup Primary Lower Right 5" },
};

const REVERSE_HADERUP = new Map<string, string>();
for (const [fdi, { symbol }] of Object.entries(HADERUP_MAP)) {
  REVERSE_HADERUP.set(symbol, fdi);
}

/**
 * Victor Haderup dental numbering system plugin (+/- notation).
 * Widely used in Northern Europe and Scandinavian clinical dentistry.
 */
export const customHaderupNotationPlugin = createPlugin({
  id: "@example/odontogram-haderup-notation",
  version: "1.0.0",
  apiCompatibility: "^1.0.0",
  notations: [
    {
      id: "haderup",
      name: "Victor Haderup Dental Notation (+/-)",
      description: "Plus/minus dental numbering system (+ for upper arch, - for lower arch)",
      format: (toothId: string): string => {
        return HADERUP_MAP[toothId]?.symbol ?? toothId;
      },
      formatAccessible: (toothId: string): string => {
        return HADERUP_MAP[toothId]?.accessible ?? `Tooth ${toothId}`;
      },
      parse: (label: string): string | null => {
        const trimmed = label.trim();
        return REVERSE_HADERUP.get(trimmed) ?? null;
      },
      isValid: (label: string): boolean => {
        return REVERSE_HADERUP.has(label.trim());
      },
    },
  ],
});
