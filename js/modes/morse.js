/* ============================================
 * Morse mode
 * モールス符号モジュール
 * ============================================
 *
 * 符号表の典拠:
 *   欧文 — ITU-R M.1677-1 (10/2009) Annex 1 Part I
 *          1.1.1 Letters / 1.1.2 Figures / 1.1.3 Punctuation marks and miscellaneous signs
 *   和文 — 無線局運用規則（昭和二十五年電波監理委員会規則第十七号）第十二条 別表第一号
 *          ITU には和文の規定がないため、こちらが一次資料になる
 *
 * 間隔の規定（ITU 2.1〜2.4 と 別表第一号 注一。両者は完全に一致する）:
 *   長点は短点3つぶん／同じ文字のなかの間隔は短点1つぶん／
 *   文字と文字の間隔は短点3つぶん／語と語の間隔は短点7つぶん
 *   本ツールは時間ではなく記号で表すので、文字の区切りを ⏹、語の区切りを ⏸ で示す。
 *
 * 表に入れていないもの:
 *   - 乗算記号「×」… ITU 3.2.1 が「X を送る」と定めており、符号が X と同じ（-..-）になる
 *   - 業務記号（Understood・Error・Invitation to transmit・Wait・End of work・Starting signal）
 *     … 対応する文字がなく、いくつかは文字と符号が衝突する（-.- は K、.-... は和文のオ）
 *
 * **欧文と和文は31個の符号が衝突する**（`-` は欧文 T と和文ム、`.-` は A とイ、など）。
 * どちらの表で読むかを指定しないかぎり、符号列から元の文字は一意に決まらない。
 */
const Morse = (()=>{
  const SEP_CHAR='⏹'; // 文字の区切り（表示用）
  const SEP_WORD='⏸'; // 語の区切り（表示用）
  const EMO_DOT='⚫';  // 短点
  const EMO_DASH='⚪'; // 長点

  // ---- 欧文（ITU-R M.1677-1）
  const INTL_LETTERS = {
    A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.",
    G: "--.", H: "....", I: "..", J: ".---", K: "-.-", L: ".-..",
    M: "--", N: "-.", O: "---", P: ".--.", Q: "--.-", R: ".-.",
    S: "...", T: "-", U: "..-", V: "...-", W: ".--", X: "-..-",
    Y: "-.--", Z: "--..",
    "É": "..-..",  // 1.1.1 の accented e
  };
  const FIGURES = {
    "0":"-----","1":".----","2":"..---","3":"...--","4":"....-",
    "5":".....","6":"-....","7":"--...","8":"---..","9":"----."
  };
  const INTL_PUNCT = {
    ".": ".-.-.-",   // Full stop (period)
    ",": "--..--",   // Comma
    ":": "---...",   // Colon or division sign
    "?": "..--..",   // Question mark
    "'": ".----.",   // Apostrophe
    "-": "-....-",   // Hyphen or dash
    "/": "-..-.",    // Fraction bar or division sign
    "(": "-.--.",    // Left-hand bracket
    ")": "-.--.-",   // Right-hand bracket
    '"': ".-..-.",   // Inverted commas
    "=": "-...-",    // Double hyphen
    "+": ".-.-.",    // Cross or addition sign
    "@": ".--.-.",   // Commercial at
  };

  // ---- 和文（無線局運用規則 別表第一号）
  const WABUN_KANA = {
    "イ": ".-", "ロ": ".-.-", "ハ": "-...", "ニ": "-.-.", "ホ": "-..", "ヘ": ".",
    "ト": "..-..", "チ": "..-.", "リ": "--.", "ヌ": "....", "ル": "-.--.",
    "ヲ": ".---", "ワ": "-.-", "カ": ".-..", "ヨ": "--", "タ": "-.", "レ": "---",
    "ソ": "---.", "ツ": ".--.", "ネ": "--.-", "ナ": ".-.", "ラ": "...",
    "ム": "-", "ウ": "..-", "ヰ": ".-..-", "ノ": "..--", "オ": ".-...",
    "ク": "...-", "ヤ": ".--", "マ": "-..-", "ケ": "-.--", "フ": "--..",
    "コ": "----", "エ": "-.---", "テ": ".-.--", "ア": "--.--", "サ": "-.-.-",
    "キ": "-.-..", "ユ": "-..--", "メ": "-...-", "ミ": "..-.-", "シ": "--.-.",
    "ヱ": ".--..", "ヒ": "--..-", "モ": "-..-.", "セ": ".---.", "ス": "---.-",
    "ン": ".-.-.",
    "゙": "..",      // 濁点（結合文字）
    "゚": "..--.",   // 半濁点（結合文字）
  };
  const WABUN_PUNCT = {
    "ー": ".--.-",    // 長音
    "、": ".-.-.-",   // 区切点
    "」": ".-.-..",   // 段落
    "（": "-.--.-",   // 括弧
    "）": ".-..-.",   // 括弧
  };

  const TABLES = {
    international: { ...INTL_LETTERS, ...FIGURES, ...INTL_PUNCT },
    wabun: { ...WABUN_KANA, ...FIGURES, ...WABUN_PUNCT },
  };
  const VARIANTS = Object.keys(TABLES);

  // 符号 → 文字 の逆引き（表ごとに作る。同じ表のなかに衝突はない）
  const REVERSE = {};
  for(const [variant, table] of Object.entries(TABLES)){
    const rev = Object.create(null);
    for(const [ch, code] of Object.entries(table)) if(!(code in rev)) rev[code] = ch;
    REVERSE[variant] = rev;
  }

  /** 小書きの仮名は、和文モールスでは並の大きさで送る */
  const SMALL_KANA = {
    "ァ":"ア","ィ":"イ","ゥ":"ウ","ェ":"エ","ォ":"オ",
    "ャ":"ヤ","ュ":"ユ","ョ":"ヨ","ッ":"ツ","ヮ":"ワ","ヵ":"カ","ヶ":"ケ",
  };

  /**
   * 和文として送れる形にそろえる
   * ひらがなをカタカナに、濁音・半濁音を「仮名＋濁点」に分け、小書きを並の大きさにする
   * @param {string} text
   * @returns {string}
   */
  function normalizeWabun(text){
    // NFD で濁点・半濁点を結合文字に分ける（ガ → カ + U+3099）
    let out = '';
    for(const ch of text.normalize('NFD')){
      const cp = ch.codePointAt(0);
      // ひらがな → カタカナ
      let c = (cp >= 0x3041 && cp <= 0x3096) ? String.fromCodePoint(cp + 0x60) : ch;
      // 単独の濁点・半濁点（U+309B/U+309C）も結合文字に寄せる
      if(c === '゛') c = '゙';
      if(c === '゜') c = '゚';
      out += SMALL_KANA[c] || c;
    }
    return out;
  }

  function morseToEmoji(code){
    let out = '';
    for(const c of code) out += (c === '.') ? EMO_DOT : EMO_DASH;
    return out;
  }
  function emojiToMorse(emo){
    let out = '';
    for(const g of Graphemes.split(emo)){
      if(g === EMO_DOT) out += '.';
      else if(g === EMO_DASH) out += '-';
    }
    return out;
  }

  /**
   * テキストを符号の絵文字に変換する
   * @param {string} text
   * @param {string} [variant] - 'international'（既定）または 'wabun'
   * @returns {{emoji:string, dropped:string[], variant:string}}
   *   dropped は符号表になくて落とした文字。画面はこれを知らせる
   */
  function encode(text, variant){
    const v = VARIANTS.includes(variant) ? variant : 'international';
    const table = TABLES[v];
    const prepared = (v === 'wabun') ? normalizeWabun(text) : text.toUpperCase();
    const dropped = [];
    const parts = [];
    for(const word of prepared.split(/\s+/)){
      const letters = [];
      for(const ch of word){
        if(table[ch]) letters.push(morseToEmoji(table[ch]));
        else dropped.push(ch);
      }
      parts.push(letters.join(SEP_CHAR));
    }
    return { emoji: parts.filter((p, i, a) => p !== '' || a.length === 1).join(SEP_WORD), dropped, variant: v };
  }

  /**
   * 符号の絵文字をテキストに戻す
   * @param {string} emojiStr
   * @param {string} [variant]
   * @returns {{text:string, unknown:string[], variant:string}}
   *   unknown は表に無かった符号
   */
  function decode(emojiStr, variant){
    const v = VARIANTS.includes(variant) ? variant : 'international';
    const rev = REVERSE[v];
    const unknown = [];
    const outWords = [];
    for(const w of String(emojiStr).split(SEP_WORD)){
      let wordOut = '';
      for(const emo of w.split(SEP_CHAR)){
        const code = emojiToMorse(emo);
        if(code === '') continue;
        const ch = rev[code];
        if(ch === undefined){
          unknown.push(code);
          wordOut += '?';
        }else{
          wordOut += ch;
        }
      }
      outWords.push(wordOut);
    }
    // 和文は「仮名＋濁点」で戻るので、NFC でくっつける（カ + U+3099 → ガ）
    const text = outWords.join(' ');
    return { text: (v === 'wabun') ? text.normalize('NFC') : text, unknown, variant: v };
  }

  /** 欧文と和文で同じ符号になっている組（モードを指定しないと決まらないことの証拠） */
  function collisions(){
    const out = [];
    for(const [code, ch] of Object.entries(REVERSE.international)){
      const other = REVERSE.wabun[code];
      if(other !== undefined) out.push({ code, international: ch, wabun: other });
    }
    return out.sort((a, b) => a.code.length - b.code.length || a.code.localeCompare(b.code));
  }

  // ---- 旧来の呼び出し方（文字列を返す）
  function encodeToEmoji(text, variant){ return encode(text, variant).emoji; }
  function decodeFromEmoji(emojiStr, variant){ return decode(emojiStr, variant).text; }

  return {
    MAP: TABLES.international,  // 互換のため（対応表タブが参照する）
    TABLES, REVERSE, VARIANTS,
    SEP_CHAR, SEP_WORD, EMO_DOT, EMO_DASH,
    encode, decode, collisions, normalizeWabun,
    encodeToEmoji, decodeFromEmoji, morseToEmoji,
  };
})();

globalThis.Morse = Morse;
