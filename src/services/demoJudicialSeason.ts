import type { CardLawId } from '@/domain/cardLaws';
import {
  casesFromCardReport,
  type JudicialCase,
  type JudicialCaseStatus,
} from '@/domain/judicial';
import type {
  CardConference,
  CardIncident,
  CardReport,
} from '@/domain/reports';

type Official = { id: string; name: string; email: string; phone: string };

type School = { abbr: string; name: string };

type RedSpec = {
  first: string;
  last: string;
  abbr: string;
  status: Extract<
    JudicialCaseStatus,
    'upheld' | 'dismissed' | 'summary_judgment' | 'reduced'
  >;
  sanctionMatches?: number;
  sanctionNote?: string;
  lawId: CardLawId;
};

const MEN_OFFICIALS: Official[] = [
  {
    id: 'u_assigner',
    name: 'Alex Assigner',
    email: 'assigner@example.com',
    phone: '+15551110001',
  },
  {
    id: 'u_ref1',
    name: 'Riley Official',
    email: 'riley@example.com',
    phone: '+15551110004',
  },
  {
    id: 'u_ref3',
    name: 'Jordan Smith',
    email: 'jordan.smith@example.com',
    phone: '+15551110013',
  },
  {
    id: 'u_ref7',
    name: 'Marcus Webb',
    email: 'marcus.webb@example.com',
    phone: '+15551110017',
  },
  {
    id: 'u_ref9',
    name: 'Tyler Brooks',
    email: 'tyler.brooks@example.com',
    phone: '+15551110019',
  },
];

const WOMEN_OFFICIALS: Official[] = [
  {
    id: 'u_ref4',
    name: 'Mia Chen',
    email: 'mia.chen@example.com',
    phone: '+15551110014',
  },
  {
    id: 'u_ref6',
    name: 'Sara Patel',
    email: 'sara.patel@example.com',
    phone: '+15551110016',
  },
  {
    id: 'u_ref8',
    name: 'Elena Ruiz',
    email: 'elena.ruiz@example.com',
    phone: '+15551110018',
  },
  {
    id: 'u_ref10',
    name: 'Naomi Park',
    email: 'naomi.park@example.com',
    phone: '+15551110020',
  },
];

const MEN_SCHOOLS: School[] = [
  { abbr: 'ASU', name: 'Angelo State' },
  { abbr: 'LETU', name: 'LeTourneau' },
  { abbr: 'OU', name: 'Oklahoma' },
  { abbr: 'Rice', name: 'Rice' },
  { abbr: 'SHSU', name: 'Sam Houston' },
  { abbr: 'SMU', name: 'SMU' },
  { abbr: 'SNU', name: 'Southern Nazarene' },
  { abbr: 'TAMU', name: 'Texas A&M' },
  { abbr: 'TCU', name: 'TCU' },
  { abbr: 'TTU', name: 'Texas Tech' },
  { abbr: 'TXST', name: 'Texas State' },
  { abbr: 'UD', name: 'Dallas' },
  { abbr: 'UH', name: 'Houston' },
  { abbr: 'UNT', name: 'North Texas' },
  { abbr: 'UT', name: 'Texas' },
  { abbr: 'UTD', name: 'UT Dallas' },
  { abbr: 'UTSA', name: 'UTSA' },
];

/** Total cards per school = 59 with SHSU 13, UNT 11. */
const MEN_SCHOOL_TOTALS: Record<string, number> = {
  ASU: 2,
  LETU: 1,
  OU: 2,
  Rice: 2,
  SHSU: 13,
  SMU: 3,
  SNU: 1,
  TAMU: 5,
  TCU: 4,
  TTU: 2,
  TXST: 2,
  UD: 1,
  UH: 3,
  UNT: 11,
  UT: 3,
  UTD: 2,
  UTSA: 2,
};

const MEN_REDS: RedSpec[] = [
  {
    first: 'Cooper',
    last: 'Creacy',
    abbr: 'SMU',
    status: 'dismissed',
    lawId: 'law_9_13_dangerous_tackling',
  },
  {
    first: 'Caleb',
    last: 'Goeddertz',
    abbr: 'UNT',
    status: 'dismissed',
    lawId: 'law_9_13_dangerous_tackling',
  },
  {
    first: 'Nathan',
    last: 'Balcazar',
    abbr: 'ASU',
    status: 'dismissed',
    lawId: 'law_9_16_dangerous_charge',
  },
  {
    first: 'Divine',
    last: 'Harbor',
    abbr: 'SHSU',
    status: 'upheld',
    sanctionMatches: 2,
    lawId: 'law_9_13_dangerous_tackling',
  },
  {
    first: 'Camajae',
    last: 'Brush',
    abbr: 'UNT',
    status: 'upheld',
    sanctionMatches: 3,
    lawId: 'law_9_18_dangerous_lift',
  },
  {
    first: 'Noah',
    last: 'Hudson',
    abbr: 'TAMU',
    status: 'upheld',
    sanctionMatches: 2,
    lawId: 'law_9_13_dangerous_tackling',
  },
  {
    first: 'Aiden',
    last: 'Martinez',
    abbr: 'TCU',
    status: 'upheld',
    sanctionMatches: 1,
    lawId: 'law_9_12_physical_abuse',
  },
  {
    first: 'Christian',
    last: 'Zulhike',
    abbr: 'UH',
    status: 'summary_judgment',
    sanctionNote: 'Summary judgment / time served',
    lawId: 'law_9_13_dangerous_tackling',
  },
  {
    first: 'Matias',
    last: 'Langton',
    abbr: 'UT',
    status: 'upheld',
    sanctionMatches: 2,
    lawId: 'law_9_20_dangerous_ruck_maul',
  },
  {
    first: 'Joshua',
    last: 'Rios',
    abbr: 'TXST',
    status: 'upheld',
    sanctionMatches: 4,
    lawId: 'law_9_12_physical_abuse',
  },
];

const WOMEN_SCHOOLS: School[] = [
  { abbr: 'TXST', name: 'Texas State' },
  { abbr: 'UNT', name: 'North Texas' },
  { abbr: 'DBU', name: 'Dallas Baptist' },
  { abbr: 'TCU', name: 'TCU' },
  { abbr: 'SMU', name: 'SMU' },
  { abbr: 'Rice', name: 'Rice' },
  { abbr: 'UH', name: 'Houston' },
  { abbr: 'UT', name: 'Texas' },
];

const WOMEN_SCHOOL_TOTALS: Record<string, number> = {
  TXST: 6,
  UNT: 5,
  DBU: 4,
  TCU: 3,
  SMU: 3,
  Rice: 3,
  UH: 2,
  UT: 2,
};

const WOMEN_REDS: RedSpec[] = [
  {
    first: 'Maya',
    last: 'Chen',
    abbr: 'SMU',
    status: 'dismissed',
    lawId: 'law_9_13_dangerous_tackling',
  },
  {
    first: 'Priya',
    last: 'Nair',
    abbr: 'Rice',
    status: 'dismissed',
    lawId: 'law_9_17_tackle_in_air',
  },
  {
    first: 'Jordan',
    last: 'Blake',
    abbr: 'TXST',
    status: 'upheld',
    sanctionMatches: 2,
    lawId: 'law_9_13_dangerous_tackling',
  },
  {
    first: 'Avery',
    last: 'Cole',
    abbr: 'UNT',
    status: 'summary_judgment',
    sanctionNote: 'Summary judgment / time served',
    lawId: 'law_9_18_dangerous_lift',
  },
  {
    first: 'Quinn',
    last: 'Harlow',
    abbr: 'TCU',
    status: 'upheld',
    sanctionMatches: 1,
    lawId: 'law_9_12_physical_abuse',
  },
];

const YELLOW_FIRST = [
  'Liam',
  'Owen',
  'Ethan',
  'Caleb',
  'Noah',
  'Lucas',
  'Mason',
  'Logan',
  'Henry',
  'Jack',
  'Leo',
  'Wyatt',
  'Grayson',
  'Isaac',
  'Julian',
];
const YELLOW_LAST = [
  'Reyes',
  'Nguyen',
  'Patel',
  'Brooks',
  'Keller',
  'Walsh',
  'Diaz',
  'Foster',
  'Grant',
  'Hayes',
  'Ibarra',
  'Jensen',
  'Kim',
  'Lopez',
  'Moore',
];
const WOMEN_YELLOW_FIRST = [
  'Sofia',
  'Emma',
  'Ava',
  'Mia',
  'Harper',
  'Luna',
  'Camila',
  'Ella',
  'Scarlett',
  'Chloe',
  'Penelope',
  'Layla',
  'Riley',
  'Zoey',
  'Nora',
];
const WOMEN_YELLOW_LAST = [
  'Santos',
  'Okoye',
  'Berg',
  'Cho',
  'Daly',
  'Ellis',
  'Frost',
  'Gupta',
  'Hahn',
  'Ingram',
  'Jules',
  'Kaur',
  'Lane',
  'Mendez',
  'Nash',
];

const DANGEROUS_LAWS: CardLawId[] = [
  'law_9_13_dangerous_tackling',
  'law_9_18_dangerous_lift',
  'law_9_20_dangerous_ruck_maul',
  'law_9_11_reckless_dangerous',
  'law_9_16_dangerous_charge',
];
const YELLOW_LAW_QUOTA_MEN: CardLawId[] = [
  ...Array(26).fill('law_9_13_dangerous_tackling'),
  ...Array(9).fill('law_9_8_9_10_repeated'),
  ...Array(5).fill('law_9_12_physical_abuse'),
  ...Array(5).fill('law_9_7_unfair_play'),
  ...Array(4).fill('law_9_27_unsportsmanlike'),
];
const YELLOW_LAW_QUOTA_WOMEN: CardLawId[] = [
  ...Array(12).fill('law_9_13_dangerous_tackling'),
  ...Array(4).fill('law_9_8_9_10_repeated'),
  ...Array(3).fill('law_9_12_physical_abuse'),
  ...Array(2).fill('law_9_7_unfair_play'),
  ...Array(2).fill('law_9_27_unsportsmanlike'),
];

function teamId(conference: CardConference, abbr: string): string {
  return `t_jd_${conference}_${abbr.toLowerCase()}`;
}

function isoOn(date: string, hour = 18): string {
  return `${date}T${String(hour).padStart(2, '0')}:12:00.000Z`;
}

function spreadDate(index: number, total: number, start: string, end: string): string {
  const a = Date.parse(`${start}T00:00:00Z`);
  const b = Date.parse(`${end}T00:00:00Z`);
  const t = total <= 1 ? 0 : index / (total - 1);
  const ms = a + Math.round((b - a) * t);
  return new Date(ms).toISOString().slice(0, 10);
}

function officialAt(list: Official[], i: number): Official {
  return list[i % list.length]!;
}

function yellowIncident(
  id: string,
  first: string,
  last: string,
  school: School,
  conference: CardConference,
  lawId: CardLawId,
): CardIncident {
  return {
    id,
    color: 'yellow',
    playerName: `${first} ${last}`,
    playerFirstName: first,
    playerLastName: last,
    teamId: teamId(conference, school.abbr),
    teamName: school.abbr,
    minute: String(12 + (id.length % 60)),
    reason: '',
    lawIds: [lawId],
    offenseSummary: 'Carded after warning — see law(s) selected.',
    receivedAnotherCard: false,
  };
}

function redIncident(id: string, spec: RedSpec, school: School, conference: CardConference): CardIncident {
  return {
    id,
    color: 'red',
    playerName: `${spec.first} ${spec.last}`,
    playerFirstName: spec.first,
    playerLastName: spec.last,
    teamId: teamId(conference, school.abbr),
    teamName: school.abbr,
    minute: String(40 + (spec.last.length % 30)),
    reason: '',
    lawIds: [spec.lawId],
    offenseSummary: 'Red card — send-off. See law(s) selected.',
    receivedAnotherCard: false,
  };
}

function reportForCard(
  conference: CardConference,
  official: Official,
  matchDate: string,
  card: CardIncident,
  matchId: string,
): CardReport {
  const id = `card_${card.id}`;
  return {
    id,
    matchId,
    officialId: official.id,
    status: 'submitted',
    competitionUnion: 'ncr_lonestar_college',
    conference,
    officialName: official.name,
    officialEmail: official.email,
    officialPhone: official.phone,
    matchDate,
    matchFilmed: matchDate.endsWith('6') || matchDate.endsWith('1'),
    cards: [card],
    submittedAt: isoOn(matchDate, 21),
    createdAt: isoOn(matchDate, 21),
  };
}

function applyRedRuling(c: JudicialCase, spec: RedSpec, ruledAt: string): JudicialCase {
  const status: JudicialCaseStatus =
    spec.status === 'summary_judgment' ? 'summary_judgment' : spec.status;
  return {
    ...c,
    status,
    sanctionMatches: spec.sanctionMatches,
    sanctionNote: spec.sanctionNote,
    ruledAt,
    ruledByUid: 'u_assigner',
    ruledByName: 'Alex Assigner',
    updatedAt: ruledAt,
  };
}

function buildSeason(opts: {
  conference: CardConference;
  schools: School[];
  totals: Record<string, number>;
  reds: RedSpec[];
  officials: Official[];
  yellowFirst: string[];
  yellowLast: string[];
  yellowLaws: CardLawId[];
  dateStart: string;
  dateEnd: string;
  idPrefix: string;
}): { reports: CardReport[]; cases: JudicialCase[] } {
  const reports: CardReport[] = [];
  const rulingByIncident = new Map<string, RedSpec>();
  let n = 0;
  const totalCards = Object.values(opts.totals).reduce((a, b) => a + b, 0);

  const redsBySchool = new Map<string, RedSpec[]>();
  for (const red of opts.reds) {
    const list = redsBySchool.get(red.abbr) ?? [];
    list.push(red);
    redsBySchool.set(red.abbr, list);
  }

  let yellowLawI = 0;
  let yellowNameI = 0;

  for (const school of opts.schools) {
    const total = opts.totals[school.abbr] ?? 0;
    const reds = redsBySchool.get(school.abbr) ?? [];
    for (const spec of reds) {
      const date = spreadDate(n, totalCards, opts.dateStart, opts.dateEnd);
      const id = `${opts.idPrefix}_r_${spec.last.toLowerCase()}`;
      const card = redIncident(id, spec, school, opts.conference);
      const official = officialAt(opts.officials, n);
      reports.push(
        reportForCard(
          opts.conference,
          official,
          date,
          card,
          `m_jd_${opts.idPrefix}_${n}`,
        ),
      );
      rulingByIncident.set(id, spec);
      n += 1;
    }
    const yellowCount = total - reds.length;
    for (let i = 0; i < yellowCount; i += 1) {
      const date = spreadDate(n, totalCards, opts.dateStart, opts.dateEnd);
      const first = opts.yellowFirst[yellowNameI % opts.yellowFirst.length]!;
      const last = opts.yellowLast[yellowNameI % opts.yellowLast.length]!;
      yellowNameI += 1;
      const lawId =
        opts.yellowLaws[yellowLawI] ?? DANGEROUS_LAWS[yellowLawI % DANGEROUS_LAWS.length]!;
      yellowLawI += 1;
      const id = `${opts.idPrefix}_y_${school.abbr.toLowerCase()}_${i}`;
      const card = yellowIncident(id, first, last, school, opts.conference, lawId);
      const official = officialAt(opts.officials, n);
      reports.push(
        reportForCard(
          opts.conference,
          official,
          date,
          card,
          `m_jd_${opts.idPrefix}_${n}`,
        ),
      );
      n += 1;
    }
  }

  const cases = reports.flatMap((r) => {
    const built = casesFromCardReport(r, r.submittedAt ?? r.createdAt);
    return built.map((c) => {
      const spec = rulingByIncident.get(c.incidentId);
      if (!spec) return c;
      return applyRedRuling(c, spec, r.submittedAt ?? r.createdAt);
    });
  });

  return { reports, cases };
}

let cachedSeason: { reports: CardReport[]; cases: JudicialCase[] } | null = null;

export function seedDemoJudicialSeason(): {
  reports: CardReport[];
  cases: JudicialCase[];
} {
  if (cachedSeason) return cachedSeason;
  const men = buildSeason({
    conference: 'lonestar_men',
    schools: MEN_SCHOOLS,
    totals: MEN_SCHOOL_TOTALS,
    reds: MEN_REDS,
    officials: MEN_OFFICIALS,
    yellowFirst: YELLOW_FIRST,
    yellowLast: YELLOW_LAST,
    yellowLaws: YELLOW_LAW_QUOTA_MEN,
    dateStart: '2026-08-30',
    dateEnd: '2027-04-12',
    idPrefix: 'men',
  });
  const women = buildSeason({
    conference: 'lonestar_women',
    schools: WOMEN_SCHOOLS,
    totals: WOMEN_SCHOOL_TOTALS,
    reds: WOMEN_REDS,
    officials: WOMEN_OFFICIALS,
    yellowFirst: WOMEN_YELLOW_FIRST,
    yellowLast: WOMEN_YELLOW_LAST,
    yellowLaws: YELLOW_LAW_QUOTA_WOMEN,
    dateStart: '2026-09-06',
    dateEnd: '2027-03-28',
    idPrefix: 'women',
  });
  cachedSeason = {
    reports: [...men.reports, ...women.reports],
    cases: [...men.cases, ...women.cases],
  };
  return cachedSeason;
}

export function seedDemoMenJudicialCases(): JudicialCase[] {
  return seedDemoJudicialSeason().cases.filter((c) => c.conference === 'lonestar_men');
}
