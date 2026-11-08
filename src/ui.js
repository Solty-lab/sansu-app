// ===== 保存 =====
const CHILD_KEY = 'keisan-tani-v1', TRIAL_KEY = 'keisan-tani-trial';
// 保護者のお試し (保護者ページの「お試し」タブ) は 娘さんの記録と別に保存する
let trialMode = PAGE === 'trial';
let LS_KEY = trialMode ? TRIAL_KEY : CHILD_KEY;
const SESSION_LEN = 10;
// ===== 点数・メダル・タイム =====
// 正解 100点 (しくみを見てから正解 50点)、れんぞく正解・自己ベスト・見直しで少しボーナス
const PTS = { ok: 100, hint: 50, streak: 10, streakMax: 30, pb: 20, review: 20 };
const MEDAL = ['', '銅', '銀', '金'];
const medalHTML = (m) => (m ? `<span class="medal m${m}" title="${MEDAL[m]}メダル">${MEDAL[m]}</span>` : '');
function fmtSec(ms) { const t = Math.round(ms / 1000); return t < 60 ? `${t}秒` : `${Math.floor(t / 60)}分${String(t % 60).padStart(2, '0')}秒`; }
function fmtClock(ms) { const t = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; }
// 10問すべて答えたときのメダル: 金 = しくみを見ずに全問正解、銀 = 9問以上、銅 = 7問以上
function medalOf(items) {
  const main = items.filter((x) => !x.extra); if (main.length < SESSION_LEN) return 0;
  const c = main.filter((x) => x.ok).length;
  return c === SESSION_LEN && !main.some((x) => x.hint) ? 3 : c >= 9 ? 2 : c >= 7 ? 1 : 0;
}
function nextMedalText(items) {
  const main = items.filter((x) => !x.extra); const c = main.filter((x) => x.ok).length; const m = medalOf(items);
  if (m === 3) return '金メダル！ 次はタイムを ちぢめてみよう。';
  if (m === 2) return c === SESSION_LEN ? '金メダルは、しくみを見ずに 10問 正解。' : `あと ${SESSION_LEN - c}問 正解で、金メダルに近づきます (しくみを見ずに 10問 正解)。`;
  return `あと ${(m === 1 ? 9 : 7) - c}問 正解で ${m === 1 ? '銀' : '銅'}メダル。`;
}
// メダルをとれる練習 (ステップ全体と、各レベル)
function allCourses() { const ks = []; for (const st of Object.keys(STAGES)) { ks.push(st); if (STAGES[st].levels) Object.keys(STAGES[st].levels).forEach((n) => ks.push(`${st}:${n}`)); } return ks; }
const elapsed = () => (sess.hiddenAt ? sess.hiddenAt : Date.now()) - sess.t0;
function freshState() {
  return { v: 2, updatedAt: 0, unlocked: { A1: true, B1: true }, best: {}, mistakes: {}, typeStats: {}, fastest: {}, sessions: [], feedback: [] };
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
// 保護者ページは 記録を読むだけ (リセットのときだけ書く)
let allowWrite = PAGE !== 'parent';
function saveLocal() {
  if (!allowWrite) return;
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
// どのステップも最初から選べる (順番の決まりはない)
const allStages = () => Object.keys(STAGES);
// mistakes のキーは "種類:レベル" (レベルのないステップは 0)
const missKey = (type, level) => `${type}:${level || 0}`;
function splitMiss(k) { const [type, lv] = k.split(':'); return { type, level: +lv || null }; }
function missLabel(k) { const { type, level } = splitMiss(k); return TYPE_NAMES[type] + (level ? ` (レベル${level})` : ''); }
// 1回の10問: レベルのあるステップは 1問ごとに LEVEL_RAMP にそってむずかしくなる
// fixedLv があれば そのレベルだけ10問
function planSession(mode, fixedLv) {
  const allowed = mode === 'auto' ? allStages() : [mode];
  const plan = [];
  for (let i = 0; i < SESSION_LEN; i++) {
    const st = mode === 'auto' ? pick(allowed) : mode;
    const level = STAGES[st].levels ? (fixedLv || LEVEL_RAMP[i]) : null;
    plan.push({ type: pick(levelTypes(st, level)), level });
  }
  // 前にまちがえた種類を、同じレベルの位置に入れる (最大3問)
  const miss = Object.entries(state.mistakes).filter(([k, n]) => n > 0 && STAGES[stageOfType(splitMiss(k).type)] && allowed.includes(stageOfType(splitMiss(k).type)))
    .sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => splitMiss(k));
  const used = new Set();
  for (const m of miss) {
    if (fixedLv && m.level !== fixedLv) continue;
    let idx = m.level ? plan.findIndex((x, i) => x.level === m.level && !used.has(i)) : -1;
    if (idx < 0 && !m.level) { const free = plan.map((x, i) => i).filter((i) => !used.has(i) && !plan[i].level); idx = free.length ? pick(free) : -1; }
    if (idx < 0) continue;
    used.add(idx); plan[idx] = { type: m.type, level: m.level };
  }
  if (!plan.some((x) => x.level)) return shuffle(plan);
  return plan;
}

// ===== 練習の状態 =====
let view = PAGE === 'parent' ? 'parent' : 'home';
let sess = null; // {id, mode, plan:[{type, extra}], idx, items:[], startedAt, problem, inputs, active, phase, t0, sideTab, frame, hint}
function startSession(mode, fixedLv, plan) {
  fixedLv = fixedLv ? +fixedLv : null;
  sess = { id: 's' + Date.now().toString(36) + Math.floor(rnd() * 1e4).toString(36), mode, fixedLv, plan: plan || planSession(mode, fixedLv), idx: 0, items: [], startedAt: Date.now(), score: 0, streak: 0 };
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
  sess.hint = false; sess.frame = 0; sess.sideTab = 'memo'; sess.frames = null; sess.reviewed = false; sess.hiddenAt = null;
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
  const item = { type: p.type, stage: p.stage, level: p.level, q: p.text, given: givenText, answer: p.answerText, ok, hint: sess.hint, ms: elapsed(), extra };
  // 点数: 正解 (しくみを見たら半分) + れんぞく正解 + 自己ベスト
  sess.streak = ok ? sess.streak + 1 : 0;
  const gain = { base: ok ? (sess.hint ? PTS.hint : PTS.ok) : 0, streak: ok && sess.streak >= 2 ? Math.min(PTS.streakMax, PTS.streak * (sess.streak - 1)) : 0, pb: 0 };
  if (!state.fastest) state.fastest = {};
  const fk = missKey(p.type, p.level);
  if (ok && !sess.hint) { const prev = state.fastest[fk]; if (prev && item.ms < prev) gain.pb = PTS.pb; if (!prev || item.ms < prev) state.fastest[fk] = item.ms; item.prevFast = prev || null; }
  item.pts = gain.base + gain.streak + gain.pb; item.streak = sess.streak; item.pb = !!gain.pb;
  sess.score += item.pts; sess.gain = gain;
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
// 練習の名前と、いちばんよい点を記録するキー
const sessKey = (mode, lv) => (lv ? `${mode}:${lv}` : mode);
function sessLabel(mode, lv) { if (mode === 'auto') return 'おまかせ'; if (mode === 'retry') return 'まちがえた問題に リベンジ'; return `${mode} ${STAGES[mode] ? STAGES[mode].name : ''}${lv ? ` レベル${lv}` : STAGES[mode] && STAGES[mode].levels ? ' (レベル1→5)' : ''}`; }
// ステップをえらんだ10問を全部答えたときだけ、いちばんよい点を記録する
function judgeStage() {
  sess.records = [];
  if (sess.mode === 'auto' || sess.mode === 'retry') return;
  const main = sess.items.filter((x) => !x.extra);
  if (main.length < SESSION_LEN) return;
  const c = main.filter((x) => x.ok).length;
  const k = sessKey(sess.mode, sess.fixedLv);
  const b = state.best[k] || null;
  sess.prevBest = b ? b.c : null;
  const ms = main.reduce((a, x) => a + x.ms, 0), medal = medalOf(sess.items);
  const nb = Object.assign({ c: 0, n: SESSION_LEN, score: 0, medal: 0 }, b || {});
  if (!b || c > b.c) nb.c = c;
  if (!b || sess.score > (b.score || 0)) { if (b && b.score != null) sess.records.push(`点数の記録を更新 (${b.score} → ${sess.score}点)`); nb.score = sess.score; }
  if (medal > (nb.medal || 0)) { sess.records.push(`${MEDAL[medal]}メダルを とった！`); nb.medal = medal; }
  if (c === SESSION_LEN) { if (b && b.ms && ms < b.ms) sess.records.push(`全問正解タイムを更新 (${fmtSec(b.ms)} → ${fmtSec(ms)})`); if (!nb.ms || ms < nb.ms) nb.ms = ms; }
  state.best[k] = nb;
}
function finishSession(quit) {
  if (!sess) return;
  if (!quit) judgeStage();
  if (sess.items.length) {
    const s = { id: sess.id, mode: sess.mode, lv: sess.fixedLv || undefined, startedAt: sess.startedAt, endedAt: Date.now(), n: sess.items.length, c: sess.items.filter((x) => x.ok).length, items: sess.items, quit: !!quit, score: sess.score, ms: sess.items.reduce((a, x) => a + x.ms, 0), medal: quit ? 0 : medalOf(sess.items) };
    state.sessions.unshift(s); state.sessions = state.sessions.slice(0, 60);
    sess.xpBefore = totalXP(); state.xp = sess.xpBefore + (s.score || 0);
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
  const tab = (id, label) => `<button data-act="tab" data-v="${id}" aria-pressed="${(view === id || (id === 'home' && ['practice', 'result', 'lesson'].includes(view)))}">${label}</button>`;
  const tabs = PAGE === 'parent' ? tab('parent', 'きろく') + tab('inbox', 'フィードバック') + tab('changes', '改善の記録') + tab('home', 'お試し') + tab('mine', 'お試しの記録')
    : PAGE === 'child' || PAGE === 'trial' ? tab('home', 'れんしゅう') + tab('mine', 'じぶんの記録')
      : tab('home', 'れんしゅう') + tab('mine', 'じぶんの記録') + tab('parent', 'きろく (保護者)') + tab('inbox', 'フィードバック') + tab('changes', '改善の記録');
  return `<header class="top"><div class="brand"><span class="sq" aria-hidden="true"></span>${PAGE === 'parent' ? '練習帳 保護者ページ' : PAGE === 'trial' ? '練習帳 お試し (保護者用)' : '計算と単位の練習帳'}</div><nav class="tabs" aria-label="画面">${tabs}</nav></header>${trialMode ? `<div class="trialbar" role="note"><b>お試し</b> 娘さんと同じ画面で 解いて確かめられます。ここで解いた記録は 娘さんの記録とは別に保存され、娘さんの記録・メダル・ランクには入りません。押した「わかった/わからない」などは「フィードバック」タブに「[お試し]」として出ます。${confirmTrialReset ? '<button class="btn btn-danger sm" data-act="trialreset-yes">お試しの記録をけす</button><button class="btn btn-line sm" data-act="trialreset-no">やめる</button>' : '<button class="btn btn-line sm" data-act="trialreset">お試しの記録をけす</button>'}</div>` : ''}`;
}
let confirmTrialReset = false;
function footer() {
  if (PAGE === 'child') return `<footer class="foot"><span>${APP_VERSION}</span><a href="parent.html">保護者ページ</a></footer>`;
  if (PAGE === 'parent') return `<footer class="foot"><span>${APP_VERSION}</span><a href="index.html">娘さんのページ</a></footer>`;
  return `<footer class="foot"><span>${APP_VERSION}</span></footer>`;
}
function dotsHTML(arr, total = 10) {
  let s = '<span class="dots" aria-hidden="true">';
  for (let i = 0; i < total; i++) s += `<i class="${arr[i] === 1 ? 'ok' : arr[i] === 0 ? 'ng' : ''}"></i>`;
  return s + '</span>';
}
function bestText(k) { const b = state.best[k]; return b ? `${medalHTML(b.medal)}${b.c}/${b.n}${b.score ? ` ${b.score}点` : ''}${b.ms ? ` ${fmtSec(b.ms)}` : ''}` : ''; }
function medalSummary() {
  const ks = allCourses(); const cnt = [0, 0, 0, 0]; ks.forEach((k) => { const b = state.best[k]; cnt[b && b.medal ? b.medal : 0]++; });
  return `<div class="medals"><span class="lb">メダル (${ks.length}コース)</span>${[3, 2, 1].map((m) => `<span>${medalHTML(m)} ${cnt[m]}</span>`).join('')}<small>金 = しくみを見ずに10問正解、銀 = 9問以上、銅 = 7問以上</small></div>`;
}
function homeHTML() {
  const miss = Object.entries(state.mistakes).filter(([, n]) => n > 0).map(([k]) => missLabel(k));
  let h = `<section class="hero grid-bg"><div><h1>きょうの れんしゅう</h1><p>やりたいところを、すきな順番で えらべます。1回 10問です。</p><p>「1→5」は 1問ごとに少しずつむずかしくなる10問、「レベル○」は そのレベルだけの10問です。わからないときは「しくみを見る」で、図を見ながら考え方を1つずつ見られます。</p>${miss.length ? `<p>前にまちがえた問題も入ります: ${miss.slice(0, 3).join('、')}${miss.length > 3 ? ' ほか' : ''}</p>` : ''}</div><div class="hero-act">${medalSummary()}<button class="btn btn-main" data-act="start" data-v="auto">おまかせで はじめる</button><span class="sub">ぜんぶのステップから まぜて出します</span></div></section><div class="tracks">`;
  for (const t of Object.keys(TRACKS)) {
    const T = TRACKS[t];
    h += `<section class="track"><h2>${t}. ${T.name}</h2>`;
    T.stages.forEach((s) => {
      const St = STAGES[s];
      let body, acts;
      if (St.levels) {
        body = `<ol class="lvls">${Object.entries(St.levels).map(([n, l]) => `<li><button class="lvbtn" data-act="start" data-v="${s}" data-lv="${n}"><span class="lvn">レベル${n}</span><span class="lvt">${l.name}</span>${bestText(`${s}:${n}`) ? `<span class="best">${bestText(`${s}:${n}`)}</span>` : ''}</button></li>`).join('')}</ol>`;
        acts = `<button class="btn btn-sub" data-act="start" data-v="${s}">1→5 で10問</button>${bestText(s) ? `<span class="best">いちばんよい点 ${bestText(s)}</span>` : ''}`;
      } else {
        body = `<div class="sub">${[...new Set(St.types)].map((x) => TYPE_NAMES[x]).join('・')}</div>`;
        acts = `<button class="btn btn-sub" data-act="start" data-v="${s}">これをやる</button>${Object.entries(LESSONS).filter(([, L]) => L.stage === s).map(([id, L]) => `<button class="btn btn-line" data-act="lesson" data-v="${id}">${L.title} (読みもの)</button>`).join('')}${bestText(s) ? `<span class="best">いちばんよい点 ${bestText(s)}</span>` : ''}`;
      }
      h += `<div class="stage"><span class="code">${s}</span><div><div class="nm">${St.name}</div>${body}</div><div class="stage-acts">${acts}</div></div>`;
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
function gainHTML() {
  const it = sess.items[sess.items.length - 1]; if (!it) return '';
  const parts = [`<span>${fmtSec(it.ms)}</span>`, `<span>+${it.pts}点</span>`];
  if (it.streak >= 2) parts.push(`<span class="hot">${it.streak}れんぞく正解 (+${sess.gain.streak})</span>`);
  if (it.pb) parts.push(`<span class="hot">自己ベスト！ ${fmtSec(it.prevFast)} → ${fmtSec(it.ms)} (+${PTS.pb})</span>`);
  if (it.review) parts.push(`<span class="hot">見直しボーナス +${PTS.review}</span>`);
  return `<div class="gain">${parts.join('')}</div>`;
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
  let left = `<div class="pbar">${dots}<span class="count">${isExtra ? 'もう1問 (同じレベル)' : `${doneMain + 1} / ${main} 問目`}</span><span class="clock">${sess.phase === 'done' ? `<span>この問題 <b>${fmtSec((sess.items[sess.items.length - 1] || { ms: 0 }).ms)}</b></span><span>ここまでの合計 <b>${fmtSec(sess.items.reduce((a, x) => a + x.ms, 0))}</b></span>` : '<span>時間は、答えたあとに出ます</span>'}<span>点数 <b>${sess.score}</b></span></span><button class="btn btn-line" data-act="quit" style="padding:8px 14px;font-size:.9rem">やめる</button></div>`;
  if (sess.idx === 0 && p.level) left += `<p class="pnote">${sess.fixedLv ? `レベル${sess.fixedLv} の問題を 10問 やります。` : '1問ごとに少しずつ むずかしくなります (レベル1 → 5)。'}</p>`;
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
      left += `<div class="feedback ok" role="status"><div class="fb-title">せいかい！</div>${gainHTML()}${sess.hint ? '<div class="note">しくみを見てから答えました (50点)。次は見ないでできるかな。</div>' : ''}<div class="fb-actions"><button class="btn btn-main" data-act="next">${nextLabel}</button>${sess.sideTab !== 'explain' ? '<button class="btn btn-sub" data-act="explain">しくみを見る</button>' : ''}</div></div>`;
    } else {
      left += `<div class="feedback ng" role="status"><div class="fb-title">おしい。答えは</div><div class="fb-ans">${p.answerHTML}</div>${gainHTML()}<div class="note">右の「しくみ」で、考え方を1つずつ見てみよう。${sess.reviewed ? '' : `最後まで見ると 見直しボーナス +${PTS.review}点。`}</div><div class="fb-actions"><button class="btn btn-sub" data-act="more">同じ種類をもう1問</button><button class="btn btn-main" data-act="next">${nextLabel}</button></div></div>`;
    }
    left += flagHTML();
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
    right += `<div class="explain"><div class="ex-nav"><button class="btn btn-line" data-act="fprev" ${sess.frame === 0 ? 'disabled' : ''}>まえ</button><button class="btn btn-sub" data-act="fnext" ${sess.frame >= fs.length - 1 ? 'disabled' : ''}>つぎ</button><span class="count">${sess.frame + 1} / ${fs.length}</span></div>${f.fig ? `<div class="fig ex-scroll">${f.fig}</div>` : ''}${f.grid ? `<div class="ex-scroll">${gridHTML(f.grid, { div: f.div })}</div>` : ''}<div class="ex-step">${f.text}</div>${fbFrameHTML(practiceFbKey())}${f.lesson ? `<div class="fb-actions"><button class="btn btn-sub" data-act="lesson" data-v="${f.lesson}">${LESSONS[f.lesson].btn}</button></div>` : ''}</div>`;
  }
  right += '</aside>';
  return `<div class="practice"><div class="col">${left}</div>${right}</div>`;
}
function resultHTML() {
  const s = sess.saved || { n: 0, c: 0, items: [], ms: 0, score: 0 };
  const medal = s.medal || 0; const wrong = s.items.filter((x) => !x.ok);
  let h = `<section class="result"><div class="score">${medal ? `<span class="medal big m${medal}">${MEDAL[medal]}</span>` : ''}<span class="big">${s.score} 点</span><span>${s.c} / ${s.n} 正解</span></div>`;
  h += `<p class="note">${sessLabel(sess.mode, sess.fixedLv)}</p>`;
  h += `<div class="timebox"><div><span class="lb">解いた時間の合計</span><b>${fmtSec(s.ms)}</b></div><div><span class="lb">1問の平均</span><b>${fmtSec(s.ms / Math.max(1, s.n))}</b></div><div><span class="lb">はじめから終わりまで</span><b>${fmtSec(s.endedAt - s.startedAt)}</b><small>しくみを読んだ時間も入ります</small></div></div>`;
  (sess.records || []).forEach((r) => { h += `<div class="banner">${r}</div>`; });
  if (sess.xpBefore != null) { const a = rankOf(sess.xpBefore), b = rankOf(totalXP()); h += b.i > a.i ? `<div class="banner">ランクアップ！「${b.name}」になりました。</div>` : `<p class="note">ランク「${b.name}」: ${b.next ? `次のランクまで あと ${b.next - totalXP()}点` : 'いちばん上のランクです'}</p>`; }
  if (sess.mode !== 'auto' && sess.mode !== 'retry') h += `<p class="note">${nextMedalText(s.items)}</p>`;
  const wrongTypes = [...new Set(wrong.map((x) => TYPE_NAMES[x.type] + (x.level ? ` (レベル${x.level})` : '')))];
  if (wrongTypes.length) h += `<p class="note">次の練習では、${wrongTypes.join('、')} を多めに出します。</p>`;
  h += sessionFbHTML();
  h += '<div class="list">' + s.items.map((x) => `<div class="li"><span class="m ${x.ok ? 'ok' : 'ng'}">${x.ok ? '○' : '–'}</span><span class="qq">${x.level ? `<span class="lvchip">Lv${x.level}</span> ` : ''}${esc(x.q)}${x.extra ? ' <span class="pill">もう1問</span>' : ''}${x.hint ? ' <span class="pill">しくみ</span>' : ''}${x.pb ? ' <span class="pill hot">自己ベスト</span>' : ''}</span><span class="aa">${x.ok ? esc(x.answer) : `答え ${esc(x.answer)}<br>入力 ${esc(x.given)}`}</span><span class="tt">${fmtSec(x.ms)}<br><small>+${x.pts || 0}点</small></span></div>`).join('') + '</div>';
  h += `<div class="fb-actions">${wrong.length ? `<button class="btn btn-main" data-act="retry">まちがえた ${wrong.length}問に リベンジ</button>` : ''}${sess.mode !== 'retry' ? `<button class="btn ${wrong.length ? 'btn-sub' : 'btn-main'}" data-act="start" data-v="${sess.mode}"${sess.fixedLv ? ` data-lv="${sess.fixedLv}"` : ''}>もう1回 同じ練習</button>` : ''}<button class="btn btn-line" data-act="tab" data-v="mine">じぶんの記録を見る</button><button class="btn btn-line" data-act="tab" data-v="home">はじめの画面へ</button></div>${wrong.length ? '<p class="note">リベンジは、まちがえた問題と 同じ種類の問題です (数はかわります)。</p>' : ''}</section>`;
  return h;
}

// ===== じぶんの記録 (娘さん用) =====
const RANKS = [[0, '計算のたまご'], [500, '計算ひよこ'], [1500, '計算みならい'], [3000, '計算がんばりや'], [5000, '計算いちにんまえ'], [8000, '計算じょうず'], [12000, '計算たつじん'], [17000, '計算めいじん'], [23000, '計算マスター'], [30000, '計算はかせ']];
function totalXP() { return state.xp != null ? state.xp : state.sessions.reduce((a, x) => a + (x.score || 0), 0); }
function rankOf(xp) { let i = 0; RANKS.forEach(([t], k) => { if (xp >= t) i = k; }); return { i, name: RANKS[i][1], from: RANKS[i][0], next: RANKS[i + 1] ? RANKS[i + 1][0] : null }; }
const courseLabel = (k) => { const [m, lv] = k.split(':'); return lv ? `${m} レベル${lv}` : `${m} ${STAGES[m].levels ? '1→5' : ''}`.trim(); };
// 10問を最後まで答えた練習 (古い順)
function courseRuns(k) { return state.sessions.filter((x) => !x.quit && x.mode !== 'auto' && x.mode !== 'retry' && sessKey(x.mode, x.lv) === k && x.items.filter((i) => !i.extra).length >= SESSION_LEN).slice().reverse(); }
// 点数の折れ線 (1本だけ・小さく)。ふれると点数が出る
function sparkSVG(vals) {
  const W = 220, H = 56, pad = 6; const n = vals.length; if (!n) return '';
  // 縦の目もりは、その練習の点数のはばに合わせる (変化が見えるように)
  const lo = Math.max(0, Math.min(...vals) - 150), hi = Math.max(...vals) + 50;
  const X = (i) => (n === 1 ? W / 2 : pad + (W - 2 * pad) * i / (n - 1)), Y = (v) => H - pad - (H - 2 * pad) * (v - lo) / (hi - lo);
  let b = `<line class="sp-base" x1="${pad}" y1="${H - pad}" x2="${W - pad}" y2="${H - pad}"/>`;
  if (n > 1) b += `<polyline class="sp-line" points="${vals.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')}"/>`;
  vals.forEach((v, i) => { b += `<circle class="sp-dot${i === n - 1 ? ' last' : ''}" cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="${i === n - 1 ? 5 : 4}"><title>${i + 1}回目 ${v}点</title></circle>`; });
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" role="img" aria-label="点数のうつりかわり ${vals.join('、')}点">${b}</svg>`;
}
// 種類ごと: 最近の10問と、その前の10問の正答率・正解までの時間
function typeTrends() {
  const by = {};
  state.sessions.slice().reverse().forEach((x) => x.items.forEach((it) => { (by[it.type] = by[it.type] || []).push(it); }));
  return Object.entries(by).map(([t, arr]) => {
    const rec = arr.slice(-10), prev = arr.slice(-20, -10);
    const rate = (a) => (a.length ? Math.round(a.filter((i) => i.ok).length / a.length * 100) : null);
    const okMs = (a) => { const o = a.filter((i) => i.ok && !i.hint); return o.length ? o.reduce((s2, i) => s2 + i.ms, 0) / o.length : null; };
    return { t, n: arr.length, r: rate(rec), pr: prev.length >= 5 ? rate(prev) : null, ms: okMs(rec), pms: prev.length >= 5 ? okMs(prev) : null };
  }).sort((a, b) => a.r - b.r);
}
function mineHTML() {
  const xp = totalXP(); const rk = rankOf(xp);
  const ks = allCourses(); const cnt = [0, 0, 0, 0]; ks.forEach((k) => { const b = state.best[k]; cnt[b && b.medal ? b.medal : 0]++; });
  const allItems = state.sessions.reduce((a, x) => a + x.n, 0), allOk = state.sessions.reduce((a, x) => a + x.c, 0);
  let h = '<section class="mine">';
  // ランク
  const pct = rk.next ? Math.round((xp - rk.from) / (rk.next - rk.from) * 100) : 100;
  h += `<div class="rank-card"><div><span class="lb">いまのランク</span><div class="rk">${rk.name}</div><div class="xpbar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div><div class="sub">${rk.next ? `次の「${RANKS[rk.i + 1][1]}」まで あと <b>${rk.next - xp}点</b>` : 'いちばん上のランク！'} (これまでの点数の合計 ${xp}点)</div></div>`;
  h += `<div class="stats"><div><span class="lb">といた問題</span><b>${allItems}</b>問</div><div><span class="lb">正解</span><b>${allItems ? Math.round(allOk / allItems * 100) : 0}</b>%</div><div><span class="lb">メダル</span><b>${cnt[1] + cnt[2] + cnt[3]}</b> / ${ks.length}</div></div></div>`;
  // つぎのめあて
  const goals = [];
  ks.forEach((k) => { const b = state.best[k]; if (b && b.medal === 2) goals.push({ k, s: `${courseLabel(k)} で 金メダル (しくみを見ずに10問正解)`, w: 3 }); });
  ks.forEach((k) => { const b = state.best[k]; if (b && b.medal === 1) goals.push({ k, s: `${courseLabel(k)} で 銀メダル (9問以上)`, w: 2 }); });
  ks.forEach((k) => { const b = state.best[k]; if (b && b.medal === 3 && b.ms) goals.push({ k, s: `${courseLabel(k)} の 全問正解タイム ${fmtSec(b.ms)} を ちぢめる`, w: 1 }); });
  const tt = typeTrends().filter((x) => x.n >= 3 && x.r < 80);
  tt.slice(0, 1).forEach((x) => { const st = stageOfType(x.t); goals.unshift({ k: st, s: `にがてな「${TYPE_NAMES[x.t]}」(最近 ${x.r}%) を 80% 以上に`, w: 4 }); });
  if (!goals.length) ks.filter((k) => !state.best[k]).slice(0, 2).forEach((k) => goals.push({ k, s: `${courseLabel(k)} に はじめてチャレンジ`, w: 0 }));
  h += `<div class="sec"><h2>つぎのめあて</h2><div class="goals">${goals.slice(0, 3).map((g) => `<button class="goal" data-act="course" data-v="${g.k}"><span>${g.s}</span><span class="go">やってみる</span></button>`).join('')}</div></div>`;
  // 攻略マップ
  h += `<div class="sec"><h2>攻略マップ</h2><p class="note">金 = しくみを見ずに10問正解、銀 = 9問以上、銅 = 7問以上。ます目をおすと、その練習が始まります。</p><div class="map">`;
  for (const t of Object.keys(TRACKS)) {
    TRACKS[t].stages.forEach((st) => {
      const keys = STAGES[st].levels ? [...Object.keys(STAGES[st].levels).map((n) => `${st}:${n}`), st] : [st];
      h += `<div class="map-row"><div class="map-st"><span class="code">${st}</span>${STAGES[st].name}</div><div class="map-cells">${keys.map((k) => { const b = state.best[k]; const m = b && b.medal ? b.medal : 0; const lv = k.split(':')[1]; return `<button class="cell${m ? ' got' : b ? ' tried' : ''}" data-act="course" data-v="${k}" aria-label="${courseLabel(k)} ${m ? MEDAL[m] + 'メダル' : b ? 'チャレンジ中' : 'まだ'}">${m ? medalHTML(m) : `<span class="empty">${b ? '…' : ''}</span>`}<span class="cl">${lv ? `Lv${lv}` : STAGES[st].levels ? '1→5' : '10問'}</span>${b && b.score ? `<span class="cs">${b.score}点</span>` : ''}</button>`; }).join('')}</div></div>`;
    });
  }
  h += '</div></div>';
  // のびたところ
  const grow = ks.map((k) => ({ k, runs: courseRuns(k) })).filter((x) => x.runs.length >= 1);
  h += '<div class="sec"><h2>のびたところ</h2>';
  if (!grow.length) h += '<p class="note">10問を最後まで答えると、ここに点数のうつりかわりが出ます。</p>';
  else h += '<div class="grow">' + grow.map(({ k, runs }) => {
    const sc = runs.slice(-8).map((x) => x.score || 0); const first = runs[0], last = runs[runs.length - 1];
    const d = (last.score || 0) - (first.score || 0); const dc = last.c - first.c;
    const ft = runs.filter((x) => x.c === SESSION_LEN && x.ms);
    return `<div class="gcard"><div class="gh"><b>${courseLabel(k)}</b>${medalHTML((state.best[k] || {}).medal)}</div>${sparkSVG(sc)}<div class="gs">${runs.length >= 2 ? `<span>1回目 ${first.score || 0}点 → 最新 ${last.score || 0}点 <b class="${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${d > 0 ? `+${d}` : d}</b></span><span>正解 ${first.c} → ${last.c}問${dc > 0 ? ' <b class="up">アップ</b>' : ''}</span>` : `<span>1回目 ${first.score || 0}点 (${first.c}問正解)</span><span>もう1回やると、くらべられます</span>`}${ft.length >= 2 ? `<span>全問正解タイム ${fmtSec(ft[0].ms)} → ${fmtSec(ft[ft.length - 1].ms)}</span>` : ''}</div></div>`;
  }).join('') + '</div>';
  h += '</div>';
  // 種類ごとの できぐあい
  const trs = typeTrends();
  h += '<div class="sec"><h2>種類ごとの できぐあい</h2><p class="note">それぞれ最近の10問の正解の割合です。矢印は、その前の10問とくらべて上がったか下がったか。時間は しくみを見ずに正解した問題の平均です。</p>';
  if (!trs.length) h += '<p class="note">まだ記録がありません。</p>';
  else h += '<div class="trend">' + trs.map((x) => {
    const arr = x.pr == null ? '' : x.r > x.pr ? `<span class="up">↑ ${x.r - x.pr}</span>` : x.r < x.pr ? `<span class="down">↓ ${x.pr - x.r}</span>` : '<span>→</span>';
    const tm = x.ms == null ? '' : `${fmtSec(x.ms)}${x.pms != null && x.ms < x.pms * 0.9 ? ' <span class="up">はやくなった</span>' : ''}`;
    return `<div class="tr"><span class="tn">${TYPE_NAMES[x.t]}</span><span class="tbar" title="${x.r}%"><i style="width:${x.r}%" class="${x.r < 70 ? 'low' : ''}"></i></span><span class="tv">${x.r}% ${arr}</span><span class="tt">${tm}</span></div>`;
  }).join('') + '</div>';
  h += '</div>';
  // さいきん
  h += '<div class="sec"><h2>さいきんの練習</h2>';
  h += state.sessions.length ? '<div class="list">' + state.sessions.slice(0, 6).map((x) => `<div class="li"><span class="m">${medalHTML(x.medal) || '・'}</span><span class="qq">${fmtDate(x.endedAt)} ${sessLabel(x.mode, x.lv)}${x.quit ? ' <span class="pill">とちゅうまで</span>' : ''}</span><span class="aa">${x.c} / ${x.n} 正解 ${x.score != null ? `${x.score}点` : ''}</span><span class="tt">${x.ms ? fmtSec(x.ms) : ''}</span></div>`).join('') + '</div>' : '<p class="note">まだ記録がありません。</p>';
  h += '</div>' + mineFbHTML() + '</section>';
  return h;
}
function fmtDate(t) { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }
let confirmReset = false;
let copyState = null; // null | 'ok' | 'manual'
function exportText() {
  const sessions = state.sessions.slice(0, 30).map((s) => ({ at: new Date(s.endedAt).toISOString(), mode: s.mode, n: s.n, c: s.c, min: Math.round((s.endedAt - s.startedAt) / 6000) / 10, solveSec: s.ms ? Math.round(s.ms / 1000) : undefined, score: s.score, medal: s.medal || undefined, quit: s.quit || undefined,
    items: s.items.map((x) => [x.type + (x.level ? ':' + x.level : ''), x.ok ? 1 : 0, x.hint ? 1 : 0, Math.round(x.ms / 1000), x.q, x.given, x.answer]) }));
  return '計算と単位の練習帳 記録\n' + JSON.stringify({ v: 2, exportedAt: new Date().toISOString(), best: state.best, mistakes: state.mistakes, typeStats: state.typeStats, itemsFormat: ['type', 'ok', 'hint', 'sec', 'q', 'given', 'answer'], sessions });
}
function parentHTML() {
  const all = Object.values(state.typeStats).reduce((a, s) => ({ n: a.n + s.n, c: a.c + s.c }), { n: 0, c: 0 });
  const weekAgo = Date.now() - 7 * 864e5;
  const week = state.sessions.filter((s) => s.endedAt > weekAgo).reduce((a, s) => a + s.n, 0);
  const lastS = state.sessions[0];
  let h = `<section class="parent"><div><h1 style="font-size:1.6rem">きろく</h1><p class="store">保存先: この端末のブラウザ${dbStatus === 'on' ? '、claude.ai (同じアカウントなら別の端末でも記録が続きます)' : dbStatus === 'error' ? '。claude.ai への保存に失敗しました。この端末には保存されています' : dbStatus === 'checking' ? ' (claude.ai への接続を確認中)' : 'のみ。別の端末とは共有されないため、こまめに「記録をコピー」で送ってください'}</p></div>`;
  h += `<div class="tiles"><div class="tile"><div class="k">この7日間の問題数</div><div class="v">${week}</div></div><div class="tile"><div class="k">これまでの正答率</div><div class="v">${all.n ? Math.round(all.c / all.n * 100) + '%' : '–'}</div></div><div class="tile"><div class="k">これまでの問題数</div><div class="v">${all.n}</div></div><div class="tile"><div class="k">最後の練習</div><div class="v" style="font-size:1.2rem">${lastS ? fmtDate(lastS.endedAt) : '–'}</div></div></div>`;
  h += `<div class="sec"><h2>ステップ</h2><p class="note">どのステップもすきな順番で選べます。点は、10問を最後まで答えたときの いちばんよい点です。</p><div class="tbl-wrap"><table><thead><tr><th>ステップ</th><th>内容</th><th>ステップ全体の10問</th><th>レベル別 (1〜5)</th></tr></thead><tbody>`;
  for (const s of Object.keys(STAGES)) {
    const b = state.best[s];
    const lvs = STAGES[s].levels ? Object.keys(STAGES[s].levels).map((n) => bestText(`${s}:${n}`) || '–').join(' / ') : '';
    h += `<tr><td><span class="code">${s}</span></td><td>${STAGES[s].name}</td><td>${b ? `${b.c} / ${b.n}` : '–'}</td><td>${lvs}</td></tr>`;
  }
  h += '</tbody></table></div></div>';
  const rows = Object.keys(TYPE_NAMES).map((t) => ({ t, s: state.typeStats[t] })).filter((x) => x.s && x.s.n).sort((a, b) => a.s.c / a.s.n - b.s.c / b.s.n);
  h += `<div class="sec"><h2>種類ごとの正答率 (低い順)</h2>`;
  if (!rows.length) h += '<p class="note">まだ記録がありません。練習すると、ここに種類ごとの正答率が出ます。</p>';
  else {
    h += '<div class="tbl-wrap"><table><thead><tr><th>種類</th><th>ステップ</th><th>回数</th><th>正答率</th><th>先にしくみを見た</th><th>次回多めに出す</th></tr></thead><tbody>';
    rows.forEach(({ t, s }) => { const r = Math.round(s.c / s.n * 100); h += `<tr><td>${TYPE_NAMES[t]}</td><td>${stageOfType(t)}</td><td class="num">${s.n}</td><td><span class="bar${r < 70 ? ' low' : ''}"><i style="width:${r}%"></i></span>${r}%</td><td class="num">${s.hint}</td><td>${Object.keys(state.mistakes).some((k) => k.startsWith(t + ':')) ? '<span class="pill">はい</span>' : ''}</td></tr>`; });
    h += '</tbody></table></div>';
  }
  h += '</div><div class="sec"><h2>最近の練習</h2>';
  if (!state.sessions.length) h += '<p class="note">まだ記録がありません。</p>';
  state.sessions.slice(0, 20).forEach((s) => {
    const mins = Math.max(1, Math.round((s.endedAt - s.startedAt) / 60000));
    h += `<details class="sess"><summary><span>${fmtDate(s.endedAt)}</span><span>${sessLabel(s.mode, s.lv)}</span><span>${s.c} / ${s.n} 正解</span><span>${s.score != null ? `${s.score}点` : ''}</span><span>${s.ms ? `解いた時間 ${fmtSec(s.ms)}` : `${mins}分`}</span>${medalHTML(s.medal)}${s.quit ? '<span class="pill">途中でやめた</span>' : ''}</summary><div class="list" style="border:0;border-top:1px solid var(--rule);border-radius:0">${s.items.map((x) => `<div class="li"><span class="m ${x.ok ? 'ok' : 'ng'}">${x.ok ? '○' : '–'}</span><span class="qq">${esc(x.q)}${x.hint ? ' <span class="pill">しくみ</span>' : ''}</span><span class="aa">${x.ok ? '' : `答え ${esc(x.answer)} / 入力 ${esc(x.given)}`}</span><span class="tt">${fmtSec(x.ms)}</span></div>`).join('')}</div></details>`;
  });
  h += '</div>';
  h += `<div class="sec"><h2>記録を Claude に送る</h2><p class="note">ボタンをおすと記録がコピーされます。プロジェクトのスレッドに貼り付けて送ってください。次の改善に使います。</p><div class="fb-actions"><button class="btn btn-sub" data-act="copy">記録をコピー</button>${copyState === 'ok' ? '<span class="pill on" role="status">コピーしました</span>' : ''}</div>${copyState === 'manual' ? '<p class="note" role="status">自動でコピーできませんでした。下の文字を全部選んでコピーしてください。</p><textarea id="export-box" readonly style="width:100%;min-height:140px;font-family:var(--f-mono);font-size:.8rem;background:var(--paper);color:var(--ink);border:1px solid var(--rule);border-radius:8px;padding:8px">' + esc(exportText()) + '</textarea>' : ''}</div>`;
  h += `<div class="sec"><h2>データ</h2><div class="danger">${confirmReset ? '<span>この端末と claude.ai のいちばんよい点・正答率をリセットします。練習の記録一覧は残ります。</span><button class="btn btn-danger" data-act="reset-yes">リセットする</button><button class="btn btn-line" data-act="reset-no">やめる</button>' : '<button class="btn btn-line" data-act="reset">いちばんよい点と正答率をリセット</button>'}</div></div>`;
  return h + '</section>';
}
// ===== フィードバック (娘さんの声) =====
// kind: frame (説明が わかった/わからない) | problem (この問題へん？) | session (10問の感想) | comment (ひとこと) | idea (おねがい・アイデア)
const FB_LABEL = { ok: 'わかった', ng: 'わからない', wrong: '答えがおかしいと思う', meaning: '問題の意味がわからない', fig: '図が見にくい', hard: 'むずかしすぎる', easy: 'かんたん', fit: 'ちょうどいい', tough: 'むずかしい' };
const stripTags = (h) => String(h || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
function addFeedback(kind, verdict, ctx = {}, text = '') {
  if (!state.feedback) state.feedback = [];
  const fb = { id: 'f' + Date.now().toString(36) + Math.floor(rnd() * 1296).toString(36), at: Date.now(), kind, verdict, text: text || undefined, ctx };
  state.feedback.push(fb); state.feedback = state.feedback.slice(-300);
  state.updatedAt = Date.now(); saveLocal();
  if (allowWrite && !(kind === 'frame' && verdict === 'ok')) { const l = fbLine(fb); enqueueCollect({ id: fb.id, at: fb.at, page: trialMode ? 'お試し' : '娘さん', kind: l.tag, verdict: verdict || '', text: text || '', where: [l.where, l.q && `問題「${l.q}」`, l.extra].filter(Boolean).join(' / ') }); }
  return fb;
}
// ===== 声を 保護者の Google スプレッドシートへ 自動で送る (COLLECT_URL が空なら 送らない) =====
// 送れなかった分は この端末にためておき、次に開いたとき・オンラインにもどったときに送りなおす
const COLLECT_URL = '';
const OUTBOX_KEY = 'keisan-outbox';
function loadOutbox() { try { return JSON.parse(localStorage.getItem(OUTBOX_KEY)) || []; } catch (e) { return []; } }
function enqueueCollect(item) {
  if (!COLLECT_URL || PAGE === 'all') return;
  try { const q = loadOutbox(); q.push(item); localStorage.setItem(OUTBOX_KEY, JSON.stringify(q.slice(-500))); } catch (e) { /* 保存できない */ }
  flushCollect();
}
let collectBusy = false;
async function flushCollect() {
  if (!COLLECT_URL || PAGE === 'all' || collectBusy || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
  const q = loadOutbox(); if (!q.length) return;
  collectBusy = true;
  const items = q.slice(0, 50);
  try {
    // Google のウェブアプリは 返事を読めない形 (no-cors) で送る。同じ id は シート側で2回書かない
    await fetch(COLLECT_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ app: 'keisan-tani', device: PAGE + ':' + ((parentSources && parentSources().local && parentSources().local.deviceId) || ''), items }) });
    const sent = new Set(items.map((x) => x.id));
    try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(loadOutbox().filter((x) => !sent.has(x.id)))); } catch (e) { /* 保存できない */ }
  } catch (e) { /* 通信できない: 次の機会に */ }
  collectBusy = false;
  if (loadOutbox().length && items.length === 50) flushCollect();
}
function frameCtx() {
  const p = sess.problem; const fs = frames(); const f = fs[sess.frame];
  return { type: p.type, stage: p.stage, level: p.level || undefined, q: p.text, answer: p.answerText, frame: sess.frame + 1, frames: fs.length, frameText: stripTags(f.text).slice(0, 90), when: sess.phase === 'answer' ? 'hint' : sess.result ? 'after-ok' : 'after-ng' };
}
// 説明の下の「わかった / わからない」
function fbFrameHTML(key) {
  const given = (fbGiven[key] || null);
  if (given) return `<div class="fbq done" role="status">「${FB_LABEL[given]}」を おくりました。ありがとう！</div>`;
  return `<div class="fbq"><span>この説明は？</span><button class="btn btn-line sm" data-act="fbframe" data-v="ok">わかった</button><button class="btn btn-line sm" data-act="fbframe" data-v="ng">わからない</button></div>`;
}
const fbGiven = {}; // その場で押したかどうか (key → verdict)
function practiceFbKey() { return `p:${sess.id}:${sess.idx}:${sess.frame}`; }
function lessonFbKey() { return `l:${lesson.id}:${lesson.frame}:${lesson.opened}`; }
// 答えたあとの「この問題について おしえて」
function flagHTML() {
  const key = `q:${sess.id}:${sess.idx}`;
  if (fbGiven[key]) return `<div class="fbq done" role="status">「${FB_LABEL[fbGiven[key]]}」を おくりました。ありがとう！</div>`;
  if (!sess.flagOpen) return '<div class="fbq"><button class="linkbtn" data-act="flagopen">この問題について おしえて</button></div>';
  return `<div class="fbq"><span>どんなこと？</span>${['wrong', 'meaning', 'fig', 'hard'].map((c) => `<button class="btn btn-line sm" data-act="flag" data-v="${c}">${FB_LABEL[c]}</button>`).join('')}</div>`;
}
// 結果画面の「この10問は どうだった？」
function sessionFbHTML() {
  const r = sess.rating;
  let h = `<div class="sec fbbox"><h2>この練習は どうだった？</h2><div class="fbq">${['easy', 'fit', 'tough'].map((c) => `<button class="btn ${r === c ? 'btn-sub' : 'btn-line'} sm" data-act="rate" data-v="${c}" aria-pressed="${r === c}">${FB_LABEL[c]}</button>`).join('')}</div>`;
  h += sess.commentSent ? '<p class="note" role="status">ひとことを おくりました。ありがとう！</p>' : '<label class="fbtext"><span>ひとこと (なくてもOK): わかりにくかったこと、ふやしてほしい問題など</span><textarea id="fb-text" rows="2" maxlength="300"></textarea></label><div class="fb-actions"><button class="btn btn-line sm" data-act="comment">おくる</button></div>';
  return h + '</div>';
}
// じぶんの記録の「おねがい・アイデア」と「おうちの人に おくる」
function mineFbHTML() {
  let h = '<div class="sec fbbox"><h2>アプリへの おねがい・アイデア</h2><p class="note">「こんな問題がほしい」「ここがわかりにくい」など、なんでも書いてね。おうちの人と Claude が読んで、アプリをよくします。</p>';
  h += ideaSent ? '<p class="note" role="status">おくりました。ありがとう！</p>' : '<label class="fbtext"><textarea id="idea-text" rows="3" maxlength="500"></textarea></label><div class="fb-actions"><button class="btn btn-sub sm" data-act="idea">おくる</button></div>';
  if (trialMode) return h + '</div>';
  h += `</div><div class="sec fbbox"><h2>おうちの人に 記録を おくる</h2><p class="note">記録と、おくった声を ファイルにして、AirDrop やメッセージで おうちの人に わたせます。</p><div class="fb-actions"><button class="btn btn-line sm" data-act="sendfile">記録を おくる</button>${shareMsg ? `<span class="pill on" role="status">${shareMsg}</span>` : ''}</div></div>`;
  return h;
}
let ideaSent = false; let shareMsg = '';
// 記録をファイルにして わたす (端末をこえる受け渡し)
function payload() {
  if (!state.deviceId) { state.deviceId = 'd' + Date.now().toString(36) + Math.floor(rnd() * 46656).toString(36); saveLocal(); }
  const { finger, unlocked, ...rest } = state;
  return Object.assign({ kind: 'keisan-kiroku', exportedAt: Date.now() }, JSON.parse(JSON.stringify(rest)));
}
async function shareRecord() {
  const d = new Date(); const name = `renshu-kiroku-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`;
  const blob = new Blob([JSON.stringify(payload())], { type: 'application/json' });
  try {
    const file = new File([blob], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: '練習帳の記録' }); shareMsg = 'おくる画面を ひらきました'; render(); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  shareMsg = 'ファイルを ほぞんしました'; render();
}

// ===== 保護者ページ: 記録の読みこみ・まとめ =====
const PARENT_KEY = 'keisan-parent-v1';
function loadParentStore() { try { return Object.assign({ imports: {}, notes: [], sent: {}, batches: [] }, JSON.parse(localStorage.getItem(PARENT_KEY)) || {}); } catch (e) { return { imports: {}, notes: [], sent: {}, batches: [] }; } }
let pstore = loadParentStore();
function saveParentStore() { try { localStorage.setItem(PARENT_KEY, JSON.stringify(pstore)); } catch (e) { /* 保存できない環境 */ } }
// いくつかの記録 (この端末・読みこんだファイル) を1つにまとめる
function mergeStates(list) {
  const srcs = list.filter(Boolean); if (!srcs.length) return freshState();
  const newest = srcs.slice().sort((a, b) => (b.updatedAt || b.exportedAt || 0) - (a.updatedAt || a.exportedAt || 0))[0];
  const out = Object.assign(freshState(), JSON.parse(JSON.stringify(newest)));
  const byId = (key) => { const m = new Map(); srcs.forEach((s) => (s[key] || []).forEach((x) => { if (x && x.id && !m.has(x.id)) m.set(x.id, x); })); return [...m.values()]; };
  out.sessions = byId('sessions').sort((a, b) => b.endedAt - a.endedAt).slice(0, 200);
  out.feedback = byId('feedback').sort((a, b) => a.at - b.at);
  const better = (a, b) => (!a ? b : !b ? a : ((b.medal || 0) * 1e6 + (b.score || 0) + b.c > (a.medal || 0) * 1e6 + (a.score || 0) + a.c ? b : a));
  out.best = {}; srcs.forEach((s) => Object.entries(s.best || {}).forEach(([k, v]) => { out.best[k] = better(out.best[k], v); }));
  return out;
}
function parentSources() {
  const local = (() => { try { return migrate(JSON.parse(localStorage.getItem(CHILD_KEY))); } catch (e) { return null; } })();
  const hasLocal = local && ((local.sessions || []).length || (local.feedback || []).length);
  return { local: hasLocal ? local : null, imports: Object.values(pstore.imports) };
}
// お試しで押した声 (記録・点数はまぜない)
function trialFeedback() { try { const t = JSON.parse(localStorage.getItem(TRIAL_KEY)); return ((t && t.feedback) || []).map((f) => Object.assign({}, f, { trial: true })); } catch (e) { return []; } }
function parentState() { const st = mergeStates([parentSources().local, ...Object.values(pstore.imports)]); st.feedback = [...(st.feedback || []), ...trialFeedback()].sort((a, b) => a.at - b.at); return st; }
function importFile(file) {
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const d = JSON.parse(rd.result);
      if (!d || d.kind !== 'keisan-kiroku' || !Array.isArray(d.sessions)) throw new Error('kind');
      pstore.imports[d.deviceId || 'import'] = d; saveParentStore();
      state = parentState();
      importMsg = `読みこみました (${fmtDate(d.exportedAt)} の記録、練習 ${d.sessions.length}回・声 ${(d.feedback || []).length}件)`;
    } catch (e) { importMsg = 'このファイルは読みこめませんでした。「記録を おくる」で作ったファイルを えらんでください。'; }
    render();
  };
  rd.readAsText(file);
}
let importMsg = ''; let report = null; let withData = false; let noteMsg = '';
const NOTE_CATS = ['まちがい・バグ', 'わかりにくい', '追加してほしい', 'むずかしさ', 'その他'];
const fbCtxText = (c) => [c.stage ? `${c.stage}${c.level ? ` Lv${c.level}` : ''} ${TYPE_NAMES[c.type] || ''}`.trim() : '', c.lesson ? `読みもの「${(LESSONS[c.lesson] || {}).title || c.lesson}」` : '', c.frame ? `${c.frame}/${c.frames || '?'}枚目` : ''].filter(Boolean).join(' ');
// 記録から自動で見つけること
function insights(st) {
  const out = []; const ts = st.typeStats || {};
  Object.entries(ts).forEach(([t, s]) => { if (s.n >= 5 && s.c / s.n < 0.7) out.push({ k: 'low', s: `正答率が低い: ${TYPE_NAMES[t] || t} (${stageOfType(t)}) ${Math.round(s.c / s.n * 100)}% (${s.n}問)` }); });
  Object.entries(ts).forEach(([t, s]) => { if (s.n >= 5 && s.hint / s.n >= 0.4) out.push({ k: 'hint', s: `先に しくみを見ることが多い: ${TYPE_NAMES[t] || t} ${Math.round(s.hint / s.n * 100)}%` }); });
  const ms = {}; (st.sessions || []).forEach((x) => x.items.forEach((i) => { if (i.ok) (ms[i.type] = ms[i.type] || []).push(i.ms); }));
  Object.entries(ms).forEach(([t, a]) => { if (a.length >= 5) { const avg = a.reduce((x, y) => x + y, 0) / a.length; if (avg > 60000) out.push({ k: 'slow', s: `時間がかかる: ${TYPE_NAMES[t] || t} 正解までの平均 ${fmtSec(avg)}` }); } });
  const ng = {}; (st.feedback || []).filter((f) => !f.trial && f.kind === 'frame' && f.verdict === 'ng').forEach((f) => { const k = f.ctx.lesson ? `読みもの「${(LESSONS[f.ctx.lesson] || {}).title}」${f.ctx.frame}枚目` : `${TYPE_NAMES[f.ctx.type] || f.ctx.type} の しくみ ${f.ctx.frame}枚目`; ng[k] = (ng[k] || 0) + 1; });
  Object.entries(ng).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => out.push({ k: 'ng', s: `「わからない」が押された説明: ${k} (${n}回)` }));
  const tough = {}; (st.feedback || []).filter((f) => !f.trial && f.kind === 'session' && f.verdict === 'tough').forEach((f) => { const k = sessLabel(f.ctx.mode, f.ctx.lv); tough[k] = (tough[k] || 0) + 1; });
  Object.entries(tough).forEach(([k, n]) => out.push({ k: 'tough', s: `「むずかしい」と答えた練習: ${k} (${n}回)` }));
  return out;
}
function fbLine(f) {
  const tag = f.kind === 'frame' ? `説明: ${FB_LABEL[f.verdict]}` : f.kind === 'problem' ? `問題へん？: ${FB_LABEL[f.verdict]}` : f.kind === 'session' ? `感想: ${FB_LABEL[f.verdict]}` : f.kind === 'comment' ? 'ひとこと' : 'アイデア';
  const c = f.ctx || {};
  const where = f.kind === 'session' || f.kind === 'comment' ? `${sessLabel(c.mode, c.lv)}${c.n ? ` ${c.c}/${c.n}正解` : ''}` : fbCtxText(c);
  return { tag: (f.trial ? '[お試し] ' : '') + tag, where, q: c.q, extra: f.kind === 'frame' ? c.frameText : f.kind === 'problem' ? `答え ${c.answer || ''}${c.given ? ` / 入力 ${c.given}` : ''}` : '', text: f.text };
}
function buildReport() {
  const st = state; const d = new Date(); const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const id = `FB-${ymd}-${pstore.batches.filter((b) => b.id.startsWith(`FB-${ymd}`)).length + 1}`;
  const fbs = (st.feedback || []).filter((f) => !pstore.sent[f.id] && !(f.kind === 'frame' && f.verdict === 'ok'));
  const oks = (st.feedback || []).filter((f) => !pstore.sent[f.id] && f.kind === 'frame' && f.verdict === 'ok');
  const notes = pstore.notes.filter((n) => !pstore.sent[n.id]);
  let t = `# 練習帳フィードバック ${id}\n作成: ${d.toLocaleString('ja-JP')} / アプリ ${APP_VERSION}\n\n## 保護者のメモ (${notes.length})\n`;
  t += notes.length ? notes.map((n, i) => `- [N${i + 1}][${n.cat}] ${n.text}`).join('\n') : '- なし';
  const tri = fbs.filter((f) => f.trial);
  if (tri.length) t += `\n\n## 保護者がお試しで押した声 (${tri.length})\n` + tri.map((f, i) => { const l = fbLine(f); return `- [T${i + 1}][${l.tag.replace('[お試し] ', '')}]${l.where ? ' ' + l.where : ''}${l.q ? ` 問題「${l.q}」` : ''}${l.extra ? ` (${l.extra})` : ''}${l.text ? ` 「${l.text}」` : ''}`; }).join('\n');
  const kid = fbs.filter((f) => !f.trial);
  t += `\n\n## 娘さんの声 (${kid.length})\n`;
  t += kid.length ? kid.map((f, i) => { const l = fbLine(f); return `- [F${i + 1}][${l.tag}]${l.where ? ' ' + l.where : ''}${l.q ? ` 問題「${l.q}」` : ''}${l.extra ? ` (${l.extra})` : ''}${l.text ? ` 「${l.text}」` : ''}`; }).join('\n') : '- なし';
  if (oks.length) t += `\n- (「わかった」${oks.length}件: ${[...new Set(oks.map((f) => fbCtxText(f.ctx)))].slice(0, 8).join('、')})`;
  const ins = insights(st);
  t += `\n\n## 記録から自動で見つけたこと\n${ins.length ? ins.map((x) => `- ${x.s}`).join('\n') : '- とくになし'}`;
  const ss = st.sessions || []; const n = ss.reduce((a, x) => a + x.n, 0), c = ss.reduce((a, x) => a + x.c, 0);
  const wk = ss.filter((x) => x.endedAt > Date.now() - 7 * 864e5);
  t += `\n\n## 数字\n- 練習 ${ss.length}回 / ${n}問 / 正答率 ${n ? Math.round(c / n * 100) : 0}%\n- この7日: 練習 ${wk.length}回 / ${wk.reduce((a, x) => a + x.n, 0)}問\n- メダル: ${[3, 2, 1].map((m) => `${MEDAL[m]}${Object.values(st.best || {}).filter((b) => b.medal === m).length}`).join(' ')}`;
  if (withData) t += `\n\n## 記録データ\n${exportText()}`;
  return { id, text: t, fbIds: [...fbs, ...oks].map((f) => f.id), noteIds: notes.map((x) => x.id), count: fbs.length + notes.length };
}
function inboxHTML() {
  const src = parentSources(); const st = state;
  let h = '<section class="parent">';
  h += `<div><h1 style="font-size:1.6rem">フィードバック</h1><p class="note">娘さんがアプリで押した声 (お試しで押した声も) と、保護者のメモを まとめて Claude に送ります。</p></div>`;
  h += figFlow([{ s: '① 娘さん', sub: 'わかった・わからない\nひとこと・アイデア' }, { s: '② 記録を わたす', sub: '同じ端末なら そのまま\nちがう端末は ファイル', cls: 'sh3' }, { s: '③ Claude に送る', sub: 'まとめを スレッドへ\nはりつけ', cls: 'sh2' }, { s: '④ 改善・公開', sub: '「改善の記録」に\nのる' }], { h: 84, W: 860, label: 'フィードバックの流れ' });
  h += `<div class="sec"><h2>記録の読みこみ</h2><p class="note">見ている記録: ${src.local ? 'この端末の記録' : ''}${src.local && src.imports.length ? ' + ' : ''}${src.imports.map((d) => `ファイル (${fmtDate(d.exportedAt)})`).join('、')}${!src.local && !src.imports.length ? 'まだありません。娘さんの「じぶんの記録 → 記録を おくる」で作ったファイルを読みこんでください。' : ''}</p><div class="fb-actions"><label class="btn btn-line sm filebtn">記録ファイルを読みこむ<input type="file" accept="application/json,.json" data-act="import" hidden></label>${importMsg ? `<span class="pill on" role="status">${esc(importMsg)}</span>` : ''}</div></div>`;
  const ins = insights(st);
  h += `<div class="sec"><h2>記録から自動で見つけたこと</h2>${ins.length ? `<ul class="ins">${ins.map((x) => `<li class="${x.k}">${esc(x.s)}</li>`).join('')}</ul>` : '<p class="note">今のところ、とくにありません (5問以上の記録から見つけます)。</p>'}</div>`;
  const fbs = (st.feedback || []).slice().reverse();
  h += `<div class="sec"><h2>アプリで押された声 (${fbs.length})</h2>${fbs.some((f) => f.trial) ? '<p class="note">「[お試し]」は 保護者がお試しで押したものです。</p>' : ''}`;
  if (!fbs.length) h += '<p class="note">まだありません。説明の下の「わかった / わからない」、答えたあとの「この問題について おしえて」、結果画面の感想、じぶんの記録の「おねがい・アイデア」から届きます。</p>';
  else h += '<div class="list">' + fbs.slice(0, 60).map((f) => { const l = fbLine(f); return `<div class="li"><span class="m ${f.verdict === 'ng' || f.kind === 'problem' || f.verdict === 'tough' ? 'ng' : 'ok'}">${f.verdict === 'ok' || f.verdict === 'fit' || f.verdict === 'easy' ? '○' : '!'}</span><span class="qq"><b>${esc(l.tag)}</b> ${esc(l.where)}${l.q ? `<br><small>問題: ${esc(l.q)}</small>` : ''}${l.extra ? `<br><small>${esc(l.extra)}</small>` : ''}${l.text ? `<br>「${esc(l.text)}」` : ''}</span><span class="aa"><small>${fmtDate(f.at)}</small></span><span class="tt">${pstore.sent[f.id] ? `<span class="pill">送信済み ${pstore.sent[f.id]}</span>` : '<span class="pill hot">未送信</span>'}</span></div>`; }).join('') + '</div>';
  h += '</div>';
  h += `<div class="sec"><h2>保護者のメモ</h2><div class="noteform"><select id="note-cat">${NOTE_CATS.map((c) => `<option>${c}</option>`).join('')}</select><textarea id="note-text" rows="2" maxlength="1000" placeholder="気づいたこと・直してほしいこと・追加したいこと"></textarea><button class="btn btn-sub sm" data-act="note">メモに追加</button></div>${noteMsg ? `<p class="note" role="status">${noteMsg}</p>` : ''}`;
  if (pstore.notes.length) h += '<div class="list">' + pstore.notes.slice().reverse().map((n) => `<div class="li"><span class="m">・</span><span class="qq"><b>${esc(n.cat)}</b> ${esc(n.text)}</span><span class="aa"><small>${fmtDate(n.at)}</small></span><span class="tt">${pstore.sent[n.id] ? `<span class="pill">送信済み ${pstore.sent[n.id]}</span>` : `<button class="linkbtn" data-act="delnote" data-v="${n.id}">けす</button>`}</span></div>`).join('') + '</div>';
  h += '</div>';
  const unsent = (st.feedback || []).filter((f) => !pstore.sent[f.id] && !(f.kind === 'frame' && f.verdict === 'ok')).length + pstore.notes.filter((n) => !pstore.sent[n.id]).length;
  h += `<div class="sec fbbox"><h2>Claude に送る</h2><p class="note">未送信の声とメモ <b>${unsent}件</b>、自動で見つけたこと、数字を 1つのまとめにします。「共有」か「コピー」で、プロジェクトのスレッドに はりつけてください。送ったまとめは「改善の記録」で、どう直したかを確かめられます。</p><label class="chk"><input type="checkbox" data-act="withdata" ${withData ? 'checked' : ''}> 記録の全データも付ける (くわしく調べたいとき)</label><div class="fb-actions"><button class="btn btn-main" data-act="mkreport">まとめを作る</button></div>`;
  if (report) h += `<textarea id="report-box" class="exportbox" rows="10" readonly>${esc(report.text)}</textarea><div class="fb-actions"><button class="btn btn-sub sm" data-act="sharereport">共有</button><button class="btn btn-line sm" data-act="copyreport">コピー</button><button class="btn btn-line sm" data-act="marksent">送ったので「送信済み」にする</button>${report.msg ? `<span class="pill on" role="status">${report.msg}</span>` : ''}</div>`;
  h += '</div></section>';
  return h;
}
function changesHTML() {
  let h = '<section class="parent"><div><h1 style="font-size:1.6rem">改善の記録</h1><p class="note">アプリの版ごとに、何を直したか・だれの声からか を まとめています。送ったまとめの番号 (FB-…) が入っていれば、その声への対応です。</p></div>';
  if (pstore.batches.length) {
    h += '<div class="sec"><h2>送ったまとめ</h2><div class="list">' + pstore.batches.slice().reverse().map((b) => { const done = CHANGELOG.find((c) => (c.from || []).includes(b.id)); return `<div class="li"><span class="m ${done ? 'ok' : ''}">${done ? '○' : '…'}</span><span class="qq"><b>${b.id}</b> 声とメモ ${b.count}件</span><span class="aa"><small>${fmtDate(b.at)}</small></span><span class="tt">${done ? `<span class="pill on">対応 v${done.v}</span>` : '<span class="pill">Claude の対応待ち</span>'}</span></div>`; }).join('') + '</div></div>';
  }
  h += '<div class="sec"><h2>版ごとの変更</h2><div class="clog">' + CHANGELOG.map((c) => `<details ${c === CHANGELOG[0] ? 'open' : ''}><summary><b>v${c.v}</b> <span>${c.date}</span> ${esc(c.title)}</summary><ul>${c.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul><p class="note">きっかけ: ${(c.from || []).map(esc).join('、') || '—'}</p></details>`).join('') + '</div></div>';
  return h + '</section>';
}
// 読みもの (例: 計算の順番のわけ)。back は もどる先の画面
let lesson = null; // { id, frame, back, frames }
function lessonHTML() {
  const L = LESSONS[lesson.id]; const fs = lesson.frames; const f = fs[lesson.frame];
  return `<section class="lesson"><div class="lesson-head"><h1>${L.title}</h1><button class="btn btn-line" data-act="lback">${lesson.back === 'practice' ? '問題にもどる' : 'はじめの画面へ'}</button></div><div class="explain"><div class="ex-nav"><button class="btn btn-line" data-act="lprev" ${lesson.frame === 0 ? 'disabled' : ''}>まえ</button><button class="btn btn-sub" data-act="lnext" ${lesson.frame >= fs.length - 1 ? 'disabled' : ''}>つぎ</button><span class="count">${lesson.frame + 1} / ${fs.length}</span></div><div class="fig ex-scroll">${f.fig}</div><div class="ex-step">${f.text}</div>${fbFrameHTML(lessonFbKey())}</div></section>`;
}
function render() {
  const el = app(); if (!el) return;
  let body = '';
  if (view === 'home') body = homeHTML();
  else if (view === 'practice') body = practiceHTML();
  else if (view === 'result') body = resultHTML();
  else if (view === 'lesson') body = lessonHTML();
  else if (view === 'mine') body = mineHTML();
  else if (view === 'inbox') body = inboxHTML();
  else if (view === 'changes') body = changesHTML();
  else body = parentHTML();
  el.innerHTML = `<div class="wrap">${header()}${body}${footer()}</div>`;
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
  if (a === 'tab') { if (view === 'practice' && sess && sess.phase) { finishSession(true); } if (PAGE === 'parent') setTrial(['home', 'mine'].includes(v)); view = v; confirmReset = false; copyState = null; render(); window.scrollTo(0, 0); }
  else if (a === 'lesson') { lesson = { id: v, frame: 0, back: view === 'practice' ? 'practice' : 'home', frames: LESSONS[v].frames(), opened: Date.now() }; view = 'lesson'; render(); window.scrollTo(0, 0); }
  else if (a === 'lprev') { lesson.frame = Math.max(0, lesson.frame - 1); render(); }
  else if (a === 'lnext') { lesson.frame = Math.min(lesson.frames.length - 1, lesson.frame + 1); render(); }
  else if (a === 'lback') { view = lesson.back === 'practice' && sess ? 'practice' : 'home'; lesson = null; render(); window.scrollTo(0, 0); }
  else if (a === 'start') { startSession(v, b.dataset.lv); window.scrollTo(0, 0); }
  else if (a === 'key') typeKey(v);
  else if (a === 'slot') { if (sess.phase === 'answer') { sess.active = +v; render(); } }
  else if (a === 'choose') { sess.choice = v; sess.msg = null; render(); }
  else if (a === 'submit') submit();
  else if (a === 'next') { nextProblem(); window.scrollTo(0, 0); }
  else if (a === 'more') { oneMore(); window.scrollTo(0, 0); }
  else if (a === 'course') { const [m, lv] = v.split(':'); startSession(m, lv || null); window.scrollTo(0, 0); }
  else if (a === 'retry') { const w = sess.saved.items.filter((x) => !x.ok); startSession('retry', null, w.map((x) => ({ type: x.type, level: x.level }))); window.scrollTo(0, 0); }
  else if (a === 'explain') showExplain();
  else if (a === 'side') { if (v === 'explain') showExplain(); else { sess.sideTab = 'memo'; render(); } }
  else if (a === 'fprev') { sess.frame = Math.max(0, sess.frame - 1); render(); }
  else if (a === 'fnext') { sess.frame = Math.min(frames().length - 1, sess.frame + 1); if (sess.phase === 'done') { const ts = state.typeStats[sess.problem.type]; if (ts && !sess.reviewed) { ts.review++; sess.reviewed = true; saveLocal(); } const it = sess.items[sess.items.length - 1]; if (it && !it.ok && !it.review && sess.frame === frames().length - 1) { it.review = true; it.pts += PTS.review; sess.score += PTS.review; } } render(); }
  else if (a === 'clear') { if (memo) memo.clear(); }
  else if (a === 'finger') { state.finger = !state.finger; saveLocal(); render(); }
  else if (a === 'quit') finishSession(true);
  else if (a === 'copy') {
    const txt = exportText();
    const manual = () => { copyState = 'manual'; render(); const t = document.getElementById('export-box'); if (t) { t.focus(); t.select(); } };
    try { navigator.clipboard.writeText(txt).then(() => { copyState = 'ok'; render(); }, manual); } catch (err) { manual(); }
  }
  else if (a === 'fbframe') {
    if (view === 'lesson') { fbGiven[lessonFbKey()] = v; addFeedback('frame', v, { lesson: lesson.id, frame: lesson.frame + 1, frames: lesson.frames.length, frameText: stripTags(lesson.frames[lesson.frame].text).slice(0, 90) }); }
    else { fbGiven[practiceFbKey()] = v; addFeedback('frame', v, frameCtx()); }
    render();
  }
  else if (a === 'flagopen') { sess.flagOpen = true; render(); }
  else if (a === 'flag') { const p = sess.problem; const it = sess.items[sess.items.length - 1] || {}; fbGiven[`q:${sess.id}:${sess.idx}`] = v; addFeedback('problem', v, { type: p.type, stage: p.stage, level: p.level || undefined, q: p.text, answer: p.answerText, given: it.given, ok: it.ok }); render(); }
  else if (a === 'rate') { const s2 = sess.saved || {}; const ctx = { mode: sess.mode, lv: sess.fixedLv || undefined, c: s2.c, n: s2.n, ms: s2.ms, sessionId: s2.id };
    if (sess.ratingFb) { sess.ratingFb.verdict = v; sess.ratingFb.at = Date.now(); state.updatedAt = Date.now(); saveLocal(); } else sess.ratingFb = addFeedback('session', v, ctx);
    sess.rating = v; render(); }
  else if (a === 'comment') { const t = (document.getElementById('fb-text') || {}).value || ''; if (t.trim()) { const s2 = sess.saved || {}; addFeedback('comment', sess.rating || '', { mode: sess.mode, lv: sess.fixedLv || undefined, c: s2.c, n: s2.n, sessionId: s2.id }, t.trim()); sess.commentSent = true; render(); } }
  else if (a === 'idea') { const t = (document.getElementById('idea-text') || {}).value || ''; if (t.trim()) { addFeedback('idea', '', {}, t.trim()); ideaSent = true; render(); } }
  else if (a === 'sendfile') { shareRecord(); }
  else if (a === 'note') { const t = (document.getElementById('note-text') || {}).value || ''; const cat = (document.getElementById('note-cat') || {}).value || 'その他'; if (t.trim()) { const note = { id: 'n' + Date.now().toString(36), at: Date.now(), cat, text: t.trim() }; pstore.notes.push(note); saveParentStore(); enqueueCollect({ id: note.id, at: note.at, page: '保護者', kind: 'メモ', verdict: cat, text: note.text, where: '' }); noteMsg = 'メモに追加しました。'; render(); } }
  else if (a === 'delnote') { pstore.notes = pstore.notes.filter((n) => n.id !== v); saveParentStore(); render(); }
  else if (a === 'withdata') { withData = b.checked; report = null; }
  else if (a === 'mkreport') { report = buildReport(); render(); const t = document.getElementById('report-box'); if (t) t.scrollIntoView({ block: 'center' }); }
  else if (a === 'sharereport') { if (navigator.share) navigator.share({ title: report.id, text: report.text }).then(() => { report.msg = '共有しました。送ったら「送信済み」にしてください'; render(); }, () => {}); else { report.msg = 'この端末では共有が使えません。コピーしてください'; render(); } }
  else if (a === 'copyreport') { const ok = () => { report.msg = 'コピーしました。スレッドに はりつけてください'; render(); }; const manual = () => { report.msg = '下の文を選んでコピーしてください'; render(); const t = document.getElementById('report-box'); if (t) { t.focus(); t.select(); } }; try { navigator.clipboard.writeText(report.text).then(ok, manual); } catch (err) { manual(); } }
  else if (a === 'marksent') { report.fbIds.forEach((id) => { pstore.sent[id] = report.id; }); report.noteIds.forEach((id) => { pstore.sent[id] = report.id; }); pstore.batches.push({ id: report.id, at: Date.now(), count: report.count }); saveParentStore(); report = null; noteMsg = ''; render(); }
  else if (a === 'trialreset') { confirmTrialReset = true; render(); }
  else if (a === 'trialreset-no') { confirmTrialReset = false; render(); }
  else if (a === 'trialreset-yes') { if (trialMode) { const dev = state.deviceId; state = freshState(); state.deviceId = dev; saveLocal(); sess = null; view = 'home'; } confirmTrialReset = false; render(); }
  else if (a === 'reset') { confirmReset = true; render(); }
  else if (a === 'reset-no') { confirmReset = false; render(); }
  else if (a === 'reset-yes') {
    if (PAGE === 'parent') { // この端末の記録だけをリセットし、読みこんだファイルはそのまま
      const local = parentSources().local; if (local) { const f = freshState(); f.sessions = local.sessions || []; f.feedback = local.feedback || []; f.deviceId = local.deviceId; f.xp = local.xp; f.updatedAt = Date.now(); try { localStorage.setItem(CHILD_KEY, JSON.stringify(f)); } catch (e) { /* 保存できない */ } }
      state = parentState(); confirmReset = false; render(); return;
    }
    const keep = state.sessions; const fb = state.feedback; const f = state.finger; const dev = state.deviceId; const xp = state.xp; state = freshState(); state.sessions = keep; state.feedback = fb; state.finger = f; state.deviceId = dev; state.xp = xp; state.updatedAt = Date.now(); saveLocal(); saveRemote(); confirmReset = false; render(); }
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

// 時間: 画面がかくれている間 (ほかのアプリ・スリープ) は数えない
document.addEventListener('visibilitychange', () => {
  if (!sess || sess.phase !== 'answer') return;
  if (document.hidden) sess.hiddenAt = Date.now();
  else if (sess.hiddenAt) { sess.t0 += Date.now() - sess.hiddenAt; sess.hiddenAt = null; }
});
window.addEventListener('online', () => flushCollect());
document.addEventListener('visibilitychange', () => { if (!document.hidden) flushCollect(); });
document.addEventListener('change', (e) => { const t = e.target; if (t && t.dataset && t.dataset.act === 'import' && t.files && t.files[0]) importFile(t.files[0]); });
// 保護者ページ: 「お試し」タブでは お試しの記録に切りかえて書きこむ。ほかのタブでは 娘さんの記録を読むだけ
function setTrial(on) {
  if (on === trialMode) return;
  trialMode = on; LS_KEY = on ? TRIAL_KEY : CHILD_KEY; allowWrite = on; sess = null; confirmTrialReset = false;
  state = on ? loadLocal() : parentState();
}
if (PAGE === 'parent') { state = parentState(); if (location.hash === '#trial') { setTrial(true); view = 'home'; } }
render();
if (PAGE === 'child' || PAGE === 'all') initDb();
flushCollect();
