import { describe, expect, it } from 'vitest';
import { zonedLocalToUtcIso } from '@/domain/availability';
import { splitMatchesByToday } from '@/domain/matchTime';

const tz = 'America/Chicago';

describe('splitMatchesByToday', () => {
  it('puts calendar dates before today in past', () => {
    const now = new Date(zonedLocalToUtcIso('2026-09-11', '12:00', tz));
    const matches = [
      {
        id: 'past',
        kickoffAt: zonedLocalToUtcIso('2026-09-05', '10:00', tz),
      },
      {
        id: 'today',
        kickoffAt: zonedLocalToUtcIso('2026-09-11', '18:00', tz),
      },
    ];
    const { upcoming, past } = splitMatchesByToday(matches, tz, now);
    expect(past.map((m) => m.id)).toEqual(['past']);
    expect(upcoming.map((m) => m.id)).toEqual(['today']);
  });

  it('keeps today matches in upcoming even if kickoff passed', () => {
    const now = new Date(zonedLocalToUtcIso('2026-09-11', '15:00', tz));
    const matches = [
      {
        id: 'morning',
        kickoffAt: zonedLocalToUtcIso('2026-09-11', '08:00', tz),
      },
      {
        id: 'evening',
        kickoffAt: zonedLocalToUtcIso('2026-09-11', '19:00', tz),
      },
    ];
    expect(splitMatchesByToday(matches, tz, now).upcoming.map((m) => m.id)).toEqual([
      'morning',
      'evening',
    ]);
  });

  it('returns all matches as past when every date is before today', () => {
    const now = new Date(zonedLocalToUtcIso('2026-09-11', '12:00', tz));
    const matches = [
      {
        id: 'old',
        kickoffAt: zonedLocalToUtcIso('2026-09-05', '10:00', tz),
      },
    ];
    const { upcoming, past } = splitMatchesByToday(matches, tz, now);
    expect(upcoming).toEqual([]);
    expect(past.map((m) => m.id)).toEqual(['old']);
  });
});
