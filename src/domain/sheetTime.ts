function chicagoPartsAtUtc(utcMs: number): {
  y: number;
  mo: number;
  d: number;
  h: number;
  m: number;
  s: number;
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(utcMs));
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    y: pick('year'),
    mo: pick('month'),
    d: pick('day'),
    h: pick('hour'),
    m: pick('minute'),
    s: pick('second'),
  };
}

/** Sheet schedule columns store wall time in America/Chicago (CST/CDT). */
export function chicagoWallTimeToUtcIso(dateYmd: string, timeHms: string): string {
  const [y, mo, d] = dateYmd.split('-').map(Number);
  const [hh, mm, ssRaw] = timeHms.split(':');
  const h = Number(hh);
  const m = Number(mm);
  const s = Number(ssRaw ?? 0);
  for (const offsetHours of [-6, -5]) {
    const utcMs = Date.UTC(y, mo - 1, d, h - offsetHours, m, s);
    const local = chicagoPartsAtUtc(utcMs);
    if (
      local.y === y &&
      local.mo === mo &&
      local.d === d &&
      local.h === h &&
      local.m === m &&
      local.s === s
    ) {
      return new Date(utcMs).toISOString();
    }
  }
  return new Date(`${dateYmd}T${timeHms}-06:00`).toISOString();
}
