/* Prominent access to the existing Stage 3 anonymous feedback form. */
(function(){
  const dialogBody=document.getElementById('dbody');
  if(!dialogBody)return;

  function enhanceFeedback(){
    const box=dialogBody.querySelector('.feedback-box');
    if(!box)return;

    box.classList.add('feedback-prominent');

    // Put feedback before Related opportunities so it is not buried at the end
    // of a long detail view, especially on phones.
    const relatedHost=dialogBody.querySelector('#relatedHost');
    const relatedPanel=relatedHost?.closest('.detail-panel');
    if(relatedPanel&&box.nextElementSibling!==relatedPanel)relatedPanel.before(box);

    const actions=dialogBody.querySelector('.detail-actions-row');
    if(actions&&!actions.querySelector('[data-feedback-jump]')){
      const button=document.createElement('button');
      button.type='button';
      button.className='report-action';
      button.dataset.feedbackJump='true';
      button.textContent='Report / update';
      button.setAttribute('aria-label','Report a problem or suggest an update for this opportunity');
      button.addEventListener('click',()=>{
        const form=box.querySelector('.feedback-form');
        form?.classList.add('on');
        box.classList.add('feedback-open');
        box.scrollIntoView({behavior:'smooth',block:'center'});
        setTimeout(()=>box.querySelector('select')?.focus(),250);
      });
      actions.appendChild(button);
    }
  }

  new MutationObserver(enhanceFeedback).observe(dialogBody,{childList:true,subtree:true});
  document.addEventListener('click',event=>{
    if(event.target.closest('[data-feedback-toggle]')){
      const box=event.target.closest('.feedback-box');
      setTimeout(()=>box?.classList.toggle('feedback-open',box.querySelector('.feedback-form')?.classList.contains('on')),0);
    }
  });
  enhanceFeedback();
})();
