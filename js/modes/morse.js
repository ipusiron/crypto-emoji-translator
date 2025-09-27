/* Morse mode */
const Morse = (()=>{
  const DOT='•'; // internal
  const DASH='–';
  const SEP_CHAR='⏹'; // letter separator (display)
  const SEP_WORD='⏸'; // word separator (display)
  const EMO_DOT='⚫';
  const EMO_DASH='⚪';

  const MAP = {
    A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.",
    G: "--.", H: "....", I: "..", J: ".---", K: "-.-", L: ".-..",
    M: "--", N: "-.", O: "---", P: ".--.", Q: "--.-", R: ".-.",
    S: "...", T: "-", U: "..-", V: "...-", W: ".--", X: "-..-",
    Y: "-.--", Z: "--..",
    "0":"-----","1":".----","2":"..---","3":"...--","4":"....-",
    "5":".....","6":"-....","7":"--...","8":"---..","9":"----."
  };

  function morseToEmoji(code){
    return code.replace(/\./g, EMO_DOT).replace(/-/g, EMO_DASH);
  }
  function emojiToMorse(emo){
    return emo.replace(new RegExp(EMO_DOT,'g'),'.').replace(new RegExp(EMO_DASH,'g'),'-');
  }

  function encodeToEmoji(text){
    const up = text.toUpperCase();
    const parts = [];
    for(const word of up.split(/\s+/)){
      const letters = [];
      for(const ch of word){
        if(MAP[ch]){
          letters.push(morseToEmoji(MAP[ch]));
        }else{
          // ignore unknown, could push ch directly if keep option desired
          // For simplicity, skip
        }
      }
      parts.push(letters.join(SEP_CHAR));
    }
    return parts.join(SEP_WORD);
  }

  function decodeFromEmoji(emojiStr){
    const words = emojiStr.split(SEP_WORD);
    const outWords = [];
    for(const w of words){
      const letters = w.split(SEP_CHAR);
      let wordOut='';
      for(const emo of letters){
        const m = emojiToMorse(emo);
        const ch = Object.keys(MAP).find(k=>MAP[k]===m);
        wordOut += ch || '?';
      }
      outWords.push(wordOut);
    }
    return outWords.join(' ');
  }

  return {MAP, encodeToEmoji, decodeFromEmoji, morseToEmoji};
})();
