import { describe, expect, it } from 'vitest';
import {
  assignerCmoReportEditPath,
  assignerMatchReportEditPath,
} from '@/features/referee/reports/reportLinks';

describe('Scheduler report edit links', () => {
  it('targets the original crew-report owner and slot', () => {
    expect(assignerMatchReportEditPath('match 1', 'official/1', 'ar2')).toBe(
      '/matches/match 1/file-report?officialId=official%2F1&slot=ar2&edit=1',
    );
  });

  it('identifies both the CMO filer and assessed official', () => {
    expect(assignerCmoReportEditPath('match-1', 'cmo-1', 'mo/1')).toBe(
      '/referee/reports/coaching/match-1?officialId=cmo-1&edit=1&subjectOfficialId=mo%2F1',
    );
  });
});
