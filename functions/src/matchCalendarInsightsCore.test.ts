import assert from 'node:assert/strict';
import {
  getInsightsSummary,
  mergeInsightsSummaries,
} from './matchCalendarInsightsCore';

const summaryA = getInsightsSummary(
  [
    {
      id: 'a',
      status: 'upcoming',
      matchType: 'xvs',
      positionPreset: 'referee',
      payStatus: 'paid',
      paidAmount: 100,
      competition: 'NCR',
      expenses: [
        { category: 'parking', amount: 20, reimbursementStatus: 'not_expected' },
        { category: 'miles_driven', amount: 0, miles: 50 },
      ],
    },
  ],
  [],
);

const summaryB = getInsightsSummary(
  [
    {
      id: 'b',
      status: 'upcoming',
      matchType: '7s',
      positionPreset: 'assistant_referee',
      payStatus: 'paid',
      paidAmount: 75,
      competition: 'NCR',
      expenses: [
        { category: 'food', amount: 15, reimbursementStatus: 'not_expected' },
        { category: 'miles_flown', amount: 0, miles: 200 },
      ],
    },
  ],
  [],
);

const merged = mergeInsightsSummaries([summaryA, summaryB]);
assert.equal(merged.eventCount, 2);
assert.equal(merged.milesDriven, 50);
assert.equal(merged.milesFlown, 200);
assert.equal(merged.paid, 195);
assert.equal(merged.expenses, 35);
assert.equal(merged.net, 160);
assert.equal(merged.organizations.length, 1);
assert.equal(merged.organizations[0].organization, 'NCR');

console.log('matchCalendarInsightsCore merge checks passed.');
