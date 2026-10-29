// A keyword screen for account notes: words that often come with a customer at risk. It is written for
// any account notes, not for these ones, and it is deliberately rough. It splits the notes for the
// hand-labeled sample, and it is the baseline the LLM has to beat.

const RISK_WORDS = [
  'terminat',
  'cancel',
  'renew',
  'competitor',
  'quot',
  'bid',
  'switch',
  'missed',
  'late',
  'delay',
  'complain',
  'legal',
  'attorney',
  'lawyer',
  'citation',
  'marshal',
  'dispute',
  'overbill',
  'double',
  'price',
  'increase',
  'unhappy',
  'frustrat',
  'escalat',
  'backlog',
  'behind',
];

const pattern = new RegExp(`\\b(${RISK_WORDS.join('|')})`, 'i');

/** Whether the note mentions any word of the screen, at the start of a word. */
export function mentionsRiskWord(text: string): boolean {
  return pattern.test(text);
}
