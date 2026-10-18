const L = require('./logic.js');
let bad = 0, n = 0;
const jobs = [];
for (const st of ['A1', 'A2']) for (const lv of [1, 2, 3, 4, 5]) for (const t of L.levelTypes(st, lv)) jobs.push([t, lv]);
for (const t of ['fr_add', 'fr_sub', 'fr_mul', 'fr_div', 'mix_calc']) jobs.push([t]);
for (const [t, lv] of jobs) for (let i = 0; i < 500; i++) {
  const p = L.makeProblem(t, lv);
  const e = p.text.replace(/(\d+)と(\d+)\/(\d+)/g, '($1+$2/$3)').replace(/(?<![\d.])(\d+)\/(\d+)/g, '($1/$2)').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/,/g, '');
  const v = eval(e); n++;
  if (Math.abs(v - p.slots[0].value.val()) > 1e-9) { bad++; if (bad < 10) console.log(t, lv, p.text, e, v, p.answerText); }
}
console.log('text-eval checked', n, 'bad', bad);
