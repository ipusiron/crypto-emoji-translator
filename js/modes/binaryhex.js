/* Binary & Hex mode */
const BinaryHex = (()=>{
  const BIN0='◻️', BIN1='◼️'; // binary emoji for 0/1
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

  function binToEmoji(bin, chunk){
    // chunk is 8/4/none
    let out='';
    for(const ch of bin){
      out += (ch==='1')?BIN1:BIN0;
    }
    if(chunk==='none') return out;
    // insert thin spaces every chunk
    if(chunk==='8' || chunk==='4'){
      const size = parseInt(chunk,10);
      const groups=[];
      let i=0; let count=0; let cur='';
      for(const ch of out){
        cur += ch;
        // Each emoji is length 2+ code units; grouping by bits is tough.
        // Easier: group by original bin string and rebuild.
      }
      // rebuild clean by iterating bin again:
      out='';
      let buff='';
      for(let i=0;i<bin.length;i++){
        buff += (bin[i]==='1')?BIN1:BIN0;
        if((i+1)%size===0) { out+=buff+' '; buff=''; }
      }
      out+=buff;
      return out.trim();
    }
    return out;
  }
  function emojiToBin(emo){
    // map back to 0/1
    const clusters = Array.from(emo);
    let bin='';
    for(const g of clusters){
      if(g===BIN1) bin+='1';
      else if(g===BIN0) bin+='0';
    }
    return bin;
  }
  function hexToEmoji(hex, chunk){
    const clean = hex.replace(/[^0-9a-fA-F]/g,'').toLowerCase();
    let out='';
    for(const ch of clean){
      const idx = parseInt(ch,16);
      out += HEX[idx];
    }
    if(chunk==='none') return out;
    if(chunk==='2'){
      let o=''; for(let i=0;i<clean.length;i++){
        o += HEX[parseInt(clean[i],16)];
        if((i+1)%2===0) o+=' ';
      }
      return o.trim();
    }
    return out;
  }
  function emojiToHex(emo){
    const clusters = Array.from(emo).filter(x=>x.trim()!=='');
    let hex='';
    for(const g of clusters){
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
    encodeBinaryToEmoji, decodeBinaryFromEmoji,
    encodeHexToEmoji, decodeHexFromEmoji
  };
})();
