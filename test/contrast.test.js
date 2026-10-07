// 配色のコントラスト比と、触って操作する要素の大きさ
import test from 'node:test';
import assert from 'node:assert/strict';
import { read } from './load.js';

const css = read('css/style.css');
const html = read('index.html');
const main = read('js/main.js');

/** #rrggbb を [r,g,b] に */
function hex(s) {
  const v = s.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
}

/** WCAG 2.2 の相対輝度 */
function luminance([r, g, b]) {
  const f = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function ratio(a, b) {
  const [la, lb] = [luminance(a), luminance(b)];
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** fg を alpha で bg に重ねた色 */
function over(fg, bg, alpha) {
  return fg.map((v, i) => v * alpha + bg[i] * (1 - alpha));
}

/** テーマごとの変数を CSS から読む */
function varsOf(selector) {
  const block = css.match(new RegExp(`${selector}\\{([^}]*)\\}`));
  assert.ok(block, `${selector} が見つからない`);
  const out = {};
  for (const m of block[1].matchAll(/--([\w-]+)\s*:\s*(#[0-9a-fA-F]{6})/g)) out[m[1]] = m[2];
  return out;
}

const base = varsOf(':root');
const dark = { ...base, ...varsOf('body\\.dark-mode') };
const light = { ...base, ...varsOf('body\\.light-mode') };
const THEMES = { '既定（ダークブルー）': base, 'ダークモード': dark, 'ライトモード': light };

/** 本文の大きさ（4.5:1 が要る）の組み合わせ */
function textPairs(v) {
  const card = hex(v.card);
  const bg = hex(v.bg);
  return [
    ['本文 on card', hex(v.text), card],
    ['本文 on bg', hex(v.text), bg],
    ['補助の文字 on card', hex(v.muted), card],
    ['補助の文字 on bg', hex(v.muted), bg],
    ['リンク・見出し on card', hex(v.accent), card],
    ['リンク・見出し on bg', hex(v.accent), bg],
    ['主ボタンの文字', hex(v['on-accent']), hex(v.primary)],
    ['主ボタンの文字（濃い側）', hex(v['on-accent']), hex(v.accent)],
    ['危険ボタンの文字', hex(v['on-danger']), hex(v.danger)],
    ['危険ボタンの文字（濃い側）', hex(v['on-danger']), hex(v.error)],
    ['ヘルプの文字', hex(v['on-accent']), hex(v.accent)],
    // .note は 10% の色を敷いた上に同じ色の文字を載せる
    ['成功の知らせ', hex(v.success), over(hex(v.success), hex(v.fg), 0.1)],
    ['エラーの知らせ', hex(v.error), over(hex(v.error), hex(v.fg), 0.1)],
    ['注意の知らせ', hex(v.warning), over(hex(v.warning), hex(v.fg), 0.1)],
  ];
}

for (const [name, v] of Object.entries(THEMES)) {
  test(`${name} の文字が 4.5:1 以上`, () => {
    for (const [label, fg, bg] of textPairs(v)) {
      const r = ratio(fg, bg);
      assert.ok(r >= 4.5, `${label} が ${r.toFixed(2)}:1`);
    }
  });
}

test('accent / primary の上に置く文字色をテーマごとに決めている', () => {
  // 白文字を明るい accent に載せると 2:1 ほどしか出ない
  for (const [name, v] of Object.entries(THEMES)) {
    assert.ok(v['on-accent'], `${name} に --on-accent がない`);
    assert.ok(v['on-danger'], `${name} に --on-danger がない`);
  }
  assert.doesNotMatch(css, /button\.primary\{[^}]*color:#fff/);
  assert.doesNotMatch(css, /button\.danger\{[^}]*color:#fff/);
  assert.doesNotMatch(css, /\.help-icon\{[^}]*color:#fff/);
});

test('入力欄が16px以上、押す要素が44px以上', () => {
  // 16px 未満の入力欄は iOS Safari が自動で拡大する
  assert.match(css, /input, select, textarea, button\{\s*font-size:16px;\s*\}/);
  assert.match(css, /min-height:44px/);
  // チェックボックスは 20px、ヘルプのアイコンは 24px（WCAG 2.2 の最小）
  assert.match(css, /input\[type="checkbox"\], input\[type="radio"\]\{\s*width:20px/);
  assert.match(css, /min-width:24px/);
});

test('ツールチップが折り返す', () => {
  // 狭い画面で説明が画面外へ出ないこと
  const tip = css.match(/\.help-icon:hover::after,\n\.help-icon:focus-visible::after\{([^}]*)\}/);
  assert.ok(tip, 'ツールチップの定義が見つからない');
  assert.doesNotMatch(tip[1], /white-space:nowrap/);
  assert.match(tip[1], /max-width:70vw/);
});

test('ヘルプは button で、焦点を当てても読める', () => {
  assert.match(main, /<button type="button" class="help-icon"/);
  assert.doesNotMatch(main, /<span class="help-icon"/);
  assert.match(css, /\.help-icon:focus-visible::after/);
  // 読み上げ用の名前が付いている
  assert.match(main, /aria-label="\$\{t\('ui\.help'\)\}"/);
});

test('タブの ARIA の参照が通っていて、矢印キーで動く', () => {
  const tabs = [...html.matchAll(/<button class="tab[^"]*" id="tab-btn-(\w+)" data-tab="(\w+)" role="tab" aria-controls="tab-(\w+)"/g)];
  assert.equal(tabs.length, 6, `タブが ${tabs.length} 個`);
  for (const [, btnKey, dataKey, panelKey] of tabs) {
    assert.equal(btnKey, dataKey);
    assert.equal(btnKey, panelKey);
    assert.ok(html.includes(`<section id="tab-${panelKey}"`), `tab-${panelKey} のパネルが無い`);
    assert.ok(html.includes(`aria-labelledby="tab-btn-${panelKey}"`), `tab-${panelKey} の aria-labelledby が無い`);
  }
  assert.match(main, /ArrowRight/);
  assert.match(main, /ArrowLeft/);
  assert.match(main, /b\.setAttribute\('tabindex'/);
});

test('meta CSP に frame-ancestors を書いていない', () => {
  // meta では仕様上無視され、読み込みのたびにコンソールへ警告が出る
  const meta = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/);
  assert.ok(meta, 'meta CSP が無い');
  assert.doesNotMatch(meta[1], /frame-ancestors/);
  assert.match(meta[1], /default-src 'self'/);
  assert.match(meta[1], /script-src 'self'/);
});

test('_headers が効かないことを書いてあり、非推奨のヘッダーが無い', () => {
  const headers = read('_headers');
  assert.match(headers, /GitHub Pages/);
  // 配るヘッダーの行だけを見る（# で始まる説明文は対象外）
  const directives = headers.split('\n').filter((l) => !l.trimStart().startsWith('#')).join('\n');
  assert.doesNotMatch(directives, /X-XSS-Protection/);
  assert.match(directives, /X-Frame-Options: DENY/);
});
