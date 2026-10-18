// ===== 保存 =====
const LS_KEY = 'keisan-tani-v1';
const SESSION_LEN = 10;
const UNLOCK_NEED = 8; // ステップの10問のうち
function freshState() {
  return { v: 2, updatedAt: 0, unlocked: { A1: true, B1: true }, best: {}, mistakes: {}, typeStats: {}, sessions: [] };
}
// v1 (A1=整数・小数, A2=分数, A3=まぜた計算) → v2 (A1=整数, A2=小数, A3=分数, A4=まぜた計算)
function migrate(s) {
  if (!s || typeof s !== 'object') return null;
  if (s.v === 2) return s;
  if (s.v !== 1) return null;
  const u = s.unlocked || {};
  const unlocked = { A1: true, A2: !!u.A2, A3: !!u.A2, A4: !!u.A3, B1: true, B2: !!u.B2, B3: !!u.B3, B4: !!u.B4 };
  const mistakes = {};
  const oldLv = { dec_add: 2, dec_sub: 2, dec_mul: 4, dec_div: 5, int_mul: 4, int_div: 4, mental: 5 };
  for (const [t, n] of Object.entries(s.mistakes || {})) if (n > 0 && !t.includes(':')) mistakes[`${t}:${oldLv[t] || 0}`] = n;
  const modeMap = { A2: 'A3', A3: 'A4' };
  const sessions = (s.sessions || []).map((x) => Object.assign({}, x, { mode: modeMap[x.mode] || x.mode }));
  const out = Object.assign({}, s, { v: 2, unlocked, mistakes, best: {}, sessions });
  delete out.recent;
  return out;
}
function loadLocal() {
  try { const s = migrate(JSON.parse(localStorage.getItem(LS_KEY))); if (s) return Object.assign(freshState(), s); } catch (e) { /* 読めないときは新しく始める */ }
  return freshState();
}
function saveLocal() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) { /* 保存できない環境 */ }
}
let state = loadLocal();
let db = null; let dbStatus = 'checking'; // checking | on | off | error
async function initDb() {
  try {
    db = window.claude && window.claude.use ? await window.claude.use('db') : null;
  } catch (e) { db = null; }
  if (!db) { dbStatus = 'off'; render(); return; }
  try {
    const snap = await db.doc('state/main').get();
    if (snap.exists) {
      const remote = migrate(JSON.parse(JSON.stringify(snap.data())));
      if (remote && (remote.updatedAt || 0) > (state.updatedAt || 0)) {
        const sessions = state.sessions;
        state = Object.assign(freshState(), remote, { sessions });
      }
    }
    const qs = await db.collection('sessions').orderBy('endedAt', 'desc').limit(60).get();
    const have = new Set(state.sessions.map((s) => s.id));
    qs.docs.forEach((d) => { const s = d.data(); if (!have.has(s.id)) state.sessions.push(JSON.parse(JSON.stringify(s))); });
    state.sessions.sort((a, b) => b.endedAt - a.endedAt);
    state.sessions = state.sessions.slice(0, 60);
    saveLocal();
    dbStatus = 'on';
  } catch (e) { dbStatus = 'error'; }
  if (view !== 'practice') render();
}
async function saveRemote(session) {
  if (!db || dbStatus === 'off') return;
  try {
    const { sessions, ...rest } = state;
    await db.doc('state/main').set(JSON.parse(JSON.stringify(rest)));
    if (session) await db.collection('sessions').doc(session.id).set(JSON.parse(JSON.stringify(session)));
    dbStatus = 'on';
  } catch (e) { dbStatus = 'error'; }
}

// ===== 出題の選び方 =====
const unlockedStages = () => Object.keys(STAGES).filter((s) => state.unlocked[s]);
function frontier(track) { const u = TRACKS[track].stages.filter((s) => state.unlocked[s]); return u[u.length - 1]; }
function weightedStage() {
  const list = [];
  for (const t of Object.keys(TRACKS)) {
    const f = frontier(t);
    TRACKS[t].stages.filter((s) => state.unlocked[s]).forEach((s) => list.push([s, s === f ? 3 : 1]));
  }
  let sum = list.reduce((a, b) => a + b[1], 0), x = rnd() * sum;
  for (const [s, w] of list) { if ((x -= w) < 0) return s; }
  return list[0][0];
}
// mistakes のキーは "種類:レベル" (レベルのないステップは 0)
const missKey = (type, level) => `${type}:${level || 0}`;
function splitMiss(k) { const [type, lv] = k.split(':'); return { type, level: +lv || null }; }
function missLabel(k) { const { type, level } = splitMiss(k); return TYPE_NAMES[type] + (level ? ` (レベル${level})` : ''); }
// 1回の10問: レベルのあるステップは 1問ごとに LEVEL_RAMP にそってむずかしくなる
function planSession(mode) {
  const allowed = mode === 'auto' ? unlockedStages() : [mode];
  const plan = [];
  for (let i = 0; i < SESSION_LEN; i++) {
    const st = mode === 'auto' ? weightedStage() : mode;
    const level = STAGES[st].levels ? LEVEL_RAMP[i] : null;
    plan.push({ type: pick(levelTypes(st, level)), level });
  }
  // 前にまちがえた種類を、同じレベルの位置に入れる (最大3問)
  const miss = Object.entries(state.mistakes).filter(([k, n]) => n > 0 && STAGES[stageOfType(splitMiss(k).type)] && allowed.includes(stageOfType(splitMiss(k).type)))
    .sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => splitMiss(k));
  const used = new Set();
  for (const m of miss) {
    let idx = m.level ? LEVEL_RAMP.findIndex((lv, i) => lv === m.level && !used.has(i)) : -1;
    if (idx < 0 && !m.level) { const free = plan.map((x, i) => i).filter((i) => !used.has(i) && !plan[i].level); idx = free.length ? pick(free) : -1; }
    if (idx < 0) continue;
    used.add(idx); plan[idx] = { type: m.type, level: m.level };
  }
  if (!plan.some((x) => x.level)) return shuffle(plan);
  return plan;
}

// ===== 練習の状態 =====
let view = 'home';
let sess = null; // {id, mode, plan:[{type, extra}], idx, items:[], startedAt, problem, inputs, active, phase, t0, sideTab, frame, hint}
function startSession(mode) {
  sess = { id: 's' + Date.now().toString(36) + Math.floor(rnd() * 1e4).toString(36), mode, plan: planSession(mode), idx: 0, items: [], startedAt: Date.now() };
  view = 'practice';
  nextProblem(true);
}
function nextProblem(first) {
  if (!first) sess.idx++;
  if (sess.idx >= sess.plan.length) { finishSession(); return; }
  const it = sess.plan[sess.idx];
  sess.problem = makeProblem(it.type, it.level || undefined);
  sess.inputs = sess.problem.slots.map(() => '');
  sess.choice = null;
  sess.active = 0;
  sess.phase = 'answer'; // answer | done
  sess.result = null;
  sess.t0 = Date.now();
  sess.hint = false; sess.frame = 0; sess.sideTab = 'memo'; sess.frames = null;
  sess.msg = null;
  render();
  if (memo) memo.clear();
}
function frames() { if (!sess.frames) sess.frames = sess.problem.explain(); return sess.frames; }
function showExplain() {
  if (sess.phase === 'answer') sess.hint = true;
  sess.sideTab = 'explain'; sess.frame = 0;
  render();
}
function recordAnswer(ok, givenText) {
  const p = sess.problem;
  const extra = !!sess.plan[sess.idx].extra;
  const item = { type: p.type, stage: p.stage, level: p.level, q: p.text, given: givenText, answer: p.answerText, ok, hint: sess.hint, ms: Date.now() - sess.t0, extra };
  sess.items.push(item);
  const ts = state.typeStats[p.type] || (state.typeStats[p.type] = { n: 0, c: 0, hint: 0, review: 0 });
  ts.n++; if (ok) ts.c++; if (sess.hint) ts.hint++;
  const mk = missKey(p.type, p.level);
  const m = state.mistakes[mk] || 0;
  state.mistakes[mk] = ok ? Math.max(0, m - 1) : Math.min(3, m + 1);
  if (!state.mistakes[mk]) delete state.mistakes[mk];
  state.updatedAt = Date.now();
  saveLocal();
}
function submit() {
  if (sess.phase !== 'answer') return;
  const p = sess.problem;
  if (p.choices) {
    if (!sess.choice) { sess.msg = { kind: 'warn', title: 'えらんでから「答える」をおしてね' }; render(); return; }
    const ok = sess.choice === p.answerChoice;
    sess.phase = 'done'; sess.result = ok;
    const given = p.choices.find((c) => c.id === sess.choice);
    recordAnswer(ok, given.text || given.html);
    if (!ok) { sess.sideTab = 'explain'; sess.frame = 0; }
    render(); return;
  }
  const js = p.slots.map((s, i) => judgeSlot(sess.inputs[i], s));
  if (js.includes('empty')) { sess.msg = { kind: 'warn', title: '答えを全部入れてね' }; sess.active = js.indexOf('empty'); render(); return; }
  if (js.includes('bad')) { sess.msg = { kind: 'warn', title: '数の書き方を見なおしてね', body: '分数は「3/4」、帯分数は「1と3/4」のように入れます。' }; render(); return; }
  if (!js.includes('ng') && js.includes('reduce')) {
    sess.msg = { kind: 'warn', title: 'おしい！ 大きさは合っています', body: '約分できるところがあるか、帯分数の分数の部分が 1 より小さいか見てみよう。' };
    sess.reduceHinted = true; render(); return;
  }
  const ok = js.every((j) => j === 'ok');
  sess.phase = 'done'; sess.result = ok; sess.msg = null;
  recordAnswer(ok, sess.inputs.map((x, i) => x + (p.slots[i].unit ? ' ' + p.slots[i].unit : '')).join(' '));
  if (!ok) { sess.sideTab = 'explain'; sess.frame = 0; }
  render();
}
function oneMore() {
  sess.plan.splice(sess.idx + 1, 0, { type: sess.problem.type, level: sess.problem.level, extra: true });
  nextProblem();
}
const nextStageOf = (s) => { const order = TRACKS[STAGES[s].track].stages; return order[order.indexOf(s) + 1]; };
// ステップをえらんだ10問を全部答えたときだけ、点数を記録し、8問以上なら次のステップをひらく
function judgeStage() {
  if (sess.mode === 'auto') return;
  const main = sess.items.filter((x) => !x.extra);
  if (main.length < SESSION_LEN) return;
  const c = main.filter((x) => x.ok).length;
  const b = state.best[sess.mode];
  if (!b || c > b.c) state.best[sess.mode] = { c, n: SESSION_LEN };
  sess.stageScore = c;
  const nx = nextStageOf(sess.mode);
  if (nx && c >= UNLOCK_NEED && !state.unlocked[nx]) { state.unlocked[nx] = true; sess.unlockedNow = [nx]; }
}
function finishSession(quit) {
  if (!sess) return;
  if (!quit) judgeStage();
  if (sess.items.length) {
    const s = { id: sess.id, mode: sess.mode, startedAt: sess.startedAt, endedAt: Date.now(), n: sess.items.length, c: sess.items.filter((x) => x.ok).length, items: sess.items, quit: !!quit };
    state.sessions.unshift(s); state.sessions = state.sessions.slice(0, 60);
    state.updatedAt = Date.now();
    saveLocal();
    saveRemote(s);
    sess.saved = s;
  }
  view = quit ? 'home' : 'result';
  if (quit) sess = null;
  render();
}

// ===== 描画 =====
const $ = (sel, root = document) => root.querySelector(sel);
const app = () => document.getElementById('app');

function header() {
  const tab = (id, label) => `<button data-act="tab" data-v="${id}" aria-pressed="${(view === id || (id === 'home' && ['practice', 'result'].includes(view)))}">${label}</button>`;
  return `<header class="top"><div class="brand"><span class="sq" aria-hidden="true"></span>計算と単位の練習帳</div><nav class="tabs" aria-label="画面">${tab('home', 'れんしゅう')}${tab('parent', 'きろく (保護者)')}</nav></header>`;
}
function dotsHTML(arr, total = 10) {
  let s = '<span class="dots" aria-hidden="true">';
  for (let i = 0; i < total; i++) s += `<i class="${arr[i] === 1 ? 'ok' : arr[i] === 0 ? 'ng' : ''}"></i>`;
  return s + '</span>';
}
function bestText(s) { const b = state.best[s]; return b ? `いちばんよい点: ${b.c} / ${b.n}` : 'まだ10問やっていません'; }
function homeHTML() {
  const miss = Object.entries(state.mistakes).filter(([, n]) => n > 0).map(([k]) => missLabel(k));
  let h = `<section class="hero grid-bg"><div><h1>きょうの れんしゅう</h1><p>ステップをえらぶと、1回 10問。<b>1問ごとに少しずつむずかしくなります</b> (レベル1 → 5)。</p><p>10問中 ${UNLOCK_NEED}問以上 正解すると、次のステップが ひらきます。わからないときは「しくみを見る」で、考え方を1つずつ見られます。</p>${miss.length ? `<p>前にまちがえた問題も入ります: ${miss.slice(0, 3).join('、')}${miss.length > 3 ? ' ほか' : ''}</p>` : ''}</div><div class="hero-act"><button class="btn btn-main" data-act="start" data-v="auto">おまかせで はじめる</button><span class="sub">ひらいているステップから まぜて出します</span></div></section><div class="tracks">`;
  for (const t of Object.keys(TRACKS)) {
    const T = TRACKS[t];
    h += `<section class="track"><h2>${t}. ${T.name}</h2>`;
    T.stages.forEach((s, i) => {
      const on = state.unlocked[s]; const prev = T.stages[i - 1]; const nx = T.stages[i + 1]; const St = STAGES[s];
      const lv = St.levels ? `<ol class="lvls">${Object.entries(St.levels).map(([n, l]) => `<li><span class="lvn">レベル${n}</span>${l.name}</li>`).join('')}</ol>` : `<div class="sub">${[...new Set(St.types)].map((x) => TYPE_NAMES[x]).join('・')}</div>`;
      let rule;
      if (!on) rule = `<span>${prev}「${STAGES[prev].name}」の10問で ${UNLOCK_NEED}問以上 正解すると ひらきます</span>`;
      else rule = `<span>${bestText(s)}</span>${nx && !state.unlocked[nx] ? `<span>${UNLOCK_NEED}問以上 正解で ${nx} が ひらきます</span>` : ''}`;
      h += `<div class="stage${on ? '' : ' locked'}"><span class="code">${s}</span><div><div class="nm">${St.name}</div><div class="sub rule">${rule}</div>${lv}</div>${on ? `<button class="btn btn-sub" data-act="start" data-v="${s}">これをやる</button>` : '<span></span>'}</div>`;
    });
    h += '</section>';
  }
  return h + '</div>';
}
function inputHTML(s) {
  if (!s) return '';
  let m;
  if ((m = s.match(/^(\d*)と(\d*)(?:\/(\d*))?$/))) return `<span class="mx">${m[1]}${m[3] !== undefined || s.includes('/') ? fracHTML(m[2] || '&nbsp;', m[3] || '&nbsp;') : `と${m[2]}`}</span>`;
  if ((m = s.match(/^(\d*)\/(\d*)$/))) return fracHTML(m[1] || '&nbsp;', m[2] || '&nbsp;');
  return esc(s);
}
function practiceHTML() {
  const p = sess.problem;
  const main = sess.plan.filter((x) => !x.extra).length;
  const doneMain = sess.plan.slice(0, sess.idx).filter((x) => !x.extra).length;
  const isExtra = !!sess.plan[sess.idx].extra;
  let dots = '<span class="dots" aria-hidden="true">';
  let k = 0;
  sess.plan.forEach((pl, i) => {
    if (pl.extra) return;
    const it = sess.items.filter((x) => !x.extra)[k];
    dots += `<i class="${it ? (it.ok ? 'ok' : 'ng') : ''}${i === sess.idx ? ' now' : ''}"></i>`; k++;
  });
  dots += '</span>';
  let left = `<div class="pbar">${dots}<span class="count">${isExtra ? 'もう1問 (同じレベル)' : `${doneMain + 1} / ${main} 問目`}</span><button class="btn btn-line" data-act="quit" style="padding:8px 14px;font-size:.9rem">やめる</button></div>`;
  if (sess.idx === 0 && p.level) left += `<p class="pnote">1問ごとに少しずつ むずかしくなります (レベル1 → 5)。${sess.mode === 'auto' ? '' : `10問中 ${UNLOCK_NEED}問以上 正解で 次のステップが ひらきます。`}</p>`;
  const lvInfo = p.level ? STAGES[p.stage].levels[p.level] : null;
  left += `<div class="qcard"><div class="qmeta"><span class="code">${p.stage}</span>${p.level ? `<span class="lvchip">レベル ${p.level} / 5</span>` : ''}<span>${TYPE_NAMES[p.type]}</span>${lvInfo ? `<span class="lvname">${lvInfo.name}</span>` : ''}</div>`;
  if (p.lead) left += `<div class="lead">${p.lead}</div>`;
  left += `<div class="q">${p.html}</div>`;
  if (p.note) left += `<div class="qnote">${p.note}</div>`;
  if (p.choices) {
    left += '<div class="choices">' + p.choices.map((c) => {
      let cls = '';
      if (sess.phase === 'done') { if (c.id === p.answerChoice) cls = ' right'; else if (c.id === sess.choice) cls = ' wrong'; }
      return `<button class="choice${cls}" data-act="choose" data-v="${c.id}" aria-pressed="${sess.choice === c.id}" ${sess.phase === 'done' ? 'disabled' : ''}>${c.html}</button>`;
    }).join('') + '</div>';
  } else {
    left += '<div class="slots">' + p.slots.map((s, i) => `<span class="slotwrap"><button class="slot" data-act="slot" data-v="${i}" aria-pressed="${sess.phase === 'answer' && sess.active === i}" aria-label="答え${p.slots.length > 1 ? i + 1 : ''}">${sess.inputs[i] ? inputHTML(sess.inputs[i]) : '<span class="ph">ここに入力</span>'}${sess.phase === 'answer' && sess.active === i ? '<span class="cur"></span>' : ''}</button>${s.unit ? `<span class="unit">${s.unit}</span>` : ''}</span>`).join('') + '</div>';
  }
  if (sess.phase === 'done' && sess.result) left += '<svg class="maru" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="50"/></svg>';
  left += '</div>';
  if (sess.msg) left += `<div class="feedback ${sess.msg.kind}" role="status"><div class="fb-title">${sess.msg.title}</div>${sess.msg.body ? `<div>${sess.msg.body}</div>` : ''}</div>`;
  if (sess.phase === 'done') {
    const last = sess.idx >= sess.plan.length - 1;
    const nextLabel = last ? '結果を見る' : 'つぎへ';
    if (sess.result) {
      left += `<div class="feedback ok" role="status"><div class="fb-title">せいかい！</div>${sess.hint ? '<div class="note">しくみを見てから答えました。次は見ないでできるかな。</div>' : ''}<div class="fb-actions"><button class="btn btn-main" data-act="next">${nextLabel}</button>${sess.sideTab !== 'explain' ? '<button class="btn btn-sub" data-act="explain">しくみを見る</button>' : ''}</div></div>`;
    } else {
      left += `<div class="feedback ng" role="status"><div class="fb-title">おしい。答えは</div><div class="fb-ans">${p.answerHTML}</div><div class="note">右の「しくみ」で、考え方を1つずつ見てみよう。</div><div class="fb-actions"><button class="btn btn-sub" data-act="more">同じ種類をもう1問</button><button class="btn btn-main" data-act="next">${nextLabel}</button></div></div>`;
    }
  } else if (!p.choices) {
    left += `<div class="keypad" role="group" aria-label="数字キー">${['7', '8', '9', '⌫', '4', '5', '6', '/', '1', '2', '3', 'と', '0', '.', 'C', 'go'].map((k) => {
      if (k === 'go') return '<button class="key go" data-act="submit">答える</button>';
      const label = { '⌫': '1字けす', '/': '分数 /', 'と': '帯分数 と', C: '全部けす' }[k];
      return `<button class="key${label ? ' fn' : ''}" data-act="key" data-v="${k}"${label ? ` aria-label="${label}"` : ''}>${label || k}</button>`;
    }).join('')}</div>`;
  } else {
    left += '<div class="fb-actions"><button class="btn btn-main" data-act="submit">答える</button></div>';
  }
  if (sess.phase === 'answer') left += '<div class="fb-actions"><button class="btn btn-line" data-act="explain">しくみを見る (ヒント)</button></div>';

  // 右
  let right = `<aside class="side"><div class="side-tabs"><button class="t" data-act="side" data-v="memo" aria-pressed="${sess.sideTab === 'memo'}">けいさんメモ</button><button class="t" data-act="side" data-v="explain" aria-pressed="${sess.sideTab === 'explain'}">しくみ</button><span class="sp"></span>${sess.sideTab === 'memo' ? `<button class="mini" data-act="finger" aria-pressed="${!!state.finger}">指でも書く</button><button class="mini" data-act="clear">メモをけす</button>` : ''}</div>`;
  if (sess.sideTab === 'memo') {
    right += `<div class="memo grid-bg" id="memo"><canvas id="memo-canvas" aria-label="計算メモ。Apple Pencil で書けます"></canvas><span class="hint">Apple Pencil で筆算を書けます${state.finger ? ' (指でも書けます)' : ''}</span></div>`;
  } else if (sess.phase === 'answer' && !sess.hint) {
    right += '<div class="explain"><p class="ex-empty">答えたあとに、考え方を1つずつ見られます。</p></div>';
  } else {
    const fs = frames(); const f = fs[sess.frame];
    right += `<div class="explain"><div class="ex-nav"><button class="btn btn-line" data-act="fprev" ${sess.frame === 0 ? 'disabled' : ''}>まえ</button><button class="btn btn-sub" data-act="fnext" ${sess.frame >= fs.length - 1 ? 'disabled' : ''}>つぎ</button><span class="count">${sess.frame + 1} / ${fs.length}</span></div>${f.grid ? `<div class="ex-scroll">${gridHTML(f.grid, { div: f.div })}</div>` : ''}<div class="ex-step">${f.text}</div></div>`;
  }
  right += '</aside>';
  return `<div class="practice"><div class="col">${left}</div>${right}</div>`;
}
function resultHTML() {
  const s = sess.saved || { n: 0, c: 0, items: [] };
  const mins = Math.max(1, Math.round((s.endedAt - s.startedAt) / 60000));
  let h = `<section class="result"><div class="score"><span class="big">${s.c} / ${s.n}</span><span>正解 (${mins}分)</span></div>`;
  (sess.unlockedNow || []).forEach((st) => { h += `<div class="banner">${st}「${STAGES[st].name}」が ひらきました。</div>`; });
  if (sess.mode !== 'auto' && sess.stageScore !== undefined && !(sess.unlockedNow || []).length) {
    const nx = nextStageOf(sess.mode);
    if (nx && !state.unlocked[nx]) h += `<p class="note">あと ${UNLOCK_NEED - sess.stageScore}問 正解すると ${nx}「${STAGES[nx].name}」が ひらきます。もう1回 ${sess.mode} をやってみよう。</p>`;
  }
  const wrongTypes = [...new Set(s.items.filter((x) => !x.ok).map((x) => TYPE_NAMES[x.type] + (x.level ? ` (レベル${x.level})` : '')))];
  if (wrongTypes.length) h += `<p class="note">次の練習では、${wrongTypes.join('、')} を多めに出します。</p>`;
  h += '<div class="list">' + s.items.map((x) => `<div class="li"><span class="m ${x.ok ? 'ok' : 'ng'}">${x.ok ? '○' : '–'}</span><span class="qq">${x.level ? `<span class="lvchip">Lv${x.level}</span> ` : ''}${esc(x.q)}${x.extra ? ' <span class="pill">もう1問</span>' : ''}</span><span class="aa">${x.ok ? esc(x.answer) : `答え ${esc(x.answer)}<br>入力 ${esc(x.given)}`}</span></div>`).join('') + '</div>';
  h += `<div class="fb-actions"><button class="btn btn-main" data-act="start" data-v="${sess.mode}">もう1回 ${sess.mode === 'auto' ? 'おまかせ' : sess.mode}</button><button class="btn btn-line" data-act="tab" data-v="home">はじめの画面へ</button></div></section>`;
  return h;
}
function fmtDate(t) { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }
let confirmReset = false;
let copyState = null; // null | 'ok' | 'manual'
function exportText() {
  const sessions = state.sessions.slice(0, 30).map((s) => ({ at: new Date(s.endedAt).toISOString(), mode: s.mode, n: s.n, c: s.c, min: Math.round((s.endedAt - s.startedAt) / 6000) / 10, quit: s.quit || undefined,
    items: s.items.map((x) => [x.type + (x.level ? ':' + x.level : ''), x.ok ? 1 : 0, x.hint ? 1 : 0, Math.round(x.ms / 1000), x.q, x.given, x.answer]) }));
  return '計算と単位の練習帳 記録\n' + JSON.stringify({ v: 2, exportedAt: new Date().toISOString(), unlocked: state.unlocked, best: state.best, mistakes: state.mistakes, typeStats: state.typeStats, itemsFormat: ['type', 'ok', 'hint', 'sec', 'q', 'given', 'answer'], sessions });
}
function parentHTML() {
  const all = Object.values(state.typeStats).reduce((a, s) => ({ n: a.n + s.n, c: a.c + s.c }), { n: 0, c: 0 });
  const weekAgo = Date.now() - 7 * 864e5;
  const week = state.sessions.filter((s) => s.endedAt > weekAgo).reduce((a, s) => a + s.n, 0);
  const lastS = state.sessions[0];
  let h = `<section class="parent"><div><h1 style="font-size:1.6rem">きろく</h1><p class="store">保存先: この端末のブラウザ${dbStatus === 'on' ? '、claude.ai (同じアカウントなら別の端末でも記録が続きます)' : dbStatus === 'error' ? '。claude.ai への保存に失敗しました。この端末には保存されています' : dbStatus === 'checking' ? ' (claude.ai への接続を確認中)' : 'のみ。別の端末とは共有されないため、こまめに「記録をコピー」で送ってください'}</p></div>`;
  h += `<div class="tiles"><div class="tile"><div class="k">この7日間の問題数</div><div class="v">${week}</div></div><div class="tile"><div class="k">これまでの正答率</div><div class="v">${all.n ? Math.round(all.c / all.n * 100) + '%' : '–'}</div></div><div class="tile"><div class="k">これまでの問題数</div><div class="v">${all.n}</div></div><div class="tile"><div class="k">最後の練習</div><div class="v" style="font-size:1.2rem">${lastS ? fmtDate(lastS.endedAt) : '–'}</div></div></div>`;
  h += `<div class="sec"><h2>段階</h2><p class="note">ステップをえらんだ10問 (レベル1→5) で ${UNLOCK_NEED}問以上 正解すると、次のステップがひらきます。おまかせの練習ではひらきません。ここから手動でひらく・とじることもできます。</p><div class="tbl-wrap"><table><thead><tr><th>段階</th><th>内容</th><th>状態</th><th>いちばんよい点</th><th></th></tr></thead><tbody>`;
  for (const s of Object.keys(STAGES)) {
    const b = state.best[s];
    const base = s === 'A1' || s === 'B1';
    h += `<tr><td><span class="code">${s}</span></td><td>${STAGES[s].name}</td><td><span class="pill${state.unlocked[s] ? ' on' : ''}">${state.unlocked[s] ? 'ひらいている' : 'まだ'}</span></td><td>${b ? `${b.c} / ${b.n}` : '–'}</td><td>${base ? '' : `<button class="btn btn-line" style="padding:6px 12px;font-size:.85rem" data-act="toggle" data-v="${s}">${state.unlocked[s] ? 'とじる' : 'ひらく'}</button>`}</td></tr>`;
  }
  h += '</tbody></table></div></div>';
  const rows = Object.keys(TYPE_NAMES).map((t) => ({ t, s: state.typeStats[t] })).filter((x) => x.s && x.s.n).sort((a, b) => a.s.c / a.s.n - b.s.c / b.s.n);
  h += `<div class="sec"><h2>種類ごとの正答率 (低い順)</h2>`;
  if (!rows.length) h += '<p class="note">まだ記録がありません。練習すると、ここに種類ごとの正答率が出ます。</p>';
  else {
    h += '<div class="tbl-wrap"><table><thead><tr><th>種類</th><th>段階</th><th>回数</th><th>正答率</th><th>先にしくみを見た</th><th>次回多めに出す</th></tr></thead><tbody>';
    rows.forEach(({ t, s }) => { const r = Math.round(s.c / s.n * 100); h += `<tr><td>${TYPE_NAMES[t]}</td><td>${stageOfType(t)}</td><td class="num">${s.n}</td><td><span class="bar${r < 70 ? ' low' : ''}"><i style="width:${r}%"></i></span>${r}%</td><td class="num">${s.hint}</td><td>${Object.keys(state.mistakes).some((k) => k.startsWith(t + ':')) ? '<span class="pill">はい</span>' : ''}</td></tr>`; });
    h += '</tbody></table></div>';
  }
  h += '</div><div class="sec"><h2>最近の練習</h2>';
  if (!state.sessions.length) h += '<p class="note">まだ記録がありません。</p>';
  state.sessions.slice(0, 20).forEach((s) => {
    const mins = Math.max(1, Math.round((s.endedAt - s.startedAt) / 60000));
    h += `<details class="sess"><summary><span>${fmtDate(s.endedAt)}</span><span>${s.mode === 'auto' ? 'おまかせ' : s.mode + ' ' + STAGES[s.mode].name}</span><span>${s.c} / ${s.n} 正解</span><span>${mins}分</span>${s.quit ? '<span class="pill">途中でやめた</span>' : ''}</summary><div class="list" style="border:0;border-top:1px solid var(--rule);border-radius:0">${s.items.map((x) => `<div class="li"><span class="m ${x.ok ? 'ok' : 'ng'}">${x.ok ? '○' : '–'}</span><span class="qq">${esc(x.q)}${x.hint ? ' <span class="pill">しくみ</span>' : ''}</span><span class="aa">${x.ok ? `${Math.round(x.ms / 1000)}秒` : `答え ${esc(x.answer)} / 入力 ${esc(x.given)}`}</span></div>`).join('')}</div></details>`;
  });
  h += '</div>';
  h += `<div class="sec"><h2>記録を Claude に送る</h2><p class="note">ボタンをおすと記録がコピーされます。プロジェクトのスレッドに貼り付けて送ってください。次の改善に使います。</p><div class="fb-actions"><button class="btn btn-sub" data-act="copy">記録をコピー</button>${copyState === 'ok' ? '<span class="pill on" role="status">コピーしました</span>' : ''}</div>${copyState === 'manual' ? '<p class="note" role="status">自動でコピーできませんでした。下の文字を全部選んでコピーしてください。</p><textarea id="export-box" readonly style="width:100%;min-height:140px;font-family:var(--f-mono);font-size:.8rem;background:var(--paper);color:var(--ink);border:1px solid var(--rule);border-radius:8px;padding:8px">' + esc(exportText()) + '</textarea>' : ''}</div>`;
  h += `<div class="sec"><h2>データ</h2><div class="danger">${confirmReset ? '<span>この端末と claude.ai の段階・正答率をリセットします。練習の記録一覧は残ります。</span><button class="btn btn-danger" data-act="reset-yes">リセットする</button><button class="btn btn-line" data-act="reset-no">やめる</button>' : '<button class="btn btn-line" data-act="reset">段階と正答率をリセット</button>'}</div></div>`;
  return h + '</section>';
}
function render() {
  const el = app(); if (!el) return;
  let body = '';
  if (view === 'home') body = homeHTML();
  else if (view === 'practice') body = practiceHTML();
  else if (view === 'result') body = resultHTML();
  else body = parentHTML();
  el.innerHTML = `<div class="wrap">${header()}${body}</div>`;
  if (view === 'practice' && sess.sideTab === 'memo') attachMemo();
}

// ===== メモ (Apple Pencil) =====
let memo = null;
class Memo {
  constructor() { this.strokes = []; this.cur = null; this.canvas = null; }
  attach(canvas) {
    this.canvas = canvas;
    const box = canvas.parentElement;
    const resize = () => {
      const r = box.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
      this.ctx = canvas.getContext('2d'); this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.redraw();
    };
    resize();
    if (this.ro) this.ro.disconnect();
    this.ro = new ResizeObserver(resize); this.ro.observe(box);
    const pos = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top, e.pressure || 0.5]; };
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' && !state.finger) return;
      e.preventDefault(); canvas.setPointerCapture(e.pointerId);
      this.cur = [pos(e)]; this.strokes.push(this.cur);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!this.cur) return; e.preventDefault();
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      evs.forEach((ev) => this.cur.push(pos(ev)));
      this.drawStroke(this.cur, Math.max(0, this.cur.length - evs.length - 1));
    });
    const end = () => { this.cur = null; };
    canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  }
  color() { return getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#1e2937'; }
  drawStroke(s, from = 0) {
    const c = this.ctx; if (!c) return;
    c.strokeStyle = this.color(); c.lineCap = 'round'; c.lineJoin = 'round';
    for (let i = Math.max(1, from); i < s.length; i++) {
      c.lineWidth = 1.4 + s[i][2] * 2.6;
      c.beginPath(); c.moveTo(s[i - 1][0], s[i - 1][1]); c.lineTo(s[i][0], s[i][1]); c.stroke();
    }
    if (s.length === 1) { c.fillStyle = this.color(); c.beginPath(); c.arc(s[0][0], s[0][1], 1.6, 0, 7); c.fill(); }
  }
  redraw() { if (!this.ctx) return; this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); this.strokes.forEach((s) => this.drawStroke(s)); }
  clear() { this.strokes = []; this.cur = null; this.redraw(); }
}
function attachMemo() {
  const cv = document.getElementById('memo-canvas'); if (!cv) return;
  if (!memo) memo = new Memo();
  memo.attach(cv);
}

// ===== 入力 =====
function typeKey(k) {
  if (!sess || sess.phase !== 'answer' || sess.problem.choices) return;
  let s = sess.inputs[sess.active] || '';
  if (k === '⌫') s = s.slice(0, -1);
  else if (k === 'C') s = '';
  else if (k === '/') { if (!s.includes('/') && /\d$/.test(s)) s += '/'; }
  else if (k === 'と') { if (/^\d+$/.test(s)) s += 'と'; }
  else if (k === '.') { if (/^\d+$/.test(s)) s += '.'; else if (s === '') s = '0.'; }
  else if (/\d/.test(k)) { if (s.length < 12) s += k; }
  sess.inputs[sess.active] = s;
  if (sess.msg && sess.msg.kind === 'warn') sess.msg = null;
  render();
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const a = b.dataset.act, v = b.dataset.v;
  if (a === 'tab') { if (view === 'practice' && sess && sess.phase) { finishSession(true); } view = v; confirmReset = false; copyState = null; render(); window.scrollTo(0, 0); }
  else if (a === 'start') { startSession(v); window.scrollTo(0, 0); }
  else if (a === 'key') typeKey(v);
  else if (a === 'slot') { if (sess.phase === 'answer') { sess.active = +v; render(); } }
  else if (a === 'choose') { sess.choice = v; sess.msg = null; render(); }
  else if (a === 'submit') submit();
  else if (a === 'next') { nextProblem(); window.scrollTo(0, 0); }
  else if (a === 'more') { oneMore(); window.scrollTo(0, 0); }
  else if (a === 'explain') showExplain();
  else if (a === 'side') { if (v === 'explain') showExplain(); else { sess.sideTab = 'memo'; render(); } }
  else if (a === 'fprev') { sess.frame = Math.max(0, sess.frame - 1); render(); }
  else if (a === 'fnext') { sess.frame = Math.min(frames().length - 1, sess.frame + 1); if (sess.phase === 'done') { const ts = state.typeStats[sess.problem.type]; if (ts && !sess.reviewed) { ts.review++; sess.reviewed = true; saveLocal(); } } render(); }
  else if (a === 'clear') { if (memo) memo.clear(); }
  else if (a === 'finger') { state.finger = !state.finger; saveLocal(); render(); }
  else if (a === 'quit') finishSession(true);
  else if (a === 'toggle') { state.unlocked[v] = !state.unlocked[v]; state.updatedAt = Date.now(); saveLocal(); saveRemote(); render(); }
  else if (a === 'copy') {
    const txt = exportText();
    const manual = () => { copyState = 'manual'; render(); const t = document.getElementById('export-box'); if (t) { t.focus(); t.select(); } };
    try { navigator.clipboard.writeText(txt).then(() => { copyState = 'ok'; render(); }, manual); } catch (err) { manual(); }
  }
  else if (a === 'reset') { confirmReset = true; render(); }
  else if (a === 'reset-no') { confirmReset = false; render(); }
  else if (a === 'reset-yes') { const keep = state.sessions; const f = state.finger; state = freshState(); state.sessions = keep; state.finger = f; state.updatedAt = Date.now(); saveLocal(); saveRemote(); confirmReset = false; render(); }
});
document.addEventListener('keydown', (e) => {
  if (view !== 'practice' || !sess) return;
  if (e.key === 'Enter' && e.target.closest && e.target.closest('button')) return;
  if (sess.phase === 'done' && e.key === 'Enter') { nextProblem(); return; }
  if (e.key === 'Enter') { submit(); e.preventDefault(); return; }
  if (e.key === 'Backspace') { typeKey('⌫'); e.preventDefault(); return; }
  if (/^[0-9./]$/.test(e.key)) { typeKey(e.key); return; }
  if (e.key === 'Tab' && sess.problem.slots.length > 1 && sess.phase === 'answer') { sess.active = (sess.active + 1) % sess.problem.slots.length; render(); e.preventDefault(); }
});

render();
initDb();
