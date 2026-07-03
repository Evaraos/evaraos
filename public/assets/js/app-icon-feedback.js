(function(){
  function toast(text){
    let node=document.getElementById('appIconAutoSaveToast');
    if(!node){node=document.createElement('div');node.id='appIconAutoSaveToast';node.className='app-icon-toast';document.body.appendChild(node);}
    node.textContent=text;
    node.classList.remove('is-visible');
    requestAnimationFrame(()=>node.classList.add('is-visible'));
    clearTimeout(toast.timer);
    toast.timer=setTimeout(()=>node.classList.remove('is-visible'),2200);
  }
  function selectedLabel(button){
    return button?.querySelector('.app-icon-copy strong')?.textContent?.trim() || 'Icon';
  }
  document.addEventListener('click',function(event){
    const button=event.target.closest('[data-app-icon-choice]');
    if(!button)return;
    button.classList.remove('is-tapping');
    void button.offsetWidth;
    button.classList.add('is-tapping');
    setTimeout(()=>button.classList.remove('is-tapping'),420);
    setTimeout(()=>toast('Autosaved: '+selectedLabel(button)),80);
  },true);
})();
