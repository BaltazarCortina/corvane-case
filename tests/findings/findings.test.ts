import { describe, expect, it } from 'vitest';
import { build } from '../../src/build';
import type { Finding } from '../../src/findings/cases';
import { detectFindings, withRuleReversed } from '../../src/findings/findings';
import type { Inputs } from '../../src/model/build';
import type { Reference } from '../../src/model/reference';
import { assumptionsWith, exportsWith } from '../fixtures';

const reference: Reference = {
  fiscalYearStartMonth: 4,
  states: {},
  industries: {},
  serviceLines: { Repair: [], 'Inspection & Testing': [], Monitoring: [], 'Credit memos': ['Credit memo'] },
};

// As of 2026-09-30. Acme keeps billing after its contract ended; Bolt has a large contract and stopped
// billing, while the CRM still says active; Crane is inactive in the CRM but billed recently.
const raw = exportsWith({
  crm: [
    'C-1,Acme Retail,Retail,Toledo,OH,L. Brennan,2020-01-01,Active',
    'C-2,Bolt Logistics,Logistics,Toledo,OH,,2020-01-01,Active',
    'C-3,Crane Inns,Hospitality,Toledo,OH,M. Okoro,2020-01-01,Inactive',
  ],
  quickbooks: ['INV-1,Acme Retail,03/01/2025,$1000.00,Paid,Credit memo'],
  netsuite: [
    'NS-1,C-1,2025-05-01,1000.00,USD,paid,Repair',
    'NS-2,C-1,2026-06-01,500.00,USD,paid,Repair',
    'NS-2,C-1,2026-06-01,500.00,USD,paid,Repair',
    'NS-3,C-1,2026-09-30,1000.00,USD,paid,Repair',
    'NS-4,C-2,2025-04-15,2000.00,USD,paid,Monitoring',
    'NS-5,C-3,2026-09-15,300.00,USD,open,Repair',
  ],
  contracts: [
    'CTR-1,C-1,2024-01-01,2026-06-30,1000.0,Monthly,Yes,Gold',
    'CTR-2,C-2,2025-01-01,2027-12-31,100000.0,Monthly,Yes,Gold',
  ],
  notes: ['N-1,Acme Retail,2026-01-01,L. Brennan,All good.', 'N-2,Prospect Co,2026-02-01,M. Okoro,Toured sites.'],
});

const inputs: Inputs = { raw, reference, assumptions: assumptionsWith() };
const findings = detectFindings(inputs, build(inputs));
const finding = (id: string) => findings.find((f) => f.id === id) as Finding;
const keys = (id: string) => finding(id)?.cases.map((c) => c.key);

describe('withRuleReversed', () => {
  it('turns only that rule the other way', () => {
    const reversed = withRuleReversed(inputs, 'voidedInvoices');
    expect(reversed.assumptions.voidedInvoices.applies).toBe(false);
    expect(reversed.assumptions.duplicateInvoices.applies).toBe(true);
  });
});

describe('assumptions', () => {
  it('lists the invoices a rule changes, and what reversing it would do to the headline', () => {
    const duplicates = finding('duplicateInvoices');
    expect(duplicates.cases.map((c) => [c.key, c.amount])).toEqual([['netsuite:NS-2', 500]]);
    expect(duplicates.rule).toMatchObject({ name: 'duplicateInvoices', applies: true, status: 'open' });
    expect(duplicates.impact).toMatchObject({ measure: 'H1 FY27 against H1 FY26', unit: 'percent' });
    expect(duplicates.impact?.ifReversed).not.toBe(duplicates.impact?.asConfigured);
  });

  it('leaves out a rule that changes nothing in this data', () => {
    expect(finding('voidedInvoices')).toBeUndefined();
    expect(finding('duplicateCustomers')).toBeUndefined();
  });
});

describe('observations', () => {
  it('lists contracts billed well below their value', () => {
    expect(keys('contractsBilledUnder')).toEqual(['CTR-2']);
    expect(finding('contractsBilledUnder').worthChecking).toBe(true);
  });

  it('lists customers still billing after their contract ended', () => {
    expect(keys('expiredContractsStillBilling')).toEqual(['CTR-1']);
  });

  it('lists customers still billing with no note in the last twelve months', () => {
    expect(keys('notesCoverage')).toEqual(['C-3']);
  });

  it('lists notes linked to no customer', () => {
    expect(keys('unlinkedNotes')).toEqual(['N-2']);
  });

  it('lists customers without an account manager, with what one that stopped billed before leaving', () => {
    const [bolt] = finding('noAccountManager').cases;
    expect(bolt).toMatchObject({ key: 'C-2', amount: 2000 });
    expect(bolt.detail).toBe('At stake: the 12 months to its last invoice, 2025-04-15.');
  });

  it('lists customers whose CRM status contradicts their billing', () => {
    expect(keys('crmStatus')).toEqual(['C-2', 'C-3']);
  });

  it('marks informative observations as not worth checking', () => {
    expect(finding('crmStatus').worthChecking).toBe(false);
  });
});

describe('contracts that end before they start', () => {
  // As of 2026-09-30. Acme's contract ended in June and is exported twice; Bolt's ends before it starts.
  const contractInputs: Inputs = {
    raw: exportsWith({
      crm: [
        'C-1,Acme Retail,Retail,Toledo,OH,L. Brennan,2020-01-01,Active',
        'C-2,Bolt Logistics,Logistics,Toledo,OH,M. Okoro,2020-01-01,Active',
      ],
      netsuite: ['NS-1,C-1,2026-09-30,1000.00,USD,paid,Repair', 'NS-2,C-2,2026-09-30,1000.00,USD,paid,Repair'],
      contracts: [
        'CTR-1,C-1,2024-01-01,2026-06-30,1000.0,Monthly,Yes,Gold',
        'CTR-1,C-1,2024-01-01,2026-06-30,1000.0,Monthly,Yes,Gold',
        'CTR-2,C-2,2025-01-01,2024-12-31,1000.0,Monthly,Yes,Gold',
      ],
    }),
    reference,
    assumptions: assumptionsWith(),
  };
  const contractFindings = detectFindings(contractInputs, build(contractInputs));
  const dates = contractFindings.find((f) => f.id === 'impossibleContractDates') as Finding;

  it('counts a current contract exported twice once', () => {
    expect(dates.impact?.asConfigured).toBe(1);
    expect(dates.impact?.ifReversed).toBe(2);
  });
});

describe('contracts billed below their value', () => {
  // As of 2026-09-30. Neither customer billed in the last twelve months. Acme's contract runs to 2027;
  // Bolt's ends before it starts, so its end is unknown and whether it should bill cannot be told.
  const contractInputs: Inputs = {
    raw: exportsWith({
      crm: [
        'C-1,Acme Retail,Retail,Toledo,OH,L. Brennan,2020-01-01,Active',
        'C-2,Bolt Logistics,Logistics,Toledo,OH,M. Okoro,2020-01-01,Active',
        'C-3,Crane Inns,Hospitality,Toledo,OH,M. Okoro,2020-01-01,Active',
      ],
      netsuite: ['NS-1,C-3,2026-09-30,1000.00,USD,paid,Repair'],
      contracts: [
        'CTR-1,C-1,2024-01-01,2027-12-31,50000.0,Monthly,Yes,Gold',
        'CTR-2,C-2,2025-01-01,2023-12-31,50000.0,Monthly,Yes,Gold',
      ],
    }),
    reference,
    assumptions: assumptionsWith(),
  };
  const contractFindings = detectFindings(contractInputs, build(contractInputs));
  const under = contractFindings.find((f) => f.id === 'contractsBilledUnder') as Finding;

  it('leaves out a contract whose end is unknown', () => {
    expect(under.cases.map((c) => c.key)).toEqual(['CTR-1']);
  });
});
