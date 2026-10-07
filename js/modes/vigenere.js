/* Vigenere mode */
const Vigenere = {
  encodeToEmoji(text, key, map){
    if(!key) return text;
    let out=''; let ki=0;
    for(const ch of text){
      if(/[A-Z]/.test(ch)){
        const t = ch.charCodeAt(0)-65;
        const k = key[ki % key.length].charCodeAt(0)-65;
        const e = (t + k) % 26;
        const letter = String.fromCharCode(65+e);
        out += map[letter];
        ki++;
      }else{
        out += ch;
      }
    }
    return out;
  },
  decodeFromEmoji(emojiStr, key, map){
    if(!key) return emojiStr;
    // 異体字セレクターつきの絵文字が割れないよう、分割と逆引きは Graphemes に任せる
    const inv = Graphemes.buildInverse(map);
    const clusters = Graphemes.split(emojiStr);
    let out=''; let ki=0;
    for(const g of clusters){
      const letter = Graphemes.lookup(inv, g);
      if(letter){
        const c = letter.charCodeAt(0)-65;
        const k = key[ki % key.length].charCodeAt(0)-65;
        const d = (c - k + 26) % 26;
        out += String.fromCharCode(65+d);
        ki++;
      }else{
        out += g;
      }
    }
    return out;
  }
};

globalThis.Vigenere = Vigenere;
