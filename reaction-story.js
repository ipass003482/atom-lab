/* Atom conservation illustration. No bonds, mechanisms, or reaction predictions. */
(function (root) {
  'use strict';
  const COLORS = { H:'#d9eaff',O:'#ff6c7f',C:'#8299ac',N:'#7299ff',Na:'#b99aff',Cl:'#72edbd',S:'#ffdb70',P:'#ffad71',Fe:'#f29982',Cu:'#db9b72',Ca:'#a3e7b0',Mg:'#cce9ae' };
  const ELEMENTS = new Set(('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og').split(' '));
  const MAX_ATOMS = 120, MAX_GROUPS = 24;
  const sub = text => String(text).replace(/\^(\d*)([+-])/g, (_,n,sign) => n.replace(/\d/g,d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]) + (sign === '+' ? '⁺' : '⁻')).replace(/\d/g, n => '₀₁₂₃₄₅₆₇₈₉'[n]);
  const color = symbol => COLORS[symbol] || 'hsl(' + [...symbol].reduce((a,c) => (a * 31 + c.charCodeAt(0)) % 360, 42) + ' 65% 72%)';
  const sum = side => {
    const totals = {}, groups = side.reduce((n,s) => n + BigInt(s.coefficient), 0n);
    let charge = 0n, atoms = 0n;
    for (const s of side) {
      const k = BigInt(s.coefficient);
      charge += k * BigInt(s.charge);
      for (const [element, count] of Object.entries(s.counts)) {
        const n = k * BigInt(count);
        totals[element] = (totals[element] || 0n) + n;
        atoms += n;
      }
    }
    return {totals, charge, atoms, groups};
  };
  function createPlan(balanced) {
    const invalid = reason => ({valid:false, enabled:false, reason, ledger:[], atoms:[], reactants:[], products:[]});
    if (!balanced || !Array.isArray(balanced.reactants) || !balanced.reactants.length || !Array.isArray(balanced.products) || !balanced.products.length) return invalid('請先輸入完整反應式，並完成配平。');
    const sides = [balanced.reactants, balanced.products];
    for (const side of sides) for (const s of side) {
      if (!s || typeof s.formula !== 'string' || !s.formula || !Number.isSafeInteger(s.coefficient) || s.coefficient < 1 || !Number.isSafeInteger(s.charge) || !s.counts || typeof s.counts !== 'object' || Array.isArray(s.counts)) return invalid('反應資料不完整，無法驗證原子與電荷。');
      if (Object.entries(s.counts).some(([e,n]) => !ELEMENTS.has(e) || !Number.isSafeInteger(n) || n < 1)) return invalid('反應資料含有無法驗證的原子數。');
      if (!Object.keys(s.counts).length && s.formula !== 'e^-' && s.formula !== 'e⁻') return invalid('反應資料缺少原子組成。');
    }
    const [before, after] = sides.map(sum);
    const elements = [...new Set([...Object.keys(before.totals), ...Object.keys(after.totals)])].sort();
    const ledger = elements.map(element => ({element, before:String(before.totals[element] || 0n), after:String(after.totals[element] || 0n)}));
    const valid = ledger.every(row => row.before === row.after) && before.charge === after.charge;
    const result = {valid, enabled:false, reason:'', ledger, atoms:[], reactants:[], products:[], totalAtoms:String(before.atoms), totalGroups:String(before.groups + after.groups), charges:[String(before.charge), String(after.charge)]};
    if (!valid) { result.reason = '原子或電荷尚未守恆，請重新配平後再播放。'; return result; }
    if (sides.flat().some(s => s.charge !== 0 || !Object.keys(s.counts).length)) { result.reason = '這是離子或電子反應；下方保留完整原子與電荷守恆數字。此動畫尚未呈現電荷轉移，因此不播放。'; return result; }
    if (before.atoms > BigInt(MAX_ATOMS) || before.groups + after.groups > BigInt(MAX_GROUPS)) { result.reason = '此反應共有 ' + before.atoms + ' 顆原子、反應前後合計 ' + (before.groups + after.groups) + ' 個化學式單位。動畫上限為 120 顆原子、24 個單位；下方顯示完整守恆數字。'; return result; }
    const queues = {};
    for (let sideIndex = 0; sideIndex < sides.length; sideIndex++) {
      const groups = sideIndex ? result.products : result.reactants;
      for (const species of sides[sideIndex]) for (let unit = 0; unit < species.coefficient; unit++) {
        const group = {id:groups.length, formula:species.formula, label:sub(species.formula), atoms:[]};
        for (const [element, count] of Object.entries(species.counts)) for (let i = 0; i < count; i++) {
          if (!sideIndex) {
            const atom = {id:result.atoms.length, element, fromGroup:group.id, fromIndex:group.atoms.length};
            result.atoms.push(atom); (queues[element] || (queues[element] = [])).push(atom); group.atoms.push(atom.id);
          } else {
            const atom = queues[element].shift();
            atom.toGroup = group.id; atom.toIndex = group.atoms.length; group.atoms.push(atom.id);
          }
        }
        groups.push(group);
      }
    }
    result.enabled = true;
    return result;
  }
  function layoutPlan(plan, width) {
    width = Math.max(240, width);
    const gap = 32, margin = 12, sideWidth = (width - 2 * margin - gap) / 2;
    function layoutGroups(groups, startX) {
      const columns = Math.max(1, Math.floor(sideWidth / 170));
      const cellWidth = (sideWidth - (columns - 1) * 10) / columns;
      const atomColumns = Math.max(2, Math.floor((cellWidth - 16) / 23));
      let y = 49;
      const cells = [], positions = {};
      for (let first = 0; first < groups.length; first += columns) {
        const rowGroups = groups.slice(first, first + columns);
        const height = Math.max(...rowGroups.map(g => Math.ceil(g.atoms.length / atomColumns) * 25 + 42));
        rowGroups.forEach((g,col) => {
          const x = startX + col * (cellWidth + 10);
          cells.push({group:g, x, y, width:cellWidth, height:height - 9});
          g.atoms.forEach((id,index) => {
            const row = Math.floor(index / atomColumns), atomsInRow = Math.min(atomColumns, g.atoms.length - row * atomColumns);
            positions[id] = {x:x + cellWidth / 2 + (index % atomColumns - (atomsInRow - 1) / 2) * 23, y:y + 38 + row * 25};
          });
        });
        y += height;
      }
      return {cells, positions, height:y + 18};
    }
    const before = layoutGroups(plan.reactants, margin), after = layoutGroups(plan.products, margin + sideWidth + gap);
    const middleColumns = Math.max(2, Math.floor((width - 40) / 26));
    const middleRows = Math.ceil(plan.atoms.length / middleColumns);
    const height = Math.max(230, before.height, after.height, middleRows * 26 + 104);
    const mid = {};
    plan.atoms.forEach((atom,index) => {
      const row = Math.floor(index / middleColumns), n = Math.min(middleColumns, plan.atoms.length - row * middleColumns);
      mid[atom.id] = {x:width / 2 + (index % middleColumns - (n - 1) / 2) * 26, y:height / 2 + (row - (middleRows - 1) / 2) * 26};
    });
    return {width,height,before,after,mid};
  }
  function interpolate(plan, layout, progress) {
    const p = Math.max(0, Math.min(1, progress)), first = p <= .5;
    const t = first ? p * 2 : (p - .5) * 2;
    const eased = t * t * (3 - 2 * t);
    return plan.atoms.map(atom => {
      const a = first ? layout.before.positions[atom.id] : layout.mid[atom.id];
      const b = first ? layout.mid[atom.id] : layout.after.positions[atom.id];
      return {id:atom.id, element:atom.element, x:a.x + (b.x - a.x) * eased, y:a.y + (b.y - a.y) * eased};
    });
  }
  function mount({container}) {
    if (!container || !container.ownerDocument) throw new Error('ReactionStory.mount needs a container element.');
    const doc = container.ownerDocument, win = doc.defaultView;
    const rootEl = doc.createElement('section');
    rootEl.className = 'reaction-story'; rootEl.hidden = true;
    rootEl.innerHTML = '<div class="rs-heading"><div><p class="rs-kicker">FOLLOW THE ATOMS</p><h2>看看原子如何重新組合</h2></div><span class="rs-badge">原子守恆</span></div><p class="rs-title"></p><p class="rs-science">原子重組示意，非真實反應機構。虛線框只表示化學式單位；圓點位置與距離不代表化學鍵或分子形狀。</p><p class="rs-unavailable" role="status" hidden></p><div class="rs-animation"><ol class="rs-steps"><li>1 · 反應物</li><li>2 · 原子重新排列</li><li>3 · 生成物</li></ol><canvas class="rs-canvas" role="img" aria-label="依配平係數顯示反應前後的原子數量"></canvas><div class="rs-controls"><button type="button" class="rs-play">播放重組</button><button type="button" class="rs-replay">回到起點</button><label class="rs-timeline"><span>重組進度 <output>0%</output></span><input class="rs-slider" type="range" min="0" max="100" step="1" value="0" aria-label="原子重組進度"></label></div><p class="rs-motion" hidden>已啟用減少動態效果：使用進度滑桿逐步觀察。</p><p class="rs-stage" aria-live="polite">反應物：每個圓點代表一顆原子。</p></div><div class="rs-ledger"><h3>原子數量，前後都一樣</h3><div class="rs-table-wrap"><table><thead><tr><th scope="col">元素</th><th scope="col">反應前</th><th scope="col">反應後</th><th scope="col">結果</th></tr></thead><tbody></tbody></table></div><p class="rs-charge"></p></div>';
    container.appendChild(rootEl);
    const $ = selector => rootEl.querySelector(selector);
    const canvas = $('.rs-canvas'), ctx = canvas.getContext('2d'), slider = $('.rs-slider'), playButton = $('.rs-play');
    const motion = win.matchMedia ? win.matchMedia('(prefers-reduced-motion: reduce)') : {matches:false};
    let plan = null, layout = null, signature = '', progress = 0, running = false, frame = 0, last = null, destroyed = false, lastStage = -1;
    const listeners = [];
    function listen(target,event,fn) { target.addEventListener(event,fn); listeners.push(() => target.removeEventListener(event,fn)); }
    function pause() {
      running = false; last = null;
      if (frame) win.cancelAnimationFrame(frame);
      frame = 0; playButton.textContent = '播放重組';
    }
    function draw() {
      if (!plan?.enabled || !layout || !ctx || rootEl.hidden || destroyed) return;
      const {width,height} = layout;
      ctx.clearRect(0,0,width,height);
      ctx.font = '12px "Microsoft JhengHei", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#95a9b7'; ctx.fillText('反應物', width / 4, 23); ctx.fillText('生成物', width * .75, 23);
      ctx.fillStyle = '#72f6cf'; ctx.fillText('→',width / 2,23);
      function groups(side, opacity) {
        if (opacity <= 0) return;
        ctx.save(); ctx.globalAlpha = opacity; ctx.setLineDash([4,4]); ctx.strokeStyle = '#4a6576'; ctx.lineWidth = 1;
        side.cells.forEach(cell => {
          ctx.strokeRect(cell.x,cell.y,cell.width,cell.height);
          ctx.fillStyle = '#c3d5df'; ctx.font = '11px Consolas, monospace';
          let label = cell.group.label;
          while (label.length > 2 && ctx.measureText(label).width > cell.width - 12) label = label.slice(0,-2) + '…';
          ctx.fillText(label,cell.x + cell.width / 2,cell.y + 14);
        }); ctx.restore();
      }
      groups(layout.before, Math.max(0,1 - progress * 3));
      groups(layout.after, Math.max(0,(progress - .67) * 3));
      for (const atom of interpolate(plan,layout,progress)) {
        ctx.beginPath(); ctx.arc(atom.x,atom.y,9.5,0,Math.PI * 2); ctx.fillStyle = color(atom.element); ctx.fill();
        ctx.fillStyle = '#10202a'; ctx.font = (atom.element.length > 2 ? '8' : '10') + 'px Consolas, monospace'; ctx.fillText(atom.element,atom.x,atom.y + .5);
      }
    }
    function updateProgress(value) {
      progress = Math.max(0,Math.min(1,value)); slider.value = String(Math.round(progress * 100)); $('.rs-timeline output').textContent = Math.round(progress * 100) + '%';
      const stage = progress < .25 ? 0 : progress < .75 ? 1 : 2;
      if (stage !== lastStage) {
        lastStage = stage;
        rootEl.querySelectorAll('.rs-steps li').forEach((el,index) => { el.classList.toggle('active',index === stage); if(index === stage) el.setAttribute('aria-current','step'); else el.removeAttribute('aria-current'); });
        $('.rs-stage').textContent = ['反應物：每個圓點代表一顆原子。','同一批原子正在重新排列；此步驟不表示真的形成游離原子。','生成物：原子重新分組，元素種類與各元素總數完全保留。'][stage];
      }
      draw();
    }
    function tick(time) {
      frame = 0;
      if (!running || destroyed || doc.hidden) { pause(); return; }
      if (last !== null) updateProgress(progress + Math.min(time - last,100) / 5500);
      last = time;
      if (progress >= 1) pause(); else frame = win.requestAnimationFrame(tick);
    }
    function play() {
      if (!plan?.enabled || rootEl.hidden || doc.hidden || motion.matches || destroyed) return false;
      if (running) return true;
      if (progress >= 1) updateProgress(0);
      running = true; last = null; playButton.textContent = '暫停'; frame = win.requestAnimationFrame(tick); return true;
    }
    function resize() {
      if (!plan?.enabled || rootEl.hidden || destroyed) return;
      layout = layoutPlan(plan, Math.max(240, Math.floor(canvas.getBoundingClientRect().width || rootEl.clientWidth - 40)));
      const ratio = Math.min(2,win.devicePixelRatio || 1);
      canvas.width = Math.round(layout.width * ratio); canvas.height = Math.round(layout.height * ratio); canvas.style.height = layout.height + 'px';
      if (ctx) ctx.setTransform(ratio,0,0,ratio,0,0);
      draw();
    }
    function motionChanged() { pause(); playButton.disabled = !!motion.matches; $('.rs-motion').hidden = !motion.matches; }
    listen(playButton,'click',() => running ? pause() : play());
    listen($('.rs-replay'),'click',() => { pause(); updateProgress(0); });
    listen(slider,'input',() => { pause(); updateProgress(Number(slider.value) / 100); });
    listen(doc,'visibilitychange',() => { if(doc.hidden) pause(); });
    if (motion.addEventListener) listen(motion,'change',motionChanged);
    const observer = win.ResizeObserver ? new win.ResizeObserver(resize) : null;
    if(observer) observer.observe(rootEl); else listen(win,'resize',resize);
    motionChanged();
    return {
      show(balanced,reaction) {
        if(destroyed) return null;
        const nextSignature = JSON.stringify([balanced?.reactants,balanced?.products]);
        const wasHidden = rootEl.hidden;
        rootEl.hidden = false;
        if(nextSignature === signature && plan) { if(wasHidden) resize(); return plan; }
        pause(); signature = nextSignature; plan = createPlan(balanced); progress = 0; lastStage = -1;
        const equation = side => (side || []).map(s => (s.coefficient === 1 ? '' : s.coefficient + ' ') + sub(s.formula)).join(' + ');
        $('.rs-title').textContent = (reaction?.name ? reaction.name + ' · ' : '') + equation(balanced?.reactants) + ' → ' + equation(balanced?.products);
        $('.rs-animation').hidden = !plan.enabled;
        $('.rs-unavailable').hidden = plan.enabled; $('.rs-unavailable').textContent = plan.reason;
        $('.rs-badge').textContent = plan.valid ? '原子與電荷已驗證' : '等待驗證';
        $('.rs-ledger h3').textContent = plan.valid ? '原子數量，前後都一樣' : '原子數量核對';
        const body = $('tbody'); body.replaceChildren();
        for (const row of plan.ledger) {
          const tr = doc.createElement('tr');
          for (const value of [row.element,row.before,row.after,row.before === row.after ? '✓ 守恆' : '未守恆']) { const td = doc.createElement('td'); td.textContent = value; tr.appendChild(td); }
          tr.firstChild.style.color = color(row.element); body.appendChild(tr);
        }
        $('.rs-ledger').hidden = !plan.ledger.length && !plan.charges;
        $('.rs-charge').textContent = plan.charges ? '總電荷：反應前 ' + plan.charges[0] + ' → 反應後 ' + plan.charges[1] + '（以基本電荷為單位）' : '';
        canvas.setAttribute('aria-label', '反應重組示意：' + equation(balanced?.reactants) + ' 生成 ' + equation(balanced?.products) + '。完整元素數量請見下方表格。');
        if(plan.enabled) { resize(); updateProgress(0); }
        return plan;
      },
      hide() { pause(); rootEl.hidden = true; },
      play, pause,
      destroy() { if(destroyed) return; pause(); destroyed = true; observer?.disconnect(); listeners.forEach(remove => remove()); rootEl.remove(); },
      getState() { return {visible:!rootEl.hidden,progress,running,enabled:!!plan?.enabled}; }
    };
  }
  const api = Object.freeze({mount,createPlan,layoutPlan,interpolate,MAX_ATOMS,MAX_GROUPS});
  root.ReactionStory = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
