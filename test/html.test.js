// index.html と画面側スクリプトの静的な検査
import test from 'node:test';
import assert from 'node:assert/strict';
import { read } from './load.js';

const html = read('index.html');
const main = read('js/main.js');
const custom = read('js/custommap.js');

test('スクリプトは計算部・画面の順に読み込み、重複がない', () => {
  const srcs = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
  assert.deepEqual(srcs, [
    'js/i18n.js',
    'js/graphemes.js',
    'js/emoji-sets.js',
    'js/modes/caesar.js',
    'js/modes/vigenere.js',
    'js/modes/morse.js',
    'js/modes/binaryhex.js',
    'js/custommap.js',
    'js/main.js',
  ]);
  assert.equal(new Set(srcs).size, srcs.length, '同じスクリプトを2回読み込んでいる');
});

test('絵文字セットを fetch していない（file:// で開けなくなるため）', () => {
  assert.doesNotMatch(main, /fetch\(/, 'fetch が残っている');
  assert.match(main, /globalThis\.EmojiSets/);
});

test('練習の出題方向がラベルと合っている', () => {
  // 「テキスト → 絵文字」なら、問題がテキストで答えが絵文字
  assert.match(main, /question\s*=\s*\(dir==='text-to-emoji'\)\s*\?\s*pick\s*:\s*emoji/);
  assert.match(main, /answer\s*=\s*\(dir==='text-to-emoji'\)\s*\?\s*emoji\s*:\s*pick/);
  // 5モードぶんの変換が1か所にまとまっている
  for (const mode of ['caesar', 'vigenere', 'morse', 'binary', 'hex']) {
    assert.match(main, new RegExp(`${mode}:\\s*\\(s\\)=>`), `${mode} の変換が無い`);
  }
});

test('URLのエンコードを二重にしていない', () => {
  // URLSearchParams が自分でエンコード・デコードする
  assert.doesNotMatch(main, /encodeURIComponent/);
  assert.doesNotMatch(main, /decodeURIComponent/);
});

test('localStorage の読み込みが例外で止まらない', () => {
  const parses = [...main.matchAll(/JSON\.parse\(/g)];
  assert.ok(parses.length > 0);
  // JSON.parse を含む行の前後に try があること
  assert.match(main, /try\{[\s\S]{0,200}JSON\.parse\(saved\)[\s\S]{0,200}\}catch/);
  assert.match(custom, /try\s*\{[\s\S]{0,200}JSON\.parse/);
});

test('インポート由来の値を innerHTML で組み立てていない', () => {
  // 対応表のセルは createElement + textContent で作る
  assert.doesNotMatch(main, /innerHTML\s*=\s*`[^`]*\$\{v\}/);
  assert.match(main, /vEl\.textContent\s*=\s*v;/);
});

test('記号を消すときに小文字まで消さない', () => {
  assert.match(main, /replace\(\/\[\^A-Za-z0-9\\s\]\/g,''\)/);
});

test('シフト量を 0–25 に正規化している', () => {
  assert.match(main, /function normalizeShift/);
  assert.match(main, /\(\(n % 26\) \+ 26\) % 26/);
  assert.doesNotMatch(main, /parseInt\(EL\('opt-shift'\)\.value\|\|'0',10\)%26/);
});

test('コピーの失敗を知らせる', () => {
  assert.match(main, /function copyText/);
  assert.match(main, /\.catch\(\(\)=> showToast\('❌ コピーに失敗しました'\)\)/);
  // 投げっぱなしの writeText が残っていない
  assert.doesNotMatch(main, /navigator\.clipboard\.writeText\([^)]*\);\s*\n\s*showToast/);
});

test('HTMLに存在しない droppable 属性を使っていない', () => {
  assert.doesNotMatch(custom, /droppable=/);
  assert.doesNotMatch(html, /droppable=/);
});

test('インラインの style 属性とイベント属性がない', () => {
  assert.doesNotMatch(html, /\son[a-z]+\s*=\s*"/i);
  assert.doesNotMatch(html, /javascript:/i);
});

test('主要な要素の id がそろっている', () => {
  const ids = ['mode', 'emoji-set', 'input', 'output', 'btn-encode', 'btn-decode', 'btn-copy-output',
    'keep-spaces', 'keep-punct', 'uppercase',
    'practice-direction', 'practice-mode', 'practice-new', 'practice-answer', 'practice-check',
    'practice-question', 'practice-result',
    'custom-save', 'custom-reset', 'custom-export', 'custom-import',
    'theme-default', 'dark-mode', 'light-mode', 'lang-ja', 'lang-en'];
  for (const id of ids) assert.ok(html.includes(`id="${id}"`), `id="${id}" がない`);

  // モードごとの入力欄は main.js が組み立てる
  for (const id of ['opt-shift', 'opt-key', 'opt-bin-chunk', 'opt-hex-chunk']) {
    assert.ok(main.includes(`id="${id}"`), `main.js が id="${id}" を作っていない`);
  }
});
