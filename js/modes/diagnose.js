/* ============================================
 * Diagnose - 置換表に使う絵文字を点検する
 * globalThis.Diagnose に置く（DOMを使わない）
 * ============================================
 *
 * カスタムマップを作れるツールなので、**置換表の設計そのものを教材にできる**。
 * 選んだ26個について、復号で壊れるもの・読み違えやすいものを指摘する。
 *
 * ここで測れるのはコードポイントから分かることだけで、
 * 「見た目が似ているか」は環境ごとの字形に左右されるため測っていない
 * （UTS #51 が「The shape of the character can vary significantly」と認めている）。
 * 実際の見た目の比較は、画面側が canvas で描いて行う。
 */
const Diagnose = (()=>{

  const SKIN_TONE = { from: 0x1F3FB, to: 0x1F3FF };
  const ZWJ = 0x200D;

  /** 絵文字1つを調べる */
  function inspectOne(emoji){
    const s = String(emoji ?? '');
    const cps = [...s].map((c) => c.codePointAt(0));
    const graphemes = Graphemes.split(s).length;
    const hasVariationSelector = cps.some((cp) => cp === 0xFE0E || cp === 0xFE0F);
    const hasZwj = cps.includes(ZWJ);
    const hasSkinTone = cps.some((cp) => cp >= SKIN_TONE.from && cp <= SKIN_TONE.to);
    const needsSelector = s !== '' && !/\p{Emoji_Presentation}/u.test(s[0] ? [...s][0] : '');
    return {
      emoji: s,
      codepoints: cps.map((cp) => 'U+' + cp.toString(16).toUpperCase().padStart(4, '0')),
      graphemes,
      hasVariationSelector,
      hasZwj,
      hasSkinTone,
      needsSelector,
    };
  }

  /**
   * 置換表を点検する
   * @param {Object<string,string>} map - A–Z → 絵文字
   * @returns {{issues:Array, ok:boolean, checked:number}}
   *   issues は [{level, kind, letters, detail}]。level は 'error' か 'warn'
   */
  function check(map){
    const entries = Object.entries(map || {}).filter(([, e]) => e);
    const issues = [];

    // ---- 復号が壊れるもの
    const multi = entries.filter(([, e]) => Graphemes.split(e).length !== 1);
    if(multi.length){
      issues.push({
        level: 'error', kind: 'notSingleGrapheme',
        letters: multi.map(([L]) => L),
        detail: multi.map(([L, e]) => `${L}=${e}`).join(' '),
      });
    }

    const zwj = entries.filter(([, e]) => [...e].some((c) => c.codePointAt(0) === ZWJ));
    if(zwj.length){
      issues.push({
        level: 'error', kind: 'zwj',
        letters: zwj.map(([L]) => L),
        detail: zwj.map(([L, e]) => `${L}=${e}`).join(' '),
      });
    }

    // 同じ絵文字が2つ以上の文字に割り当てられている
    const byEmoji = new Map();
    for(const [L, e] of entries){
      const bare = Graphemes.stripVariationSelectors(e);
      (byEmoji.get(bare) || byEmoji.set(bare, []).get(bare)).push(L);
    }
    const dup = [...byEmoji.entries()].filter(([, ls]) => ls.length > 1);
    if(dup.length){
      issues.push({
        level: 'error', kind: 'duplicate',
        letters: dup.flatMap(([, ls]) => ls),
        detail: dup.map(([e, ls]) => `${e}→${ls.join(',')}`).join(' '),
      });
    }

    // ---- 気をつけたほうがよいもの
    const needSel = entries.filter(([, e]) => inspectOne(e).needsSelector);
    if(needSel.length){
      issues.push({
        level: 'warn', kind: 'needsSelector',
        letters: needSel.map(([L]) => L),
        detail: needSel.map(([L, e]) => `${L}=${e}`).join(' '),
      });
    }

    const skin = entries.filter(([, e]) => inspectOne(e).hasSkinTone);
    if(skin.length){
      issues.push({
        level: 'warn', kind: 'skinTone',
        letters: skin.map(([L]) => L),
        detail: skin.map(([L, e]) => `${L}=${e}`).join(' '),
      });
    }

    // コードポイントが隣り合う組（色違いの系列であることが多く、色でしか見分けられない）
    const sorted = entries
      .map(([L, e]) => ({ L, e, cp: e.codePointAt(0) }))
      .sort((a, b) => a.cp - b.cp);
    const runs = [];
    let run = [sorted[0]].filter(Boolean);
    for(let i = 1; i < sorted.length; i++){
      if(sorted[i].cp === sorted[i - 1].cp + 1) run.push(sorted[i]);
      else { if(run.length >= 3) runs.push(run); run = [sorted[i]]; }
    }
    if(run.length >= 3) runs.push(run);
    if(runs.length){
      issues.push({
        level: 'warn', kind: 'adjacentRun',
        letters: runs.flatMap((r) => r.map((x) => x.L)),
        detail: runs.map((r) => r.map((x) => x.e).join('')).join(' / '),
      });
    }

    // 文字が26個そろっているか
    const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const missing = LETTERS.filter((L) => !map || !map[L]);
    if(missing.length){
      issues.push({ level: 'error', kind: 'missing', letters: missing, detail: missing.join(' ') });
    }

    return {
      issues,
      ok: issues.every((i) => i.level !== 'error'),
      checked: entries.length,
    };
  }

  return { inspectOne, check, SKIN_TONE, ZWJ };
})();

globalThis.Diagnose = Diagnose;
