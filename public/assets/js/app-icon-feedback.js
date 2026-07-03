(function(){
  function label(button){return button?.querySelector('.app-icon-copy strong')?.textContent?.trim()||'Icon'}
  function toast(text){
    let node=document.getElementById('appIconAutoSaveToast');
    if(!node){node=document.createElement('div');node.id='appIconAutoSaveToast';node.className='app-icon-toast';document.body.appendChild(node)}
    node.innerHTML='<strong>Autosaved</strong><span>'+text+'</span>';
    node.classList.remove('is-visible');
    requestAnimationFrame(()=>node.classList.add('is-visible'));
    clearTimeout(toast.timer);
    toast.timer=setTimeout(()=>node.classList.remove('is-visible'),2400);
  }
  document.addEventListener('click',function(event){
    const button=event.target.closest('[data-app-icon-choice]');
    if(!button)return;
    button.classList.remove('is-tapping');
    void button.offsetWidth;
    button.classList.add('is-tapping');
    setTimeout(()=>button.classList.remove('is-tapping'),520);
    if(window.EvaraosAppIcons)return;
    setTimeout(()=>toast(label(button)+' selected'),80);
  },true);
})();