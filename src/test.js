const L = require('./logic.js');
let seed = 1; L.setRnd(() => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; });
const gridNum = (row) => { let s = ''; for (const c of row.cells) { if (/\d/.test(c.c) && !c.strike) { s += c.c; if (c.dot) s += '.'; } } s = s.replace(/\.$/, ''); return s; };
let fails = 0, count = 0;
const jobs = [];
for (const st of Object.keys(L.STAGES)) {
  const S = L.STAGES[st];
  if (S.levels) for (const lv of Object.keys(S.levels)) for (const t of S.levels[lv].types) jobs.push([t, +lv]);
  else for (const t of new Set(S.types)) jobs.push([t, undefined]);
}
for (const [t, lv] of jobs) {
  for (let i = 0; i < 400; i++) {
    let p;
    try { p = L.makeProblem(t, lv); const fr = p.explain(); count++;
      if (!fr.length) throw new Error('no frames');
      if (fr.some((f) => !f.text)) throw new Error('empty frame text');
      if (fr.some((f) => !f.fig && !f.grid)) throw new Error('frame without figure');
      fr.forEach((f) => { if (f.fig && (f.fig.match(/<svg/g) || []).length !== (f.fig.match(/<\/svg>/g) || []).length) throw new Error('svg tags'); if (/NaN|undefined|Infinity/.test(f.fig || '')) throw new Error('bad number in fig: ' + (f.fig.match(/.{30}(NaN|undefined|Infinity).{10}/) || [''])[0]); });
      const v = p.slots[0] && p.slots[0].value;
      if (['int_add','int_sub','dec_add','dec_sub','int_mul','dec_mul','int_div','dec_div'].includes(t)) {
        const last = fr[fr.length - 1].grid;
        if (!last) throw new Error('last frame has no grid');
        const isDiv = t.endsWith('_div'), isAS = /_(add|sub)$/.test(t);
        const row = isDiv ? last[0] : isAS ? last[3] : last[last.length - 1];
        const g = gridNum(row);
        if (!L.Fr.dec(g).eq(v)) { fails++; if (fails < 15) console.log('MISMATCH', t, lv, p.text, 'slot', v, 'grid', g); }
        const lastRow = last[last.length - 1];
        if (isDiv && gridNum(lastRow) !== '0') { fails++; if (fails < 15) console.log('REM', p.text, gridNum(lastRow)); }
      }
      for (const s of p.slots) { if (s.value.n < 0) throw new Error('neg'); if (L.judgeSlot(s.value.isInt() ? String(s.value.n) : (s.value.terminating() ? s.value.toDec() : s.value.n + '/' + s.value.d), s) !== 'ok') throw new Error('selfjudge ' + p.text); }
      if (p.choices && !p.choices.find((c) => c.id === p.answerChoice)) throw new Error('choice');
      if (lv && p.level !== lv) throw new Error('level not set');
    } catch (e) { fails++; if (fails < 15) console.log('ERR', t, lv, p && p.text, e.message); }
  }
}
console.log('checked', count, 'fails', fails);
seed = 7;
for (const [t, lv] of jobs) { const p = L.makeProblem(t, lv); console.log((t + (lv ? ' L' + lv : '')).padEnd(12), '|', p.text, '| ans:', p.answerText); }
// 読みもの
for (const [id, Ls] of Object.entries(L.LESSONS)) { const fs = Ls.frames(); if (!fs.length || fs.some((f) => !f.fig || !f.text || /NaN|undefined/.test(f.fig))) console.log('LESSON NG', id); else console.log('lesson', id, fs.length, 'frames ok'); }
