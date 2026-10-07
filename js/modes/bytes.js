/* ============================================
 * Byte mode (Base100)
 * バイト単位モード
 * ============================================
 *
 * UTF-8 のバイト1つを絵文字1つに置き換える。256個の絵文字を使うので、
 * **日本語でも数字でも記号でも、どんな入力でも通る**。
 * A–Z しか扱えないシーザー暗号やヴィジュネル暗号との違いを見せるためのモード。
 *
 * 絵文字の割り当ては Base100 と同じで、バイト値 n に U+1F3F7 + n を当てる
 * （dCode の Base100 と行き来できる）。
 *
 * 注意している点:
 *   この256個のうち **3つ（U+1F3F7 🏷・U+1F43F 🐿・U+1F441 👁）は Emoji_Presentation が No** で、
 *   絵文字として表示させるには異体字セレクター U+FE0F が要る。
 *   出力は Base100 の定義どおり**セレクターを付けない1コードポイント**にし、
 *   読むときは Graphemes.lookup でセレクターの有無を問わず受け付ける。
 *   こうしておくと、ほかのツールが付けてきても読める。
 *
 *   U+1F441 👁 は 👁️‍🗨️（ZWJ でつないだ絵文字）の先頭でもある。
 *   その形で貼られると1つのグラフェムになり、この表では引けない（知らない文字として数える）。
 */
const ByteCode = (()=>{
  const BASE = 0x1F3F7; // Base100 の先頭。バイト 0x00 がこれ

  /** バイト値 → 絵文字 */
  const ALPHABET = Array.from({ length: 256 }, (_, i) => String.fromCodePoint(BASE + i));

  /** 絵文字 → バイト値（異体字セレクターを外した形でも引けるようにする） */
  const REVERSE = (() => {
    const map = Object.create(null);
    ALPHABET.forEach((e, i) => { map[e] = i; });
    return map;
  })();

  /**
   * テキストを絵文字の列にする
   * @param {string} text
   * @param {string} [chunk] - 'none'（既定）または '4' / '8'（何バイトごとに空白を入れるか）
   * @returns {{emoji:string, bytes:number}}
   */
  function encode(text, chunk){
    const bytes = new TextEncoder().encode(String(text ?? ''));
    const size = (chunk === '4' || chunk === '8') ? parseInt(chunk, 10) : 0;
    let out = '';
    for(let i = 0; i < bytes.length; i++){
      out += ALPHABET[bytes[i]];
      if(size && (i + 1) % size === 0 && i + 1 < bytes.length) out += ' ';
    }
    return { emoji: out, bytes: bytes.length };
  }

  /**
   * 絵文字の列をテキストに戻す
   * @param {string} emojiStr
   * @returns {{text:string, bytes:number, unknown:string[], valid:boolean}}
   *   unknown は表に無かった文字。valid はバイト列が UTF-8 として読めたか
   */
  function decode(emojiStr){
    const arr = [];
    const unknown = [];
    for(const g of Graphemes.split(emojiStr)){
      if(!g.trim()) continue;
      const b = Graphemes.lookup(REVERSE, g);
      if(b === undefined) unknown.push(g);
      else arr.push(b);
    }
    const bytes = new Uint8Array(arr);
    let text = '';
    let valid = true;
    try{
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    }catch(e){
      // UTF-8 として読めないバイト列でも、読める範囲は見せる
      valid = false;
      text = new TextDecoder('utf-8').decode(bytes);
    }
    return { text, bytes: bytes.length, unknown, valid };
  }

  /** この表のうち、異体字セレクターが無いと絵文字として表示されないもの */
  function needsVariationSelector(){
    const re = /\p{Emoji_Presentation}/u;
    const out = [];
    ALPHABET.forEach((e, i) => { if(!re.test(e)) out.push({ byte: i, emoji: e }); });
    return out;
  }

  return { BASE, ALPHABET, REVERSE, encode, decode, needsVariationSelector };
})();

globalThis.ByteCode = ByteCode;
