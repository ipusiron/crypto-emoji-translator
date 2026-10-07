/* ============================================
 * Main App Controller
 * メインアプリケーションコントローラー
 * ============================================ */

// DOM要素取得のヘルパー関数
const EL = id => document.getElementById(id);

// グローバル状態管理オブジェクト
const State = {
  emojiSets: {},                // 読み込んだ絵文字セット一覧（キー: id）
  currentSetId: null,           // 現在選択中の絵文字セットID
  currentMode: 'caesar',        // 現在の変換モード
  mapping26: null,              // 現在のA-Z→絵文字マッピング（{A:emoji,...}）
  practice: {                   // 練習モードの統計
    correct: 0,                 // 正答数
    total: 0,                   // 総出題数
    times: [],                  // 各問題の回答時間（ミリ秒）
    start: null                 // 現在の問題の開始時刻
  },
  currentLang: 'ja'             // 現在の表示言語
};

/* ============================================
 * 絵文字セット管理
 * ============================================ */

/**
 * 絵文字セットをJSONファイルから読み込み、UIに反映
 */
function loadEmojiSets(){
  // js/emoji-sets.js がスクリプトとして読み込む（fetch だと file:// で開けない）
  const sets = globalThis.EmojiSets || [];
  // 配列をオブジェクトに変換（id をキーに）
  State.emojiSets = sets.reduce((a,s)=> (a[s.id]=s, a), {});

  // セレクトボックスに選択肢を追加
  const sel = EL('emoji-set');
  sel.innerHTML = '';
  Object.values(State.emojiSets).forEach(set=>{
    const opt = document.createElement('option');
    opt.value = set.id;
    opt.textContent = `${set.name} (${set.items.length})`;
    sel.appendChild(opt);
  });

  // デフォルトで最初のセットを選択
  State.currentSetId = Object.keys(State.emojiSets)[0];
  sel.value = State.currentSetId;
  updatePreview();
  rebuildMappingFromSet();
}

/**
 * 絵文字セットのプレビューを更新（最初の12個を表示）
 */
function updatePreview(){
  const set = State.emojiSets[State.currentSetId];
  EL('emoji-preview').textContent = set.items.slice(0,12).join(' ') + (set.items.length>12?' …':'');
}

/**
 * 選択中の絵文字セットからA-Z→絵文字マッピングを構築
 */
function rebuildMappingFromSet(){
  const set = State.emojiSets[State.currentSetId];
  const items = set.items.slice(0,26); // 26個のみ使用
  const map = {};
  for(let i=0;i<26;i++){
    // A=65 から順に割り当て
    map[String.fromCharCode(65+i)] = items[i] || '❔';
  }
  State.mapping26 = map;
  renderVisualizerGrid(); // 対応表タブも更新
}

/* ============================================
 * タブナビゲーション
 * ============================================ */

/**
 * タブを切り替える
 * @param {string} tab - タブ名（transform, visualizer, practice, learn, settings）
 */
function switchTab(tab, focus){
  // タブボタンのアクティブ状態を更新
  document.querySelectorAll('.tab').forEach(b=>{
    const on = b.dataset.tab===tab;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
    // 選んでいるタブだけが Tab キーの順路に入る（WAI-ARIA の tabs パターン）
    b.setAttribute('tabindex', on ? '0' : '-1');
    if(on && focus) b.focus();
  });
  // タブパネルの表示/非表示を切り替え
  document.querySelectorAll('.tab-panel').forEach(p=>{
    p.classList.toggle('active', p.id === `tab-${tab}`);
  });
}

/**
 * タブを矢印キー・Home・End で動かす
 * @param {KeyboardEvent} e
 */
function onTabKeydown(e){
  const tabs = [...document.querySelectorAll('.tab')];
  const i = tabs.indexOf(e.currentTarget);
  if(i < 0) return;
  let next = null;
  if(e.key === 'ArrowRight') next = (i + 1) % tabs.length;
  else if(e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
  else if(e.key === 'Home') next = 0;
  else if(e.key === 'End') next = tabs.length - 1;
  if(next === null) return;
  e.preventDefault();
  switchTab(tabs[next].dataset.tab, true);
}

/* ============================================
 * モード別オプション UI
 * ============================================ */

/**
 * 選択されたモードに応じてオプションUIを動的生成
 */
function mountModeOptions(){
  const container = EL('mode-options');
  const mode = EL('mode').value;
  State.currentMode = mode;
  container.innerHTML = '';

  // モードに応じて絵文字セット選択の表示/非表示を切り替え
  const emojiSetRow = document.querySelector('.emoji-set-row');
  const needsEmojiSet = mode === 'caesar' || mode === 'vigenere';
  if(emojiSetRow) {
    emojiSetRow.style.display = needsEmojiSet ? 'flex' : 'none';
  }

  // Caesar: シフト値入力
  if(mode==='caesar'){
    container.innerHTML = `
      <div class="row">
        <label for="opt-shift">
          <span data-i18n="mode.shift">シフト</span>
          <button type="button" class="help-icon" aria-label="${t('ui.help')}" data-tooltip="${t('mode.shift_help')}">?</button>
        </label>
        <input id="opt-shift" type="number" min="0" max="25" value="3"/>
      </div>`;
  }
  // Vigenère: 鍵文字列入力
  else if(mode==='vigenere'){
    container.innerHTML = `
      <div class="row">
        <label for="opt-key">
          <span data-i18n="mode.key">鍵（英字）</span>
          <button type="button" class="help-icon" aria-label="${t('ui.help')}" data-tooltip="${t('mode.key_help')}">?</button>
        </label>
        <input id="opt-key" type="text" value="LEMON"/>
      </div>`;
  }
  // Morse: 符号表（欧文／和文）を選ぶ
  else if(mode==='morse'){
    container.innerHTML = `
      <div class="row">
        <label for="opt-morse-variant">
          <span data-i18n="mode.morse_variant">符号表</span>
          <button type="button" class="help-icon" aria-label="${t('ui.help')}" data-tooltip="${t('mode.morse_variant_help')}">?</button>
        </label>
        <select id="opt-morse-variant">
          <option value="international" data-i18n="mode.morse_intl">欧文（ITU-R M.1677-1）</option>
          <option value="wabun" data-i18n="mode.morse_wabun">和文（無線局運用規則 別表第一号）</option>
        </select>
      </div>`;
  }
  // Binary: チャンク区切り選択
  else if(mode==='binary'){
    container.innerHTML = `
      <div class="row">
        <label for="opt-bin-chunk">
          <span data-i18n="mode.bin_chunk">チャンク区切り</span>
          <button type="button" class="help-icon" aria-label="${t('ui.help')}" data-tooltip="${t('mode.bin_chunk_help')}">?</button>
        </label>
        <select id="opt-bin-chunk">
          <option value="8">8</option>
          <option value="4">4</option>
          <option value="none" data-i18n="mode.chunk_none">なし</option>
        </select>
      </div>`;
  }
  // Hex: チャンク区切り選択
  else if(mode==='hex'){
    container.innerHTML = `
      <div class="row">
        <label for="opt-hex-chunk">
          <span data-i18n="mode.hex_chunk">チャンク区切り</span>
          <button type="button" class="help-icon" aria-label="${t('ui.help')}" data-tooltip="${t('mode.hex_chunk_help')}">?</button>
        </label>
        <select id="opt-hex-chunk">
          <option value="2">2</option>
          <option value="none" data-i18n="mode.chunk_none">なし</option>
        </select>
      </div>`;
  }
  // Custom: localStorageから読み込み
  else if(mode==='custom'){
    container.innerHTML = `<div class="note" data-i18n="mode.custom_note">設定タブで作成した Custom Map を使用します（A–Z → 絵文字）。</div>`;
    const saved = localStorage.getItem('cet.custommap');
    if(saved){
      // 壊れた値が入っていても画面全体を止めない（custommap.js と同じ扱い）
      try{
        State.mapping26 = JSON.parse(saved);
      }catch(e){
        console.warn('Custom Map の読み込みに失敗したので、プリセットを使います:', e);
        rebuildMappingFromSet();
      }
      renderVisualizerGrid();
    }
  }

  // 動的生成された要素にも翻訳を適用
  applyTranslations();
}

/* ============================================
 * UI フィードバック
 * ============================================ */

/**
 * トースト通知を表示（3秒後に自動消去）
 * @param {string} message - 表示するメッセージ
 */
function showToast(message){
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  document.body.appendChild(toast);
  setTimeout(()=>{
    toast.remove();
  }, 3000);
}

/* ============================================
 * 入力正規化
 * ============================================ */

/**
 * 入力テキストをオプションに応じて正規化
 * @param {string} str - 入力文字列
 * @returns {string} 正規化された文字列
 */
/**
 * シフト量を 0–25 に収める
 * number入力には「-5」や空も入りうるので、負の数も NaN も吸収する
 * @param {string|number} value
 * @returns {number} 0–25
 */
function normalizeShift(value){
  const n = parseInt(value, 10);
  if(!Number.isFinite(n)) return 0;
  return ((n % 26) + 26) % 26;
}

/**
 * クリップボードへ書き、成否を知らせる
 * @param {string} text
 * @param {string} okMessage
 */
function copyText(text, okMessage){
  if(!navigator.clipboard){
    showToast(t('toast.copy_unavailable'));
    return;
  }
  navigator.clipboard.writeText(text)
    .then(()=> showToast(okMessage))
    .catch(()=> showToast(t('toast.copy_failed')));
}

function normalizeInput(str){
  if(EL('uppercase').checked) str = str.toUpperCase();        // 大文字化
  if(!EL('keep-spaces').checked) str = str.replace(/\s+/g,''); // スペース削除
  if(!EL('keep-punct').checked) str = str.replace(/[^A-Za-z0-9\s]/g,''); // 記号削除（大文字化OFFでも小文字を残す）
  return str.normalize('NFC'); // Unicode正規化
}

/* ============================================
 * エンコード/デコード処理
 * ============================================ */

/** いま選ばれているモールスの符号表 */
function morseVariant(){
  const el = document.getElementById('opt-morse-variant');
  return (el && el.value === 'wabun') ? 'wabun' : 'international';
}

/**
 * 符号表に無くて落とした文字を知らせる
 * 黙って消すと「変換できた」と誤解されるため
 * @param {string[]} dropped
 */
function noteDropped(dropped){
  if(!dropped || !dropped.length) return;
  const uniq = [...new Set(dropped)].slice(0, 12).join(' ');
  showToast(t('toast.morse_dropped', { chars: uniq, count: dropped.length }));
}

/**
 * 符号表に無かった符号を知らせる
 * @param {string[]} unknown
 */
function noteUnknown(unknown){
  if(!unknown || !unknown.length) return;
  showToast(t('toast.morse_unknown', { count: unknown.length }));
}

/**
 * 現在のモードとオプションに応じてエンコード実行
 */
function encodeCurrent(){
  const mode = State.currentMode;
  const input = EL('input').value;
  const set = State.mapping26;
  let out='', hint='';

  if(mode==='caesar'){
    const shift = normalizeShift(EL('opt-shift').value);
    out = Caesar.encodeToEmoji(normalizeInput(input), shift, set);
    hint = `Caesar / shift=${shift}`;
  }else if(mode==='vigenere'){
    const key = (EL('opt-key').value||'').replace(/[^A-Za-z]/g,'').toUpperCase();
    out = Vigenere.encodeToEmoji(normalizeInput(input), key, set);
    hint = `Vigenère / key=${key}`;
  }else if(mode==='morse'){
    const variant = morseVariant();
    // 和文は大文字化・記号削除の対象にしないので、整形せずそのまま渡す
    const src = (variant==='wabun') ? input : normalizeInput(input);
    const r = Morse.encode(src, variant);
    out = r.emoji;
    hint = t('hint.morse_encode', { variant: t(`mode.morse_${variant==='wabun'?'wabun':'intl'}`) });
    noteDropped(r.dropped);
  }else if(mode==='binary'){
    const chunk = EL('opt-bin-chunk').value;
    out = BinaryHex.encodeBinaryToEmoji(input, chunk);
    hint = `Binary to Emoji`;
  }else if(mode==='hex'){
    const chunk = EL('opt-hex-chunk').value;
    out = BinaryHex.encodeHexToEmoji(input, chunk);
    hint = `Hex to Emoji`;
  }else if(mode==='custom'){
    out = Caesar.encodeToEmoji(normalizeInput(input), 0, State.mapping26);
    hint = `Custom Map`;
  }
  EL('output').value = out;
  EL('hint-note').textContent = hint;
}

/**
 * 現在のモードとオプションに応じてデコード実行
 */
function decodeCurrent(){
  const mode = State.currentMode;
  const input = EL('input').value;
  const set = State.mapping26;
  let out='', hint='';

  if(mode==='caesar'){
    const shift = normalizeShift(EL('opt-shift').value);
    out = Caesar.decodeFromEmoji(input, shift, set);
    hint = `Decode Caesar / shift=${shift}`;
  }else if(mode==='vigenere'){
    const key = (EL('opt-key').value||'').replace(/[^A-Za-z]/g,'').toUpperCase();
    out = Vigenere.decodeFromEmoji(input, key, set);
    hint = `Decode Vigenère / key=${key}`;
  }else if(mode==='morse'){
    const variant = morseVariant();
    const r = Morse.decode(input, variant);
    out = r.text;
    hint = t('hint.morse_decode', { variant: t(`mode.morse_${variant==='wabun'?'wabun':'intl'}`) });
    noteUnknown(r.unknown);
  }else if(mode==='binary'){
    out = BinaryHex.decodeBinaryFromEmoji(input);
    hint = `Emoji to Binary → Text`;
  }else if(mode==='hex'){
    out = BinaryHex.decodeHexFromEmoji(input);
    hint = `Emoji to Hex → Text`;
  }else if(mode==='custom'){
    out = Caesar.decodeFromEmoji(input, 0, State.mapping26);
    hint = `Decode with Custom Map`;
  }
  EL('output').value = out;
  EL('hint-note').textContent = hint;
}

/* ============================================
 * 対応表タブ（Visualizer）
 * ============================================ */

/**
 * A-Z → 絵文字の対応表をグリッド表示
 */
function renderVisualizerGrid(){
  const grid = EL('mapping-grid');
  grid.innerHTML='';
  const entries = Object.entries(State.mapping26);

  entries.forEach(([k,v])=>{
    const cell = document.createElement('div');
    cell.className='cell';
    cell.dataset.letter = k;
    // 値は JSON インポート由来の任意の文字列なので、HTML として組み立てない
    const kEl = document.createElement('span');
    kEl.className = 'k';
    kEl.textContent = k;
    const vEl = document.createElement('span');
    vEl.className = 'v';
    vEl.setAttribute('aria-label', k);
    vEl.textContent = v;
    cell.append(kEl, vEl);
    grid.appendChild(cell);
  });
}

/**
 * 入力されたテキストに含まれる文字を対応表でハイライト
 */
function highlightVisualizer(){
  // 既存のハイライトを削除
  document.querySelectorAll('#mapping-grid .cell').forEach(c=>c.classList.remove('highlight'));

  const str = (EL('viz-input').value||'').toUpperCase();
  for(const ch of str){
    if(/[A-Z]/.test(ch)){
      const cell = document.querySelector(`#mapping-grid .cell[data-letter="${ch}"]`);
      if(cell) cell.classList.add('highlight');
    }
  }
}

/**
 * モールス符号の対応表を表示
 */
function renderMorseTable(){
  const tbl = EL('morse-table');
  tbl.innerHTML='';
  const entries = Object.entries(Morse.MAP);

  entries.forEach(([ch, code])=>{
    const cell = document.createElement('div');
    const emo = Morse.morseToEmoji(code);
    cell.className='cell';
    cell.innerHTML = `<div class="k">${ch}</div><div class="v">${emo}</div>`;
    tbl.appendChild(cell);
  });
}

/* ============================================
 * 練習タブ（Practice）
 * ============================================ */

/**
 * 新しい練習問題を生成
 */
function newPractice(){
  const dir = EL('practice-direction').value; // text-to-emoji or emoji-to-text
  const mode = EL('practice-mode').value;
  State.practice.start = Date.now(); // 開始時刻記録

  // 問題文のプール
  const messages = ['ATTACK AT DAWN','HELLO WORLD','CRYPTO EMOJI','SECURITY','KNOWLEDGE','FREQUENCY'];
  const pick = messages[Math.floor(Math.random()*messages.length)];
  let question='', answer='';

  // モードが絵文字セットを使う場合はマッピングを再構築
  rebuildMappingFromSet();

  // モードごとに絵文字へ変換する（鍵やシフトは練習用に固定）
  const toEmoji = {
    caesar: (s)=> Caesar.encodeToEmoji(s, 3, State.mapping26),
    vigenere: (s)=> Vigenere.encodeToEmoji(s, 'LEMON', State.mapping26),
    morse: (s)=> Morse.encodeToEmoji(s, 'international'),
    binary: (s)=> BinaryHex.encodeBinaryToEmoji(s, '8'),
    hex: (s)=> BinaryHex.encodeHexToEmoji(s, '2'),
  }[mode];
  const emoji = toEmoji ? toEmoji(pick) : pick;

  // ラベルどおりに出す。「テキスト → 絵文字」なら問題がテキストで、答えが絵文字
  question = (dir==='text-to-emoji') ? pick : emoji;
  answer   = (dir==='text-to-emoji') ? emoji : pick;

  // UIに反映
  EL('practice-question').textContent = question;
  EL('practice-answer').value = '';
  EL('practice-answer').dataset.correct = answer; // 正解をデータ属性に保存
  EL('practice-result').textContent = t('practice.prompt');
}

/**
 * 練習問題の回答を判定
 */
function checkPractice(){
  const given = EL('practice-answer').value.trim().toUpperCase();
  const correct = (EL('practice-answer').dataset.correct||'').trim().toUpperCase();
  const ok = given === correct;

  // 統計更新
  State.practice.total++;
  if(ok) State.practice.correct++;
  const dt = Date.now() - (State.practice.start||Date.now());
  State.practice.times.push(dt);

  // 結果表示
  EL('practice-result').textContent = ok ? t('practice.correct') : t('practice.incorrect') + correct;

  // 統計表示更新
  EL('stat-correct').textContent = State.practice.correct;
  EL('stat-total').textContent = State.practice.total;
  const acc = State.practice.total? Math.round(State.practice.correct/State.practice.total*100):0;
  EL('stat-acc').textContent = `${acc}%`;
  const avg = State.practice.times.length ? Math.round(State.practice.times.reduce((a,b)=>a+b,0)/State.practice.times.length) : 0;
  EL('stat-avg').textContent = avg ? `${(avg/1000).toFixed(2)}s` : '-';
}

/* ============================================
 * URL 共有機能
 * ============================================ */

/**
 * 現在の設定を含む共有URLを生成
 */
function updateShareURL(){
  const params = new URLSearchParams();

  // 共通パラメーター
  params.set('mode', EL('mode').value);
  params.set('set', EL('emoji-set').value);
  params.set('keepS', EL('keep-spaces').checked ? '1':'0');
  params.set('keepP', EL('keep-punct').checked ? '1':'0');
  params.set('up', EL('uppercase').checked ? '1':'0');

  // 入力テキスト（512文字未満のみ）
  const input = EL('input').value;
  // URLSearchParams が自分でエスケープするので、手でエスケープし直さない（二重になる）
  if(input && input.length<512) params.set('in', input);

  // モード別パラメーター
  if(State.currentMode==='caesar'){
    params.set('shift', EL('opt-shift').value);
  }else if(State.currentMode==='vigenere'){
    params.set('key', (EL('opt-key').value||'').toUpperCase());
  }else if(State.currentMode==='morse'){
    params.set('mvar', morseVariant());
  }else if(State.currentMode==='binary'){
    params.set('bchunk', EL('opt-bin-chunk').value);
  }else if(State.currentMode==='hex'){
    params.set('hchunk', EL('opt-hex-chunk').value);
  }

  const url = `${location.origin}${location.pathname}?${params.toString()}`;
  EL('share-url').value = url;
}

/**
 * URLパラメーターから設定を復元
 */
function applyParams(){
  const qs = new URLSearchParams(location.search);

  // モード設定
  const mode = qs.get('mode'); if(mode) EL('mode').value = mode;

  // 絵文字セット設定
  const set = qs.get('set');
  if(set && State.emojiSets[set]){
    EL('emoji-set').value=set;
    State.currentSetId=set;
    updatePreview();
    rebuildMappingFromSet();
  }

  // オプション設定
  const keepS = qs.get('keepS'); if(keepS) EL('keep-spaces').checked = keepS==='1';
  const keepP = qs.get('keepP'); if(keepP) EL('keep-punct').checked = keepP==='1';
  const up = qs.get('up'); if(up) EL('uppercase').checked = up==='1';
  const input = qs.get('in'); if(input) EL('input').value = input;

  // モード別オプションを表示
  mountModeOptions();

  // モード別パラメーター
  if(mode==='caesar'){
    const sh = qs.get('shift'); if(sh) EL('opt-shift').value = sh;
  }else if(mode==='morse'){
    const mv = qs.get('mvar');
    if(mv && EL('opt-morse-variant')) EL('opt-morse-variant').value = mv;
  }else if(mode==='vigenere'){
    const k = qs.get('key'); if(k) EL('opt-key').value = k;
  }else if(mode==='binary'){
    const b = qs.get('bchunk'); if(b) EL('opt-bin-chunk').value=b;
  }else if(mode==='hex'){
    const h = qs.get('hchunk'); if(h) EL('opt-hex-chunk').value=h;
  }
}

/* ============================================
 * イベントリスナー登録
 * ============================================ */
document.addEventListener('DOMContentLoaded', ()=>{
  // タブ切り替え
  document.querySelectorAll('.tab').forEach(b=>{
    b.addEventListener('click',()=>switchTab(b.dataset.tab));
    b.addEventListener('keydown', onTabKeydown);
  });

  // 初期化処理
  loadEmojiSets();
  renderMorseTable();
  mountModeOptions();
  applyParams(); // URLパラメーターがあれば復元

  // 変換タブのイベント
  EL('emoji-set').addEventListener('change', e=>{
    State.currentSetId = e.target.value;
    updatePreview();
    rebuildMappingFromSet();
  });
  EL('mode').addEventListener('change', mountModeOptions);
  EL('btn-encode').addEventListener('click', encodeCurrent);
  EL('btn-decode').addEventListener('click', decodeCurrent);
  EL('btn-clear').addEventListener('click', ()=>{
    EL('input').value='';
    EL('output').value='';
  });

  // コピー機能（失敗したら失敗したと知らせる）
  EL('btn-copy-output').addEventListener('click', ()=>{
    copyText(EL('output').value||'', t('toast.copied'));
  });
  EL('btn-share').addEventListener('click', updateShareURL);
  EL('btn-copy-url').addEventListener('click', ()=>{
    copyText(EL('share-url').value||'', t('toast.url_copied'));
  });

  // 対応表タブのイベント
  EL('viz-highlight').addEventListener('click', highlightVisualizer);

  // 練習タブのイベント
  EL('practice-new').addEventListener('click', newPractice);
  EL('practice-check').addEventListener('click', checkPractice);

  // テーマ設定
  EL('theme-default').addEventListener('change', ()=>{
    document.body.classList.remove('dark-mode', 'light-mode');
    localStorage.setItem('cet.theme', 'default');
  });
  EL('dark-mode').addEventListener('change', ()=>{
    document.body.classList.remove('light-mode');
    document.body.classList.add('dark-mode');
    localStorage.setItem('cet.theme', 'dark');
  });
  EL('light-mode').addEventListener('change', ()=>{
    document.body.classList.remove('dark-mode');
    document.body.classList.add('light-mode');
    localStorage.setItem('cet.theme', 'light');
  });

  // 保存されたテーマを読み込み
  const savedTheme = localStorage.getItem('cet.theme');
  if(savedTheme === 'dark'){
    EL('dark-mode').checked = true;
    document.body.classList.add('dark-mode');
  }else if(savedTheme === 'light'){
    EL('light-mode').checked = true;
    document.body.classList.add('light-mode');
  }

  // 言語設定
  EL('lang-ja').addEventListener('change', ()=>{
    State.currentLang = 'ja';
    localStorage.setItem('cet.lang', 'ja');
    applyTranslations();
  });
  EL('lang-en').addEventListener('change', ()=>{
    State.currentLang = 'en';
    localStorage.setItem('cet.lang', 'en');
    applyTranslations();
  });

  // 保存された言語を読み込み
  const savedLang = localStorage.getItem('cet.lang');
  if(savedLang === 'en'){
    EL('lang-en').checked = true;
    State.currentLang = 'en';
    applyTranslations();
  }

  // カスタムマップ初期化
  CustomMap.init();
});