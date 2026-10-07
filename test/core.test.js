// 計算部（グラフェム分割・各モードの往復）のテスト
import test from 'node:test';
import assert from 'node:assert/strict';
import { modules, LETTERS, mappingOf, codepoints } from './load.js';

const { Graphemes, EmojiSets, Caesar, Vigenere, Morse, BinaryHex } = modules();

// ---- グラフェム分割

test('異体字セレクターつきの絵文字が割れない', () => {
  // ◻️ は U+25FB U+FE0F の2コードポイント。Array.from だと2つに割れる
  assert.equal(Array.from('◻️').length, 2, '前提: コードポイントでは2つ');
  assert.deepEqual(Graphemes.split('◻️'), ['◻️']);
  assert.deepEqual(Graphemes.split('☀️🌧️❄️'), ['☀️', '🌧️', '❄️']);
  assert.deepEqual(Graphemes.split('⬜⬛'), ['⬜', '⬛'], 'セレクター不要の文字も1つずつ');
});

test('ZWJでつないだ絵文字も1つにまとまる', () => {
  assert.deepEqual(Graphemes.split('👨‍👩‍👧'), ['👨‍👩‍👧']);
  assert.deepEqual(Graphemes.split('👍🏽'), ['👍🏽'], '肌の色の修飾子も直前にくっつく');
});

test('空とふつうの文字列', () => {
  assert.deepEqual(Graphemes.split(''), []);
  assert.deepEqual(Graphemes.split(null), []);
  assert.deepEqual(Graphemes.split('abc'), ['a', 'b', 'c']);
  assert.deepEqual(Graphemes.split('あいう'), ['あ', 'い', 'う']);
});

test('異体字セレクターを外せる', () => {
  assert.equal(Graphemes.stripVariationSelectors('◻️'), '◻');
  assert.equal(Graphemes.stripVariationSelectors('⬜'), '⬜', '元から無いものは変わらない');
});

test('逆引きはセレクターの有無を問わない', () => {
  const inv = Graphemes.buildInverse({ A: '☀️', B: '⬜' });
  assert.equal(Graphemes.lookup(inv, '☀️'), 'A');
  assert.equal(Graphemes.lookup(inv, '☀'), 'A', 'セレクター無しでも引ける');
  assert.equal(Graphemes.lookup(inv, '⬜'), 'B');
  assert.equal(Graphemes.lookup(inv, '🍎'), undefined);
});

test('Intl.Segmenter が無い環境でも同じ結果になる', () => {
  // フォールバックは Graphemes の中にあるので、ここでは有無だけを記録する
  assert.equal(typeof Graphemes.hasSegmenter, 'boolean');
  assert.ok(Graphemes.hasSegmenter, 'Node 22 では Intl.Segmenter が使える前提');
});

// ---- 絵文字セット

test('どのセットも A–Z の26個で、重複がない', () => {
  assert.ok(EmojiSets.length >= 4, `セットが ${EmojiSets.length} 個しかない`);
  for (const set of EmojiSets) {
    assert.equal(set.items.length, 26, `${set.id} が ${set.items.length} 個`);
    assert.equal(new Set(set.items).size, 26, `${set.id} に重複がある`);
    for (const e of set.items) {
      assert.equal(Graphemes.split(e).length, 1,
        `${set.id} の ${e}（${codepoints(e)}）が1文字に分けられない`);
    }
  }
});

// ---- シーザー

test('シーザーは全セット・全文字で往復する', () => {
  const plain = LETTERS.join('');
  for (const set of EmojiSets) {
    const map = mappingOf(set.id);
    for (const shift of [0, 1, 3, 13, 25]) {
      const enc = Caesar.encodeToEmoji(plain, shift, map);
      const dec = Caesar.decodeFromEmoji(enc, shift, map);
      assert.equal(dec, plain, `${set.id} / shift=${shift} で戻らない`);
    }
  }
});

test('シーザーの既知の値', () => {
  const map = mappingOf('foods');
  // 🍎=A …（foods の並び）。shift=3 なら H→K、E→H、L→O、O→R
  const enc = Caesar.encodeToEmoji('HELLO', 3, map);
  assert.equal(enc, [map.K, map.H, map.O, map.O, map.R].join(''));
  assert.equal(Caesar.decodeFromEmoji(enc, 3, map), 'HELLO');
});

test('シーザーは A–Z 以外をそのまま通す', () => {
  const map = mappingOf('foods');
  const enc = Caesar.encodeToEmoji('AB 12!', 0, map);
  assert.equal(enc, `${map.A}${map.B} 12!`);
  assert.equal(Caesar.decodeFromEmoji(enc, 0, map), 'AB 12!');
});

test('weather セットも全文字が戻る（異体字セレクターつきが14個ある）', () => {
  const map = mappingOf('weather');
  const withVs = LETTERS.filter((L) => Graphemes.stripVariationSelectors(map[L]) !== map[L]);
  assert.equal(withVs.length, 14, `セレクターつきが ${withVs.length} 個`);
  const plain = LETTERS.join('');
  assert.equal(Caesar.decodeFromEmoji(Caesar.encodeToEmoji(plain, 0, map), 0, map), plain);
});

// ---- ヴィジュネル

test('ヴィジュネルは全セットで往復する', () => {
  const plain = 'ATTACKATDAWN';
  for (const set of EmojiSets) {
    const map = mappingOf(set.id);
    for (const key of ['A', 'LEMON', 'ZZZ']) {
      const enc = Vigenere.encodeToEmoji(plain, key, map);
      assert.equal(Vigenere.decodeFromEmoji(enc, key, map), plain, `${set.id} / key=${key}`);
    }
  }
});

test('ヴィジュネルの既知の値（ATTACKATDAWN / LEMON → LXFOPVEFRNHR）', () => {
  const map = mappingOf('foods');
  const enc = Vigenere.encodeToEmoji('ATTACKATDAWN', 'LEMON', map);
  const expected = 'LXFOPVEFRNHR'.split('').map((L) => map[L]).join('');
  assert.equal(enc, expected);
});

test('ヴィジュネルは鍵が空なら素通しする', () => {
  const map = mappingOf('foods');
  assert.equal(Vigenere.encodeToEmoji('ABC', '', map), 'ABC');
});

// ---- モールス

test('モールスは往復する', () => {
  for (const text of ['HELLO WORLD', 'SOS', 'ATTACK AT DAWN 2026']) {
    assert.equal(Morse.decodeFromEmoji(Morse.encodeToEmoji(text)), text);
  }
});

test('モールスの既知の値（SOS）', () => {
  const enc = Morse.encodeToEmoji('SOS');
  assert.equal(enc, '⚫⚫⚫⏹⚪⚪⚪⏹⚫⚫⚫');
});

test('モールスの符号表は ITU-R M.1677-1 の文字と数字に一致する', () => {
  // Annex 1 Part I, 1.1.1 Letters / 1.1.2 Figures
  const ITU = {
    A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....',
    I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.',
    Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
    Y: '-.--', Z: '--..',
    0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-',
    5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
  };
  for (const [ch, code] of Object.entries(ITU)) {
    assert.equal(Morse.MAP[ch], code, `${ch} の符号が違う`);
  }
});

// ---- バイナリ・16進数

test('バイナリは往復する（以前は常に空文字だった）', () => {
  for (const chunk of ['8', '4', 'none']) {
    for (const text of ['HELLO', 'Hi', 'こんにちは', 'a b']) {
      const enc = BinaryHex.encodeBinaryToEmoji(text, chunk);
      assert.notEqual(enc, '', `${text} / ${chunk} でエンコードが空`);
      assert.equal(BinaryHex.decodeBinaryFromEmoji(enc), text, `${text} / ${chunk} で戻らない`);
    }
  }
});

test('バイナリに使う絵文字は異体字セレクターを含まない', () => {
  for (const e of [BinaryHex.BIN0, BinaryHex.BIN1]) {
    assert.equal([...e].length, 1, `${e}（${codepoints(e)}）が2コードポイント`);
    assert.match(e, /\p{Emoji_Presentation}/u, `${e} はセレクター無しでは絵文字にならない`);
  }
  assert.equal(BinaryHex.BIN0, '⬜');
  assert.equal(BinaryHex.BIN1, '⬛');
});

test('バイナリの既知の値（A = 01000001）', () => {
  const enc = BinaryHex.encodeBinaryToEmoji('A', 'none');
  assert.equal(enc, '⬜⬛⬜⬜⬜⬜⬜⬛');
  assert.equal(BinaryHex.decodeBinaryFromEmoji(enc), 'A');
});

test('バイナリの区切りは桁数ごとで、末尾に余らない', () => {
  const enc8 = BinaryHex.encodeBinaryToEmoji('AB', '8');
  assert.equal(enc8.split(' ').length, 2, '8桁ずつで2組');
  assert.equal(enc8.endsWith(' '), false);
  const enc4 = BinaryHex.encodeBinaryToEmoji('A', '4');
  assert.equal(enc4.split(' ').length, 2, '4桁ずつで2組');
});

test('16進数は往復する', () => {
  for (const chunk of ['2', 'none']) {
    for (const text of ['HELLO WORLD', 'こんにちは']) {
      const enc = BinaryHex.encodeHexToEmoji(text, chunk);
      assert.equal(BinaryHex.decodeHexFromEmoji(enc), text, `${text} / ${chunk}`);
    }
  }
});

test('16進数の既知の値（A = 0x41）', () => {
  assert.equal(BinaryHex.encodeHexToEmoji('A', 'none'), '➍➊');
});

test('16進数に使う絵文字は1コードポイント', () => {
  for (const e of BinaryHex.HEX) {
    assert.equal(Graphemes.split(e).length, 1, `${e}（${codepoints(e)}）`);
  }
  assert.equal(new Set(BinaryHex.HEX).size, 16, '16個に重複がある');
});

// ---- 境界

test('空の入力でも落ちない', () => {
  const map = mappingOf('foods');
  assert.equal(Caesar.encodeToEmoji('', 3, map), '');
  assert.equal(Caesar.decodeFromEmoji('', 3, map), '');
  assert.equal(Morse.encodeToEmoji(''), '');
  assert.equal(BinaryHex.encodeBinaryToEmoji('', 'none'), '');
  assert.equal(BinaryHex.decodeBinaryFromEmoji(''), '');
});

test('知らない絵文字は読み飛ばす・そのまま残す', () => {
  const map = mappingOf('foods');
  assert.equal(Caesar.decodeFromEmoji('🚀', 0, map), '🚀', 'シーザーはそのまま残す');
  assert.equal(BinaryHex.decodeBinaryFromEmoji('🚀'), '', 'バイナリは読み飛ばす');
});
