(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ChemLessons = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STORAGE_KEY = 'atom-lab.learning.v1';
  const tasks = [
    { id: 'water-atoms', title: '組出第一個水分子', topic: '原子組合', where: '在下方實驗台操作',
      prompt: '水由氫與氧組成。請加入 2 個氫原子、1 個氧原子，再按「組合原子」。',
      hint: '左側點 H 兩次、O 一次；多加了可按原子旁的 −。H₂O 的下標 2 只屬於 H。',
      success: '組合成功！H₂O 有 2 個氫原子和 1 個氧原子，共 3 個原子。',
      prepare: { mode: 'atoms', clear: true, focus: 'atoms' } },
    { id: 'carbon-dioxide', title: '把原子數寫成化學式', topic: '化學式', where: '在下方化學式探索操作',
      prompt: '二氧化碳含 1 個碳原子、2 個氧原子。切換化學式探索，輸入它的化學式並解析。',
      hint: '碳是 C，氧是 O；只有 1 個原子時省略下標。試著寫成 C 後面接 O₂。',
      success: '正確！CO₂ 的「2」表示兩個氧原子，碳原子仍然只有一個。',
      prepare: { mode: 'formula', clear: true, focus: 'formula' } },
    { id: 'salt-search', title: '在資料庫找到食鹽', topic: '物質探索', where: '在下方物質庫搜尋並選取',
      prompt: '搜尋「食鹽」或「NaCl」，點選氯化鈉卡片，觀察右側顯示的參考物態。',
      hint: 'NaCl 是氯化鈉，在 25 °C、1 atm 下是固體。記得點選搜尋結果，載入實驗台。',
      success: '找到了！氯化鈉在此參考條件下為固體；NaCl 表示晶格中鈉、氯的 1：1 比例。',
      prepare: { mode: 'atoms', clear: true, library: 'compounds', resetLibrary: true, focus: 'library' } },
    { id: 'baking-soda', title: '用生活名稱找小蘇打', topic: '生活化搜尋', where: '在下方物質庫搜尋並選取',
      prompt: '在物質庫搜尋「小蘇打」，再點選對應物質，找出它的化學式。',
      hint: '小蘇打是碳酸氫鈉，化學式 NaHCO₃。請用生活名稱搜尋，再點選結果。',
      success: '對了！小蘇打就是碳酸氫鈉 NaHCO₃。生活名稱與正式名稱可以指向同一種物質。',
      prepare: { mode: 'atoms', clear: true, library: 'compounds', resetLibrary: true, focus: 'library' } },
    { id: 'hydrate', title: '讀懂結晶水的點號', topic: '結晶水', where: '先解析，再回到這裡回答',
      prompt: '在化學式探索解析 CuSO4·5H2O。包含結晶水後，總共有多少個氫原子、氧原子？',
      hint: '5H₂O 帶來 10 個 H 和 5 個 O；不要漏掉 CuSO₄ 本身的 4 個 O。',
      success: '正確！氫有 10 個，氧有 4 + 5 = 9 個；點號後的係數作用在整個水分子。',
      fields: [{ key: 'hydrogen', label: 'H 原子總數' }, { key: 'oxygen', label: 'O 原子總數' }],
      prepare: { mode: 'formula', clear: true, focus: 'formula' } },
    { id: 'ion-charge', title: '替離子標上電荷', topic: '離子', where: '在下方化學式探索操作',
      prompt: '解析帶有 2 個負電荷的硫酸根離子：1 個硫、4 個氧，總電荷 −2。',
      hint: '使用 ^ 表示電荷，例如 Fe^3+。硫酸根可輸入 SO4^2-；負電荷不會增加氧原子數。',
      success: '正確！SO₄²⁻ 有 1 個 S、4 個 O，總電荷 −2。原子下標和離子電荷意義不同。',
      prepare: { mode: 'formula', clear: true, focus: 'formula' } },
    { id: 'isomers', title: '相同化學式，一定相同嗎？', topic: '結構與異構物', where: '選擇你的判斷',
      prompt: '乙醇與二甲醚都有 C₂H₆O 這個分子式。僅憑分子式，可以確定它們是同一物質嗎？',
      hint: '分子式描述原子數，沒有完整描述原子之間如何相連。',
      options: [ ['same', '可以，原子數一樣就是同一物質'], ['different', '不可以，原子的連接方式可能不同'], ['phase', '可以，只要兩者在相同溫度'] ],
      success: '答對了！乙醇和二甲醚是結構異構物，原子數相同，連接方式與性質可以不同。' },
    { id: 'water-balance', title: '讓反應式兩邊相等', topic: '反應配平', where: '在空格填入最簡整數係數',
      prompt: '為 H₂ + O₂ → H₂O 配平。只能改前面的係數，不能改化學式下標。',
      hint: 'O₂ 有 2 個氧，右側需要 2 個 H₂O；接著數一數需要多少個 H₂。',
      equation: true,
      fields: [{ key: 'h2', label: 'H₂ 的係數' }, { key: 'o2', label: 'O₂ 的係數' }, { key: 'h2o', label: 'H₂O 的係數' }],
      success: '配平成功！2 H₂ + O₂ → 2 H₂O。兩邊都是 4 個 H 和 2 個 O。' },
    { id: 'carbon-dioxide-state', title: '物態需要參考條件', topic: '固・液・氣', where: '選擇參考物態',
      prompt: '在 25 °C、1 atm 的參考條件下，純二氧化碳通常是什麼物態？',
      hint: '呼出的氣體中含有二氧化碳；乾冰則是不同溫度條件下的固態二氧化碳。',
      options: [ ['solid', '固體'], ['liquid', '液體'], ['gas', '氣體'] ],
      success: '正確！此條件下 CO₂ 是氣體。物態與溫度、壓力有關，不能只看化學式。' },
    { id: 'conservation', title: '追蹤原子，完成最後挑戰', topic: '原子守恆', where: '觀察反應式，填入兩側原子總數',
      prompt: '對於 2 H₂ + O₂ → 2 H₂O，分別計算反應前後的 H、O 原子數。',
      hint: '係數會乘上分子裡每種原子的數量。2 個 H₂ 是 4 個 H，2 個 H₂O 是 4 個 H 加 2 個 O。',
      fields: [{ key: 'hBefore', label: '反應前 H' }, { key: 'hAfter', label: '反應後 H' }, { key: 'oBefore', label: '反應前 O' }, { key: 'oAfter', label: '反應後 O' }],
      success: '完成！反應前後都有 4 個 H、2 個 O。化學反應改變原子的組合，守恆檢查追蹤每種元素的總數。' }
  ];
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  function exactCounts(value, expected) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const keys = Object.keys(value);
    return keys.length === Object.keys(expected).length && keys.every(k => Object.prototype.hasOwnProperty.call(expected, k) && Number.isSafeInteger(value[k]) && value[k] === expected[k]);
  }
  function object(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
  function integer(value) {
    if (typeof value !== 'number' && typeof value !== 'string') return NaN;
    const raw = String(value).trim();
    return /^\d{1,7}$/.test(raw) && Number.isSafeInteger(Number(raw)) ? Number(raw) : NaN;
  }
  function evaluate(id, rawState, rawAnswers) {
    const task = taskMap.get(id), state = object(rawState), answers = object(rawAnswers);
    if (!task) return { ok: false, message: '找不到這個任務，請重新選擇。' };
    const neutral = state.charge === 0;
    const ready = state.dirty !== true;
    const selected = typeof state.compoundId === 'string' && state.compoundId.length > 0;
    let ok = false, message = '還差一點！可以再試一次，或展開提示。';
    switch (id) {
      case 'water-atoms':
        ok = state.mode === 'atoms' && ready && neutral && exactCounts(state.counts, { H: 2, O: 1 });
        message = state.dirty === true ? '原子已加入後，還需要按「組合原子」，再回來檢查。' : '請在原子組合模式準備 2 個 H、1 個 O，並按「組合原子」。'; break;
      case 'carbon-dioxide':
        ok = state.mode === 'formula' && ready && neutral && exactCounts(state.counts, { C: 1, O: 2 });
        message = '請在「化學式探索」解析含 1 個 C、2 個 O 的中性化學式。'; break;
      case 'salt-search':
        ok = ready && neutral && selected && state.compoundState === 'solid' && exactCounts(state.counts, { Na: 1, Cl: 1 });
        message = '請從物質庫點選氯化鈉卡片；右側應顯示 NaCl 與固體。'; break;
      case 'baking-soda': {
        const query = typeof state.libraryQuery === 'string' ? state.libraryQuery.toLowerCase().replace(/\s/g, '') : '';
        const everyday = ['小蘇打', '小苏打', 'bakingsoda'].some(q => query.includes(q));
        ok = ready && neutral && selected && everyday && exactCounts(state.counts, { Na: 1, H: 1, C: 1, O: 3 });
        message = !everyday ? '這一關試著用「小蘇打」這個生活名稱搜尋，再點選結果。' : '搜尋詞對了！再點選碳酸氫鈉卡片，載入 NaHCO₃。'; break;
      }
      case 'hydrate':
        ok = state.mode === 'formula' && ready && neutral && exactCounts(state.counts, { Cu: 1, S: 1, O: 9, H: 10 }) && integer(answers.hydrogen) === 10 && integer(answers.oxygen) === 9;
        message = !exactCounts(state.counts, { Cu: 1, S: 1, O: 9, H: 10 }) || state.mode !== 'formula' ? '先在化學式探索解析 CuSO4·5H2O，再填入 H、O 總數。' : '再數一次：5 個水帶來的原子，也要加上 CuSO₄ 本身的原子。'; break;
      case 'ion-charge':
        ok = state.mode === 'formula' && ready && state.charge === -2 && exactCounts(state.counts, { S: 1, O: 4 });
        message = '請確認有 1 個 S、4 個 O，並以 ^2- 標明總電荷 −2。'; break;
      case 'isomers': ok = answers.choice === 'different'; message = '再想想：分子式是否也描述了原子之間的連接順序？'; break;
      case 'water-balance': {
        const a = integer(answers.h2), b = integer(answers.o2), c = integer(answers.h2o);
        ok = a === 2 && b === 1 && c === 2;
        message = a > 0 && b > 0 && c > 0 && a === c && 2 * b === c ? '兩邊守恆了！請再把係數約成最簡整數比。' : '請檢查兩邊的 H 與 O 是否各自相等，係數 1 也請填入。'; break;
      }
      case 'carbon-dioxide-state': ok = answers.choice === 'gas'; message = '請留意題目的 25 °C、1 atm；乾冰需要更低的溫度。'; break;
      case 'conservation':
        ok = integer(answers.hBefore) === 4 && integer(answers.hAfter) === 4 && integer(answers.oBefore) === 2 && integer(answers.oAfter) === 2;
        message = '每個係數都要乘上分子內的原子數；分別數 H、O，不要只比總粒子數。'; break;
    }
    return { ok, message: ok ? task.success : message };
  }
  function sanitizeProgress(value) {
    const input = object(value);
    return { completed: Array.isArray(input.completed) ? [...new Set(input.completed.filter(id => typeof id === 'string' && taskMap.has(id)))] : [], current: taskMap.has(input.current) ? input.current : tasks[0].id };
  }
  function mount(options) {
    options = object(options);
    const container = options.container;
    if (!container || typeof container.appendChild !== 'function') throw new TypeError('ChemLessons.mount requires a container element');
    const doc = container.ownerDocument;
    const element = (tag, cls, text) => { const el = doc.createElement(tag); if (cls) el.className = cls; if (text !== undefined) el.textContent = text; return el; };
    let storage = null, saved = null;
    try { storage = doc.defaultView.localStorage; const raw = storage.getItem(STORAGE_KEY); if (raw && raw.length < 20000) saved = JSON.parse(raw); } catch (_) { /* In-memory progress still works. */ }
    let progress = sanitizeProgress(saved), started = false, destroyed = false;
    const shell = element('section', 'learning-panel');
    shell.setAttribute('aria-label', '入門化學任務');
    const header = element('div', 'learning-header'), heading = element('div', 'learning-heading');
    heading.append(element('p', 'eyebrow', 'LEARN BY DOING'), element('h2', '', '10 個小任務，開始你的化學探索'));
    const meterWrap = element('div', 'learning-progress'), meterText = element('span', 'learning-progress-text'), meter = element('progress');
    meter.max = tasks.length; meter.setAttribute('aria-label', '已完成任務數');
    meterWrap.append(meterText, meter); header.append(heading, meterWrap);
    const navigation = element('nav', 'learning-nav'); navigation.setAttribute('aria-label', '選擇化學任務');
    const body = element('div', 'learning-body');
    shell.append(header, navigation, body); container.appendChild(shell);
    const returnButton = element('button', 'learning-return', '↑ 回任務 · 檢查答案');
    returnButton.type = 'button'; returnButton.hidden = true; container.appendChild(returnButton);
    let shellVisible = true, observer = null;
    function updateReturnButton() { returnButton.hidden = !started || shellVisible || !taskMap.get(progress.current).prepare; }
    if (doc.defaultView && typeof doc.defaultView.IntersectionObserver === 'function') {
      observer = new doc.defaultView.IntersectionObserver(entries => { shellVisible = entries.some(entry => entry.isIntersecting); updateReturnButton(); }); observer.observe(shell);
    }
    returnButton.addEventListener('click', () => {
      const reduce = doc.defaultView.matchMedia && doc.defaultView.matchMedia('(prefers-reduced-motion: reduce)').matches;
      shell.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      const check = body.querySelector('.learning-check'); if (check) check.focus({ preventScroll: true });
    });
    const navigationButtons = tasks.map((task, i) => {
      const button = element('button', 'learning-step'); button.type = 'button';
      button.append(element('span', 'learning-step-number', String(i + 1).padStart(2, '0')), element('span', 'learning-step-title', task.topic));
      button.addEventListener('click', () => { if (destroyed) return; progress.current = task.id; started = false; save(); render(); });
      navigation.appendChild(button); return button;
    });
    function save() { try { if (storage) storage.setItem(STORAGE_KEY, JSON.stringify(progress)); } catch (_) { storage = null; } }
    function getState() { try { return typeof options.getState === 'function' ? object(options.getState()) : {}; } catch (_) { return {}; } }
    function render() {
      if (destroyed) return;
      const task = taskMap.get(progress.current), index = tasks.indexOf(task);
      updateReturnButton();
      meterText.textContent = progress.completed.length + ' / ' + tasks.length + ' 已完成'; meter.value = progress.completed.length;
      navigationButtons.forEach((button, i) => { const active = tasks[i].id === task.id, complete = progress.completed.includes(tasks[i].id); button.classList.toggle('active', active); button.classList.toggle('complete', complete); button.setAttribute('aria-pressed', String(active)); button.setAttribute('aria-label', '任務 ' + (i + 1) + '：' + tasks[i].title + (complete ? '，已完成' : '')); button.firstChild.textContent = complete ? '✓' : String(i + 1).padStart(2, '0'); });
      body.replaceChildren();
      const copy = element('div', 'learning-copy'), kicker = element('p', 'learning-kicker', '任務 ' + String(index + 1).padStart(2, '0') + ' / ' + task.topic);
      const title = element('h3', 'learning-task-title', task.title), description = element('p', 'learning-task-description', task.prompt);
      copy.append(kicker, title, description, element('p', 'learning-location', task.where));
      const interaction = element('div', 'learning-interaction'), form = element('form', 'learning-form'), inputs = {};
      form.noValidate = true;
      if (task.options) {
        const fieldset = element('fieldset', 'learning-choices');
        const legend = element('legend', 'learning-sr-only', '選擇答案'); fieldset.appendChild(legend);
        task.options.forEach(([value, label]) => { const choiceLabel = element('label', 'learning-choice'), input = element('input'); input.type = 'radio'; input.name = 'learning-choice-' + task.id; input.value = value; input.disabled = !started; choiceLabel.append(input, element('span', '', label)); fieldset.appendChild(choiceLabel); });
        form.appendChild(fieldset);
      }
      if (task.fields) {
        const grid = element('div', task.equation ? 'learning-fields learning-equation-fields' : 'learning-fields');
        task.fields.forEach((field, i) => {
          const label = element('label', 'learning-number-label'); label.appendChild(element('span', '', field.label));
          const input = element('input', 'learning-number'); input.type = 'number'; input.inputMode = 'numeric'; input.min = '0'; input.max = '999'; input.step = '1'; input.placeholder = '?'; input.setAttribute('aria-label', field.label); input.autocomplete = 'off'; input.disabled = !started; inputs[field.key] = input; label.appendChild(input); grid.appendChild(label);
          if (task.equation && i < task.fields.length - 1) grid.appendChild(element('span', 'learning-equation-sign', i === 0 ? '+' : '→'));
        });
        form.appendChild(grid);
      }
      const controls = element('div', 'learning-controls'), start = element('button', 'learning-start', started ? '重新挑戰' : progress.completed.includes(task.id) ? '再挑戰一次' : '開始任務');
      start.type = 'button';
      const check = element('button', 'accent-button learning-check', '檢查答案'); check.type = 'submit'; check.disabled = !started;
      const hint = element('details', 'learning-hint'), summary = element('summary', '', '看提示'); hint.append(summary, element('p', '', task.hint));
      controls.append(start, check); form.appendChild(controls);
      const feedback = element('p', 'learning-feedback', started ? '完成操作或填答後，按「檢查答案」。' : '先按「開始任務」，準備好再挑戰。'); feedback.setAttribute('role', 'status'); feedback.setAttribute('aria-live', 'polite');
      const next = element('button', 'learning-next', index === tasks.length - 1 ? '回到第一個任務 ↗' : '下一個任務 →'); next.type = 'button'; next.hidden = true;
      start.addEventListener('click', () => {
        if (destroyed) return;
        try {
          if (typeof options.prepare === 'function') options.prepare({ id: task.id, mode: null, clear: false, library: null, resetLibrary: false, focus: null, ...task.prepare });
          started = true; form.reset(); form.querySelectorAll('input').forEach(input => { input.disabled = false; }); start.textContent = '重新挑戰'; check.disabled = false; next.hidden = true; feedback.className = 'learning-feedback'; feedback.textContent = task.prepare ? '實驗台已準備好。完成操作後，回到這裡檢查。' : '請填寫或選擇答案，再按「檢查答案」。'; updateReturnButton();
          if (!task.prepare) { const first = form.querySelector('input'); if (first) first.focus(); }
        } catch (_) { started = false; check.disabled = true; feedback.className = 'learning-feedback retry'; feedback.textContent = '實驗台暫時無法準備，請重試或重新整理頁面。'; }
      });
      form.addEventListener('submit', event => {
        event.preventDefault(); if (!started || destroyed) return;
        const answers = Object.fromEntries(Object.entries(inputs).map(([key, input]) => [key, input.value]));
        const choice = form.querySelector('input[type="radio"]:checked'); if (choice) answers.choice = choice.value;
        const result = evaluate(task.id, getState(), answers); feedback.textContent = result.message; feedback.className = 'learning-feedback ' + (result.ok ? 'success' : 'retry'); next.hidden = !result.ok;
        if (result.ok) {
          const firstCompletion = !progress.completed.includes(task.id);
          if (firstCompletion) progress.completed.push(task.id);
          save(); meterText.textContent = progress.completed.length + ' / ' + tasks.length + ' 已完成'; meter.value = progress.completed.length;
          const nav = navigationButtons[index]; nav.classList.add('complete'); nav.firstChild.textContent = '✓'; nav.setAttribute('aria-label', '任務 ' + (index + 1) + '：' + task.title + '，已完成');
          if (progress.completed.length === tasks.length) feedback.textContent += ' 十個任務全部完成！可以自由重玩，繼續探索其他物質。';
          if (firstCompletion && typeof options.onComplete === 'function') { try { options.onComplete({ id: task.id, completed: progress.completed.length, total: tasks.length }); } catch (_) { /* A host callback must not lose progress. */ } }
        }
      });
      next.addEventListener('click', () => { progress.current = tasks[(index + 1) % tasks.length].id; started = false; save(); render(); navigationButtons[(index + 1) % tasks.length].focus(); });
      interaction.append(form, feedback, next, hint); body.append(copy, interaction);
    }
    render();
    return { destroy() { destroyed = true; if (observer) observer.disconnect(); returnButton.remove(); shell.remove(); }, getProgress() { return { current: progress.current, completed: [...progress.completed] }; } };
  }
  return Object.freeze({ mount, evaluate, sanitizeProgress, tasks: tasks.map(({ id, title, topic }) => Object.freeze({ id, title, topic })), STORAGE_KEY });
});
