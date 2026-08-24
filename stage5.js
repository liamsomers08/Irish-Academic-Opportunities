/* Stage 5 production release guard.
 * This performs read-only runtime checks against the real mapped public data.
 * It never changes opportunity records and never blocks the finder when the
 * related-opportunity API is temporarily unavailable because Stage 3 has a
 * local similarity fallback.
 */
(function stage5ReleaseVerification(){
  const VERIFIED_MINIMUMS={competitions:353,programmes:345,scholarships:334};
  const MAX_WAIT_MS=25000;
  const started=Date.now();

  const result={
    version:'stage5-2026-08-24',
    checkedAt:'',
    mode:'pending',
    counts:{},
    checks:[],
    relatedApi:'not-tested',
    releaseReady:false
  };
  window.IAO_RELEASE_HEALTH=result;

  function add(name,pass,detail='',severity='critical'){
    result.checks.push({name,pass:Boolean(pass),detail,severity});
    return Boolean(pass);
  }
  function recordById(id){
    try{return typeof find==='function'?find(id):null}catch(_){return null}
  }
  function uniqueIds(arr){
    const ids=arr.map(x=>x&&x.id).filter(Boolean);
    return ids.length===new Set(ids).size;
  }
  function meaningful(value){return String(value??'').trim().length>0}
  function richFields(record,fields){
    if(!record)return false;
    return fields.every(field=>{
      if(Array.isArray(field))return field.some(k=>meaningful(record[k]));
      return meaningful(record[field]);
    });
  }
  function userNotice(message){
    const box=document.getElementById('siteNotice');
    const text=document.getElementById('siteNoticeText');
    const action=document.getElementById('siteNoticeAction');
    if(!box||!text)return;
    text.textContent=message;
    box.className='site-notice on error';
    if(action){action.textContent='Retry';action.classList.remove('hide');action.onclick=()=>location.reload()}
  }
  function settled(){
    const status=(document.getElementById('status')?.textContent||'').trim();
    return /live data|frontend preview/i.test(status);
  }
  function datasetSnapshot(){
    const snap={competitions:[],programmes:[],scholarships:[]};
    try{
      if(typeof data==='object'&&data){
        snap.competitions=Array.isArray(data.competitions)?data.competitions:[];
        snap.programmes=Array.isArray(data.programmes)?data.programmes:[];
        snap.scholarships=Array.isArray(data.scholarships)?data.scholarships:[];
      }
    }catch(_){}
    return snap;
  }

  async function probeRelated(){
    if(!window.IRISH_OPPORTUNITIES_CONFIG?.API_BASE_URL||typeof jsonp!=='function'){
      result.relatedApi='not-available';
      add('Related API frontend wiring',typeof s3GetRelated==='function','Stage 3 local related fallback '+(typeof s3GetRelated==='function'?'available':'missing'),'warning');
      return;
    }
    try{
      const base=window.IRISH_OPPORTUNITIES_CONFIG.API_BASE_URL;
      const response=await jsonp(base+'?api=related&kind=competitions&id=C001&limit=5');
      const arr=Array.isArray(response)?response:(response?.records||response?.items||[]);
      const valid=Array.isArray(arr)&&arr.length<=5&&arr.every(x=>String(x?.id||x?.competitionId||x?.['Competition ID']||'').toUpperCase()!=='C001');
      result.relatedApi=valid?'pass':'unexpected-response';
      add('Related API response',valid,valid?arr.length+' related records returned':'Unexpected related payload','warning');
    }catch(err){
      result.relatedApi='fallback';
      add('Related API response',false,'Network/API probe failed; Stage 3 local similarity fallback remains active','warning');
    }
  }

  async function run(){
    const status=(document.getElementById('status')?.textContent||'').trim();
    const snap=datasetSnapshot();
    result.checkedAt=new Date().toISOString();
    result.mode=/live data/i.test(status)?'live':/frontend preview/i.test(status)?'preview':'unknown';
    result.counts={competitions:snap.competitions.length,programmes:snap.programmes.length,scholarships:snap.scholarships.length,total:snap.competitions.length+snap.programmes.length+snap.scholarships.length};

    if(result.mode!=='live'){
      add('Live public API available',false,'Page is in '+result.mode+' mode','critical');
      result.releaseReady=false;
      console.warn('[IAO Stage 5] Live release checks could not run because the page is not using live data.',result);
      return;
    }

    add('Competition dataset minimum',snap.competitions.length>=VERIFIED_MINIMUMS.competitions,snap.competitions.length+' loaded; verified minimum '+VERIFIED_MINIMUMS.competitions);
    add('Programme dataset minimum',snap.programmes.length>=VERIFIED_MINIMUMS.programmes,snap.programmes.length+' loaded; verified minimum '+VERIFIED_MINIMUMS.programmes);
    add('Funding dataset minimum',snap.scholarships.length>=VERIFIED_MINIMUMS.scholarships,snap.scholarships.length+' loaded; verified minimum '+VERIFIED_MINIMUMS.scholarships);

    add('Competition IDs unique',uniqueIds(snap.competitions),snap.competitions.length+' records checked');
    add('Programme IDs unique',uniqueIds(snap.programmes),snap.programmes.length+' records checked');
    add('Funding IDs unique',uniqueIds(snap.scholarships),snap.scholarships.length+' records checked');

    const c001=recordById('C001'),p001=recordById('P001'),s001=recordById('S001');
    add('C001 regression anchor',Boolean(c001&&/Irish Mathematical Olympiad/i.test(c001.name||'')),c001?.name||'Missing');
    add('P001 regression anchor',Boolean(p001&&meaningful(p001.name)),p001?.name||'Missing');
    add('S001 regression anchor',Boolean(s001&&/Naughton/i.test(s001.name||'')),s001?.name||'Missing');

    add('Competition rich-detail payload',richFields(c001,['url','schoolYears','cost','costNotes','eligibility']),c001?'Checks official source, eligibility, cost and evidence notes':'C001 missing');
    add('Programme rich-detail payload',richFields(p001,['url','schoolYears','mode','duration','cost','description','lastVerified']),p001?'Checks delivery, duration, description and verification fields':'P001 missing');
    add('Funding rich-detail payload',richFields(s001,['url',['applicantStage','schoolYears'],'awardValue','eligibility','lastVerified']),s001?'Checks applicant stage, award, eligibility and verification fields':'S001 missing');

    let calendarOk=true,calendarCount=0;
    try{
      if(typeof futureCalendarEvents==='function'){
        const events=futureCalendarEvents();calendarCount=events.length;
        for(let i=1;i<events.length;i++)if(events[i].date<events[i-1].date){calendarOk=false;break}
      }else calendarOk=false;
    }catch(_){calendarOk=false}
    add('Unified calendar chronological',calendarOk,calendarCount+' future dated events checked');

    let directOk=false;
    try{directOk=typeof s3DirectUrl==='function'&&new URL(s3DirectUrl(c001),location.origin).searchParams.get('id')==='C001'}catch(_){}
    add('Direct opportunity links',directOk,directOk?'C001 direct URL resolves to its record ID':'Direct URL check failed');
    add('Feedback frontend handler',typeof s3SubmitFeedback==='function','Anonymous feedback submit handler '+(typeof s3SubmitFeedback==='function'?'loaded':'missing'));

    await probeRelated();

    const criticalFailures=result.checks.filter(x=>x.severity==='critical'&&!x.pass);
    result.releaseReady=criticalFailures.length===0;
    if(!result.releaseReady){
      userNotice('Release verification detected incomplete live opportunity data. Refresh before relying on this view.');
      console.error('[IAO Stage 5] CRITICAL release verification failures',criticalFailures,result);
    }else{
      document.getElementById('status')?.setAttribute('title','Live data · Stage 5 release checks passed');
      console.info('[IAO Stage 5] Release verification passed',result);
    }
  }

  function wait(){
    if(settled())return run();
    if(Date.now()-started>=MAX_WAIT_MS){
      result.checkedAt=new Date().toISOString();result.mode='timeout';
      add('Live public API settled',false,'Live-data startup did not settle within '+MAX_WAIT_MS/1000+' seconds');
      console.warn('[IAO Stage 5] Release guard timed out waiting for live data.',result);
      return;
    }
    setTimeout(wait,300);
  }
  wait();
})();
