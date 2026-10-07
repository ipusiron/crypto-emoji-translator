// README の記述を実装と突き合わせる
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { modules, mappingOf, LETTERS } from './load.js';

const ROOT = new URL('..', import.meta.url);
const read = (f) => fs.readFileSync(new URL(f, ROOT), 'utf8');
const readme = read('README.md');
const { EmojiSets, Morse, BinaryHex, Caesar } = modules();

test('YAML メタデータの構造と値を保つ', () => {
  const block = readme.match(/^<!--\n---\n([\s\S]*?)\n---\n-->/);
  assert.ok(block, 'YAML メタデータがない');
  const yaml = block[1];
  for (const key of ['id: day076', 'slug: crypto-emoji-translator', 'difficulty:', 'hub: true']) {
    assert.ok(yaml.includes(key), `${key} がない`);
  }
  assert.ok(yaml.includes('Substitution Cipher'), '誤字 Subsutition が残っている');
  assert.doesNotMatch(yaml, /Subsutition/);
});

test('シリーズ標準の見出しがそろっている', () => {
  for (const h of ['# Crypto Emoji Translator', '**Day076 - 生成AIで作るセキュリティツール100**',
    '## 🌐 デモページ', '## 📸 スクリーンショット', '## 🎯 ユースケース', '## 🧪 テスト',
    '## 💻 動作環境', '## 🗂️ ディレクトリー構造', '## 📄 ライセンス', '## 🛠️ このツールについて']) {
    assert.ok(readme.includes(h), `${h} がない`);
  }
});

test('同じ見出しが2つない', () => {
  const heads = [...readme.matchAll(/^#{2,3} (.+)$/gm)].map((m) => m[1].replace(/^[^\p{L}\p{N}]+/u, '').trim());
  const dup = heads.filter((h, i) => heads.indexOf(h) !== i);
  assert.deepEqual(dup, [], `重複した見出し: ${dup.join(', ')}`);
});

test('ディレクトリー構造に全ファイルが載っていて、全行に説明がある', () => {
  const tree = readme.match(/## 🗂️ ディレクトリー構造\n\n```\n([\s\S]*?)```/);
  assert.ok(tree, 'ディレクトリー構造がない');
  const lines = tree[1].trim().split('\n');
  for (const line of lines.slice(1)) assert.match(line, /# .+$/, `説明のない行: ${line}`);

  const skip = new Set(['.git', 'node_modules', '.claude']);
  const found = [];
  const walk = (dir, prefix) => {
    for (const entry of fs.readdirSync(new URL(dir, ROOT), { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      const rel = prefix + entry.name;
      if (entry.isDirectory()) walk(`${dir}${entry.name}/`, `${rel}/`);
      else found.push(rel);
    }
  };
  walk('', '');
  for (const file of found) {
    const base = path.basename(file);
    assert.ok(lines.some((l) => l.includes(`${base} `)), `ツリーに ${file} がない`);
  }
});

test('絵文字セットの表が実装と合っている', () => {
  for (const set of EmojiSets) {
    const row = readme.split('\n').find((l) => l.includes(`**${set.name}**`));
    assert.ok(row, `${set.name} の行がない`);
    const head = set.items.slice(0, 12).join('');
    assert.ok(row.includes(head), `${set.name} の先頭12個が合っていない`);
  }
});

test('変換モードの説明が実装と合っている', () => {
  assert.ok(readme.includes(`⬜（0）⬛（1）`), 'バイナリの絵文字が README と違う');
  assert.equal(BinaryHex.BIN0, '⬜');
  assert.equal(BinaryHex.BIN1, '⬛');
  assert.ok(readme.includes('⓿➊➋…🅕'), '16進数の絵文字が README と違う');
  assert.equal(BinaryHex.HEX[0], '⓿');
  assert.equal(BinaryHex.HEX[15], '🅕');
  // モールスは A–Z と 0–9 だけ、という記述を裏づける
  assert.ok(readme.includes('モールス符号は A–Z と 0–9 だけに対応しています'));
  assert.equal(Object.keys(Morse.MAP).length, 36);
});

test('共有URLの例が、いまのパラメーターで動く形になっている', () => {
  const example = readme.match(/https:\/\/ipusiron\.github\.io\/crypto-emoji-translator\/\?([^\n`]+)/);
  assert.ok(example, '使用例のURLがない');
  const qs = new URLSearchParams(example[1]);
  const table = readme.match(/## 🔗 共有用URLパラメーター\n\n([\s\S]*?)\n\n\*\*使用例/);
  assert.ok(table, 'パラメーターの表がない');
  for (const key of qs.keys()) {
    assert.ok(table[1].includes(`\`${key}\``), `表に ${key} が無い`);
  }
  // 手でエスケープしない方針なので、README も「URLエンコード済み」とは書かない
  assert.doesNotMatch(readme, /URLエンコード済み/);
});

test('シーザー暗号の置換表の例が実装と合っている', () => {
  // 「例：シフト=3」の節に出る対応を、計算部で確かめる
  const map = mappingOf('foods');
  const enc = Caesar.encodeToEmoji('A', 3, map);
  assert.equal(enc, map.D, 'シフト3で A→D にならない');
  assert.equal(LETTERS.length, 26);
});

test('実装にない機能を書いていない', () => {
  assert.doesNotMatch(readme, /文字サイズ調整/);
  assert.doesNotMatch(readme, /data\/emoji_sets\.json/);
  // キーボード操作の但し書きがある
  assert.match(readme, /ドラッグ＆ドロップのみで、キーボードでは操作できない/);
});

test('表記をそろえる', () => {
  const NG = [
    [/サーバ(?![ーイ])/, 'サーバー'],
    [/ユーザ(?![ー])/, 'ユーザー'],
    [/ブラウザ(?![ー])/, 'ブラウザー'],
    [/フォルダ(?![ー])/, 'フォルダー'],
    [/リポジトリ(?![ー])/, 'リポジトリー'],
    [/ディレクトリ(?![ー])/, 'ディレクトリー'],
    [/モールス信号/, 'モールス符号'],
    [/分かる|分かり|分から/, 'わかる'],
    [/全て/, 'すべて'],
  ];
  for (const file of ['README.md', 'index.html', 'js/i18n.js']) {
    const text = read(file);
    for (const [re, should] of NG) {
      const m = text.match(re);
      assert.equal(m, null, m ? `「${m[0]}」は「${should}」に（${file}）` : '');
    }
  }
});
