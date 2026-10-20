// 仕組みの図 (位のタイル図) の こ数が、答えと一致するかを確かめる
const src = require('fs').readFileSync(__dirname + '/logic.js', 'utf8').replace(/if \(typeof module[\s\S]*$/, '');
const T = new Function(src + '; return { makeProblem, placeList, digitsMap, carryChain, Fr, placeParts };')();
const read = (ps, m) => { let v = new T.Fr(0); ps.forEach((p) => { v = v.add(T.Fr.dec(String(m[p] || 0)).mul(p >= 0 ? new T.Fr(10 ** p) : new T.Fr(1, 10 ** -p))); }); return v; };
let bad = 0, n = 0;
for (const [t, lvs] of [['int_add', [1, 2]], ['int_sub', [1, 2]], ['dec_add', [1, 2]], ['dec_sub', [1, 2]], ['int_mul', [3]], ['dec_mul', [3]]]) for (const lv of lvs) for (let i = 0; i < 2000; i++) {
  const p = T.makeProblem(t, lv); const [a, op, b] = p.text.split(' ');
  const ans = p.slots[0].value; n++;
  if (op === '+' || op === '×') {
    const ps = T.placeList([a, b, ans.toDec()]); const A = T.digitsMap(a), B = T.digitsMap(b);
    const cnt = {}; ps.forEach((q) => { cnt[q] = op === '+' ? (A[q] || 0) + (B[q] || 0) : (A[q] || 0) * +b; });
    if (op === '×') { const ps2 = T.placeList([a, ans.toDec()]); ps.length = 0; ps.push(...ps2); }
    const { fin } = T.carryChain(ps, cnt);
    if (!read(ps, fin).eq(ans) || Object.values(fin).some((x) => x > 9)) { bad++; if (bad < 5) console.log('NG', p.text, fin); }
  }
  // ひき算は、説明の最後のフレームの「のこり」を答えと照らす
  if (op === '−') { const fr = p.explain(); const tx = fr[fr.findIndex((f) => /のこりの こ数を読むと/.test(f.text))].text; if (!tx.includes(`<b>${ans.toDec()}</b>`)) { bad++; if (bad < 5) console.log('NG sub', p.text); } }
}
console.log('concept checked', n, 'bad', bad);
