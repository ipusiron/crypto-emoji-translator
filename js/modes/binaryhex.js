/* ============================================
 * Binary & Hex mode
 * バイナリ・16進数モジュール
 * ============================================
 *
 * 入力を UTF-8 のバイト列にして、2進数または16進数の各桁を絵文字に置き換える。
 *
 * 0/1 に使う絵文字について:
 *   もとは ◻️ ◼️（U+25FB / U+25FC ＋ U+FE0F）を使っていたが、この2つは
 *   Unicode の Emoji_Presentation プロパティが No で、絵文字として表示させるには
 *   異体字セレクター U+FE0F が要る＝2コードポイントになる。
 *   そのためコードポイント単位で分けると割れ、復号が常に空文字になっていた。
 *   ⬜ ⬛（U+2B1C / U+2B1B）は Emoji_Presentation が Yes で、
 *   セレクターなしの1コードポイントで絵文字として表示される（UTS #51、emoji-data.txt）。
 */
const BinaryHex = (()=>{
  const BIN0='⬜', BIN1='⬛'; // U+2B1C / U+2B1B。どちらも異体字セレクター不要
  const HEX = ['⓿','➊','➋','➌','➍','➎','➏','➐','➑','➒','🅐','🅑','🅒','🅓','🅔','🅕']; // 0..F visibly distinct

  function bytesToBinary(bytes){
    return Array.from(bytes).map(b=>b.toString(2).padStart(8,'0')).join('');
  }
  function binaryToBytes(bin){
    const clean = bin.replace(/[^01]/g,'');
    const arr = [];
    for(let i=0;i+7<clean.length;i+=8){
      arr.push(parseInt(clean.slice(i,i+8),2));
    }
    return new Uint8Array(arr);
  }
  function bytesToHex(bytes){
    return Array.from(bytes).map(b=>b.toString(16).padStart(2,'0')).join('');
  }
  function hexToBytes(hex){
    const clean = hex.replace(/[^0-9a-fA-F]/g,'').toLowerCase();
    const arr=[];
    for(let i=0;i+1<clean.length;i+=2){
      arr.push(parseInt(clean.slice(i,i+2),16));
    }
    return new Uint8Array(arr);
  }

  /**
   * 2進数の文字列を絵文字に置き換える
   * @param {string} bin - '0' と '1' だけの文字列
   * @param {string} chunk - '8' / '4' / 'none'（区切りの桁数）
   */
  function binToEmoji(bin, chunk){
    const size = (chunk==='8'||chunk==='4') ? parseInt(chunk,10) : 0;
    let out='';
    for(let i=0;i<bin.length;i++){
      out += (bin[i]==='1')?BIN1:BIN0;
      if(size && (i+1)%size===0 && i+1<bin.length) out += ' ';
    }
    return out;
  }

  /** 絵文字を 0/1 に戻す（知らない文字は読み飛ばす） */
  function emojiToBin(emo){
    let bin='';
    for(const g of Graphemes.split(emo)){
      const bare = Graphemes.stripVariationSelectors(g);
      if(g===BIN1 || bare===BIN1) bin+='1';
      else if(g===BIN0 || bare===BIN0) bin+='0';
    }
    return bin;
  }

  function hexToEmoji(hex, chunk){
    const clean = hex.replace(/[^0-9a-fA-F]/g,'').toLowerCase();
    const size = (chunk==='2') ? 2 : 0;
    let out='';
    for(let i=0;i<clean.length;i++){
      out += HEX[parseInt(clean[i],16)];
      if(size && (i+1)%size===0 && i+1<clean.length) out += ' ';
    }
    return out;
  }

  function emojiToHex(emo){
    let hex='';
    for(const g of Graphemes.split(emo)){
      if(!g.trim()) continue;
      const idx = HEX.indexOf(g);
      if(idx>=0) hex += idx.toString(16);
    }
    return hex;
  }

  function encodeBinaryToEmoji(text, chunk){
    const bytes = new TextEncoder().encode(text);
    const bin = bytesToBinary(bytes);
    return binToEmoji(bin, chunk);
  }
  function decodeBinaryFromEmoji(emojiStr){
    const bin = emojiToBin(emojiStr);
    const bytes = binaryToBytes(bin);
    try{
      return new TextDecoder().decode(bytes);
    }catch(e){
      return '[Decode Error]';
    }
  }
  function encodeHexToEmoji(text, chunk){
    const bytes = new TextEncoder().encode(text);
    const hex = bytesToHex(bytes);
    return hexToEmoji(hex, chunk);
  }
  function decodeHexFromEmoji(emojiStr){
    const hex = emojiToHex(emojiStr);
    const bytes = hexToBytes(hex);
    try{
      return new TextDecoder().decode(bytes);
    }catch(e){
      return '[Decode Error]';
    }
  }

  return {
    BIN0, BIN1, HEX,
    encodeBinaryToEmoji, decodeBinaryFromEmoji,
    encodeHexToEmoji, decodeHexFromEmoji
  };
})();

globalThis.BinaryHex = BinaryHex;
