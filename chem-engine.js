/*
 * Dependency-free chemistry formula parser and exact reaction balancer.
 * Browser: globalThis.ChemEngine. Node: require('./chem-engine.js').
 * parseFormula('CuSO4·5H2O') -> { counts, normalized, totalAtoms, charge }.
 * balanceEquation('Fe + O2 -> Fe2O3') -> { reactants, products, equation }.
 * Every species includes formula, coefficient (safe integer), counts, charge.
 * Charges: Fe^3+, SO4^2-, H^+, e^-. Unicode superscript charges also work.
 * Formula counts and hydrate multipliers use integers; isotope notation,
 * state labels, fractional counts, and implicit charges such as Fe3+ are not
 * supported. Leading reaction coefficients are replaced by the simplest
 * positive integer solution. Underdetermined systems are rejected.
 */
(function (root) {
  'use strict';

  const SYMBOLS = Object.freeze(('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca ' +
    'Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd ' +
    'In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os ' +
    'Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf ' +
    'Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og').split(' '));
  const VALID_SYMBOLS = new Set(SYMBOLS);
  const MAX_LENGTH = 1000;
  const MAX_ATOMS = 1000000;
  const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
  const SUB = '₀₁₂₃₄₅₆₇₈₉';
  const SUPER = '⁰¹²³⁴⁵⁶⁷⁸⁹';

  class ChemError extends Error {
    constructor(code, message) {
      super(message);
      this.name = 'ChemError';
      this.code = code;
    }
  }

  function fail(code, message) { throw new ChemError(code, message); }
  function normalizeInput(input) {
    if (typeof input !== 'string') fail('INVALID_INPUT', '請輸入文字形式的化學式或反應式。');
    if (input.length > MAX_LENGTH) fail('INPUT_TOO_LONG', '輸入過長，最多可輸入 1,000 個字元。');
    return input.replace(/\s+/g, '').replace(/[₀₁₂₃₄₅₆₇₈₉]/g, c => String(SUB.indexOf(c)))
      .replace(/[∙⋅]/g, '·').replace(/−/g, '-');
  }

  function positiveInteger(digits, label) {
    if (!/^[1-9]\d*$/.test(digits)) {
      fail('INVALID_COUNT', label + '必須是大於 0 的整數，且不能以 0 開頭。');
    }
    const value = Number(digits);
    if (!Number.isSafeInteger(value) || value > MAX_ATOMS) {
      fail('COUNT_TOO_LARGE', label + '不可超過 1,000,000。');
    }
    return value;
  }

  function addCounts(target, source, multiplier) {
    for (const symbol of Object.keys(source)) {
      const count = (target[symbol] || 0) + source[symbol] * multiplier;
      if (!Number.isSafeInteger(count) || count > MAX_ATOMS) {
        fail('COUNT_TOO_LARGE', '單一化學式的原子總數不可超過 1,000,000。');
      }
      target[symbol] = count;
    }
  }

  function parseSegment(segment) {
    let index = 0;
    function countAfter() {
      const start = index;
      while (index < segment.length && /[0-9]/.test(segment[index])) index++;
      return index === start ? 1 : positiveInteger(segment.slice(start, index), '原子數或群組倍數');
    }
    function group(expectedClose) {
      const counts = {};
      let units = 0;
      while (index < segment.length) {
        const char = segment[index];
        if (char === ')' || char === ']') {
          if (char !== expectedClose) fail('UNMATCHED_GROUP', '括號沒有正確配對，請檢查 ( ) 與 [ ]。');
          if (!units) fail('EMPTY_GROUP', '括號內必須包含元素，不能是空群組。');
          index++;
          return counts;
        }
        if (char === '(' || char === '[') {
          index++;
          const nested = group(char === '(' ? ')' : ']');
          addCounts(counts, nested, countAfter());
          units++;
          continue;
        }
        if (/[A-Z]/.test(char)) {
          let symbol = segment[index++];
          if (index < segment.length && /[a-z]/.test(segment[index])) symbol += segment[index++];
          if (!VALID_SYMBOLS.has(symbol)) fail('UNKNOWN_ELEMENT', '找不到元素「' + symbol + '」，請使用正確大小寫的元素符號。');
          addCounts(counts, { [symbol]: countAfter() }, 1);
          units++;
          continue;
        }
        if (/[a-z]/.test(char)) fail('INVALID_SYMBOL', '元素符號必須以大寫字母開頭，例如 Co（鈷）與 CO（一氧化碳）不同。');
        fail('INVALID_FORMULA', '化學式含有無法辨識的字元「' + char + '」。');
      }
      if (expectedClose) fail('UNMATCHED_GROUP', '括號沒有正確配對，缺少「' + expectedClose + '」。');
      if (!units) fail('EMPTY_FORMULA', '請輸入至少一個元素。');
      return counts;
    }
    return group(null);
  }

  function parseFormula(input) {
    let text = normalizeInput(input);
    if (!text) fail('EMPTY_FORMULA', '請輸入化學式，例如 H2O 或 Ca(OH)2。');
    text = text.replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹]*)([⁺⁻])$/, (_, digits, sign) =>
      '^' + digits.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, c => String(SUPER.indexOf(c))) + (sign === '⁺' ? '+' : '-'));
    const chargeMatch = text.match(/\^(\d*)([+-])$/);
    let charge = 0;
    let suffix = '';
    if (chargeMatch) {
      const magnitude = chargeMatch[1] ? positiveInteger(chargeMatch[1], '電荷數') : 1;
      charge = chargeMatch[2] === '+' ? magnitude : -magnitude;
      suffix = '^' + (magnitude === 1 ? '' : magnitude) + chargeMatch[2];
      text = text.slice(0, chargeMatch.index);
    } else if (/[+-]$/.test(text)) {
      fail('INVALID_CHARGE', '離子電荷請使用 ^+、^- 或 ^2-，例如 Fe^3+、SO4^2-。');
    }
    if (text.includes('^')) fail('INVALID_CHARGE', '電荷必須寫在化學式末尾，例如 Fe^3+ 或 SO4^2-。');
    if (text === 'e') {
      if (charge !== -1) fail('INVALID_ELECTRON', '電子請寫成 e^-，其電荷為 −1。');
      return { counts: {}, normalized: 'e^-', totalAtoms: 0, charge: -1 };
    }
    if (!text) fail('EMPTY_FORMULA', '電荷前必須有元素或化學式。');
    const parts = text.replace(/\./g, '·').split('·');
    const counts = {};
    for (let i = 0; i < parts.length; i++) {
      let part = parts[i];
      if (!part) fail('INVALID_HYDRATE', '水合物分隔點前後都必須有化學式，例如 CuSO4·5H2O。');
      let multiplier = 1;
      const leading = part.match(/^\d+/);
      if (leading) {
        if (i === 0) fail('LEADING_COEFFICIENT', '單一化學式前不需加係數；請輸入 H2O，配平係數請放在反應式中。');
        multiplier = positiveInteger(leading[0], '水合物倍數');
        part = part.slice(leading[0].length);
        if (!part) fail('INVALID_HYDRATE', '水合物倍數後必須接化學式，例如 ·5H2O。');
      }
      addCounts(counts, parseSegment(part), multiplier);
    }
    const totalAtoms = Object.values(counts).reduce((sum, value) => sum + value, 0);
    if (totalAtoms > MAX_ATOMS) fail('COUNT_TOO_LARGE', '單一化學式的原子總數不可超過 1,000,000。');
    return { counts, normalized: parts.join('·') + suffix, totalAtoms, charge };
  }

  function formatFormula(input) {
    const parsed = parseFormula(input);
    const parts = parsed.normalized.split('^');
    const formula = parts[0].split('·').map((part, i) => part.replace(/\d+/g, (digits, offset) =>
      i > 0 && offset === 0 ? digits : digits.replace(/\d/g, c => SUB[Number(c)]))).join('·');
    return formula + (parts[1] ? parts[1].replace(/\d/g, c => SUPER[Number(c)]).replace('+', '⁺').replace('-', '⁻') : '');
  }

  function parseSide(side) {
    if (!side) fail('EMPTY_SIDE', '反應式左右兩側都必須包含物質。');
    const tokens = [];
    let start = 0;
    for (let i = 0; i < side.length; i++) {
      if (side[i] !== '+') continue;
      // A plus immediately after a caret and optional digits is an ionic charge.
      if (/\^\d*$/.test(side.slice(start, i))) continue;
      const token = side.slice(start, i);
      if (!token) fail('EMPTY_SPECIES', '加號前後都必須有物質，請移除多餘的加號。');
      tokens.push(token);
      start = i + 1;
    }
    if (start === side.length) fail('EMPTY_SPECIES', '反應式不能以加號結尾；正離子請使用 ^+。');
    tokens.push(side.slice(start));
    return tokens.map(token => {
      const coefficient = token.match(/^\d+/);
      if (coefficient) {
        // These digits are discarded, so neither floating-point conversion nor
        // the per-formula atom limit should constrain an existing coefficient.
        if (!/^[1-9]\d*$/.test(coefficient[0])) fail('INVALID_COUNT', '原始係數必須是大於 0 的整數，且不能以 0 開頭。');
        token = token.slice(coefficient[0].length);
      }
      if (!token) fail('EMPTY_SPECIES', '係數後必須有化學式。');
      const parsed = parseFormula(token);
      return { formula: parsed.normalized, coefficient: 1, counts: parsed.counts, charge: parsed.charge };
    });
  }

  function abs(value) { return value < 0n ? -value : value; }
  function gcd(a, b) {
    a = abs(a); b = abs(b);
    while (b !== 0n) { const t = a % b; a = b; b = t; }
    return a;
  }
  function lcm(a, b) { return a / gcd(a, b) * b; }
  const ZERO = [0n, 1n];
  const ONE = [1n, 1n];
  function fraction(numerator, denominator) {
    if (numerator === 0n) return ZERO;
    if (denominator < 0n) { numerator = -numerator; denominator = -denominator; }
    const common = gcd(numerator, denominator);
    return [numerator / common, denominator / common];
  }
  function minus(a, b) { return fraction(a[0] * b[1] - b[0] * a[1], a[1] * b[1]); }
  function times(a, b) { return fraction(a[0] * b[0], a[1] * b[1]); }
  function divide(a, b) { return fraction(a[0] * b[1], a[1] * b[0]); }

  function uniquePositiveNullspace(integerMatrix, columns) {
    // More columns than constraints + one guarantees multiple free variables.
    if (columns > integerMatrix.length + 1) {
      fail('UNDERDETERMINED', '此反應式有多組獨立的配平解，無法唯一決定係數；請移除重複物質或拆成單一反應。');
    }
    const matrix = integerMatrix.map(row => row.map(n => [BigInt(n), 1n]));
    const pivots = [];
    let pivotRow = 0;
    for (let column = 0; column < columns && pivotRow < matrix.length; column++) {
      let selected = pivotRow;
      while (selected < matrix.length && matrix[selected][column][0] === 0n) selected++;
      if (selected === matrix.length) continue;
      [matrix[pivotRow], matrix[selected]] = [matrix[selected], matrix[pivotRow]];
      const pivot = matrix[pivotRow][column];
      for (let c = column; c < columns; c++) matrix[pivotRow][c] = divide(matrix[pivotRow][c], pivot);
      for (let r = 0; r < matrix.length; r++) {
        if (r === pivotRow || matrix[r][column][0] === 0n) continue;
        const factor = matrix[r][column];
        for (let c = column; c < columns; c++) matrix[r][c] = minus(matrix[r][c], times(factor, matrix[pivotRow][c]));
      }
      pivots.push(column);
      pivotRow++;
    }
    const free = [];
    for (let c = 0; c < columns; c++) if (!pivots.includes(c)) free.push(c);
    if (!free.length) fail('IMPOSSIBLE_EQUATION', '無法同時滿足原子與電荷守恆，請檢查反應物和生成物是否完整。');
    if (free.length !== 1) fail('UNDERDETERMINED', '此反應式有多組獨立的配平解，無法唯一決定係數；請移除重複物質或拆成單一反應。');
    const vector = Array(columns).fill(ZERO);
    vector[free[0]] = ONE;
    for (let r = 0; r < pivots.length; r++) {
      const entry = matrix[r][free[0]];
      vector[pivots[r]] = [-entry[0], entry[1]];
    }
    const denominator = vector.reduce((value, entry) => lcm(value, entry[1]), 1n);
    let coefficients = vector.map(entry => entry[0] * (denominator / entry[1]));
    const common = coefficients.reduce((value, entry) => gcd(value, entry), 0n);
    coefficients = coefficients.map(value => value / common);
    if (coefficients[0] < 0n) coefficients = coefficients.map(value => -value);
    if (coefficients.some(value => value <= 0n)) {
      fail('NO_POSITIVE_SOLUTION', '無法讓所有物質取得正整數係數；請檢查物質是否放在正確的一側，或是否多列了物質。');
    }
    if (coefficients.some(value => value > MAX_SAFE)) {
      fail('COEFFICIENT_TOO_LARGE', '配平係數超過可安全顯示的整數範圍，請簡化反應式。');
    }
    // Independently verify the final integer answer with the original matrix.
    for (const row of integerMatrix) {
      const sum = row.reduce((value, entry, c) => value + BigInt(entry) * coefficients[c], 0n);
      if (sum !== 0n) fail('INTERNAL_ERROR', '配平驗證失敗，請重新輸入反應式。');
    }
    return coefficients.map(Number);
  }

  function balanceEquation(input) {
    const text = normalizeInput(input);
    const arrows = [...text.matchAll(/->|=>|→|=/g)];
    if (arrows.length !== 1) fail('INVALID_ARROW', '反應式需包含一個箭號，可使用 →、->、=> 或 =。');
    const arrow = arrows[0];
    const reactants = parseSide(text.slice(0, arrow.index));
    const products = parseSide(text.slice(arrow.index + arrow[0].length));
    const species = reactants.concat(products);
    const elements = [...new Set(species.flatMap(item => Object.keys(item.counts)))];
    for (const element of elements) {
      const left = reactants.some(item => item.counts[element]);
      const right = products.some(item => item.counts[element]);
      if (!left || !right) fail('MISSING_ELEMENT', '元素 ' + element + ' 只出現在反應式的一側，無法滿足原子守恆。');
    }
    const sign = index => index < reactants.length ? 1 : -1;
    const matrix = elements.map(element => species.map((item, index) => (item.counts[element] || 0) * sign(index)));
    if (species.some(item => item.charge !== 0)) matrix.push(species.map((item, index) => item.charge * sign(index)));
    const coefficients = uniquePositiveNullspace(matrix, species.length);
    species.forEach((item, index) => { item.coefficient = coefficients[index]; });
    const sideText = side => side.map(item => (item.coefficient === 1 ? '' : item.coefficient + ' ') + item.formula).join(' + ');
    return { reactants, products, equation: sideText(reactants) + ' → ' + sideText(products) };
  }

  function parseReactants(input) {
    const text = normalizeInput(input);
    if (/->|=>|→|=/.test(text)) fail('UNEXPECTED_ARROW', '此處只接受反應物；完整反應式請使用配平功能。');
    return parseSide(text);
  }

  const api = Object.freeze({ parseFormula, formatFormula, balanceEquation, parseReactants, ChemError, elementSymbols: SYMBOLS,
    limits: Object.freeze({ maxInputLength: MAX_LENGTH, maxAtoms: MAX_ATOMS }) });
  root.ChemEngine = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
