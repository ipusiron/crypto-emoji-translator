/* ============================================
 * Graphemes - 文字列を「人が1文字と感じる単位」で分ける
 * globalThis.Graphemes に置く（DOMを使わないので、テストから直接呼べる）
 * ============================================
 *
 * なぜ必要か:
 *   Array.from(s) や [...s] はコードポイント単位で分ける。
 *   MDN は String.prototype[Symbol.iterator]() について
 *   「grapheme clusters will be split, but surrogate pairs will be preserved」と明記している。
 *   そのため ◻️（U+25FB U+FE0F）や ☀️（U+2600 U+FE0F）のような
 *   異体字セレクターつきの絵文字は2つに割れ、置換表の逆引きが外れる。
 *
 *   Intl.Segmenter は UAX #29 の拡張書記素クラスターで分けるので、
 *   異体字セレクターもゼロ幅接合子（ZWJ）も直前の文字にまとまる。
 *   Firefox が対応したのは 125（2024-04-16）なので、無い環境では自前で寄せる。
 */
(() => {
  'use strict';

  const segmenter = (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function')
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

  const VARIATION_SELECTORS = /[︎️]/g;
  const ZWJ = 0x200d;
  const SKIN_TONE_FIRST = 0x1f3fb;
  const SKIN_TONE_LAST = 0x1f3ff;
  const TAG_FIRST = 0xe0020;
  const TAG_LAST = 0xe007f;

  /** 直前の文字にくっつく性質のコードポイントか */
  function isExtending(cp) {
    if (cp === 0xfe0e || cp === 0xfe0f || cp === ZWJ) return true;
    if (cp >= SKIN_TONE_FIRST && cp <= SKIN_TONE_LAST) return true;
    if (cp >= TAG_FIRST && cp <= TAG_LAST) return true;
    // 結合文字（濁点など）
    return /\p{M}/u.test(String.fromCodePoint(cp));
  }

  /** Intl.Segmenter が無い環境のための簡易版（絵文字に必要な範囲だけ） */
  function fallbackSplit(s) {
    const out = [];
    let joinNext = false;
    for (const ch of s) {
      const cp = ch.codePointAt(0);
      if (out.length && (joinNext || isExtending(cp))) {
        out[out.length - 1] += ch;
      } else {
        out.push(ch);
      }
      joinNext = cp === ZWJ;
    }
    return out;
  }

  /**
   * 文字列を1文字ずつに分ける
   * @param {string} s
   * @returns {string[]}
   */
  function split(s) {
    if (s === null || s === undefined || s === '') return [];
    const str = String(s);
    if (segmenter) return [...segmenter.segment(str)].map((x) => x.segment);
    return fallbackSplit(str);
  }

  /** 表示の指定だけを担う異体字セレクターを外す（U+FE0E / U+FE0F） */
  function stripVariationSelectors(s) {
    return String(s).replace(VARIATION_SELECTORS, '');
  }

  /**
   * A–Z → 絵文字 の対応表から、絵文字 → A–Z の逆引きを作る
   * 異体字セレクターの有無が違っても引けるように、両方の形をキーにする
   * @param {Object<string,string>} map
   * @returns {Object<string,string>}
   */
  function buildInverse(map) {
    const inv = Object.create(null);
    for (const [letter, emoji] of Object.entries(map)) {
      if (!emoji) continue;
      inv[emoji] = letter;
      const bare = stripVariationSelectors(emoji);
      if (bare && !(bare in inv)) inv[bare] = letter;
    }
    return inv;
  }

  /** 逆引き表から1文字分を引く（異体字セレクターの有無を問わない） */
  function lookup(inv, grapheme) {
    if (grapheme in inv) return inv[grapheme];
    const bare = stripVariationSelectors(grapheme);
    return bare in inv ? inv[bare] : undefined;
  }

  globalThis.Graphemes = {
    split,
    stripVariationSelectors,
    buildInverse,
    lookup,
    hasSegmenter: !!segmenter,
  };
})();
