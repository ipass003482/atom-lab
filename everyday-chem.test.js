'use strict';
// node everyday-chem.test.js [path-to-atom-lab] [--catalog]
const assert = require('node:assert/strict');
const path = require('node:path');
const Everyday = require('./everyday-chem.js');
const requestedPath = process.argv.slice(2).find(value => !value.startsWith('--'));
const appPath = requestedPath ? path.resolve(requestedPath) : path.resolve(__dirname, '../../outputs/atom-lab');
require(path.join(appPath, 'chem-data.js'));
const data = globalThis.ChemData;
const original = JSON.parse(JSON.stringify(data.compounds));
const compounds = Everyday.apply(data.compounds);
const byId = new Map(compounds.map(compound => [compound.id, compound]));
let checks = 0;
function check(fn) { fn(); checks++; }
check(() => assert.equal(compounds.length, original.length));
check(() => assert.deepEqual(compounds.map(({searchTerms,...chemicalData}) => chemicalData), original));
check(() => {
  const first = JSON.stringify(compounds);
  Everyday.apply(compounds);
  assert.equal(JSON.stringify(compounds), first, 'applying search terms must be idempotent');
});
for (const entry of Everyday.entries) for (const term of entry.terms) check(() => {
  assert.equal(Everyday.lookup(term), entry);
  for (const id of entry.ids) {
    assert(byId.has(id), `Unknown compound ID ${id}`);
    assert(byId.get(id).searchTerms.includes(term), `${term} missing from ${id}`);
  }
});
for (const [query, id] of [['食鹽','core-1'],['鹽巴','core-1'],['食用小蘇打','sodium-bicarbonate'],['白醋','acetic-acid'],['醋','core-0'],['酒精','ethanol'],['消毒酒精','2-propanol'],['砂糖','sucrose'],['乾冰','core-2'],['蛋殼','core-13'],['燒鹼','sodium-hydroxide'],['熟石灰','core-14'],['生石灰','calcium-oxide'],['鐵鏽','core-12'],['氨水','core-8']]) check(() => assert(Everyday.lookup(query).ids.includes(id)));
check(() => assert.equal(Everyday.lookup('維 他 命 Ｃ').key, 'vitamin-c'));
check(() => assert.equal(Everyday.lookup('  VITAMIN C  ').key, 'vitamin-c'));
check(() => assert.equal(Everyday.lookup('糖'), null, 'the broad sugar class is not sucrose'));
check(() => assert.equal(Everyday.lookup('醋酸'), null, 'acetic acid is not the household mixture'));
check(() => assert.equal(Everyday.lookup(''), null));
check(() => assert.equal(Everyday.lookup('<img onerror=alert(1)>'), null));
check(() => assert.equal(byId.get('core-2').state, 'gas', 'dry ice search must not change the source reference state'));
check(() => assert.equal(byId.get('core-8').state, 'gas', 'ammonia solution search must not relabel pure ammonia'));
check(() => assert(!byId.get('acetic-acid').aliases.includes('白醋'), 'a mixture must not become a chemical identity alias'));
check(() => assert(!byId.get('ethanol').aliases.includes('消毒酒精'), 'product mixture must not become a chemical identity alias'));
check(() => assert(!byId.get('lactose').searchTerms?.includes('砂糖')));
check(() => assert(!byId.get('dimethyl-ether').searchTerms?.includes('酒精')));
check(() => assert.deepEqual(Everyday.apply([]), [], 'a partial catalog must be supported'));
check(() => assert.equal(Everyday.chips.length, 8));
if (process.argv.includes('--catalog')) {
  const Chem = require(path.join(appPath, 'chem-engine.js'));
  const catalog = require(path.join(appPath, 'catalog.js')).create(data, Chem);
  for (const chip of Everyday.chips) check(() => {
    const results = catalog.query({query:chip,pageSize:100});
    for (const id of Everyday.lookup(chip).ids) assert(results.items.some(c => c.id === id), `Catalog misses ${id} for ${chip}`);
  });
  check(() => assert.equal(catalog.query({query:'NaOH',category:'bases'}).items.some(c => c.id === 'sodium-hydroxide'), true));
  check(() => assert.equal(catalog.query({query:'砂糖',pageSize:100}).items.some(c => c.id === 'lactose'), false));
}
console.log(`Everyday chemistry: ${checks} checks passed; ${Everyday.entries.length} contextual groups; ${compounds.length} compounds unchanged.`);
