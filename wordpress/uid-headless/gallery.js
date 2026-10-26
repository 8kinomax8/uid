(() => {
 const list = document.querySelector('#uid-gallery-list');
 const input = document.querySelector('#uid-gallery-ids');
 const add = document.querySelector('#uid-gallery-add');
 if (!list || !input || !add) return;
 const sync = () => { input.value = [...list.children].map(item => item.dataset.id).join(','); };
 list.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  const item = button.closest('li');
  if (button.hasAttribute('data-remove')) item.remove();
  else if (button.dataset.move === '-1' && item.previousElementSibling) list.insertBefore(item, item.previousElementSibling);
  else if (button.dataset.move === '1' && item.nextElementSibling) list.insertBefore(item.nextElementSibling, item);
  sync();
 });
 add.addEventListener('click', () => {
  const frame = wp.media({title:'Photos de l’événement', library:{type:'image'}, multiple:true, button:{text:'Ajouter'}});
  frame.on('select', () => {
   frame.state().get('selection').toJSON().forEach(media => {
    if ([...list.children].some(item => Number(item.dataset.id) === media.id)) return;
    const item = document.createElement('li'); item.dataset.id = String(media.id);
    const img = document.createElement('img'); img.src = media.sizes?.thumbnail?.url ?? media.url; img.alt = media.alt ?? ''; img.width = 100; item.append(img);
    for (const [label, move] of [['↑','-1'], ['↓','1'], ['Retirer',null]]) {
     const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
     if (move) { button.dataset.move = move; button.setAttribute('aria-label', move === '-1' ? 'Déplacer avant' : 'Déplacer après'); }
     else button.dataset.remove = '';
     item.append(button);
    }
    list.append(item);
   });
   sync();
  });
  frame.open();
 });
})();
