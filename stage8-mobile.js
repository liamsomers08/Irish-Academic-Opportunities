/* Stage 8: mobile progressive disclosure for search and filters. */
(function(){
  const byId=id=>document.getElementById(id);
  const mq=window.matchMedia('(max-width:600px)');
  const FILTER_IDS=[
    'typeFilter','schoolYear','subject','geography','costFilter','statusFilter','mode',
    'opportunityType','fundingType','awardBasis','entryRoute','deadline',
    'competitionTypeFilter','competitionFormatFilter','residentialFilter','financialNeedFilter'
  ];

  function activeFilterCount(){
    let count=0;
    if(byId('q')?.value.trim())count++;
    for(const id of FILTER_IDS){const el=byId(id);if(el?.value)count++}
    if(byId('sort')?.value&&byId('sort').value!=='relevance')count++;
    return count;
  }

  function syncRefineLabel(){
    const b=byId('mobileRefine');if(!b)return;
    const count=activeFilterCount();
    b.classList.toggle('has-active',count>0);
    const n=b.querySelector('.mobile-filter-count');if(n)n.textContent=String(count);
  }

  function ensureHeroSearch(){
    const form=byId('heroForm');if(!form||byId('mobileHeroSearchToggle'))return;
    const button=document.createElement('button');
    button.id='mobileHeroSearchToggle';button.className='mobile-search-toggle';button.type='button';
    button.setAttribute('aria-controls','heroForm');button.setAttribute('aria-expanded','false');
    button.appendChild(document.createTextNode('Search opportunities'));
    form.before(button);
    button.addEventListener('click',()=>{
      const open=!form.classList.contains('mobile-open');
      form.classList.toggle('mobile-open',open);button.setAttribute('aria-expanded',String(open));
      button.firstChild.textContent=open?'Hide search':'Search opportunities';
      if(open)setTimeout(()=>byId('heroSearch')?.focus(),30);
    });
  }

  function ensureRefine(){
    const row=document.querySelector('.search-row'),filters=document.querySelector('.filters');
    if(!row||!filters||byId('mobileRefine'))return;
    if(!filters.id)filters.id='mobileFilters';
    const button=document.createElement('button');
    button.id='mobileRefine';button.className='mobile-refine-toggle';button.type='button';
    button.setAttribute('aria-controls',filters.id);button.setAttribute('aria-expanded','false');
    button.innerHTML='<span>Filters & sort</span><span class="mobile-filter-count" aria-hidden="true">0</span>';
    const q=byId('q');if(q&&q.nextSibling)row.insertBefore(button,q.nextSibling);else row.appendChild(button);
    button.addEventListener('click',()=>{
      const open=!filters.classList.contains('mobile-open');
      filters.classList.toggle('mobile-open',open);row.classList.toggle('mobile-expanded',open);
      button.setAttribute('aria-expanded',String(open));
      const label=button.querySelector('span');if(label)label.textContent=open?'Hide filters':'Filters & sort';
    });
  }

  function resetForDesktop(){
    if(mq.matches)return;
    byId('heroForm')?.classList.remove('mobile-open');
    document.querySelector('.filters')?.classList.remove('mobile-open');
    document.querySelector('.search-row')?.classList.remove('mobile-expanded');
    const r=byId('mobileRefine');if(r){r.setAttribute('aria-expanded','false');const label=r.querySelector('span');if(label)label.textContent='Filters & sort'}
    const h=byId('mobileHeroSearchToggle');if(h){h.setAttribute('aria-expanded','false');h.firstChild.textContent='Search opportunities'}
  }

  function bindFilterChanges(){
    ['q',...FILTER_IDS,'sort'].forEach(id=>byId(id)?.addEventListener(id==='q'?'input':'change',()=>setTimeout(syncRefineLabel,0)));
    byId('clearFilters')?.addEventListener('click',()=>setTimeout(syncRefineLabel,0));
    byId('clearTop')?.addEventListener('click',()=>setTimeout(syncRefineLabel,0));
  }

  function closeRefineOnTabChange(){
    if(!mq.matches)return;
    document.querySelector('.filters')?.classList.remove('mobile-open');
    document.querySelector('.search-row')?.classList.remove('mobile-expanded');
    const b=byId('mobileRefine');if(b){b.setAttribute('aria-expanded','false');const label=b.querySelector('span');if(label)label.textContent='Filters & sort'}
  }

  function improveMobileFlow(){
    ensureHeroSearch();ensureRefine();bindFilterChanges();syncRefineLabel();resetForDesktop();
    document.addEventListener('click',e=>{if(e.target.closest('[data-tab]'))setTimeout(()=>{syncRefineLabel();closeRefineOnTabChange()},0)});
    mq.addEventListener?.('change',resetForDesktop);
    window.addEventListener('popstate',()=>setTimeout(syncRefineLabel,0));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',improveMobileFlow,{once:true});else improveMobileFlow();
})();
