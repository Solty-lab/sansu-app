// 練習帳の声を このスプレッドシートに集める (Google Apps Script ウェブアプリ)
// アプリ (娘さんのページ・保護者ページ) が 押された声とメモを POST で送ってくる。
// 1行 = 1件。同じ id は2回書かない。Claude はこのシートを読んで対応し、「対応」列に書く。
const SHEET = '声';
const HEAD = ['受信', '押した日時', 'ページ', '種類', '答え', 'ことば', '場所・問題', 'id', '端末', '対応'];
function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET);
  if (!sh) { sh = ss.insertSheet(SHEET); sh.appendRow(HEAD); sh.setFrozenRows(1); }
  return sh;
}
function doPost(e) {
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const d = JSON.parse(e.postData.contents);
    if (!d || d.app !== 'keisan-tani' || !Array.isArray(d.items)) return out_({ ok: false });
    const sh = sheet_();
    const n = sh.getLastRow();
    const seen = new Set(n > 1 ? sh.getRange(2, 8, n - 1, 1).getValues().map((r) => String(r[0])) : []);
    const cut = (s, k) => String(s == null ? '' : s).slice(0, k);
    const rows = [];
    d.items.slice(0, 50).forEach((it) => {
      const id = cut(it.id, 80); if (!id || seen.has(id)) return; seen.add(id);
      rows.push([new Date(), it.at ? new Date(it.at) : '', cut(it.page, 20), cut(it.kind, 20), cut(it.verdict, 20), cut(it.text, 1000), cut(it.where, 1500), id, cut(d.device, 40), '']);
    });
    if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, HEAD.length).setValues(rows);
    return out_({ ok: true, added: rows.length, ids: d.items.map((it) => it.id) });
  } catch (err) { return out_({ ok: false }); } finally { lock.releaseLock(); }
}
function doGet() { return out_({ ok: true, app: 'keisan-tani' }); }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
