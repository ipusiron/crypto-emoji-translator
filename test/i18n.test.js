// 日英の辞書と、画面の文言の対応
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { read } from './load.js';

const html = read('index.html');
const main = read('js/main.js');
const custom = read('js/custommap.js');

// i18n.js は State を見るので、最小限のものを用意してから読み込む
globalThis.State = { currentLang: 'ja' };
globalThis.document = {
  documentElement: {},
  querySelectorAll: () => [],
};
vm.runInThisContext(read('js/i18n.js'), { filename: 'js/i18n.js' });
// 読み込んだ i18n / t は同じ realm の字句環境にあるので、橋渡しして取り出す
vm.runInThisContext('globalThis.__i18n = i18n; globalThis.__t = t;');
const DICT = globalThis.__i18n;
const t = globalThis.__t;

test('日本語と英語で同じキーがそろっている', () => {
  const ja = Object.keys(DICT.ja).sort();
  const en = Object.keys(DICT.en).sort();
  assert.ok(ja.length > 130, `キーが ${ja.length} 件しかない`);
  assert.deepEqual(en, ja, '日本語と英語でキーが違う');
});

test('空文字の文言でもキー名が出ない', () => {
  // footer.close は英語では空文字。|| で見ると falsy でキー名が返ってしまう
  assert.equal(DICT.en['footer.close'], '');
  globalThis.State.currentLang = 'en';
  assert.equal(t('footer.close'), '', 'キー名が返っている');
  globalThis.State.currentLang = 'ja';
  assert.equal(t('footer.close'), '）');
});

test('知らないキーはキー名を返す', () => {
  assert.equal(t('nope.nope'), 'nope.nope');
});

test('{変数} を置き換えられる', () => {
  globalThis.State.currentLang = 'ja';
  assert.equal(t('custom.unassigned', { letter: 'Q' }), '未割当の文字があります: Q');
  globalThis.State.currentLang = 'en';
  assert.equal(t('custom.unassigned', { letter: 'Q' }), 'Some letters are unassigned: Q');
  globalThis.State.currentLang = 'ja';
});

test('英語に日本語が残っていない', () => {
  const leftover = Object.entries(DICT.en)
    .filter(([, v]) => /[぀-ヿ一-鿿]/.test(v))
    // 日本語そのものを示す項目は除く
    .filter(([k]) => !['settings.lang_ja'].includes(k))
    .map(([k]) => k);
  assert.deepEqual(leftover, []);
});

test('英語が日本語の丸写しになっていない', () => {
  const same = Object.keys(DICT.ja).filter((k) => DICT.ja[k] === DICT.en[k]);
  // 固有名詞・記号・英語のままでよいものは除く
  const allowed = new Set(['app.title', 'footer.link', 'settings.lang_en', 'settings.lang_ja',
    'practice.direction_te', 'practice.direction_et',
    'practice.mode_binary', 'transform.mode_binary']);
  const unexpected = same.filter((k) => !allowed.has(k) && /[A-Za-z]/.test(DICT.ja[k]) === false);
  assert.deepEqual(unexpected, [], `訳されていない: ${unexpected.join(', ')}`);
});

test('data-i18n のキーはすべて辞書にある', () => {
  const keys = [...html.matchAll(/data-i18n="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(keys.length > 50, `data-i18n が ${keys.length} 件しかない`);
  for (const key of keys) {
    assert.ok(key in DICT.ja, `日本語の辞書に ${key} がない`);
    assert.ok(key in DICT.en, `英語の辞書に ${key} がない`);
  }
});

test('画面が組み立てる文言を直書きしていない', () => {
  // トースト・判定・状態表示はすべて辞書から引く
  const JA = /['"`][^'"`]*[぀-ヿ一-鿿][^'"`]*['"`]/g;
  for (const [name, src] of [['main.js', main], ['custommap.js', custom]]) {
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .map((line) => line.replace(/(?<!:)\/\/.*$/, ''))
      .join('\n')
      // data-i18n を書いた要素の中身は applyTranslations が置き換えるので、
      // そのテンプレートリテラルごと対象から外す
      .replace(/`[^`]*data-i18n[^`]*`/g, '``')
      // コンソールへの警告は画面に出ないので対象外
      .replace(/console\.\w+\([^)]*\)/g, 'console.log()');
    const hits = [...code.matchAll(JA)].map((m) => m[0]);
    assert.deepEqual(hits, [], `${name} に直書きの日本語: ${hits.slice(0, 3).join(' / ')}`);
  }
});

test('言語を切り替えたら html の lang も変わる', () => {
  assert.match(read('js/i18n.js'), /document\.documentElement\.lang = State\.currentLang/);
});

test('辞書のキーはどこかで使われている', () => {
  const sources = [html, main, custom, read('js/i18n.js')].join('\n');
  const unused = Object.keys(DICT.ja).filter((k) => !sources.includes(`'${k}'`) && !sources.includes(`"${k}"`));
  assert.deepEqual(unused, []);
});
