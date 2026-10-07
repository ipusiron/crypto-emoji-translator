/* Custom Map Editor */
const CustomMap = (()=>{

  function init(){
    // build A-Z slots
    const slots = EL('alpha-slots');
    slots.innerHTML='';
    for(let i=0;i<26;i++){
      const ch = String.fromCharCode(65+i);
      const div = document.createElement('div');
      div.className='slot';
      div.dataset.letter = ch;
      div.innerHTML = `<span class="label">${ch}</span><div class="emoji">—</div>`;
      slots.appendChild(div);
    }

    // pool from current set
    rebuildPool();

    // drag & drop
    slots.querySelectorAll('.slot').forEach(slot=>{
      const e = slot.querySelector('.emoji');
      e.addEventListener('dragover', ev=>ev.preventDefault());
      e.addEventListener('drop', onDropToSlot);
      e.addEventListener('dragenter', ()=>slot.classList.add('drag-over'));
      e.addEventListener('dragleave', ()=>slot.classList.remove('drag-over'));
    });

    EL('custom-save').addEventListener('click', save);
    EL('custom-reset').addEventListener('click', reset);
    EL('custom-export').addEventListener('click', exportJSON);
    EL('custom-import').addEventListener('click', importJSON);

    // load from localStorage if exists
    const saved = localStorage.getItem('cet.custommap');
    if(saved){
      try{
        const obj = JSON.parse(saved);
        applyMap(obj);
      }catch(e){}
    }
  }

  function rebuildPool(){
    const pool = EL('emoji-pool');
    pool.innerHTML='';
    const set = State.emojiSets[State.currentSetId];
    set.items.slice(0,26).forEach((emo,idx)=>{
      const it = document.createElement('div');
      it.className='item';
      it.textContent = emo;
      it.setAttribute('draggable','true');
      it.dataset.emoji = emo;
      it.addEventListener('dragstart', e=>{
        e.dataTransfer.setData('text/plain', emo);
        it.classList.add('dragging');
      });
      it.addEventListener('dragend', ()=>it.classList.remove('dragging'));
      pool.appendChild(it);
    });
  }

  function onDropToSlot(ev){
    ev.preventDefault();
    const slot = ev.currentTarget.closest('.slot');
    slot.classList.remove('drag-over');

    const emo = ev.dataTransfer.getData('text/plain');
    if(!emo) return;
    // check duplication
    const used = Array.from(document.querySelectorAll('#alpha-slots .emoji')).map(e=>e.textContent);
    if(used.includes(emo)){
      showStatus(t('custom.duplicate'), 'warning');
      return;
    }
    ev.currentTarget.textContent = emo;
    showStatus(t('custom.assigned'), 'success');
  }

  function showStatus(msg, type=''){
    const el = EL('custom-status');
    el.textContent = msg;
    el.className = 'note';
    if(type) el.classList.add(type);
  }

  function collect(){
    const map={};
    EL('alpha-slots').querySelectorAll('.slot').forEach(sl=>{
      const ch = sl.dataset.letter;
      const emo = sl.querySelector('.emoji').textContent;
      if(emo && emo !== '—') map[ch]=emo;
    });
    return map;
  }

  function validate(map){
    const letters = Array.from({length:26}, (_,i)=>String.fromCharCode(65+i));
    for(const L of letters){
      if(!map[L]) return t('custom.unassigned', { letter: L });
    }
    // duplication check
    const vals = Object.values(map);
    const uniq = new Set(vals);
    if(uniq.size !== vals.length) return t('custom.conflict');
    return null;
  }

  function save(){
    const map = collect();
    const err = validate(map);
    if(err){ showStatus(err, 'error'); return; }
    localStorage.setItem('cet.custommap', JSON.stringify(map));
    showStatus(t('custom.saved'), 'success');
    // use immediately
    State.mapping26 = map;
    renderVisualizerGrid();
  }

  function reset(){
    EL('alpha-slots').querySelectorAll('.emoji').forEach(e=>e.textContent='—');
    showStatus(t('custom.reset_done'), 'success');
  }

  function exportJSON(){
    const map = collect();
    const err = validate(map);
    if(err){ showStatus(err, 'error'); return; }
    const text = JSON.stringify(map);
    EL('custom-json').value = text;
    navigator.clipboard.writeText(text);
    showStatus(t('custom.json_copied'), 'success');
  }

  function importJSON(){
    const text = EL('custom-json').value.trim();
    try{
      const obj = JSON.parse(text);
      const err = validate(obj);
      if(err){ showStatus(err, 'error'); return; }
      applyMap(obj);
      localStorage.setItem('cet.custommap', JSON.stringify(obj));
      State.mapping26 = obj; renderVisualizerGrid();
      showStatus(t('custom.imported'), 'success');
    }catch(e){
      showStatus(t('custom.json_invalid'), 'error');
    }
  }

  function applyMap(map){
    EL('alpha-slots').querySelectorAll('.slot').forEach(sl=>{
      const ch = sl.dataset.letter;
      sl.querySelector('.emoji').textContent = map[ch] || '—';
    });
  }

  return { init, rebuildPool };
})();
