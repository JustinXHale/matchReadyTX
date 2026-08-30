/** World Rugby Law 9 options from the current-season Referee Card Report Form. */

export const CARD_LAW_IDS = [
  'law_9_1_9_6_obstruction',
  'law_9_7_unfair_play',
  'law_9_8_9_10_repeated',
  'law_9_11_reckless_dangerous',
  'law_9_12_physical_abuse',
  'law_9_12_verbal_abuse',
  'law_9_13_dangerous_tackling',
  'law_9_14_tackle_without_ball',
  'law_9_15_off_ball_obstruction',
  'law_9_16_dangerous_charge',
  'law_9_17_tackle_in_air',
  'law_9_18_dangerous_lift',
  'law_9_19_dangerous_scrum',
  'law_9_20_dangerous_ruck_maul',
  'law_9_25_obstruct_kicker',
  'law_9_27_unsportsmanlike',
  'law_9_28_disrespect_authority',
  'law_9_28_verbal_abuse_official',
  'law_9_28_physical_contact_official',
  'law_9_28_threatening_official',
  'law_9_28_physical_abuse_official',
] as const;

export type CardLawId = (typeof CARD_LAW_IDS)[number];

export const CARD_LAW_LABELS: Record<CardLawId, string> = {
  law_9_1_9_6_obstruction:
    '9.1–9.6: Obstruction — push, offside, prevent play, run into offside player, dead-ball interference',
  law_9_7_unfair_play:
    '9.7: Unfair play — intentional knock, intentional infringement, time-wasting',
  law_9_8_9_10_repeated:
    '9.8–9.10: Repeated infringement — team, player, or combined',
  law_9_11_reckless_dangerous:
    '9.11: Reckless or dangerous play — leading with elbow/forearm, jumping into/over a tackler',
  law_9_12_physical_abuse:
    '9.12: Physical abuse — biting, eye contact, punching, striking, stamping, tripping, kicking',
  law_9_12_verbal_abuse:
    '9.12: Verbal abuse — including based on religion, colour, national/ethnic origin, or sexual orientation',
  law_9_13_dangerous_tackling:
    '9.13: Early, late, or dangerous tackling (including above the line of the shoulders)',
  law_9_14_tackle_without_ball: '9.14: Tackling a player not in possession of the ball',
  law_9_15_off_ball_obstruction:
    '9.15: Holding, pushing, charging, or obstructing an opponent not in possession (except scrum, ruck, or maul)',
  law_9_16_dangerous_charge:
    '9.16: Charging or knocking down a ball carrier without attempting to grasp them',
  law_9_17_tackle_in_air:
    '9.17: Tackling, charging, or grasping a player whose feet are off the ground',
  law_9_18_dangerous_lift:
    '9.18: Lifting and dropping/driving a player so head or upper body contacts the ground',
  law_9_19_dangerous_scrum: '9.19: Dangerous play in a scrum',
  law_9_20_dangerous_ruck_maul:
    '9.20: Dangerous play in a ruck or maul — charging, head contact, collapsing, gator roll, lower-limb weight',
  law_9_25_obstruct_kicker:
    '9.25: Intentionally charging or obstructing an opponent who has just kicked the ball',
  law_9_27_unsportsmanlike:
    '9.27: Unsportsmanlike conduct — hair pulling, spitting, grabbing genitals, or other',
  law_9_28_disrespect_authority: '9.28: Disrespecting the authority of a match official',
  law_9_28_verbal_abuse_official:
    '9.28: Verbal abuse of a match official — including identity-based abuse',
  law_9_28_physical_contact_official: '9.28: Making physical contact with a match official',
  law_9_28_threatening_official:
    '9.28: Threatening actions or words toward a match official',
  law_9_28_physical_abuse_official: '9.28: Physical abuse of a match official',
};

export const DISCIPLINE_TREND_BUCKETS = [
  'dangerous_tackles',
  'repeated_infringements',
  'physical_foul_play',
  'cynical_professional',
  'other_technical',
] as const;

export type DisciplineTrendBucket = (typeof DISCIPLINE_TREND_BUCKETS)[number];

export const DISCIPLINE_TREND_LABELS: Record<DisciplineTrendBucket, string> = {
  dangerous_tackles: 'Dangerous tackles / head contact',
  repeated_infringements: 'Repeated team infringements',
  physical_foul_play: 'Physical foul play / striking',
  cynical_professional: 'Cynical / professional fouls',
  other_technical: 'Other technical offenses',
};

/** Representative law numbers shown on judicial trend bars (matches referee form). */
const TREND_BUCKET_LAW_REFS: Record<DisciplineTrendBucket, string> = {
  dangerous_tackles: '9.11, 9.13, 9.16–9.20',
  repeated_infringements: '9.8–9.10',
  physical_foul_play: '9.12',
  cynical_professional: '9.1–9.7, 9.14, 9.15, 9.25',
  other_technical: '9.27, 9.28',
};

export function disciplineTrendLabelWithLaws(
  bucket: DisciplineTrendBucket,
): string {
  return `${TREND_BUCKET_LAW_REFS[bucket]} — ${DISCIPLINE_TREND_LABELS[bucket]}`;
}

const LAW_TREND: Record<CardLawId, DisciplineTrendBucket> = {
  law_9_1_9_6_obstruction: 'cynical_professional',
  law_9_7_unfair_play: 'cynical_professional',
  law_9_8_9_10_repeated: 'repeated_infringements',
  law_9_11_reckless_dangerous: 'dangerous_tackles',
  law_9_12_physical_abuse: 'physical_foul_play',
  law_9_12_verbal_abuse: 'other_technical',
  law_9_13_dangerous_tackling: 'dangerous_tackles',
  law_9_14_tackle_without_ball: 'cynical_professional',
  law_9_15_off_ball_obstruction: 'cynical_professional',
  law_9_16_dangerous_charge: 'dangerous_tackles',
  law_9_17_tackle_in_air: 'dangerous_tackles',
  law_9_18_dangerous_lift: 'dangerous_tackles',
  law_9_19_dangerous_scrum: 'dangerous_tackles',
  law_9_20_dangerous_ruck_maul: 'dangerous_tackles',
  law_9_25_obstruct_kicker: 'cynical_professional',
  law_9_27_unsportsmanlike: 'other_technical',
  law_9_28_disrespect_authority: 'other_technical',
  law_9_28_verbal_abuse_official: 'other_technical',
  law_9_28_physical_contact_official: 'other_technical',
  law_9_28_threatening_official: 'other_technical',
  law_9_28_physical_abuse_official: 'other_technical',
};

export function isCardLawId(value: string): value is CardLawId {
  return (CARD_LAW_IDS as readonly string[]).includes(value);
}

/** Primary trend bucket for a set of selected laws (first matching, else other). */
export function trendBucketForLaws(lawIds: string[]): DisciplineTrendBucket {
  const mapped = lawIds.filter(isCardLawId).map((id) => LAW_TREND[id]);
  for (const bucket of DISCIPLINE_TREND_BUCKETS) {
    if (mapped.includes(bucket)) return bucket;
  }
  return 'other_technical';
}

export const PLAYER_POSITIONS = [
  'prop',
  'hooker',
  'lock',
  'flanker',
  'eight_man',
  'scrum_half',
  'fly_half',
  'center',
  'winger',
  'fullback',
] as const;

export type PlayerPosition = (typeof PLAYER_POSITIONS)[number];

export const PLAYER_POSITION_LABELS: Record<PlayerPosition, string> = {
  prop: 'Prop',
  hooker: 'Hooker',
  lock: 'Lock',
  flanker: 'Flanker',
  eight_man: '8-Man',
  scrum_half: 'ScrumHalf',
  fly_half: 'FlyHalf',
  center: 'Center',
  winger: 'Winger',
  fullback: 'Fullback',
};

export function isPlayerPosition(value: string): value is PlayerPosition {
  return (PLAYER_POSITIONS as readonly string[]).includes(value);
}
