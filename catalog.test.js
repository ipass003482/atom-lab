'use strict';
// Run with: node catalog.test.js (no network or third-party dependencies).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Chem = require('./chem-engine.js');
const { create } = require('./catalog.js');
require('./chem-data.js');
const data = globalThis.ChemData;
const catalog = create(data, Chem);
let passed = 0;
function test(name, fn) {
  try { fn(); passed++; }
  catch (error) { console.error('FAIL:', name); throw error; }
}
const sorted = value => Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
const ids = items => items.map(item => item.id);
const teachingCompounds = data.compounds.filter(item => item.provenance === 'teaching');
const pubchemCompounds = data.compounds.filter(item => item.provenance === 'pubchem');
const teachingReactions = data.reactions.filter(item => item.provenance === 'teaching');
const rheaReactions = data.reactions.filter(item => item.provenance === 'rhea');

// Independently check the stored coefficients, using integer atom and charge totals.
// This deliberately does not ask the unique-nullspace solver to rebalance Rhea.
function totals(side) {
  assert(Object.keys(side).length > 0, 'reaction side must not be empty');
  const atoms = {};
  let charge = 0n;
  for (const [formula, coefficient] of Object.entries(side)) {
    assert(Number.isSafeInteger(coefficient) && coefficient > 0, 'invalid coefficient for ' + formula);
    const parsed = Chem.parseFormula(formula);
    for (const [symbol, count] of Object.entries(parsed.counts)) {
      atoms[symbol] = (atoms[symbol] || 0n) + BigInt(count) * BigInt(coefficient);
    }
    charge += BigInt(parsed.charge) * BigInt(coefficient);
  }
  return { atoms: sorted(atoms), charge };
}
function equationSides(equation) {
  const parts = equation.split(' → ');
  assert.equal(parts.length, 2, 'stored equation must have exactly one arrow');
  return parts.map(side => {
    const result = {};
    for (const term of side.split(' + ')) {
      const match = term.match(/^(?:(\d+)\s+)?(.+)$/);
      assert(match, 'invalid equation term ' + term);
      const coefficient = match[1] ? Number(match[1]) : 1;
      const formula = Chem.parseFormula(match[2]).normalized;
      assert(!Object.hasOwn(result, formula), 'equation repeats a formula on one side');
      result[formula] = coefficient;
    }
    return sorted(result);
  });
}

test('snapshot counts and unique record IDs within each catalogue', () => {
  assert.equal(data.compounds.length, 1648);
  assert.equal(teachingCompounds.length, 148);
  assert.equal(pubchemCompounds.length, 1500);
  assert.equal(data.reactions.length, 2078);
  assert.equal(teachingReactions.length, 50);
  assert.equal(rheaReactions.length, 2028);
  const records = [...data.compounds, ...data.reactions];
  assert(records.every(record => typeof record.id === 'string' && record.id.length > 0));
  assert.equal(new Set(ids(data.compounds)).size, data.compounds.length);
  assert.equal(new Set(ids(data.reactions)).size, data.reactions.length);
});

test('every compound formula agrees with stored counts and source formula', () => {
  for (const compound of data.compounds) {
    const parsed = Chem.parseFormula(compound.formula);
    assert.deepEqual(sorted(parsed.counts), sorted(compound.counts), compound.id);
    assert.equal(parsed.charge, compound.charge || 0, compound.id);
    assert(Number.isFinite(Number(compound.mass)) && Number(compound.mass) > 0, compound.id);
    assert(compound.name && compound.english, compound.id);
    assert(['solid', 'liquid', 'gas', 'unknown'].includes(compound.state), compound.id);
    if (compound.sourceFormula) {
      assert.deepEqual(sorted(Chem.parseFormula(compound.sourceFormula).counts), sorted(compound.counts), compound.id);
    }
  }
});

test('PubChem provenance has unique CIDs, direct source links, and explicit unknown properties', () => {
  const withCid = data.compounds.filter(compound => compound.pubchemCid !== undefined);
  assert.equal(new Set(withCid.map(compound => compound.pubchemCid)).size, withCid.length);
  for (const compound of pubchemCompounds) {
    assert(Number.isSafeInteger(compound.pubchemCid) && compound.pubchemCid > 0, compound.id);
    assert.equal(compound.id, 'pubchem-' + compound.pubchemCid);
    assert.equal(compound.sourceUrl, 'https://pubchem.ncbi.nlm.nih.gov/compound/' + compound.pubchemCid);
    assert.equal(compound.state, 'unknown', compound.id);
    assert.equal(compound.hazard, 'unknown', compound.id);
    assert.equal(compound.category, 'public', compound.id);
    assert(!compound.compositionSafe, compound.id);
    assert(compound.aliases.includes('CID ' + compound.pubchemCid), compound.id);
  }
});

test('all 2078 stored reactions conserve atoms and charge with their existing coefficients', () => {
  for (const reaction of data.reactions) {
    assert.deepEqual(totals(reaction.inputs), totals(reaction.outputs), reaction.id);
    const [inputs, outputs] = equationSides(reaction.equation);
    assert.deepEqual(inputs, sorted(reaction.inputs), reaction.id + ' displayed inputs');
    assert.deepEqual(outputs, sorted(reaction.outputs), reaction.id + ' displayed outputs');
    assert(Object.hasOwn(reaction.outputs, reaction.product), reaction.id + ' primary product');
  }
});

test('50 teaching equations independently rebalance to their documented coefficients', () => {
  for (const reaction of teachingReactions) {
    const result = Chem.balanceEquation(reaction.equation);
    const side = items => sorted(Object.fromEntries(items.map(item => [item.formula, item.coefficient])));
    assert.deepEqual(side(result.reactants), sorted(reaction.inputs), reaction.id);
    assert.deepEqual(side(result.products), sorted(reaction.outputs), reaction.id);
  }
});

test('Rhea records preserve source identity, attribution, named participants, and source coefficients', () => {
  assert.equal(new Set(rheaReactions.map(reaction => reaction.rheaId)).size, rheaReactions.length);
  for (const reaction of rheaReactions) {
    assert(Number.isSafeInteger(reaction.rheaId) && reaction.rheaId > 0, reaction.id);
    assert.equal(reaction.id, 'rhea-' + reaction.rheaId);
    assert.equal(reaction.sourceUrl, 'https://www.rhea-db.org/rhea/' + reaction.rheaId);
    assert.equal(reaction.license, 'CC BY 4.0', reaction.id);
    assert.equal(reaction.prebalanced, true, reaction.id);
    assert.equal(reaction.autoMatch, false, reaction.id);
    assert.equal(reaction.sourceVerified, true, reaction.id);
    assert(reaction.source.includes('Rhea') && reaction.namedEquation, reaction.id);
    for (const [namedSide, formulaSide] of [['reactants', 'inputs'], ['products', 'outputs']]) {
      const participants = reaction.participantNames[namedSide];
      assert(participants.length > 0 && participants.every(item => item.name), reaction.id);
      const aggregated = {};
      for (const participant of participants) {
        assert(Number.isSafeInteger(participant.coefficient) && participant.coefficient > 0, reaction.id);
        aggregated[participant.formula] = (aggregated[participant.formula] || 0) + participant.coefficient;
      }
      assert.deepEqual(sorted(aggregated), sorted(reaction[formulaSide]), reaction.id);
    }
  }
});

// Load the actual browser's source-validation function without creating a DOM.
const onlineSource = fs.readFileSync(path.join(__dirname, 'online-ui.js'), 'utf8');
const uiBoundary = onlineSource.indexOf('\nfunction loadPrebalanced(');
assert(uiBoundary > 0, 'source validation helper must precede the DOM-dependent UI');
const uiContext = vm.createContext({ ChemEngine: Chem });
vm.runInContext(onlineSource.slice(0, uiBoundary), uiContext);
const validatedSourceReaction = uiContext.validatedSourceReaction;

test('browser source validator accepts every Rhea record without recomputing coefficients', () => {
  for (const reaction of rheaReactions) {
    const result = validatedSourceReaction(reaction);
    assert.equal(result.equation, reaction.equation, reaction.id);
    for (const [items, source] of [[result.reactants, reaction.inputs], [result.products, reaction.outputs]]) {
      assert.equal(items.length, Object.keys(source).length, reaction.id);
      for (const item of items) assert.equal(item.coefficient, source[item.formula], reaction.id);
    }
  }
});

test('source validation accepts conserved coefficients for an underdetermined formula system', () => {
  const record = {
    inputs: { H2: 3, O2: 2 }, outputs: { H2O: 2, H2O2: 1 },
    equation: '3 H2 + 2 O2 → 2 H2O + H2O2'
  };
  assert.throws(() => Chem.balanceEquation(record.equation), error => error.code === 'UNDERDETERMINED');
  const result = validatedSourceReaction(record);
  assert.equal(result.reactants[0].coefficient, 3);
  assert.equal(result.products[0].coefficient, 2);
});

test('source validation rejects atom, charge, empty-side, and coefficient errors', () => {
  assert.throws(() => validatedSourceReaction({ inputs: { H2: 1 }, outputs: { H2O: 1 } }));
  assert.throws(() => validatedSourceReaction({ inputs: { 'Fe^2+': 1 }, outputs: { 'Fe^3+': 1 } }));
  assert.throws(() => validatedSourceReaction({ inputs: {}, outputs: {} }));
  for (const coefficient of [0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => validatedSourceReaction({ inputs: { H2: coefficient }, outputs: { H2: coefficient } }));
  }
});

test('unrecognized structural formulas cannot silently identify a same-composition substance', () => {
  assert.equal(catalog.identify('CH3CH2CHO'), null, 'propanal must not become acetone');
  assert.equal(catalog.identify('HCOOCH3'), null, 'methyl formate must not become acetic acid');
  assert.equal(catalog.identify('C2H6O'), null, 'a molecular formula is not a unique identity');
  assert.equal(catalog.identify({ C: 2, H: 6, O: 1 }), null);
  assert(catalog.candidates('CH3CH2CHO').some(compound => compound.id === 'acetone'));
  assert.deepEqual(ids(catalog.candidates('C2H6O')).sort(), ['dimethyl-ether', 'ethanol']);
});

test('explicit structural aliases identify the intended catalogue substance', () => {
  assert.equal(catalog.identify('C2H5OH').id, 'ethanol');
  assert.equal(catalog.identify(' C₂H₅OH ').id, 'ethanol');
  assert.equal(catalog.identify('CH3OCH3').id, 'dimethyl-ether');
  assert.deepEqual(ids(catalog.candidates('C2H5OH')), ['ethanol']);
  assert.equal(catalog.identify('H₂O').id, 'core-0');
  assert.equal(catalog.getCompound('ethanol').name, '乙醇');
  assert.equal(catalog.getCompound('nonexistent-id'), null);
});

test('online ions remain distinct from neutral species with identical element counts', () => {
  const ionCatalog = create({
    compounds: [
      { id: 'neutral-h', formula: 'H', counts: { H: 1 }, charge: 0, compositionSafe: true },
      { id: 'proton', formula: 'H^+', counts: { H: 1 }, charge: 1, compositionSafe: true },
      { id: 'hydride', formula: 'H^-', counts: { H: 1 }, charge: -1, compositionSafe: true }
    ], reactions: []
  }, Chem);
  assert.deepEqual(ids(ionCatalog.candidates({ H: 1 })), ['neutral-h']);
  assert.equal(ionCatalog.identify({ H: 1 }).id, 'neutral-h');
  assert.equal(ionCatalog.identify('H').id, 'neutral-h');
  assert.equal(ionCatalog.identify('H⁺').id, 'proton');
  assert.equal(ionCatalog.identify('H^-').id, 'hydride');
});

test('reaction lookup respects species identity and excludes source-only Rhea records', () => {
  assert.deepEqual(catalog.findReactions(['HCOOCH3', 'NaOH']), []);
  assert.deepEqual(catalog.findReactions(['CH3CH2CHO', 'O2']), []);
  assert(catalog.findReactions(['C2H5OH', 'O2']).some(reaction => reaction.id === 'ethanol-combustion'));
  const water = catalog.findReactions(['O2', 'H2']);
  assert(water.some(reaction => reaction.id === 'water'));
  assert(catalog.findReactions(['H2', 'O2'], ['H2O']).some(reaction => reaction.id === 'water'));
  assert.deepEqual(catalog.findReactions(['H2', 'O2'], ['H2O2']), []);
  for (const reaction of rheaReactions) {
    assert(!catalog.findReactions(reaction.inputs).some(candidate => candidate.provenance === 'rhea'), reaction.id);
  }
});

test('search supports Chinese, case-insensitive English, subscripts, aliases, and source IDs', () => {
  assert(catalog.query({ query: '乙醇' }).items.some(compound => compound.id === 'ethanol'));
  assert(catalog.query({ query: 'ETHANOL' }).items.some(compound => compound.id === 'ethanol'));
  assert(catalog.query({ query: 'C₂H₆O' }).items.some(compound => compound.id === 'dimethyl-ether'));
  assert.deepEqual(ids(catalog.query({ query: 'C2H5OH' }).items), ['ethanol']);
  assert(catalog.query({ query: 'CID 1', provenance: 'pubchem' }).items.some(compound => compound.id === 'pubchem-1'));
  assert(catalog.query({ kind: 'reactions', query: 'RHEA:10000' }).items.some(reaction => reaction.id === 'rhea-10000'));
  assert.equal(catalog.query({ query: 'zzzz_nonexistent_catalogue_record_zzzz' }).total, 0);
});

test('records with IDs shared across catalogue kinds retain their own search text', () => {
  for (const [id, query] of [
    ['silver-chloride', 'SILVER CHLORIDE'], ['barium-sulfate', 'BARIUM SULFATE'],
    ['magnesium-hydroxide', 'MAGNESIUM HYDROXIDE'], ['copper-hydroxide', 'COPPER HYDROXIDE']
  ]) {
    assert(catalog.query({ kind: 'compounds', query }).items.some(compound => compound.id === id), id);
    assert(catalog.query({ kind: 'reactions', query: data.reactions.find(reaction => reaction.id === id).name }).items.some(reaction => reaction.id === id), id);
  }
});

test('filters select source, category, state, and combinations without contaminating results', () => {
  assert.equal(catalog.query({ provenance: 'teaching' }).total, 148);
  assert.equal(catalog.query({ provenance: 'pubchem' }).total, 1500);
  assert.equal(catalog.query({ category: 'public', state: 'unknown' }).total, 1500);
  assert.equal(catalog.query({ kind: 'reactions', provenance: 'teaching' }).total, 50);
  assert.equal(catalog.query({ kind: 'reactions', provenance: 'rhea' }).total, 2028);
  assert.equal(catalog.query({ kind: 'reactions', category: 'biochemistry', provenance: 'rhea' }).total, 2028);
  assert.equal(catalog.query({ provenance: 'pubchem', state: 'liquid' }).total, 0);
  const liquids = catalog.query({ category: 'organic', state: 'liquid', provenance: 'teaching', pageSize: 200 });
  assert(liquids.total > 0 && liquids.items.some(compound => compound.id === 'ethanol'));
  assert(liquids.items.every(compound => compound.category === 'organic' && compound.state === 'liquid' && compound.provenance === 'teaching'));
});

test('pagination covers both catalogues exactly once and clamps out-of-range pages', () => {
  for (const [kind, source] of [['compounds', data.compounds], ['reactions', data.reactions]]) {
    const first = catalog.query({ kind, pageSize: 17 });
    assert.equal(first.total, source.length);
    assert.equal(first.pages, Math.ceil(source.length / 17));
    const collected = [];
    for (let page = 1; page <= first.pages; page++) {
      const result = catalog.query({ kind, pageSize: 17, page });
      assert.equal(result.page, page);
      assert(result.items.length > 0 && result.items.length <= 17);
      collected.push(...ids(result.items));
    }
    assert.deepEqual(collected, ids(source));
    assert.equal(new Set(collected).size, source.length);
    assert.equal(catalog.query({ kind, page: -10 }).page, 1);
    assert.equal(catalog.query({ kind, page: Infinity }).page, 1);
    const last = catalog.query({ kind, page: 999999, pageSize: 17 });
    assert.equal(last.page, first.pages);
    assert.deepEqual(ids(last.items), ids(source.slice((first.pages - 1) * 17)));
  }
  const empty = catalog.query({ query: 'zzzz_nonexistent_catalogue_record_zzzz', page: 8 });
  assert.deepEqual(empty, { items: [], total: 0, pages: 1, page: 1 });
});

const compositionGroups = new Map();
for (const compound of data.compounds) {
  const key = catalog.signature(compound.counts);
  compositionGroups.set(key, (compositionGroups.get(key) || 0) + 1);
}
const sharedGroups = [...compositionGroups.values()].filter(count => count > 1).length;
const chargedReactions = rheaReactions.filter(reaction =>
  [...Object.keys(reaction.inputs), ...Object.keys(reaction.outputs)].some(formula => Chem.parseFormula(formula).charge !== 0)).length;
console.log('PASS: ' + passed + ' catalogue test groups.');
console.log('Verified ' + data.compounds.length + ' compounds (' + teachingCompounds.length + ' teaching + ' + pubchemCompounds.length + ' PubChem), unique IDs/CIDs; ' + sharedGroups + ' shared-composition groups are retained as distinct records.');
console.log('Verified source coefficients for all ' + data.reactions.length + ' reactions: ' + teachingReactions.length + ' teaching equations independently solved; ' + rheaReactions.length + ' Rhea equations checked directly for atom and charge conservation (' + chargedReactions + ' include charged species).');
