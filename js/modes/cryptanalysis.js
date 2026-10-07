/* ============================================
 * Cryptanalysis - 絵文字の暗号文を手で解く
 * globalThis.Cryptanalysis に置く（DOMを使わない）
 * ============================================
 *
 * 座学タブは「絵文字にしても頻度分布は残る」と説いている。
 * このモジュールは、それを読み手が自分の手で確かめるためのもの。
 *
 * 既存の換字解読ツール（dCode・Boxentriq・Rumkin・cryptii）は
 * 暗号文がA–Zであることを前提にしており、絵文字を貼っても受け付けない
 * （Boxentriq の Substitution Cipher に貼ると出力欄が空のままになることを実機で確認した）。
 *
 * 置いてあるもの:
 *   - 絵文字の出現頻度（多い順）
 *   - 英語・日本語ローマ字の文字頻度との突き合わせによる割り当ての下書き
 *   - クリブ（分かっている語）を当てはめたときに決まる対応
 *   - いまの割り当てで平文がどこまで見えるか
 */
const Cryptanalysis = (()=>{

  /**
   * 英語の文字頻度（%）
   * 出典: Robert Lewand, "Cryptological Mathematics" (2000) の表。
   * 暗号の教科書で広く引かれている値で、解読の出発点に使う
   */
  const ENGLISH_FREQ = {
    E: 12.702, T: 9.056, A: 8.167, O: 7.507, I: 6.966, N: 6.749, S: 6.327,
    H: 6.094, R: 5.987, D: 4.253, L: 4.025, C: 2.782, U: 2.758, M: 2.406,
    W: 2.360, F: 2.228, G: 2.015, Y: 1.974, P: 1.929, B: 1.492, V: 0.978,
    K: 0.772, J: 0.153, X: 0.150, Q: 0.095, Z: 0.074,
  };

  /** 英語でよく続く2文字（割り当ての確からしさを見るのに使う） */
  const ENGLISH_BIGRAMS = ['TH', 'HE', 'IN', 'ER', 'AN', 'RE', 'ND', 'ON', 'EN', 'AT',
    'OU', 'ED', 'HA', 'TO', 'OR', 'IT', 'IS', 'HI', 'ES', 'NG'];

  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  /**
   * 暗号文を1文字ずつに分けて、出現頻度を数える
   * @param {string} cipher - 絵文字の暗号文
   * @returns {{symbols:string[], counts:Object, total:number, ranked:Array}}
   *   ranked は多い順の [{symbol, count, percent}]
   */
  function frequency(cipher){
    const symbols = Graphemes.split(String(cipher ?? '')).filter((g) => g.trim() !== '');
    const counts = Object.create(null);
    for(const s of symbols) counts[s] = (counts[s] || 0) + 1;
    const total = symbols.length;
    const ranked = Object.entries(counts)
      .map(([symbol, count]) => ({ symbol, count, percent: total ? (count / total) * 100 : 0 }))
      .sort((a, b) => b.count - a.count || a.symbol.localeCompare(b.symbol));
    return { symbols, counts, total, ranked };
  }

  /**
   * 頻度の順番だけで、絵文字 → 文字 の割り当ての下書きを作る
   * いちばん多い絵文字を E に、次を T に……と当てるだけの素朴な方法。
   * **これで当たるのは珍しく、ここから手で直していくのが解読の作業である**
   * @param {string} cipher
   * @returns {Object<string,string>} 絵文字 → A–Z
   */
  function guessByFrequency(cipher){
    const { ranked } = frequency(cipher);
    const order = Object.entries(ENGLISH_FREQ).sort((a, b) => b[1] - a[1]).map(([l]) => l);
    const guess = Object.create(null);
    ranked.forEach((r, i) => { if(i < order.length) guess[r.symbol] = order[i]; });
    return guess;
  }

  /**
   * いまの割り当てで平文を組み立てる（割り当てのない絵文字は伏せ字にする）
   * @param {string} cipher
   * @param {Object<string,string>} assignment - 絵文字 → A–Z
   * @param {string} [unknownChar] - 既定は '_'
   * @returns {{text:string, solved:number, total:number}}
   */
  function apply(cipher, assignment, unknownChar){
    const blank = unknownChar === undefined ? '_' : unknownChar;
    let text = '';
    let solved = 0;
    let total = 0;
    for(const g of Graphemes.split(String(cipher ?? ''))){
      if(g.trim() === ''){ text += g; continue; }
      const letter = Graphemes.lookup(assignment, g);
      total += 1;
      if(letter){ text += letter; solved += 1; }
      else text += blank;
    }
    return { text, solved, total };
  }

  /**
   * クリブ（平文に含まれるとわかっている語）を、暗号文のどこに当てられるか探す
   * @param {string} cipher
   * @param {string} crib - 例: 'THE'
   * @returns {Array<{index:number, assignment:Object}>} 当てはめられる位置と、そこで決まる対応
   *
   * 当てはめられるかどうかは、絵文字と文字が1対1であることで決まる。
   * 同じ絵文字が別の文字に、別の絵文字が同じ文字になってはいけない
   */
  function cribPositions(cipher, crib){
    const symbols = Graphemes.split(String(cipher ?? '')).filter((g) => g.trim() !== '');
    const word = String(crib ?? '').toUpperCase().replace(/[^A-Z]/g, '');
    const out = [];
    if(!word) return out;
    for(let i = 0; i + word.length <= symbols.length; i++){
      const assignment = Object.create(null);
      const used = Object.create(null);
      let ok = true;
      for(let j = 0; j < word.length; j++){
        const s = symbols[i + j];
        const L = word[j];
        if(assignment[s] !== undefined && assignment[s] !== L){ ok = false; break; }
        if(used[L] !== undefined && used[L] !== s){ ok = false; break; }
        assignment[s] = L;
        used[L] = s;
      }
      if(ok) out.push({ index: i, assignment });
    }
    return out;
  }

  /**
   * いまの割り当てが、英語としてどれくらいそれらしいか
   * よく続く2文字がいくつ現れるかで測る（割り当てが進むほど上がる）
   * @param {string} cipher
   * @param {Object<string,string>} assignment
   * @returns {{score:number, hits:number, pairs:number}} score は 0〜1
   */
  function likelihood(cipher, assignment){
    const { text } = apply(cipher, assignment, '_');
    // 伏せ字や空白をまたいだ組は数えない（間を詰めると、隣り合っていない2文字が
    // 偶然 TH や HE になって、割り当てが進んでいないのに点が上がってしまう）
    let hits = 0;
    let pairs = 0;
    for(const run of text.split(/[^A-Z]+/)){
      for(let i = 0; i + 1 < run.length; i++){
        pairs += 1;
        if(ENGLISH_BIGRAMS.includes(run.slice(i, i + 2))) hits += 1;
      }
    }
    return { score: pairs ? hits / pairs : 0, hits, pairs };
  }

  /**
   * 割り当てに矛盾がないか見る（1対1であること）
   * @param {Object<string,string>} assignment
   * @returns {{ok:boolean, duplicated:string[]}} duplicated は2つ以上の絵文字が当たっている文字
   */
  function validate(assignment){
    const byLetter = Object.create(null);
    for(const [symbol, letter] of Object.entries(assignment)){
      if(!letter) continue;
      (byLetter[letter] = byLetter[letter] || []).push(symbol);
    }
    const duplicated = Object.keys(byLetter).filter((L) => byLetter[L].length > 1).sort();
    return { ok: duplicated.length === 0, duplicated };
  }

  /**
   * 頻度分布が平文のまま残っていることを示す
   * 暗号文の頻度の並びと、平文の頻度の並びが同じ形になる
   * @param {string} plain
   * @param {string} cipher
   * @returns {{plain:number[], cipher:number[], same:boolean}} 多い順の件数
   */
  function compareShape(plain, cipher){
    const shapeOf = (s) => {
      const counts = Object.create(null);
      for(const g of Graphemes.split(String(s ?? ''))){
        if(g.trim() === '') continue;
        counts[g] = (counts[g] || 0) + 1;
      }
      return Object.values(counts).sort((a, b) => b - a);
    };
    const p = shapeOf(String(plain ?? '').toUpperCase().replace(/[^A-Z]/g, ''));
    const c = shapeOf(cipher);
    return { plain: p, cipher: c, same: p.length === c.length && p.every((v, i) => v === c[i]) };
  }

  /**
   * 英語の冗長度（bit/文字）の目安
   * Shannon "Prediction and Entropy of Printed English" (1951) が示した
   * 1文字あたりのエントロピー（約1.0〜1.5 bit）と、26文字を等確率で並べたときの
   * log2(26)≈4.7 bit との差。暗号の教科書はおおむね 3.2 を使う
   */
  const ENGLISH_REDUNDANCY = 3.2;

  /** log2(n!) */
  function log2Factorial(n){
    let s = 0;
    for(let i = 2; i <= n; i++) s += Math.log2(i);
    return s;
  }

  /**
   * 一意復号距離（unicity distance）の目安
   * 「暗号文がこれだけあれば、正しい鍵が1つに決まる」と見込まれる長さ。
   * U = H(K) / D （H(K) は鍵の情報量、D は平文の冗長度）
   *
   * @param {string} mode - 'caesar' / 'vigenere' / 'substitution'
   * @param {number} [keyLength] - ヴィジュネルの鍵の長さ
   * @returns {{keyBits:number, distance:number, keyspace:string}}
   */
  function unicityDistance(mode, keyLength){
    let keyBits;
    let keyspace;
    if(mode === 'caesar'){
      keyBits = Math.log2(26);
      keyspace = '26';
    }else if(mode === 'vigenere'){
      const n = Math.max(1, keyLength || 1);
      keyBits = n * Math.log2(26);
      keyspace = `26^${n}`;
    }else{
      keyBits = log2Factorial(26);
      keyspace = '26!';
    }
    return { keyBits, distance: keyBits / ENGLISH_REDUNDANCY, keyspace };
  }

  return {
    ENGLISH_FREQ, ENGLISH_BIGRAMS, LETTERS,
    ENGLISH_REDUNDANCY, log2Factorial, unicityDistance,
    frequency, guessByFrequency, apply, cribPositions, likelihood, validate, compareShape,
  };
})();

globalThis.Cryptanalysis = Cryptanalysis;
