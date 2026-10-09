// README の記述を実装と突き合わせる
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { modules, mappingOf, LETTERS } from './load.js';

const ROOT = new URL('..', import.meta.url);
const read = (f) => fs.readFileSync(new URL(f, ROOT), 'utf8');
const readme = read('README.md');
const { EmojiSets, Morse, BinaryHex, Caesar, Graphemes } = modules();

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
  // 符号表の件数と、欧文・和文のあいだの衝突の数を README と突き合わせる
  const intl = Object.keys(Morse.TABLES.international).length;
  const wabun = Object.keys(Morse.TABLES.wabun).length;
  const clash = Morse.collisions().length;
  assert.ok(readme.includes(`ITU-R M.1677-1、${intl}項目`), `欧文の件数が README と違う（${intl}）`);
  assert.ok(readme.includes(`別表第一号、${wabun}項目`), `和文の件数が README と違う（${wabun}）`);
  assert.ok(readme.includes(`両者は${clash}個の符号が重なる`), `衝突の数が README と違う（${clash}）`);
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

// ---- 英語版のREADME（要約にせず、同じ節をそろえる）
const readmeEn = read('README.en.md');

test('日本語版と英語版で、見出しの数・順・階層がそろっている', () => {
  const levels = (text) => [...text.matchAll(/^(#{1,3}) /gm)].map((m) => m[1].length);
  const ja = levels(readme);
  const en = levels(readmeEn);
  assert.ok(ja.length >= 25, `見出しが ${ja.length} 個しかない`);
  assert.deepEqual(en, ja, `見出しの数か階層が違う（ja ${ja.length} / en ${en.length}）`);
});

test('英語版に日本語の本文が残っていない', () => {
  const body = readmeEn
    .split('\n')
    // 日本語そのものを示す行と、相互リンクの行は対象から外す
    .filter((line) => !line.includes('README.md') && !line.includes('日本語')
      && !line.includes('別表第一号'))
    .join('\n');
  const hits = [...body.matchAll(/[぀-ヿ一-鿿]+/g)].map((m) => m[0]);
  assert.deepEqual(hits, [], `日本語が残っている: ${hits.slice(0, 5).join(' / ')}`);
});

test('両方のREADMEが互いにリンクしている', () => {
  assert.match(readme, /^\[English\]\(README\.en\.md\) · 日本語$/m);
  assert.match(readmeEn, /^English · \[日本語\]\(README\.md\)$/m);
  // YAML メタデータは日本語版だけに置く（hackinglab.online が読むのは README.md）
  assert.doesNotMatch(readmeEn, /^id: day076$/m);
});

test('英語版の画像がすべて実在し、英語の画面である', () => {
  const imgs = [...readmeEn.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map((m) => m[1]);
  const local = imgs.filter((u) => !u.startsWith('http'));
  assert.equal(local.length, 6, `画像の参照が ${local.length} 件`);
  for (const rel of local) {
    assert.ok(rel.startsWith('assets/en/'), `英語版は英語の画面を使う: ${rel}`);
    assert.ok(fs.existsSync(new URL(rel, ROOT)), `${rel} がない`);
  }
});

test('日本語版の画像もすべて実在する', () => {
  const imgs = [...readme.matchAll(/!\[[^\]]*\]\((assets\/[^)]+)\)/g)].map((m) => m[1]);
  assert.equal(imgs.length, 6, `画像の参照が ${imgs.length} 件`);
  for (const rel of imgs) {
    assert.ok(!rel.startsWith('assets/en/'), `日本語版は日本語の画面を使う: ${rel}`);
    assert.ok(fs.existsSync(new URL(rel, ROOT)), `${rel} がない`);
  }
});

test('英語版の絵文字セットの表も実装と合っている', () => {
  for (const set of EmojiSets) {
    const row = readmeEn.split('\n').find((l) => l.includes(`**${set.name}**`));
    assert.ok(row, `${set.name} の行がない`);
    assert.ok(row.includes(set.items.slice(0, 12).join('')), `${set.name} の先頭12個が合っていない`);
  }
});

test('ユースケースの「このツールならではの使い方」の値は計算部と同じ（日英）', () => {
  const readmeEn2 = read('README.en.md');
  const map = mappingOf('foods');
  const hello = Caesar.encodeToEmoji('HELLO', 0, map);
  assert.equal(hello, '🍓🍌🍍🍍🍅');
  assert.equal(map['L'], '🍍');
  for (const md of [readme, readmeEn2]) assert.ok(md.includes('🍓🍌🍍🍍🍅'));
  const weather = EmojiSets.find((s) => s.id === 'weather');
  const broken = weather.items.filter((e) => Graphemes.split(e).length === 1 && [...e].length > 1).length;
  assert.equal(broken, 14);
  for (const md of [readme, readmeEn2]) assert.ok(md.includes('14'));
  const sos = Morse.encodeToEmoji('SOS');
  assert.equal(sos, '⚫⚫⚫⏹⚪⚪⚪⏹⚫⚫⚫');
  for (const md of [readme, readmeEn2]) assert.ok(md.includes('⚫⚫⚫⏹⚪⚪⚪⏹⚫⚫⚫'));
});
