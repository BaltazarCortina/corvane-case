import { describe, expect, it } from 'vitest';
import { declineOf, riskLevel, riskOf } from '../../src/risk/risk';
import { assumptionsWith } from '../fixtures';

const { parameters } = assumptionsWith();

describe('riskLevel', () => {
  it('makes a high note high risk on its own, whatever billing does', () => {
    expect(riskLevel('high', 'none')).toBe('high');
    expect(riskLevel('high', 'moderate')).toBe('high');
  });

  it('makes a very strong decline high risk on its own, with or without notes', () => {
    expect(riskLevel('none', 'veryStrong')).toBe('high');
    expect(riskLevel('low', 'veryStrong')).toBe('high');
  });

  it('stops a strong decline with no note behind it at medium, and raises it to high with a medium note', () => {
    expect(riskLevel('none', 'strong')).toBe('medium');
    expect(riskLevel('medium', 'strong')).toBe('high');
  });

  it('keeps a moderate decline from raising a note', () => {
    expect(riskLevel('none', 'moderate')).toBe('low');
    expect(riskLevel('low', 'moderate')).toBe('low');
    expect(riskLevel('medium', 'moderate')).toBe('medium');
  });

  it('reads no risk when neither signal shows any', () => {
    expect(riskLevel('none', 'none')).toBe('none');
  });
});

describe('declineOf', () => {
  it('grades the drop by its share of the earlier billing', () => {
    expect(declineOf(100_000, 95_000, parameters).level).toBe('none');
    expect(declineOf(100_000, 90_000, parameters).level).toBe('moderate');
    expect(declineOf(100_000, 75_000, parameters).level).toBe('strong');
    expect(declineOf(100_000, 50_000, parameters).level).toBe('veryStrong');
  });

  it('ignores a drop below the minimum amount, whatever its share', () => {
    const decline = declineOf(15_000, 6_000, parameters);
    expect(decline.level).toBe('none');
    expect(decline.changePct).toBe(-60);
  });

  it('reads growth, and no earlier billing, as no decline', () => {
    expect(declineOf(100_000, 150_000, parameters).level).toBe('none');
    const fromNothing = declineOf(0, 50_000, parameters);
    expect(fromNothing.level).toBe('none');
    expect(fromNothing.changePct).toBeNull();
  });
});

describe('riskOf', () => {
  const note = { noteId: 'N-1', date: '2026-09-07', risk: 'medium' as const };

  it('explains the level with the signals behind it', () => {
    const decline = declineOf(100_000, 70_000, parameters);
    const risk = riskOf(note, decline);
    expect(risk.level).toBe('high');
    expect(risk.reason).toBe('Medium note on 2026-09-07 and billing down 30.0% ($30k)');
  });

  it('names billing alone when there is no note, and says so when there is no signal', () => {
    const strong = declineOf(100_000, 70_000, parameters);
    const flat = declineOf(100_000, 100_000, parameters);
    expect(riskOf(null, strong).reason).toBe('Billing down 30.0% ($30k)');
    expect(riskOf(null, flat).reason).toBe('No risk in the notes or in billing');
  });
});
