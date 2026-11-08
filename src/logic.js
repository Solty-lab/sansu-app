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
  B5: { track: 'B', name: '単位も計算する (密度など)', types: ['unit_of', 'unit_check', 'density'] },
  C1: { track: 'C', name: 'お金の計算 (おつり・消費税・割引き)', types: ['m_change', 'm_tax', 'm_discount'] },
  C2: { track: 'C', name: 'ねだんの決まり方 (仕入れ・お得)', types: ['m_cost', 'm_value'] },
  C3: { track: 'C', name: '通貨と利息 (為替・ためる)', types: ['m_fx', 'm_interest'] },
  C4: { track: 'C', name: '税金のしくみ (使い道・1人あたり・所得税)', types: ['t_share', 't_per', 't_income', 't_year'] },
};
for (const st of Object.values(STAGES)) if (st.levels) st.types = [...new Set(Object.values(st.levels).flatMap((l) => l.types))];
const LEVEL_RAMP = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]; // 10問の何問目がどのレベルか
const TRACKS = { A: { name: '計算のしくみ', stages: ['A1', 'A2', 'A3', 'A4'] }, B: { name: '単位と速さ', stages: ['B1', 'B2', 'B3', 'B4', 'B5'] }, C: { name: 'お金とくらし', stages: ['C1', 'C2', 'C3', 'C4'] } };
const TYPE_NAMES = {
  int_add: '整数のたし算', int_sub: '整数のひき算', int_mul: '整数のかけ算', int_div: '整数のわり算', mental: '暗算のくふう',
  dec_add: '小数のたし算', dec_sub: '小数のひき算', dec_mul: '小数のかけ算', dec_div: '小数のわり算',
  fr_add: '分数のたし算', fr_sub: '分数のひき算', fr_mul: '分数のかけ算', fr_div: '分数のわり算',
  mix_calc: 'まぜた計算', order: '計算の順番',
  conv: '単位のかんさん', time_mix: '時間の組み合わせ', len_mix: '長さ・重さの組み合わせ', speed_conv: '速さの単位',
  speed: '速さの問題', per_unit: '1あたりを求める', per_total: '1あたりから求める', compare: 'くらべる',
  unit_of: '答えの単位', unit_check: '単位で式をたしかめる', density: '密度',
  m_change: 'おつり', m_tax: '消費税', m_discount: '割引き', m_cost: 'ねだんの内わけ・仕入れ', m_value: 'お得をくらべる', m_fx: '為替 (円とドル)', m_interest: '利息', t_share: '税金の使い道 (割合)', t_per: '1人あたりの税金', t_income: '所得税の計算', t_year: '1年の消費税',
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
  return { html, text, slots: [toSmall ? slot(S, small) : slot(L, big)], units: () => [toSmall ? convUnitFrame(Ls, big, Ss, small, [ratio, small], [1, big], `${Ls} × ${ratio} = ${Ss}`) : convUnitFrame(Ss, small, Ls, big, [1, big], [ratio, small], `${Ss} ÷ ${ratio} = ${Ls}`)], explain: () => frames };
};
GEN.time_mix = () => {
  const v = ri(0, 3);
  if (v === 0) {
    const h = ri(1, 3), m = ri(1, 11) * 5;
    return { html: `${h}時間${m}分 = <b class="box">□</b> 分`, text: `${h}時間${m}分 = □分`, slots: [slot(h * 60 + m, '分')], units: () => [convUnitFrame(h, '時間', h * 60, '分', [60, '分'], [1, '時間'], `${h} × 60 = ${h * 60}。のこりの ${m}分 とあわせて ${h * 60 + m}分`)], explain: () => figFrames(minuteLine(h * 60 + m), '1時間 = 60分 です。数直線の大きい目もりが 1時間 (60分) です。', `${h}時間 = 60 × ${h} = ${h * 60}分。${h * 60} + ${m} = ${h * 60 + m}分`) };
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
    return { html: `${left} = <b class="box">□</b> 時間`, text: `${left} = □時間`, slots: [slot(val, '時間')], note: '小数か分数で答えよう', units: () => [convUnitFrame(h * 60 + m, '分', frText(val, false), '時間', [1, '時間'], [60, '分'], `${h * 60 + m} ÷ 60 = ${frText(val, false)}`)], explain: () => figFrames(figDoubleLine({ top: '分', bot: '時間', cols: [{ pos: 0, t: '0', b: '0' }, { pos: 60, t: '60', b: '1' }, { pos: h * 60 + m, t: String(h * 60 + m), b: ansText(val), ub: true }], arrows: [{ from: 60, to: h * 60 + m, s: `×${frText(val)}`, side: 'bot' }], label: '分と時間の二本の数直線' }), '1分は 1時間の 1/60 です。上が分、下が時間の目もりです。', `${m}分 = ${fracHTML(m, 60)} 時間 = ${frHTML(new Fr(m, 60), false)} 時間${new Fr(m, 60).terminating() ? ` = ${new Fr(m, 60).toDec()} 時間` : ''}`, `だから ${left} = ${ansHTML(val)} 時間${val.terminating() ? '' : ` (${frHTML(val, false)} でも正解)`}`) };
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
    return { html: `時速 ${X} km = 分速 <b class="box">□</b> m`, text: `時速${X}km = 分速□m`, slots: [slot(ans, 'm')], units: () => [speedChain(X, 'km', '時間', [[1000, 'm', 1, 'km'], [1, '時間', 60, '分']], ans.toDec(), 'm', '分', `${X} × 1000 ÷ 60 = ${ans.toDec()}`)], explain: () => figFrames(rateFig('道のり (m)', '時間 (分)', [{ pos: 1, t: String(ans.n), b: '1', ut: true }, { pos: 60, t: String(X * 1000), b: '60' }]), `時速 ${X} km は、1時間 (60分) に ${X} km = ${X * 1000} m 進む速さです。`, `1分あたりにすると、${X * 1000} ÷ 60 = ${ans.n} m。分速 ${ans.n} m`) }; }
  if (v === 1) { const Y = ri(2, 30) * 30; const ans = new Fr(Y, 60);
    return { html: `分速 ${Y} m = 秒速 <b class="box">□</b> m`, text: `分速${Y}m = 秒速□m`, slots: [slot(ans, 'm')], units: () => [speedChain(Y, 'm', '分', [[1, '分', 60, '秒']], ans.toDec(), 'm', '秒', `${Y} ÷ 60 = ${ans.toDec()}`)], explain: () => figFrames(rateFig('道のり (m)', '時間 (秒)', [{ pos: 1, t: ans.toDec(), b: '1', ut: true }, { pos: 60, t: String(Y), b: '60' }]), `分速 ${Y} m は、1分 (60秒) に ${Y} m 進む速さです。`, `1秒あたりにすると、${Y} ÷ 60 = ${ans.toDec()} m`) }; }
  if (v === 2) { const Z = ri(2, 30); const ans = new Fr(Z * 3600, 1000);
    return { html: `秒速 ${Z} m = 時速 <b class="box">□</b> km`, text: `秒速${Z}m = 時速□km`, slots: [slot(ans, 'km')], units: () => [speedChain(Z, 'm', '秒', [[3600, '秒', 1, '時間'], [1, 'km', 1000, 'm']], ans.toDec(), 'km', '時間', `${Z} × 3600 ÷ 1000 = ${ans.toDec()}`)], explain: () => figFrames(rateFig('道のり', '時間 (秒)', [{ pos: 1, t: `${Z} m`, b: '1' }, { pos: 3600, t: `${ans.toDec()} km`, b: '3600', ut: true }]), `1時間 = 60分 = 3600秒 です。`, `1時間に進むのは ${Z} × 3600 = ${Z * 3600} m。`, `${Z * 3600} m = ${ans.toDec()} km。時速 ${ans.toDec()} km`) }; }
  if (v === 3) { const Y = ri(1, 20) * 50; const ans = new Fr(Y * 60, 1000);
    return { html: `分速 ${Y} m = 時速 <b class="box">□</b> km`, text: `分速${Y}m = 時速□km`, slots: [slot(ans, 'km')], units: () => [speedChain(Y, 'm', '分', [[60, '分', 1, '時間'], [1, 'km', 1000, 'm']], ans.toDec(), 'km', '時間', `${Y} × 60 ÷ 1000 = ${ans.toDec()}`)], explain: () => figFrames(rateFig('道のり', '時間 (分)', [{ pos: 1, t: `${Y} m`, b: '1' }, { pos: 60, t: `${ans.toDec()} km`, b: '60', ut: true }]), '1時間 = 60分 です。', `1時間に進むのは ${Y} × 60 = ${Y * 60} m。`, `${Y * 60} m = ${ans.toDec()} km。時速 ${ans.toDec()} km`) }; }
  const X = ri(1, 6) * 18; const ans = new Fr(X * 1000, 3600);
  return { html: `時速 ${X} km = 秒速 <b class="box">□</b> m`, text: `時速${X}km = 秒速□m`, slots: [slot(ans, 'm')], units: () => [speedChain(X, 'km', '時間', [[1000, 'm', 1, 'km'], [1, '時間', 3600, '秒']], ans.toDec(), 'm', '秒', `${X} × 1000 ÷ 3600 = ${ans.toDec()}`)], explain: () => figFrames(rateFig('道のり (m)', '時間 (秒)', [{ pos: 1, t: ans.toDec(), b: '1', ut: true }, { pos: 3600, t: String(X * 1000), b: '3600' }]), `時速 ${X} km は、1時間 (3600秒) に ${X * 1000} m 進む速さです。`, `1秒あたりにすると、${X * 1000} ÷ 3600 = ${ans.toDec()} m。秒速 ${ans.toDec()} m`) };
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
    return { html: `時速 ${S} km で ${minText(M)} 進むと、道のりは <b class="box">□</b> km`, text: `時速${S}kmで${minText(M)} → □km`, slots: [slot(D, 'km')], units: () => rateUnitFrames({ top: 'km', bot: '時間', rate: S, cnt: decOrFr(H), tot: D.toDec(), n: H, kind: 'total' }), explain: () => figFrames(rateFig('道のり (km)', '時間', [{ pos: 1, t: String(S), b: '1時間' }, { pos: H.val(), t: D.toDec(), b: minText(M), ut: true }]), '道のり = 速さ × 時間 です。二本の数直線で、1時間に ${S} km 進むようすを表します。'.replace('${S}', S), `速さが「時速」なので、時間を「時間」の単位にそろえます: ${minText(M)} = ${frHTML(H, false)} 時間${H.terminating() ? ` = ${H.toDec()} 時間` : ''}`, `${S} × ${frHTML(H, false)} = ${D.toDec()} km`) };
  }
  if (v === 1) {
    let V, D, T;
    do { V = ri(5, 20) * 5; T = ri(8, 40); D = new Fr(V * T, 1000); } while (D.decPlaces() > 2);
    return { html: `${D.toDec()} km の道のりを 分速 ${V} m で歩くと、<b class="box">□</b> 分かかる`, text: `${D.toDec()}km を分速${V}m → □分`, slots: [slot(T, '分')], units: () => rateUnitFrames({ top: 'm', bot: '分', rate: V, cnt: T, tot: V * T, n: T, kind: 'count' }), explain: () => figFrames(rateFig('道のり (m)', '時間 (分)', [{ pos: 1, t: String(V), b: '1' }, { pos: T, t: String(V * T), b: String(T), ub: true }]), '時間 = 道のり ÷ 速さ です。1分に ' + V + ' m 進みます。', `速さが「m」なので、道のりも m にそろえます: ${D.toDec()} km = ${V * T} m`, `${V * T} ÷ ${V} = ${T} 分`) };
  }
  if (v === 2) {
    let D, T, S;
    do { T = pick([20, 30, 40, 45, 15, 90, 120]); S = ri(3, 18) * 5; D = new Fr(S * T, 60); } while (D.decPlaces() > 1);
    return { html: `${D.toDec()} km を ${minText(T)} で走る車の速さは、時速 <b class="box">□</b> km`, text: `${D.toDec()}kmを${minText(T)} → 時速□km`, slots: [slot(S, 'km')], units: () => rateUnitFrames({ top: 'km', bot: '時間', rate: S, cnt: decOrFr(new Fr(T, 60)), tot: D.toDec(), n: new Fr(T, 60), kind: 'per', word: '時速' }), explain: () => figFrames(rateFig('道のり (km)', '時間', [{ pos: 60, t: String(S), b: '1時間', ut: true }, { pos: T, t: D.toDec(), b: minText(T) }]), '速さ = 道のり ÷ 時間 です。1時間 (60分) あたりに進む道のりを求めます。', `時速を求めるので、時間を「時間」の単位にそろえます: ${minText(T)} = ${frHTML(new Fr(T, 60), false)} 時間`, `${D.toDec()} ÷ ${frHTML(new Fr(T, 60), false)} = ${S}。時速 ${S} km`, `<small>別の考え方: ${minText(T)}で ${D.toDec()} km → 60分では ${D.toDec()} × 60 ÷ ${T} = ${S} km</small>`) };
  }
  let V, T, D;
  do { V = ri(3, 20) * 10; T = ri(5, 45); D = new Fr(V * T, 1000); } while (D.decPlaces() > 2);
  return { html: `分速 ${V} m で ${T} 分 進むと、道のりは <b class="box">□</b> km`, text: `分速${V}mで${T}分 → □km`, slots: [slot(D, 'km')], units: () => [...rateUnitFrames({ top: 'm', bot: '分', rate: V, cnt: T, tot: V * T, n: T, kind: 'total' }), convUnitFrame(V * T, 'm', D.toDec(), 'km', [1, 'km'], [1000, 'm'], `${V * T} ÷ 1000 = ${D.toDec()}`)], explain: () => figFrames(rateFig('道のり (m)', '時間 (分)', [{ pos: 1, t: String(V), b: '1' }, { pos: T, t: String(V * T), b: String(T), ut: true }]), '道のり = 速さ × 時間 です。', `${V} × ${T} = ${V * T} m`, `答えは km なので、${V * T} m = ${D.toDec()} km`) };
};
GEN.per_unit = () => {
  const v = ri(0, 2);
  if (v === 0) { const N = pick(['2', '3', '4', '5', '6', '1.5', '2.5', '0.8']); const u = ri(3, 30) * 10; const P = Fr.dec(N).mul(u); if (!P.isInt()) return GEN.per_unit();
    return { html: `${N} m で ${P.n} 円のリボン。1 m あたりのねだんは <b class="box">□</b> 円`, text: `${N}mで${P.n}円 → 1mあたり□円`, slots: [slot(u, '円')], units: () => rateUnitFrames({ top: '円', bot: 'm', rate: u, cnt: N, tot: P.n, n: Fr.dec(N), kind: 'per' }), explain: () => figFrames(rateFig('代金 (円)', '長さ (m)', [{ pos: 1, t: String(u), b: '1', ut: true }, { pos: N, t: String(P.n), b: String(N) }]), '1あたりの量 = 全体の量 ÷ いくつ分 です。数直線で、${N} m から 1 m にもどります。'.replace('${N}', N), `${P.n} ÷ ${N} = ${u} 円`) }; }
  if (v === 1) { const A = ri(4, 40); const dns = ri(5, 90) * 10; const B = A * dns;
    return { html: `面積 ${A} km² の町に ${B} 人が住んでいます。人口密度 (1 km² あたりの人数) は <b class="box">□</b> 人`, text: `${A}km²に${B}人 → 人口密度□人`, slots: [slot(dns, '人')], units: () => rateUnitFrames({ top: '人', bot: 'km²', rate: dns, cnt: A, tot: B, n: A, kind: 'per', word: '人口密度' }), explain: () => figFrames(rateFig('人数 (人)', '面積 (km²)', [{ pos: 1, t: String(dns), b: '1', ut: true }, { pos: A, t: String(B), b: String(A) }]), '人口密度 = 人数 ÷ 面積 (km²) です。1 km² あたりの人数を求めます。', `${B} ÷ ${A} = ${dns} 人`) }; }
  const L = ri(5, 40); const k = ri(8, 25); const D = L * k;
  return { html: `ガソリン ${L} L で ${D} km 走る車。1 L あたり <b class="box">□</b> km 走る`, text: `${L}Lで${D}km → 1Lあたり□km`, slots: [slot(k, 'km')], units: () => rateUnitFrames({ top: 'km', bot: 'L', rate: k, cnt: L, tot: D, n: L, kind: 'per' }), explain: () => figFrames(rateFig('道のり (km)', 'ガソリン (L)', [{ pos: 1, t: String(k), b: '1', ut: true }, { pos: L, t: String(D), b: String(L) }]), '1 L あたりの道のり = 道のり ÷ ガソリンの量 です。', `${D} ÷ ${L} = ${k} km`) };
};
GEN.per_total = () => {
  const v = ri(0, 1);
  if (v === 0) { const u = ri(4, 40) * 5; const N = pick(['2.4', '3.5', '1.2', '0.6', '4', '2.5', '1.8']); const P = Fr.dec(N).mul(u); if (!P.isInt()) return GEN.per_total();
    return { html: `1 m あたり ${u} 円のロープを ${N} m 買うと、代金は <b class="box">□</b> 円`, text: `1mあたり${u}円 × ${N}m → □円`, slots: [slot(P, '円')], units: () => rateUnitFrames({ top: '円', bot: 'm', rate: u, cnt: N, tot: P.n, n: Fr.dec(N), kind: 'total' }), explain: () => figFrames(rateFig('代金 (円)', '長さ (m)', [{ pos: 1, t: String(u), b: '1' }, { pos: Fr.dec(String(N)).val(), t: String(P.n), b: String(N), ut: true }]), '全体の量 = 1あたりの量 × いくつ分 です。', `${u} × ${N} = ${P.n} 円`) }; }
  const u = ri(4, 40) * 5; const N = pick(['2.4', '3.5', '1.2', '0.6', '4', '2.5', '1.8', '6']); const P = Fr.dec(N).mul(u); if (!P.isInt()) return GEN.per_total();
  return { html: `1 m あたり ${u} 円のロープを ${P.n} 円分買うと、長さは <b class="box">□</b> m`, text: `1mあたり${u}円で${P.n}円分 → □m`, slots: [slot(Fr.dec(N), 'm')], units: () => rateUnitFrames({ top: '円', bot: 'm', rate: u, cnt: N, tot: P.n, n: Fr.dec(N), kind: 'count' }), explain: () => figFrames(rateFig('代金 (円)', '長さ (m)', [{ pos: 1, t: String(u), b: '1' }, { pos: Fr.dec(String(N)).val(), t: String(P.n), b: String(N), ub: true }]), 'いくつ分 = 全体の量 ÷ 1あたりの量 です。', `${P.n} ÷ ${u} = ${N} m`) };
};
GEN.compare = () => {
  const v = ri(0, 1);
  if (v === 0) {
    let a1, p1, a2, p2, r1, r2;
    do { a1 = ri(6, 15); p1 = ri(3, 12); a2 = ri(6, 15); p2 = ri(3, 12); r1 = new Fr(p1, a1); r2 = new Fr(p2, a2); } while (Math.abs(r1.val() - r2.val()) < 0.02 || a1 === a2 || p1 === p2);
    const ans = r1.cmp(r2) > 0 ? 'A' : 'B';
    const fmtR = (r) => (r.decPlaces() <= 3 ? r.toDec() : (Math.floor(r.val() * 1000) / 1000).toFixed(3) + '…');
    const d1 = fmtR(r1), d2 = fmtR(r2);
    return { html: `A の部屋: ${a1} m² に ${p1} 人<br>B の部屋: ${a2} m² に ${p2} 人`, text: `A:${a1}m²に${p1}人 / B:${a2}m²に${p2}人`, lead: 'こんでいるのはどちら？', choices: [{ id: 'A', html: 'A の部屋' }, { id: 'B', html: 'B の部屋' }], answerChoice: ans, slots: [], units: () => [compareUnitFrame('人', 'm²', [[ 'A', p1, a1, d1], ['B', p2, a2, d2]])], explain: () => figFrames(figTable(['', '面積 (m²)', '人数 (人)', '1 m² あたり (人)'], [['A', a1, p1, `<b>${d1}</b>`], ['B', a2, p2, `<b>${d2}</b>`]]) + figBars([{ s: 'A', v: r1.val(), label: d1 }, { s: 'B', v: r2.val(), label: d2, cls: 'sh3' }], ' 人/m²'), '面積も人数もちがうので、表のいちばん右の列「1 m² あたりの人数」にそろえてくらべます。', `A: ${p1} ÷ ${a1} = ${d1} 人<br>B: ${p2} ÷ ${a2} = ${d2} 人`, `1 m² あたりの人数が多い ${ans} のほうがこんでいます。<br><small>「1人あたりの面積」でくらべることもできます。その場合は、面積が小さいほうがこんでいます。</small>`) };
  }
  let n1, y1, n2, y2, r1, r2;
  do { n1 = ri(2, 6); n2 = ri(2, 8); y1 = n1 * ri(30, 120); y2 = n2 * ri(30, 120); r1 = new Fr(y1, n1); r2 = new Fr(y2, n2); } while (r1.cmp(r2) === 0 || n1 === n2);
  const ans = r1.cmp(r2) < 0 ? 'A' : 'B';
  return { html: `A: えんぴつ ${n1} 本で ${y1} 円<br>B: えんぴつ ${n2} 本で ${y2} 円`, text: `A:${n1}本${y1}円 / B:${n2}本${y2}円`, lead: '1本あたりが安いのはどちら？', choices: [{ id: 'A', html: 'A' }, { id: 'B', html: 'B' }], answerChoice: ans, slots: [], units: () => [compareUnitFrame('円', '本', [['A', y1, n1, String(r1.n)], ['B', y2, n2, String(r2.n)]])], explain: () => figFrames(figTable(['', '本数', '代金 (円)', '1本あたり (円)'], [['A', n1, y1, `<b>${r1.n}</b>`], ['B', n2, y2, `<b>${r2.n}</b>`]]) + figBars([{ s: 'A', v: r1.val(), label: String(r1.n) }, { s: 'B', v: r2.val(), label: String(r2.n), cls: 'sh3' }], ' 円'), '本数がちがうので、表のいちばん右の列「1本あたりのねだん」にそろえてくらべます。', `A: ${y1} ÷ ${n1} = ${r1.n} 円<br>B: ${y2} ÷ ${n2} = ${r2.n} 円`, `1本あたりが安いのは ${ans} です。`) };
};

// ===== 読みもの: 計算の順番のわけ =====
// テープ図: rows = [{ s, segs: [{ w, s, cls }], braces: [{ from, to, s, side }], total }]  w は量 (同じ図の中で同じ縮尺)
// ===== 単位も計算する (単位を式に入れる) =====
// 単位つきの量: a au / b bu (b が null なら分数にしない)
function uq(a, au, b = null, bu = '') { return { a: a === '' ? '' : String(a), au: au || '', b: b == null ? null : String(b), bu: bu || '' }; }
const uSpan = (s, x) => (s ? `<span class="u${x ? ' ux' : ''}">${s}</span>` : '');
function uqHTML(q, xa, xb) {
  const num = (x) => (x ? `<span class="n">${x}</span>` : '');
  const top = `${num(q.a)}${uSpan(q.au, xa)}` || '1';
  if (q.b == null) return `<span class="uq">${top}</span>`;
  return `<span class="uqf"><span class="t">${top}</span><span class="d">${num(q.b)}${uSpan(q.bu, xb)}</span></span>`;
}
// かけ算の列。上と下に同じ単位があれば、約分のように消す (線で消す)
function mulChain(qs) {
  const xa = qs.map(() => false), xb = qs.map(() => false);
  qs.forEach((q, i) => { if (q.b == null || !q.bu) return; const j = qs.findIndex((t, k) => t.au === q.bu && !xa[k]); if (j >= 0) { xa[j] = true; xb[i] = true; } });
  return qs.map((q, i) => uqHTML(q, xa[i], xb[i])).join(' <span class="op">×</span> ');
}
const decOrFr = (f) => (f.terminating() ? f.toDec() : frText(f));
const uop = (s) => ` <span class="op">${s}</span> `;
// 「数」「単位」などの行を並べた表
function ueq(rows, cap) {
  return (cap ? `<div class="figcap">${cap}</div>` : '') + `<div class="ueq">${rows.map(([lb, h, cls]) => `<div class="ueq-row${cls ? ' ' + cls : ''}"><span class="ueq-lb">${lb}</span><span class="ueq-body">${h}</span></div>`).join('')}</div>`;
}
// 1あたりの箱の図: 「1 bu」の箱に each ずつ入っている。それが n 箱分で total
function figPerBox(o) {
  const W = 540, x0 = 40, TW = 440, cube = !!o.cube;
  const n = Fr.of(o.n).val(); const whole = Math.floor(n + 1e-9), part = n - whole;
  const many = Math.ceil(n - 1e-9) > 7;
  const boxes = []; // [幅の割合, ラベルあり?]
  if (many) { boxes.push([1], [1], [1], ['gap'], [1]); } else { for (let i = 0; i < whole; i++) boxes.push([1]); if (part > 1e-9) boxes.push([part]); }
  const units = boxes.reduce((a, b) => a + (b[0] === 'gap' ? 0.6 : b[0]), 0);
  const bw = Math.min(140, (TW - (cube ? 14 : 0)) / units); const bh = cube ? 64 : 52; const y0 = cube ? 58 : 44; const dz = cube ? 12 : 0;
  let b = ''; let x = x0;
  boxes.forEach(([w], i) => {
    if (w === 'gap') { b += svgText(x + bw * 0.3, y0 + bh / 2 + 5, '…', 'b'); x += bw * 0.6; return; }
    const ww = w * bw;
    if (cube) b += `<path class="sh3" d="M${r1(x)} ${y0} l${dz} ${-dz} l${r1(ww)} 0 l${-dz} ${dz} z"/><path class="sh3" d="M${r1(x + ww)} ${y0} l${dz} ${-dz} l0 ${bh} l${-dz} ${dz} z"/>`;
    b += `<rect class="${w < 1 ? 'sh3' : 'sh'}" x="${r1(x)}" y="${y0}" width="${r1(ww)}" height="${bh}"/>`;
    if (w >= 1 && ww >= 44) b += svgText(x + ww / 2, y0 + bh / 2 + 6, o.each, ww < 70 ? 's' : 'b');
    if (i === 0) b += svgText(x + ww / 2, y0 + bh + 18, o.per, 'm');
    x += ww;
  });
  const xe = x;
  // 全体のかっこ (上に全体の量、下にいくつ分)
  const brace = (xa, xb, y, d, s, cls) => `<path class="ac" d="M${r1(xa)} ${y} q0 ${d} 8 ${d} L${r1((xa + xb) / 2 - 8)} ${y + d} q8 0 8 ${d} q0 ${-d} 8 ${-d} L${r1(xb - 8)} ${y + d} q8 0 8 ${-d}"/>` + svgText((xa + xb) / 2, d < 0 ? y + 2 * d - 6 : y + 2 * d + 14, s, cls);
  b += brace(x0 + 2, xe - 2, y0 - dz - 4, -8, o.total, o.ask === 'total' ? 'm' : 'b');
  b += brace(x0 + 2, xe - 2, y0 + bh + 26, 8, o.count, o.ask === 'count' ? 'm' : 'b');
  if (o.note) b += svgText(W - 8, y0 + bh + 72, o.note, 's', 'end');
  return svgBox(W, y0 + bh + (o.note ? 80 : 64), b, o.label || '1あたりの箱の図');
}
// ある「1あたり」の問題を、箱の図 + 単位の式 + 数の式 の3つの見方で
// r: { top, bot } 単位。kind: 'per' (全体÷いくつ分) | 'total' (1あたり×いくつ分) | 'count' (全体÷1あたり)
function rateUnitFrames(r) {
  const { top, bot, rate, cnt, tot, kind, word } = r; // rate, cnt, tot は表示用文字列
  const perQ = uq(rate, top, 1, bot);
  const box = figPerBox({ n: r.n, each: `${rate} ${top}`, per: `1 ${bot}`, total: `全体 ${tot} ${top}`, count: `${cnt} ${bot} ぶん`, ask: kind === 'per' ? null : kind === 'total' ? 'total' : 'count', cube: r.cube, label: `1 ${bot} あたりの箱の図` });
  if (kind === 'per') {
    return [
      { fig: box, text: `全体の ${tot} ${top} を、1 ${bot} ずつの箱に 同じだけ分けると考えます。箱 1つ分が「1 ${bot} あたり」${word ? ` (${word})` : ''}です。` },
      { fig: ueq([['数', `${tot} ÷ ${cnt} = <b>${rate}</b>`], ['単位', `${uqHTML(uq('', top))}${uop('÷')}${uqHTML(uq('', bot))}${uop('=')}${uqHTML(uq('', top, '', bot))}`], ['あわせて', `${uqHTML(uq(tot, top))}${uop('÷')}${uqHTML(uq(cnt, bot))}${uop('=')}${uqHTML(perQ)}`, 'all']], '数も単位も、同じように計算します'),
        text: `単位も式に入れて計算します。${top} を ${bot} でわると、単位は <b>${top}/${bot}</b> (「1 ${bot} あたり何 ${top}」と読みます)。<br>答えの単位を見れば、「1 ${bot} あたり」を求めたことが分かります。`, lesson: 'unit' },
    ];
  }
  if (kind === 'total') {
    return [
      { fig: box, text: `1 ${bot} の箱に ${rate} ${top} ずつ。その箱が ${cnt} 箱分あると考えます。` },
      { fig: ueq([['数', `${rate} × ${cnt} = <b>${tot}</b>`], ['単位', `${mulChain([uq('', top, '', bot), uq('', bot)])}${uop('=')}${uqHTML(uq('', top))}`], ['あわせて', `${mulChain([perQ, uq(cnt, bot)])}${uop('=')}${uqHTML(uq(tot, top))}`, 'all']], '数も単位も、同じように計算します'),
        text: `${top}/${bot} に ${bot} をかけると、下の ${bot} と かけた ${bot} が 分数の約分のように消えて、<b>${top}</b> がのこります。<br>求めたい「${top}」が のこるので、この式で正しいと たしかめられます。`, lesson: 'unit' },
    ];
  }
  return [
    { fig: box, text: `1 ${bot} の箱に ${rate} ${top} ずつ。全体の ${tot} ${top} は、箱 何こ分 かを考えます。` },
    { fig: ueq([['数', `${tot} ÷ ${rate} = <b>${cnt}</b>`], ['単位', `${uqHTML(uq('', top))}${uop('÷')}${uqHTML(uq('', top, '', bot))}${uop('=')}${mulChain([uq('', top), uq('', bot, '', top)])}${uop('=')}${uqHTML(uq('', bot))}`], ['あわせて', `${uqHTML(uq(tot, top))}${uop('÷')}${uqHTML(perQ)}${uop('=')}${uqHTML(uq(cnt, bot))}`, 'all']], '数も単位も、同じように計算します'),
      text: `${top}/${bot} でわるのは、分数のわり算と同じで、ひっくり返した ${bot}/${top} をかけることです。${top} が消えて <b>${bot}</b> がのこります。<br>求めたい「${bot}」が のこるので、この式で正しいと たしかめられます。`, lesson: 'unit' },
  ];
}
// 単位のかんさんを、「1 と同じ大きさの分数」をかける式で
function convUnitFrame(from, fromU, to, toU, factorTop, factorBot, numText) {
  const f = uq(factorTop[0], factorTop[1], factorBot[0], factorBot[1]);
  return { fig: ueq([['かんさんの もと', `${uqHTML(uq(factorBot[0], factorBot[1]))}${uop('=')}${uqHTML(uq(factorTop[0], factorTop[1]))} なので ${uqHTML(f)}${uop('=')}1`], ['単位の式', `${mulChain([uq(from, fromU), f])}${uop('=')}${uqHTML(uq(to, toU))}`, 'all'], ['数', numText]], '単位を式に入れて かんさん'),
    text: `${factorBot[0]} ${factorBot[1]} と ${factorTop[0]} ${factorTop[1]} は同じ量なので、分数 ${factorTop[0]} ${factorTop[1]}/${factorBot[0]} ${factorBot[1]} は「1」と同じ大きさです。1 をかけても量は変わらず、<b>${fromU} が上と下で消えて ${toU} がのこります</b>。<br>どちらの分数をかけるかは、消したい単位 (${fromU}) が下に来るほうを えらべば決まります。`, lesson: 'unit' };
}
// 速さの単位のかんさん: 「1」と同じ分数をならべて、いらない単位を消す
function speedChain(a, au, bu, factors, res, ru, rbu, numText) {
  const qs = [uq(a, au, 1, bu), ...factors.map(([ta, tu, ba, bb]) => uq(ta, tu, ba, bb))];
  return { fig: ueq([['単位の式', `${mulChain(qs)}${uop('=')}${uqHTML(uq(res, ru, 1, rbu))}`, 'all'], ['数', numText]], '「1」と同じ分数をかけて、単位を入れかえる'),
    text: `${factors.map(([ta, tu, ba, bb]) => `${ba} ${bb} = ${ta} ${tu}`).join('、')} なので、それぞれの分数は「1」と同じ大きさです。消したい単位が 上と下に来るように分数をならべると、<b>${ru}/${rbu}</b> がのこります。<br>のこった単位を見て、${rbu === '時間' ? '時速' : rbu === '分' ? '分速' : '秒速'} ${res} ${ru} と分かります。`, lesson: 'unit' };
}
// くらべる問題: 両方を同じ「1あたり」の単位にして、単位ごと くらべる
function compareUnitFrame(top, bot, rows) {
  return { fig: ueq(rows.map(([id, t, b, r]) => [id, `${uqHTML(uq(t, top))}${uop('÷')}${uqHTML(uq(b, bot))}${uop('=')}${uqHTML(uq(r, top, 1, bot))}`, 'all']), `どちらも ${top}/${bot} にそろえる`),
    text: `どちらも ${top} ÷ ${bot} で、同じ単位 <b>${top}/${bot}</b> (1 ${bot} あたり何 ${top}) になりました。単位がそろったので、数の大きさで くらべられます。`, lesson: 'unit' };
}
// 何かの「1あたり」の単位 (km/時間 など) を求めたり使ったりする問題
const RATE_SETS = [
  { top: 'km', bot: '時間', name: '速さ', w: '時速' }, { top: 'm', bot: '分', name: '速さ', w: '分速' },
  { top: 'g', bot: 'cm³', name: '密度' }, { top: '人', bot: 'km²', name: '人口密度' },
  { top: '円', bot: 'm', name: '1 m あたりのねだん' }, { top: 'km', bot: 'L', name: '1 L で走る道のり' }, { top: '円', bot: 'kg', name: '1 kg あたりのねだん' },
];
const unitHTML = (top, bot, x) => uqHTML(uq('', top, bot ? '' : null, bot || ''));
// 単位の かけ算・わり算のこたえ
GEN.unit_of = () => {
  const R = pick(RATE_SETS); const { top, bot } = R; const v = ri(0, 2);
  let qh, qt, ans, why;
  const per = uqHTML(uq('', top, '', bot));
  if (v === 0) { qh = `${uqHTML(uq('□', top))}${uop('÷')}${uqHTML(uq('△', bot))}`; qt = `${top} ÷ ${bot}`; ans = 'per'; }
  else if (v === 1) { qh = `${uqHTML(uq('□', top, 1, bot))}${uop('×')}${uqHTML(uq('△', bot))}`; qt = `${top}/${bot} × ${bot}`; ans = 'top'; }
  else { qh = `${uqHTML(uq('□', top))}${uop('÷')}${uqHTML(uq('△', top, 1, bot))}`; qt = `${top} ÷ ${top}/${bot}`; ans = 'bot'; }
  const opts = { per: per, top: unitHTML(top), bot: unitHTML(bot), inv: uqHTML(uq('', bot, '', top)), sq: `<span class="uq">${uSpan(top)} × ${uSpan(bot)}</span>` };
  const ids = shuffle(['per', 'top', 'bot', ...(v === 0 ? ['inv'] : ['sq'])]).slice(0, 3); if (!ids.includes(ans)) ids[0] = ans;
  const choices = shuffle(ids).map((id) => ({ id, html: opts[id], text: id === 'per' ? `${top}/${bot}` : id === 'top' ? top : id === 'bot' ? bot : id === 'inv' ? `${bot}/${top}` : `${top}×${bot}` }));
  const unitRow = v === 0 ? `${unitHTML(top)}${uop('÷')}${unitHTML(bot)}${uop('=')}${per}`
    : v === 1 ? `${mulChain([uq('', top, '', bot), uq('', bot)])}${uop('=')}${unitHTML(top)}`
      : `${unitHTML(top)}${uop('÷')}${per}${uop('=')}${mulChain([uq('', top), uq('', bot, '', top)])}${uop('=')}${unitHTML(bot)}`;
  why = v === 0 ? `${top} を ${bot} でわると、「1 ${bot} あたり何 ${top}」という新しい単位 <b>${top}/${bot}</b> ができます${R.w ? ` (${R.w}のこと)` : ''}。`
    : v === 1 ? `${top}/${bot} の下の ${bot} と、かけた ${bot} が約分のように消えて、<b>${top}</b> がのこります。`
      : `${top}/${bot} でわるのは、ひっくり返した ${bot}/${top} をかけるのと同じです。${top} が消えて <b>${bot}</b> がのこります。`;
  const ex = { 'per': `${R.name}`, 'top': '全体の量', 'bot': 'いくつ分' }[ans];
  const box = figPerBox({ n: 3, each: `□ ${top}`, per: `1 ${bot}`, total: `全体 (${top})`, count: `いくつ分 (${bot})`, ask: ans === 'top' ? 'total' : ans === 'bot' ? 'count' : null, label: `1 ${bot} あたりの箱の図` });
  return { html: `この計算の答えの単位は？<div class="expr">${qh}</div>`, text: `${qt} の単位は？`, lead: '答えの単位をえらぼう (□ △ は数)', choices, answerChoice: ans, slots: [],
    explain: () => [
      { fig: ueq([['単位', unitRow, 'all']], '数のかわりに 単位だけを計算する'), text: why, lesson: 'unit' },
      { fig: box, text: `箱の図で見ると、答えは「${ex}」にあたります。単位が合っていれば、何を求めたのかが分かります。` },
    ] };
};
// 式をえらぶ: 単位で正しい式をたしかめる
GEN.unit_check = () => {
  const cases = [
    () => { const S = ri(3, 12) * 5, H = ri(2, 5); return { story: `時速 ${S} km で ${H} 時間 走りました。道のりは？`, a: uq(S, 'km', 1, '時間'), b: uq(H, '時間'), want: 'km', top: 'km', bot: '時間', ans: 'mul', val: S * H }; },
    () => { const V = ri(6, 9) * 10, T = ri(4, 15); return { story: `${V * T} m の道のりを 分速 ${V} m で歩きます。かかる時間は？`, a: uq(V * T, 'm'), b: uq(V, 'm', 1, '分'), want: '分', top: 'm', bot: '分', ans: 'div', val: T }; },
    () => { const d = pick(['2.7', '7.9', '0.9', '8.9']), V = ri(2, 20); return { story: `1 cm³ あたり ${d} g の金属が ${V} cm³ あります。重さは？`, a: uq(d, 'g', 1, 'cm³'), b: uq(V, 'cm³'), want: 'g', top: 'g', bot: 'cm³', ans: 'mul', val: Fr.dec(d).mul(V).toDec() }; },
    () => { const p = ri(3, 9) * 100, A = ri(2, 9); return { story: `面積 ${A} km² に ${p * A} 人が住んでいます。人口密度 (1 km² あたりの人数) は？`, a: uq(p * A, '人'), b: uq(A, 'km²'), want: '人/km²', top: '人', bot: 'km²', ans: 'div', val: p, per: true }; },
    () => { const u = ri(4, 20) * 10, N = ri(2, 9); return { story: `1 m あたり ${u} 円のリボンを ${u * N} 円分 買います。長さは？`, a: uq(u * N, '円'), b: uq(u, '円', 1, 'm'), want: 'm', top: '円', bot: 'm', ans: 'div', val: N }; },
  ];
  const C = pick(cases)();
  const { a, b } = C;
  // 3つの式と、その単位
  const ua = (q) => (q.b == null ? q.au : `${q.au}/${q.bu}`);
  const resUnit = { mul: '', div: '', rdiv: '' };
  const simp = (num, den) => { const n = num.slice(), d = den.slice(); for (let i = d.length - 1; i >= 0; i--) { const j = n.indexOf(d[i]); if (j >= 0) { n.splice(j, 1); d.splice(i, 1); } } const t = n.length ? n.join('×') : '1'; return d.length ? `${t}/${d.join('×')}` : t; };
  const nd = (q) => [q.b == null ? [q.au] : [q.au], q.b == null ? [] : [q.bu]];
  const [an, ad] = nd(a), [bn, bd] = nd(b);
  resUnit.mul = simp([...an, ...bn], [...ad, ...bd]); resUnit.div = simp([...an, ...bd], [...ad, ...bn]); resUnit.rdiv = simp([...bn, ...ad], [...bd, ...an]);
  const want = C.want;
  const fmt = (q) => q.a;
  const exprs = { mul: `${fmt(a)} × ${fmt(b)}`, div: `${fmt(a)} ÷ ${fmt(b)}`, rdiv: `${fmt(b)} ÷ ${fmt(a)}` };
  const ok = Object.keys(exprs).filter((k) => resUnit[k] === want);
  const ans = ok.includes(C.ans) ? C.ans : ok[0];
  const choices = shuffle(['mul', 'div', 'rdiv']).map((id) => ({ id, html: exprs[id], text: exprs[id] }));
  const uShow = (s) => s.split('/').length === 2 ? uqHTML(uq('', s.split('/')[0], '', s.split('/')[1])) : unitHTML(s);
  const tbl = figTable(['式', '単位の計算', 'のこる単位', ''], ['mul', 'div', 'rdiv'].map((k) => [exprs[k], `${ua(k === 'rdiv' ? b : a)} ${k === 'mul' ? '×' : '÷'} ${ua(k === 'rdiv' ? a : b)}`, resUnit[k], resUnit[k] === want ? '<b>○ ほしい単位</b>' : '×']));
  return { html: `${C.story}<br>正しい式はどれ？`, text: `${C.story} 式は？`, lead: '単位で たしかめて えらぼう', choices, answerChoice: ans, slots: [],
    explain: () => [
      { fig: tbl, text: `3つの式に、数といっしょに単位も入れて計算してみます。ほしいのは <b>${want}</b> の単位です。<br><small>単位がおかしい式 (km×時間 など) は、お話に合わない計算です。</small>`, lesson: 'unit' },
      { fig: ueq([['単位', `${ans === 'mul' ? mulChain([a, b].map((q) => ({ ...q, a: '', b: q.b == null ? null : '' }))) : ans === 'div' ? `${uShow(ua(a))}${uop('÷')}${uShow(ua(b))}` : `${uShow(ua(b))}${uop('÷')}${uShow(ua(a))}`}${uop('=')}${uShow(want)}`, 'all'], ['数', `${exprs[ans]} = <b>${C.val}</b>`]], '正しい式'),
        text: `正しいのは <b>${exprs[ans]}</b>。答えは ${C.val} ${want} です。` },
    ] };
};
const MATERIALS = [['鉄', '7.9'], ['アルミニウム', '2.7'], ['銅', '8.9'], ['氷', '0.9'], ['ガラス', '2.5'], ['金', '19.3']];
GEN.density = () => {
  const [m, d] = pick(MATERIALS); const V = ri(2, 30); const D = Fr.dec(d); const M = D.mul(V); const v = ri(0, 2);
  const base = { top: 'g', bot: 'cm³', rate: d, cnt: String(V), tot: M.toDec(), n: V, cube: true, word: '密度' };
  const intro = `<small>1 cm³ (1辺 1 cm の立方体) あたりの重さを「密度」といいます。単位は g/cm³ です。${m}の密度は およそ ${d} g/cm³ です。</small>`;
  if (v === 0) return { html: `体積 ${V} cm³ で、重さ ${M.toDec()} g の${m}のかたまり。密度 (1 cm³ あたりの重さ) は <b class="box">□</b> g/cm³`, text: `${V}cm³で${M.toDec()}g → □g/cm³`, slots: [slot(D, 'g/cm³')],
    explain: () => { const f = rateUnitFrames({ ...base, kind: 'per' }); f[0].text += '<br>' + intro; return f; } };
  if (v === 1) return { html: `密度 ${d} g/cm³ の${m}が ${V} cm³ あります。重さは <b class="box">□</b> g`, text: `${d}g/cm³ × ${V}cm³ → □g`, slots: [slot(M, 'g')],
    explain: () => { const f = rateUnitFrames({ ...base, kind: 'total' }); f[0].text += '<br>' + intro; return f; } };
  return { html: `密度 ${d} g/cm³ の${m}のかたまりの重さが ${M.toDec()} g です。体積は <b class="box">□</b> cm³`, text: `${M.toDec()}g ÷ ${d}g/cm³ → □cm³`, slots: [slot(V, 'cm³')],
    explain: () => { const f = rateUnitFrames({ ...base, kind: 'count' }); f[0].text += '<br>' + intro; return f; } };
};
// たて × よこ のマス (cm × cm = cm²)
function figCmGrid(w, h) {
  const S = 44, x0 = 150, y0 = 34; let b = '';
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) b += `<rect class="${r === 0 && c === 0 ? 'sh2' : 'sh'}" x="${x0 + c * S}" y="${y0 + r * S}" width="${S}" height="${S}"/>`;
  b += svgText(x0 + w * S / 2, y0 - 10, `よこ ${w} cm`, 'b') + svgText(x0 - 10, y0 + h * S / 2 + 5, `たて ${h} cm`, 'b', 'end');
  b += svgText(x0 + w * S + 14, y0 + 18, '← 1 cm × 1 cm = 1 cm²', 'm', 'start') + svgText(x0 + w * S + 14, y0 + 40, `${h} × ${w} = ${h * w} こ → ${h * w} cm²`, 's', 'start');
  return svgBox(540, y0 + h * S + 12, b, 'cm × cm = cm² の図');
}
function unitWhyFrames() {
  const box = (o) => figPerBox(o);
  return [
    { fig: figTapes([{ s: '3 m', segs: [{ w: 1, s: '1 m' }, { w: 1, s: '1 m' }, { w: 1, s: '1 m' }] }, { s: '3 m + 2 m', segs: [{ w: 1, s: '1 m' }, { w: 1, s: '1 m' }, { w: 1, s: '1 m' }, { w: 1, s: '1 m', cls: 'sh3' }, { w: 1, s: '1 m', cls: 'sh3' }], total: '5 m' }], { label: '1 m がいくつ分のテープ図' }),
      text: '<b>単位は「何が いくつ分」の「何」</b><br>3 m は「1 m が 3つ分」です。数 (3) は いくつ分、単位 (m) は 何の いくつ分か を表しています。<br>3 m + 2 m = 5 m のように、たし算・ひき算は <b>同じ単位どうし</b> でしかできません。3 m + 2 kg は、何の いくつ分かが ちがうので たせません。' },
    { fig: figCmGrid(4, 3),
      text: '<b>かけ算では、単位もかけ算になる</b><br>たて 3 cm、よこ 4 cm の長方形の面積は 3 cm × 4 cm。数は 3 × 4 = 12、単位は cm × cm = <b>cm²</b> (平方センチメートル)。<br>cm² は「1 cm × 1 cm のマスが いくつ分」という、かけ算から生まれた単位です。' },
    { fig: box({ n: 3, each: '80 km', per: '1 時間', total: '全体 240 km', count: '3 時間 ぶん', label: '1時間あたりの箱の図' }) + ueq([['数', '240 ÷ 3 = 80'], ['単位', `${unitHTML('km')}${uop('÷')}${unitHTML('時間')}${uop('=')}${uqHTML(uq('', 'km', '', '時間'))}`], ['あわせて', `${uqHTML(uq(240, 'km'))}${uop('÷')}${uqHTML(uq(3, '時間'))}${uop('=')}${uqHTML(uq(80, 'km', 1, '時間'))}`, 'all']]),
      text: '<b>わり算では「あたり」の単位ができる</b><br>3 時間で 240 km 走る車。240 km ÷ 3 時間 で、数は 80、単位は km ÷ 時間 = <b>km/時間</b>。<br>km/時間 は「1 時間 あたり 何 km」と読み、これが <b>時速</b> です。分数の形で、上が 全体の量、下が 何あたり かを表しています。' },
    { fig: box({ n: 4, each: '2.7 g', per: '1 cm³', total: '全体 10.8 g', count: '4 cm³ ぶん', cube: true, label: '1 cm³ あたりの箱の図' }) + ueq([['数', '10.8 ÷ 4 = 2.7'], ['単位', `${unitHTML('g')}${uop('÷')}${unitHTML('cm³')}${uop('=')}${uqHTML(uq('', 'g', '', 'cm³'))}`], ['あわせて', `${uqHTML(uq('10.8', 'g'))}${uop('÷')}${uqHTML(uq(4, 'cm³'))}${uop('=')}${uqHTML(uq('2.7', 'g', 1, 'cm³'))}`, 'all']]),
      text: '<b>密度も同じ作り方</b><br>体積 4 cm³ で重さ 10.8 g のアルミニウム。重さ ÷ 体積 で、単位は g ÷ cm³ = <b>g/cm³</b>。「1 cm³ (1辺 1 cm の立方体) あたり 何 g」で、これを <b>密度</b> といいます。<br>速さ (km/時間)、人口密度 (人/km²)、ねだん (円/m) も、みんな同じ「全体 ÷ いくつ分」で作られた単位です。' },
    { fig: ueq([['数', '80 × 3 = 240'], ['単位', `${mulChain([uq('', 'km', '', '時間'), uq('', '時間')])}${uop('=')}${unitHTML('km')}`], ['あわせて', `${mulChain([uq(80, 'km', 1, '時間'), uq(3, '時間')])}${uop('=')}${uqHTML(uq(240, 'km'))}`, 'all']], '下の 時間 と かけた 時間 が消える'),
      text: '<b>単位は、分数の約分のように消せる</b><br>時速 80 km で 3 時間 走ると？ 80 km/時間 × 3 時間。<br>分数 2/3 × 3 で 3 が約分して消えるのと同じで、<b>時間 が上と下で消えて km がのこります</b>。だから答えは 240 km。' },
    { fig: figTable(['式', '単位の計算', 'のこる単位', ''], [['80 × 3', 'km/時間 × 時間', 'km', '<b>○ 道のり</b>'], ['80 ÷ 3', 'km/時間 ÷ 時間', 'km/(時間×時間)', '× 意味がない'], ['3 ÷ 80', '時間 ÷ km/時間', '時間×時間/km', '× 意味がない']]),
      text: '<b>単位で、式が正しいか たしかめられる</b><br>道のり (km) を求めたいとき、80 と 3 をどう計算するか まよったら、単位も計算してみます。<br>km がのこるのは × だけ。ほかの式は「時間×時間」のような お話に出てこない単位になるので、まちがいだと分かります。' },
    { fig: ueq([['かんさんの もと', `1 km = 1000 m なので ${uqHTML(uq(1000, 'm', 1, 'km'))}${uop('=')}1`], ['単位の式', `${mulChain([uq(3, 'km'), uq(1000, 'm', 1, 'km')])}${uop('=')}${uqHTML(uq(3000, 'm'))}`, 'all'], ['速さも', `${mulChain([uq(72, 'km', 1, '時間'), uq(1000, 'm', 1, 'km'), uq(1, '時間', 60, '分')])}${uop('=')}${uqHTML(uq(1200, 'm', 1, '分'))}`, 'all']], '「1」と同じ分数をかけて 単位を入れかえる'),
      text: '<b>単位のかんさんも、単位の式でできる</b><br>1 km = 1000 m なので、分数 1000 m/1 km は「1」と同じ大きさ。1 をかけても量は変わらないので、3 km × 1000 m/1 km = 3000 m。km が消えて m がのこります。<br>時速 72 km を分速にするときも、km と 時間 が消えるように分数をならべると、72 × 1000 ÷ 60 = 1200 で <b>分速 1200 m</b>。' },
    { fig: figTable(['', '全体の量', '÷ いくつ分', '= 1あたり (単位)'], [['速さ', '道のり km', '時間', 'km/時間'], ['密度', '重さ g', '体積 cm³', 'g/cm³'], ['人口密度', '人数 人', '面積 km²', '人/km²'], ['ねだん', '代金 円', '長さ m', '円/m'], ['ねんぴ', '道のり km', 'ガソリン L', 'km/L']]),
      text: '<b>まとめ</b><br>・単位は「何の いくつ分」。数と いっしょに計算する。<br>・÷ で「○/△ (1△ あたり○)」の単位ができる。× で 上と下の同じ単位が消える。<br>・答えの単位が ほしい単位になっていれば、式が正しい。<br>数だけでなく単位も計算すると、何を求めているのかを見失いません。' },
  ];
}

// ===== お金の絵の図 (アイコン・コイン・円グラフ・てんびん) =====
// アイコンは 100×100 の座標で描き、icon() で 置く場所と大きさを決める。色は 明るい画面・暗い画面の どちらでも 見えるように固定色
const PAL = { gold: '#F6C343', goldD: '#B8860B', green: '#6CC487', greenD: '#2F7D4A', blue: '#5AA9E6', blueD: '#2A6FA8', coral: '#F27C7C', purple: '#A88BE8', orange: '#F4A259', gray: '#CFD8DF', grayD: '#7C8A96', ink: '#2B3A55', pink: '#F7A8C0', white: '#FFFFFF', red: '#E5534B', brown: '#C98B4E', teal: '#4DB6AC', sky: '#BFE3FF', cream: '#FFF1C9' };
const PEOPLE = [PAL.blue, PAL.coral, PAL.purple, PAL.teal, PAL.orange];
const isk = `stroke="${PAL.ink}" stroke-width="3" stroke-linejoin="round"`;
const itx = (x, y, s, size = 16, fill = PAL.ink) => `<text x="${x}" y="${y}" text-anchor="middle" class="ict" style="font-size:${size}px;fill:${fill}">${esc(s)}</text>`;
const IC = {
  person: (o = {}) => `<circle cx="50" cy="30" r="17" fill="${o.c || PAL.blue}" ${isk}/><path d="M20 97 Q20 55 50 55 Q80 55 80 97 Z" fill="${o.c || PAL.blue}" ${isk}/>`,
  house: () => `<path d="M12 50 L50 14 L88 50 Z" fill="${PAL.coral}" ${isk}/><rect x="22" y="48" width="56" height="44" fill="${PAL.cream}" ${isk}/><rect x="43" y="64" width="15" height="28" fill="${PAL.brown}" ${isk}/>`,
  shop: () => `<rect x="16" y="40" width="68" height="52" fill="${PAL.cream}" ${isk}/><path d="M10 22 H90 L86 42 H14 Z" fill="${PAL.red}" ${isk}/><path d="M30 22 L28 42 M50 22 V42 M70 22 L72 42" stroke="${PAL.white}" stroke-width="5"/><rect x="26" y="54" width="22" height="18" fill="${PAL.sky}" ${isk}/><rect x="56" y="56" width="16" height="36" fill="${PAL.brown}" ${isk}/>`,
  company: () => `<rect x="20" y="16" width="60" height="78" fill="${PAL.gray}" ${isk}/>${[30, 46, 62].map((y) => [30, 46, 62].map((x) => `<rect x="${x}" y="${y}" width="9" height="9" fill="${PAL.sky}" stroke="${PAL.ink}" stroke-width="1.5"/>`).join('')).join('')}<rect x="43" y="78" width="14" height="16" fill="${PAL.brown}" ${isk}/>`,
  bank: () => `<path d="M10 38 L50 12 L90 38 Z" fill="${PAL.gold}" ${isk}/><rect x="14" y="38" width="72" height="8" fill="${PAL.gray}" ${isk}/>${[22, 40, 58, 72].map((x) => `<rect x="${x}" y="48" width="8" height="34" fill="${PAL.white}" ${isk}/>`).join('')}<rect x="10" y="82" width="80" height="10" fill="${PAL.gray}" ${isk}/>${itx(50, 34, '¥', 16)}`,
  city: () => `<rect x="14" y="40" width="72" height="52" fill="${PAL.gray}" ${isk}/><path d="M34 40 Q50 14 66 40 Z" fill="${PAL.teal}" ${isk}/><path d="M50 18 V4 L64 9 L50 13" fill="${PAL.red}" ${isk}/>${[22, 40, 58, 72].map((x) => `<rect x="${x}" y="52" width="8" height="12" fill="${PAL.sky}" stroke="${PAL.ink}" stroke-width="1.5"/>`).join('')}<rect x="42" y="72" width="16" height="20" fill="${PAL.brown}" ${isk}/>`,
  school: () => `<rect x="10" y="44" width="80" height="48" fill="${PAL.cream}" ${isk}/><path d="M34 44 V26 H66 V44" fill="${PAL.cream}" ${isk}/><circle cx="50" cy="35" r="7" fill="${PAL.white}" ${isk}/>${[18, 32, 60, 74].map((x) => `<rect x="${x}" y="56" width="9" height="10" fill="${PAL.sky}" stroke="${PAL.ink}" stroke-width="1.5"/>`).join('')}<rect x="43" y="70" width="14" height="22" fill="${PAL.brown}" ${isk}/>`,
  coin: (o = {}) => `<circle cx="50" cy="50" r="40" fill="${o.c || PAL.gold}" ${isk}/><circle cx="50" cy="50" r="30" fill="none" stroke="${o.d || PAL.goldD}" stroke-width="2.5"/>${itx(50, 50 + (o.size || 26) * 0.36, o.s || '¥', o.size || 26)}`,
  bill: (o = {}) => `<rect x="4" y="24" width="92" height="52" rx="5" fill="${o.c || PAL.green}" ${isk}/><circle cx="72" cy="50" r="15" fill="none" stroke="${PAL.greenD}" stroke-width="2.5"/>${itx(36, 58, o.s || '円', o.size || 20)}`,
  piggy: () => `<ellipse cx="50" cy="58" rx="38" ry="28" fill="${PAL.pink}" ${isk}/><path d="M30 36 L34 22 L44 33" fill="${PAL.pink}" ${isk}/><ellipse cx="86" cy="58" rx="7" ry="9" fill="${PAL.pink}" ${isk}/><circle cx="68" cy="50" r="3.5" fill="${PAL.ink}"/><rect x="40" y="30" width="20" height="5" rx="2" fill="${PAL.ink}"/><path d="M30 82 V94 M66 82 V94" stroke="${PAL.ink}" stroke-width="6" stroke-linecap="round"/>`,
  card: () => `<rect x="6" y="22" width="88" height="58" rx="8" fill="${PAL.blue}" ${isk}/><rect x="6" y="34" width="88" height="10" fill="${PAL.ink}"/><rect x="16" y="54" width="18" height="12" rx="2" fill="${PAL.gold}"/>`,
  phone: () => `<rect x="28" y="6" width="44" height="88" rx="8" fill="${PAL.ink}"/><rect x="33" y="16" width="34" height="62" rx="3" fill="${PAL.sky}"/>${itx(50, 54, '¥', 22)}`,
  fish: () => `<path d="M14 50 Q40 22 70 50 Q40 78 14 50 Z" fill="${PAL.blue}" ${isk}/><path d="M68 50 L90 34 V66 Z" fill="${PAL.blue}" ${isk}/><circle cx="30" cy="46" r="4" fill="${PAL.ink}"/>`,
  bread: () => `<path d="M14 70 Q8 30 50 28 Q92 30 86 70 Z" fill="${PAL.orange}" ${isk}/><path d="M34 40 L40 60 M50 36 V60 M66 40 L60 60" stroke="${PAL.brown}" stroke-width="3"/><rect x="14" y="68" width="72" height="10" rx="4" fill="${PAL.brown}" ${isk}/>`,
  shoe: () => `<path d="M10 70 V40 H40 Q46 56 70 58 Q90 60 90 72 V78 H10 Z" fill="${PAL.purple}" ${isk}/><path d="M10 78 H90" stroke="${PAL.ink}" stroke-width="6"/>`,
  water: () => `<rect x="34" y="8" width="32" height="12" rx="3" fill="${PAL.blue}" ${isk}/><path d="M30 26 Q30 20 36 20 H64 Q70 20 70 26 V90 Q70 94 66 94 H34 Q30 94 30 90 Z" fill="${PAL.sky}" ${isk}/><rect x="30" y="46" width="40" height="22" fill="${PAL.white}" ${isk}/>`,
  umbrella: () => `<path d="M10 52 Q50 0 90 52 Z" fill="${PAL.purple}" ${isk}/><path d="M50 52 V84 Q50 92 42 92 Q36 92 36 86" fill="none" ${isk}/>`,
  book: () => `<path d="M50 24 Q30 14 10 20 V84 Q30 78 50 88 Q70 78 90 84 V20 Q70 14 50 24 Z" fill="${PAL.white}" ${isk}/><path d="M50 24 V88" ${isk}/><path d="M18 34 H40 M18 46 H40 M60 34 H82 M60 46 H82" stroke="${PAL.grayD}" stroke-width="3"/>`,
  road: () => `<path d="M6 92 L34 20 H66 L94 92 Z" fill="${PAL.grayD}" ${isk}/><path d="M50 26 V38 M50 50 V62 M50 74 V88" stroke="${PAL.white}" stroke-width="5"/>`,
  signal: () => `<rect x="46" y="44" width="8" height="50" fill="${PAL.grayD}" ${isk}/><rect x="12" y="10" width="76" height="34" rx="8" fill="${PAL.ink}"/><circle cx="30" cy="27" r="9" fill="${PAL.green}"/><circle cx="50" cy="27" r="9" fill="${PAL.gold}"/><circle cx="70" cy="27" r="9" fill="${PAL.red}"/>`,
  firetruck: () => `<rect x="6" y="36" width="58" height="38" fill="${PAL.red}" ${isk}/><path d="M64 46 H82 L94 60 V74 H64 Z" fill="${PAL.red}" ${isk}/><rect x="70" y="50" width="12" height="10" fill="${PAL.sky}" stroke="${PAL.ink}" stroke-width="2"/><path d="M10 30 L58 22 M10 36 L58 28" stroke="${PAL.grayD}" stroke-width="4"/><circle cx="24" cy="78" r="9" fill="${PAL.ink}"/><circle cx="76" cy="78" r="9" fill="${PAL.ink}"/>`,
  police: () => `<path d="M14 54 L26 36 H70 L84 54 Z" fill="${PAL.white}" ${isk}/><rect x="6" y="52" width="88" height="24" rx="6" fill="${PAL.ink}"/><rect x="42" y="28" width="16" height="8" fill="${PAL.red}" ${isk}/><circle cx="24" cy="78" r="9" fill="${PAL.ink}" stroke="${PAL.white}" stroke-width="3"/><circle cx="76" cy="78" r="9" fill="${PAL.ink}" stroke="${PAL.white}" stroke-width="3"/>`,
  garbage: () => `<rect x="6" y="32" width="56" height="42" rx="4" fill="${PAL.green}" ${isk}/><path d="M62 44 H80 L94 58 V74 H62 Z" fill="${PAL.white}" ${isk}/><path d="M22 44 V64 M34 44 V64 M46 44 V64" stroke="${PAL.greenD}" stroke-width="3"/><circle cx="24" cy="78" r="9" fill="${PAL.ink}"/><circle cx="76" cy="78" r="9" fill="${PAL.ink}"/>`,
  tree: () => `<rect x="44" y="60" width="12" height="32" fill="${PAL.brown}" ${isk}/><circle cx="50" cy="40" r="30" fill="${PAL.green}" ${isk}/>`,
  hospital: () => `<rect x="16" y="24" width="68" height="68" fill="${PAL.white}" ${isk}/><path d="M50 34 V62 M36 48 H64" stroke="${PAL.red}" stroke-width="10"/><rect x="42" y="72" width="16" height="20" fill="${PAL.sky}" ${isk}/>`,
  bag: () => `<path d="M20 34 H80 L86 92 H14 Z" fill="${PAL.orange}" ${isk}/><path d="M36 34 Q36 12 50 12 Q64 12 64 34" fill="none" ${isk}/>${itx(50, 72, '%', 22)}`,
  envelope: () => `<rect x="8" y="24" width="84" height="56" rx="4" fill="${PAL.cream}" ${isk}/><path d="M8 26 L50 56 L92 26" fill="none" ${isk}/>${itx(50, 76, 'きゅうりょう', 11)}`,
  car: () => `<path d="M10 70 V54 L24 34 H72 L88 54 V70 Z" fill="${PAL.blue}" ${isk}/><rect x="30" y="40" width="18" height="12" fill="${PAL.sky}"/><rect x="52" y="40" width="18" height="12" fill="${PAL.sky}"/><circle cx="28" cy="72" r="10" fill="${PAL.ink}"/><circle cx="72" cy="72" r="10" fill="${PAL.ink}"/>`,
  land: () => `<path d="M4 80 Q50 66 96 80 V94 H4 Z" fill="${PAL.green}" ${isk}/><path d="M28 56 L50 36 L72 56 Z" fill="${PAL.coral}" ${isk}/><rect x="34" y="55" width="32" height="20" fill="${PAL.cream}" ${isk}/>`,
  plane: () => `<path d="M8 54 L92 40 Q98 46 90 52 L60 58 L44 84 H34 L40 60 L20 64 L14 74 H8 L10 58 Z" fill="${PAL.white}" ${isk}/>`,
  shipIn: () => `<path d="M8 60 H92 L80 84 H20 Z" fill="${PAL.blue}" ${isk}/><rect x="30" y="38" width="20" height="22" fill="${PAL.orange}" ${isk}/><rect x="52" y="44" width="20" height="16" fill="${PAL.green}" ${isk}/>`,
  jar: (o = {}) => `<rect x="30" y="10" width="40" height="10" rx="3" fill="${PAL.grayD}" ${isk}/><path d="M24 26 Q24 20 30 20 H70 Q76 20 76 26 V86 Q76 94 68 94 H32 Q24 94 24 86 Z" fill="${PAL.sky}" ${isk} fill-opacity=".6"/>${Array.from({ length: o.n || 3 }, (_, i) => `<ellipse cx="50" cy="${86 - i * 9}" rx="18" ry="5" fill="${PAL.gold}" stroke="${PAL.goldD}" stroke-width="2"/>`).join('')}`,
  note: () => `<rect x="18" y="8" width="64" height="86" rx="4" fill="${PAL.white}" ${isk}/><path d="M28 28 H72 M28 44 H72 M28 60 H72 M28 76 H56" stroke="${PAL.grayD}" stroke-width="3"/><rect x="18" y="8" width="10" height="86" fill="${PAL.coral}" ${isk}/>`,
  gift: () => `<rect x="14" y="40" width="72" height="52" fill="${PAL.coral}" ${isk}/><rect x="10" y="30" width="80" height="14" fill="${PAL.coral}" ${isk}/><path d="M50 30 V92" stroke="${PAL.gold}" stroke-width="10"/><path d="M50 30 Q34 8 28 24 Q30 32 50 30 Q66 8 72 24 Q70 32 50 30" fill="${PAL.gold}" ${isk}/>`,
  pot: () => `<path d="M10 34 H90 L82 90 Q80 96 72 96 H28 Q20 96 18 90 Z" fill="${PAL.gold}" ${isk}/><rect x="6" y="26" width="88" height="12" rx="5" fill="${PAL.goldD}" ${isk}/>${itx(50, 74, 'みんなのお金', 12)}`,
  swap: () => `<circle cx="50" cy="50" r="42" fill="${PAL.cream}" ${isk}/><path d="M26 40 H70 L60 30 M74 60 H30 L40 70" fill="none" stroke="${PAL.ink}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`,
  ruler: () => `<rect x="6" y="34" width="88" height="32" rx="4" fill="${PAL.gold}" ${isk}/>${[16, 28, 40, 52, 64, 76, 88].map((x, i) => `<path d="M${x} 34 V${i % 2 ? 44 : 50}" stroke="${PAL.ink}" stroke-width="2.5"/>`).join('')}${itx(50, 62, '¥', 14)}`,
  thinking: () => `<circle cx="50" cy="44" r="36" fill="${PAL.white}" ${isk}/><circle cx="26" cy="86" r="6" fill="${PAL.white}" ${isk}/><circle cx="16" cy="96" r="3" fill="${PAL.white}" ${isk}/>`,
};
function icon(name, x, y, s = 48, o) { return `<g transform="translate(${r1(x)} ${r1(y)}) scale(${r1(s / 100 * 1000) / 1000})">${IC[name](o)}</g>`; }
// カード: アイコン + 見出し + 説明 (\n で改行)
function figCards(items, o = {}) {
  const W = o.W || 540, cols = o.cols || 3, gap = 10, cw = (W - gap * (cols - 1)) / cols, isz = o.isz || 52;
  const lines = Math.max(...items.map((it) => (it.sub ? String(it.sub).split('\n').length : 0)));
  const ch = isz + 34 + lines * 16 + 10; let b = '';
  items.forEach((it, i) => {
    const x = (i % cols) * (cw + gap), y = Math.floor(i / cols) * (ch + gap);
    b += `<rect class="${it.cls || 'bx'}" x="${r1(x)}" y="${y}" width="${r1(cw)}" height="${ch}" rx="12"/>`;
    b += icon(it.ic, x + cw / 2 - isz / 2, y + 8, isz, it.o) + svgText(x + cw / 2, y + isz + 26, it.s, 'b');
    if (it.sub) String(it.sub).split('\n').forEach((ln, k) => { b += svgText(x + cw / 2, y + isz + 44 + k * 16, ln, it.subcls || 's'); });
  });
  const rows = Math.ceil(items.length / cols);
  return svgBox(W, rows * ch + (rows - 1) * gap + 2, b, o.label || 'カードの図');
}
// 矢印 (少しまげられる)。ラベルは まん中に
function arrowTo(x1, y1, x2, y2, s = '', bend = 0, cls = 'ac') {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
  const cx = mx - dy / L * bend, cy = my + dx / L * bend;
  const ex = x2 - cx, ey = y2 - cy, eL = Math.hypot(ex, ey) || 1, ux = ex / eL, uy = ey / eL;
  const h1x = x2 - ux * 9 - uy * 6, h1y = y2 - uy * 9 + ux * 6, h2x = x2 - ux * 9 + uy * 6, h2y = y2 - uy * 9 - ux * 6;
  let b = `<path class="${cls}" d="M${r1(x1)} ${r1(y1)} Q${r1(cx)} ${r1(cy)} ${r1(x2)} ${r1(y2)} M${r1(h1x)} ${r1(h1y)} L${r1(x2)} ${r1(y2)} L${r1(h2x)} ${r1(h2y)}"/>`;
  if (s) { const lx = (mx + cx) / 2, ly = (my + cy) / 2; b += `<rect x="${r1(lx - s.length * 6.5 - 4)}" y="${r1(ly - 11)}" width="${r1(s.length * 13 + 8)}" height="20" rx="6" class="lbl"/>` + svgText(lx, ly + 4, s, 'm'); }
  return b;
}
// アイコンを並べて矢印でつなぐ流れの図
function figIconFlow(nodes, o = {}) {
  const W = o.W || 540, n = nodes.length, isz = o.isz || 64, top = 6; const step = (W - 20) / n; let b = '';
  const cx = (i) => 10 + step * i + step / 2;
  nodes.forEach((nd, i) => {
    b += icon(nd.ic, cx(i) - isz / 2, top, isz, nd.o) + svgText(cx(i), top + isz + 20, nd.s, 'b');
    if (nd.sub) String(nd.sub).split('\n').forEach((ln, k) => { b += svgText(cx(i), top + isz + 37 + k * 15, ln, 's'); });
    if (i < n - 1) b += arrowTo(cx(i) + isz / 2 + 6, top + isz / 2, cx(i + 1) - isz / 2 - 6, top + isz / 2, (o.arrows || [])[i] || '');
  });
  const subl = Math.max(0, ...nodes.map((nd) => (nd.sub ? String(nd.sub).split('\n').length : 0)));
  let H = top + isz + 26 + subl * 15;
  if (o.back) { const yb = H + 8; b += `<path class="ac" d="M${r1(cx(n - 1))} ${yb} V${yb + 16} H${r1(cx(0))} V${yb} m-6 8 l6 -8 l6 8"/>` + svgText(W / 2, yb + 34, o.back, 'm'); H = yb + 42; }
  return svgBox(W, H, b, o.label || '流れの図');
}
// 円で めぐる図: nodes = [{ic, s, x, y}], edges = [{a, b, s, bend}]
function figCycle(nodes, edges, o = {}) {
  const W = o.W || 540, H = o.H || 300, isz = o.isz || 64; let b = '';
  edges.forEach((e) => { const A = nodes[e.a], B = nodes[e.b]; const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy); const k = (isz / 2 + 14) / L; b += arrowTo(A.x + dx * k, A.y + dy * k, B.x - dx * k, B.y - dy * k, e.s, e.bend || 0); });
  nodes.forEach((nd) => { b += icon(nd.ic, nd.x - isz / 2, nd.y - isz / 2, isz, nd.o) + svgText(nd.x, nd.y + isz / 2 + 18, nd.s, 'b'); });
  return svgBox(W, H, b, o.label || 'めぐる図');
}
// 円のお金を お札とコインで (多いときは まとめて ×n)
const YEN_DEN = [10000, 5000, 1000, 500, 100, 50, 10, 5, 1];
function yenPieces(v) { const out = []; let r = v; for (const d of YEN_DEN) { const k = Math.floor(r / d); if (k) out.push([d, k]); r -= k * d; } return out; }
function moneyRow(v, x, y, o = {}) { // 戻り値: [svg, 幅]
  let b = '', cx = x; const sz = o.sz || 40;
  yenPieces(v).forEach(([d, k]) => {
    const bill = d >= 1000; const w = bill ? sz * 1.5 : sz;
    const show = Math.min(k, o.max || 4);
    for (let i = 0; i < show; i++) { b += icon(bill ? 'bill' : 'coin', cx, y - (bill ? 0 : 0), w, bill ? { s: String(d), size: 22, c: d === 10000 ? '#B9A6E0' : d === 5000 ? '#E8B8D0' : PAL.green } : { s: String(d), size: d >= 100 ? 24 : 28, c: d === 500 || d === 50 || d === 5 ? '#E8C766' : d === 100 ? '#D9DEE3' : d === 10 ? '#D79A5E' : PAL.gold, d: PAL.grayD }); cx += w * (bill ? 0.9 : 0.78); }
    if (k > show) { b += svgText(cx + 6, y + sz / 2 + 5, `×${k}`, 'b', 'start'); cx += 34; }
    cx += 8;
  });
  return [b, cx - x];
}
// 円グラフ: parts = [{v, s, c}]
function figPie(parts, o = {}) {
  const W = o.W || 540, R = o.R || 90, cx = o.cx || 120, cy = R + 14; const tot = parts.reduce((s, p) => s + p.v, 0); let a = -Math.PI / 2, b = '';
  parts.forEach((p) => {
    const a2 = a + p.v / tot * Math.PI * 2; const large = a2 - a > Math.PI ? 1 : 0;
    b += `<path d="M${cx} ${cy} L${r1(cx + R * Math.cos(a))} ${r1(cy + R * Math.sin(a))} A${R} ${R} 0 ${large} 1 ${r1(cx + R * Math.cos(a2))} ${r1(cy + R * Math.sin(a2))} Z" fill="${p.c}" stroke="${PAL.ink}" stroke-width="1.5"/>`;
    const am = (a + a2) / 2; if (p.v / tot > 0.08 && p.in) b += `<text x="${r1(cx + R * 0.62 * Math.cos(am))}" y="${r1(cy + R * 0.62 * Math.sin(am) + 5)}" text-anchor="middle" class="ict" style="font-size:13px;fill:${PAL.ink}">${esc(p.in)}</text>`;
    a = a2;
  });
  parts.forEach((p, i) => { const y = 24 + i * 42; b += `<rect x="${cx + R + 30}" y="${y - 13}" width="18" height="18" rx="4" fill="${p.c}" stroke="${PAL.ink}" stroke-width="1.2"/>` + svgText(cx + R + 56, y + 1, p.s, 'b', 'start') + (p.sub ? svgText(cx + R + 56, y + 16, p.sub, 's', 'start') : ''); });
  return svgBox(W, Math.max(cy + R + 12, 24 + parts.length * 42 + 10), b, o.label || '円グラフ');
}
// てんびん: 左 = ほしい人、右 = 品物。tilt: 'L' なら 左 (ほしい人) が重い → ねだんが上がる
function figScale(nl, nr, o = {}) {
  const W = 540, cx = 270, by = 220; const t = nl > nr ? 1 : nl < nr ? -1 : 0; const ang = t * 10 * Math.PI / 180;
  const L = 165, yb0 = 90, xl = cx - L * Math.cos(ang), yl = yb0 + L * Math.sin(ang), xr = cx + L * Math.cos(ang), yr = yb0 - L * Math.sin(ang);
  let b = `<path d="M${cx} ${yb0} L${cx - 30} ${by} H${cx + 30} Z" fill="${PAL.gray}" stroke="${PAL.ink}" stroke-width="2"/><line x1="${r1(xl)}" y1="${r1(yl)}" x2="${r1(xr)}" y2="${r1(yr)}" class="inkst" stroke-width="5" stroke-linecap="round"/><circle cx="${cx}" cy="${yb0}" r="7" class="inkfill"/>`;
  const pan = (x, y, items) => `<path d="M${r1(x - 60)} ${r1(y + 54)} H${r1(x + 60)}" class="inkst" stroke-width="4" stroke-linecap="round"/><path d="M${r1(x)} ${r1(y)} L${r1(x - 54)} ${r1(y + 54)} M${r1(x)} ${r1(y)} L${r1(x + 54)} ${r1(y + 54)}" stroke="${PAL.grayD}" stroke-width="1.5"/>` + items;
  const people = (x, y, n) => Array.from({ length: n }, (_, i) => icon('person', x - 54 + (i % 4) * 26, y + 26 - Math.floor(i / 4) * 24, 28, { c: PEOPLE[i % PEOPLE.length] })).join('');
  const goods = (x, y, n) => Array.from({ length: n }, (_, i) => icon(o.goods || 'bread', x - 54 + (i % 4) * 26, y + 28 - Math.floor(i / 4) * 22, 28)).join('');
  b += pan(xl, yl, people(xl, yl, nl)) + pan(xr, yr, goods(xr, yr, nr));
  b += svgText(xl, by + 22, 'ほしい人', 'b') + svgText(xr, by + 22, '売りたい品物', 'b');
  const tag = o.tag || (t > 0 ? 'ねだん ↑ 上がる' : t < 0 ? 'ねだん ↓ 下がる' : 'ちょうどよい ねだん');
  b += `<rect x="${cx - 90}" y="2" width="180" height="36" rx="10" class="${t > 0 ? 'sh2' : t < 0 ? 'sh3' : 'sh'}"/>` + svgText(cx, 26, tag, 'b');
  return svgBox(W, by + 30, b, o.label || 'てんびんの図');
}
// 年ごとの お金の柱。rows = [{s, base, add: [{v, c, s}]}]
function figColumns(cols, o = {}) {
  const W = o.W || 540, H = o.H || 250, x0 = 40, bw = o.bw || 56; const max = o.max || Math.max(...cols.map((c) => c.base + (c.add || []).reduce((s, a) => s + a.v, 0)));
  const k = (H - 84) / max, gap = (W - x0 - 10 - cols.length * bw) / Math.max(1, cols.length - 1); let b = `<line class="ln" x1="${x0 - 10}" y1="${H - 30}" x2="${W - 4}" y2="${H - 30}"/>`;
  cols.forEach((c, i) => {
    const x = x0 + i * (bw + gap); let y = H - 30 - c.base * k;
    b += `<rect x="${r1(x)}" y="${r1(y)}" width="${bw}" height="${r1(c.base * k)}" fill="${PAL.gold}" stroke="${PAL.ink}" stroke-width="1.2"/>`;
    (c.add || []).forEach((a) => { const h = a.v * k; y -= h; b += `<rect x="${r1(x)}" y="${r1(y)}" width="${bw}" height="${r1(Math.max(h, 2))}" fill="${a.c}" stroke="${PAL.ink}" stroke-width="1.2"/>`; });
    if (c.top) b += svgText(x + bw / 2, y - 8, c.top, 'b');
    b += svgText(x + bw / 2, H - 10, c.s, 's');
  });
  (o.legend || []).forEach((l, i) => { b += `<rect x="${x0 + i * 122}" y="4" width="14" height="14" rx="3" fill="${l.c}" stroke="${PAL.ink}" stroke-width="1"/>` + svgText(x0 + 20 + i * 122, 16, l.s, 's', 'start'); });
  return svgBox(W, H, b, o.label || '柱の図');
}
// ===== お金とくらし =====
// 制度や相場の数字は「例」。消費税は 2026年時点の制度 (標準 10%、食料品など 8%) を前提にしている。変わったら MONEY_FACTS を直す
const MONEY_FACTS = { taxStd: 10, taxFood: 8, rates: { ドル: [140, 145, 150, 155, 160], ユーロ: [160, 165, 170] } };
const yen = (n) => `${Fr.of(n).isInt() ? Fr.of(n).n.toLocaleString('ja-JP') : Fr.of(n).toDec()}円`;
// 箱を矢印でつなぐ図: steps = [{s, sub, cls}]
function figFlow(steps, o = {}) {
  const W = o.W || 540, n = steps.length, gap = o.arrows ? 56 : 30, bw = (W - 20 - gap * (n - 1)) / n, y = 24, bh = o.h || 70;
  let b = '';
  steps.forEach((st, i) => {
    const x = 10 + i * (bw + gap);
    b += `<rect class="${st.cls || 'sh'}" x="${r1(x)}" y="${y}" width="${r1(bw)}" height="${bh}" rx="10"/>` + svgText(x + bw / 2, y + (st.sub ? 30 : bh / 2 + 6), st.s, 'b');
    if (st.sub) String(st.sub).split('\n').forEach((line, k) => { b += svgText(x + bw / 2, y + 50 + k * 16, line, 's'); });
    if (i < n - 1) { const xa = x + bw + 4, xb = x + bw + gap - 4, ym = y + bh / 2; b += `<path class="ac" d="M${r1(xa)} ${ym} L${r1(xb)} ${ym} m-7 -6 l7 6 l-7 6"/>`; if (o.arrows && o.arrows[i]) b += svgText((xa + xb) / 2, ym - 10, o.arrows[i], 's'); }
  });
  if (o.back) { const x1 = 10 + bw / 2, x2 = 10 + (n - 1) * (bw + gap) + bw / 2, yb = y + bh + 8; b += `<path class="ac" d="M${r1(x2)} ${yb} L${r1(x2)} ${yb + 18} L${r1(x1)} ${yb + 18} L${r1(x1)} ${yb} m-6 7 l6 -7 l6 7"/>` + svgText((x1 + x2) / 2, yb + 34, o.back, 's'); }
  return svgBox(W, y + bh + (o.back ? 52 : 12), b, o.label || '流れの図');
}
// ほしい人と 売りたい量 (需要と供給) のグラフ。shift: 'demand' ならほしい人がふえた
function figSupplyDemand(shift) {
  const W = 540, x0 = 80, y0 = 20, w = 360, h = 200; let b = '';
  b += `<line class="ln" x1="${x0}" y1="${y0}" x2="${x0}" y2="${y0 + h}"/><line class="ln" x1="${x0}" y1="${y0 + h}" x2="${x0 + w}" y2="${y0 + h}"/>`;
  b += svgText(x0 - 8, y0 + 10, 'ねだん', 's', 'end') + svgText(x0 - 8, y0 + 26, '高い', 's', 'end') + svgText(x0 - 8, y0 + h - 4, '安い', 's', 'end') + svgText(x0 + w, y0 + h + 20, '数 (多い →)', 's', 'end');
  b += `<line class="ac" x1="${x0 + 20}" y1="${y0 + 20}" x2="${x0 + w - 40}" y2="${y0 + h - 20}"/>` + svgText(x0 + 24, y0 + 16, 'ほしい人の数', 'm', 'start');
  b += `<line class="sh3ln" x1="${x0 + 20}" y1="${y0 + h - 20}" x2="${x0 + w - 40}" y2="${y0 + 20}"/>` + svgText(x0 + w - 36, y0 + 16, '売りたい数', 'b', 'end');
  const cx = x0 + (w - 20) / 2, cy = y0 + h / 2;
  b += `<circle class="dot" cx="${cx}" cy="${cy}" r="6"/>` + svgText(cx - 14, cy + 5, 'ここで ねだんが決まる', 's', 'end');
  if (shift === 'demand') { b += `<line class="ac dash2" x1="${x0 + 80}" y1="${y0 + 20}" x2="${x0 + w}" y2="${y0 + h - 20}"/>`; b += `<circle class="dot" cx="${cx + 30}" cy="${cy - 30}" r="6"/>` + svgText(cx + 40, cy - 36, 'ほしい人がふえると 高くなる', 'm', 'start'); }
  return svgBox(W, y0 + h + 30, b, 'ほしい人の数と売りたい数の図');
}
GEN.m_change = () => {
  const goods = [['ノート', 120, 180], ['えんぴつ', 60, 98], ['おにぎり', 110, 160], ['ジュース', 120, 150], ['パン', 130, 240], ['けしゴム', 80, 110], ['シール', 150, 300]];
  const n = ri(2, 3); const its = shuffle(goods).slice(0, n).map(([g, a, z]) => [g, ri(a, z)]);
  const tot = its.reduce((s, x) => s + x[1], 0); const pay = [500, 1000, 2000, 5000].find((p) => p >= tot + 1);
  const ch = pay - tot;
  const list = its.map(([g, p]) => `${g} ${p}円`).join('、');
  const up = []; let cur = tot; // おつりを「たして数える」とび
  const nx10 = Math.ceil(cur / 10) * 10; if (nx10 !== cur) { up.push({ a: cur, b: nx10, s: `+${nx10 - cur}` }); cur = nx10; }
  const nx100 = Math.ceil(cur / 100) * 100; if (nx100 !== cur && nx100 <= pay) { up.push({ a: cur, b: nx100, s: `+${nx100 - cur}` }); cur = nx100; }
  if (cur !== pay) up.push({ a: cur, b: pay, s: `+${pay - cur}` });
  const tape = figTapes([{ s: 'はらった', segs: [{ w: pay, s: `${pay}円`, cls: 'sh3' }] }, { s: '内わけ', segs: [...its.map(([g, p]) => ({ w: p, s: p >= pay * 0.12 ? `${g}` : '' })), { w: ch, s: 'おつり', cls: 'sh2' }], braces: [{ from: 0, to: its.length - 1, s: `代金 ${tot}円`, side: 'bot' }] }], { label: 'はらったお金と代金・おつりのテープ図' });
  return { html: `${list} を買って、${pay}円 はらいました。おつりは <b class="box">□</b> 円`, text: `${list} を ${pay}円で → おつり□円`, slots: [slot(ch, '円')],
    explain: () => [
      { fig: tape, text: `はらった ${pay}円 は、代金 と おつり に分かれます。だから おつり = はらったお金 − 代金。<br>まず代金: ${its.map((x) => x[1]).join(' + ')} = <b>${tot}円</b>` },
      { fig: figNumberLine({ min: Math.floor(tot / 100) * 100, max: pay, marks: [{ v: tot, s: `${tot}` }, { v: pay, s: `${pay}` }, ...up.slice(0, -1).map((u) => ({ v: u.b, s: String(u.b) }))], jumps: up, label: '代金からはらったお金まで数える数直線' }),
        text: `お店の人は、代金から はらったお金まで「たして」数えることがあります: ${up.map((u) => u.s.replace('+', '')).join(' + ')} = <b>${ch}円</b>。<br>ひき算 ${pay} − ${tot} = ${ch} と同じ答えになります。` },
    ] };
};
GEN.m_tax = () => {
  const food = rnd() < 0.5; const r = food ? MONEY_FACTS.taxFood : MONEY_FACTS.taxStd; const step = food ? 25 : 10;
  const P = ri(4, 120) * step; const T = P * (100 + r) / 100; const what = food ? pick(['おべんとう', 'お米', 'くだもの', 'おかし']) : pick(['くつ', 'ぼうし', 'かさ', 'ゲーム', 'ふでばこ']);
  const note = `<small>消費税は、多くの物は ${MONEY_FACTS.taxStd}%、食べ物 (店で食べる外食などはのぞく) は ${MONEY_FACTS.taxFood}% です (このアプリを作った時点のしくみ。かわることがあります)。</small>`;
  const tape = (ask) => figTapes([{ s: '税こみ', segs: [{ w: 100, s: `税ぬき ${ask === 'P' ? '□' : P}円 (100%)` }, { w: r * 2.2, s: `税 ${r}%`, cls: 'sh2' }], total: ask === 'T' ? '□円' : `${T}円` }], { label: '税ぬきと消費税のテープ図' });
  const dl = (ask) => figDoubleLine({ top: '金額 (円)', bot: '割合', cols: [{ pos: 0, t: '0', b: '0%' }, { pos: 100, t: String(P), b: '100%', ut: ask === 'P' }, { pos: 100 + r, t: String(T), b: `${100 + r}%`, ut: ask === 'T' }], arrows: [{ from: 100, to: 100 + r, s: ask === 'T' ? `×${1 + r / 100}` : `÷${1 + r / 100}`, side: 'bot' }], label: '金額と割合の二本の数直線' });
  if (rnd() < 0.6) return { html: `税ぬき ${P}円 の${what}。消費税 ${r}% をたした ねだんは <b class="box">□</b> 円`, text: `税ぬき${P}円 + 消費税${r}% → □円`, slots: [slot(T, '円')],
    explain: () => [
      { fig: tape('T'), text: `税こみのねだん = 税ぬきのねだん (100%) + 消費税 (${r}%)。ぜんぶで <b>${100 + r}%</b> です。<br>${note}` },
      { fig: dl('T'), text: `${100 + r}% は 小数で ${1 + r / 100}。だから ${P} × ${1 + r / 100} = <b>${T}円</b><br><small>べつの考え方: 税は ${P} × ${r / 100} = ${P * r / 100}円。${P} + ${P * r / 100} = ${T}円</small>` },
      { fig: ueq([['単位の式', `${uqHTML(uq(P, '円'))}${uop('×')}${1 + r / 100}${uop('=')}${uqHTML(uq(T, '円'))}`, 'all']], '割合は 単位のない数'), text: `割合 (${1 + r / 100}) には単位がないので、円 × 割合 は 円 のままです。` },
    ] };
  return { html: `消費税 ${r}% をふくめて ${T}円 の${what}。税ぬきのねだんは <b class="box">□</b> 円`, text: `税こみ${T}円 (${r}%) → 税ぬき□円`, slots: [slot(P, '円')],
    explain: () => [
      { fig: tape('P'), text: `税こみの ${T}円 が ${100 + r}% にあたります。100% (税ぬき) を求めます。<br>${note}` },
      { fig: dl('P'), text: `${100 + r}% → 100% にもどすので、${T} ÷ ${1 + r / 100} = <b>${P}円</b><br><small>よくあるまちがい: ${T} から ${r}% を ひく (${T} × ${1 - r / 100}) と、${T * (100 - r) / 100}円 になって合いません。もとにする量 (100%) が ちがうからです。</small>` },
    ] };
};
GEN.m_discount = () => {
  const v = ri(0, 1); const P = ri(6, 60) * 100;
  if (v === 0) { const k = ri(1, 5); const S = P * (10 - k) / 10;
    return { html: `定価 ${P}円 の品物が ${k}割引き。ねだんは <b class="box">□</b> 円`, text: `${P}円の${k}割引き → □円`, slots: [slot(S, '円')],
      explain: () => [
        { fig: figTapes([{ s: '定価', segs: Array.from({ length: 10 }, (_, i) => ({ w: 1, s: i < 10 - k ? '1割' : '1割', cls: i < 10 - k ? 'sh' : 'sh2' })), braces: [{ from: 10 - k, to: 9, s: `${k}割 ひく` }, { from: 0, to: 9 - k, s: `のこり ${10 - k}割`, side: 'bot' }] }], { label: '定価を10に分けたテープ図' }),
          text: `1割 は 全体を 10こに分けた 1つ分 (0.1)。定価 ${P}円 の 1割は ${P / 10}円。<br>${k}割引き は、${k}割 をひいた のこり <b>${10 - k}割</b> をはらうことです。` },
        { fig: ueq([['のこりで考える', `${P} × ${(10 - k) / 10} = <b>${S}</b>`], ['ひいて考える', `${P} − ${P} × ${k / 10} = ${P} − ${P * k / 10} = <b>${S}</b>`]], '2つの考え方'), text: `どちらでも ${S}円。のこりの割合 (${(10 - k) / 10}) をかけると 1回で計算できます。` },
      ] }; }
  const p = pick([10, 15, 20, 25, 30, 40]); const S = P * (100 - p) / 100;
  return { html: `${P}円 の品物が ${p}%引き。ねだんは <b class="box">□</b> 円`, text: `${P}円の${p}%引き → □円`, slots: [slot(S, '円')],
    explain: () => [
      { fig: figDoubleLine({ top: '金額 (円)', bot: '割合', cols: [{ pos: 0, t: '0', b: '0%' }, { pos: 100 - p, t: String(S), b: `${100 - p}%`, ut: true }, { pos: 100, t: String(P), b: '100%' }], arrows: [{ from: 100, to: 100 - p, s: `×${(100 - p) / 100}`, side: 'bot' }], label: '割引きの二本の数直線' }),
        text: `% (パーセント) は 100 をもとにした割合。${p}%引き なら、はらうのは <b>${100 - p}%</b> = ${(100 - p) / 100}。<br>${P} × ${(100 - p) / 100} = <b>${S}円</b>` },
      { fig: figTable(['', '%', '小数', '割'], [['ひく分', `${p}%`, String(p / 100), `${p / 10}割`], ['はらう分', `${100 - p}%`, String((100 - p) / 100), `${(100 - p) / 10}割`], ['定価', '100%', '1', '10割']]),
        text: `% と 小数 と 割 は、同じ割合の ちがう書き方です。${p}% = ${p / 100} = ${p / 10}割。` },
    ] };
};
GEN.m_cost = () => {
  if (rnd() < 0.5) {
    const parts = [['材料', ri(3, 9) * 10], ['作る人の きゅうりょう', ri(2, 6) * 10], ['運ぶ・お店の 電気など', ri(1, 4) * 10], ['お店の もうけ', ri(1, 4) * 10]];
    const what = pick(['パン 1こ', 'ケーキ 1こ', 'おべんとう 1こ', 'ノート 1さつ']); const P = parts.reduce((s, x) => s + x[1], 0);
    return { html: `${what} のねだんの 内わけ (例): ${parts.map(([a, b]) => `${a} ${b}円`).join('、')}。税ぬきのねだんは <b class="box">□</b> 円`, text: `${what}の内わけ → □円`, slots: [slot(P, '円')],
      explain: () => [{ fig: figTapes([{ s: 'ねだん', segs: parts.map(([a, b], i) => ({ w: b, s: b >= 20 ? a.split(' ')[0] : '', cls: ['sh', 'sh3', 'sh', 'sh2'][i] })), total: `${P}円` }], { label: 'ねだんの内わけのテープ図' }) + figTable(['', '円'], parts.map(([a, b]) => [a, b]).concat([['合計 (ねだん)', `<b>${P}</b>`]]), { sumRow: parts.length }),
        text: `ねだんには、材料だけでなく、作る人の きゅうりょう、運ぶお金、お店をひらくお金、そして もうけ が入っています。ぜんぶたすと <b>${P}円</b>。<br><small>数字は説明のための例です。</small>`, lesson: 'price' }] };
  }
  const C = ri(4, 30) * 20; const r = pick([20, 25, 30, 40, 50]); const P = C * (100 + r) / 100;
  return { html: `${C}円 で仕入れた品物に、仕入れねの ${r}% のもうけをのせて 定価をつけます。定価は <b class="box">□</b> 円`, text: `仕入れ${C}円 + もうけ${r}% → 定価□円`, slots: [slot(P, '円')],
    explain: () => [
      { fig: figTapes([{ s: '定価', segs: [{ w: 100, s: `仕入れね ${C}円 (100%)` }, { w: r, s: `もうけ ${r}%`, cls: 'sh2' }], total: '□円' }], { label: '仕入れねともうけのテープ図' }),
        text: `お店は 品物を ${C}円 で仕入れて (買って)、それより高く売って もうけを出します。もとにするのは 仕入れね (100%)。定価は ${100 + r}% にあたります。`, lesson: 'price' },
      { fig: figDoubleLine({ top: '金額 (円)', bot: '割合', cols: [{ pos: 0, t: '0', b: '0%' }, { pos: 100, t: String(C), b: '100%' }, { pos: 100 + r, t: String(P), b: `${100 + r}%`, ut: true }], arrows: [{ from: 100, to: 100 + r, s: `×${(100 + r) / 100}`, side: 'bot' }], label: '仕入れねと定価の二本の数直線' }),
        text: `${C} × ${(100 + r) / 100} = <b>${P}円</b>。もうけは ${P} − ${C} = ${P - C}円 です。` },
    ] };
};
GEN.m_value = () => {
  if (rnd() < 0.5) {
    let a, b, pa, pb, ua, ub;
    do { a = pick([200, 300, 400, 500]); b = pick([300, 500, 600, 800, 1000]); ua = ri(10, 30) * 10; ub = ri(10, 30) * 10; pa = a / 100 * ua; pb = b / 100 * ub; } while (a === b || ua === ub || !Number.isInteger(pa) || !Number.isInteger(pb));
    const what = pick(['お米', 'ぶた肉', 'コーヒー豆', 'チーズ']); const ans = ua < ub ? 'A' : 'B';
    return { html: `${what} A: ${a} g で ${pa}円<br>${what} B: ${b} g で ${pb}円`, text: `A:${a}g${pa}円 / B:${b}g${pb}円`, lead: '100 g あたりが安いのはどっち？', choices: [{ id: 'A', html: 'A' }, { id: 'B', html: 'B' }], answerChoice: ans, slots: [],
      explain: () => [
        { fig: figTable(['', '重さ', '代金', '100 g あたり'], [['A', `${a} g`, `${pa}円`, `<b>${ua}円</b>`], ['B', `${b} g`, `${pb}円`, `<b>${ub}円</b>`]]) + figBars([{ s: 'A', v: ua, label: String(ua) }, { s: 'B', v: ub, label: String(ub), cls: 'sh3' }], ' 円/100g'),
          text: `量がちがうと、代金だけでは くらべられません。「100 g あたり」に そろえます。<br>A: ${pa} ÷ ${a / 100} = ${ua}円、B: ${pb} ÷ ${b / 100} = ${ub}円。安いのは <b>${ans}</b>。` },
        { fig: ueq([['A', `${uqHTML(uq(pa, '円'))}${uop('÷')}${uqHTML(uq(a, 'g'))}${uop('=')}${uqHTML(uq(ua, '円', 100, 'g'))}`, 'all'], ['B', `${uqHTML(uq(pb, '円'))}${uop('÷')}${uqHTML(uq(b, 'g'))}${uop('=')}${uqHTML(uq(ub, '円', 100, 'g'))}`, 'all']], 'どちらも 円/100g にそろえる'),
          text: `単位を そろえると くらべられます。円 ÷ g で「1 g あたり」、それを 100倍して「100 g あたり」(円/100g) にしました。`, lesson: 'price' },
      ] };
  }
  const one = ri(10, 25) * 10; const k = pick([3, 4, 5, 6]); const pack = one * k - ri(1, 4) * 10 * (k - 1); const save = one * k - pack;
  return { html: `1こ ${one}円 のヨーグルト。${k}こパックは ${pack}円 です。${k}こ ほしいとき、パックのほうが <b class="box">□</b> 円 安い`, text: `1こ${one}円 / ${k}こ${pack}円 → □円安い`, slots: [slot(save, '円')],
    explain: () => [
      { fig: figTapes([{ s: 'ばらで', segs: Array.from({ length: k }, () => ({ w: one, s: String(one) })), total: `${one * k}円` }, { s: 'パック', segs: [{ w: pack, s: `${pack}`, cls: 'sh3' }, { w: save, s: '', cls: 'cut' }], total: `${pack}円` }], { label: 'ばら買いとパックのテープ図' }),
        text: `ばらで ${k}こ: ${one} × ${k} = ${one * k}円。パック: ${pack}円。<br>${one * k} − ${pack} = <b>${save}円</b> 安くなります。1こあたりでは ${pack} ÷ ${k} = ${new Fr(pack, k).terminating() ? new Fr(pack, k).toDec() : '約' + Math.round(pack / k)}円 です。<br><small>まとめて売ると、お店は 運ぶ手間や包む手間が へるので、安くできることがあります。ただし、食べきれないと 安く買っても むだになります。</small>`, lesson: 'price' },
    ] };
};
GEN.m_fx = () => {
  const v = ri(0, 2); const cur = rnd() < 0.75 ? 'ドル' : 'ユーロ'; const R = pick(MONEY_FACTS.rates[cur]); const sym = cur === 'ドル' ? '$' : '€';
  const note = `<small>1${cur} が何円かを「為替レート」といいます。ほんとうのレートは毎日かわるので、ここの数字は例です。</small>`;
  if (v === 0) { const X = ri(2, 40) * 5; const Y = X * R;
    return { html: `1${cur} = ${R}円 のとき、${X}${cur} (${sym}${X}) は <b class="box">□</b> 円`, text: `1${cur}=${R}円で ${X}${cur} → □円`, slots: [slot(Y, '円')],
      explain: () => [
        { fig: rateFig('円', cur, [{ pos: 1, t: String(R), b: '1' }, { pos: X, t: Y.toLocaleString('ja-JP'), b: String(X), ut: true }]), text: `1${cur} が ${R}円。${X}${cur} は その ${X}こ分なので、${R} × ${X} = <b>${Y.toLocaleString('ja-JP')}円</b><br>${note}`, lesson: 'currency' },
        { fig: ueq([['単位の式', `${mulChain([uq(X, cur), uq(R, '円', 1, cur)])}${uop('=')}${uqHTML(uq(Y, '円'))}`, 'all']], '単位で たしかめる'), text: `レートは「1${cur} あたり何円」という 1あたりの量 (円/${cur})。${cur} が消えて 円 がのこります。` },
      ] }; }
  if (v === 1) { const X = ri(2, 40) * 5; const Y = X * R;
    return { html: `1${cur} = ${R}円 のとき、${Y.toLocaleString('ja-JP')}円 を ${cur} にかえると <b class="box">□</b> ${cur}`, text: `1${cur}=${R}円で ${Y}円 → □${cur}`, slots: [slot(X, cur)],
      explain: () => [
        { fig: rateFig('円', cur, [{ pos: 1, t: String(R), b: '1' }, { pos: X, t: Y.toLocaleString('ja-JP'), b: String(X), ub: true }]), text: `${R}円 で 1${cur}。${Y.toLocaleString('ja-JP')}円 の中に ${R}円 が いくつあるか: ${Y} ÷ ${R} = <b>${X}${cur}</b><br>${note}`, lesson: 'currency' },
        { fig: ueq([['単位の式', `${uqHTML(uq(Y, '円'))}${uop('÷')}${uqHTML(uq(R, '円', 1, cur))}${uop('=')}${mulChain([uq(Y, '円'), uq(1, cur, R, '円')])}${uop('=')}${uqHTML(uq(X, cur))}`, 'all']], '単位で たしかめる'), text: `円/${cur} でわるのは、${cur}/円 をかけるのと同じ。円 が消えて ${cur} がのこります。` },
      ] }; }
  const a = pick([150, 145, 140]); const d = pick([10, 20, 30]); const up = rnd() < 0.5; const b = up ? a + d : a - d; const ans = up ? 'yasu' : 'taka';
  return { html: `1ドル = ${a}円 だったのが、1ドル = ${b}円 になりました。`, text: `1ドル${a}円 → ${b}円`, lead: 'これは 円高？ 円安？', choices: [{ id: 'taka', html: '円高' }, { id: 'yasu', html: '円安' }], answerChoice: ans, slots: [],
    explain: () => [
      { fig: figTapes([{ s: `前 (1ドル)`, segs: [{ w: a, s: `${a}円` }] }, { s: `今 (1ドル)`, segs: [{ w: b, s: `${b}円`, cls: up ? 'sh2' : 'sh3' }] }], { label: '1ドルを買うのに必要な円のテープ図' }),
        text: `同じ 1ドル を手に入れるのに、前は ${a}円、今は ${b}円 必要です。<br>${up ? `前より 多くの円 が必要 → 円の 力 (ねうち) が 下がった → <b>円安</b>` : `前より 少ない円 ですむ → 円の 力 (ねうち) が 上がった → <b>円高</b>`}。<br><small>数字 (${a} → ${b}) が ${up ? '大きく' : '小さく'}なったのに「円${up ? '安' : '高'}」なので、まちがえやすいところです。</small>`, lesson: 'currency' },
      { fig: figTable(['', '円高 (1ドル が 少ない円で買える)', '円安 (1ドル に 多くの円がいる)'], [['外国へ旅行', 'とくになりやすい', 'そんになりやすい'], ['外国から買う物 (輸入)', '安くなりやすい', '高くなりやすい'], ['外国へ売る会社 (輸出)', 'もうけが へりやすい', 'もうけが ふえやすい']]),
        text: '円高・円安は、どちらが よい・わるい ではなく、立場によって とく・そん が ちがいます。' },
    ] };
};
GEN.m_interest = () => {
  const P = pick([10000, 20000, 50000, 100000]); const r = pick([1, 2, 3, 5]);
  if (rnd() < 0.6) { const n = ri(1, 3); const I = P * r / 100 * n;
    return { html: `${P.toLocaleString('ja-JP')}円 を、1年に ${r}% の利息がつく 銀行に あずけます。${n}年 で つく利息は <b class="box">□</b> 円 (毎年 はじめの ${P.toLocaleString('ja-JP')}円 にだけ 利息がつくとします)`, text: `${P}円 年${r}% ${n}年 (単利) → 利息□円`, slots: [slot(I, '円')],
      explain: () => [
        { fig: figIconFlow([{ ic: 'person', s: 'あずける人', sub: `${P.toLocaleString('ja-JP')}円`, o: { c: PEOPLE[0] } }, { ic: 'bank', s: '銀行' }, { ic: 'company', s: 'かりる人・会社' }], { arrows: ['あずける', 'かす'], back: '利息をつけて かえす → その一部が あずけた人へ', label: '銀行のお金の流れ' }),
          text: '銀行は、あずかったお金を 家や会社に かして、利息をつけて かえしてもらいます。その利息の一部が、あずけた人への 利息になります。', lesson: 'savings' },
        { fig: figTapes(Array.from({ length: n }, (_, i) => ({ s: `${i + 1}年目`, segs: [{ w: 100, s: `${P.toLocaleString('ja-JP')}円` }, { w: r * 6, s: `+${(P * r / 100).toLocaleString('ja-JP')}`, cls: 'sh2' }] })), { label: '毎年の利息のテープ図' }),
          text: `1年の利息は ${P.toLocaleString('ja-JP')} × ${r / 100} = ${(P * r / 100).toLocaleString('ja-JP')}円。${n}年 なら × ${n} で <b>${I.toLocaleString('ja-JP')}円</b>。<br><small>本当の 預金の利息は、税金が ひかれたり、利率が もっと低かったりします。数字は例です。</small>` },
      ] }; }
  const r2 = pick([5, 10]); const A1 = P * (100 + r2) / 100, A2 = A1 * (100 + r2) / 100;
  return { html: `${P.toLocaleString('ja-JP')}円 を 1年に ${r2}% ふえる方法で 2年 おきます。1年目の利息にも 次の年は 利息がつきます。2年後は <b class="box">□</b> 円`, text: `${P}円 年${r2}% 2年 (複利) → □円`, slots: [slot(A2, '円')],
    explain: () => [
      { fig: figTapes([{ s: 'はじめ', segs: [{ w: P, s: P.toLocaleString('ja-JP') }] }, { s: '1年後', segs: [{ w: P, s: P.toLocaleString('ja-JP') }, { w: A1 - P, s: `+${(A1 - P).toLocaleString('ja-JP')}`, cls: 'sh2' }] }, { s: '2年後', segs: [{ w: A1, s: A1.toLocaleString('ja-JP') }, { w: A2 - A1, s: `+${(A2 - A1).toLocaleString('ja-JP')}`, cls: 'sh2' }] }], { label: '利息に利息がつくテープ図' }),
        text: `1年後: ${P.toLocaleString('ja-JP')} × ${1 + r2 / 100} = ${A1.toLocaleString('ja-JP')}円。<br>2年後は この ${A1.toLocaleString('ja-JP')}円 全体が もとになる: × ${1 + r2 / 100} = <b>${A2.toLocaleString('ja-JP')}円</b>。<br>2年目の利息 (${(A2 - A1).toLocaleString('ja-JP')}円) が 1年目 (${(A1 - P).toLocaleString('ja-JP')}円) より多いのは、利息にも利息がつくからです (複利)。<br><small>お金を かりるときも 同じしくみで、返すのがおくれるほど 利息がふえます。</small>`, lesson: 'savings' },
    ] };
};
// ----- 税金 (C4) -----
// 所得税の段階 (2026年時点の国の所得税の表のはじめの2段。復興特別所得税などは入れない、かんたんにした計算)
const TAX_BRACKETS = [{ upto: 195, r: 5 }, { upto: 330, r: 10 }];
const man = (n) => `${n.toLocaleString('ja-JP')}万`;
GEN.t_share = () => {
  const B = pick([200, 300, 400, 500, 600, 800, 1000]);
  const uses = [['教育 (学校など)', pick([10, 15, 20, 25])], ['福祉・医療', pick([25, 30, 35])], ['道路・公園', pick([10, 15])]];
  const k = ri(0, uses.length - 1); const [what, r] = uses[k]; const part = B * r / 100;
  const rest = 100 - uses.reduce((s, u) => s + u[1], 0);
  const dl = (ask) => figDoubleLine({ top: '金額 (億円)', bot: '割合', cols: [{ pos: 0, t: '0', b: '0%' }, { pos: r, t: String(part), b: `${r}%`, ut: ask === 'part', ub: ask === 'r' }, { pos: 100, t: String(B), b: '100%' }], arrows: [], label: '金額と割合の二本の数直線' });
  const note = '<small>ある市の予算の例です (数字は計算しやすくしたもの)。</small>';
  const pc = [PAL.coral, PAL.purple, PAL.teal];
  const pie = (askR) => figPie([...uses.map(([a, p], i) => ({ v: p, s: i === k ? `${a.split(' ')[0]} ${askR ? '□' : p}%` : `${a.split(' ')[0]} ${p}%`, sub: i === k ? (askR ? `${part}億円` : '□億円') : '', c: i === k ? PAL.gold : pc[i], in: i === k ? (askR ? '□%' : `${p}%`) : '' })), { v: rest, s: `そのほか ${rest}%`, c: PAL.gray }], { label: '予算の使い道の円グラフ (例)' });
  if (rnd() < 0.6) return { html: `ある市の 1年の予算は ${B}億円。そのうち ${r}% を ${what} に使います。${what.split(' ')[0]} に使うお金は <b class="box">□</b> 億円`, text: `予算${B}億円の${r}% → □億円`, slots: [slot(part, '億円')],
    explain: () => [
      { fig: pie(), text: `予算 (100%) を、使い道ごとに 分けます。${what.split(' ')[0]} は そのうちの ${r}%。<br>${note}`, lesson: 'tax' },
      { fig: dl('part'), text: `${r}% は 小数で ${r / 100}。もとにする量 × 割合 = くらべる量 なので、${B} × ${r / 100} = <b>${part}億円</b>` },
    ] };
  return { html: `ある市の 1年の予算は ${B}億円。そのうち ${part}億円 を ${what} に使います。これは 予算全体の <b class="box">□</b> %`, text: `${B}億円のうち${part}億円 → □%`, slots: [slot(r, '%')],
    explain: () => [
      { fig: pie(true), text: `全体 ${B}億円 を 100% として、${part}億円 が 何% にあたるかを考えます。<br>${note}`, lesson: 'tax' },
      { fig: dl('r'), text: `割合 = くらべる量 ÷ もとにする量 = ${part} ÷ ${B} = ${r / 100}。百分率にすると × 100 で <b>${r}%</b>` },
    ] };
};
GEN.t_per = () => {
  if (rnd() < 0.5) {
    const [what, lo, hi] = pick([['市の図書館で 1年に買う本', 300, 900], ['市の スポーツ教室や 子ども会の手伝い (1年)', 200, 800], ['公園の 1年の手入れ', 300, 1200]]);
    const P = pick([2, 3, 4, 5]); const per = ri(Math.ceil(lo / P / 10), Math.floor(hi / P / 10)) * 10; const T = per * P; // T 万円、P 万人、per 円/人
    return { html: `${what} に ${man(T)}円 かかります。市の人 ${P}万人 で 分けると、1人あたり <b class="box">□</b> 円`, text: `${T}万円 ÷ ${P}万人 → 1人あたり□円`, slots: [slot(per, '円')],
      explain: () => [
        { fig: (() => { let b = icon('pot', 6, 10, 84) + svgText(48, 112, `${man(T)}円`, 'b'); const gw = Math.min(90, 420 / P); for (let g = 0; g < P; g++) { const x = 110 + g * gw; for (let i = 0; i < 4; i++) b += icon('person', x + (i % 2) * 22, 14 + Math.floor(i / 2) * 34, 26, { c: PEOPLE[(g + i) % 5] }); b += `<rect x="${r1(x - 4)}" y="8" width="${r1(gw - 10)}" height="80" rx="8" fill="none" stroke="${PAL.grayD}" stroke-dasharray="4 3"/>` + svgText(x + gw / 2 - 9, 104, '1万人', 's') + svgText(x + gw / 2 - 9, 120, `${man(per)}円`, g === 0 ? 'm' : 's'); } return svgBox(540, 128, b, '全体を1万人ずつのまとまりに分ける図'); })(),
          text: `みんなの税金で はらうお金も、1人あたりに 直すと 身近になります。全体 ÷ 人数 = 1人あたり。<br>${P}万人 を「1万人の まとまり ${P}こ」と見ると、1万人分は ${man(T)}円 ÷ ${P} = <b>${man(per)}円</b>。`, lesson: 'tax' },
        { fig: ueq([['単位の式', `${uqHTML(uq(T, '万円'))}${uop('÷')}${uqHTML(uq(P, '万人'))}${uop('=')}${uqHTML(uq(per, '円', 1, '人'))}`, 'all']], '万 と 万 は 消しあう'),
          text: `1万人で ${man(per)}円 なら、1人では その 1万分の1 で <b>${per}円</b>。<br>「万円 ÷ 万人」は、上と下の 万 が 消しあって「円 ÷ 人」になります。<br><small>たしかめ: ${(T * 10000).toLocaleString('ja-JP')}円 ÷ ${(P * 10000).toLocaleString('ja-JP')}人 = ${per}円。数字は例です。</small>` },
      ] };
  }
  let B, P; do { B = pick([300, 400, 600, 800, 900, 1200]); P = pick([10, 20, 30, 40]); } while (B % P);
  const per = B / P; // 万円/人
  return { html: `ある市の 1年の予算は ${B}億円、住んでいる人は ${P}万人 です。1人あたり <b class="box">□</b> 万円`, text: `${B}億円 ÷ ${P}万人 → 1人あたり□万円`, slots: [slot(per, '万円')],
    explain: () => [
      { fig: figTable(['', '数字で書くと', '0 の数'], [['1万', '10,000', '4こ'], ['1億', '100,000,000', '8こ'], ['1億 = 1万 × 1万', '', '4こ + 4こ']]),
        text: `億 は 万の 1万倍 (1億 = 1万 × 1万) です。だから ${B}億円 = ${B}万 × 1万 円。<br><small>数字は計算しやすくした例です。</small>`, lesson: 'tax' },
      { fig: ueq([['単位の式', `${uqHTML(uq(B, '億円'))}${uop('÷')}${uqHTML(uq(P, '万人'))}${uop('=')}${uqHTML(uq(per, '万円', 1, '人'))}`, 'all']], '億 ÷ 万 = 万'),
        text: `(${B}万 × 1万)円 ÷ (${P} × 1万)人。上と下の「1万」が 消しあうので、${B}万円 ÷ ${P}人 = <b>${per}万円</b> (1人あたり)。<br>1人で ${per}万円 を はらうのは たいへんでも、みんなで出しあうと 学校や道路のような 大きな仕事ができます。` },
    ] };
};
GEN.t_income = () => {
  const X = ri(20, 33) * 10; // 課税される所得 (万円) 200〜330
  const b1 = TAX_BRACKETS[0].upto; const t1 = b1 * 10000 * TAX_BRACKETS[0].r / 100; const t2 = (X - b1) * 10000 * TAX_BRACKETS[1].r / 100; const T = t1 + t2;
  return { html: `所得税は、かせぎ (税金の計算に使う所得) のうち ${b1}万円 までの部分に ${TAX_BRACKETS[0].r}%、それをこえた部分に ${TAX_BRACKETS[1].r}% かかります。所得が ${X}万円 の人の 所得税は <b class="box">□</b> 円`, text: `所得${X}万円 (195万まで5%・こえた分10%) → 所得税□円`, slots: [slot(T, '円')],
    explain: () => [
      { fig: figTapes([{ s: `所得 ${X}万`, segs: [{ w: b1, s: `${b1}万まで → ${TAX_BRACKETS[0].r}%` }, { w: X - b1, s: `${X - b1}万 → ${TAX_BRACKETS[1].r}%`, cls: 'sh2' }] }], { label: '所得を段に分けるテープ図' }),
        text: `所得税は、所得を 段に分けて、上の段ほど 高い割合をかけます (かせぎが多い人ほど 多くはらう しくみ)。<br>${X}万円 は、${b1}万円 までの部分 と、こえた ${X - b1}万円 に 分かれます。`, lesson: 'tax' },
      { fig: figTable(['部分', '計算', '税金'], [[`${b1}万円 まで`, `${(b1 * 10000).toLocaleString('ja-JP')} × ${TAX_BRACKETS[0].r / 100}`, `${t1.toLocaleString('ja-JP')}円`], [`こえた ${X - b1}万円`, `${((X - b1) * 10000).toLocaleString('ja-JP')} × ${TAX_BRACKETS[1].r / 100}`, `${t2.toLocaleString('ja-JP')}円`], ['あわせて', '', `<b>${T.toLocaleString('ja-JP')}円</b>`]]),
        text: `それぞれの部分に 割合をかけて たします: ${t1.toLocaleString('ja-JP')} + ${t2.toLocaleString('ja-JP')} = <b>${T.toLocaleString('ja-JP')}円</b>。<br>${X}万円 全部に 10% をかけると ${(X * 1000).toLocaleString('ja-JP')}円 になり、多すぎます。10% は こえた部分だけ です。<br><small>本当の計算は、きゅうりょうから いろいろな金額を ひいた残りに かけ、ほかの税もあります。ここは かんたんにした例です。</small>` },
    ] };
};
GEN.t_year = () => {
  const M = pick([5, 8, 10, 12, 15, 20]); const r = MONEY_FACTS.taxStd; const Y = M * 10000 * 12 * r / 100;
  return { html: `ある家族は、1か月に 税ぬきで ${M}万円 の買い物をします (消費税はすべて ${r}% とします)。1年間に はらう消費税は <b class="box">□</b> 円`, text: `毎月税ぬき${M}万円 × 12か月 の ${r}% → □円`, slots: [slot(Y, '円')],
    explain: () => [
      { fig: figTapes([{ s: '1か月', segs: [{ w: 100, s: `${M}万円` }, { w: r * 2.2, s: `税`, cls: 'sh2' }] }, { s: '1年', segs: Array.from({ length: 12 }, (_, i) => ({ w: 100 / 12 * 1.1, s: '', cls: 'sh2' })), total: '12か月分の税' }], { label: '毎月の消費税を12か月あつめるテープ図' }),
        text: `消費税は、買い物のたびに 少しずつ はらう税金です。1か月の消費税は ${(M * 10000).toLocaleString('ja-JP')} × ${r / 100} = ${(M * 10000 * r / 100).toLocaleString('ja-JP')}円。`, lesson: 'tax' },
      { fig: ueq([['単位の式', `${mulChain([uq(M * 1000, '円', 1, 'か月'), uq(12, 'か月')])}${uop('=')}${uqHTML(uq(Y, '円'))}`, 'all']], 'か月 が 消える'),
        text: `1年は 12か月 なので、${(M * 1000).toLocaleString('ja-JP')}円/か月 × 12か月 = <b>${Y.toLocaleString('ja-JP')}円</b>。<br>1回は 小さくても、1年分 あつめると 大きな金額です。日本中で あつまった消費税は、年金・医療・介護・子育てに 使われることになっています。` },
    ] };
};
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
function moneyWhatFrames() {
  const barter = (() => {
    const W = 540; let b = '';
    const nm = { fish: 'さかな', bread: 'パン', shoe: 'くつ' };
    const P = [{ x: 90, c: PEOPLE[0], has: 'fish', want: 'bread' }, { x: 270, c: PEOPLE[1], has: 'bread', want: 'shoe' }, { x: 450, c: PEOPLE[2], has: 'shoe', want: 'fish' }];
    P.forEach((p) => {
      b += icon('thinking', p.x + 4, 0, 54) + icon(p.want, p.x + 15, 5, 30);
      b += icon('person', p.x - 44, 44, 64, { c: p.c }) + icon(p.has, p.x + 6, 80, 36);
      b += svgText(p.x, 136, `${nm[p.has]} を もっている`, 's') + svgText(p.x, 152, `${nm[p.want]} が ほしい`, 'b');
    });
    b += arrowTo(130, 186, 230, 186, '', 0) + `<text x="180" y="180" text-anchor="middle" class="m big">✕</text>`;
    b += svgText(180, 210, '「さかなと パンを かえて」→「くつなら いいよ」', 's');
    b += svgText(450, 196, 'ぴったり合う 相手が', 's') + svgText(450, 212, 'なかなか 見つからない', 's');
    return svgBox(W, 222, b, '物々交換の図');
  })();
  return [
    { fig: barter,
      text: '<b>お金がなかったら？</b><br>むかしは 物と物を とりかえる「物々交換」をしていました。でも、さかなを持っている人が パンをほしくても、パン屋さんが ほしいのは くつ…。<br>おたがいに ほしい物が ぴったり合う相手を さがすのは、とても たいへんです。' },
    { fig: figIconFlow([{ ic: 'fish', s: 'さかな' }, { ic: 'coin', s: 'お金', o: { s: '円' } }, { ic: 'bread', s: 'パン' }], { arrows: ['売る', '買う'], label: 'お金をなかだちにする交換' }),
      text: '<b>お金が「なかだち」をする</b><br>さかなを いったん お金にかえておけば、そのお金で だれからでも パンが買えます。お金は、だれとでも 交換できる 道具です。' },
    { fig: figCards([{ ic: 'swap', s: '① 交換する', sub: '物やサービスと\nとりかえる' }, { ic: 'ruler', s: '② ねうちを はかる', sub: '「120円」のように\n同じものさしで くらべる' }, { ic: 'piggy', s: '③ ためておく', sub: 'くさらずに\nあとで使える' }], { label: 'お金の3つのやくわり' }),
      text: '<b>お金の 3つのやくわり</b><br>① 交換する: 物やサービスと とりかえる。<br>② ねうちを はかる: 「120円」のように、ちがう物どうしの ねうちを 同じものさしで くらべられる (単位の「円」と同じ考え方です)。<br>③ ためておく: さかなは くさるけれど、お金は とっておいて あとで使えます。' },
    { fig: figCards([{ ic: 'bill', s: 'お札', sub: '日本銀行が つくる\n1万円・5千円・千円', o: { s: '10000', size: 18, c: '#B9A6E0' } }, { ic: 'coin', s: 'コイン', sub: '国 (政府) が つくる\n500円・100円・10円など', o: { s: '500', size: 26, c: '#E8C766' } }, { ic: 'phone', s: '電子マネー', sub: 'お金の データを\nやりとりする' }], { label: 'お金のいろいろな形' }),
      text: '<b>お金の いろいろな形</b><br>日本のお札は 日本銀行、コインは 国が発行しています。お札の紙そのものの ねうちは 小さいのに 1万円として使えるのは、「みんなが 1万円として うけとる」と 信じているから (信用) です。<br>電子マネーは、目に見えなくても 同じ「円」のデータを やりとりしています。' },
    { fig: figCycle([{ ic: 'house', s: '家', x: 270, y: 50 }, { ic: 'shop', s: 'お店・会社', x: 90, y: 230 }, { ic: 'city', s: '国・市', x: 450, y: 230 }],
      [{ a: 0, b: 1, s: '買い物', bend: 46 }, { a: 1, b: 0, s: 'きゅうりょう', bend: 46 }, { a: 0, b: 2, s: '税金', bend: -46 }, { a: 2, b: 0, s: '学校・道路', bend: -46 }, { a: 1, b: 2, s: '税金', bend: 0 }], { H: 290, label: 'お金のめぐり' }),
      text: '<b>お金は めぐっている</b><br>家の人は はたらいて きゅうりょうをもらい、買い物をします。お店や会社は そのお金で きゅうりょうを はらいます。家も会社も 税金を おさめ、税金は 学校・道路・病院など みんなのために使われます。', lesson: 'tax' },
  ];
}
function priceFrames() {
  const parts = [['材料', 60, PAL.orange], ['作る人の きゅうりょう', 50, PAL.blue], ['運ぶ・店の電気', 30, PAL.teal], ['お店の もうけ', 40, PAL.gold], ['消費税', 18, PAL.coral]];
  const loaf = (() => {
    const W = 540, x0 = 20, w = 500, tot = 198; let b = '', x = x0;
    b += `<path d="M${x0} 120 V70 Q${x0} 20 ${x0 + 60} 20 H${x0 + w - 60} Q${x0 + w} 20 ${x0 + w} 70 V120 Z" fill="${PAL.orange}" stroke="${PAL.ink}" stroke-width="2"/>`;
    parts.forEach(([s, v, c], i) => { const ww = v / tot * w; b += `<rect x="${r1(x)}" y="46" width="${r1(ww)}" height="74" fill="${c}" stroke="${PAL.ink}" stroke-width="1.5"/>`; b += `<text x="${r1(x + ww / 2)}" y="90" text-anchor="middle" class="ict" style="font-size:15px;fill:${PAL.ink}">${v}円</text>`; b += svgText(x + ww / 2, 142 + (i % 2) * 18, s.replace('作る人の ', ''), 's'); x += ww; });
    b += svgText(W / 2, 14, 'パン 1こ 198円 を、中身ごとに 切ってみると (例)', 'b');
    return svgBox(W, 176, b, 'パンのねだんの内わけ');
  })();
  return [
    { fig: loaf,
      text: '<b>ねだんの 中身</b><br>パン 1こ のねだんには、材料だけでなく、作る人の きゅうりょう、運ぶお金、お店の電気代、お店の もうけ、そして 消費税が 入っています (数字は例)。<br>どれかが 高くなると、ねだんも 上がりやすくなります。' },
    { fig: figScale(4, 4, { label: 'ほしい人と品物がつりあうてんびん' }),
      text: '<b>ほしい人 と 売りたい品物 の つりあい</b><br>ねだんが 安いほど ほしい人は ふえ、高いほど 売りたい人 (作りたい人) は ふえます。<br>この 2つが ちょうど つりあうところで、ねだんが 決まりやすくなります。これを「需要 (ほしい) と 供給 (売りたい)」といいます。' },
    { fig: figScale(8, 3, { goods: 'umbrella', label: 'ほしい人が多いてんびん' }) + figScale(2, 8, { goods: 'bread', tag: 'ねだん ↓ 下がる', label: '品物が多いてんびん' }),
      text: '<b>ほしい人が ふえると</b><br>急な大雨の日の かさ のように、ほしい人が 急に ふえると、てんびんが かたむいて ねだんは 上がりやすくなります。<br>反対に、たくさん作りすぎて 売りたい品物が あまっているときは、ねだんが 下がりやすくなります。' },
    { fig: figCards([{ ic: 'water', s: '水 1本', sub: '山の上で からから → 高い\n家に水道がある → 低い' }, { ic: 'umbrella', s: 'かさ', sub: '急な 大雨 → 高い\n晴れの日 → 低い' }, { ic: 'book', s: 'マンガ', sub: '読みたかった新刊 → 高い\nもう持っている → 低い' }], { label: '場面でかわるねうち' }),
      text: '<b>ねうちは 人や場面で かわる</b><br>同じ物でも、だれが・いつ・どこで 使うかで、ねうち (どれだけ ほしいか) は かわります。<br>だから 買う前に「わたしにとって このねだんの ねうちがあるか」を 考えることが 大切です。' },
    { fig: figCards([{ ic: 'ruler', s: '1あたりで くらべる', sub: '100 g・1こ あたりの\nねだんに そろえる' }, { ic: 'bag', s: '割引きを 計算', sub: '何% 引き？\nはらうのは いくら？' }, { ic: 'thinking', s: 'ほんとうに 使う？', sub: 'まとめ買い・安いから\nだけで 決めない' }], { label: 'かしこい買い物' }),
      text: '<b>まとめ: かしこい 買い物</b><br>・ねだんの中身 (材料・人・運ぶ・もうけ・税) を 知る。<br>・ねだんは ほしい人と 売りたい品物の つりあいで かわる。<br>・くらべるときは「1あたり」に そろえる (単位も計算する)。<br>・安さだけでなく、ほんとうに 使うかどうかも 考える。' },
  ];
}
function currencyFrames() {
  const cur = (s, sub, c) => ({ ic: 'coin', s, sub, o: { s: sub.split(' ')[0], size: 30, c } });
  const dollarEq = (yenV, tag, cls) => { const [row, w] = moneyRow(yenV, 140, 0, { sz: 40 }); return { row, w, tag, cls, yenV }; };
  const rates = (rows, label) => {
    const W = 540; let b = '';
    rows.forEach((r, i) => { const y = 10 + i * 62; const [row, w] = moneyRow(r.yenV, 130, y, { sz: 40 }); b += icon('coin', 20, y, 44, { s: '$1', size: 22, c: '#9FD3A8' }) + svgText(94, y + 28, '=', 'b big') + row + svgText(150 + w, y + 28, `${r.yenV}円`, 'b', 'start') + (r.tag ? svgText(W - 10, y + 28, r.tag, r.cls || 'b', 'end') : ''); });
    return svgBox(W, rows.length * 62 + 10, b, label);
  };
  return [
    { fig: figCards([cur('日本', '¥ 円', PAL.gold), cur('アメリカ', '$ ドル', '#9FD3A8'), cur('ヨーロッパ', '€ ユーロ', PAL.sky), cur('イギリス', '£ ポンド', PAL.pink), cur('中国', '元 人民元', PAL.coral), cur('韓国', '₩ ウォン', PAL.purple)], { cols: 3, isz: 46, label: '国ごとの通貨' }),
      text: '<b>国ごとに ちがう お金 (通貨)</b><br>日本は 円、アメリカは ドル のように、国や地いきごとに 使うお金が ちがいます。<br>外国で 買い物をするときは、円を その国の お金に とりかえます (両替)。' },
    { fig: rates([{ yenV: 150 }], '1ドルと150円') + rateFig('円', 'ドル', [{ pos: 1, t: '150', b: '1' }, { pos: 10, t: '1500', b: '10' }]),
      text: '<b>為替レート = 1ドル あたり 何円</b><br>「1ドル = 150円」なら、1ドルと 100円玉 1まい + 50円玉 1まい が 同じねうち。10ドル は 1500円 です。<br>レートは「1あたりの量」(円/ドル) なので、速さや 密度と 同じように 二本の数直線で 考えられます。レートは 毎日 少しずつ かわります (ここの数字は例です)。' },
    { fig: rates([{ yenV: 120, tag: '円高', cls: 'm' }, { yenV: 150, tag: '' }, { yenV: 180, tag: '円安', cls: 'm' }], '1ドルに必要な円'),
      text: '<b>円高 と 円安</b><br>1ドル を手に入れるのに 必要な円が 少なくなる (150円 → 120円) のが <b>円高</b>: 円の ねうちが 上がった。<br>多く必要になる (150円 → 180円) のが <b>円安</b>: 円の ねうちが 下がった。<br>数字が 小さくなるのに「高」なので、「円の 力が 強くなった」と 考えると わかりやすいです。' },
    { fig: figCards([{ ic: 'plane', s: '外国旅行', sub: '円高 → とく\n円安 → そん' }, { ic: 'shipIn', s: '輸入 (外国から買う)', sub: '円高 → 安くなりやすい\n円安 → 高くなりやすい' }, { ic: 'company', s: '輸出 (外国へ売る)', sub: '円高 → もうけ へりやすい\n円安 → もうけ ふえやすい' }], { label: '円高円安でとくする人・そんする人' }),
      text: '<b>だれが とく？ そん？</b><br>円高・円安は、どちらが よい とは決まっていません。旅行する人、外国から物を買う会社、外国へ物を売る会社で、とく・そんが 反対になります。' },
    { fig: ueq([['円 → ドル', `${uqHTML(uq(3000, '円'))}${uop('÷')}${uqHTML(uq(150, '円', 1, 'ドル'))}${uop('=')}${uqHTML(uq(20, 'ドル'))}`, 'all'], ['ドル → 円', `${mulChain([uq(20, 'ドル'), uq(150, '円', 1, 'ドル')])}${uop('=')}${uqHTML(uq(3000, '円'))}`, 'all']], '単位の式で 両替'),
      text: '<b>まとめ: 両替も 単位の計算</b><br>ドル → 円 は レート (円/ドル) を かける、円 → ドル は レートで わる。どちらにするか まよったら、単位が 消えて ほしい通貨が のこるかを たしかめましょう。' },
  ];
}
function savingsFrames() {
  const leg = [{ c: PAL.gold, s: 'あずけたお金' }, { c: PAL.coral, s: '1年目の利息' }, { c: PAL.purple, s: '2年目の利息' }, { c: PAL.teal, s: '3年目の利息' }];
  return [
    { fig: figIconFlow([{ ic: 'person', s: 'あずける人', o: { c: PEOPLE[0] } }, { ic: 'bank', s: '銀行' }, { ic: 'company', s: 'かりる人・会社' }], { arrows: ['あずける', 'かす'], back: '利息をつけて かえす → その一部が あずけた人へ', label: '銀行のしくみ' }),
      text: '<b>銀行の しくみ</b><br>銀行は、みんなから あずかったお金を、家を買う人や 会社に かします。かりた人は「かりたお礼」として 利息をつけて かえします。その一部が、あずけた人への 利息になります。' },
    { fig: figColumns([0, 1, 2, 3].map((y) => ({ s: `${y}年後`, base: 10000, add: y ? Array.from({ length: y }, (_, i) => ({ v: 500, c: leg[i + 1].c })) : [], top: `${(10000 + 500 * y).toLocaleString('ja-JP')}円` })), { max: 12000, legend: leg, label: '毎年同じだけ利息がつく柱の図' }),
      text: '<b>利息の計算 (単利)</b><br>10000円 を 1年に 5% で あずけると、1年の利息は 10000 × 0.05 = 500円。毎年 はじめの 10000円 にだけ 利息がつくなら、柱は 毎年 同じ高さ (500円) ずつ のびて、3年で 1500円。<br><small>本当の預金の利率は もっと低いことが多く、税金も ひかれます。数字は 計算しやすい例です。</small>' },
    { fig: figColumns([{ s: 'はじめ', base: 10000, top: '10,000円' }, { s: '1年後', base: 10000, add: [{ v: 1000, c: leg[1].c }], top: '11,000円' }, { s: '2年後', base: 10000, add: [{ v: 1000, c: leg[1].c }, { v: 1100, c: leg[2].c }], top: '12,100円' }, { s: '3年後', base: 10000, add: [{ v: 1000, c: leg[1].c }, { v: 1100, c: leg[2].c }, { v: 1210, c: leg[3].c }], top: '13,310円' }], { max: 14000, legend: leg, label: '利息に利息がつく柱の図' }),
      text: '<b>利息にも 利息がつく (複利)</b><br>1年に 10% ふえると、1年後 11000円。次の年は 11000円 全体が もとになるので 利息は 1100円、その次は 1210円…。<br>色のついた 利息の だんが、年ごとに 少しずつ 厚くなっていきます。長い間 ためるほど ちがいが 大きくなります。' },
    { fig: figCards([{ ic: 'piggy', s: 'ためる (あずける)', sub: '利息を もらう\n長いほど ふえる', cls: 'sh' }, { ic: 'card', s: 'かりる (ローン・あとばらい)', sub: '利息を はらう\nおそいほど はらう分が ふえる', cls: 'sh2' }], { cols: 2, label: 'ためるとかりるの反対' }),
      text: '<b>かりるときは 反対</b><br>お金を かりると、利息を はらいます。返すのが おそいほど、はらう利息は ふえます。<br>カードの「あとばらい」や 分割ばらいも、手数料 (利息のようなもの) が つくことがあります。' },
    { fig: figIconFlow([{ ic: 'gift', s: 'もらう', sub: 'おこづかい\nお年玉' }, { ic: 'jar', s: 'わける', sub: 'つかう・ためる\nだれかのために', o: { n: 4 } }, { ic: 'note', s: 'ふりかえる', sub: 'おこづかい帳\nで計算' }], { label: 'お金の使い方のサイクル' }),
      text: '<b>まとめ: 自分のお金を どう使う？</b><br>もらったお金を「今つかう」「ためて あとで使う」に 分けて、おこづかい帳で 計算してみましょう。<br>パーセントや 利息の計算は、大人になって 貯金や ローンを えらぶときに そのまま 役立ちます。' },
  ];
}
function taxFrames() {
  const potFig = (() => {
    const W = 540; let b = '';
    for (let i = 0; i < 5; i++) { const x = 18 + i * 44; b += icon('person', x, 10, 40, { c: PEOPLE[i] }) + icon('coin', x + 10, 54, 20, { s: '¥', size: 40 }); }
    b += arrowTo(120, 84, 170, 120, '税金', 0) + icon('pot', 150, 110, 96) + svgText(198, 222, '国・県・市', 'b');
    [['school', '学校'], ['road', '道路'], ['firetruck', '消防・救急'], ['hospital', '病院']].forEach(([ic, s], i) => { const x = 380 + (i % 2) * 80, y = 20 + Math.floor(i / 2) * 100; b += icon(ic, x, y, 60) + svgText(x + 30, y + 76, s, 's'); });
    b += arrowTo(250, 150, 372, 110, '使う', -10);
    return svgBox(W, 232, b, '税金を出しあって使う図');
  })();
  const stairs = (() => {
    const W = 540, base = 200, k = 0.32; let b = '';
    const ppl = [{ s: 'かせぎ 200万', segs: [[195, 5], [5, 10]] }, { s: 'かせぎ 300万', segs: [[195, 5], [105, 10]] }, { s: 'かせぎ 500万', segs: [[195, 5], [135, 10], [170, 20]] }];
    const col = { 5: PAL.sky, 10: PAL.gold, 20: PAL.coral };
    ppl.forEach((p, i) => { const x = 40 + i * 170; let y = base; p.segs.forEach(([v, r]) => { const h = v * k; y -= h; b += `<rect x="${x}" y="${r1(y)}" width="90" height="${r1(h)}" fill="${col[r]}" stroke="${PAL.ink}" stroke-width="1.2"/>`; if (h > 14) b += `<text x="${x + 45}" y="${r1(y + h / 2 + 5)}" text-anchor="middle" class="ict" style="font-size:13px;fill:${PAL.ink}">${r}%</text>`; }); b += svgText(x + 45, base + 18, p.s, 's') + icon('person', x + 100, base - 44, 40, { c: PEOPLE[i] }); });
    b += svgText(W / 2, 14, 'かせぎの 上の段ほど 高い割合 (かんたんにした例)', 'b');
    return svgBox(W, base + 28, b, '所得税の段の図');
  })();
  const perPerson = (() => {
    const W = 540; let b = icon('pot', 10, 20, 100) + svgText(60, 140, '市の予算 600億円', 'b');
    b += arrowTo(120, 70, 190, 70, '÷ 20万人');
    for (let i = 0; i < 12; i++) b += icon('person', 200 + (i % 6) * 34, 20 + Math.floor(i / 6) * 50, 32, { c: PEOPLE[i % 5] });
    b += svgText(300, 136, '…ぜんぶで 20万人', 's') + arrowTo(410, 70, 450, 70, '');
    b += icon('coin', 458, 34, 60, { s: '30万', size: 20 }) + svgText(488, 116, '1人あたり', 'b') + svgText(488, 134, '30万円', 'm');
    return svgBox(W, 150, b, '1人あたりに直す図 (例)');
  })();
  return [
    { fig: potFig,
      text: '<b>税金ってなに？</b><br>学校・道路・消防のように、1人では 作れないけれど みんなに 必要なものがあります。そのお金を、みんなで 少しずつ 出しあうのが 税金です。<br>あつめたお金を 何に使うかは、選挙で選ばれた人 (国会議員・市議会議員など) が 話し合って決めます。' },
    { fig: figCards([{ ic: 'school', s: '公立の小・中学校', sub: '授業料は 無料\n教科書も 国が 配る' }, { ic: 'signal', s: '道路・信号・橋', sub: 'だれでも 通れる' }, { ic: 'firetruck', s: '消防・救急車', sub: 'よんでも\nお金は かからない' }, { ic: 'police', s: '警察', sub: 'まちの 安全を守る' }, { ic: 'garbage', s: 'ごみの収集', sub: 'まちを きれいにする' }, { ic: 'tree', s: '図書館・公園', sub: 'だれでも 使える' }], { label: '税金で動いているもの' }),
      text: '<b>身のまわりの 税金</b><br>毎日 通う学校も、税金で 動いています。先生の きゅうりょう、校舎、教科書などに 税金が 使われています。<br>「ただ (無料)」に見えるものも、本当は みんなが 出しあったお金で できています。' },
    { fig: figCards([{ ic: 'bag', s: '消費税', sub: '買い物のとき\n10% (食べ物は 8%)' }, { ic: 'envelope', s: '所得税', sub: 'はたらいて\nかせいだとき → 国' }, { ic: 'house', s: '住民税', sub: 'まちに 住んでいる\n→ 県・市' }, { ic: 'land', s: '固定資産税', sub: '土地や家を\n持っている → 市' }, { ic: 'car', s: '自動車税', sub: '車を 持っている\n→ 県' }, { ic: 'person', s: '子どもも…', sub: 'おかしを買うと\n消費税を はらう', o: { c: PAL.coral } }], { label: 'いろいろな税金' }),
      text: '<b>いろいろな 税金</b><br>子どもも、おかしを買うとき 消費税を はらっています。大人は、かせいだとき (所得税)、住んでいるとき (住民税) などにも はらいます。<br><small>割合や しくみは このアプリを作った時点のもので、かわることがあります。</small>' },
    { fig: stairs,
      text: '<b>公平に 出しあう くふう</b><br>所得税は、かせぎを 段に分けて、上の段ほど 高い割合を かけます (5% から 45% まで)。かせぎが多い人ほど、多く はらうしくみです。<br>消費税は、だれが買っても 同じ割合です。だから、かせぎが 少ない人にとっては 重く感じやすい、という 意見もあります。<br><small>本当の計算は、きゅうりょうから いろいろな金額を ひいた残りに かけます。図は かんたんにした例です。</small>' },
    { fig: figPie([{ v: 33, s: '社会保障 約3分の1', sub: '年金・医療・介護・子育て', c: PAL.coral, in: '1/3' }, { v: 25, s: '借金の返済など 約4分の1', sub: '前に かりたお金 (国債)', c: PAL.purple, in: '1/4' }, { v: 16, s: '地方へ 約6分の1', sub: '県や市に わたす', c: PAL.teal, in: '1/6' }, { v: 26, s: 'そのほか', sub: '道路・教育・防衛など', c: PAL.gold }], { label: '国の予算の使い道 (おおよそ)' }),
      text: '<b>国の お金の 使い道 (おおよそ)</b><br>国の予算で いちばん大きいのは 社会保障 (年金・医療・介護・子育て) で、約3分の1。次に 大きいのは、前に かりたお金 (国債) を 返すための お金で、約4分の1。地方 (県や市) にも わたします。のこりで 道路・教育・防衛などを まかないます。<br>税金だけでは 足りず、国は 借金もしています。<br><small>割合は おおよそで、年によって かわります。</small>' },
    { fig: perPerson + ueq([['1人あたり', `${uqHTML(uq(600, '億円'))}${uop('÷')}${uqHTML(uq(20, '万人'))}${uop('=')}${uqHTML(uq(30, '万円', 1, '人'))}`, 'all']], '億 ÷ 万 = 万'),
      text: '<b>まとめ</b><br>・税金は、みんなで出しあって、みんなのために使う お金。<br>・何億円 という 大きな数は、1人あたりに 直すと 身近になる (億 ÷ 万 = 万)。<br>・使い道を 決める人は 選挙で選ぶ。18歳になると 選挙で 自分の考えを 伝えられます。<br>税金の 使われ方を 割合や 1人あたりで 考えられることが、算数の 大事な使い道です。' },
  ];
}
const LESSONS = {
  order: { title: '計算の順番のわけ', frames: orderWhyFrames, stage: 'A4', btn: 'なぜこの順番？ くわしく見る' },
  unit: { title: '単位も計算する', frames: unitWhyFrames, stage: 'B5', btn: '単位の計算を くわしく見る' },
  money: { title: 'お金ってなに？', frames: moneyWhatFrames, stage: 'C1', btn: 'お金のしくみを見る' },
  price: { title: 'ねだんは どう決まる？', frames: priceFrames, stage: 'C2', btn: 'ねだんの決まり方を くわしく見る' },
  currency: { title: '通貨と為替 (円高・円安)', frames: currencyFrames, stage: 'C3', btn: '通貨と為替を くわしく見る' },
  savings: { title: 'ためる・かりる (利息)', frames: savingsFrames, stage: 'C3', btn: '利息のしくみを くわしく見る' },
  tax: { title: '税金ってなに？', frames: taxFrames, stage: 'C4', btn: '税金のしくみを見る' },
};

function makeProblem(type, level) {
  const p = GEN[type](level);
  if (p.units) { const ex = p.explain, uf = p.units; p.explain = () => [...ex(), ...uf()]; }
  p.type = type; p.stage = stageOfType(type); p.level = STAGES[p.stage].levels ? level : null;
  p.answerText = p.choices ? (p.choices.find((c) => c.id === p.answerChoice).text || p.choices.find((c) => c.id === p.answerChoice).html)
    : p.slots.map((s) => `${ansText(s.value, s.prefer)}${s.unit ? ' ' + s.unit : ''}`).join(' ');
  p.answerHTML = p.choices ? p.choices.find((c) => c.id === p.answerChoice).html
    : p.slots.map((s) => `${ansHTML(s.value, s.prefer)}${s.unit ? ' ' + s.unit : ''}`).join(' ');
  return p;
}

if (typeof module !== 'undefined') module.exports = { Fr, GEN, makeProblem, LESSONS, STAGES, TRACKS, LEVEL_RAMP, levelTypes, judgeSlot, parseAnswer, addSubFrames, mulFrames, divFrames, exprSteps, gridHTML, setRnd: (f) => { rnd = f; } };
