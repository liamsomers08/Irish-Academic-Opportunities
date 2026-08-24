(function(){
  const SITE='https://liamsomers08.github.io/Irish-Academic-Opportunities/';
  const $=id=>document.getElementById(id);
  async function copyText(value,button){try{await navigator.clipboard.writeText(value);if(button){const old=button.textContent;button.textContent='Copied!';setTimeout(()=>button.textContent=old,1300)}}catch(_){prompt('Copy this text:',value)}}
  document.addEventListener('click',async e=>{
    const copy=e.target.closest('[data-copy-target]');
    if(copy){const target=$(copy.dataset.copyTarget);if(target)await copyText('value'in target?target.value:target.textContent,copy)}
    const url=e.target.closest('[data-copy-site]');if(url)await copyText(SITE,url);
    const share=e.target.closest('[data-share-site]');if(share){if(navigator.share){try{await navigator.share({title:'Irish Academic Opportunities Finder',text:'Academic competitions, TY and enrichment programmes, scholarships and funding for secondary-school students in Ireland.',url:SITE})}catch(_){}}else await copyText(SITE,share)}
    const print=e.target.closest('[data-print]');if(print)window.print();
  });
})();