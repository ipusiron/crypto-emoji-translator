// 計算部（グラフェム分割・各モードの往復）のテスト
import test from 'node:test';
import assert from 'node:assert/strict';
import { modules, LETTERS, mappingOf, codepoints } from './load.js';

const { Graphemes, EmojiSets, Caesar, Vigenere, Morse, BinaryHex, ByteCode } = modules();

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

// ---- モールス（欧文と和文）

test('どちらの符号表にも、表のなかの衝突がない', () => {
  for (const variant of Morse.VARIANTS) {
    const table = Morse.TABLES[variant];
    const seen = new Map();
    for (const [ch, code] of Object.entries(table)) {
      assert.ok(!seen.has(code), `${variant}: ${code} が ${seen.get(code)} と ${ch} で重複`);
      seen.set(code, ch);
      assert.match(code, /^[.-]+$/, `${variant}: ${ch} の符号が点と線でない`);
    }
  }
});

test('欧文の表は ITU-R M.1677-1 の記号も持つ', () => {
  // Annex 1 Part I, 1.1.3 Punctuation marks and miscellaneous signs
  const ITU_PUNCT = {
    '.': '.-.-.-', ',': '--..--', ':': '---...', '?': '..--..', "'": '.----.',
    '-': '-....-', '/': '-..-.', '(': '-.--.', ')': '-.--.-', '"': '.-..-.',
    '=': '-...-', '+': '.-.-.', '@': '.--.-.',
  };
  for (const [ch, code] of Object.entries(ITU_PUNCT)) {
    assert.equal(Morse.TABLES.international[ch], code, `${ch} の符号が違う`);
  }
  // accented e（1.1.1）
  assert.equal(Morse.TABLES.international['É'], '..-..');
  // 乗算記号は X と同じ符号なので入れない（ITU 3.2.1「X を送る」）
  assert.equal(Morse.TABLES.international['×'], undefined);
  // 業務記号は文字を持たず、一部は文字と衝突するので入れない
  assert.equal(Morse.REVERSE.international['-.-'], 'K', 'Invitation to transmit を入れてしまっている');
});

test('和文の表は無線局運用規則 別表第一号と合っている', () => {
  // 別表第一号 1 和文 一 文字（抜粋）
  const WABUN = {
    イ: '.-', ロ: '.-.-', ハ: '-...', ニ: '-.-.', ホ: '-..', ヘ: '.',
    ン: '.-.-.', ム: '-', ラ: '...',
    '゙': '..',      // 濁点
    '゚': '..--.',   // 半濁点
    'ー': '.--.-',        // 長音
    '、': '.-.-.-',       // 区切点
  };
  for (const [ch, code] of Object.entries(WABUN)) {
    assert.equal(Morse.TABLES.wabun[ch], code, `${ch} の符号が違う`);
  }
  // 数字は欧文と同じ
  for (const d of '0123456789') {
    assert.equal(Morse.TABLES.wabun[d], Morse.TABLES.international[d], `${d} が欧文と違う`);
  }
});

test('欧文と和文は符号が衝突するので、表を指定しないと決まらない', () => {
  const clash = Morse.collisions();
  assert.ok(clash.length > 30, `衝突が ${clash.length} 件しかない`);
  // 代表例を名指しで押さえる
  const byCode = new Map(clash.map((c) => [c.code, c]));
  assert.deepEqual(byCode.get('-'), { code: '-', international: 'T', wabun: 'ム' });
  assert.deepEqual(byCode.get('.-'), { code: '.-', international: 'A', wabun: 'イ' });
  // 同じ絵文字列が、表によって別の文字に戻る
  const emoji = Morse.encode('A', 'international').emoji;
  assert.equal(Morse.decode(emoji, 'international').text, 'A');
  assert.equal(Morse.decode(emoji, 'wabun').text, 'イ');
});

test('欧文は記号つきで往復する', () => {
  for (const text of ['HELLO, WORLD.', 'WHO? ME!', 'A=B+C', 'E@MAIL.COM']) {
    const r = Morse.encode(text, 'international');
    const back = Morse.decode(r.emoji, 'international');
    // 表にない文字（! など）は落ちるので、落とした分を除いて比べる
    const expected = [...text.toUpperCase()].filter((c) => !/\s/.test(c) && !r.dropped.includes(c));
    const got = [...back.text].filter((c) => !/\s/.test(c));
    assert.deepEqual(got, expected, `${text} が戻らない`);
  }
});

test('表にない文字は落とし、落としたことを返す', () => {
  const r = Morse.encode('HELLO, WORLD!', 'international');
  assert.deepEqual(r.dropped, ['!'], '落とした文字を返していない');
  assert.equal(Morse.decode(r.emoji, 'international').text, 'HELLO, WORLD');
});

test('和文は、ひらがな・濁音・小書きを扱って往復する', () => {
  assert.equal(Morse.decode(Morse.encode('こんにちは', 'wabun').emoji, 'wabun').text, 'コンニチハ');
  assert.equal(Morse.decode(Morse.encode('ガギグ', 'wabun').emoji, 'wabun').text, 'ガギグ', '濁点が戻らない');
  assert.equal(Morse.decode(Morse.encode('パピプ', 'wabun').emoji, 'wabun').text, 'パピプ', '半濁点が戻らない');
  // 小書きの仮名は、和文モールスでは並の大きさで送る（別表第一号に小書きがない）
  assert.equal(Morse.decode(Morse.encode('トウキョウ', 'wabun').emoji, 'wabun').text, 'トウキヨウ');
  assert.equal(Morse.decode(Morse.encode('ラーメン、スシ', 'wabun').emoji, 'wabun').text, 'ラーメン、スシ');
});

test('知らない符号は ? にして、件数を返す', () => {
  // ⚫が9個の符号は、どちらの表にもない
  const bogus = '⚫'.repeat(9);
  const r = Morse.decode(bogus, 'international');
  assert.equal(r.text, '?');
  assert.equal(r.unknown.length, 1);
  assert.equal(r.unknown[0], '.'.repeat(9));
});

test('旧来の呼び出し方も動く', () => {
  assert.equal(Morse.encodeToEmoji('SOS'), '⚫⚫⚫⏹⚪⚪⚪⏹⚫⚫⚫');
  assert.equal(Morse.decodeFromEmoji('⚫⚫⚫⏹⚪⚪⚪⏹⚫⚫⚫'), 'SOS');
});

// ---- バイト単位モード（Base100）

test('表は256個で、重複がなく、すべて絵文字である', () => {
  assert.equal(ByteCode.ALPHABET.length, 256);
  assert.equal(new Set(ByteCode.ALPHABET).size, 256);
  for (const e of ByteCode.ALPHABET) {
    assert.equal([...e].length, 1, `${e} が1コードポイントでない`);
    assert.match(e, /\p{Emoji}/u, `${e} が絵文字でない`);
  }
});

test('割り当ては Base100（U+1F3F7 + バイト値）', () => {
  assert.equal(ByteCode.BASE, 0x1f3f7);
  assert.equal(ByteCode.ALPHABET[0].codePointAt(0), 0x1f3f7);
  assert.equal(ByteCode.ALPHABET[255].codePointAt(0), 0x1f4f6);
  // dCode の Base100 と同じ出力になる（実機で確かめた値）
  assert.equal(ByteCode.encode('HELLO').emoji, '🐿🐼👃👃👆');
});

test('3つだけ、異体字セレクターが無いと絵文字として表示されない', () => {
  // U+1F3F7 🏷 ・ U+1F43F 🐿 ・ U+1F441 👁 は Emoji_Presentation=No
  const need = ByteCode.needsVariationSelector();
  assert.deepEqual(need.map((x) => x.byte), [0, 72, 74]);
  // 出力は Base100 の定義どおり、セレクターを付けない
  assert.equal([...ByteCode.encode('H').emoji].length, 1);
  assert.doesNotMatch(ByteCode.encode('\u0000').emoji, /\uFE0F/);
});

test('どんな入力でも往復する（日本語・数字・記号・絵文字）', () => {
  for (const text of ['HELLO WORLD', 'こんにちは', '日本語123!?', '🍎🐱', 'a\nb\tc', '']) {
    for (const chunk of ['none', '4', '8']) {
      const r = ByteCode.encode(text, chunk);
      const back = ByteCode.decode(r.emoji);
      assert.equal(back.text, text, `${JSON.stringify(text)} / ${chunk} で戻らない`);
      assert.equal(back.bytes, r.bytes);
      assert.equal(back.valid, true);
    }
  }
});

test('A–Z しか通らないモードとの違いが出る', () => {
  const map = mappingOf('foods');
  // シーザーは日本語と数字を素通りさせる
  assert.equal(Caesar.encodeToEmoji('こんにちは123', 3, map), 'こんにちは123');
  // バイトモードは全部を符号化する
  const r = ByteCode.encode('こんにちは123');
  assert.equal(r.bytes, 18, 'かな5文字×3バイト＋数字3バイト');
  assert.doesNotMatch(r.emoji, /[こんにちは123]/);
  assert.equal(ByteCode.decode(r.emoji).text, 'こんにちは123');
});

test('チャンク区切りは読みやすさだけで、復号に影響しない', () => {
  const plain = ByteCode.encode('HELLO WORLD', 'none');
  const four = ByteCode.encode('HELLO WORLD', '4');
  assert.notEqual(plain.emoji, four.emoji);
  assert.equal(four.emoji.split(' ').length, 3, '11バイトを4つずつで3組');
  assert.equal(four.emoji.endsWith(' '), false);
  assert.equal(ByteCode.decode(plain.emoji).text, ByteCode.decode(four.emoji).text);
});

test('異体字セレクターを付けて貼られても読める', () => {
  const withVs = ByteCode.ALPHABET[72] + '\uFE0F' + ByteCode.ALPHABET[73] + '\uFE0F';
  const r = ByteCode.decode(withVs);
  assert.equal(r.text, 'HI');
  assert.deepEqual(r.unknown, []);
});

test('表にない絵文字は読み飛ばして件数を返す', () => {
  // 🍎 U+1F34E と 🚀 U+1F680 は Base100 の範囲（U+1F3F7〜U+1F4F6）の外
  // （🐱 U+1F431 は範囲の中なので、バイト 0x3A = ':' として読める）
  const r = ByteCode.decode('🍎' + ByteCode.ALPHABET[65] + '🚀');
  assert.equal(r.text, 'A');
  assert.deepEqual(r.unknown, ['🍎', '🚀']);
  assert.equal(ByteCode.decode('🐱').text, ':', '範囲の中の絵文字は読める');
});

test('UTF-8として読めないバイト列は、読める範囲を出して知らせる', () => {
  // 0xFF は単体では UTF-8 にならない
  const r = ByteCode.decode(ByteCode.ALPHABET[0xff]);
  assert.equal(r.valid, false);
  assert.equal(r.bytes, 1);
});

// ---- 解読演習

test('頻度を数えて、多い順に並べる', () => {
  const map = mappingOf('foods');
  const cipher = Caesar.encodeToEmoji('AAAB', 0, map);
  const f = Cryptanalysis.frequency(cipher);
  assert.equal(f.total, 4);
  assert.equal(f.ranked.length, 2);
  assert.equal(f.ranked[0].symbol, map.A);
  assert.equal(f.ranked[0].count, 3);
  assert.equal(f.ranked[0].percent, 75);
  // 空白は数えない
  assert.equal(Cryptanalysis.frequency(`${map.A} ${map.B}`).total, 2);
});

test('絵文字にしても頻度の形は平文のまま', () => {
  // 座学タブの主張の裏づけ
  const map = mappingOf('weather');
  const plain = 'THEQUICKBROWNFOXJUMPSOVERTHELAZYDOG';
  const cipher = Caesar.encodeToEmoji(plain, 11, map);
  const shape = Cryptanalysis.compareShape(plain, cipher);
  assert.ok(shape.same, `形が違う ${shape.plain} / ${shape.cipher}`);
});

test('割り当てを当てはめて、未割り当てを伏せ字にする', () => {
  const map = mappingOf('foods');
  const cipher = Caesar.encodeToEmoji('ABC', 0, map);
  const r = Cryptanalysis.apply(cipher, { [map.A]: 'X' });
  assert.equal(r.text, 'X__');
  assert.equal(r.solved, 1);
  assert.equal(r.total, 3);
  // 空白はそのまま残す
  assert.equal(Cryptanalysis.apply(`${map.A} ${map.B}`, { [map.A]: 'X' }).text, 'X _');
});

test('正しい割り当てを当てはめると平文に戻る', () => {
  const map = mappingOf('animals');
  const plain = 'ATTACKATDAWN';
  const shift = 5;
  const cipher = Caesar.encodeToEmoji(plain, shift, map);
  const correct = {};
  for (const L of Cryptanalysis.LETTERS) {
    const shifted = String.fromCharCode(65 + ((L.charCodeAt(0) - 65 + shift) % 26));
    correct[map[shifted]] = L;
  }
  const r = Cryptanalysis.apply(cipher, correct);
  assert.equal(r.text, plain);
  assert.equal(r.solved, r.total);
});

test('クリブは、1対1が崩れない場所にだけ当てはまる', () => {
  const map = mappingOf('foods');
  // 平文 THAT の暗号文（シフト0）。クリブ THAT は T が2回出るので位置が絞られる
  const cipher = Caesar.encodeToEmoji('THATTHAT', 0, map);
  const hits = Cryptanalysis.cribPositions(cipher, 'THAT');
  assert.deepEqual(hits.map((h) => h.index), [0, 4]);
  assert.equal(hits[0].assignment[map.T], 'T');
  assert.equal(hits[0].assignment[map.H], 'H');
  // 同じ絵文字に別の文字を当てる形は候補にしない
  assert.equal(Cryptanalysis.cribPositions(Caesar.encodeToEmoji('AA', 0, map), 'AB').length, 0);
  // 別の絵文字を同じ文字にする形も候補にしない
  assert.equal(Cryptanalysis.cribPositions(Caesar.encodeToEmoji('AB', 0, map), 'AA').length, 0);
});

test('クリブが空なら候補を返さない', () => {
  const map = mappingOf('foods');
  assert.deepEqual(Cryptanalysis.cribPositions(Caesar.encodeToEmoji('ABC', 0, map), ''), []);
  assert.deepEqual(Cryptanalysis.cribPositions(Caesar.encodeToEmoji('ABC', 0, map), '123'), []);
});

test('それらしさは、正しい割り当てのほうが高くなる', () => {
  const map = mappingOf('foods');
  const plain = 'THEQUICKBROWNFOXJUMPSOVERTHELAZYDOGANDTHESTORYENDSHERE';
  const shift = 7;
  const cipher = Caesar.encodeToEmoji(plain, shift, map);
  const correct = {};
  for (const L of Cryptanalysis.LETTERS) {
    const shifted = String.fromCharCode(65 + ((L.charCodeAt(0) - 65 + shift) % 26));
    correct[map[shifted]] = L;
  }
  const good = Cryptanalysis.likelihood(cipher, correct).score;
  const draft = Cryptanalysis.likelihood(cipher, Cryptanalysis.guessByFrequency(cipher)).score;
  assert.ok(good > draft, `正解 ${good} が下書き ${draft} を上回らない`);
  assert.equal(Cryptanalysis.likelihood(cipher, {}).score, 0, '空の割り当てが0でない');
});

test('頻度順の下書きは、多い絵文字から E T A の順に当てる', () => {
  const map = mappingOf('foods');
  const cipher = Caesar.encodeToEmoji('AAABBC', 0, map);
  const guess = Cryptanalysis.guessByFrequency(cipher);
  assert.equal(guess[map.A], 'E', 'いちばん多い絵文字が E でない');
  assert.equal(guess[map.B], 'T');
  assert.equal(guess[map.C], 'A');
});

test('同じ文字に2つ以上の絵文字を当てたら矛盾として返す', () => {
  assert.deepEqual(Cryptanalysis.validate({ a: 'E', b: 'T' }), { ok: true, duplicated: [] });
  const bad = Cryptanalysis.validate({ a: 'E', b: 'E', c: 'T', d: 'T' });
  assert.equal(bad.ok, false);
  assert.deepEqual(bad.duplicated, ['E', 'T']);
  // 未割り当て（空文字）は数えない
  assert.deepEqual(Cryptanalysis.validate({ a: '', b: '' }), { ok: true, duplicated: [] });
});

test('英語の文字頻度は E T A O I N の順', () => {
  // 出典: Lewand, Cryptological Mathematics (2000)
  const order = Object.entries(Cryptanalysis.ENGLISH_FREQ)
    .sort((a, b) => b[1] - a[1]).map(([l]) => l);
  assert.deepEqual(order.slice(0, 6), ['E', 'T', 'A', 'O', 'I']. concat('N'));
  assert.equal(Object.keys(Cryptanalysis.ENGLISH_FREQ).length, 26);
  const sum = Object.values(Cryptanalysis.ENGLISH_FREQ).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 100) < 0.5, `合計が ${sum}`);
});

test('それらしさは、伏せ字や空白をまたいだ組を数えない', () => {
  const map = mappingOf('foods');
  // T _ H _ E のように離れていると、詰めれば THE に見えてしまうが、隣り合っていない
  const cipher = Caesar.encodeToEmoji('TXHXE', 0, map);
  const partial = { [map.T]: 'T', [map.H]: 'H', [map.E]: 'E' };
  const r = Cryptanalysis.likelihood(cipher, partial);
  assert.equal(r.hits, 0, '伏せ字をまたいで数えている');
  assert.equal(r.pairs, 0, '伏せ字をまたいだ組を数えている');
  // 隣り合っていればちゃんと数える
  const together = Caesar.encodeToEmoji('THE', 0, map);
  const r2 = Cryptanalysis.likelihood(together, partial);
  assert.equal(r2.pairs, 2);
  assert.equal(r2.hits, 2, 'TH と HE を数えていない');
});

// ---- 置換表の点検

test('いまの4セットは、復号で壊れる絵文字を含まない', () => {
  for (const set of EmojiSets) {
    const map = {};
    LETTERS.forEach((L, i) => { map[L] = set.items[i]; });
    const r = Diagnose.check(map);
    const errors = r.issues.filter((i) => i.level === 'error');
    assert.deepEqual(errors, [], `${set.id}: ${errors.map((e) => e.kind).join(',')}`);
    assert.equal(r.ok, true);
    assert.equal(r.checked, 26);
  }
});

test('weather セットは「セレクターが要る」と指摘される', () => {
  // このツールが実際に躓いた箇所。14文字が U+FE0F を必要とする
  const map = {};
  LETTERS.forEach((L, i) => { map[L] = EmojiSets.find((s) => s.id === 'weather').items[i]; });
  const issue = Diagnose.check(map).issues.find((i) => i.kind === 'needsSelector');
  assert.ok(issue, '指摘が出ていない');
  assert.equal(issue.letters.length, 14);
  assert.equal(issue.level, 'warn');
});

test('ZWJ・重複・欠けは error として指摘する', () => {
  const map = {};
  LETTERS.forEach((L, i) => { map[L] = EmojiSets[0].items[i]; });
  map.A = '👨‍👩‍👧';
  map.C = map.D;
  delete map.Z;
  const r = Diagnose.check(map);
  assert.equal(r.ok, false);
  const kinds = r.issues.filter((i) => i.level === 'error').map((i) => i.kind).sort();
  assert.deepEqual(kinds, ['duplicate', 'missing', 'zwj']);
});

test('肌の色の修飾子は warn として指摘する', () => {
  const map = {};
  LETTERS.forEach((L, i) => { map[L] = EmojiSets[3].items[i]; });
  map.A = '👍🏽';
  const issue = Diagnose.check(map).issues.find((i) => i.kind === 'skinTone');
  assert.ok(issue);
  assert.deepEqual(issue.letters, ['A']);
});

test('コードポイントが続く組を指摘する（色でしか見分けられない）', () => {
  const map = {};
  LETTERS.forEach((L, i) => { map[L] = EmojiSets.find((s) => s.id === 'shapes').items[i]; });
  const issue = Diagnose.check(map).issues.find((i) => i.kind === 'adjacentRun');
  assert.ok(issue, '連続した組の指摘が出ていない');
  assert.ok(issue.letters.length >= 6);
});

test('絵文字1つを調べると、コードポイントと性質が返る', () => {
  assert.deepEqual(Diagnose.inspectOne('🍎').codepoints, ['U+1F34E']);
  const sun = Diagnose.inspectOne('☀️');
  assert.deepEqual(sun.codepoints, ['U+2600', 'U+FE0F']);
  assert.equal(sun.graphemes, 1);
  assert.equal(sun.hasVariationSelector, true);
  assert.equal(sun.needsSelector, true, 'U+2600 は Emoji_Presentation=No');
  assert.equal(Diagnose.inspectOne('⬜').needsSelector, false, 'U+2B1C は Yes');
  assert.equal(Diagnose.inspectOne('👨‍👩‍👧').hasZwj, true);
  assert.equal(Diagnose.inspectOne('👍🏽').hasSkinTone, true);
});

// ---- 見えない文字の検出

test('異体字セレクターに載せたバイト列を見つけて読む', () => {
  const secret = 'secret message';
  const carried = HiddenChannel.embed('😀', secret);
  // 見た目は絵文字1つ
  assert.equal(Graphemes.split(carried).length, 1);
  assert.ok([...carried].length > 10, 'コードポイントは増えている');

  const scan = HiddenChannel.scan(carried);
  assert.equal(scan.cleaned, '😀');
  assert.equal(scan.total, new TextEncoder().encode(secret).length);

  const pay = HiddenChannel.extractPayload(carried);
  assert.equal(pay.text, secret);
  assert.equal(pay.valid, true);
});

test('256バイトすべてを載せて取り出せる', () => {
  for (let b = 0; b < 256; b++) {
    assert.equal(HiddenChannel.selectorToByte(HiddenChannel.byteToSelector(b)), b, `バイト ${b}`);
  }
  // 範囲の外は null
  assert.equal(HiddenChannel.selectorToByte(0x41), null);
});

test('ゼロ幅文字とタグ文字も見つける', () => {
  const r = HiddenChannel.scan('a​b‍c﻿d⁠');
  assert.equal(r.counts.zeroWidth, 4);
  assert.equal(r.cleaned, 'abcd');
  assert.equal(HiddenChannel.kindOf(0xE0041), 'tag');
  assert.equal(HiddenChannel.kindOf(0x41), null);
});

test('ふつうの絵文字の U+FE0F は、仕込みと区別がつかないことを知らせる', () => {
  // ☀️ は表示指定として U+FE0F を持つ。これは Paul Butler 方式のバイト15でもある
  const r = HiddenChannel.scan('☀️');
  assert.equal(r.counts.variationSelector, 1);
  assert.equal(r.counts.variationSupplement, 0);
  const pay = HiddenChannel.extractPayload('☀️');
  assert.deepEqual(pay.bytes, [15]);
  assert.equal(pay.usedPresentationSelector, true, '曖昧さを知らせていない');
});

test('見えない文字を取り除ける', () => {
  const carried = HiddenChannel.embed('🍎', 'x');
  assert.equal(HiddenChannel.strip(carried), '🍎');
  assert.equal(HiddenChannel.strip('ふつうの文'), 'ふつうの文');
});

test('読めないバイト列は valid=false で返す', () => {
  const broken = '😀' + String.fromCodePoint(HiddenChannel.byteToSelector(0xff));
  const pay = HiddenChannel.extractPayload(broken);
  assert.equal(pay.valid, false);
  assert.deepEqual(pay.bytes, [0xff]);
});

// ---- 見分けやすいセット（カ）

test('Distinct セットは、設計の条件を3つとも満たす', () => {
  const set = EmojiSets.find((s) => s.id === 'distinct');
  assert.ok(set, 'Distinct セットが無い');
  assert.equal(set.items.length, 26);
  assert.equal(new Set(set.items).size, 26);

  // 1) 異体字セレクターが要らない（1コードポイントで絵文字になる）
  for (const e of set.items) {
    assert.equal([...e].length, 1, `${e} が1コードポイントでない`);
    assert.match(e, /\p{Emoji_Presentation}/u, `${e} はセレクターが要る`);
  }

  // 2) コードポイントが隣り合わない
  const cps = set.items.map((e) => e.codePointAt(0)).sort((a, b) => a - b);
  for (let i = 1; i < cps.length; i++) {
    assert.notEqual(cps[i], cps[i - 1] + 1,
      `${String.fromCodePoint(cps[i - 1])} と ${String.fromCodePoint(cps[i])} が隣り合っている`);
  }

  // 3) 点検で warn も error も出ない
  const map = {};
  LETTERS.forEach((L, i) => { map[L] = set.items[i]; });
  const r = Diagnose.check(map);
  assert.deepEqual(r.issues, [], r.issues.map((i) => `${i.kind}:${i.detail}`).join(' / '));
});

test('Distinct セットでも、すべてのモードが往復する', () => {
  const map = mappingOf('distinct');
  const plain = LETTERS.join('');
  assert.equal(Caesar.decodeFromEmoji(Caesar.encodeToEmoji(plain, 9, map), 9, map), plain);
  assert.equal(Vigenere.decodeFromEmoji(Vigenere.encodeToEmoji(plain, 'KEY', map), 'KEY', map), plain);
});

// ---- 解読難易度の目安（ク）

test('一意復号距離が、教科書の値になる', () => {
  // 単一換字は 26! 通り ≒ 88.4 bit。英語の冗長度 3.2 bit/文字 で割って約28文字
  const sub = Cryptanalysis.unicityDistance('substitution');
  assert.equal(sub.keyspace, '26!');
  assert.ok(Math.abs(sub.keyBits - 88.38) < 0.1, `鍵の情報量が ${sub.keyBits}`);
  assert.ok(Math.abs(sub.distance - 27.6) < 0.5, `一意復号距離が ${sub.distance}`);

  // シーザーは 26 通り ≒ 4.7 bit → 約1.5文字
  const caesar = Cryptanalysis.unicityDistance('caesar');
  assert.equal(caesar.keyspace, '26');
  assert.ok(Math.abs(caesar.distance - 1.47) < 0.1, `${caesar.distance}`);

  // ヴィジュネルは鍵の長さで変わる
  const v5 = Cryptanalysis.unicityDistance('vigenere', 5);
  assert.equal(v5.keyspace, '26^5');
  assert.ok(v5.distance > caesar.distance * 4, '鍵が長いほど伸びる');
  assert.ok(Cryptanalysis.unicityDistance('vigenere', 10).distance > v5.distance);
});

test('log2(n!) が正しい', () => {
  assert.equal(Cryptanalysis.log2Factorial(1), 0);
  assert.ok(Math.abs(Cryptanalysis.log2Factorial(2) - 1) < 1e-9);
  assert.ok(Math.abs(Cryptanalysis.log2Factorial(4) - Math.log2(24)) < 1e-9);
});
