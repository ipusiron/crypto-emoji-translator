// 画面と同じ通常のスクリプト（js/*.js）を、テストの実行環境に読み込む。
// vm.runInThisContext で読むので、読み込んだ結果はテスト側と同じ realm に置かれる
import fs from 'node:fs';
import vm from 'node:vm';

export const read = (f) =>
  fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

const loaded = new Set();
export function load(file) {
  if (!loaded.has(file)) {
    vm.runInThisContext(read(file), { filename: file });
    loaded.add(file);
  }
  return globalThis;
}

// 画面と同じ順で読み込む（graphemes → セット → 各モード）
export function modules() {
  load('js/graphemes.js');
  load('js/emoji-sets.js');
  load('js/modes/caesar.js');
  load('js/modes/vigenere.js');
  load('js/modes/morse.js');
  load('js/modes/binaryhex.js');
  load('js/modes/bytes.js');
  return globalThis;
}

export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/** セットのid から A–Z → 絵文字 の対応表を作る（画面の rebuildMappingFromSet と同じ） */
export function mappingOf(setId) {
  const { EmojiSets } = modules();
  const set = EmojiSets.find((s) => s.id === setId);
  if (!set) throw new Error(`セットが無い: ${setId}`);
  const map = {};
  LETTERS.forEach((L, i) => { map[L] = set.items[i]; });
  return map;
}

/** コードポイントを U+XXXX の並びで返す（どの絵文字かを失敗時に示すため） */
export const codepoints = (s) =>
  [...s].map((c) => 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')).join(' ');
