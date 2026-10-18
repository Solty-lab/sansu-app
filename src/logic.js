// ===== 数の扱い (分数で厳密に計算する) =====
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; };
const lcm = (a, b) => a / gcd(a, b) * b;

class Fr {
  constructor(n, d = 1) {
    if (d < 0) { n = -n; d = -d; }
    const g = gcd(n, d);
    this.n = n / g; this.d = d / g;
  }
  static of(x) {
    if (x instanceof Fr) return x;
    return Fr.dec(String(x));
  }
  static dec(s) {
    const m = String(s).match(/^(\d+)(?:\.(\d+))?$/);
    if (!m) throw new Error('bad decimal ' + s);
    const f = m[2] || '';
    return new Fr(parseInt(m[1] + f, 10), 10 ** f.length);
  }
  add(o) { o = Fr.of(o); return new Fr(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o) { o = Fr.of(o); return new Fr(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o) { o = Fr.of(o); return new Fr(this.n * o.n, this.d * o.d); }
  div(o) { o = Fr.of(o); return new Fr(this.n * o.d, this.d * o.n); }
  eq(o) { o = Fr.of(o); return this.n === o.n && this.d === o.d; }
  cmp(o) { o = Fr.of(o); return this.n * o.d - o.n * this.d; }
  isInt() { return this.d === 1; }
  terminating() { let d = this.d; while (d % 2 === 0) d /= 2; while (d % 5 === 0) d /= 5; return d === 1; }
  decPlaces() { if (!this.terminating()) return Infinity; let k = 0; while ((10 ** k) % this.d) k++; return k; }
  toDec() {
    if (!this.terminating()) return null;
    const k = this.decPlaces();
    return fmtScaled(this.n * (10 ** k / this.d), k);
  }
  val() { return this.n / this.d; }
}

function fmtScaled(num, k) {
  const neg = num < 0;
  let s = String(Math.abs(num));
  if (k === 0) return (neg ? '-' : '') + s;
  s = s.padStart(k + 1, '0');
  const ip = s.slice(0, -k), fp = s.slice(-k).replace(/0+$/, '');
  return (neg ? '-' : '') + (fp ? ip + '.' + fp : ip);
}

// ===== 乱数 =====
let rnd = Math.random;
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ===== 表示用 HTML =====
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function fracHTML(n, d) { return `<span class="fr"><span class="nu">${n}</span><span class="de">${d}</span></span>`; }
// 分数を 帯分数/仮分数 で表示
function frHTML(f, mixed = true) {
  if (f.isInt()) return String(f.n);
  if (mixed && f.n > f.d) { const w = Math.floor(f.n / f.d); return `<span class="mx">${w}${fracHTML(f.n - w * f.d, f.d)}</span>`; }
  return fracHTML(f.n, f.d);
}
function frText(f, mixed = true) {
  if (f.isInt()) return String(f.n);
  if (mixed && f.n > f.d) { const w = Math.floor(f.n / f.d); return `${w}と${f.n - w * f.d}/${f.d}`; }
  return `${f.n}/${f.d}`;
}
// 数(表示形式つき)  kind: 'dec' | 'frac' | 'int'
const num = (v, kind) => ({ k: 'num', v: Fr.of(v), kind: kind || (Fr.of(v).isInt() ? 'int' : 'dec'), src: typeof v === 'string' ? v : null });
function numHTML(t) {
  if (t.kind === 'frac') return frHTML(t.v, true);
  if (t.src) return t.src;
  return t.v.isInt() ? String(t.v.n) : (t.v.toDec() || frHTML(t.v));
}
function numText(t) {
  if (t.kind === 'frac') return frText(t.v, true);
  if (t.src) return t.src;
  return t.v.isInt() ? String(t.v.n) : (t.v.toDec() || frText(t.v));
}
// 答えの見せ方
function ansHTML(f, prefer) {
  if (prefer === 'frac' || !f.terminating()) return frHTML(f, true);
  return f.toDec();
}
function ansText(f, prefer) {
  if (prefer === 'frac' || !f.terminating()) return frText(f, true);
  return f.toDec();
}

// ===== 入力の読み取り =====
// 戻り値: {ok:true, v:Fr, form:'dec'|'frac'|'mixed', reduced:bool} か {ok:false}
function parseAnswer(s) {
  s = String(s || '').trim();
  let m;
  if ((m = s.match(/^(\d+)(?:\.(\d+))?$/))) return { ok: true, v: Fr.dec(s), form: 'dec', reduced: true };
  if ((m = s.match(/^(\d+)\/(\d+)$/))) {
    const n = +m[1], d = +m[2]; if (d === 0) return { ok: false };
    return { ok: true, v: new Fr(n, d), form: 'frac', reduced: gcd(n, d) === 1 && d !== 1 };
  }
  if ((m = s.match(/^(\d+)と(\d+)\/(\d+)$/))) {
    const w = +m[1], n = +m[2], d = +m[3]; if (d === 0) return { ok: false };
    return { ok: true, v: new Fr(w * d + n, d), form: 'mixed', reduced: gcd(n, d) === 1 && n < d && n > 0 };
  }
  return { ok: false };
}
// 判定: 'ok' | 'reduce' | 'ng' | 'empty' | 'bad'
function judgeSlot(input, slot) {
  if (!String(input || '').trim()) return 'empty';
  const p = parseAnswer(input);
  if (!p.ok) return 'bad';
  if (!p.v.eq(slot.value)) return 'ng';
  if (!p.reduced) return 'reduce';
  return 'ok';
}

// ===== 筆算グリッド =====
// row: {cells:[{c,dot,hl,small}], left:'', line:bool, top:bool}
function blankRow(n) { return { cells: Array.from({ length: n }, () => ({ c: '' })), left: '', line: false, top: false }; }
function cloneRows(rows) { return rows.map((r) => ({ ...r, cells: r.cells.map((c) => ({ ...c })) })); }
// 数字列 digits を、右端が列 endCol に来るように置く
function putDigits(row, digits, endCol, opts = {}) {
  const ds = String(digits).split('');
  for (let k = 0; k < ds.length; k++) {
    const col = endCol - (ds.length - 1 - k);
    if (col >= 0 && col < row.cells.length) row.cells[col] = { c: ds[k], hl: !!opts.hl };
  }
}
function clearHL(rows) { rows.forEach((r) => r.cells.forEach((c) => { c.hl = false; })); }
function gridHTML(rows, opts = {}) {
  const n = rows[0].cells.length;
  const hasLeft = rows.some((r) => r.left);
  let h = `<div class="hissan${opts.div ? ' is-div' : ''}" style="--cols:${n}">`;
  for (const r of rows) {
    h += `<div class="hs-row${r.line ? ' line' : ''}${r.top ? ' ovl' : ''}${r.small ? ' small' : ''}">`;
    if (hasLeft) h += `<span class="hs-left">${esc(r.left || '')}</span>`;
    for (const c of r.cells) {
      h += `<span class="hs-c${c.hl ? ' hl' : ''}${c.strike ? ' strike' : ''}">${esc(c.c || '')}${c.dot ? '<i class="dot"></i>' : ''}</span>`;
    }
    h += '</div>';
  }
  return h + '</div>';
}

// 数を「整数部の桁」「小数部の桁」に分ける
function splitDec(s) { const [ip, fp = ''] = String(s).split('.'); return { ip, fp, digits: (ip + fp).replace(/^0+(?=\d)/, ''), places: fp.length }; }

// --- たし算・ひき算 (小数点をそろえる) ---
function addSubFrames(aS, bS, op) {
  const A = splitDec(aS), B = splitDec(bS);
  const F = Math.max(A.fp.length, B.fp.length);
  const I = Math.max(A.ip.length, B.ip.length) + 1;
  const n = I + F + 1; // 左端に記号用の列
  const colOf = (posFromPoint) => I + posFromPoint; // posFromPoint: 整数部最後の桁=0, 小数第1位=1...
  const rowFor = (S) => {
    const r = blankRow(n);
    const ip = S.ip.split(''), fp = S.fp.split('');
    ip.forEach((c, i) => { r.cells[colOf(i - ip.length + 1)] = { c }; });
    fp.forEach((c, i) => { r.cells[colOf(i + 1)] = { c }; });
    if (S.fp.length) r.cells[colOf(0)].dot = true;
    return r;
  };
  const carry = blankRow(n); carry.small = true;
  const ra = rowFor(A), rb = rowFor(B); rb.cells[0] = { c: op === '+' ? '+' : '−' }; rb.line = true;
  const res = blankRow(n);
  const rows = [carry, ra, rb, res];
  const frames = [];
  const placeName = (p) => (p > 0 ? ['', '1/10の位', '1/100の位', '1/1000の位'][p] : ['一の位', '十の位', '百の位', '千の位', '万の位'][-p]);
  frames.push({ grid: cloneRows(rows), text: F ? `小数点の位置をたてにそろえて書きます。${A.fp.length !== B.fp.length ? '小数点より右の桁数がちがうところは 0 があると考えます。' : ''}` : '位をたてにそろえて書きます。' });
  // 桁ごとの値
  const digitAt = (S, p) => { // p: 小数第p位(p>0) / 10^(-p) の位 (p<=0)
    if (p > 0) return +(S.fp[p - 1] || 0);
    const i = S.ip.length - 1 + p; return i >= 0 ? +(S.ip[i] || 0) : 0;
  };
  let c = 0;
  const top = { ...A }; // ひき算でかりた後の値
  const topDigits = {};
  for (let p = F; p > -(I - 1); p--) topDigits[p] = digitAt(A, p);
  const lastP = -(I - 2);
  const out = {};
  for (let p = F; p >= lastP; p--) {
    const da = topDigits[p], db = digitAt(B, p);
    let text;
    if (op === '+') {
      const s = da + db + c;
      out[p] = s % 10;
      text = `${placeName(p)}: ${da} + ${db}${c ? ' + くり上がり 1' : ''} = ${s}${s >= 10 ? `。${s % 10} を書いて、1 を次の位へくり上げます` : ''}`;
      const nc = s >= 10 ? 1 : 0;
      if (nc && p > lastP) carry.cells[colOf(p - 1)] = { c: '1' };
      c = nc;
    } else {
      let x = da;
      if (x < db) {
        // 上の位からかりる (0 が続く場合は順にかりる)
        let q = p - 1;
        while (topDigits[q] === 0) { topDigits[q] = 9; carry.cells[colOf(q)] = { c: '9' }; ra.cells[colOf(q)].strike = true; q--; }
        topDigits[q] -= 1; carry.cells[colOf(q)] = { c: String(topDigits[q]) }; ra.cells[colOf(q)].strike = true;
        x += 10;
        text = `${placeName(p)}: ${da} − ${db} はひけないので、上の位から 1 かりて ${x} − ${db} = ${x - db}`;
      } else {
        text = `${placeName(p)}: ${x} − ${db} = ${x - db}`;
      }
      out[p] = x - db;
    }
    // 結果を書く
    clearHL(rows);
    const col = colOf(p);
    if (out[p] !== null) res.cells[col] = { c: String(out[p]), hl: true, dot: p === 0 && F > 0 };
    frames.push({ grid: cloneRows(rows), text });
  }
  if (op === '+' && c) {
    clearHL(rows);
    res.cells[colOf(lastP - 1)] = { c: '1', hl: true };
    frames.push({ grid: cloneRows(rows), text: 'いちばん上のくり上がり 1 をそのまま書きます。' });
  }
  // 上の位の 0 を消す (ひき算で 0 が先頭に来るとき)
  for (let k = 1; k < n; k++) {
    const cell = res.cells[k];
    if (k >= colOf(0)) break;
    if (cell.c === '0') { cell.c = ''; } else if (cell.c) break;
  }
  const av = Fr.dec(aS), bv = Fr.dec(bS);
  const result = op === '+' ? av.add(bv) : av.sub(bv);
  if (F && res.cells[colOf(F)].c === '0') {
    clearHL(rows);
    for (let p = F; p >= 1; p--) {
      const cell = res.cells[colOf(p)];
      if (cell.c === '0') cell.strike = true; else break;
    }
    frames.push({ grid: cloneRows(rows), text: `小数点より右の、終わりの 0 は消します。答えは ${result.toDec()} です。` });
  } else {
    frames.push({ grid: cloneRows(rows), text: `答えは ${result.toDec()} です。` });
  }
  return frames;
}

// --- かけ算 (右にそろえる。小数点はあとでうつ) ---
function mulFrames(aS, bS) {
  const A = splitDec(aS), B = splitDec(bS);
  const ai = +A.digits, bi = +B.digits;
  const places = A.places + B.places;
  const prod = ai * bi;
  const bd = String(bi).split('').reverse(); // 一の位から
  const partials = bd.map((d, i) => ({ d: +d, v: ai * +d, shift: i }));
  let prodS = String(prod);
  if (places) prodS = prodS.padStart(places + 1, '0');
  const width = Math.max((A.ip + A.fp).length, (B.ip + B.fp).length + 1, ...partials.map((p) => String(p.v).length + p.shift), prodS.length) + 1;
  const n = width;
  const end = n - 1;
  const ra = blankRow(n); putDigits(ra, A.ip + A.fp === '' ? String(ai) : (A.ip + A.fp).replace(/^0+(?=\d\d)/, ''), end);
  if (A.places) ra.cells[end - A.places].dot = true;
  const bDisp = (B.ip + B.fp).replace(/^0+(?=\d\d)/, '');
  const rb = blankRow(n); putDigits(rb, bDisp, end); rb.cells[end - bDisp.length] = { c: '×' };
  if (B.places) rb.cells[end - B.places].dot = true;
  rb.line = true;
  const rows = [ra, rb];
  const frames = [];
  const aTxt = A.places ? `${aS} は ${ai} の ${['', '1/10', '1/100', '1/1000'][A.places]}` : '';
  const bTxt = B.places ? `${bS} は ${bi} の ${['', '1/10', '1/100', '1/1000'][B.places]}` : '';
  frames.push({ grid: cloneRows(rows), text: places ? `小数点は気にせず、右の端をそろえて書きます。まず ${ai} × ${bi} を整数のかけ算として計算します。` : '右の端をそろえて書きます。' });
  const pRows = [];
  partials.forEach((p, i) => {
    const r = blankRow(n);
    if (p.v === 0) return;
    putDigits(r, String(p.v), end - p.shift, { hl: true });
    clearHL(rows);
    rows.push(r); pRows.push(r);
    const posName = ['一の位', '十の位', '百の位'][i];
    frames.push({ grid: cloneRows(rows), text: `かける数の${posName}の ${p.d} をかけます: ${ai} × ${p.d} = ${p.v}${i ? `。${posName}なので、${i}つ左にずらして書きます` : ''}` });
  });
  if (pRows.length > 1) {
    pRows[pRows.length - 1].line = true;
    const r = blankRow(n); putDigits(r, prodS.replace(/^0+(?=\d)/, ''), end, { hl: true });
    clearHL(rows);
    rows.push(r);
    frames.push({ grid: cloneRows(rows), text: `たてにたし算します: ${ai} × ${bi} = ${prod}` });
  }
  const last = rows[rows.length - 1];
  if (places) {
    // 必要なら 0 を補う
    clearHL(rows);
    putDigits(last, prodS, end);
    last.cells[end - places].dot = true;
    last.cells[end - places].hl = true;
    const res = Fr.dec(aS).mul(Fr.dec(bS));
    let text = `${[aTxt, bTxt].filter(Boolean).join('、')}。だから答えは ${prod} の 1/${10 ** places} です。小数点より右の桁数は ${A.places} + ${B.places} = ${places} けたなので、右から ${places} けたのところに小数点をうちます。`;
    if (prodS.length > String(prod).length) text += ' 桁が足りないところには 0 を書きます。';
    frames.push({ grid: cloneRows(rows), text });
    const shown = fmtScaled(prod, places) ;
    const raw = prodS.slice(0, -places) + '.' + prodS.slice(-places);
    if (raw !== shown) {
      clearHL(rows);
      for (let k = 0; k < places; k++) { const cell = last.cells[end - k]; if (cell.c === '0') cell.strike = true; else break; }
      frames.push({ grid: cloneRows(rows), text: `小数点より右の、終わりの 0 は消します。答えは ${res.toDec()} です。` });
    } else {
      frames.push({ grid: cloneRows(rows), text: `答えは ${res.toDec()} です。` });
    }
  } else {
    frames.push({ grid: cloneRows(rows), text: `答えは ${prod} です。` });
  }
  return frames;
}

// --- わり算 (わる数を整数にしてから) ---
// dividendS: 10倍などをしたあとの わられる数(文字列), divisor: 整数
function longDivFrames(dividendS, divisor, introFrames = []) {
  const D = splitDec(dividendS);
  let digits = (D.ip + D.fp).split('').map(Number);
  // 先頭の 0 (0.48 など) は残す: 位置を保つため
  const intLen = D.ip.length;
  let hasDot = D.fp.length > 0;
  const steps = [];
  let r = 0, started = false;
  for (let i = 0; ; i++) {
    if (i >= digits.length) {
      if (r === 0 && i > intLen - 1) break;
      digits.push(0); hasDot = true;
    }
    const cur = r * 10 + digits[i];
    const q = Math.floor(cur / divisor);
    if (!started && q === 0 && i < intLen - 1) { r = cur; steps.push({ i, skip: true, cur }); continue; }
    started = true;
    const prod = q * divisor;
    steps.push({ i, cur, q, prod, r: cur - prod });
    r = cur - prod;
    if (r === 0 && i >= digits.length - 1 && i >= intLen - 1) break;
    if (steps.length > 40) break;
  }
  const n = digits.length;
  const qRow = blankRow(n);
  const dRow = blankRow(n); dRow.top = true; dRow.left = `${divisor})`;
  digits.forEach((d, i) => { dRow.cells[i] = { c: String(d) }; });
  // 追加した 0 は薄く
  for (let i = (D.ip + D.fp).length; i < n; i++) dRow.cells[i].added = true;
  if (hasDot) dRow.cells[intLen - 1].dot = true;
  const rows = [qRow, dRow];
  const frames = introFrames.slice();
  frames.push({ grid: cloneRows(rows), text: `${dividendS} ÷ ${divisor} を筆算で計算します。${(D.ip + D.fp).length < n ? '割り切れるまで、わられる数の後ろに 0 をつけたして続けます。' : ''}`, div: true });
  if (hasDot) {
    qRow.cells[intLen - 1].dot = true;
    frames.push({ grid: cloneRows(rows), text: '商の小数点は、わられる数の小数点の真上にうっておきます。', div: true });
  }
  const real = steps.filter((s) => !s.skip);
  const setQ = (s, hl) => { qRow.cells[s.i] = { c: String(s.q), hl, dot: hasDot && s.i === intLen - 1 }; };
  const firstPos = real.findIndex((x) => x.q > 0);
  // 最初の 0 (0.4 の 0 など)
  real.slice(0, firstPos).forEach((s) => {
    clearHL(rows); setQ(s, true);
    frames.push({ grid: cloneRows(rows), text: `${s.cur} の中に ${divisor} は入らないので、商に 0 を立てて次の数字をおろします。`, div: true });
  });
  for (let k = firstPos; k < real.length; k++) {
    const s = real[k];
    if (s.q === 0) continue;
    clearHL(rows); setQ(s, true);
    const pr = blankRow(n); putDigits(pr, String(s.prod), s.i, { hl: true }); pr.line = true;
    rows.push(pr);
    frames.push({ grid: cloneRows(rows), text: `${s.cur} ÷ ${divisor} → 商に ${s.q} を立てます。${divisor} × ${s.q} = ${s.prod} を下に書きます。`, div: true });
    let j = k + 1; const zeros = [];
    while (j < real.length && real[j].q === 0) { zeros.push(real[j]); j++; }
    const next = real[j];
    clearHL(rows);
    const rr = blankRow(n);
    if (next) {
      putDigits(rr, String(next.cur), next.i, { hl: true });
      zeros.forEach((z) => setQ(z, true));
      rows.push(rr);
      const zt = zeros.length ? `数字を1つおろしても ${divisor} は入らないので、商に 0 を立てて、もう1つおろします。` : '';
      frames.push({ grid: cloneRows(rows), text: `${s.cur} − ${s.prod} = ${s.r}。次の数字をおろします。${zt}→ ${next.cur}`, div: true });
    } else {
      putDigits(rr, String(s.r), s.i, { hl: true });
      zeros.forEach((z) => setQ(z, true));
      rows.push(rr);
      const zt = zeros.length ? `残りの ${'0'.repeat(zeros.length)} をおろしても ${divisor} は入らないので、商に 0 を立てます。` : 'あまりが 0 になったので、わり切れました。';
      frames.push({ grid: cloneRows(rows), text: `${s.cur} − ${s.prod} = ${s.r}。${zt}`, div: true });
    }
  }
  // 商の先頭の 0 (0.4 など)
  return frames;
}

function divFrames(aS, bS) {
  // aS ÷ bS (どちらも 10進の文字列)
  const B = splitDec(bS);
  const k = B.places;
  const intro = [];
  let dividendS = aS;
  if (k) {
    const scaled = Fr.dec(aS).mul(10 ** k);
    dividendS = scaled.toDec();
    intro.push({ text: `わる数 ${bS} を整数にするため、わる数とわられる数の両方を ${10 ** k} 倍します (小数点を右に ${k} つ動かす)。<br>${aS} ÷ ${bS} = ${dividendS} ÷ ${+B.digits}<br>両方を同じ数だけ倍しても、商は変わりません。` });
  }
  const divisor = +B.digits;
  // わられる数の先頭が "0." のときは 0 を残す
  return longDivFrames(dividendS, divisor, intro);
}

// ===== 問題の種類 =====
// 各問題: {type, stage, level, html, text, slots:[{value:Fr, unit, prefer}], choices?, answerChoice?, explain: ()=>frames}
// levels をもつステップは、10問の中で レベル1 → 5 と だんだん むずかしくなる
const STAGES = {
  A1: { track: 'A', name: '整数の計算', levels: {
    1: { name: '2けたの たし算・ひき算', types: ['int_add', 'int_sub'] },
    2: { name: '3けたの たし算・ひき算 (くり上がり・くり下がり)', types: ['int_add', 'int_sub'] },
    3: { name: '× 1けた、÷ 1けた', types: ['int_mul', 'int_div'] },
    4: { name: '× 2けた、÷ 2けた', types: ['int_mul', 'int_div'] },
    5: { name: '大きい数の × ÷、暗算のくふう', types: ['int_mul', 'int_div', 'mental'] },
  } },
  A2: { track: 'A', name: '小数の計算', levels: {
    1: { name: '小数の たし算・ひき算 (けたが同じ)', types: ['dec_add', 'dec_sub'] },
    2: { name: 'けた数のちがう小数の たし算・ひき算', types: ['dec_add', 'dec_sub'] },
    3: { name: '小数 × 整数、小数 ÷ 整数', types: ['dec_mul', 'dec_div'] },
    4: { name: '小数 × 小数', types: ['dec_mul'] },
    5: { name: '小数 ÷ 小数', types: ['dec_div'] },
  } },
  A3: { track: 'A', name: '分数の計算', types: ['fr_add', 'fr_sub', 'fr_mul', 'fr_div'] },
  A4: { track: 'A', name: 'まぜた計算', types: ['mix_calc', 'mix_calc', 'order'] },
  B1: { track: 'B', name: '単位のかんさん', types: ['conv'] },
  B2: { track: 'B', name: '単位の組み合わせ', types: ['time_mix', 'len_mix', 'speed_conv'] },
  B3: { track: 'B', name: '速さ', types: ['speed'] },
  B4: { track: 'B', name: '単位量あたり', types: ['per_unit', 'per_total', 'compare'] },
};
for (const st of Object.values(STAGES)) if (st.levels) st.types = [...new Set(Object.values(st.levels).flatMap((l) => l.types))];
const LEVEL_RAMP = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]; // 10問の何問目がどのレベルか
const TRACKS = { A: { name: '計算のしくみ', stages: ['A1', 'A2', 'A3', 'A4'] }, B: { name: '単位と速さ', stages: ['B1', 'B2', 'B3', 'B4'] } };
const TYPE_NAMES = {
  int_add: '整数のたし算', int_sub: '整数のひき算', int_mul: '整数のかけ算', int_div: '整数のわり算', mental: '暗算のくふう',
  dec_add: '小数のたし算', dec_sub: '小数のひき算', dec_mul: '小数のかけ算', dec_div: '小数のわり算',
  fr_add: '分数のたし算', fr_sub: '分数のひき算', fr_mul: '分数のかけ算', fr_div: '分数のわり算',
  mix_calc: 'まぜた計算', order: '計算の順番',
  conv: '単位のかんさん', time_mix: '時間の組み合わせ', len_mix: '長さ・重さの組み合わせ', speed_conv: '速さの単位',
  speed: '速さの問題', per_unit: '1あたりを求める', per_total: '1あたりから求める', compare: 'くらべる',
};
const stageOfType = (t) => Object.keys(STAGES).find((s) => STAGES[s].types.includes(t));
// あるステップ・レベルで出せる種類
function levelTypes(stage, lv) { const st = STAGES[stage]; return st.levels ? st.levels[lv].types : st.types; }

const OPS = { '+': '+', '-': '−', '*': '×', '/': '÷' };
const slot = (value, unit = '', prefer) => ({ value: Fr.of(value), unit, prefer });
const textFrames = (...ts) => ts.map((t) => ({ text: t }));

// ===== 位ごとに考える解説 =====
const PLACE_NAMES = { 4: '万の位', 3: '千の位', 2: '百の位', 1: '十の位', 0: '一の位', '-1': '1/10の位', '-2': '1/100の位', '-3': '1/1000の位' };
// 数を位ごとの部分に分ける: 352.4 → [{p:2,d:3},{p:1,d:5},{p:0,d:2},{p:-1,d:4}]
function placeParts(S) {
  const { ip, fp } = splitDec(S);
  const out = [];
  ip.split('').forEach((c, i) => out.push({ p: ip.length - 1 - i, d: +c }));
  fp.split('').forEach((c, i) => out.push({ p: -(i + 1), d: +c }));
  return out;
}
const partVal = (d, p) => (p >= 0 ? String(d * 10 ** p) : fmtScaled(d, -p));
const partFr = (d, p) => Fr.dec(partVal(d, p));
const nonzeroParts = (S) => placeParts(S).filter((x) => x.d > 0);
// 例: 一の位 8 + 5 = 13 → 13 は 10 と 3。10 は 十の位の 1 つ分
function carryNote(p, sv) {
  const up = partFr(1, p + 1); const rest = sv.sub(up);
  const split = rest.eq(0) ? '' : ` は ${up.toDec()} と ${rest.toDec()}。${up.toDec()}`;
  return `色のついた位は、数字をたすと 10 以上になります。${PLACE_NAMES[p]}の ${sv.toDec()}${split} は${PLACE_NAMES[p + 1]}の「1」なので、${PLACE_NAMES[p + 1]}に 1 くり上がります。`;
}
function pvAddFrames(aS, bS) {
  const A = placeParts(aS), B = placeParts(bS);
  const ps = [...new Set([...A, ...B].map((x) => x.p))].sort((x, y) => y - x);
  const dAt = (P, p) => (P.find((x) => x.p === p) || { d: 0 }).d;
  const rows = []; const sums = []; let carry = null;
  for (const p of ps) {
    const da = dAt(A, p), db = dAt(B, p);
    const sv = partFr(da, p).add(partFr(db, p));
    const c = da + db >= 10;
    if (c) carry = { p, sv };
    rows.push(`<tr><th>${PLACE_NAMES[p]}</th><td${c ? ' class="carry"' : ''}>${partVal(da, p)} + ${partVal(db, p)} = <b>${sv.toDec()}</b></td></tr>`);
    if (!sv.eq(0)) sums.push(sv);
  }
  const total = Fr.dec(aS).add(Fr.dec(bS));
  return [
    { text: `位ごとに分けて たします。<table class="pv">${rows.join('')}</table>` },
    { text: `位ごとの答えを あわせます: ${sums.map((x) => x.toDec()).join(' + ')} = <b>${total.toDec()}</b>${carry ? `<br><small>${carryNote(carry.p, carry.sv)} 筆算の「くり上がり」は、このことです。</small>` : ''}` },
  ];
}
function pvSubFrames(aS, bS) {
  const parts = nonzeroParts(bS);
  let cur = Fr.dec(aS); const lines = [];
  for (const x of parts) { const v = partFr(x.d, x.p); const nx = cur.sub(v); lines.push(`${cur.toDec()} − ${v.toDec()} = <b>${nx.toDec()}</b>`); cur = nx; }
  if (parts.length < 2) return [{ text: `${aS} − ${bS} = <b>${cur.toDec()}</b>` }];
  return [
    { text: `ひく数 ${bS} を 位ごとに ${parts.map((x) => partVal(x.d, x.p)).join(' と ')} に分けて、順にひきます。` },
    { text: lines.join('<br>') + `<br><small>大きい位から順にひくと、暗算でも考えやすくなります。</small>` },
  ];
}
function pvMulFrames(aS, bS) {
  const A = splitDec(aS), B = splitDec(bS);
  const res = Fr.dec(aS).mul(Fr.dec(bS));
  const fs = [];
  if (!B.places && B.digits.length === 1) {
    const parts = nonzeroParts(aS);
    if (parts.length >= 2) {
      const ps = parts.map((x) => ({ v: partFr(x.d, x.p), s: partVal(x.d, x.p) }));
      fs.push({ text: `${aS} を ${ps.map((x) => x.s).join(' と ')} に分けて、それぞれに ${bS} をかけます。<br>${ps.map((x) => `${x.s} × ${bS} = <b>${x.v.mul(Fr.dec(bS)).toDec()}</b>`).join('<br>')}` });
      fs.push({ text: `あわせて ${ps.map((x) => x.v.mul(Fr.dec(bS)).toDec()).join(' + ')} = <b>${res.toDec()}</b>` });
    }
    if (A.places) fs.push({ text: `別の考え方: ${aS} は 0.${'0'.repeat(A.places - 1)}1 が ${+A.digits} こ。${+A.digits} × ${bS} = ${+A.digits * +bS} なので、0.${'0'.repeat(A.places - 1)}1 が ${+A.digits * +bS} こ = <b>${res.toDec()}</b>` });
  } else if (!B.places && !A.places) {
    const parts = nonzeroParts(bS);
    const ps = parts.map((x) => ({ v: partFr(x.d, x.p), s: partVal(x.d, x.p) }));
    fs.push({ text: `かける数 ${bS} を ${ps.map((x) => x.s).join(' と ')} に分けて、それぞれ ${aS} にかけます。<br>${ps.map((x) => `${aS} × ${x.s} = <b>${Fr.dec(aS).mul(x.v).toDec()}</b>`).join('<br>')}` });
    fs.push({ text: `あわせて ${ps.map((x) => Fr.dec(aS).mul(x.v).toDec()).join(' + ')} = <b>${res.toDec()}</b><br><small>筆算で書く段は、この ${ps.length} つの数です (0 は書かずに、1つずつ左にずらして書きます)。</small>` });
  } else {
    const ua = A.places ? `0.${'0'.repeat(A.places - 1)}1` : '1', ub = B.places ? `0.${'0'.repeat(B.places - 1)}1` : '1';
    const up = A.places + B.places;
    fs.push({ text: `小さい単位の「いくつ分」で考えます。<br>${aS} は ${ua} が ${+A.digits} こ、${bS} は ${ub} が ${+B.digits} こ。` });
    fs.push({ text: `${+A.digits} × ${+B.digits} = ${+A.digits * +B.digits}。${ua} × ${ub} = 0.${'0'.repeat(up - 1)}1 なので、答えは 0.${'0'.repeat(up - 1)}1 が ${+A.digits * +B.digits} こ = <b>${res.toDec()}</b>` });
  }
  return fs;
}
function pvDivFrames(aS, bS) {
  const B = splitDec(bS);
  const D = Fr.dec(aS).mul(10 ** B.places), d = +B.digits;
  const Ds = D.toDec(), Q = D.div(d);
  const fs = [];
  if (B.places) fs.push({ text: `わる数 ${bS} を整数にするため、わる数とわられる数を両方 ${10 ** B.places} 倍します: ${aS} ÷ ${bS} = ${Ds} ÷ ${d}<br><small>両方を同じ数だけ倍しても、答え (商) は変わりません。</small>` });
  const Dp = splitDec(Ds).places;
  let N = Fr.dec(Ds).mul(10 ** Dp), M = N.div(d);
  if (Dp && M.isInt()) {
    const u = `0.${'0'.repeat(Dp - 1)}1`;
    fs.push({ text: `${Ds} は ${u} が ${N.n} こ。${N.n} ÷ ${d} = ${M.n} なので、${u} が ${M.n} こ = <b>${Q.toDec()}</b>` });
    return fs;
  }
  if (Q.isInt()) {
    const parts = nonzeroParts(String(Q.n));
    if (parts.length >= 2) {
      const chunks = parts.map((x) => ({ q: partVal(x.d, x.p), c: d * x.d * 10 ** x.p }));
      fs.push({ text: `${Ds} を ${d} でわりやすい数に分けます: ${Ds} = ${chunks.map((x) => x.c).join(' + ')}<br>${chunks.map((x) => `${x.c} ÷ ${d} = <b>${x.q}</b>`).join('<br>')}` });
      fs.push({ text: `あわせて ${chunks.map((x) => x.q).join(' + ')} = <b>${Q.n}</b><br><small>筆算では、この分け方を上の位から順に行っています。</small>` });
    } else {
      fs.push({ text: `${d} × □ = ${Ds} になる □ をさがします。${d} × ${Q.n} = ${Ds} なので <b>${Q.n}</b>` });
    }
  }
  return fs;
}
const withHissan = (pv, hs) => pv.concat([{ text: '同じ計算を、筆算で1段ずつ見てみましょう。' }], hs);

// --- A1 整数 / A2 小数 (レベルつき) ---
function decStr(intDigitsMax, places) {
  const max = 10 ** (intDigitsMax + places) - 1;
  let v;
  do { v = ri(10 ** places + 1, max); } while (v % 10 === 0 && places > 0);
  return fmtScaled(v, places);
}
const GEN = {};
const noZeroInt = (lo, hi) => { let v; do { v = ri(lo, hi); } while (/0/.test(String(v))); return v; };
const digitsOf = (n) => String(n).split('').map(Number);
function addProblem(a, b) { const v = Fr.dec(a).add(Fr.dec(b)); return { html: `${a} + ${b} =`, text: `${a} + ${b}`, slots: [slot(v)], explain: () => withHissan(pvAddFrames(a, b), addSubFrames(a, b, '+')) }; }
function subProblem(a, b) { const v = Fr.dec(a).sub(Fr.dec(b)); return { html: `${a} − ${b} =`, text: `${a} − ${b}`, slots: [slot(v)], explain: () => withHissan(pvSubFrames(a, b), addSubFrames(a, b, '-')) }; }
GEN.int_add = (lv = 1) => {
  for (;;) {
    if (lv <= 1) { const a = ri(11, 88), b = ri(11, 88); const da = digitsOf(a), db = digitsOf(b); if (da[0] + db[0] <= 9 && da[1] + db[1] <= 9) return addProblem(String(a), String(b)); }
    else { const a = ri(105, 899), b = ri(105, 899); const da = digitsOf(a), db = digitsOf(b); if (da[2] + db[2] >= 10 || da[1] + db[1] >= 10) return addProblem(String(a), String(b)); }
  }
};
GEN.int_sub = (lv = 1) => {
  for (;;) {
    if (lv <= 1) { const a = ri(25, 99), b = ri(11, a - 1); const da = digitsOf(a), db = digitsOf(b); if (db.length === 2 && da[1] >= db[1]) return subProblem(String(a), String(b)); }
    else { const a = ri(201, 999), b = ri(102, a - 50); const da = digitsOf(a), db = digitsOf(b); if (db.length === 3 && (da[2] < db[2] || da[1] < db[1])) return subProblem(String(a), String(b)); }
  }
};
function mulProblem(a, b) { const v = Fr.dec(a).mul(Fr.dec(b)); return { html: `${a} × ${b} =`, text: `${a} × ${b}`, slots: [slot(v)], explain: () => withHissan(pvMulFrames(a, b), mulFrames(a, b)) }; }
function divProblem(a, b, q) { return { html: `${a} ÷ ${b} =`, text: `${a} ÷ ${b}`, slots: [slot(q)], explain: () => withHissan(pvDivFrames(a, b), divFrames(a, b)) }; }
GEN.int_mul = (lv = 3) => {
  if (lv <= 3) return mulProblem(String(ri(12, 98)), String(ri(3, 9)));
  if (lv === 4) return mulProblem(String(ri(12, 98)), String(noZeroInt(12, 59)));
  return mulProblem(String(ri(102, 987)), String(noZeroInt(12, 89)));
};
GEN.int_div = (lv = 3) => {
  let d, q;
  if (lv <= 3) { d = ri(2, 9); q = ri(12, 99); }
  else if (lv === 4) { for (;;) { d = ri(12, 48); q = ri(3, 9); if (d * q >= 100) break; } }
  else { d = ri(12, 48); q = ri(12, 99) * (rnd() < 0.25 ? 10 : 1); }
  return divProblem(String(d * q), String(d), q);
};
GEN.dec_add = (lv = 2) => {
  if (lv <= 1) {
    for (;;) { const a = ri(11, 89), b = ri(11, 89); const da = digitsOf(a), db = digitsOf(b); if (da[1] && db[1] && da[0] + db[0] <= 9 && da[1] + db[1] <= 9) return addProblem(fmtScaled(a, 1), fmtScaled(b, 1)); }
  }
  // けた数をわざとそろえない (小数点をそろえる練習)
  const p1 = pick([1, 2]), p2 = 3 - p1;
  return addProblem(decStr(pick([1, 2]), p1), decStr(pick([1, 2]), p2));
};
GEN.dec_sub = (lv = 2) => {
  if (lv <= 1) {
    for (;;) { const a = ri(21, 99), b = ri(11, a - 1); const da = digitsOf(a), db = digitsOf(b); if (da[1] && db[1] && db.length === 2 && da[1] >= db[1]) return subProblem(fmtScaled(a, 1), fmtScaled(b, 1)); }
  }
  let a, b;
  do { const p1 = pick([1, 2]); a = decStr(2, p1); b = decStr(pick([1, 2]), 3 - p1); } while (Fr.dec(a).cmp(Fr.dec(b)) <= 0 || splitDec(a).fp.length === splitDec(b).fp.length);
  return subProblem(a, b);
};
GEN.dec_mul = (lv = 4) => {
  if (lv <= 3) { let a; do { a = fmtScaled(ri(11, 99), 1); } while (!/\./.test(a)); return mulProblem(a, String(ri(2, 9))); }
  if (lv === 4) {
    const a = pick([fmtScaled(ri(11, 99), 1), fmtScaled(ri(11, 99), 1), fmtScaled(ri(101, 999), 2)]);
    const b = pick([fmtScaled(noZeroInt(11, 99), 1), fmtScaled(ri(2, 9), 1)]);
    if (!/\./.test(a) || !/\./.test(b)) return GEN.dec_mul(lv);
    return mulProblem(a, b);
  }
  const a = fmtScaled(ri(101, 999), 2), b = fmtScaled(noZeroInt(11, 99), 1);
  if (!/\./.test(a) || !/\./.test(b)) return GEN.dec_mul(lv);
  return mulProblem(a, b);
};
GEN.dec_div = (lv = 5) => {
  let a, b, q;
  for (let tries = 0; tries < 400; tries++) {
    if (lv <= 3) { b = String(ri(2, 9)); q = Fr.dec(fmtScaled(ri(11, 99), 1)); }
    else if (rnd() < 0.5) { b = fmtScaled(ri(2, 9), 1); q = Fr.dec(String(ri(3, 40))); }
    else { b = fmtScaled(noZeroInt(12, 48), 1); q = Fr.dec(pick([String(ri(2, 30)), fmtScaled(ri(11, 59), 1)])); }
    if (q.isInt() && q.n % 10 === 0) continue;
    const av = Fr.dec(b).mul(q);
    if (av.decPlaces() > 2) continue;
    a = av.toDec();
    if (!/\./.test(a) && lv <= 3) continue;
    break;
  }
  return divProblem(a, b, q);
};
GEN.mental = () => {
  const kind = ri(0, 7);
  let q, v, frames;
  if (kind === 0) { const k = ri(2, 9) * 4; q = `25 × ${k}`; v = 25 * k; frames = textFrames(`${k} を 4 × ${k / 4} に分けます。`, `25 × 4 = 100 を先に計算すると、100 × ${k / 4} = ${v}`); }
  else if (kind === 1) { const x = ri(23, 87); const a = pick([98, 99, 97, 198]); q = `${a} + ${x}`; v = a + x; const r = Math.ceil(a / 100) * 100; frames = textFrames(`${a} を ${r} − ${r - a} と考えます。`, `${r} + ${x} = ${r + x}、そこから ${r - a} をひいて ${v}`); }
  else if (kind === 2) { const x = ri(12, 48); q = `${x} × 99`; v = x * 99; frames = textFrames('99 を 100 − 1 と考えます。', `${x} × 100 = ${x * 100}、そこから ${x} をひいて ${v}`); }
  else if (kind === 3) { const x = ri(13, 98) * 2; q = `${x} × 5`; v = x * 5; frames = textFrames('× 5 は「× 10 してから ÷ 2」と同じです (5 = 10 ÷ 2)。', `${x} × 10 = ${x * 10}、÷ 2 で ${v}`); }
  else if (kind === 4) { const k = ri(2, 9); q = `125 × ${8 * k}`; v = 125 * 8 * k; frames = textFrames(`${8 * k} を 8 × ${k} に分けます。`, `125 × 8 = 1000 を使うと、1000 × ${k} = ${v}`); }
  else if (kind === 5) { const x = fmtScaled(ri(11, 99), 1); q = `2.5 × ${x} × 4`; v = Fr.dec(x).mul(10); frames = textFrames('かけ算は順番を入れかえても答えは同じです。', `2.5 × 4 = 10 を先に計算すると、10 × ${x} = ${v.toDec()}`); }
  else if (kind === 6) { const x = ri(12, 48); q = `102 × ${x}`; v = 102 * x; frames = textFrames('102 を 100 + 2 に分けます。', `100 × ${x} = ${100 * x}、2 × ${x} = ${2 * x}、あわせて ${v}`); }
  else { const x = ri(123, 876); q = `1000 − ${x}`; v = 1000 - x; frames = textFrames(`1000 を 999 + 1 と考えると、くり下がりがなくなります。`, `999 − ${x} = ${999 - x}、1 をたして ${v}`); }
  return { html: `${q} =`, text: q, slots: [slot(v)], note: '暗算でくふうしてみよう', explain: () => frames };
};

// --- A2 分数 ---
function randFrac(opts = {}) {
  const ds = opts.ds || [2, 3, 4, 5, 6, 7, 8, 9, 10, 12];
  for (;;) {
    const d = pick(ds), n = ri(1, d - 1);
    if (gcd(n, d) !== 1) continue;
    const w = opts.mixed && rnd() < 0.35 ? ri(1, 2) : 0;
    return new Fr(w * d + n, d);
  }
}
const fTok = (f) => num(f, f.isInt() ? 'int' : 'frac');
function binHTML(a, op, b) { return `${numHTML(a)} ${OPS[op]} ${numHTML(b)} =`; }
function binText(a, op, b) { return `${numText(a)} ${OPS[op]} ${numText(b)}`; }
function frAddSubExplain(a, b, op) {
  const L = lcm(a.d, b.d);
  const fs = [];
  const res = op === '+' ? a.add(b) : a.sub(b);
  if (a.d !== b.d) {
    fs.push({ text: `分母がちがうので、そろえます (通分)。${a.d} と ${b.d} の最小公倍数は ${L} です。` });
    fs.push({ text: `${frHTML(a, false)} = ${fracHTML(a.n * L / a.d, L)}、 ${frHTML(b, false)} = ${fracHTML(b.n * L / b.d, L)}<br><small>分母と分子に同じ数をかけても、大きさは変わりません。</small>` });
  }
  const an = a.n * L / a.d, bn = b.n * L / b.d, rn = op === '+' ? an + bn : an - bn;
  fs.push({ text: `分子どうしを${op === '+' ? 'たし' : 'ひき'}ます: ${fracHTML(an, L)} ${OPS[op]} ${fracHTML(bn, L)} = ${fracHTML(rn, L)}` });
  const g = gcd(rn, L);
  if (g > 1) fs.push({ text: `分母と分子を ${g} でわって約分します: ${fracHTML(rn, L)} = ${frHTML(res, false)}` });
  if (res.n > res.d && !res.isInt()) fs.push({ text: `仮分数は帯分数にもできます: ${frHTML(res, false)} = ${frHTML(res, true)} (どちらで答えても正解です)` });
  else fs.push({ text: `答えは ${frHTML(res)} です。` });
  return fs;
}
GEN.fr_add = () => {
  let a, b; do { a = randFrac({ mixed: true }); b = randFrac(); } while (a.d === b.d && rnd() < 0.8);
  const v = a.add(b);
  return { html: binHTML(fTok(a), '+', fTok(b)), text: binText(fTok(a), '+', fTok(b)), slots: [slot(v, '', 'frac')], explain: () => frAddSubExplain(a, b, '+') };
};
GEN.fr_sub = () => {
  let a, b; do { a = randFrac({ mixed: true }); b = randFrac(); } while (a.cmp(b) <= 0 || (a.d === b.d && rnd() < 0.8));
  const v = a.sub(b);
  return { html: binHTML(fTok(a), '-', fTok(b)), text: binText(fTok(a), '-', fTok(b)), slots: [slot(v, '', 'frac')], explain: () => frAddSubExplain(a, b, '-') };
};
function frMulExplain(a, b, isDiv) {
  const fs = [];
  let x = a, y = b;
  if (isDiv) {
    const inv = new Fr(b.d, b.n);
    fs.push({ text: `分数でわるときは、わる数の分母と分子を入れかえてかけます: ÷ ${frHTML(b, false)} → × ${fracHTML(b.d, b.n)}` });
    fs.push({ text: `<small>わけ: ÷ ${frHTML(b, false)} は「${b.n} でわって ${b.d} をかける」の反対、つまり「${b.d} をかけて ${b.n} でわる」と同じだからです。</small>` });
    y = inv;
  }
  if (!x.isInt() && x.n > x.d && a.n > a.d) fs.push({ text: `帯分数は仮分数になおしてから計算します: ${frHTML(x, true)} = ${frHTML(x, false)}` });
  const xn = x.n, xd = x.d, yn = isDiv ? b.d : y.n, yd = isDiv ? b.n : y.d;
  const g1 = gcd(xn, yd), g2 = gcd(yn, xd);
  let t = `分子どうし、分母どうしをかけます: ${fracHTML(`${xn} × ${yn}`, `${xd} × ${yd}`)}`;
  fs.push({ text: t });
  if (g1 > 1 || g2 > 1) fs.push({ text: `かける前に約分すると、計算が楽になります。${g1 > 1 ? `${xn} と ${yd} は ${g1} でわれます。` : ''}${g2 > 1 ? `${yn} と ${xd} は ${g2} でわれます。` : ''}<br>${fracHTML(`${xn / g1} × ${yn / g2}`, `${xd / g2} × ${yd / g1}`)}` });
  const res = isDiv ? a.div(b) : a.mul(b);
  fs.push({ text: `答えは ${frHTML(res, false)}${res.n > res.d && !res.isInt() ? ` (= ${frHTML(res, true)})` : ''} です。` });
  return fs;
}
GEN.fr_mul = () => {
  let a, b;
  if (rnd() < 0.25) { a = new Fr(ri(2, 9)); b = randFrac(); } else { a = randFrac({ mixed: true }); b = randFrac(); }
  const v = a.mul(b);
  return { html: binHTML(fTok(a), '*', fTok(b)), text: binText(fTok(a), '*', fTok(b)), slots: [slot(v, '', 'frac')], explain: () => frMulExplain(a, b, false) };
};
GEN.fr_div = () => {
  let a, b;
  if (rnd() < 0.25) { a = new Fr(ri(2, 9)); b = randFrac(); } else { a = randFrac({ mixed: true }); b = randFrac(); }
  const v = a.div(b);
  return { html: binHTML(fTok(a), '/', fTok(b)), text: binText(fTok(a), '/', fTok(b)), slots: [slot(v, '', 'frac')], explain: () => frMulExplain(a, b, true) };
};

// --- A3 まぜた計算 (式の木) ---
let opSeq = 0;
function parseExpr(tokens) {
  let i = 0;
  const peek = () => tokens[i];
  function primary() {
    const t = tokens[i++];
    if (t.k === '(') { const e = expr(); i++; e.paren = true; return e; }
    return { leaf: true, tok: t };
  }
  function term() {
    let l = primary();
    while (peek() && peek().k === 'op' && (peek().v === '*' || peek().v === '/')) { const o = tokens[i++]; l = { op: o.v, id: o.id, l, r: primary() }; }
    return l;
  }
  function expr() {
    let l = term();
    while (peek() && peek().k === 'op' && (peek().v === '+' || peek().v === '-')) { const o = tokens[i++]; l = { op: o.v, id: o.id, l, r: term() }; }
    return l;
  }
  return expr();
}
function nodeTokens(n, out = []) {
  if (n.leaf) { out.push(n.tok); return out; }
  if (n.paren) out.push({ k: '(' });
  nodeTokens(n.l, out); out.push({ k: 'op', v: n.op, id: n.id }); nodeTokens(n.r, out);
  if (n.paren) out.push({ k: ')' });
  return out;
}
function tokensHTML(ts) { return ts.map((t) => (t.k === 'num' ? numHTML(t) : t.k === 'op' ? ` ${OPS[t.v]} ` : t.k)).join(''); }
function tokensText(ts) { return ts.map((t) => (t.k === 'num' ? numText(t) : t.k === 'op' ? ` ${OPS[t.v]} ` : t.k)).join(''); }
function firstReducible(n) {
  if (n.leaf) return null;
  const l = firstReducible(n.l); if (l) return l;
  const r = firstReducible(n.r); if (r) return r;
  if (n.l.leaf && n.r.leaf) return n;
  return null;
}
function applyOp(op, a, b) { return op === '+' ? a.add(b) : op === '-' ? a.sub(b) : op === '*' ? a.mul(b) : a.div(b); }
function evalTree(n) { if (n.leaf) return n.tok.v; return applyOp(n.op, evalTree(n.l), evalTree(n.r)); }
function cloneTree(n) { return n.leaf ? { leaf: true, tok: { ...n.tok } } : { ...n, l: cloneTree(n.l), r: cloneTree(n.r) }; }
function replaceNode(root, target, repl) {
  if (root === target) return repl;
  if (root.leaf) return root;
  root.l = replaceNode(root.l, target, repl); root.r = replaceNode(root.r, target, repl);
  return root;
}
function exprSteps(tokens) {
  let tree = parseExpr(tokens);
  const frames = [];
  const reason = (n, tree) => {
    if (n.paren) return 'かっこの中を先に計算します';
    if (n.op === '*' || n.op === '/') return 'かけ算・わり算を、たし算・ひき算より先に計算します';
    return '左から順に計算します';
  };
  frames.push({ text: `計算の順番: ① かっこの中 → ② かけ算・わり算 → ③ たし算・ひき算 (同じなかまは左から)。<div class="expr">${tokensHTML(nodeTokens(tree))}</div>` });
  for (let guard = 0; guard < 8 && !tree.leaf; guard++) {
    const n = firstReducible(tree);
    const a = n.l.tok, b = n.r.tok;
    let notes = '';
    if ((a.kind === 'frac') !== (b.kind === 'frac') && (a.kind === 'dec' || b.kind === 'dec')) {
      const d = a.kind === 'dec' ? a : b;
      notes = `<br><small>小数と分数がまざっているので、小数を分数になおします: ${numHTML(d)} = ${frHTML(d.v, false)}</small>`;
    }
    const v = applyOp(n.op, a.v, b.v);
    const kind = (a.kind === 'frac' || b.kind === 'frac' || !v.terminating()) ? (v.isInt() ? 'int' : 'frac') : (v.isInt() ? 'int' : 'dec');
    const leaf = { leaf: true, tok: num(v, kind) };
    const txt = `${reason(n, tree)}: ${numHTML(a)} ${OPS[n.op]} ${numHTML(b)} = ${numHTML(leaf.tok)}${notes}`;
    tree = replaceNode(tree, n, leaf);
    frames.push({ text: `${txt}<div class="expr">${tokensHTML(nodeTokens(tree))}</div>` });
  }
  return { frames, value: tree.tok.v, kind: tree.tok.kind };
}
function mkOperand(kind) {
  if (kind === 'int') return num(String(ri(2, 9)), 'int');
  if (kind === 'dec') return num(pick(['0.2', '0.4', '0.5', '0.6', '0.8', '1.2', '1.5', '2.5', '0.25', '0.75', '1.25', '3.6', '2.4']), 'dec');
  const f = randFrac({ ds: [2, 3, 4, 5, 6, 8, 9, 10] });
  return num(f, 'frac');
}
const TEMPLATES = [
  ['a', '+', 'b', '*', 'c'],
  ['(', 'a', '-', 'b', ')', '/', 'c'],
  ['a', '*', 'b', '-', 'c', '/', 'd'],
  ['a', '/', 'b', '*', 'c'],
  ['a', '-', 'b', '*', 'c'],
  ['(', 'a', '+', 'b', ')', '*', 'c'],
  ['a', '+', 'b', '/', 'c', '-', 'd'],
];
function buildExpr(tpl) {
  for (let tries = 0; tries < 400; tries++) {
    const slots = {};
    const vars = tpl.filter((x) => /^[a-d]$/.test(x));
    const kinds = vars.map(() => pick(['int', 'dec', 'frac']));
    if (!(kinds.includes('frac') && (kinds.includes('dec') || kinds.includes('int')))) continue;
    vars.forEach((v, i) => { slots[v] = mkOperand(kinds[i]); });
    const tokens = tpl.map((x) => (/^[a-d]$/.test(x) ? slots[x] : x === '(' || x === ')' ? { k: x } : { k: 'op', v: x, id: ++opSeq }));
    // 途中の値がすべて正で、答えがほどよいか
    let ok = true;
    const tree = parseExpr(tokens);
    const check = (n) => { if (n.leaf) return n.tok.v; const v = applyOp(n.op, check(n.l), check(n.r)); if (v.n <= 0) ok = false; if (v.d > 60 || v.n > 400) ok = false; return v; };
    const v = check(tree);
    if (!ok) continue;
    if (v.d > 24) continue;
    return { tokens, value: v };
  }
  return null;
}
GEN.mix_calc = () => {
  let e = null;
  while (!e) e = buildExpr(pick(TEMPLATES));
  const st = exprSteps(e.tokens);
  return { html: `${tokensHTML(e.tokens)} =`, text: tokensText(e.tokens), slots: [slot(e.value, '', st.kind === 'frac' ? 'frac' : undefined)], note: '小数か分数で答えよう', explain: () => st.frames };
};
GEN.order = () => {
  let e = null;
  while (!e) e = buildExpr(pick(TEMPLATES.filter((t, i) => i !== 2)));
  const tree = parseExpr(e.tokens);
  const first = firstReducible(tree);
  // 選択肢: それぞれの記号と両どなりの数
  const toks = e.tokens;
  const choices = [];
  toks.forEach((t, i) => {
    if (t.k !== 'op') return;
    let L = i - 1; while (toks[L].k !== 'num') L--;
    let R = i + 1; while (toks[R].k !== 'num') R++;
    choices.push({ id: String(t.id), html: `${numHTML(toks[L])} ${OPS[t.v]} ${numHTML(toks[R])}`, text: `${numText(toks[L])} ${OPS[t.v]} ${numText(toks[R])}` });
  });
  const st = exprSteps(e.tokens);
  return { html: `<div class="expr">${tokensHTML(toks)}</div>`, text: tokensText(toks), lead: 'いちばん最初に計算するのはどこ？', choices, answerChoice: String(first.id), slots: [], explain: () => st.frames.slice(0, 2) };
};

// --- B 単位 ---
const UNIT_PAIRS = [
  // [大きい単位, 小さい単位, 比, ファミリー, 説明]
  ['cm', 'mm', 10, 'len'], ['m', 'cm', 100, 'len'], ['km', 'm', 1000, 'len'], ['m', 'mm', 1000, 'len'],
  ['kg', 'g', 1000, 'wt'], ['t', 'kg', 1000, 'wt'],
  ['dL', 'mL', 100, 'vol'], ['L', 'dL', 10, 'vol'], ['L', 'mL', 1000, 'vol'], ['L', 'cm³', 1000, 'vol'], ['m³', 'L', 1000, 'vol'], ['m³', 'cm³', 1000000, 'vol'],
  ['m²', 'cm²', 10000, 'area'], ['a', 'm²', 100, 'area'], ['ha', 'a', 100, 'area'], ['km²', 'ha', 100, 'area'], ['ha', 'm²', 10000, 'area'],
  ['分', '秒', 60, 'time'], ['時間', '分', 60, 'time'], ['日', '時間', 24, 'time'],
];
function unitWhy(big, small, ratio) {
  if (big === 'm²' && small === 'cm²') return '1 m = 100 cm なので、1 m² (1辺 1 m の正方形) = 100 cm × 100 cm = 10000 cm²';
  if (big === 'ha' && small === 'm²') return '1 ha は 1辺 100 m の正方形の面積なので、100 m × 100 m = 10000 m²';
  if (big === 'a') return '1 a は 1辺 10 m の正方形の面積なので、10 m × 10 m = 100 m²';
  if (big === 'ha') return '1 ha は 1辺 100 m の正方形、1 a は 1辺 10 m の正方形。1 ha = 100 a';
  if (big === 'km²') return '1 km² は 1辺 1000 m の正方形。1 ha は 1辺 100 m の正方形なので、たて 10 こ × よこ 10 こ = 100 ha';
  if (big === 'm³' && small === 'cm³') return '1 m = 100 cm なので、1 m³ = 100 cm × 100 cm × 100 cm = 1000000 cm³';
  if (big === 'm³' && small === 'L') return '1 L = 1000 cm³、1 m³ = 1000000 cm³ なので、1 m³ = 1000 L';
  if (big === 'L' && small === 'cm³') return '1 L は 1辺 10 cm の立方体の体積なので、10 cm × 10 cm × 10 cm = 1000 cm³';
  return `1 ${big} = ${ratio} ${small}`;
}
const niceDec = (maxPlaces) => fmtScaled(ri(1, 999), ri(0, maxPlaces));
GEN.conv = () => {
  const [big, small, ratio, fam] = pick(UNIT_PAIRS);
  let L, S;
  for (let tries = 0; tries < 300; tries++) {
    if (fam === 'time') {
      L = Fr.dec(pick(['1', '2', '3', '1.5', '2.5', '0.5', '0.25', '0.75', '1.2', '2.4', '0.1', '4', '5']));
    } else {
      L = Fr.dec(niceDec(2));
    }
    S = L.mul(ratio);
    if (S.decPlaces() > 1 || (fam === 'time' && !S.isInt())) continue;
    if (S.val() > 2000000) continue;
    if (L.val() > 500) continue;
    break;
  }
  const toSmall = rnd() < 0.5;
  const Ls = ansText(L), Ss = ansText(S);
  const html = toSmall ? `${Ls} ${big} = <b class="box">□</b> ${small}` : `${Ss} ${small} = <b class="box">□</b> ${big}`;
  const text = toSmall ? `${Ls} ${big} = □ ${small}` : `${Ss} ${small} = □ ${big}`;
  const frames = [
    { text: unitWhy(big, small, ratio) + '。' },
    toSmall
      ? { text: `大きい単位 → 小さい単位 なので、数は大きくなります。${Ls} × ${ratio} = ${Ss}${ratio % 10 === 0 && String(ratio).replace(/0/g, '') === '1' ? `<br><small>× ${ratio} は、小数点を右に ${String(ratio).length - 1} つ動かすのと同じです。</small>` : ''}` }
      : { text: `小さい単位 → 大きい単位 なので、数は小さくなります。${Ss} ÷ ${ratio} = ${ansText(L)}${ratio % 10 === 0 && String(ratio).replace(/0/g, '') === '1' ? `<br><small>÷ ${ratio} は、小数点を左に ${String(ratio).length - 1} つ動かすのと同じです。</small>` : ''}` },
  ];
  return { html, text, slots: [toSmall ? slot(S, small) : slot(L, big)], explain: () => frames };
};
GEN.time_mix = () => {
  const v = ri(0, 3);
  if (v === 0) {
    const h = ri(1, 3), m = ri(1, 11) * 5;
    return { html: `${h}時間${m}分 = <b class="box">□</b> 分`, text: `${h}時間${m}分 = □分`, slots: [slot(h * 60 + m, '分')], explain: () => textFrames('1時間 = 60分 です。', `${h}時間 = 60 × ${h} = ${h * 60}分。${h * 60} + ${m} = ${h * 60 + m}分`) };
  }
  if (v === 1) {
    const M = ri(65, 250); const h = Math.floor(M / 60), m = M % 60;
    if (m === 0) return GEN.time_mix();
    return { html: `${M}分 = <b class="box">□</b> 時間 <b class="box">□</b> 分`, text: `${M}分 = □時間□分`, slots: [slot(h, '時間'), slot(m, '分')], explain: () => textFrames('60分で 1時間 です。', `${M} ÷ 60 = ${h} あまり ${m}。だから ${h}時間${m}分`) };
  }
  if (v === 2) {
    const h = ri(0, 3), m = pick([6, 12, 15, 18, 24, 30, 36, 42, 45, 48, 54]);
    const val = new Fr(h * 60 + m, 60);
    const left = h ? `${h}時間${m}分` : `${m}分`;
    return { html: `${left} = <b class="box">□</b> 時間`, text: `${left} = □時間`, slots: [slot(val, '時間')], note: '小数か分数で答えよう', explain: () => textFrames('1分は 1時間の 1/60 です。', `${m}分 = ${fracHTML(m, 60)} 時間 = ${frHTML(new Fr(m, 60), false)} 時間${new Fr(m, 60).terminating() ? ` = ${new Fr(m, 60).toDec()} 時間` : ''}`, `だから ${left} = ${ansHTML(val)} 時間${val.terminating() ? '' : ` (${frHTML(val, false)} でも正解)`}`) };
  }
  const mi = ri(1, 5), s = ri(1, 11) * 5;
  return { html: `${mi}分${s}秒 = <b class="box">□</b> 秒`, text: `${mi}分${s}秒 = □秒`, slots: [slot(mi * 60 + s, '秒')], explain: () => textFrames('1分 = 60秒 です。', `${mi}分 = ${mi * 60}秒。${mi * 60} + ${s} = ${mi * 60 + s}秒`) };
};
GEN.len_mix = () => {
  const v = ri(0, 3);
  if (v === 0 || v === 1) {
    const add = v === 0;
    let a1, a2, b1, b2;
    do { a1 = ri(1, 9); a2 = ri(5, 95); b1 = ri(1, 5); b2 = ri(5, 95); } while (add ? a2 + b2 < 100 && rnd() < 0.6 : (a1 * 100 + a2) <= (b1 * 100 + b2) || (a2 >= b2 && rnd() < 0.6));
    const tot = add ? (a1 * 100 + a2) + (b1 * 100 + b2) : (a1 * 100 + a2) - (b1 * 100 + b2);
    const m = Math.floor(tot / 100), c = tot % 100;
    const op = add ? '+' : '−';
    const fr = add
      ? textFrames('m は m どうし、cm は cm どうし計算します。', `cm: ${a2} + ${b2} = ${a2 + b2} cm${a2 + b2 >= 100 ? `。100 cm = 1 m なので、1 m くり上げて ${a2 + b2 - 100} cm` : ''}`, `m: ${a1} + ${b1}${a2 + b2 >= 100 ? ' + 1' : ''} = ${m} m。答えは ${m} m ${c} cm`)
      : textFrames('m は m どうし、cm は cm どうし計算します。', a2 >= b2 ? `cm: ${a2} − ${b2} = ${c} cm` : `cm: ${a2} − ${b2} はひけないので、1 m (= 100 cm) をかりて ${a2 + 100} − ${b2} = ${c} cm`, `m: ${a1}${a2 >= b2 ? '' : ' − 1'} − ${b1} = ${m} m。答えは ${m} m ${c} cm`);
    return { html: `${a1} m ${a2} cm ${op} ${b1} m ${b2} cm = <b class="box">□</b> m <b class="box">□</b> cm`, text: `${a1}m${a2}cm ${op} ${b1}m${b2}cm`, slots: [slot(m, 'm'), slot(c, 'cm')], explain: () => fr };
  }
  if (v === 2) {
    const [big, small, ratio] = pick([['kg', 'g', 1000], ['km', 'm', 1000], ['L', 'mL', 1000], ['m', 'cm', 100]]);
    const a = ri(1, 9), b = ratio === 1000 ? pick([ri(1, 9) * 100, ri(1, 99) * 10, ri(1, 999), 50, 5]) : ri(1, 99);
    const val = new Fr(a * ratio + b, ratio);
    return { html: `${a} ${big} ${b} ${small} = <b class="box">□</b> ${big}`, text: `${a}${big}${b}${small} = □${big}`, slots: [slot(val, big)], explain: () => textFrames(`1 ${big} = ${ratio} ${small} なので、${b} ${small} = ${b} ÷ ${ratio} = ${new Fr(b, ratio).toDec()} ${big}`, `${a} + ${new Fr(b, ratio).toDec()} = ${val.toDec()} ${big}`) };
  }
  const L = ri(1, 9), d = ri(1, 9);
  return { html: `${L} L ${d} dL = <b class="box">□</b> dL`, text: `${L}L${d}dL = □dL`, slots: [slot(L * 10 + d, 'dL')], explain: () => textFrames('1 L = 10 dL です。', `${L} L = ${L * 10} dL。${L * 10} + ${d} = ${L * 10 + d} dL`) };
};
GEN.speed_conv = () => {
  const v = ri(0, 4);
  if (v === 0) { const X = ri(2, 30) * 3; const ans = new Fr(X * 1000, 60); if (!ans.isInt()) return GEN.speed_conv();
    return { html: `時速 ${X} km = 分速 <b class="box">□</b> m`, text: `時速${X}km = 分速□m`, slots: [slot(ans, 'm')], explain: () => textFrames(`時速 ${X} km は、1時間 (60分) に ${X} km = ${X * 1000} m 進む速さです。`, `1分あたりにすると、${X * 1000} ÷ 60 = ${ans.n} m。分速 ${ans.n} m`) }; }
  if (v === 1) { const Y = ri(2, 30) * 30; const ans = new Fr(Y, 60);
    return { html: `分速 ${Y} m = 秒速 <b class="box">□</b> m`, text: `分速${Y}m = 秒速□m`, slots: [slot(ans, 'm')], explain: () => textFrames(`分速 ${Y} m は、1分 (60秒) に ${Y} m 進む速さです。`, `1秒あたりにすると、${Y} ÷ 60 = ${ans.toDec()} m`) }; }
  if (v === 2) { const Z = ri(2, 30); const ans = new Fr(Z * 3600, 1000);
    return { html: `秒速 ${Z} m = 時速 <b class="box">□</b> km`, text: `秒速${Z}m = 時速□km`, slots: [slot(ans, 'km')], explain: () => textFrames(`1時間 = 60分 = 3600秒 です。`, `1時間に進むのは ${Z} × 3600 = ${Z * 3600} m。`, `${Z * 3600} m = ${ans.toDec()} km。時速 ${ans.toDec()} km`) }; }
  if (v === 3) { const Y = ri(1, 20) * 50; const ans = new Fr(Y * 60, 1000);
    return { html: `分速 ${Y} m = 時速 <b class="box">□</b> km`, text: `分速${Y}m = 時速□km`, slots: [slot(ans, 'km')], explain: () => textFrames('1時間 = 60分 です。', `1時間に進むのは ${Y} × 60 = ${Y * 60} m。`, `${Y * 60} m = ${ans.toDec()} km。時速 ${ans.toDec()} km`) }; }
  const X = ri(1, 6) * 18; const ans = new Fr(X * 1000, 3600);
  return { html: `時速 ${X} km = 秒速 <b class="box">□</b> m`, text: `時速${X}km = 秒速□m`, slots: [slot(ans, 'm')], explain: () => textFrames(`時速 ${X} km は、1時間 (3600秒) に ${X * 1000} m 進む速さです。`, `1秒あたりにすると、${X * 1000} ÷ 3600 = ${ans.toDec()} m。秒速 ${ans.toDec()} m`) };
};
function minText(M) { const h = Math.floor(M / 60), m = M % 60; return h && m ? `${h}時間${m}分` : h ? `${h}時間` : `${m}分`; }
GEN.speed = () => {
  const v = ri(0, 3);
  if (v === 0) {
    let S, M, D;
    do { S = ri(4, 20) * 5; M = pick([20, 30, 40, 45, 90, 100, 150, 75, 80]); D = new Fr(S * M, 60); } while (D.decPlaces() > 1);
    const H = new Fr(M, 60);
    return { html: `時速 ${S} km で ${minText(M)} 進むと、道のりは <b class="box">□</b> km`, text: `時速${S}kmで${minText(M)} → □km`, slots: [slot(D, 'km')], explain: () => textFrames('道のり = 速さ × 時間 です。', `速さが「時速」なので、時間を「時間」の単位にそろえます: ${minText(M)} = ${frHTML(H, false)} 時間${H.terminating() ? ` = ${H.toDec()} 時間` : ''}`, `${S} × ${frHTML(H, false)} = ${D.toDec()} km`) };
  }
  if (v === 1) {
    let V, D, T;
    do { V = ri(5, 20) * 5; T = ri(8, 40); D = new Fr(V * T, 1000); } while (D.decPlaces() > 2);
    return { html: `${D.toDec()} km の道のりを 分速 ${V} m で歩くと、<b class="box">□</b> 分かかる`, text: `${D.toDec()}km を分速${V}m → □分`, slots: [slot(T, '分')], explain: () => textFrames('時間 = 道のり ÷ 速さ です。', `速さが「m」なので、道のりも m にそろえます: ${D.toDec()} km = ${V * T} m`, `${V * T} ÷ ${V} = ${T} 分`) };
  }
  if (v === 2) {
    let D, T, S;
    do { T = pick([20, 30, 40, 45, 15, 90, 120]); S = ri(3, 18) * 5; D = new Fr(S * T, 60); } while (D.decPlaces() > 1);
    return { html: `${D.toDec()} km を ${minText(T)} で走る車の速さは、時速 <b class="box">□</b> km`, text: `${D.toDec()}kmを${minText(T)} → 時速□km`, slots: [slot(S, 'km')], explain: () => textFrames('速さ = 道のり ÷ 時間 です。', `時速を求めるので、時間を「時間」の単位にそろえます: ${minText(T)} = ${frHTML(new Fr(T, 60), false)} 時間`, `${D.toDec()} ÷ ${frHTML(new Fr(T, 60), false)} = ${S}。時速 ${S} km`, `<small>別の考え方: ${minText(T)}で ${D.toDec()} km → 60分では ${D.toDec()} × 60 ÷ ${T} = ${S} km</small>`) };
  }
  let V, T, D;
  do { V = ri(3, 20) * 10; T = ri(5, 45); D = new Fr(V * T, 1000); } while (D.decPlaces() > 2);
  return { html: `分速 ${V} m で ${T} 分 進むと、道のりは <b class="box">□</b> km`, text: `分速${V}mで${T}分 → □km`, slots: [slot(D, 'km')], explain: () => textFrames('道のり = 速さ × 時間 です。', `${V} × ${T} = ${V * T} m`, `答えは km なので、${V * T} m = ${D.toDec()} km`) };
};
GEN.per_unit = () => {
  const v = ri(0, 2);
  if (v === 0) { const N = pick(['2', '3', '4', '5', '6', '1.5', '2.5', '0.8']); const u = ri(3, 30) * 10; const P = Fr.dec(N).mul(u); if (!P.isInt()) return GEN.per_unit();
    return { html: `${N} m で ${P.n} 円のリボン。1 m あたりのねだんは <b class="box">□</b> 円`, text: `${N}mで${P.n}円 → 1mあたり□円`, slots: [slot(u, '円')], explain: () => textFrames('1あたりの量 = 全体の量 ÷ いくつ分 です。', `${P.n} ÷ ${N} = ${u} 円`) }; }
  if (v === 1) { const A = ri(4, 40); const dns = ri(5, 90) * 10; const B = A * dns;
    return { html: `面積 ${A} km² の町に ${B} 人が住んでいます。人口密度 (1 km² あたりの人数) は <b class="box">□</b> 人`, text: `${A}km²に${B}人 → 人口密度□人`, slots: [slot(dns, '人')], explain: () => textFrames('人口密度 = 人数 ÷ 面積 (km²) です。', `${B} ÷ ${A} = ${dns} 人`) }; }
  const L = ri(5, 40); const k = ri(8, 25); const D = L * k;
  return { html: `ガソリン ${L} L で ${D} km 走る車。1 L あたり <b class="box">□</b> km 走る`, text: `${L}Lで${D}km → 1Lあたり□km`, slots: [slot(k, 'km')], explain: () => textFrames('1 L あたりの道のり = 道のり ÷ ガソリンの量 です。', `${D} ÷ ${L} = ${k} km`) };
};
GEN.per_total = () => {
  const v = ri(0, 1);
  if (v === 0) { const u = ri(4, 40) * 5; const N = pick(['2.4', '3.5', '1.2', '0.6', '4', '2.5', '1.8']); const P = Fr.dec(N).mul(u); if (!P.isInt()) return GEN.per_total();
    return { html: `1 m あたり ${u} 円のロープを ${N} m 買うと、代金は <b class="box">□</b> 円`, text: `1mあたり${u}円 × ${N}m → □円`, slots: [slot(P, '円')], explain: () => textFrames('全体の量 = 1あたりの量 × いくつ分 です。', `${u} × ${N} = ${P.n} 円`) }; }
  const u = ri(4, 40) * 5; const N = pick(['2.4', '3.5', '1.2', '0.6', '4', '2.5', '1.8', '6']); const P = Fr.dec(N).mul(u); if (!P.isInt()) return GEN.per_total();
  return { html: `1 m あたり ${u} 円のロープを ${P.n} 円分買うと、長さは <b class="box">□</b> m`, text: `1mあたり${u}円で${P.n}円分 → □m`, slots: [slot(Fr.dec(N), 'm')], explain: () => textFrames('いくつ分 = 全体の量 ÷ 1あたりの量 です。', `${P.n} ÷ ${u} = ${N} m`) };
};
GEN.compare = () => {
  const v = ri(0, 1);
  if (v === 0) {
    let a1, p1, a2, p2, r1, r2;
    do { a1 = ri(6, 15); p1 = ri(3, 12); a2 = ri(6, 15); p2 = ri(3, 12); r1 = new Fr(p1, a1); r2 = new Fr(p2, a2); } while (Math.abs(r1.val() - r2.val()) < 0.02 || a1 === a2 || p1 === p2);
    const ans = r1.cmp(r2) > 0 ? 'A' : 'B';
    const fmtR = (r) => (r.decPlaces() <= 3 ? r.toDec() : (Math.floor(r.val() * 1000) / 1000).toFixed(3) + '…');
    const d1 = fmtR(r1), d2 = fmtR(r2);
    return { html: `A の部屋: ${a1} m² に ${p1} 人<br>B の部屋: ${a2} m² に ${p2} 人`, text: `A:${a1}m²に${p1}人 / B:${a2}m²に${p2}人`, lead: 'こんでいるのはどちら？', choices: [{ id: 'A', html: 'A の部屋' }, { id: 'B', html: 'B の部屋' }], answerChoice: ans, slots: [], explain: () => textFrames('面積も人数もちがうので、「1 m² あたりの人数」にそろえてくらべます。', `A: ${p1} ÷ ${a1} = ${d1} 人<br>B: ${p2} ÷ ${a2} = ${d2} 人`, `1 m² あたりの人数が多い ${ans} のほうがこんでいます。<br><small>「1人あたりの面積」でくらべることもできます。その場合は、面積が小さいほうがこんでいます。</small>`) };
  }
  let n1, y1, n2, y2, r1, r2;
  do { n1 = ri(2, 6); n2 = ri(2, 8); y1 = n1 * ri(30, 120); y2 = n2 * ri(30, 120); r1 = new Fr(y1, n1); r2 = new Fr(y2, n2); } while (r1.cmp(r2) === 0 || n1 === n2);
  const ans = r1.cmp(r2) < 0 ? 'A' : 'B';
  return { html: `A: えんぴつ ${n1} 本で ${y1} 円<br>B: えんぴつ ${n2} 本で ${y2} 円`, text: `A:${n1}本${y1}円 / B:${n2}本${y2}円`, lead: '1本あたりが安いのはどちら？', choices: [{ id: 'A', html: 'A' }, { id: 'B', html: 'B' }], answerChoice: ans, slots: [], explain: () => textFrames('本数がちがうので、「1本あたりのねだん」にそろえてくらべます。', `A: ${y1} ÷ ${n1} = ${r1.n} 円<br>B: ${y2} ÷ ${n2} = ${r2.n} 円`, `1本あたりが安いのは ${ans} です。`) };
};

function makeProblem(type, level) {
  const p = GEN[type](level);
  p.type = type; p.stage = stageOfType(type); p.level = STAGES[p.stage].levels ? level : null;
  p.answerText = p.choices ? (p.choices.find((c) => c.id === p.answerChoice).text || p.choices.find((c) => c.id === p.answerChoice).html)
    : p.slots.map((s) => `${ansText(s.value, s.prefer)}${s.unit ? ' ' + s.unit : ''}`).join(' ');
  p.answerHTML = p.choices ? p.choices.find((c) => c.id === p.answerChoice).html
    : p.slots.map((s) => `${ansHTML(s.value, s.prefer)}${s.unit ? ' ' + s.unit : ''}`).join(' ');
  return p;
}

if (typeof module !== 'undefined') module.exports = { Fr, GEN, makeProblem, STAGES, TRACKS, LEVEL_RAMP, levelTypes, judgeSlot, parseAnswer, addSubFrames, mulFrames, divFrames, exprSteps, gridHTML, setRnd: (f) => { rnd = f; } };
