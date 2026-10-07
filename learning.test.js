'use strict';
const assert = require('node:assert/strict');
const lessons = require('./learning.js');
const lab = (counts, extra = {}) => ({ counts, charge: 0, dirty: false, mode: 'formula', ...extra });
const cases = [
  ['water-atoms', lab({ H: 2, O: 1 }, { mode: 'atoms' }), {}, lab({ H: 2, O: 1 }, { mode: 'atoms', dirty: true }), {}],
  ['carbon-dioxide', lab({ C: 1, O: 2 }), {}, lab({ C: 1, O: 1 }), {}],
  ['salt-search', lab({ Na: 1, Cl: 1 }, { compoundId: 'salt', compoundState: 'solid' }), {}, lab({ Na: 1, Cl: 1 }, { compoundId: null, compoundState: 'solid' }), {}],
  ['baking-soda', lab({ Na: 1, H: 1, C: 1, O: 3 }, { compoundId: 'baking', libraryQuery: '小蘇打' }), {}, lab({ Na: 1, H: 1, C: 1, O: 3 }, { compoundId: 'baking', libraryQuery: 'NaHCO3' }), {}],
  ['hydrate', lab({ Cu: 1, S: 1, O: 9, H: 10 }), { hydrogen: '10', oxygen: '9' }, lab({ Cu: 1, S: 1, O: 9, H: 10 }), { hydrogen: '10', oxygen: '5' }],
  ['ion-charge', lab({ S: 1, O: 4 }, { charge: -2 }), {}, lab({ S: 1, O: 4 }, { charge: 2 }), {}],
  ['isomers', {}, { choice: 'different' }, {}, { choice: 'same' }],
  ['water-balance', {}, { h2: '2', o2: '1', h2o: '2' }, {}, { h2: '4', o2: '2', h2o: '4' }],
  ['carbon-dioxide-state', {}, { choice: 'gas' }, {}, { choice: 'solid' }],
  ['conservation', {}, { hBefore: '4', hAfter: '4', oBefore: '2', oAfter: '2' }, {}, { hBefore: '2', hAfter: '2', oBefore: '1', oAfter: '1' }]
];
for (const [id, state, answers, wrongState, wrongAnswers] of cases) {
  assert.equal(lessons.evaluate(id, state, answers).ok, true, id + ' should accept the correct answer');
  assert.equal(lessons.evaluate(id, wrongState, wrongAnswers).ok, false, id + ' should reject the meaningful wrong answer');
  for (const malformed of [null, undefined, [], 'oops', 7]) assert.equal(lessons.evaluate(id, malformed, malformed).ok, false, id + ' malformed input must not pass');
}
assert.equal(lessons.evaluate('unknown', {}, {}).ok, false);
assert.equal(lessons.evaluate('water-atoms', lab({ H: 2, O: 1, C: 1 }, { mode: 'atoms' }), {}).ok, false, 'extra atom rejected');
assert.equal(lessons.evaluate('water-atoms', lab({ H: '2', O: 1 }, { mode: 'atoms' }), {}).ok, false, 'string counts rejected');
assert.equal(lessons.evaluate('carbon-dioxide', lab({ C: 1, O: 2 }, { charge: 1 }), {}).ok, false, 'wrong charge rejected');
assert.equal(lessons.evaluate('hydrate', {}, { hydrogen: 10, oxygen: 9 }).ok, false, 'must actually parse hydrate');
for (const value of ['2.0', '2e0', '  ', null, [], {}, '0', '-2']) assert.equal(lessons.evaluate('water-balance', {}, { h2: value, o2: '1', h2o: '2' }).ok, false, 'invalid coefficient rejected');
assert.match(lessons.evaluate('water-balance', {}, { h2: '4', o2: '2', h2o: '4' }).message, /最簡/);
assert.deepEqual(lessons.sanitizeProgress({ completed: ['water-atoms', 'unknown', 'water-atoms', {}, 'ion-charge'], current: 'unknown' }), { completed: ['water-atoms', 'ion-charge'], current: 'water-atoms' });
assert.deepEqual(lessons.sanitizeProgress(null), { completed: [], current: 'water-atoms' });
assert.equal(lessons.tasks.length, 10);
console.log('Learning missions: 10 correct paths, 10 incorrect paths, malformed-state rejection, coefficient and saved-progress checks passed.');
