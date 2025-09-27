/* ============================================
 * Caesar Cipher Mode
 * シーザー暗号モジュール
 * ============================================
 *
 * シーザー暗号は最も単純な換字式暗号で、
 * アルファベットを固定数シフトして置換する。
 *
 * 例: シフト=3 の場合
 *   A → D, B → E, ..., X → A, Y → B, Z → C
 */

const Caesar = {
  /**
   * テキストをシーザー暗号でエンコードし、絵文字に変換
   *
   * @param {string} text - 入力テキスト（A-Z）
   * @param {number} shift - シフト量（0-25）
   * @param {Object} map - A-Z→絵文字のマッピングオブジェクト
   * @returns {string} 絵文字列
   *
   * 処理の流れ:
   * 1. 各文字をシフトして別の文字に変換
   * 2. 変換後の文字に対応する絵文字を取得
   * 3. A-Z以外の文字（スペース等）はそのまま出力
   */
  encodeToEmoji(text, shift, map){
    let out = '';
    for(const ch of text){
      if(/[A-Z]/.test(ch)){
        // 文字コードから0-25のインデックスに変換
        const idx = ch.charCodeAt(0)-65;
        // シフトして26でモジュロ（Z→Aの巻き戻し対応）
        const e = (idx + shift) % 26;
        // インデックスを文字コードに戻す
        const letter = String.fromCharCode(65+e);
        // 対応する絵文字を追加
        out += map[letter];
      }else{
        // A-Z以外はそのまま（スペース、記号等）
        out += ch;
      }
    }
    return out;
  },

  /**
   * 絵文字列をシーザー暗号でデコードし、平文に戻す
   *
   * @param {string} emojiStr - 絵文字列
   * @param {number} shift - シフト量（0-25）
   * @param {Object} map - A-Z→絵文字のマッピングオブジェクト
   * @returns {string} 平文テキスト
   *
   * 処理の流れ:
   * 1. マッピングを反転（絵文字→A-Z）
   * 2. 各絵文字を対応する文字に変換
   * 3. シフトを逆方向に適用して元の文字に戻す
   */
  decodeFromEmoji(emojiStr, shift, map){
    // マッピングを反転（絵文字→文字）
    const inv = {};
    for(const [k,v] of Object.entries(map)) inv[v]=k;

    // 絵文字列をグラフェム単位で分割
    const clusters = Caesar.splitGraphemes(emojiStr);
    let out='';

    for(const g of clusters){
      if(inv[g]){
        // 絵文字に対応する文字のインデックス
        const idx = inv[g].charCodeAt(0)-65;
        // シフトを逆方向に適用（+26は負数回避）
        const d = (idx - shift + 26) % 26;
        // 元の文字を復元
        out += String.fromCharCode(65+d);
      }else{
        // マップにない文字（スペース等）はそのまま
        out += g;
      }
    }
    return out;
  },

  /**
   * 文字列をグラフェム単位で分割
   *
   * @param {string} s - 分割対象の文字列
   * @returns {Array<string>} グラフェムの配列
   *
   * 注: 本ツールの絵文字セットは単一コードポイントのみ使用し、
   *     ZWJ合字やバリエーションセレクタは使用していないため、
   *     Array.from() による簡易分割で十分。
   */
  splitGraphemes(s){
    return Array.from(s);
  }
};