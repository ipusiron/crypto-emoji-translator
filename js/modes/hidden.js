/* ============================================
 * Hidden channel - 見えない文字を見つける
 * globalThis.HiddenChannel に置く（DOMを使わない）
 * ============================================
 *
 * 絵文字は「見た目どおりではない」。
 * 文字列には、画面に何も描かないのに情報を運べる文字がある。
 *
 * 見る対象:
 *   - 異体字セレクター U+FE00〜U+FE0F … 直前の文字の見た目を指定する。
 *     **U+FE0F は絵文字として表示させるための正しい使い方**でもあるので、
 *     見つけたからといってすぐ怪しいとは言えない（このツール自身がこれで躓いた）
 *   - 異体字セレクター補助 U+E0100〜U+E01EF … 漢字の字形の指定に使う240個。
 *     絵文字のあとに並んでいたら、ふつうの文章では説明がつかない
 *   - ゼロ幅文字 U+200B（幅なし空白）・U+200C（接合しない）・U+200D（接合する）・
 *     U+2060（語の接合）・U+FEFF（バイト順の印）
 *   - タグ文字 U+E0020〜U+E007F … もとは言語タグ。いまは地域の旗の指定に使う
 *
 * ペイロードの取り出し:
 *   2025年に広まった方式（Paul Butler, "Smuggling arbitrary data through an emoji"）は、
 *   バイト 0〜15 を U+FE00〜U+FE0F に、16〜255 を U+E0100〜U+E01EF に載せる。
 *   256個そろうので、任意のバイト列を1文字の絵文字の後ろに隠せる。
 *   **仕込む側のツールは出回っているが、見つける側は調べた範囲で見当たらなかった。**
 */
const HiddenChannel = (()=>{

  const KINDS = {
    variationSelector: { from: 0xFE00, to: 0xFE0F },
    variationSupplement: { from: 0xE0100, to: 0xE01EF },
    tag: { from: 0xE0020, to: 0xE007F },
  };
  const ZERO_WIDTH = new Set([0x200B, 0x200C, 0x200D, 0x2060, 0xFEFF]);

  /** コードポイントの種類を見分ける */
  function kindOf(cp){
    if(cp >= KINDS.variationSelector.from && cp <= KINDS.variationSelector.to) return 'variationSelector';
    if(cp >= KINDS.variationSupplement.from && cp <= KINDS.variationSupplement.to) return 'variationSupplement';
    if(cp >= KINDS.tag.from && cp <= KINDS.tag.to) return 'tag';
    if(ZERO_WIDTH.has(cp)) return 'zeroWidth';
    return null;
  }

  /**
   * 見えない文字を探す
   * @param {string} text
   * @returns {{found:Array, cleaned:string, counts:Object, total:number}}
   *   found は [{index, cp, kind, hex}]、cleaned は取り除いたあとの文字列
   */
  function scan(text){
    const s = String(text ?? '');
    const found = [];
    const counts = { variationSelector: 0, variationSupplement: 0, tag: 0, zeroWidth: 0 };
    let cleaned = '';
    let index = 0;
    for(const ch of s){
      const cp = ch.codePointAt(0);
      const kind = kindOf(cp);
      if(kind){
        counts[kind] += 1;
        found.push({ index, cp, kind, hex: 'U+' + cp.toString(16).toUpperCase().padStart(4, '0') });
      }else{
        cleaned += ch;
      }
      index += 1;
    }
    return { found, cleaned, counts, total: found.length };
  }

  /** バイト値 → 異体字セレクターのコードポイント（Paul Butler 方式） */
  function byteToSelector(b){
    return b < 16 ? KINDS.variationSelector.from + b : KINDS.variationSupplement.from + (b - 16);
  }

  /** 異体字セレクターのコードポイント → バイト値（範囲外は null） */
  function selectorToByte(cp){
    if(cp >= KINDS.variationSelector.from && cp <= KINDS.variationSelector.to){
      return cp - KINDS.variationSelector.from;
    }
    if(cp >= KINDS.variationSupplement.from && cp <= KINDS.variationSupplement.to){
      return cp - KINDS.variationSupplement.from + 16;
    }
    return null;
  }

  /**
   * 仕込まれたバイト列を取り出して読む
   * @param {string} text
   * @returns {{bytes:number[], text:string, valid:boolean, usedPresentationSelector:boolean}}
   *
   * **U+FE0F はバイト15でもあり、絵文字を絵文字として表示させる指定でもある。**
   * その曖昧さがあることを usedPresentationSelector で知らせる
   */
  function extractPayload(text){
    const bytes = [];
    let usedPresentationSelector = false;
    for(const ch of String(text ?? '')){
      const cp = ch.codePointAt(0);
      const b = selectorToByte(cp);
      if(b === null) continue;
      if(cp === 0xFE0E || cp === 0xFE0F) usedPresentationSelector = true;
      bytes.push(b);
    }
    let out = '';
    let valid = true;
    try{
      out = new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes));
    }catch(e){
      valid = false;
      out = new TextDecoder('utf-8').decode(new Uint8Array(bytes));
    }
    return { bytes, text: out, valid, usedPresentationSelector };
  }

  /**
   * 文字列を1文字の後ろに仕込む（検出できることを示すために作る）
   * @param {string} carrier - 表に見せる文字（絵文字1つなど）
   * @param {string} secret
   * @returns {string}
   */
  function embed(carrier, secret){
    const bytes = new TextEncoder().encode(String(secret ?? ''));
    let out = String(carrier ?? '');
    for(const b of bytes) out += String.fromCodePoint(byteToSelector(b));
    return out;
  }

  /** 見えない文字を取り除く */
  function strip(text){
    return scan(text).cleaned;
  }

  return { KINDS, ZERO_WIDTH, kindOf, scan, byteToSelector, selectorToByte, extractPayload, embed, strip };
})();

globalThis.HiddenChannel = HiddenChannel;
