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
async function loadEmojiSets(){
  const res = await fetch('data/emoji_sets.json');
  const json = await res.json();
  // 配列をオブジェクトに変換（id をキーに）
  State.emojiSets = json.reduce((a,s)=> (a[s.id]=s, a), {});

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
function switchTab(tab){
  // タブボタンのアクティブ状態を更新
  document.querySelectorAll('.tab').forEach(b=>{
    b.classList.toggle('active', b.dataset.tab===tab);
    b.setAttribute('aria-selected', b.dataset.tab===tab ? 'true' : 'false');
  });
  // タブパネルの表示/非表示を切り替え
  document.querySelectorAll('.tab-panel').forEach(p=>{
    p.classList.toggle('active', p.id === `tab-${tab}`);
  });
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
          <span class="help-icon" data-tooltip="${t('mode.shift_help')}">?</span>
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
          <span class="help-icon" data-tooltip="${t('mode.key_help')}">?</span>
        </label>
        <input id="opt-key" type="text" value="LEMON"/>
      </div>`;
  }
  // Morse: 追加オプションなし
  else if(mode==='morse'){
    // No additional options for Morse mode
  }
  // Binary: チャンク区切り選択
  else if(mode==='binary'){
    container.innerHTML = `
      <div class="row">
        <label for="opt-bin-chunk">
          <span data-i18n="mode.bin_chunk">チャンク区切り</span>
          <span class="help-icon" data-tooltip="${t('mode.bin_chunk_help')}">?</span>
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
          <span class="help-icon" data-tooltip="${t('mode.hex_chunk_help')}">?</span>
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
      State.mapping26 = JSON.parse(saved);
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
function normalizeInput(str){
  if(EL('uppercase').checked) str = str.toUpperCase();        // 大文字化
  if(!EL('keep-spaces').checked) str = str.replace(/\s+/g,''); // スペース削除
  if(!EL('keep-punct').checked) str = str.replace(/[^A-Z0-9\s]/g,''); // 記号削除
  return str.normalize('NFC'); // Unicode正規化
}

/* ============================================
 * エンコード/デコード処理
 * ============================================ */

/**
 * 現在のモードとオプションに応じてエンコード実行
 */
function encodeCurrent(){
  const mode = State.currentMode;
  const input = EL('input').value;
  const set = State.mapping26;
  let out='', hint='';

  if(mode==='caesar'){
    const shift = parseInt(EL('opt-shift').value||'0',10)%26;
    out = Caesar.encodeToEmoji(normalizeInput(input), shift, set);
    hint = `Caesar / shift=${shift}`;
  }else if(mode==='vigenere'){
    const key = (EL('opt-key').value||'').replace(/[^A-Za-z]/g,'').toUpperCase();
    out = Vigenere.encodeToEmoji(normalizeInput(input), key, set);
    hint = `Vigenère / key=${key}`;
  }else if(mode==='morse'){
    out = Morse.encodeToEmoji(normalizeInput(input));
    hint = `Morse to Emoji（⚫=dot, ⚪=dash）`;
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
    const shift = parseInt(EL('opt-shift').value||'0',10)%26;
    out = Caesar.decodeFromEmoji(input, shift, set);
    hint = `Decode Caesar / shift=${shift}`;
  }else if(mode==='vigenere'){
    const key = (EL('opt-key').value||'').replace(/[^A-Za-z]/g,'').toUpperCase();
    out = Vigenere.decodeFromEmoji(input, key, set);
    hint = `Decode Vigenère / key=${key}`;
  }else if(mode==='morse'){
    out = Morse.decodeFromEmoji(input);
    hint = `Emoji to Morse/Text`;
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
    // アクセシビリティのため aria-label 付与
    cell.innerHTML = `<span class="k">${k}</span><span class="v" aria-label="${k}">${v}</span>`;
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

  // モードごとに問題と正解を生成
  if(mode==='caesar'){
    const shift = 3; // 固定シフト値
    if(dir==='text-to-emoji'){
      question = Caesar.encodeToEmoji(pick, shift, State.mapping26);
      answer = pick;
    }else{
      question = pick;
      answer = Caesar.encodeToEmoji(pick, shift, State.mapping26);
    }
  }else if(mode==='vigenere'){
    const key = 'LEMON'; // 固定鍵
    if(dir==='text-to-emoji'){
      question = Vigenere.encodeToEmoji(pick, key, State.mapping26);
      answer = pick;
    }else{
      question = pick;
      answer = Vigenere.encodeToEmoji(pick, key, State.mapping26);
    }
  }else if(mode==='morse'){
    if(dir==='text-to-emoji'){
      question = Morse.encodeToEmoji(pick);
      answer = pick;
    }else{
      question = pick;
      answer = Morse.encodeToEmoji(pick);
    }
  }else if(mode==='binary'){
    if(dir==='text-to-emoji'){
      question = BinaryHex.encodeBinaryToEmoji(pick,'8');
      answer = pick;
    }else{
      question = pick;
      answer = BinaryHex.encodeBinaryToEmoji(pick,'8');
    }
  }else if(mode==='hex'){
    if(dir==='text-to-emoji'){
      question = BinaryHex.encodeHexToEmoji(pick,'2');
      answer = pick;
    }else{
      question = pick;
      answer = BinaryHex.encodeHexToEmoji(pick,'2');
    }
  }

  // UIに反映
  EL('practice-question').textContent = question;
  EL('practice-answer').value = '';
  EL('practice-answer').dataset.correct = answer; // 正解をデータ属性に保存
  EL('practice-result').textContent = '回答を入力して「判定」';
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
  EL('practice-result').textContent = ok ? '✅ 正解！' : `❌ 不正解。正解は：${correct}`;

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
  if(input && input.length<512) params.set('in', encodeURIComponent(input));

  // モード別パラメーター
  if(State.currentMode==='caesar'){
    params.set('shift', EL('opt-shift').value);
  }else if(State.currentMode==='vigenere'){
    params.set('key', (EL('opt-key').value||'').toUpperCase());
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
  const input = qs.get('in'); if(input) EL('input').value = decodeURIComponent(input);

  // モード別オプションを表示
  mountModeOptions();

  // モード別パラメーター
  if(mode==='caesar'){
    const sh = qs.get('shift'); if(sh) EL('opt-shift').value = sh;
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
document.addEventListener('DOMContentLoaded', async ()=>{
  // タブ切り替え
  document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.tab)));

  // 初期化処理
  await loadEmojiSets();
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

  // コピー機能
  EL('btn-copy-output').addEventListener('click', ()=>{
    navigator.clipboard.writeText(EL('output').value||'');
    showToast('✅ コピーしました');
  });
  EL('btn-share').addEventListener('click', updateShareURL);
  EL('btn-copy-url').addEventListener('click', ()=>{
    navigator.clipboard.writeText(EL('share-url').value||'');
    showToast('✅ URLをコピーしました');
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