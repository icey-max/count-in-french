export const LEVELS = Array.from({ length: 10 }, (_, index) => {
  const start = index * 10 + 1;
  const end = start + 9;
  return {
    id: index + 1,
    title: `Level ${index + 1}`,
    range: `${start}-${end}`,
    start,
    end,
  };
});

const SIMPLE_NUMBERS = new Map([
  [0, 'zéro'],
  [1, 'un'],
  [2, 'deux'],
  [3, 'trois'],
  [4, 'quatre'],
  [5, 'cinq'],
  [6, 'six'],
  [7, 'sept'],
  [8, 'huit'],
  [9, 'neuf'],
  [10, 'dix'],
  [11, 'onze'],
  [12, 'douze'],
  [13, 'treize'],
  [14, 'quatorze'],
  [15, 'quinze'],
  [16, 'seize'],
]);

const TENS = new Map([
  [20, 'vingt'],
  [30, 'trente'],
  [40, 'quarante'],
  [50, 'cinquante'],
  [60, 'soixante'],
]);

const PRONUNCIATION = new Map([
  [0, 'zay-roh'],
  [1, 'uhn'],
  [2, 'duh'],
  [3, 'twah'],
  [4, 'katr'],
  [5, 'sank'],
  [6, 'sees'],
  [7, 'set'],
  [8, 'weet'],
  [9, 'nuhf'],
  [10, 'dees'],
  [11, 'onz'],
  [12, 'dooz'],
  [13, 'trehz'],
  [14, 'kah-torz'],
  [15, 'kanz'],
  [16, 'sehz'],
  [20, 'van'],
  [30, 'tront'],
  [40, 'kah-rahnt'],
  [50, 'san-kahnt'],
  [60, 'swah-sahnt'],
  [80, 'katr-van'],
  [100, 'sahn'],
]);

export const QUESTION_TYPES = [
  {
    id: 'number-to-french',
    label: 'Number -> French',
    promptLabel: 'Write the French spelling',
    inputMode: 'text',
    expectedKind: 'french',
  },
  {
    id: 'french-to-number',
    label: 'French -> Number',
    promptLabel: 'Write the number',
    inputMode: 'numeric',
    expectedKind: 'number',
  },
  {
    id: 'audio-to-number',
    label: 'Audio -> Number',
    promptLabel: 'Listen and write the number',
    inputMode: 'numeric',
    expectedKind: 'number',
    audioOnly: true,
  },
  {
    id: 'audio-to-french',
    label: 'Audio -> French',
    promptLabel: 'Listen and write the French spelling',
    inputMode: 'text',
    expectedKind: 'french',
    audioOnly: true,
  },
];

export function numberToFrench(number) {
  if (!Number.isInteger(number) || number < 0 || number > 100) {
    throw new RangeError('French Numbers Mastery supports numbers from 0 to 100.');
  }

  if (number === 0) return SIMPLE_NUMBERS.get(0);
  if (number === 100) return 'cent';
  if (number <= 16) return SIMPLE_NUMBERS.get(number);
  if (number < 20) return `dix-${SIMPLE_NUMBERS.get(number - 10)}`;
  if (number < 70) return composeRegularTens(number);
  if (number < 80) return composeSeventies(number);
  if (number < 90) return composeEighties(number);
  return composeNineties(number);
}

function composeRegularTens(number) {
  const ten = Math.floor(number / 10) * 10;
  const unit = number % 10;
  const tenWord = TENS.get(ten);

  if (unit === 0) return tenWord;
  if (unit === 1) return `${tenWord}-et-un`;
  return `${tenWord}-${SIMPLE_NUMBERS.get(unit)}`;
}

function composeSeventies(number) {
  if (number === 71) return 'soixante-et-onze';
  return `soixante-${numberToFrench(number - 60)}`;
}

function composeEighties(number) {
  if (number === 80) return 'quatre-vingts';
  return `quatre-vingt-${numberToFrench(number - 80)}`;
}

function composeNineties(number) {
  return `quatre-vingt-${numberToFrench(number - 80)}`;
}

export function numberToPronunciation(number) {
  if (PRONUNCIATION.has(number)) return PRONUNCIATION.get(number);
  if (number < 20) return `dees-${PRONUNCIATION.get(number - 10)}`;
  if (number < 70) return pronounceRegularTens(number);
  if (number < 80) return pronounceCompound(60, number - 60, number === 71);
  if (number === 80) return PRONUNCIATION.get(80);
  if (number < 90) return `katr-van-${numberToPronunciation(number - 80)}`;
  return `katr-van-${numberToPronunciation(number - 80)}`;
}

function pronounceRegularTens(number) {
  const ten = Math.floor(number / 10) * 10;
  const unit = number % 10;
  const tenGuide = PRONUNCIATION.get(ten);

  if (unit === 0) return tenGuide;
  if (unit === 1) return `${tenGuide}-ay-uhn`;
  return `${tenGuide}-${PRONUNCIATION.get(unit)}`;
}

function pronounceCompound(base, remainder, withEt = false) {
  const connector = withEt ? '-ay-' : '-';
  return `${PRONUNCIATION.get(base)}${connector}${numberToPronunciation(remainder)}`;
}

export function normalizeFrenchAnswer(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[\s\-']/g, '');
}

export function normalizeNumberAnswer(value) {
  const normalized = String(value).trim();
  if (!/^\d+$/.test(normalized)) return Number.NaN;
  return Number(normalized);
}

export function validateAnswer(value, card, expectedKind) {
  if (expectedKind === 'number') {
    return normalizeNumberAnswer(value) === card.number;
  }

  return normalizeFrenchAnswer(value) === normalizeFrenchAnswer(card.french);
}

export function buildNumberCards() {
  return Array.from({ length: 100 }, (_, index) => buildNumberCard(index + 1));
}

export function buildNumberCard(number) {
  if (!Number.isInteger(number) || number < 0 || number > 100) {
    throw new RangeError('French Numbers Mastery supports numbers from 0 to 100.');
  }

  return {
    number,
    french: numberToFrench(number),
    pronunciation: numberToPronunciation(number),
    levelId: number === 0 ? null : Math.ceil(number / 10),
  };
}

export const NUMBER_CARDS = buildNumberCards();

export const PATTERN_LESSONS = {
  7: {
    eyebrow: 'Pattern lesson: 70 begins the twist',
    title: 'French builds 70 as 60 + 10',
    explanation:
      'Instead of a new word for seventy, French says soixante-dix: sixty-ten. This is the bridge into 70-79.',
    examples: [
      { number: 70, math: '60 + 10', french: numberToFrench(70) },
      { number: 71, math: '60 + 11', french: numberToFrench(71) },
      { number: 72, math: '60 + 12', french: numberToFrench(72) },
    ],
  },
  8: {
    eyebrow: 'Pattern lesson: 70-79 and 80',
    title: 'Finish the sixties-plus pattern, then meet four twenties',
    explanation:
      'The 70s continue as 60 plus a teen number. Then 80 becomes quatre-vingts, literally four twenties.',
    examples: [
      { number: 79, math: '60 + 19', french: numberToFrench(79) },
      { number: 80, math: '4 x 20', french: numberToFrench(80) },
    ],
  },
  9: {
    eyebrow: 'Pattern lesson: 80-89 and 90',
    title: 'After 80, count upward from four twenties',
    explanation:
      'For 81-89, French keeps quatre-vingt and adds the unit. At 90, it becomes quatre-vingt-dix: eighty-ten.',
    examples: [
      { number: 81, math: '80 + 1', french: numberToFrench(81) },
      { number: 89, math: '80 + 9', french: numberToFrench(89) },
      { number: 90, math: '80 + 10', french: numberToFrench(90) },
    ],
  },
  10: {
    eyebrow: 'Pattern lesson: 90-99',
    title: 'The 90s are 80 plus teen numbers',
    explanation:
      'French does not use a separate word for ninety. It says quatre-vingt plus ten through nineteen.',
    examples: [
      { number: 91, math: '80 + 11', french: numberToFrench(91) },
      { number: 95, math: '80 + 15', french: numberToFrench(95) },
      { number: 99, math: '80 + 19', french: numberToFrench(99) },
    ],
  },
};
