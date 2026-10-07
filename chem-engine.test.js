'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const Chem = require('./chem-engine.js');
let passed = 0;
function test(name, fn) {
  try { fn(); passed++; }
  catch (error) { console.error('FAIL:', name); throw error; }
}
function expectError(fn, code) {
  assert.throws(fn, error => error instanceof Chem.ChemError && (!code || error.code === code) && /[\u4e00-\u9fff]/.test(error.message));
}
function conserved(result) {
  const totals = side => {
    const counts = {};
    let charge = 0n;
    for (const item of side) {
      assert(Number.isSafeInteger(item.coefficient) && item.coefficient > 0);
      const n = BigInt(item.coefficient);
      for (const [symbol, count] of Object.entries(item.counts)) counts[symbol] = (counts[symbol] || 0n) + BigInt(count) * n;
      charge += BigInt(item.charge) * n;
    }
    return { counts: Object.fromEntries(Object.entries(counts).sort()), charge };
  };
  assert.deepEqual(totals(result.reactants), totals(result.products));
  function gcd(a, b) { while (b) [a, b] = [b, a % b]; return a; }
  assert.equal([...result.reactants, ...result.products].map(s => BigInt(s.coefficient)).reduce(gcd), 1n);
}
const formulas = [
  ['H2O', { H: 2, O: 1 }, 3, 0, 'H2O'],
  [' H₂ O ', { H: 2, O: 1 }, 3, 0, 'H2O'],
  ['Ca(OH)2', { Ca: 1, O: 2, H: 2 }, 5, 0, 'Ca(OH)2'],
  ['K4[Fe(CN)6]', { K: 4, Fe: 1, C: 6, N: 6 }, 17, 0, 'K4[Fe(CN)6]'],
  ['Al2(SO4)3', { Al: 2, S: 3, O: 12 }, 17, 0, 'Al2(SO4)3'],
  ['((CH3)2)3', { C: 6, H: 18 }, 24, 0, '((CH3)2)3'],
  ['CuSO4·5H2O', { Cu: 1, S: 1, O: 9, H: 10 }, 21, 0, 'CuSO4·5H2O'],
  ['CuSO4.5H2O', { Cu: 1, S: 1, O: 9, H: 10 }, 21, 0, 'CuSO4·5H2O'],
  ['Na2CO3∙10H2O', { Na: 2, C: 1, O: 13, H: 20 }, 36, 0, 'Na2CO3·10H2O'],
  ['H2O·2H2O·3H2O', { H: 12, O: 6 }, 18, 0, 'H2O·2H2O·3H2O'],
  ['[Fe(CN)6]^4-', { Fe: 1, C: 6, N: 6 }, 13, -4, '[Fe(CN)6]^4-'],
  ['SO₄²⁻', { S: 1, O: 4 }, 5, -2, 'SO4^2-'],
  ['NH4^1+', { N: 1, H: 4 }, 5, 1, 'NH4^+'],
  ['e^-', {}, 0, -1, 'e^-'],
  ['e⁻', {}, 0, -1, 'e^-'],
  ['H1000000', { H: 1000000 }, 1000000, 0, 'H1000000'],
];
for (const [input, counts, totalAtoms, charge, normalized] of formulas) test('parse ' + input, () => {
  assert.deepEqual(Chem.parseFormula(input), { counts, totalAtoms, charge, normalized });
});
test('all 118 unique elements recognized', () => {
  assert.equal(Chem.elementSymbols.length, 118);
  assert.equal(new Set(Chem.elementSymbols).size, 118);
  for (const symbol of Chem.elementSymbols) assert.deepEqual(Chem.parseFormula(symbol).counts, { [symbol]: 1 });
});
const invalidFormulas = [
  ['', 'EMPTY_FORMULA'], ['Xx2', 'UNKNOWN_ELEMENT'], ['h2O', 'INVALID_SYMBOL'],
  ['H0', 'INVALID_COUNT'], ['H01', 'INVALID_COUNT'], ['H1000001', 'COUNT_TOO_LARGE'],
  ['(H1000)1001', 'COUNT_TOO_LARGE'], ['H500001O500000', 'COUNT_TOO_LARGE'],
  ['()', 'EMPTY_GROUP'], ['Fe[]', 'EMPTY_GROUP'], ['Ca(OH]2', 'UNMATCHED_GROUP'],
  ['Ca(OH2', 'UNMATCHED_GROUP'], ['H2O)', 'UNMATCHED_GROUP'],
  ['CuSO4·', 'INVALID_HYDRATE'], ['·H2O', 'INVALID_HYDRATE'], ['CuSO4··H2O', 'INVALID_HYDRATE'],
  ['CuSO4·5', 'INVALID_HYDRATE'], ['CuSO4·0H2O', 'INVALID_COUNT'], ['2H2O', 'LEADING_COEFFICIENT'],
  ['H2O(aq)', 'INVALID_SYMBOL'], ['Na+', 'INVALID_CHARGE'], ['Fe3+', 'INVALID_CHARGE'],
  ['SO4^2', 'INVALID_CHARGE'], ['H^0+', 'INVALID_COUNT'], ['^+', 'EMPTY_FORMULA'],
  ['e', 'INVALID_ELECTRON'], ['e^+', 'INVALID_ELECTRON'], ['e^2-', 'INVALID_ELECTRON'],
  ['H2/O', 'INVALID_FORMULA'], ['H'.repeat(1001), 'INPUT_TOO_LONG'], [null, 'INVALID_INPUT'],
];
for (const [input, code] of invalidFormulas) test('reject ' + String(input).slice(0, 25), () => expectError(() => Chem.parseFormula(input), code));
const equations = [
  ['Fe + O2 -> Fe2O3', [4, 3, 2]],
  ['C6H12O6 + O2 -> CO2 + H2O', [1, 6, 6, 6]],
  ['C2H6 + O2 -> CO2 + H2O', [2, 7, 4, 6]],
  ['C2H5OH + O2 -> CO2 + H2O', [1, 3, 2, 3]],
  ['H2 + Cl2 -> HCl', [1, 1, 2]],
  ['Al + HCl -> AlCl3 + H2', [2, 6, 2, 3]],
  ['Ca(OH)2 + H3PO4 -> Ca3(PO4)2 + H2O', [3, 2, 1, 6]],
  ['FeS2 + O2 -> Fe2O3 + SO2', [4, 11, 2, 8]],
  ['KMnO4 + HCl -> KCl + MnCl2 + H2O + Cl2', [2, 16, 2, 2, 8, 5]],
  ['K2Cr2O7 + HCl -> KCl + CrCl3 + H2O + Cl2', [1, 14, 2, 2, 7, 3]],
  ['CuSO4·5H2O -> CuSO4 + H2O', [1, 1, 5]],
  ['H^+ + OH^- -> H2O', [1, 1, 1]],
  ['Fe^3++e^-->Fe^2+', [1, 1, 1]],
  ['Fe³⁺ + e⁻ → Fe²⁺', [1, 1, 1]],
  ['[Fe(CN)6]^4- + Ce^4+ -> [Fe(CN)6]^3- + Ce^3+', [1, 1, 1, 1]],
  ['MnO4^- + Fe^2+ + H^+ -> Mn^2+ + Fe^3+ + H2O', [1, 5, 8, 1, 5, 4]],
  ['MnO4^- + H^+ + e^- -> Mn^2+ + H2O', [1, 8, 5, 1, 4]],
  ['Cr2O7^2- + H^+ + e^- -> Cr^3+ + H2O', [1, 14, 6, 2, 7]],
  ['NO3^- + H^+ + Cu -> NO + Cu^2+ + H2O', [2, 8, 3, 2, 3, 4]],
  ['Cl2+OH^-->Cl^-+ClO^-+H2O', [1, 2, 1, 1, 1]],
  ['H999983+O999979->HO', [999979, 999983, 999962000357]],
  ['9 H₂ + 8 O₂ = 10 H₂O', [2, 1, 2]],
  ['H2+O2=>H2O', [2, 1, 2]],
  ['H2+O2→H2O', [2, 1, 2]],
  ['e^- -> e^-', [1, 1]],
];
for (const [input, expected] of equations) test('balance ' + input, () => {
  const result = Chem.balanceEquation(input);
  assert.deepEqual([...result.reactants, ...result.products].map(s => s.coefficient), expected);
  conserved(result);
  assert.deepEqual(Chem.balanceEquation(result.equation), result);
});
const invalidEquations = [
  ['H2 + O2', 'INVALID_ARROW'], ['H2 -> O2 -> H2O', 'INVALID_ARROW'],
  ['-> H2O', 'EMPTY_SIDE'], ['H2 ->', 'EMPTY_SIDE'], ['H2++O2->H2O', 'EMPTY_SPECIES'],
  ['H2+->H2O', 'EMPTY_SPECIES'], ['2->H2O', 'EMPTY_SPECIES'], ['0H2 + O2 -> H2O', 'INVALID_COUNT'],
  ['H2 -> H2O', 'MISSING_ELEMENT'], ['Fe^2+ -> Fe^3+', 'IMPOSSIBLE_EQUATION'],
  ['H2+O2->H2O+H2O2', 'UNDERDETERMINED'], ['H2+H2->H2', 'UNDERDETERMINED'],
  ['H2O+CO2->H2+CO', 'NO_POSITIVE_SOLUTION'],
  ['H999983+He999979+Li999961->HHeLi', 'COEFFICIENT_TOO_LARGE'],
  ['H'.repeat(1001), 'INPUT_TOO_LONG'],
];
for (const [input, code] of invalidEquations) test('reject equation ' + input.slice(0, 40), () => expectError(() => Chem.balanceEquation(input), code));
test('Unicode formatting preserves hydrate multipliers and charge', () => {
  assert.equal(Chem.formatFormula('CuSO4·5H2O'), 'CuSO₄·5H₂O');
  assert.equal(Chem.formatFormula('[Fe(CN)6]^4-'), '[Fe(CN)₆]⁴⁻');
  assert.equal(Chem.formatFormula('e^-'), 'e⁻');
  for (const [formula] of formulas) assert.deepEqual(Chem.parseFormula(Chem.formatFormula(formula)), Chem.parseFormula(formula));
});
test('100 alkane combustion balances conserve atoms and are reduced', () => {
  for (let carbon = 1; carbon <= 100; carbon++) {
    const result = Chem.balanceEquation('C' + carbon + 'H' + (2 * carbon + 2) + '+O2->CO2+H2O');
    conserved(result);
    const coefficients = [...result.reactants, ...result.products].map(s => s.coefficient);
    const scale = carbon % 2 ? 1 : 2;
    assert.deepEqual(coefficients, [scale, scale * (3 * carbon + 1) / 2, scale * carbon, scale * (carbon + 1)]);
  }
});
test('browser IIFE exports without CommonJS', () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'chem-engine.js'), 'utf8'), context);
  assert.equal(context.ChemEngine.balanceEquation('Fe+O2->Fe2O3').equation, '4 Fe + 3 O2 → 2 Fe2O3');
});
test('reactant-only inputs preserve ionic species and reject invalid syntax', () => {
  assert.deepEqual(Chem.parseReactants('2 H2 + O2').map(s => s.formula), ['H2', 'O2']);
  assert.deepEqual(Chem.parseReactants('Fe^2+ + Ce^4+').map(s => s.charge), [2, 4]);
  assert.deepEqual(Chem.parseReactants('CuSO4·5H2O').map(s => s.counts), [{Cu:1,S:1,O:9,H:10}]);
  expectError(() => Chem.parseReactants('H2 +'), 'EMPTY_SPECIES');
  expectError(() => Chem.parseReactants('H2 = H2'), 'UNEXPECTED_ARROW');
  expectError(() => Chem.parseReactants(''));
});
console.log('PASS: ' + passed + ' test groups, including all 118 symbols and 100 generated combustion reactions.');
