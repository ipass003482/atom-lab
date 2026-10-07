/* Load after ChemEngine. No UI mutations. Verified against real PubChem PUG REST.
 * Docs: https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest
 * fastformula is synchronous; the older /formula asynchronous service is deprecated.
 * All tested GET endpoints return Access-Control-Allow-Origin: * (2026-10-07).
 * Result fields describe names/composition only. They do NOT provide state or safety data.
 */
(function (root) {
  'use strict';
  const BASE = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/';
  const PROPS = 'Title,MolecularFormula,MolecularFormulaNoCharge,MolecularWeight,Charge,IsotopeAtomCount';
  const LIMIT = 20;
  let nextRequestAt = 0;

  function error(code, message, status) {
    const e = new Error(message); e.code = code; e.status = status; return e;
  }
  function checkAbort(signal) {
    if (signal && signal.aborted) throw new DOMException('搜尋已取消。', 'AbortError');
  }
  function wait(ms, signal) {
    checkAbort(signal);
    return new Promise((resolve, reject) => {
      const done = () => { signal?.removeEventListener('abort', abort); resolve(); };
      const timer = setTimeout(done, ms);
      const abort = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); reject(new DOMException('搜尋已取消。', 'AbortError')); };
      signal?.addEventListener('abort', abort, { once: true });
    });
  }
  async function request(url, signal) {
    checkAbort(signal);
    // Reserve a time slot synchronously, including across concurrent searches.
    const scheduled = Math.max(Date.now(), nextRequestAt);
    nextRequestAt = scheduled + 400; // <= 2.5 requests/s from this helper.
    await wait(Math.max(0, scheduled - Date.now()), signal);
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 12000);
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    try {
      checkAbort(signal);
      const response = await fetch(url, { mode: 'cors', credentials: 'omit', headers: { Accept: 'application/json' }, signal: controller.signal });
      if (response.status === 404) return null;
      if (response.status === 429 || response.status === 503) throw error('RATE_LIMIT', 'PubChem 目前忙碌或查詢過於頻繁，請稍後再試。', response.status);
      if (response.status === 504) throw error('TIMEOUT', 'PubChem 搜尋逾時，請縮小查詢範圍後再試。', response.status);
      if (!response.ok) throw error('API_ERROR', 'PubChem 無法完成查詢（HTTP ' + response.status + '）。', response.status);
      try { return await response.json(); }
      catch (e) { if (e.name === 'AbortError') throw e; throw error('BAD_RESPONSE', 'PubChem 傳回了無法讀取的資料。'); }
    } catch (e) {
      checkAbort(signal);
      if (timedOut) throw error('TIMEOUT', 'PubChem 連線逾時，請稍後再試。');
      if (e.code) throw e;
      throw error('NETWORK', '無法連線到 PubChem；請檢查網路連線。');
    } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); }
  }
  function hill(counts) {
    const symbols = Object.keys(counts);
    const order = symbols.includes('C') ? ['C', ...(symbols.includes('H') ? ['H'] : []), ...symbols.filter(x => x !== 'C' && x !== 'H').sort()] : symbols.sort();
    return order.map(s => s + (counts[s] === 1 ? '' : counts[s])).join('');
  }
  function shape(p, engine) {
    const name = p.Title || ('PubChem CID ' + p.CID);
    // Never strip trailing digits from a charged formula by guessing whether they are atom counts.
    const charge = Number.isSafeInteger(p.Charge) ? p.Charge : null;
    const base = p.MolecularFormulaNoCharge || (charge === 0 ? p.MolecularFormula : null);
    const formula = base && charge !== null ? base + (charge ? '^' + (Math.abs(charge) === 1 ? '' : Math.abs(charge)) + (charge > 0 ? '+' : '-') : '') : p.MolecularFormula;
    let parsed = null, unsupportedReason = '';
    if (p.IsotopeAtomCount !== 0) unsupportedReason = '此筆含同位素標記，目前組成模型尚未支援。';
    else if (!base || charge === null) unsupportedReason = '來源缺少可靠的中性組成或電荷欄位。';
    else { try { parsed = engine.parseFormula(formula); } catch (e) { unsupportedReason = '來源化學式尚無法由目前模型解析。'; } }
    return {
      id: 'pubchem-' + p.CID, pubchemCid: p.CID, sourceUrl: 'https://pubchem.ncbi.nlm.nih.gov/compound/' + p.CID,
      name, english: name, formula, sourceFormula: p.MolecularFormula, mass: String(p.MolecularWeight || ''),
      charge, isotopeAtomCount: p.IsotopeAtomCount, counts: parsed?.counts || null, totalAtoms: parsed?.totalAtoms || null,
      supported: Boolean(parsed), unsupportedReason, provenance: 'pubchem', category: 'public',
      state: 'unknown', stateNote: '此查詢未提供物態資料。', hazard: 'unknown', bond: '結構資料未收錄', tip: 'PubChem 即時資料',
      note: 'CID ' + p.CID + '；名稱、分子式與式量來自 PubChem。相同分子式可能對應不同結構。',
      detail: '此筆未匯入物態、危害或完整三維結構；請至來源查閱。'
    };
  }
  async function searchPubChem(query, signal) {
    const engine = root.ChemEngine;
    if (!engine?.parseFormula) throw error('MISSING_ENGINE', '化學式解析器尚未載入。');
    const text = String(query || '').trim();
    if (!text) return [];
    if (text.length > 250) throw error('QUERY_TOO_LONG', '搜尋文字請控制在 250 個字元以內。');
    let inputFormula = null;
    try { inputFormula = engine.parseFormula(text); } catch (_) { /* Chemical name instead. */ }
    const cidMatch = text.match(/^(?:CID\s*:?\s*)?([1-9]\d*)$/i);
    let url;
    if (cidMatch) url = BASE + 'cid/' + cidMatch[1] + '/cids/JSON';
    else if (inputFormula) {
      // Search atom composition; filter net charge after fetching properties.
      url = BASE + 'fastformula/' + encodeURIComponent(hill(inputFormula.counts)) + '/cids/JSON?MaxRecords=' + LIMIT + '&MaxSeconds=10&AllowOtherElements=false';
    } else url = BASE + 'name/' + encodeURIComponent(text) + '/cids/JSON?name_type=complete';
    let hit = await request(url, signal);
    // Defensive handling for legacy Waiting payloads; fastformula normally returns IDs directly.
    for (let attempt = 0; hit?.Waiting?.ListKey && attempt < 4; attempt++) {
      await wait(800, signal);
      hit = await request(BASE + 'listkey/' + encodeURIComponent(hit.Waiting.ListKey) + '/cids/JSON?listkey_start=0&listkey_count=' + LIMIT, signal);
    }
    if (hit?.Waiting) throw error('TIMEOUT', 'PubChem 尚未完成搜尋，請稍後再試。');
    const ids = [...new Set(hit?.IdentifierList?.CID || [])].filter(Number.isSafeInteger).filter(x => x > 0).slice(0, LIMIT);
    if (!ids.length) return [];
    const data = await request(BASE + 'cid/' + ids.join(',') + '/property/' + PROPS + '/JSON', signal);
    let records = (data?.PropertyTable?.Properties || []).slice(0, LIMIT).map(p => shape(p, engine));
    if (inputFormula) records = records.filter(r => r.charge === inputFormula.charge);
    return records;
  }
  root.searchPubChem = searchPubChem;
  if (typeof module === 'object' && module.exports) module.exports = { searchPubChem, shape };
})(typeof globalThis !== 'undefined' ? globalThis : this);
