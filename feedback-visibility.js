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

  function feedbackClientId(){
    const key='irishAcademicFeedbackClient';
    let id='';
    try{id=localStorage.getItem(key)||''}catch(_){}
    if(!id){
      id=(globalThis.crypto?.randomUUID?.()||('client-'+Date.now()+'-'+Math.random().toString(36).slice(2)));
      try{localStorage.setItem(key,id)}catch(_){}
    }
    return id;
  }

  // The deployed V3 webSubmitFeedback() predates the standalone GitHub frontend
  // and expects type/comment/recordId/recordName/recordKind/clientId. PublicApi.gs
  // forwards its payload unchanged, so send both the original V3 field names and
  // the newer standalone field names for backward/forward compatibility.
  if(typeof s3SubmitFeedback==='function'){
    s3SubmitFeedback=async function(form){
      const id=form.dataset.feedbackId;
      const x=find(id);
      const status=document.getElementById('feedbackStatus');
      const type=document.getElementById('feedbackType')?.value||'';
      const message=(document.getElementById('feedbackMessage')?.value||'').trim();
      if(!x||!type||!message)return;
      if(!C.API_BASE_URL){if(status)status.textContent='Feedback endpoint is unavailable.';return}

      if(status)status.textContent='Sending…';
      const recordKind=typeLabel(x.kind);
      const pageUrl=s3DirectUrl(x);
      const payload={
        // Original deployed V3 feedback schema.
        type:type,
        comment:message,
        recordId:x.id,
        recordName:x.name,
        recordKind:recordKind,
        pageUrl:pageUrl,
        clientId:feedbackClientId(),

        // Standalone/public bridge schema retained for compatibility and audit context.
        id:x.id,
        opportunityId:x.id,
        kind:x.kind,
        opportunityType:recordKind,
        opportunityName:x.name,
        title:x.name,
        issueType:type,
        category:type,
        message:message,
        details:message,
        sourceUrl:x.url||'',
        submittedAt:new Date().toISOString()
      };

      try{
        await fetch(C.API_BASE_URL,{
          method:'POST',
          mode:'no-cors',
          cache:'no-store',
          keepalive:true,
          headers:{'Content-Type':'text/plain;charset=UTF-8'},
          body:JSON.stringify({action:'feedback',payload:payload})
        });
        if(status)status.textContent='Report submitted for review.';
        form.reset();
      }catch(error){
        console.warn('Feedback submission failed',error);
        if(status)status.textContent='Could not send this report. Please try again.';
      }
    };
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
