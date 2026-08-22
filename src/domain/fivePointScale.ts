/** Shared 1–5 performance ratings plus N/A (not applicable). */

export const FIVE_POINT_VALUES = [1, 2, 3, 4, 5] as const;
export type FivePointValue = (typeof FIVE_POINT_VALUES)[number];

export const SCALE_NA = 'na' as const;
export type ScaleNa = typeof SCALE_NA;

export type FivePointChoice = FivePointValue | ScaleNa;

export const FIVE_POINT_LABELS: Record<FivePointValue, string> = {
  1: 'Poor',
  2: 'Below Average',
  3: 'Average',
  4: 'Above Average',
  5: 'Excellent',
};

export const SCALE_NA_SHORT = 'N/A';
export const SCALE_NA_LABEL = 'Not applicable';

export const FIVE_POINT_CHOICES: FivePointChoice[] = [
  ...FIVE_POINT_VALUES,
  SCALE_NA,
];

export function isFivePointValue(v: unknown): v is FivePointValue {
  return (
    typeof v === 'number' &&
    FIVE_POINT_VALUES.includes(v as FivePointValue)
  );
}

export function isScaleNa(v: unknown): v is ScaleNa {
  if (v === SCALE_NA) return true;
  if (typeof v !== 'string') return false;
  const lower = v.trim().toLowerCase();
  return lower === 'na' || lower === 'n/a' || lower === 'not applicable';
}

export function parseFivePointChoice(raw: unknown): FivePointChoice | null {
  if (isScaleNa(raw)) return SCALE_NA;
  if (isFivePointValue(raw)) return raw;
  if (typeof raw === 'string') {
    const asNum = Number(raw);
    if (Number.isInteger(asNum) && isFivePointValue(asNum)) return asNum;
  }
  return null;
}

export function formatFivePointChoice(
  v: FivePointChoice | undefined,
): string | null {
  if (v === SCALE_NA) return SCALE_NA_SHORT;
  if (isFivePointValue(v)) return `${v}/5`;
  return null;
}
