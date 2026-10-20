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

// ===== 図: 数直線・面積図・二本の数直線・テープ図・表・式の木 =====
// どの解説にも、構造が目で見える図を1つ以上つける。色は CSS のクラスで決める (ダークモード対応)
const r1 = (v) => Math.round(v * 10) / 10;
function svgText(x, y, s, cls = '', anchor = 'middle') { return `<text x="${r1(x)}" y="${r1(y)}" text-anchor="${anchor}"${cls ? ` class="${cls}"` : ''}>${esc(s)}</text>`; }
function svgBox(w, h, body, label) { return `<svg class="figsvg" viewBox="0 0 ${w} ${h}" style="max-width:${w}px" role="img" aria-label="${esc(label)}">${body}</svg>`; }
// 数の表示 (分数は 2/3、小数はそのまま)
function fv(v) { const f = Fr.of(v); return f.isInt() ? String(f.n) : f.terminating() ? f.toDec() : frText(f, false); }
function niceStep(range, target) { const raw = range / target; const p = 10 ** Math.floor(Math.log10(raw)); const m = raw / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; }
// 弧の矢印 (xa → xb)。up=true なら線の上、false なら下
function arcArrow(xa, xb, y, h, cls = 'ac', up = true) {
  const s = up ? -1 : 1; const xm = (xa + xb) / 2; const yc = y + s * 2 * h;
  let p = `<path class="${cls}" d="M${r1(xa)} ${r1(y)} Q${r1(xm)} ${r1(yc)} ${r1(xb)} ${r1(y)}"/>`;
  const dx = xb - xm, dy = y - yc, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  for (const a of [0.45, -0.45]) {
    const bx = -(ux * Math.cos(a) - uy * Math.sin(a)) * 8, by = -(ux * Math.sin(a) + uy * Math.cos(a)) * 8;
    p += `<path class="${cls}" d="M${r1(xb)} ${r1(y)} l${r1(bx)} ${r1(by)}"/>`;
  }
  return p;
}
// 数直線: marks = [{v, s, cls}] 目盛りと数, jumps = [{a, b, s}] 弧の矢印
function figNumberLine(o) {
  const W = 540, x0 = 34, x1 = W - 34;
  const jumps = o.jumps || [];
  const X = (v) => x0 + (x1 - x0) * (v - o.min) / (o.max - o.min);
  const hs = jumps.map((j, i) => { const w = Math.abs(X(j.b) - X(j.a)); return Math.min(70, Math.max(18, w * 0.35)) + (w < 130 && i % 2 ? 28 : 0); });
  const base = jumps.length ? Math.max(...hs) + 34 : 28;
  let b = `<line class="ln" x1="${x0 - 12}" y1="${base}" x2="${x1 + 16}" y2="${base}"/><path class="ln" d="M${x1 + 9} ${base - 5} L${x1 + 16} ${base} L${x1 + 9} ${base + 5}"/>`;
  const step = niceStep(o.max - o.min, 20);
  for (let k = Math.ceil(o.min / step - 1e-9); k * step <= o.max + 1e-9; k++) { const x = X(k * step); b += `<line class="ln2" x1="${r1(x)}" y1="${base - 4}" x2="${r1(x)}" y2="${base + 4}"/>`; }
  const marks = (o.marks || []).slice().sort((p, q) => p.v - q.v);
  let last = [-1e9, -1e9]; let rows = 1;
  marks.forEach((m) => {
    const x = X(m.v); const w = String(m.s).length * 8 + 10;
    const row = x - last[0] >= w ? 0 : x - last[1] >= w ? 1 : 0;
    last[row] = x; rows = Math.max(rows, row + 1);
    b += `<line class="${m.cls === 'm' ? 'ac' : 'ln'}" x1="${r1(x)}" y1="${base - 8}" x2="${r1(x)}" y2="${base + 8 + row * 20}"/>` + svgText(x, base + 24 + row * 20, m.s, m.cls || '');
  });
  jumps.forEach((j, i) => {
    const xa = X(j.a), xb = X(j.b);
    b += arcArrow(xa, xb, base - 2, hs[i], 'ac', true) + svgText((xa + xb) / 2, base - 2 - hs[i] - 6, j.s, 'm');
  });
  if (o.unit) b += svgText(x1 + 16, base + 24, o.unit, 's', 'end');
  return svgBox(W, base + 34 + rows * 20, b, o.label || '数直線');
}
// 面積図: たて rows × よこ cols の長方形を分ける。cells[r][c] = {s, cls}
function figArea(o) {
  const W = 540, x0 = 96, TW = 400, y0 = 40;
  const TH = o.rows.length > 1 ? 170 : 96;
  const norm = (arr, key, min) => { const sum = arr.reduce((a, x) => a + Math.abs(x[key] || 1), 0); let w = arr.map((x) => Math.max(Math.abs(x[key] || 1) / sum, min)); const s2 = w.reduce((a, b) => a + b, 0); return w.map((x) => x / s2); };
  const ws = norm(o.cols, 'w', Math.min(0.2, 0.9 / o.cols.length)), hs = norm(o.rows, 'h', Math.min(0.28, 0.9 / o.rows.length));
  let b = ''; let x = x0;
  const xs = ws.map((w) => { const a = x; x += w * TW; return [a, w * TW]; });
  let y = y0;
  const ys = hs.map((h) => { const a = y; y += h * TH; return [a, h * TH]; });
  ys.forEach(([yy, hh], r) => xs.forEach(([xx, ww], c) => {
    const cell = (o.cells[r] || [])[c] || { s: '' };
    b += `<rect class="${cell.cls || 'bx'}" x="${r1(xx)}" y="${r1(yy)}" width="${r1(ww)}" height="${r1(hh)}"/>` + svgText(xx + ww / 2, yy + hh / 2 + 5, cell.s, 'b');
  }));
  xs.forEach(([xx, ww], c) => { b += svgText(xx + ww / 2, y0 - 10, o.cols[c].s, o.cols[c].cls || ''); });
  ys.forEach(([yy, hh], r) => { b += svgText(x0 - 10, yy + hh / 2 + 5, o.rows[r].s, o.rows[r].cls || '', 'end'); });
  if (o.topNote) b += svgText(x0 + TW, 14, o.topNote, 's', 'end');
  if (o.leftNote) b += svgText(8, y0 + TH + 22, o.leftNote, 's', 'start');
  return svgBox(W, y0 + TH + (o.leftNote ? 30 : 12), b, o.label || '面積図');
}
// 二本の数直線: cols = [{pos, t, b, ut, ub}] (ut/ub: その数が □)。arrows = [{from, to, s, side}]
function figDoubleLine(o) {
  const W = 540, x0 = 104, x1 = W - 52, yT = 84, yB = 144;
  const cols = o.cols.slice().sort((p, q) => p.pos - q.pos);
  const max = Math.max(...cols.map((c) => c.pos)) || 1;
  let px = cols.map((c) => c.pos / max);
  for (let i = 1; i < px.length; i++) if (px[i] - px[i - 1] < 0.16) { px = cols.map((c, k) => k / (cols.length - 1)); break; }
  const X = (i) => x0 + (x1 - x0) * px[i];
  let b = `<line class="ln" x1="${x0}" y1="${yT}" x2="${x1 + 8}" y2="${yT}"/><line class="ln" x1="${x0}" y1="${yB}" x2="${x1 + 8}" y2="${yB}"/>`;
  b += svgText(10, yT + 5, o.top, 's', 'start') + svgText(10, yB + 5, o.bot, 's', 'start');
  cols.forEach((c, i) => {
    const x = X(i);
    b += `<line class="ln" x1="${r1(x)}" y1="${yT - 6}" x2="${r1(x)}" y2="${yT + 6}"/><line class="ln" x1="${r1(x)}" y1="${yB - 6}" x2="${r1(x)}" y2="${yB + 6}"/><line class="dash" x1="${r1(x)}" y1="${yT + 8}" x2="${r1(x)}" y2="${yB - 8}"/>`;
    b += svgText(x, yT - 12, c.ut ? '□' : c.t, c.ut ? 'm big' : 'b') + svgText(x, yB + 24, c.ub ? '□' : c.b, c.ub ? 'm big' : 'b');
  });
  const idx = (pos) => cols.findIndex((c) => c.pos === pos);
  (o.arrows || []).forEach((a) => {
    const i = idx(a.from), j = idx(a.to); if (i < 0 || j < 0) return;
    const up = a.side !== 'bot'; const y = up ? yT - 30 : yB + 32; const h = 14;
    b += arcArrow(X(i), X(j), y, h, 'ac', up) + svgText((X(i) + X(j)) / 2, up ? y - h - 6 : y + h + 16, a.s, 'm');
  });
  return svgBox(W, yB + 70, b, o.label || '二本の数直線');
}
// テープ図 (分数): rows = [{f, d, s, cls}] f を、1 を d こに分けた目もりで表す
function figFracBars(rows) {
  const W = 540, x0 = 128, maxW = Math.max(1, ...rows.map((r) => Math.ceil(r.f.val() - 1e-9)));
  const U = 380 / maxW; const RH = 24, G = 16;
  let b = ''; let y = 14;
  rows.forEach((r) => {
    const whole = Math.max(1, Math.ceil(r.f.val() - 1e-9)); const n = Math.round(r.f.val() * r.d);
    for (let i = 0; i < n; i++) b += `<rect class="${r.cls || 'sh'}" x="${r1(x0 + i * U / r.d)}" y="${y}" width="${r1(U / r.d)}" height="${RH}"/>`;
    if (U / r.d >= 5) for (let i = 1; i < whole * r.d; i++) if (i % r.d) b += `<line class="ln2" x1="${r1(x0 + i * U / r.d)}" y1="${y}" x2="${r1(x0 + i * U / r.d)}" y2="${y + RH}"/>`;
    for (let w = 0; w < whole; w++) b += `<rect class="frame" x="${r1(x0 + w * U)}" y="${y}" width="${r1(U)}" height="${RH}"/>`;
    b += svgText(x0 - 10, y + RH / 2 + 5, r.s, r.lcls || '', 'end');
    y += RH + G;
  });
  for (let w = 0; w <= maxW; w++) b += svgText(x0 + w * U, y + 4, String(w), 's');
  return svgBox(W, y + 14, b, 'テープ図');
}
// 分数のかけ算の面積図: 1 の正方形を たて a.d、よこ b.d に分ける
function figFracArea(a, b) {
  const S = 200, x0 = 190, y0 = 34;
  let s = '';
  for (let r = 0; r < a.d; r++) for (let c = 0; c < b.d; c++) {
    const inA = r < a.n, inB = c < b.n;
    s += `<rect class="${inA && inB ? 'both' : inA ? 'sh' : inB ? 'sh3' : 'bx'}" x="${r1(x0 + c * S / b.d)}" y="${r1(y0 + r * S / a.d)}" width="${r1(S / b.d)}" height="${r1(S / a.d)}"/>`;
  }
  s += `<rect class="frame" x="${x0}" y="${y0}" width="${S}" height="${S}"/>`;
  s += svgText(x0 + S / 2, y0 - 12, `よこ: ${b.n}/${b.d}`, 'b') + svgText(x0 - 12, y0 + S / 2 + 5, `たて: ${a.n}/${a.d}`, 'b', 'end');
  s += svgText(x0 + S + 14, y0 + 16, '1 m²', 's', 'start');
  return svgBox(540, y0 + S + 16, s, '分数のかけ算の面積図');
}
// 横の棒グラフ: items = [{s, v, label}]
function figBars(items, unit = '') {
  const W = 540, x0 = 90, TW = 320; const max = Math.max(...items.map((x) => x.v)) || 1;
  let b = ''; let y = 12;
  items.forEach((it) => { const w = TW * it.v / max; b += `<rect class="${it.cls || 'sh'}" x="${x0}" y="${y}" width="${r1(w)}" height="26"/>` + svgText(x0 - 10, y + 18, it.s, 'b', 'end') + svgText(x0 + w + 8, y + 18, it.label + unit, '', 'start'); y += 40; });
  return svgBox(W, y, b, '棒グラフ');
}
// 表 (マトリクス)
function figTable(head, rows, o = {}) {
  let h = `<table class="pv mx">`;
  if (head && head.length) h += `<tr>${head.map((x, i) => `<th${o.hlCol === i ? ' class="hlc"' : ''}>${x}</th>`).join('')}</tr>`;
  rows.forEach((r, ri2) => { h += `<tr${o.sumRow === ri2 ? ' class="sum"' : ''}>${r.map((x, i) => (i === 0 && o.rowHead !== false ? `<th>${x}</th>` : `<td${(o.hlCells || []).some(([a, c]) => a === ri2 && c === i) ? ' class="carry"' : ''}>${x}</td>`)).join('')}</tr>`; });
  return h + '</table>';
}
// 式の木: 数を上に、計算 (○) を下に。hl の計算が次にすること
function figTree(tree, hl, leafText) {
  const leaves = []; const ht = (n) => (n.leaf ? 0 : 1 + Math.max(ht(n.l), ht(n.r)));
  const H = ht(tree);
  const pos = new Map();
  const lay = (n) => {
    if (n.leaf) { const x = 50 + leaves.length * 92; leaves.push(n); pos.set(n, [x, 26]); return x; }
    const xl = lay(n.l), xr = lay(n.r); const x = (xl + xr) / 2; pos.set(n, [x, 26 + ht(n) * 62]); return x;
  };
  lay(tree);
  const W = Math.max(540, 50 + leaves.length * 92);
  let b = '';
  const draw = (n) => {
    if (n.leaf) return;
    const [x, y] = pos.get(n);
    for (const c of [n.l, n.r]) { const [cx, cy] = pos.get(c); b += `<line class="ln2" x1="${r1(cx)}" y1="${r1(cy + 14)}" x2="${r1(x)}" y2="${r1(y - 16)}"/>`; draw(c); }
  };
  draw(tree);
  pos.forEach(([x, y], n) => {
    if (n.leaf) { const s = leafText(n.tok); const w = s.length * 9 + 18; b += `<rect class="bx" x="${r1(x - w / 2)}" y="${y - 14}" width="${w}" height="28" rx="6"/>` + svgText(x, y + 5, s, 'b'); }
    else b += `<circle class="${n === hl ? 'sh2' : 'bx'}" cx="${r1(x)}" cy="${y}" r="16"/>` + svgText(x, y + 5, OPS[n.op], n === hl ? 'b' : '') + (n.paren ? svgText(x + 22, y + 5, '( )', 's', 'start') : '');
  });
  if (!tree.leaf && hl) { const [x, y] = pos.get(hl); b += svgText(x, y + 34, 'つぎ', 'm'); }
  return svgBox(W, 26 + H * 62 + 40, b, '計算の順番の木');
}
// 単位の位取り表: big 単位の値 V を、位ごとの単位に並べる (ratio は 10 のべき)
function figUnitPlace(big, small, ratio, V) {
  const k = Math.round(Math.log10(ratio));
  const S = V.toDec(); const { ip, fp } = splitDec(S);
  const pMax = Math.max(0, ip.replace(/^0+/, '').length - 1); const pMin = -Math.max(k, fp.length);
  const head = []; const row = [];
  for (let p = pMax; p >= pMin; p--) {
    head.push(p >= 0 ? `${10 ** p} ${big}` : p >= -k ? `${10 ** (k + p)} ${small}` : `${fmtScaled(1, -(k + p))} ${small}`);
    const d = p >= 0 ? (ip.length - 1 - p >= 0 ? ip[ip.length - 1 - p] : '0') : (fp[-p - 1] || '0');
    row.push(d);
  }
  return figTable(head, [row], { rowHead: false, hlCol: pMax });
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
// ===== 計算のしくみ (意味から説明する) =====
// 数は「1・10・100・0.1 などが何こあるか」でできている。たし算・ひき算・かけ算・わり算は、
// このこ数を あわせる・とる・何こ分にする・同じ数ずつ分ける こと。10こ そろうと1つ上の位の1こになる。
function digitsMap(S) { const m = {}; placeParts(String(S)).forEach((x) => { m[x.p] = x.d; }); return m; }
function placeList(strs) {
  let hi = 0, lo = 0;
  strs.forEach((S) => placeParts(String(S)).forEach((x) => { if (x.d || x.p <= 0) { hi = Math.max(hi, x.p); lo = Math.min(lo, x.p); } }));
  const out = []; for (let p = hi; p >= lo; p--) out.push(p); return out;
}
const unitOf = (p) => partVal(1, p);
function descCounts(ps, M) { const xs = ps.filter((p) => M[p]).map((p) => `${unitOf(p)} が ${M[p]}こ`); return xs.length ? xs.join('、') : '0'; }
// 位のタイル図。rows: [{ s, n: {位: こ数}, bars, hl: {位: 先頭から強調するこ数}, gone: {位: 末尾から消すこ数}, note: {位: 文} }]
// bars が true なら 10こ を「10こ のまとまり (棒)」でかく
function figTokens(ps, rows) {
  const W = 540, x0 = 108; const cw = Math.min(140, (W - x0 - 6) / ps.length);
  const per = Math.max(3, Math.floor((cw - 10) / 23));
  let y = 34; let b = '';
  ps.forEach((p, i) => { b += svgText(x0 + i * cw + cw / 2, 20, PLACE_NAMES[p], 's'); if (i) b += `<line class="dash" x1="${r1(x0 + i * cw)}" y1="26" x2="${r1(x0 + i * cw)}" y2="__H__"/>`; });
  rows.forEach((r) => {
    const cnt = (p) => r.n[p] || 0;
    const barsOf = (p) => (r.bars && cnt(p) >= 10 ? Math.floor(cnt(p) / 10) : 0);
    const hOf = (p) => barsOf(p) * 20 + Math.ceil((cnt(p) - barsOf(p) * 10) / per) * 23 + (r.note && r.note[p] ? 18 : 0);
    const H = Math.max(30, ...ps.map(hOf)) + 12;
    b += `<line class="ln2" x1="6" y1="${y - 6}" x2="${W - 6}" y2="${y - 6}"/>` + svgText(x0 - 10, y + 18, r.s, r.lcls || 'b', 'end');
    ps.forEach((p, i) => {
      const n = cnt(p); const cx = x0 + i * cw + 6; const bars = barsOf(p); const bw = Math.min(cw - 12, per * 23 - 2);
      let yy = y;
      for (let k = 0; k < bars; k++) { b += `<rect class="bundle" x="${r1(cx)}" y="${yy}" width="${r1(bw)}" height="16" rx="8"/>` + svgText(cx + bw / 2, yy + 12, `${unitOf(p)} が10こ`, 'tt'); yy += 20; }
      for (let k = 0; k < n - bars * 10; k++) {
        const idx = bars * 10 + k; const tx = cx + (k % per) * 23 + 10, ty = yy + Math.floor(k / per) * 23 + 10;
        const gone = r.gone && idx >= n - (r.gone[p] || 0); const hl = r.hl && idx < (r.hl[p] || 0);
        b += `<circle class="${gone ? 'tkg' : hl ? 'tk2' : 'tk'}" cx="${r1(tx)}" cy="${r1(ty)}" r="10"/>` + svgText(tx, ty + 3.5, unitOf(p), 'tt');
        if (gone) b += `<line class="ac" x1="${r1(tx - 9)}" y1="${r1(ty + 9)}" x2="${r1(tx + 9)}" y2="${r1(ty - 9)}"/>`;
      }
      if (!n) b += svgText(cx + 2, y + 18, '0こ', 's', 'start');
      if (r.note && r.note[p]) b += svgText(x0 + i * cw + cw / 2, y + H - 10, r.note[p], 'm');
    });
    y += H;
  });
  b = b.replace(/__H__/g, String(y - 6));
  return svgBox(W, y, b, '位のタイル図 (1・10・0.1 などの こ数)');
}
// 同じ数のまとまりが いくつ分 (テープ図)。n こ分。n が大きいときは 位ごとのかたまりでかく
function figGroups(aS, nS, unitWord = 'こ分') {
  const n = Fr.dec(nS); const W = 540, x0 = 20, TW = 500; let b = '';
  let segs;
  if (n.isInt() && n.n <= 10) segs = Array.from({ length: n.n }, () => ({ w: 1, s: aS }));
  else if (n.isInt()) segs = partsStr(nS).map((p) => ({ w: +p, s: `${aS} が ${p}${unitWord}` }));
  else segs = [{ w: 1, s: aS }, { w: n.val() - 1 > 0 ? n.val() - 1 : 0, s: '' }];
  const tot = segs.reduce((a, s) => a + s.w, 0) || 1;
  // 細すぎるかたまりは 字が読めるはばにする (図は目安)
  let ws = segs.map((s) => (s.w ? Math.max(s.w / tot, s.s.length > 6 ? 0.3 : 0) : 0)); const ws2 = ws.reduce((a, b) => a + b, 0) || 1; ws = ws.map((w) => w / ws2);
  let x = x0;
  segs.forEach((s, i) => { const w = TW * ws[i]; if (w > 0) b += `<rect class="${i % 2 ? 'sh3' : 'sh'}" x="${r1(x)}" y="20" width="${r1(w)}" height="34"/>` + svgText(x + w / 2, 42, s.s, 'b'); x += w; });
  b += `<path class="ln" d="M${x0} 62 q0 8 8 8 L${x0 + TW / 2 - 8} 70 q8 0 8 8 q0 -8 8 -8 L${x0 + TW - 8} 70 q8 0 8 -8"/>` + svgText(x0 + TW / 2, 96, `${aS} が ${nS} ${unitWord}`, 'm');
  return svgBox(W, 104, b, 'まとまりの図');
}
// 0.1 × 0.1 = 0.01 を、1 の正方形を 10×10 に分けて示す
function figUnitGrid() {
  const S = 200, x0 = 170, y0 = 26; let b = '';
  for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) b += `<rect class="${r === 0 && c === 0 ? 'both' : r === 0 || c === 0 ? 'sh' : 'bx'}" x="${x0 + c * S / 10}" y="${y0 + r * S / 10}" width="${S / 10}" height="${S / 10}"/>`;
  b += `<rect class="frame" x="${x0}" y="${y0}" width="${S}" height="${S}"/>` + svgText(x0 + S / 2, y0 - 8, 'よこ 1', 's') + svgText(x0 - 8, y0 + S / 2, 'たて 1', 's', 'end');
  b += svgText(x0 + S + 14, y0 + 14, '← こい1マス = 0.1 × 0.1 = 0.01', 'm', 'start');
  return svgBox(560, y0 + S + 10, b, '0.1 × 0.1 = 0.01 の図');
}
// 位ごとのこ数から、10こ の取りかえ (くり上がり) を下の位から順に行う
function carryChain(ps, counts) {
  const asc = ps.slice().reverse(); const fin = {}; const recv = {}; let c = 0; const ev = [];
  asc.forEach((p) => { const s = (counts[p] || 0) + c; if (c) recv[p] = c; fin[p] = s % 10; if (s >= 10) ev.push({ p, s, c, up: Math.floor(s / 10) }); c = Math.floor(s / 10); });
  return { fin, recv, ev };
}
function carryText(ev) {
  if (!ev.length) return 'どの位も 9こ以下 なので、取りかえはいりません。';
  return ev.map((e) => `${PLACE_NAMES[e.p]}は ${e.c ? `${e.s - e.c}こ に、下の位から来た ${e.c}こ を入れて ` : ''}${e.s}こ。${unitOf(e.p)} が 10こ で ${unitOf(e.p + 1)} が 1こ と同じ大きさなので、${e.up > 1 ? `10こ ずつ ${e.up}つ を` : '10こ を'} ${PLACE_NAMES[e.p + 1]}の ${e.up}こ に取りかえます。`).join('<br>') + '<br><small>これが「くり上がり」です。</small>';
}
function conceptAddFrames(aS, bS) {
  const total = Fr.dec(aS).add(Fr.dec(bS)).toDec();
  const ps = placeList([aS, bS, total]); const A = digitsMap(aS), B = digitsMap(bS);
  const sum = {}; ps.forEach((p) => { sum[p] = (A[p] || 0) + (B[p] || 0); });
  const { fin, recv, ev } = carryChain(ps, sum);
  const note = {}; ev.forEach((e) => { if (sum[e.p] >= 10) note[e.p] = '10こ→上の位へ'; });
  return [
    { fig: figTokens(ps, [{ s: aS, n: A }, { s: `+ ${bS}`, n: B }]), text: `たし算は、同じ大きさのものどうしを あわせて数えることです。数は「${ps.map(unitOf).join('・')}」が それぞれ何こあるかで できています。<br>${aS} は ${descCounts(ps, A)}。<br>${bS} は ${descCounts(ps, B)}。` },
    { fig: figTokens(ps, [{ s: aS, n: A }, { s: `+ ${bS}`, n: B }, { s: 'あわせて', n: sum, bars: true, note }]), text: `同じ位どうし、こ数をあわせます (ちがう位どうしは あわせられません)。<br>${ps.filter((p) => sum[p]).map((p) => `${unitOf(p)}: ${A[p] || 0} + ${B[p] || 0} = ${sum[p]}こ`).join('<br>')}` },
    { fig: figTokens(ps, [{ s: 'あわせて', n: sum, bars: true, note }, { s: '取りかえた後', n: fin, hl: recv, lcls: 'm' }]), text: `${carryText(ev)}<br>どの位も 9こ以下 になったら、こ数がそのまま答えの数字です: <b>${total}</b>` },
  ];
}
function conceptSubFrames(aS, bS) {
  const res = Fr.dec(aS).sub(Fr.dec(bS)).toDec();
  const ps = placeList([aS, bS]); const A = digitsMap(aS), B = digitsMap(bS);
  const work = {}; ps.forEach((p) => { work[p] = A[p] || 0; }); const hl = {}; const lines = [];
  ps.slice().reverse().forEach((p) => {
    if (work[p] >= (B[p] || 0)) return;
    let q = p + 1; while (!work[q]) q++;
    lines.push(`${PLACE_NAMES[p]}は ${work[p]}こ から ${B[p]}こ とれません。${q > p + 1 ? `${ps.filter((x) => x > p && x < q).map((x) => PLACE_NAMES[x]).join('・')}も 0こ なので、` : ''}${PLACE_NAMES[q]}の ${unitOf(q)} を 1こ くずして${q > p + 1 ? '、順に' : ''} ${unitOf(p)} を 10こ にします。`);
    for (let r = q; r > p; r--) { work[r] -= 1; work[r - 1] += 10; hl[r - 1] = 10; }
  });
  const fin = {}; ps.forEach((p) => { fin[p] = work[p] - (B[p] || 0); });
  const fs = [{ fig: figTokens(ps, [{ s: aS, n: A }, { s: `− ${bS}`, n: B }]), text: `ひき算は、同じ大きさのものどうし、ひく数の こ数だけ とりのぞくことです。<br>${aS} は ${descCounts(ps, A)}。<br>とりのぞくのは ${descCounts(ps, B)}。` }];
  if (lines.length) fs.push({ fig: figTokens(ps, [{ s: aS, n: A }, { s: 'くずした後', n: work, hl, lcls: 'm' }]), text: `${lines.join('<br>')}<br><small>${unitOf(ps[0])} を くずしても、全体の大きさは同じ ${aS} です。これが「くり下がり」です。</small>` });
  fs.push({ fig: figTokens(ps, [{ s: lines.length ? 'くずした後' : aS, n: work, hl, gone: B }, { s: 'のこり', n: fin, lcls: 'm' }]), text: `同じ位どうし、ひく数の こ数だけ とりのぞきます (×の つぶ)。<br>${ps.filter((p) => work[p]).map((p) => `${unitOf(p)}: ${work[p]} − ${B[p] || 0} = ${fin[p]}こ`).join('<br>')}<br>のこりの こ数を読むと <b>${res}</b>` });
  return fs;
}
function conceptMulFrames(aS, bS) {
  const A = splitDec(aS), B = splitDec(bS); const res = Fr.dec(aS).mul(Fr.dec(bS)).toDec();
  const fs = [];
  if (!B.places && B.digits.length === 1) {
    const b = +bS; const ps = placeList([aS, res]); const Am = digitsMap(aS);
    const prod = {}; ps.forEach((p) => { prod[p] = (Am[p] || 0) * b; });
    const { fin, recv, ev } = carryChain(ps, prod);
    fs.push({ fig: figGroups(aS, bS), text: `かけ算は、同じ数のまとまりが いくつ分あるかを表します。${aS} × ${b} は「${aS} が ${b}こ分」で、${aS} を ${b}回 たすのと同じです。<br>${Array(b).fill(aS).join(' + ')}` });
    fs.push({ fig: figTokens(ps, [{ s: aS, n: Am }, { s: `${b}こ分`, n: prod, bars: true }]), text: `${aS} は ${descCounts(ps, Am)}。${b}こ分 にすると、どの位の こ数も ${b}倍 になります。<br>${ps.filter((p) => Am[p]).map((p) => `${unitOf(p)}: ${Am[p]}こ × ${b} = ${prod[p]}こ`).join('<br>')}` });
    fs.push({ fig: figTokens(ps, [{ s: `${b}こ分`, n: prod, bars: true }, { s: '取りかえた後', n: fin, hl: recv, lcls: 'm' }]), text: `${carryText(ev)}<br>答え: <b>${res}</b>` });
    return fs;
  }
  if (!B.places && !A.places) {
    const parts = partsStr(bS); const ps = placeList([aS, String(+aS * 10)]); const Am = digitsMap(aS), Tm = digitsMap(String(+aS * 10));
    fs.push({ fig: figGroups(aS, bS), text: `かけ算は、同じ数のまとまりが いくつ分あるかを表します。${aS} × ${bS} は「${aS} が ${bS}こ分」。${bS}こ分 を ${parts.map((p) => `${p}こ分`).join(' と ')} に分けると 計算しやすくなります。` });
    fs.push({ fig: figTokens(ps, [{ s: aS, n: Am }, { s: '10こ分', n: Tm, lcls: 'm' }]), text: `${aS} が 10こ分 では、どのつぶも 10こ ずつになり、10こ は1つ上の位の 1こ なので、全部が1つ上の位に うつります。<br>${aS} × 10 = ${+aS * 10} (0 が1つつく)。${parts.length > 1 ? `だから ${aS} × ${parts[0]} = ${aS} × ${+parts[0] / 10} × 10 = <b>${+aS * +parts[0]}</b>。` : ''}<br><small>筆算で2段目を1つ左にずらして書くのは、このためです。</small>` });
    return fs;
  }
  // かける数が小数
  const bv = Fr.dec(bS).val();
  fs.push({ fig: figDoubleLine({ top: '大きさ', bot: '倍', cols: [{ pos: 0, t: '0', b: '0' }, { pos: 1, t: aS, b: '1' }, { pos: bv, t: res, b: bS, ut: true }], arrows: [{ from: 1, to: bv, s: `×${bS}`, side: 'bot' }], label: '二本の数直線' }),
    text: `かける数が小数のときも、かけ算は「${aS} を 1 とみたとき、${bS} にあたる大きさ」です。${bv < 1 ? `${bS} は 1 より小さいので、答えは ${aS} より小さくなります。` : `${bS} は 1 より大きいので、答えは ${aS} より大きくなります。`}` });
  if (A.places && B.places) fs.push({ fig: figUnitGrid(), text: '小数どうしのかけ算は、1 の正方形を 10等分・100等分した 小さいマスで考えます。0.1 × 0.1 は、1 の正方形を たて・よこ 10等分した 1マス分で 0.01 です。<br><small>だから 小数第1位 × 小数第1位 の答えは、小数第2位まで になります。</small>' });
  return fs;
}
function conceptDivFrames(aS, bS) {
  const B = splitDec(bS); const D = Fr.dec(aS).mul(10 ** B.places), d = +B.digits;
  const Ds = D.toDec(), Q = D.div(d).toDec();
  if (!B.places && B.digits.length === 1) {
    const ps = placeList([Ds, Q]); const Dm = digitsMap(Ds), Qm = digitsMap(Q);
    const lines = []; let c = 0;
    ps.forEach((p) => {
      const n = (Dm[p] || 0) + c * 10; const q = Math.floor(n / d), r = n - q * d;
      if (n) lines.push(`${PLACE_NAMES[p]}: ${unitOf(p)} が ${n}こ。${d}つに分けると 1つ分は ${q}こ${r ? `、${r}こ あまる → ${unitOf(p - 1)} を ${r * 10}こ に くずして 下の位へ` : ''}`);
      c = r;
    });
    return [
      { fig: figTokens(ps, [{ s: Ds, n: Dm }]), text: `わり算は、同じ数ずつ分けることです。${Ds} ÷ ${d} は「${Ds} を ${d}つに 同じ数ずつ分けた 1つ分」です。<br>${Ds} は ${descCounts(ps, Dm)}。上の位から 分けていきます。` },
      { fig: figTokens(ps, [{ s: Ds, n: Dm }, { s: '1つ分', n: Qm, lcls: 'm' }]), text: `${lines.join('<br>')}<br>1つ分 を読むと <b>${Q}</b>。<br><small>あまった つぶを くずして下の位へ送るのが、筆算の「おろす」です。</small>` },
    ];
  }
  return [{ fig: figDoubleLine({ top: '大きさ', bot: 'いくつ分', cols: [{ pos: 0, t: '0', b: '0' }, { pos: 1, t: String(d), b: '1' }, { pos: +Q, t: Ds, b: Q, ub: true }], label: '二本の数直線' }),
    text: `わり算は「${Ds} の中に ${d} が いくつ分あるか」とも考えられます。${d} の □こ分 が ${Ds} になる □ を求めます。` }];
}
// まぜた計算: 式を言葉にして、× ÷ が「ひとまとまりの数」であることを示す
function meaningOf(n, top) {
  if (n.leaf) return numText(n.tok);
  const L = meaningOf(n.l), R = meaningOf(n.r);
  const s = n.op === '+' ? `${L} と ${R} を あわせた数` : n.op === '-' ? `${L} から ${R} を とった数` : n.op === '*' ? `${L} の ${R}倍` : `${L} を ${R} で わった数`;
  return top ? s : `「${s}」`;
}
// まちがえて「左から順に」計算したときの値 (かっこは守る)
function naiveEval(tokens) {
  let i = 0;
  const seq = () => {
    let v = null, op = null;
    while (i < tokens.length && tokens[i].k !== ')') {
      const t = tokens[i++];
      if (t.k === 'op') { op = t.v; continue; }
      const x = t.k === '(' ? (() => { const r = seq(); i++; return r; })() : t.v;
      v = v === null ? x : applyOp(op, v, x);
    }
    return v;
  };
  return seq();
}
function groupHTML(n, inSum) {
  if (n.leaf) return numHTML(n.tok);
  const inner = `${groupHTML(n.l, n.op === '+' || n.op === '-')} ${OPS[n.op]} ${groupHTML(n.r, n.op === '+' || n.op === '-')}`;
  const s = n.paren ? `(${inner})` : inner;
  return (inSum && (n.op === '*' || n.op === '/')) || n.paren ? `<span class="grp">${s}</span>` : s;
}

function niceMax(v) { const st = niceStep(v || 1, 5); return Math.ceil(v / st - 1e-9) * st; }
// start から parts を順に たす/ひく ようすを数直線に
function jumpLine(start, parts, sign, label) {
  let cur = Fr.of(start); const jumps = [];
  const marks = [{ v: 0, s: '0' }, { v: cur.val(), s: fv(cur) }];
  // 小さすぎて見えない移動は、ひとつ前の移動にまとめる
  const span = Math.max(Fr.of(start).val(), (sign > 0 ? Fr.of(start).add(parts.reduce((a, p) => a.add(p), new Fr(0))) : Fr.of(start)).val());
  const merged = [];
  parts.forEach((p) => { if (merged.length && p.val() < 1 && p.val() / span < 0.06) merged[merged.length - 1] = merged[merged.length - 1].add(p); else merged.push(p); });
  merged.forEach((p) => { const nx = sign > 0 ? cur.add(p) : cur.sub(p); jumps.push({ a: cur.val(), b: nx.val(), s: (sign > 0 ? '+' : '−') + fv(p) }); cur = nx; });
  marks.push({ v: cur.val(), s: fv(cur), cls: 'm' });
  return (merged.length < parts.length ? '<!--merged-->' : '') + figNumberLine({ min: 0, max: niceMax(Math.max(Fr.of(start).val(), cur.val())), marks, jumps, label });
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
  const tbl = `<table class="pv">${rows.join('')}</table>`;
  return [
    { fig: tbl, text: '位ごとに分けて たします (表の1行が1つの位)。' },
    { fig: jumpLine(aS, nonzeroParts(bS).map((x) => partFr(x.d, x.p)), 1, `${aS} + ${bS} の数直線`), text: `数直線で見ると、${aS} から ${bS} を位ごとに分けて 右へ進みます。` + (nonzeroParts(bS).length > 1 && jumpLine(aS, nonzeroParts(bS).map((x) => partFr(x.d, x.p)), 1, '').startsWith('<!--merged-->') ? '<br><small>図では、小さい位の移動をまとめてかいています。</small>' : '') },
    { fig: tbl, text: `位ごとの答えを あわせます: ${sums.map((x) => x.toDec()).join(' + ')} = <b>${total.toDec()}</b>${carry ? `<br><small>${carryNote(carry.p, carry.sv)} 筆算の「くり上がり」は、このことです。</small>` : ''}` },
  ];
}
function pvSubFrames(aS, bS) {
  const parts = nonzeroParts(bS);
  const fig = jumpLine(aS, parts.map((x) => partFr(x.d, x.p)), -1, `${aS} − ${bS} の数直線`);
  let cur = Fr.dec(aS); const lines = [];
  for (const x of parts) { const v = partFr(x.d, x.p); const nx = cur.sub(v); lines.push(`${cur.toDec()} − ${v.toDec()} = <b>${nx.toDec()}</b>`); cur = nx; }
  if (parts.length < 2) return [{ fig, text: `数直線で、${aS} から ${bS} だけ 左へもどります。${aS} − ${bS} = <b>${cur.toDec()}</b>` }];
  return [
    { fig, text: `ひく数 ${bS} を 位ごとに ${parts.map((x) => partVal(x.d, x.p)).join(' と ')} に分けて、数直線で ${aS} から順に 左へもどります。` },
    { fig, text: lines.join('<br>') + `<br><small>大きい位から順にひくと、暗算でも考えやすくなります。${fig.startsWith('<!--merged-->') ? '図では、小さい位の移動をまとめてかいています。' : ''}</small>` },
  ];
}
const partsStr = (S) => { const ps = nonzeroParts(S).map((x) => partVal(x.d, x.p)); return ps.length ? ps : [S]; };
function pvMulFrames(aS, bS) {
  const A = splitDec(aS), B = splitDec(bS);
  const res = Fr.dec(aS).mul(Fr.dec(bS));
  const intMulti = !A.places && !B.places && B.digits.length > 1;
  const colsP = intMulti ? [aS] : partsStr(aS);
  const rowsP = !B.places && B.digits.length === 1 ? [bS] : partsStr(bS);
  const cells = rowsP.map((r) => colsP.map((c) => ({ s: fv(Fr.dec(c).mul(Fr.dec(r))) })));
  const fig = figArea({ cols: colsP.map((c) => ({ s: c, w: +c })), rows: rowsP.map((r) => ({ s: r, h: +r })), cells, topNote: `よこ ${aS}`, leftNote: `たて ${bS}`, label: `${aS} × ${bS} の面積図` });
  const prods = cells.flat().map((c) => c.s);
  const fs = [];
  if (prods.length > 1) {
    fs.push({ fig, text: `${aS} × ${bS} は、たて ${bS}・よこ ${aS} の長方形の面積と考えられます。位ごとに分けて、小さい長方形の面積を求めます。<br>${rowsP.map((r) => colsP.map((c) => `${c} × ${r} = <b>${fv(Fr.dec(c).mul(Fr.dec(r)))}</b>`).join('<br>')).join('<br>')}` });
    fs.push({ fig, text: `小さい長方形をあわせて ${prods.join(' + ')} = <b>${res.toDec()}</b>${intMulti ? `<br><small>筆算で書く段は、たての ${rowsP.join(' と ')} ごとの面積です (0 は書かずに、1つずつ左にずらして書きます)。</small>` : ''}` });
  } else {
    fs.push({ fig, text: `${aS} × ${bS} は、たて ${bS}・よこ ${aS} の長方形の面積と考えられます。${aS} × ${bS} = <b>${res.toDec()}</b>` });
  }
  if (A.places || B.places) {
    const ua = A.places ? `0.${'0'.repeat(A.places - 1)}1` : '1', ub = B.places ? `0.${'0'.repeat(B.places - 1)}1` : '1';
    const up = A.places + B.places; const uu = `0.${'0'.repeat(up - 1)}1`;
    const na = +A.digits, nb = +B.digits;
    fs.push({ fig: figTable(['', 'もとの数', '小さい単位', 'そのこ数'], [[`かけられる数`, aS, ua, na], [`かける数`, bS, ub, nb], ['答え', `<b>${res.toDec()}</b>`, uu, na * nb]], { sumRow: 2 }),
      text: `別の考え方: 小さい単位の「いくつ分」で見ます。${na} × ${nb} = ${na * nb}。単位は ${ua} × ${ub} = ${uu} なので、答えは ${uu} が ${na * nb} こ = <b>${res.toDec()}</b>` });
  }
  return fs;
}
function pvDivFrames(aS, bS) {
  const B = splitDec(bS);
  const D = Fr.dec(aS).mul(10 ** B.places), d = +B.digits;
  const Ds = D.toDec(), Q = D.div(d);
  const fs = [];
  if (B.places) fs.push({ fig: figTable(['', 'わられる数', 'わる数', '商'], [['もとの式', aS, bS, '□'], [`両方 ×${10 ** B.places}`, `<b>${Ds}</b>`, `<b>${d}</b>`, '□ (同じ)']], { hlCells: [[1, 1], [1, 2]] }),
    text: `わる数 ${bS} を整数にするため、わる数とわられる数を両方 ${10 ** B.places} 倍します: ${aS} ÷ ${bS} = ${Ds} ÷ ${d}<br><small>両方を同じ数だけ倍しても、答え (商) は変わりません。</small>` });
  const qParts = nonzeroParts(Q.toDec()).map((x) => partFr(x.d, x.p));
  const chunks = qParts.map((q) => ({ q: fv(q), c: fv(q.mul(d)) }));
  const fig = figArea({ cols: chunks.map((c) => ({ s: c.q, w: +c.q, cls: 'm' })), rows: [{ s: String(d) }], cells: [chunks.map((c) => ({ s: c.c }))], topNote: 'よこ = 商', leftNote: `たて = わる数 ${d}、面積 = わられる数 ${Ds}`, label: `${Ds} ÷ ${d} の面積図` });
  if (chunks.length >= 2) {
    fs.push({ fig, text: `わり算は「面積 ${Ds}、たて ${d} の長方形の よこ の長さ」を求めることです。${Ds} を ${d} でわりやすい数に分けます: ${Ds} = ${chunks.map((x) => x.c).join(' + ')}<br>${chunks.map((x) => `${x.c} ÷ ${d} = <b>${x.q}</b>`).join('<br>')}` });
    fs.push({ fig, text: `よこの長さをあわせて ${chunks.map((x) => x.q).join(' + ')} = <b>${Q.toDec()}</b><br><small>筆算では、この分け方を上の位から順に行っています。</small>` });
  } else {
    fs.push({ fig, text: `わり算は「面積 ${Ds}、たて ${d} の長方形の よこ の長さ」を求めることです。${d} × □ = ${Ds} になる □ をさがします。${d} × ${Q.toDec()} = ${Ds} なので <b>${Q.toDec()}</b>` });
  }
  const Dp = splitDec(Ds).places;
  const N = Fr.dec(Ds).mul(10 ** Dp), M = N.div(d);
  if (Dp && M.isInt()) {
    const u = `0.${'0'.repeat(Dp - 1)}1`;
    fs.push({ fig: figTable(['', '数', `${u} のこ数`], [['わられる数', Ds, N.n], ['÷ ' + d, '', `${N.n} ÷ ${d} = ${M.n}`], ['商', `<b>${Q.toDec()}</b>`, M.n]], { sumRow: 2 }), text: `別の考え方: ${Ds} は ${u} が ${N.n} こ。${N.n} ÷ ${d} = ${M.n} なので、${u} が ${M.n} こ = <b>${Q.toDec()}</b>` });
  }
  return fs;
}
// 位ごとの考え方 (図) のあとに、同じ計算の筆算を1段ずつ。図のない説明だけの段ははぶく (上の図で説明ずみ)
function withHissan(pv, hs) {
  const g = hs.filter((f) => f.grid);
  if (g.length) g[0] = { ...g[0], text: `<b>同じ計算を、筆算で1段ずつ見てみましょう。</b><br>${g[0].text}` };
  return pv.concat(g);
}

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
function addProblem(a, b) { const v = Fr.dec(a).add(Fr.dec(b)); return { html: `${a} + ${b} =`, text: `${a} + ${b}`, slots: [slot(v)], explain: () => withHissan(conceptAddFrames(a, b).concat(pvAddFrames(a, b)), addSubFrames(a, b, '+')) }; }
function subProblem(a, b) { const v = Fr.dec(a).sub(Fr.dec(b)); return { html: `${a} − ${b} =`, text: `${a} − ${b}`, slots: [slot(v)], explain: () => withHissan(conceptSubFrames(a, b).concat(pvSubFrames(a, b)), addSubFrames(a, b, '-')) }; }
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
function mulProblem(a, b) { const v = Fr.dec(a).mul(Fr.dec(b)); return { html: `${a} × ${b} =`, text: `${a} × ${b}`, slots: [slot(v)], explain: () => withHissan(conceptMulFrames(a, b).concat(pvMulFrames(a, b)), mulFrames(a, b)) }; }
function divProblem(a, b, q) { return { html: `${a} ÷ ${b} =`, text: `${a} ÷ ${b}`, slots: [slot(q)], explain: () => withHissan(conceptDivFrames(a, b).concat(pvDivFrames(a, b)), divFrames(a, b)) }; }
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
  const F = (fig, ...ts) => ts.map((t, i) => ({ fig, text: t }));
  if (kind === 0 || kind === 4) {
    const [base, g] = kind === 0 ? [25, 4] : [125, 8]; const k = ri(2, 9); const m = g * k;
    q = `${base} × ${m}`; v = base * m;
    const fig = figArea({ cols: Array.from({ length: k }, () => ({ s: String(g), w: 1 })), rows: [{ s: String(base) }], cells: [Array.from({ length: k }, () => ({ s: String(base * g), cls: 'sh' }))], topNote: `よこ ${m} = ${g} × ${k}`, leftNote: `たて ${base}`, label: `${q} の面積図` });
    frames = F(fig, `${m} を ${g} × ${k} に分けます。たて ${base}・よこ ${g} の長方形が ${k} こ並んでいます。`, `${base} × ${g} = ${base * g} を先に計算すると、${base * g} × ${k} = <b>${v}</b>`);
  } else if (kind === 1) {
    const x = ri(23, 87); const a = pick([98, 99, 97, 198]); q = `${a} + ${x}`; v = a + x; const r = Math.ceil(a / 100) * 100;
    const fig = figNumberLine({ min: 0, max: niceMax(r + x), marks: [{ v: 0, s: '0' }, { v: x, s: String(x) }, { v: v, s: String(v), cls: 'm' }], jumps: [{ a: x, b: x + r, s: `+${r}` }, { a: x + r, b: v, s: `−${r - a}` }], label: `${q} の数直線` });
    frames = F(fig, `${a} を ${r} − ${r - a} と考えます。数直線で ${x} から ${r} 進んで、${r - a} もどります。`, `${x} + ${r} = ${r + x}、そこから ${r - a} をひいて <b>${v}</b>`);
  } else if (kind === 2) {
    const x = ri(12, 48); q = `${x} × 99`; v = x * 99;
    const fig = figArea({ cols: [{ s: '99', w: 99 }, { s: '1', w: 1, cls: 'm' }], rows: [{ s: String(x) }], cells: [[{ s: String(v), cls: 'sh' }, { s: String(x), cls: 'cut' }]], topNote: 'よこ 100 = 99 + 1', leftNote: `たて ${x}`, label: `${q} の面積図` });
    frames = F(fig, `99 を 100 − 1 と考えます。たて ${x}・よこ 100 の長方形から、はしの よこ 1 の部分を取りのぞきます。`, `${x} × 100 = ${x * 100}、そこから ${x} × 1 = ${x} をひいて <b>${v}</b>`);
  } else if (kind === 3) {
    const x = ri(13, 98) * 2; q = `${x} × 5`; v = x * 5;
    const fig = figDoubleLine({ top: '数', bot: '何倍', cols: [{ pos: 0, t: '0', b: '0' }, { pos: 1, t: String(x), b: '1' }, { pos: 5, t: String(v), b: '5', ut: true }, { pos: 10, t: String(x * 10), b: '10' }], arrows: [{ from: 1, to: 10, s: '×10', side: 'bot' }, { from: 10, to: 5, s: '÷2', side: 'top' }], label: `${q} の二本の数直線` });
    frames = F(fig, '× 5 は「× 10 してから ÷ 2」と同じです (5 は 10 の半分)。', `${x} × 10 = ${x * 10}、その半分で <b>${v}</b>`);
  } else if (kind === 5) {
    const x = fmtScaled(ri(11, 99), 1); q = `2.5 × ${x} × 4`; v = Fr.dec(x).mul(10);
    const t1 = { op: '*', l: { op: '*', l: { leaf: true, tok: num('2.5') }, r: { leaf: true, tok: num('4') } }, r: { leaf: true, tok: num(x) } };
    const fig = figTree(t1, t1.l, numText);
    frames = F(fig, `かけ算は順番を入れかえても答えは同じです。2.5 × 4 を先に計算するように並べかえます。`, `2.5 × 4 = 10 なので、10 × ${x} = <b>${v.toDec()}</b>`);
  } else if (kind === 6) {
    const x = ri(12, 48); q = `102 × ${x}`; v = 102 * x;
    const fig = figArea({ cols: [{ s: '100', w: 100 }, { s: '2', w: 2 }], rows: [{ s: String(x) }], cells: [[{ s: String(100 * x) }, { s: String(2 * x), cls: 'sh2' }]], topNote: 'よこ 102 = 100 + 2', leftNote: `たて ${x}`, label: `${q} の面積図` });
    frames = F(fig, '102 を 100 + 2 に分けます。長方形を 2 つに分けて考えます。', `100 × ${x} = ${100 * x}、2 × ${x} = ${2 * x}、あわせて <b>${v}</b>`);
  } else {
    const x = ri(123, 876); q = `1000 − ${x}`; v = 1000 - x;
    const d = String(x).split(''), r = String(999 - x).padStart(3, '0').split('');
    const fig = figTable(['', '百の位', '十の位', '一の位'], [['999', '9', '9', '9'], ['− ' + x, ...d], ['= ' + (999 - x), ...r.map((c) => `<b>${c}</b>`)]], { sumRow: 2 });
    frames = F(fig, `1000 を 999 + 1 と考えると、どの位も 9 からひくので くり下がりがなくなります。`, `999 − ${x} = ${999 - x}、1 をたして <b>${v}</b>`);
  }
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
  const an = a.n * L / a.d, bn = b.n * L / b.d, rn = op === '+' ? an + bn : an - bn;
  const sA = frText(a), sB = frText(b);
  const barsL = figFracBars([{ f: a, d: L, s: `${an}/${L}` }, { f: b, d: L, s: `${bn}/${L}`, cls: 'sh3' }, { f: res, d: L, s: `${op === '+' ? 'あわせて' : 'ちがい'} ${rn}/${L}`, cls: 'sh2', lcls: 'm' }]);
  if (a.d !== b.d) {
    fs.push({ fig: figFracBars([{ f: a, d: a.d, s: sA }, { f: b, d: b.d, s: sB, cls: 'sh3' }]), text: `テープ図で見ると、${sA} と ${sB} は 1目もりの大きさ (分母) がちがうので、このままでは${op === '+' ? 'たせ' : 'ひけ'}ません。${a.d} と ${b.d} の最小公倍数 ${L} で、目もりをそろえます (通分)。` });
    fs.push({ fig: figFracBars([{ f: a, d: L, s: `${sA} = ${an}/${L}` }, { f: b, d: L, s: `${sB} = ${bn}/${L}`, cls: 'sh3' }]), text: `${frHTML(a, false)} = ${fracHTML(an, L)}、 ${frHTML(b, false)} = ${fracHTML(bn, L)}<br><small>目もりを細かくしても、テープの長さ (大きさ) は変わりません。分母と分子に同じ数をかけるのは、このことです。</small>` });
  }
  fs.push({ fig: barsL, text: `1/${L} の目もりが ${an} こ と ${bn} こ。${op === '+' ? 'あわせて' : 'ちがいは'} ${rn} こなので ${fracHTML(an, L)} ${OPS[op]} ${fracHTML(bn, L)} = ${fracHTML(rn, L)}` });
  const g = gcd(rn, L);
  if (g > 1) fs.push({ fig: figFracBars([{ f: res, d: L, s: `${rn}/${L}`, cls: 'sh2' }, { f: res, d: res.d, s: `${frText(res, false)}`, cls: 'sh2' }]), text: `分母と分子を ${g} でわって約分します: ${fracHTML(rn, L)} = ${frHTML(res, false)}<br><small>目もりを ${g} こずつ まとめても、長さは同じです。</small>` });
  if (res.n > res.d && !res.isInt()) fs.push({ fig: figFracBars([{ f: res, d: res.d, s: frText(res, true), cls: 'sh2' }]), text: `仮分数は帯分数にもできます: ${frHTML(res, false)} = ${frHTML(res, true)} (どちらで答えても正解です)` });
  else fs.push({ fig: figFracBars([{ f: res, d: res.d, s: frText(res, true), cls: 'sh2' }]), text: `答えは ${frHTML(res)} です。` });
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
// 分数の ×・÷ を「1 にあたる量」で見る二本の数直線
function frRatioFig(a, b, isDiv) {
  const res = isDiv ? a.div(b) : a.mul(b);
  const cols = [{ pos: 0, t: '0', b: '0' }, { pos: 1, t: isDiv ? frText(res) : frText(a), b: '1', ut: isDiv }, { pos: b.val(), t: isDiv ? frText(a) : frText(res), b: frText(b), ut: !isDiv }];
  return figDoubleLine({ top: '量', bot: '倍 (割合)', cols, arrows: [isDiv ? { from: b.val(), to: 1, s: `÷ ${frText(b)}`, side: 'top' } : { from: 1, to: b.val(), s: `× ${frText(b)}`, side: 'top' }], label: '二本の数直線' });
}
function frMulExplain(a, b, isDiv) {
  const fs = [];
  let x = a, y = b;
  const ratio = frRatioFig(a, b, isDiv);
  if (isDiv) {
    fs.push({ fig: ratio, text: `${frText(a)} ÷ ${frText(b)} は、「${frText(b)} にあたる量が ${frText(a)} のとき、1 にあたる量」です。` });
    const inv = new Fr(b.d, b.n);
    fs.push({ fig: ratio, text: `分数でわるときは、わる数の分母と分子を入れかえてかけます: ÷ ${frHTML(b, false)} → × ${fracHTML(b.d, b.n)}<br><small>わけ: 数直線で ${frText(b)} から 1 にもどるには、まず ${b.n} でわって 1/${b.d} にあたる量を出し、それを ${b.d} 倍します。つまり「${b.d} をかけて ${b.n} でわる」と同じです。</small>` });
    y = inv;
  } else if (a.val() < 1 && b.val() < 1) {
    const area = figFracArea(a, b);
    fs.push({ fig: area, text: `${frText(a)} × ${frText(b)} は、たて ${frText(a)} m・よこ ${frText(b)} m の長方形の面積と考えられます。1 m² の正方形を たて ${a.d}・よこ ${b.d} に分けると、小さい長方形は 1 つ 1/${a.d * b.d} m²。` });
    fs.push({ fig: area, text: `こい色の部分は たて ${a.n} こ × よこ ${b.n} こ = ${a.n * b.n} こ。だから ${fracHTML(`${a.n} × ${b.n}`, `${a.d} × ${b.d}`)} = ${fracHTML(a.n * b.n, a.d * b.d)}。分子どうし・分母どうしをかけるのは、このことです。` });
  } else {
    fs.push({ fig: ratio, text: `${frText(a)} × ${frText(b)} は、「1 にあたる量が ${frText(a)} のとき、${frText(b)} にあたる量」です。` });
  }
  if (!x.isInt() && x.n > x.d && a.n > a.d) fs.push({ fig: figFracBars([{ f: a, d: a.d, s: `${frText(a, true)} = ${frText(a, false)}` }]), text: `帯分数は仮分数になおしてから計算します: ${frHTML(x, true)} = ${frHTML(x, false)}` });
  const xn = x.n, xd = x.d, yn = isDiv ? b.d : y.n, yd = isDiv ? b.n : y.d;
  const g1 = gcd(xn, yd), g2 = gcd(yn, xd);
  const res = isDiv ? a.div(b) : a.mul(b);
  const tbl = figTable(['', '分子', '分母'], [[frText(x, false), xn, xd], [`× ${yn}/${yd}`, yn, yd], ['かける', `${xn} × ${yn}`, `${xd} × ${yd}`], ['答え', `<b>${res.n}</b>`, `<b>${res.d}</b>`]], { sumRow: 3 });
  fs.push({ fig: tbl, text: `分子どうし、分母どうしをかけます: ${fracHTML(`${xn} × ${yn}`, `${xd} × ${yd}`)}` });
  if (g1 > 1 || g2 > 1) fs.push({ fig: tbl, text: `かける前に約分すると、計算が楽になります。${g1 > 1 ? `${xn} と ${yd} は ${g1} でわれます。` : ''}${g2 > 1 ? `${yn} と ${xd} は ${g2} でわれます。` : ''}<br>${fracHTML(`${xn / g1} × ${yn / g2}`, `${xd / g2} × ${yd / g1}`)}` });
  fs.push({ fig: ratio, text: `答えは ${frHTML(res, false)}${res.n > res.d && !res.isInt() ? ` (= ${frHTML(res, true)})` : ''} です。` });
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
  const right = evalTree(tree); const naive = naiveEval(tokens);
  const hasParen = tokens.some((t) => t.k === '(');
  const warn = right.eq(naive) ? '' : `<br><small>もし 左から順に計算すると ${naive.n < 0 ? '途中で ひけなくなってしまいます' : `${fv(naive)} になり、正しい答え ${fv(right)} と ちがってしまいます`}。式の意味が変わってしまうからです。</small>`;
  frames.push({ fig: `<div class="expr grpd">${groupHTML(tree, false)}</div>` + figLevels(), lesson: 'order', text: `式を言葉にすると、${meaningOf(tree, true)} です。<br>「〜の〜倍」「〜を〜でわった数」は、それだけで 1つの数 (まとまり) を表しています (□で かこんだ所)。たしたり ひいたりする相手は、この まとまりの数 なので、まとまりの数を先に出します。${hasParen ? '<br>かっこは「この中を先に 1つの数にまとめる」という しるしです。' : ''}${warn}` });
  frames.push({ fig: figTree(tree, firstReducible(tree), numText), text: `計算の順番: ① かっこの中 → ② かけ算・わり算 → ③ たし算・ひき算 (同じなかまは左から)。<br><small>図は「式の木」です。上の数を 下の ○ の計算で まとめていきます。黄色の ○ が次の計算です。</small><div class="expr">${tokensHTML(nodeTokens(tree))}</div>` });
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
    frames.push({ fig: figTree(tree, tree.leaf ? null : firstReducible(tree), numText), text: `${txt}<div class="expr">${tokensHTML(nodeTokens(tree))}</div>` });
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
// どのフレームにも同じ図をつける
const figFrames = (fig, ...ts) => ts.map((t) => ({ fig, text: t }));
// 分 (または秒) の数直線。60 ごとに大きい目もり
function minuteLine(total, u = '分', bigU = '時間') {
  const H = Math.floor(total / 60), M = total % 60; const max = (H + 1) * 60;
  const marks = [{ v: 0, s: '0' }]; for (let k = 1; k <= H + 1; k++) if (k * 60 !== total) marks.push({ v: k * 60, s: `${k * 60}${u}` });
  marks.push({ v: total, s: `${total}${u}`, cls: 'm' });
  const jumps = [];
  if (H) jumps.push({ a: 0, b: H * 60, s: `${H}${bigU}` });
  if (M) jumps.push({ a: H * 60, b: total, s: `${M}${u}` });
  return figNumberLine({ min: 0, max, marks, jumps, label: `${u}の数直線` });
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
  const pow10 = String(ratio).replace(/0/g, '') === '1';
  const dl = figDoubleLine({ top: big, bot: small, cols: [{ pos: 0, t: '0', b: '0' }, { pos: 1, t: '1', b: String(ratio) }, { pos: L.val(), t: Ls, b: Ss, ut: !toSmall, ub: toSmall }], arrows: toSmall ? [{ from: 1, to: L.val(), s: `×${Ls}`, side: 'top' }] : [], label: '単位の二本の数直線' });
  const frames = [
    { fig: dl, text: unitWhy(big, small, ratio) + '。二本の数直線で、上の目もりと下の目もりが同じ量を表します。' },
    toSmall
      ? { fig: pow10 ? figUnitPlace(big, small, ratio, L) : dl, text: `大きい単位 → 小さい単位 なので、数は大きくなります。${Ls} × ${ratio} = ${Ss}${ratio % 10 === 0 && String(ratio).replace(/0/g, '') === '1' ? `<br><small>× ${ratio} は、小数点を右に ${String(ratio).length - 1} つ動かすのと同じです。表の数字のならびは同じで、どの単位で読むかが変わるだけです。</small>` : ''}` }
      : { fig: pow10 ? figUnitPlace(big, small, ratio, L) : dl, text: `小さい単位 → 大きい単位 なので、数は小さくなります。${Ss} ÷ ${ratio} = ${ansText(L)}${ratio % 10 === 0 && String(ratio).replace(/0/g, '') === '1' ? `<br><small>÷ ${ratio} は、小数点を左に ${String(ratio).length - 1} つ動かすのと同じです。表の数字のならびは同じで、どの単位で読むかが変わるだけです。</small>` : ''}` },
  ];
  return { html, text, slots: [toSmall ? slot(S, small) : slot(L, big)], explain: () => frames };
};
GEN.time_mix = () => {
  const v = ri(0, 3);
  if (v === 0) {
    const h = ri(1, 3), m = ri(1, 11) * 5;
    return { html: `${h}時間${m}分 = <b class="box">□</b> 分`, text: `${h}時間${m}分 = □分`, slots: [slot(h * 60 + m, '分')], explain: () => figFrames(minuteLine(h * 60 + m), '1時間 = 60分 です。数直線の大きい目もりが 1時間 (60分) です。', `${h}時間 = 60 × ${h} = ${h * 60}分。${h * 60} + ${m} = ${h * 60 + m}分`) };
  }
  if (v === 1) {
    const M = ri(65, 250); const h = Math.floor(M / 60), m = M % 60;
    if (m === 0) return GEN.time_mix();
    return { html: `${M}分 = <b class="box">□</b> 時間 <b class="box">□</b> 分`, text: `${M}分 = □時間□分`, slots: [slot(h, '時間'), slot(m, '分')], explain: () => figFrames(minuteLine(M), '60分で 1時間 です。数直線で、60分ごとの大きい目もりをいくつこえるか見ます。', `${M} ÷ 60 = ${h} あまり ${m}。だから ${h}時間${m}分`) };
  }
  if (v === 2) {
    const h = ri(0, 3), m = pick([6, 12, 15, 18, 24, 30, 36, 42, 45, 48, 54]);
    const val = new Fr(h * 60 + m, 60);
    const left = h ? `${h}時間${m}分` : `${m}分`;
    return { html: `${left} = <b class="box">□</b> 時間`, text: `${left} = □時間`, slots: [slot(val, '時間')], note: '小数か分数で答えよう', explain: () => figFrames(figDoubleLine({ top: '分', bot: '時間', cols: [{ pos: 0, t: '0', b: '0' }, { pos: 60, t: '60', b: '1' }, { pos: h * 60 + m, t: String(h * 60 + m), b: ansText(val), ub: true }], arrows: [{ from: 60, to: h * 60 + m, s: `×${frText(val)}`, side: 'bot' }], label: '分と時間の二本の数直線' }), '1分は 1時間の 1/60 です。上が分、下が時間の目もりです。', `${m}分 = ${fracHTML(m, 60)} 時間 = ${frHTML(new Fr(m, 60), false)} 時間${new Fr(m, 60).terminating() ? ` = ${new Fr(m, 60).toDec()} 時間` : ''}`, `だから ${left} = ${ansHTML(val)} 時間${val.terminating() ? '' : ` (${frHTML(val, false)} でも正解)`}`) };
  }
  const mi = ri(1, 5), s = ri(1, 11) * 5;
  return { html: `${mi}分${s}秒 = <b class="box">□</b> 秒`, text: `${mi}分${s}秒 = □秒`, slots: [slot(mi * 60 + s, '秒')], explain: () => figFrames(minuteLine(mi * 60 + s, '秒', '分'), '1分 = 60秒 です。数直線の大きい目もりが 1分 (60秒) です。', `${mi}分 = ${mi * 60}秒。${mi * 60} + ${s} = ${mi * 60 + s}秒`) };
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
    const tb = figTable(['', 'm', 'cm'], add
      ? [[`${a1} m ${a2} cm`, a1, a2], [`+ ${b1} m ${b2} cm`, b1, b2], ...(a2 + b2 >= 100 ? [['くり上がり', '+1', '−100']] : []), ['答え', `<b>${m}</b>`, `<b>${c}</b>`]]
      : [[`${a1} m ${a2} cm`, a1, a2], ...(a2 >= b2 ? [] : [['1 m を cm に', '−1', '+100']]), [`− ${b1} m ${b2} cm`, b1, b2], ['答え', `<b>${m}</b>`, `<b>${c}</b>`]], { sumRow: add ? (a2 + b2 >= 100 ? 3 : 2) : (a2 >= b2 ? 2 : 3) });
    const fr = (add
      ? textFrames('m は m どうし、cm は cm どうし計算します。', `cm: ${a2} + ${b2} = ${a2 + b2} cm${a2 + b2 >= 100 ? `。100 cm = 1 m なので、1 m くり上げて ${a2 + b2 - 100} cm` : ''}`, `m: ${a1} + ${b1}${a2 + b2 >= 100 ? ' + 1' : ''} = ${m} m。答えは ${m} m ${c} cm`)
      : textFrames('m は m どうし、cm は cm どうし計算します。', a2 >= b2 ? `cm: ${a2} − ${b2} = ${c} cm` : `cm: ${a2} − ${b2} はひけないので、1 m (= 100 cm) をかりて ${a2 + 100} − ${b2} = ${c} cm`, `m: ${a1}${a2 >= b2 ? '' : ' − 1'} − ${b1} = ${m} m。答えは ${m} m ${c} cm`)).map((f) => ({ ...f, fig: tb }));
    return { html: `${a1} m ${a2} cm ${op} ${b1} m ${b2} cm = <b class="box">□</b> m <b class="box">□</b> cm`, text: `${a1}m${a2}cm ${op} ${b1}m${b2}cm`, slots: [slot(m, 'm'), slot(c, 'cm')], explain: () => fr };
  }
  if (v === 2) {
    const [big, small, ratio] = pick([['kg', 'g', 1000], ['km', 'm', 1000], ['L', 'mL', 1000], ['m', 'cm', 100]]);
    const a = ri(1, 9), b = ratio === 1000 ? pick([ri(1, 9) * 100, ri(1, 99) * 10, ri(1, 999), 50, 5]) : ri(1, 99);
    const val = new Fr(a * ratio + b, ratio);
    return { html: `${a} ${big} ${b} ${small} = <b class="box">□</b> ${big}`, text: `${a}${big}${b}${small} = □${big}`, slots: [slot(val, big)], explain: () => figFrames(figUnitPlace(big, small, ratio, val), `1 ${big} = ${ratio} ${small} なので、${b} ${small} = ${b} ÷ ${ratio} = ${new Fr(b, ratio).toDec()} ${big}<br><small>表で、${small} の数字が ${big} の小数点より右に入ります。</small>`, `${a} + ${new Fr(b, ratio).toDec()} = ${val.toDec()} ${big}`) };
  }
  const L = ri(1, 9), d = ri(1, 9);
  return { html: `${L} L ${d} dL = <b class="box">□</b> dL`, text: `${L}L${d}dL = □dL`, slots: [slot(L * 10 + d, 'dL')], explain: () => figFrames(figTable(['', 'L', 'dL'], [[`${L} L ${d} dL`, L, d], ['dL だけで', '', `${L} × 10 + ${d} = <b>${L * 10 + d}</b>`]]), '1 L = 10 dL です。', `${L} L = ${L * 10} dL。${L * 10} + ${d} = ${L * 10 + d} dL`) };
};
GEN.speed_conv = () => {
  const v = ri(0, 4);
  if (v === 0) { const X = ri(2, 30) * 3; const ans = new Fr(X * 1000, 60); if (!ans.isInt()) return GEN.speed_conv();
    return { html: `時速 ${X} km = 分速 <b class="box">□</b> m`, text: `時速${X}km = 分速□m`, slots: [slot(ans, 'm')], explain: () => figFrames(rateFig('道のり (m)', '時間 (分)', [{ pos: 1, t: String(ans.n), b: '1', ut: true }, { pos: 60, t: String(X * 1000), b: '60' }]), `時速 ${X} km は、1時間 (60分) に ${X} km = ${X * 1000} m 進む速さです。`, `1分あたりにすると、${X * 1000} ÷ 60 = ${ans.n} m。分速 ${ans.n} m`) }; }
  if (v === 1) { const Y = ri(2, 30) * 30; const ans = new Fr(Y, 60);
    return { html: `分速 ${Y} m = 秒速 <b class="box">□</b> m`, text: `分速${Y}m = 秒速□m`, slots: [slot(ans, 'm')], explain: () => figFrames(rateFig('道のり (m)', '時間 (秒)', [{ pos: 1, t: ans.toDec(), b: '1', ut: true }, { pos: 60, t: String(Y), b: '60' }]), `分速 ${Y} m は、1分 (60秒) に ${Y} m 進む速さです。`, `1秒あたりにすると、${Y} ÷ 60 = ${ans.toDec()} m`) }; }
  if (v === 2) { const Z = ri(2, 30); const ans = new Fr(Z * 3600, 1000);
    return { html: `秒速 ${Z} m = 時速 <b class="box">□</b> km`, text: `秒速${Z}m = 時速□km`, slots: [slot(ans, 'km')], explain: () => figFrames(rateFig('道のり', '時間 (秒)', [{ pos: 1, t: `${Z} m`, b: '1' }, { pos: 3600, t: `${ans.toDec()} km`, b: '3600', ut: true }]), `1時間 = 60分 = 3600秒 です。`, `1時間に進むのは ${Z} × 3600 = ${Z * 3600} m。`, `${Z * 3600} m = ${ans.toDec()} km。時速 ${ans.toDec()} km`) }; }
  if (v === 3) { const Y = ri(1, 20) * 50; const ans = new Fr(Y * 60, 1000);
    return { html: `分速 ${Y} m = 時速 <b class="box">□</b> km`, text: `分速${Y}m = 時速□km`, slots: [slot(ans, 'km')], explain: () => figFrames(rateFig('道のり', '時間 (分)', [{ pos: 1, t: `${Y} m`, b: '1' }, { pos: 60, t: `${ans.toDec()} km`, b: '60', ut: true }]), '1時間 = 60分 です。', `1時間に進むのは ${Y} × 60 = ${Y * 60} m。`, `${Y * 60} m = ${ans.toDec()} km。時速 ${ans.toDec()} km`) }; }
  const X = ri(1, 6) * 18; const ans = new Fr(X * 1000, 3600);
  return { html: `時速 ${X} km = 秒速 <b class="box">□</b> m`, text: `時速${X}km = 秒速□m`, slots: [slot(ans, 'm')], explain: () => figFrames(rateFig('道のり (m)', '時間 (秒)', [{ pos: 1, t: ans.toDec(), b: '1', ut: true }, { pos: 3600, t: String(X * 1000), b: '3600' }]), `時速 ${X} km は、1時間 (3600秒) に ${X * 1000} m 進む速さです。`, `1秒あたりにすると、${X * 1000} ÷ 3600 = ${ans.toDec()} m。秒速 ${ans.toDec()} m`) };
};
// 二本の数直線 (速さ・単位量あたり): known = [上, 下] の組、ask = [上, 下] の組 (□ はどちらか)
function rateFig(top, bot, pairs) {
  // 下の目もりが何倍になったかを、上にも同じ矢印で示す (比例の関係)
  const arrows = [];
  const k = pairs.find((p) => !p.ut && !p.ub), u = pairs.find((p) => p.ut);
  if (k && u && !pairs.some((p) => p.ub)) {
    const r = u.pos / k.pos; const near = (x) => Math.abs(x - Math.round(x)) < 1e-9;
    const s = near(r) ? `×${Math.round(r)}` : near(1 / r) ? `÷${Math.round(1 / r)}` : near(r * 10) ? `×${(Math.round(r * 10) / 10)}` : null;
    if (s) arrows.push({ from: k.pos, to: u.pos, s, side: 'top' }, { from: k.pos, to: u.pos, s, side: 'bot' });
  }
  return figDoubleLine({ top, bot, cols: [{ pos: 0, t: '0', b: '0' }, ...pairs.map((p) => ({ pos: p.pos, t: p.t, b: p.b, ut: p.ut, ub: p.ub }))], arrows, label: `${top}と${bot}の二本の数直線` });
}
function minText(M) { const h = Math.floor(M / 60), m = M % 60; return h && m ? `${h}時間${m}分` : h ? `${h}時間` : `${m}分`; }
GEN.speed = () => {
  const v = ri(0, 3);
  if (v === 0) {
    let S, M, D;
    do { S = ri(4, 20) * 5; M = pick([20, 30, 40, 45, 90, 100, 150, 75, 80]); D = new Fr(S * M, 60); } while (D.decPlaces() > 1);
    const H = new Fr(M, 60);
    return { html: `時速 ${S} km で ${minText(M)} 進むと、道のりは <b class="box">□</b> km`, text: `時速${S}kmで${minText(M)} → □km`, slots: [slot(D, 'km')], explain: () => figFrames(rateFig('道のり (km)', '時間', [{ pos: 1, t: String(S), b: '1時間' }, { pos: H.val(), t: D.toDec(), b: minText(M), ut: true }]), '道のり = 速さ × 時間 です。二本の数直線で、1時間に ${S} km 進むようすを表します。'.replace('${S}', S), `速さが「時速」なので、時間を「時間」の単位にそろえます: ${minText(M)} = ${frHTML(H, false)} 時間${H.terminating() ? ` = ${H.toDec()} 時間` : ''}`, `${S} × ${frHTML(H, false)} = ${D.toDec()} km`) };
  }
  if (v === 1) {
    let V, D, T;
    do { V = ri(5, 20) * 5; T = ri(8, 40); D = new Fr(V * T, 1000); } while (D.decPlaces() > 2);
    return { html: `${D.toDec()} km の道のりを 分速 ${V} m で歩くと、<b class="box">□</b> 分かかる`, text: `${D.toDec()}km を分速${V}m → □分`, slots: [slot(T, '分')], explain: () => figFrames(rateFig('道のり (m)', '時間 (分)', [{ pos: 1, t: String(V), b: '1' }, { pos: T, t: String(V * T), b: String(T), ub: true }]), '時間 = 道のり ÷ 速さ です。1分に ' + V + ' m 進みます。', `速さが「m」なので、道のりも m にそろえます: ${D.toDec()} km = ${V * T} m`, `${V * T} ÷ ${V} = ${T} 分`) };
  }
  if (v === 2) {
    let D, T, S;
    do { T = pick([20, 30, 40, 45, 15, 90, 120]); S = ri(3, 18) * 5; D = new Fr(S * T, 60); } while (D.decPlaces() > 1);
    return { html: `${D.toDec()} km を ${minText(T)} で走る車の速さは、時速 <b class="box">□</b> km`, text: `${D.toDec()}kmを${minText(T)} → 時速□km`, slots: [slot(S, 'km')], explain: () => figFrames(rateFig('道のり (km)', '時間', [{ pos: 60, t: String(S), b: '1時間', ut: true }, { pos: T, t: D.toDec(), b: minText(T) }]), '速さ = 道のり ÷ 時間 です。1時間 (60分) あたりに進む道のりを求めます。', `時速を求めるので、時間を「時間」の単位にそろえます: ${minText(T)} = ${frHTML(new Fr(T, 60), false)} 時間`, `${D.toDec()} ÷ ${frHTML(new Fr(T, 60), false)} = ${S}。時速 ${S} km`, `<small>別の考え方: ${minText(T)}で ${D.toDec()} km → 60分では ${D.toDec()} × 60 ÷ ${T} = ${S} km</small>`) };
  }
  let V, T, D;
  do { V = ri(3, 20) * 10; T = ri(5, 45); D = new Fr(V * T, 1000); } while (D.decPlaces() > 2);
  return { html: `分速 ${V} m で ${T} 分 進むと、道のりは <b class="box">□</b> km`, text: `分速${V}mで${T}分 → □km`, slots: [slot(D, 'km')], explain: () => figFrames(rateFig('道のり (m)', '時間 (分)', [{ pos: 1, t: String(V), b: '1' }, { pos: T, t: String(V * T), b: String(T), ut: true }]), '道のり = 速さ × 時間 です。', `${V} × ${T} = ${V * T} m`, `答えは km なので、${V * T} m = ${D.toDec()} km`) };
};
GEN.per_unit = () => {
  const v = ri(0, 2);
  if (v === 0) { const N = pick(['2', '3', '4', '5', '6', '1.5', '2.5', '0.8']); const u = ri(3, 30) * 10; const P = Fr.dec(N).mul(u); if (!P.isInt()) return GEN.per_unit();
    return { html: `${N} m で ${P.n} 円のリボン。1 m あたりのねだんは <b class="box">□</b> 円`, text: `${N}mで${P.n}円 → 1mあたり□円`, slots: [slot(u, '円')], explain: () => figFrames(rateFig('代金 (円)', '長さ (m)', [{ pos: 1, t: String(u), b: '1', ut: true }, { pos: N, t: String(P.n), b: String(N) }]), '1あたりの量 = 全体の量 ÷ いくつ分 です。数直線で、${N} m から 1 m にもどります。'.replace('${N}', N), `${P.n} ÷ ${N} = ${u} 円`) }; }
  if (v === 1) { const A = ri(4, 40); const dns = ri(5, 90) * 10; const B = A * dns;
    return { html: `面積 ${A} km² の町に ${B} 人が住んでいます。人口密度 (1 km² あたりの人数) は <b class="box">□</b> 人`, text: `${A}km²に${B}人 → 人口密度□人`, slots: [slot(dns, '人')], explain: () => figFrames(rateFig('人数 (人)', '面積 (km²)', [{ pos: 1, t: String(dns), b: '1', ut: true }, { pos: A, t: String(B), b: String(A) }]), '人口密度 = 人数 ÷ 面積 (km²) です。1 km² あたりの人数を求めます。', `${B} ÷ ${A} = ${dns} 人`) }; }
  const L = ri(5, 40); const k = ri(8, 25); const D = L * k;
  return { html: `ガソリン ${L} L で ${D} km 走る車。1 L あたり <b class="box">□</b> km 走る`, text: `${L}Lで${D}km → 1Lあたり□km`, slots: [slot(k, 'km')], explain: () => figFrames(rateFig('道のり (km)', 'ガソリン (L)', [{ pos: 1, t: String(k), b: '1', ut: true }, { pos: L, t: String(D), b: String(L) }]), '1 L あたりの道のり = 道のり ÷ ガソリンの量 です。', `${D} ÷ ${L} = ${k} km`) };
};
GEN.per_total = () => {
  const v = ri(0, 1);
  if (v === 0) { const u = ri(4, 40) * 5; const N = pick(['2.4', '3.5', '1.2', '0.6', '4', '2.5', '1.8']); const P = Fr.dec(N).mul(u); if (!P.isInt()) return GEN.per_total();
    return { html: `1 m あたり ${u} 円のロープを ${N} m 買うと、代金は <b class="box">□</b> 円`, text: `1mあたり${u}円 × ${N}m → □円`, slots: [slot(P, '円')], explain: () => figFrames(rateFig('代金 (円)', '長さ (m)', [{ pos: 1, t: String(u), b: '1' }, { pos: Fr.dec(String(N)).val(), t: String(P.n), b: String(N), ut: true }]), '全体の量 = 1あたりの量 × いくつ分 です。', `${u} × ${N} = ${P.n} 円`) }; }
  const u = ri(4, 40) * 5; const N = pick(['2.4', '3.5', '1.2', '0.6', '4', '2.5', '1.8', '6']); const P = Fr.dec(N).mul(u); if (!P.isInt()) return GEN.per_total();
  return { html: `1 m あたり ${u} 円のロープを ${P.n} 円分買うと、長さは <b class="box">□</b> m`, text: `1mあたり${u}円で${P.n}円分 → □m`, slots: [slot(Fr.dec(N), 'm')], explain: () => figFrames(rateFig('代金 (円)', '長さ (m)', [{ pos: 1, t: String(u), b: '1' }, { pos: Fr.dec(String(N)).val(), t: String(P.n), b: String(N), ub: true }]), 'いくつ分 = 全体の量 ÷ 1あたりの量 です。', `${P.n} ÷ ${u} = ${N} m`) };
};
GEN.compare = () => {
  const v = ri(0, 1);
  if (v === 0) {
    let a1, p1, a2, p2, r1, r2;
    do { a1 = ri(6, 15); p1 = ri(3, 12); a2 = ri(6, 15); p2 = ri(3, 12); r1 = new Fr(p1, a1); r2 = new Fr(p2, a2); } while (Math.abs(r1.val() - r2.val()) < 0.02 || a1 === a2 || p1 === p2);
    const ans = r1.cmp(r2) > 0 ? 'A' : 'B';
    const fmtR = (r) => (r.decPlaces() <= 3 ? r.toDec() : (Math.floor(r.val() * 1000) / 1000).toFixed(3) + '…');
    const d1 = fmtR(r1), d2 = fmtR(r2);
    return { html: `A の部屋: ${a1} m² に ${p1} 人<br>B の部屋: ${a2} m² に ${p2} 人`, text: `A:${a1}m²に${p1}人 / B:${a2}m²に${p2}人`, lead: 'こんでいるのはどちら？', choices: [{ id: 'A', html: 'A の部屋' }, { id: 'B', html: 'B の部屋' }], answerChoice: ans, slots: [], explain: () => figFrames(figTable(['', '面積 (m²)', '人数 (人)', '1 m² あたり (人)'], [['A', a1, p1, `<b>${d1}</b>`], ['B', a2, p2, `<b>${d2}</b>`]]) + figBars([{ s: 'A', v: r1.val(), label: d1 }, { s: 'B', v: r2.val(), label: d2, cls: 'sh3' }], ' 人/m²'), '面積も人数もちがうので、表のいちばん右の列「1 m² あたりの人数」にそろえてくらべます。', `A: ${p1} ÷ ${a1} = ${d1} 人<br>B: ${p2} ÷ ${a2} = ${d2} 人`, `1 m² あたりの人数が多い ${ans} のほうがこんでいます。<br><small>「1人あたりの面積」でくらべることもできます。その場合は、面積が小さいほうがこんでいます。</small>`) };
  }
  let n1, y1, n2, y2, r1, r2;
  do { n1 = ri(2, 6); n2 = ri(2, 8); y1 = n1 * ri(30, 120); y2 = n2 * ri(30, 120); r1 = new Fr(y1, n1); r2 = new Fr(y2, n2); } while (r1.cmp(r2) === 0 || n1 === n2);
  const ans = r1.cmp(r2) < 0 ? 'A' : 'B';
  return { html: `A: えんぴつ ${n1} 本で ${y1} 円<br>B: えんぴつ ${n2} 本で ${y2} 円`, text: `A:${n1}本${y1}円 / B:${n2}本${y2}円`, lead: '1本あたりが安いのはどちら？', choices: [{ id: 'A', html: 'A' }, { id: 'B', html: 'B' }], answerChoice: ans, slots: [], explain: () => figFrames(figTable(['', '本数', '代金 (円)', '1本あたり (円)'], [['A', n1, y1, `<b>${r1.n}</b>`], ['B', n2, y2, `<b>${r2.n}</b>`]]) + figBars([{ s: 'A', v: r1.val(), label: String(r1.n) }, { s: 'B', v: r2.val(), label: String(r2.n), cls: 'sh3' }], ' 円'), '本数がちがうので、表のいちばん右の列「1本あたりのねだん」にそろえてくらべます。', `A: ${y1} ÷ ${n1} = ${r1.n} 円<br>B: ${y2} ÷ ${n2} = ${r2.n} 円`, `1本あたりが安いのは ${ans} です。`) };
};

// ===== 読みもの: 計算の順番のわけ =====
// テープ図: rows = [{ s, segs: [{ w, s, cls }], braces: [{ from, to, s, side }], total }]  w は量 (同じ図の中で同じ縮尺)
function figTapes(rows, o = {}) {
  const W = 540, x0 = 104, TW = 400;
  const max = o.max || Math.max(...rows.map((r) => r.segs.reduce((a, s) => a + s.w, 0)));
  const k = TW / max;
  let y = 8; let b = '';
  rows.forEach((r) => {
    const top = (r.braces || []).some((x) => x.side !== 'bot'); const bot = (r.braces || []).some((x) => x.side === 'bot');
    if (top) y += 30;
    const xs = []; let x = x0;
    r.segs.forEach((s) => { xs.push([x, s.w * k]); b += `<rect class="${s.cls || 'sh'}" x="${r1(x)}" y="${y}" width="${r1(s.w * k)}" height="34"/>` + svgText(x + s.w * k / 2, y + 22, s.s, 'b'); x += s.w * k; });
    b += svgText(x0 - 10, y + 22, r.s, r.lcls || '', 'end');
    if (r.total) b += svgText(x + 8, y + 22, r.total, 'm', 'start');
    (r.braces || []).forEach((br) => {
      const xa = xs[br.from][0] + 2, xb = xs[br.to][0] + xs[br.to][1] - 2; const up = br.side !== 'bot';
      const yb = up ? y - 4 : y + 38; const d = up ? -8 : 8; const xm = (xa + xb) / 2;
      b += `<path class="ac" d="M${r1(xa)} ${yb} q0 ${d} 8 ${d} L${r1(xm - 8)} ${yb + d} q8 0 8 ${d} q0 ${-d} 8 ${-d} L${r1(xb - 8)} ${yb + d} q8 0 8 ${-d}"/>` + svgText(xm, up ? yb + 2 * d - 6 : yb + 2 * d + 14, br.s, 'm');
    });
    y += 34 + (bot ? 36 : 0) + 14;
  });
  return svgBox(W, y, b, o.label || 'テープ図');
}
// 計算の「段」: かっこ → × ÷ → + −。上の段でできた数が、下の段の材料になる
function figLevels(hl) {
  const W = 540; let b = '';
  const lv = [
    ['① かっこ ( )', 'ここを先に 1つにまとめたい、という しるし'],
    ['② × ÷', '同じ数のまとまりを作る・分ける → 1つの数ができる'],
    ['③ + −', 'できた数どうしを あわせる・とる'],
  ];
  lv.forEach(([h, s], i) => {
    const y = 10 + i * 66; const x = 30 + i * 20;
    b += `<rect class="${hl === i ? 'sh2' : i === 1 ? 'sh' : i === 2 ? 'sh3' : 'bx'}" x="${x}" y="${y}" width="${W - 60 - i * 40}" height="46" rx="8"/>` + svgText(x + 14, y + 20, h, 'b', 'start') + svgText(x + 14, y + 38, s, 's', 'start');
    if (i < 2) b += `<path class="ac" d="M${W / 2} ${y + 48} l0 14 m-6 -6 l6 6 l6 -6"/>` + svgText(W / 2 + 12, y + 60, 'できた数を 下の段へ', 's', 'start');
  });
  b += svgText(W - 20, 216, '同じ段どうしは 左から順に', 'm', 'end');
  return svgBox(W, 224, b, '計算の順番の段');
}
function orderWhyFrames() {
  const note = (s) => ({ w: 100, s, cls: 'sh' }); const pen = (s = 80) => ({ w: 80, s: String(s), cls: 'sh3' });
  return [
    { fig: figTapes([{ s: '代金', segs: [note('ノート 100'), pen('えんぴつ 80'), pen(), pen()], braces: [{ from: 1, to: 3, s: '80 × 3' }] }], { label: 'ノートとえんぴつの代金のテープ図' }),
      text: '<b>かけ算は「同じ数のたし算」を短く書いたもの</b><br>100円のノートを 1さつと、80円のえんぴつを 3本 買いました。代金はいくら？<br>えんぴつ代は 80 + 80 + 80。同じ数を何回もたすので、かけ算で <b>80 × 3</b> と短く書けます。だから式は <b>100 + 80 × 3</b> です。' },
    { fig: figTapes([{ s: '代金', segs: [note('ノート 100'), pen('えんぴつ 80'), pen(), pen()], braces: [{ from: 1, to: 3, s: '80 × 3 = 240 (えんぴつ代)' }, { from: 0, to: 3, s: '100 + 240 = 340', side: 'bot' }] }], { label: '代金のテープ図' }),
      text: '<b>80 × 3 は、それだけで 1つの数</b><br>80 × 3 は「えんぴつ代 240円」という 1つの まとまりの数です。ノート代 100円と あわせる相手は、えんぴつ1本ではなく、この えんぴつ代です。<br>だから、まとまり (×) を先に出してから あわせます: 100 + 240 = <b>340円</b>' },
    { fig: figTapes([
      { s: '正しい', segs: [note('ノート'), pen('えんぴつ'), pen('えんぴつ'), pen('えんぴつ')], total: '340円' },
      { s: '左から', lcls: 'm', segs: [note('ノート'), pen('えんぴつ'), note('ノート'), pen('えんぴつ'), note('ノート'), pen('えんぴつ')], total: '540円' },
    ], { label: '正しい順番と左から計算したときのテープ図' }),
      text: '<b>もし 左から順に計算すると？</b><br>100 + 80 を先にして 180、それを 3倍すると 540円。これは「ノート1さつ と えんぴつ1本」のセットを 3つ 買った代金です。ノートが 3さつに ふえてしまいました。<br>計算の順番を変えると、<b>式の意味 (何を何こ買ったか) が変わる</b>ので、答えも変わります。' },
    { fig: figTapes([
      { s: 'ケーキ', segs: [{ w: 200, s: '1人分 200', cls: 'sh2' }, { w: 200, s: '200', cls: 'sh3' }, { w: 200, s: '200', cls: 'sh3' }], braces: [{ from: 0, to: 2, s: '600 ÷ 3' }] },
      { s: 'もちもの', segs: [{ w: 200, s: 'はらう 200', cls: 'sh2' }, { w: 300, s: 'のこり 300', cls: 'sh' }], total: '500円' },
    ], { label: 'わり算の順番のテープ図' }),
      text: '<b>わり算も、かけ算と同じ なかま</b><br>500円 持っています。600円のケーキを 3人で 同じだけ出しあいました。のこりは？ 式は <b>500 − 600 ÷ 3</b>。<br>600 ÷ 3 は「1人分 200円」という 1つの数です。ひく相手は この1人分なので、先に出します: 500 − 200 = <b>300円</b><br><small>÷ は「同じ数ずつに分ける」計算で、× の反対です。だから × と ÷ は同じ段の なかまです。</small>' },
    { fig: '<div class="figcap">正しい順番 (左から): ① 3こ 食べる → ② 2こ もらう</div>' + figNumberLine({ min: 0, max: 10, marks: [{ v: 0, s: '0' }, { v: 10, s: '10' }, { v: 7, s: '7' }], jumps: [{ a: 10, b: 7, s: '① −3' }], label: '10 − 3' }) + figNumberLine({ min: 0, max: 10, marks: [{ v: 0, s: '0' }, { v: 7, s: '7' }, { v: 9, s: '9こ', cls: 'm' }], jumps: [{ a: 7, b: 9, s: '② +2' }], label: '7 + 2' })
      + '<div class="figcap">右の 3 + 2 を先にすると: 5こ とってしまう</div>' + figNumberLine({ min: 0, max: 10, marks: [{ v: 0, s: '0' }, { v: 10, s: '10' }, { v: 5, s: '5こ' }], jumps: [{ a: 10, b: 5, s: '−(3+2)' }], label: '10 − 5' }),
      text: '<b>同じ段どうしは、左から順に</b><br>あめが 10こ。3こ 食べて、2こ もらいました: <b>10 − 3 + 2 = 9こ</b>。<br>もし右の 3 + 2 を先にすると 10 − 5 = 5こ。「2こ もらった」が「2こ 食べた」に変わってしまいます。+ と − は同じ段なので、お話の じゅんばん (書いた順) に計算します。<br><small>× と ÷ も同じ: 12 ÷ 2 × 3 は「12 を 2つに分けた1つ分 (6) の 3つ分」で 18。</small>' },
    { fig: figTapes([{ s: 'セット×3', segs: [note('ノート'), pen('えんぴつ'), note('ノート'), pen('えんぴつ'), note('ノート'), pen('えんぴつ')], braces: [{ from: 0, to: 1, s: '100 + 80 = 180' }, { from: 0, to: 5, s: '(100 + 80) × 3 = 540', side: 'bot' }] }], { label: 'かっこのテープ図' }),
      text: '<b>かっこは「ここを先に まとめたい」ときの しるし</b><br>「ノートと えんぴつの セット」を 3つ 買うなら、セットの代金 100 + 80 を先に 1つの数にしたいので、かっこを使って <b>(100 + 80) × 3</b> と書きます。<br>かっこがあれば、そこが いちばん先です。' },
    { fig: figLevels(),
      text: '<b>まとめ</b><br>× ÷ は「同じ数のまとまり」を作ったり分けたりして、1つの数を作る計算。+ − は、できた数どうしを あわせたり とったりする計算。<br>だから、<b>まず まとまり (× ÷) を作り、それから あわせる・とる (+ −)</b>。かっこは、自分で「ここを先に」と決めた まとまりです。<br>この順番は、式の意味 (お話) を 1つに決めるための、みんなの約束です。' },
  ];
}
const LESSONS = { order: { title: '計算の順番のわけ', frames: orderWhyFrames } };

function makeProblem(type, level) {
  const p = GEN[type](level);
  p.type = type; p.stage = stageOfType(type); p.level = STAGES[p.stage].levels ? level : null;
  p.answerText = p.choices ? (p.choices.find((c) => c.id === p.answerChoice).text || p.choices.find((c) => c.id === p.answerChoice).html)
    : p.slots.map((s) => `${ansText(s.value, s.prefer)}${s.unit ? ' ' + s.unit : ''}`).join(' ');
  p.answerHTML = p.choices ? p.choices.find((c) => c.id === p.answerChoice).html
    : p.slots.map((s) => `${ansHTML(s.value, s.prefer)}${s.unit ? ' ' + s.unit : ''}`).join(' ');
  return p;
}

if (typeof module !== 'undefined') module.exports = { Fr, GEN, makeProblem, LESSONS, STAGES, TRACKS, LEVEL_RAMP, levelTypes, judgeSlot, parseAnswer, addSubFrames, mulFrames, divFrames, exprSteps, gridHTML, setRnd: (f) => { rnd = f; } };
