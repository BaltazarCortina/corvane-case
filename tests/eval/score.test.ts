import { describe, expect, it } from 'vitest';
import type { Label } from '../../src/eval/labels';
import { type Reading, scoreAtRisk, scoreReadings } from '../../src/eval/score';

describe('scoreAtRisk', () => {
  it('weights each note by how many notes it stands for', () => {
    // One flagged note right and one wrong; the wrong one stands for three notes.
    const score = scoreAtRisk([
      { weight: 1, item: { labeled: true, flagged: true } },
      { weight: 3, item: { labeled: false, flagged: true } },
      { weight: 2, item: { labeled: true, flagged: false } },
    ]);
    expect(score.precision).toBe(0.25);
    expect(score.recall).toBeCloseTo(1 / 3);
    expect(score.counts).toEqual({ truePositive: 1, falsePositive: 1, falseNegative: 1, trueNegative: 0 });
  });

  it('has no precision when nothing is flagged, and no recall when nothing is at risk', () => {
    const score = scoreAtRisk([{ weight: 1, item: { labeled: false, flagged: false } }]);
    expect(score.precision).toBeNull();
    expect(score.recall).toBeNull();
  });
});

describe('scoreReadings', () => {
  const label = (risk: Label['risk'], reasons: Label['reasons'] = []): Label => ({
    noteId: 'N-1',
    risk,
    reasons,
    noteType: 'customer',
    comment: '',
  });
  const reading = (risk: Reading['risk'], reasons: Reading['reasons'] = []): Reading => ({
    risk,
    reasons,
    noteType: 'customer',
  });

  it('counts a level apart as a different level but the same answer on being at risk', () => {
    const score = scoreReadings([
      { weight: 1, item: { label: label('high', ['service']), reading: reading('medium', ['service']) } },
    ]);
    expect(score.sameRisk).toBe(0);
    expect(score.atRisk.precision).toBe(1);
    expect(score.atRisk.recall).toBe(1);
  });

  it('scores reasons only on notes both call at risk', () => {
    const score = scoreReadings([
      {
        weight: 1,
        item: { label: label('high', ['service', 'competitor']), reading: reading('high', ['service', 'price']) },
      },
      { weight: 1, item: { label: label('none'), reading: reading('medium', ['billing']) } },
    ]);
    expect(score.reasons).toEqual({ recall: 0.5, precision: 0.5 });
  });
});
