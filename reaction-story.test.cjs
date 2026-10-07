'use strict';
const assert = require('node:assert/strict');
const Chem = require('./chem-engine.js');
const Story = require('./reaction-story.js');
let tests = 0;
function test(name, fn) { fn(); tests++; console.log('PASS',name); }
test('water preserves every atom identity and element across all animation frames', () => {
  const p = Story.createPlan(Chem.balanceEquation('H2 + O2 -> H2O'));
  assert.equal(p.enabled,true); assert.equal(p.atoms.length,6);
  assert.deepEqual(p.ledger,[{element:'H',before:'4',after:'4'},{element:'O',before:'2',after:'2'}]);
  assert.equal(new Set(p.reactants.flatMap(g => g.atoms)).size,6);
  assert.equal(new Set(p.products.flatMap(g => g.atoms)).size,6);
  for(const a of p.atoms) { assert(p.reactants[a.fromGroup].atoms.includes(a.id)); assert(p.products[a.toGroup].atoms.includes(a.id)); }
  for(const width of [280,350,700,1200]) {
    const layout = Story.layoutPlan(p,width);
    for(let step = 0; step <= 100; step++) {
      const frame = Story.interpolate(p,layout,step/100);
      assert.deepEqual(frame.map(a => [a.id,a.element]),p.atoms.map(a => [a.id,a.element]));
      for(const a of frame) { assert(a.x >= 9 && a.x <= width - 9); assert(a.y >= 9 && a.y <= layout.height - 9); }
    }
  }
});
test('combustion mapping never changes an atom element to fill a product', () => {
  const p = Story.createPlan(Chem.balanceEquation('C2H6 + O2 -> CO2 + H2O'));
  assert.equal(p.enabled,true);
  for(const g of p.products) {
    const counts = {};
    g.atoms.forEach(id => { const e = p.atoms[id].element; counts[e] = (counts[e] || 0) + 1; });
    assert.deepEqual(counts,Chem.parseFormula(g.formula).counts);
  }
});
test('unbalanced and incomplete data cannot animate', () => {
  const b = Chem.balanceEquation('H2 + O2 -> H2O'); b.reactants[0].coefficient = 1;
  assert.equal(Story.createPlan(b).valid,false); assert.equal(Story.createPlan(b).enabled,false);
  assert.equal(Story.createPlan(null).enabled,false);
  b.reactants[0].coefficient = 1.5; assert.equal(Story.createPlan(b).enabled,false);
});
test('ion and electron chemistry retains numeric charge evidence but no misleading animation', () => {
  for(const text of ['H^+ + OH^- -> H2O','Fe^3+ + e^- -> Fe^2+']) {
    const p = Story.createPlan(Chem.balanceEquation(text));
    assert.equal(p.valid,true); assert.equal(p.enabled,false); assert.match(p.reason,/電荷轉移/);
    assert.equal(p.charges[0],p.charges[1]);
  }
});
test('large atom or coefficient counts are exact, bounded, and never sampled', () => {
  const large = Story.createPlan(Chem.balanceEquation('C100H202 + O2 -> CO2 + H2O'));
  assert.equal(large.valid,true); assert.equal(large.enabled,false); assert.equal(large.atoms.length,0);
  assert.equal(large.totalAtoms,'1206'); assert.match(large.reason,/120 顆/);
  const many = Chem.balanceEquation('H2 + O2 -> H2O'); for(const s of [...many.reactants,...many.products]) s.coefficient *= 6;
  const p = Story.createPlan(many); assert.equal(p.totalAtoms,'36'); assert.equal(p.totalGroups,'30'); assert.equal(p.enabled,false);
});
test('largest permitted compact group fits narrow screens at every endpoint', () => {
  const p = Story.createPlan({reactants:[{formula:'C60',counts:{C:60},coefficient:1,charge:0}],products:[{formula:'C60',counts:{C:60},coefficient:1,charge:0}]});
  assert(p.enabled);
  const layout = Story.layoutPlan(p,280);
  for(const progress of [0,.5,1]) for(const a of Story.interpolate(p,layout,progress)) assert(a.x > 9 && a.x < 271 && a.y > 9 && a.y < layout.height - 9);
});
console.log(tests + ' reaction story tests passed.');
