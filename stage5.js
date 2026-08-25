/* Stage 5 production release guard.
 *
 * This is a runtime health check for the public finder. A blocking user notice
 * is reserved for conditions that actually make the live finder unreliable
 * (missing datasets or broken record identity). Content-quality/regression
 * checks are still recorded for diagnostics, but they are warnings and must
 * not tell users that the live database is incomplete.
 */
(function stage5ReleaseVerification(){
  const MIN_USABLE_COUNTS={competitions:1,programmes:1,scholarships:1};
  const MAX_WAIT_MS=25000;
  const started=Date.now();

  const result={
    version:'stage5-2026-08-25',
    checkedAt:'',
    mode:'pending',
    counts:{},
    checks:[],
    relatedApi:'not-tested',
    releaseReady:false
  };
  window.IAO_RELEASE_HEALTH=result;

  function add(name,pass,detail='',severity='warning'){
    result.checks.push({name,pass:Boolean(pass),detail,severity});
    return Boolean(pass);
  }
  function recordById(id){
    try{return typeof find==='function'?find(id):null}catch(_){return null}
  }
  function idsPresent(arr){
    return arr.every(x=>String(x?.id||'').trim().length>0);
  }
  function uniqueIds(arr){
    const ids=arr.map(x=>String(x?.id||'').trim()).filter(Boolean);
    return ids.length===arr.length&&ids.length===new Set(ids).size;
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
  function clearReleaseNotice(){
    const box=document.getElementById('siteNotice');
    const text=document.getElementById('siteNoticeText');
    const action=document.getElementById('siteNoticeAction');
    if(!box||!text)return;
    if(/Release verification detected incomplete live opportunity data/i.test(text.textContent||'')){
      text.textContent='';
      box.className='site-notice';
      if(action){action.classList.add('hide');action.onclick=null}
    }
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

    // Do not compare against historical fixed totals. The maintained master can
    // legitimately shrink when inactive opportunities are archived. What is
    // critical is that every public dataset actually loaded and has usable IDs.
    add('Competition dataset loaded',snap.competitions.length>=MIN_USABLE_COUNTS.competitions,snap.competitions.length+' live records loaded','critical');
    add('Programme dataset loaded',snap.programmes.length>=MIN_USABLE_COUNTS.programmes,snap.programmes.length+' live records loaded','critical');
    add('Funding dataset loaded',snap.scholarships.length>=MIN_USABLE_COUNTS.scholarships,snap.scholarships.length+' live records loaded','critical');

    add('Competition IDs present',idsPresent(snap.competitions),snap.competitions.length+' records checked','critical');
    add('Programme IDs present',idsPresent(snap.programmes),snap.programmes.length+' records checked','critical');
    add('Funding IDs present',idsPresent(snap.scholarships),snap.scholarships.length+' records checked','critical');
    add('Competition IDs unique',uniqueIds(snap.competitions),snap.competitions.length+' records checked','critical');
    add('Programme IDs unique',uniqueIds(snap.programmes),snap.programmes.length+' records checked','critical');
    add('Funding IDs unique',uniqueIds(snap.scholarships),snap.scholarships.length+' records checked','critical');

    const c001=recordById('C001'),p001=recordById('P001'),s001=recordById('S001');
    add('C001 regression anchor',Boolean(c001&&/Irish Mathematical Olympiad/i.test(c001.name||'')),c001?.name||'Missing','warning');
    add('P001 regression anchor',Boolean(p001&&meaningful(p001.name)),p001?.name||'Missing','warning');
    add('S001 regression anchor',Boolean(s001&&/Naughton/i.test(s001.name||'')),s001?.name||'Missing','warning');

    add('Competition rich-detail payload',richFields(c001,['url','schoolYears','cost','costNotes','eligibility']),c001?'Checks official source, eligibility, cost and evidence notes':'C001 missing','warning');
    add('Programme rich-detail payload',richFields(p001,['url','schoolYears','mode','duration','cost','description','lastVerified']),p001?'Checks delivery, duration, description and verification fields':'P001 missing','warning');
    add('Funding rich-detail payload',richFields(s001,['url',['applicantStage','schoolYears'],'awardValue','eligibility','lastVerified']),s001?'Checks applicant stage, award, eligibility and verification fields':'S001 missing','warning');

    let calendarOk=true,calendarCount=0;
    try{
      if(typeof futureCalendarEvents==='function'){
        const events=futureCalendarEvents();calendarCount=events.length;
        for(let i=1;i<events.length;i++)if(events[i].date<events[i-1].date){calendarOk=false;break}
      }else calendarOk=false;
    }catch(_){calendarOk=false}
    add('Unified calendar chronological',calendarOk,calendarCount+' future dated events checked','warning');

    let directOk=false;
    try{directOk=typeof s3DirectUrl==='function'&&c001&&new URL(s3DirectUrl(c001),location.origin).searchParams.get('id')==='C001'}catch(_){}
    add('Direct opportunity links',directOk,directOk?'C001 direct URL resolves to its record ID':'Direct URL check failed','warning');
    add('Feedback frontend handler',typeof s3SubmitFeedback==='function','Anonymous feedback submit handler '+(typeof s3SubmitFeedback==='function'?'loaded':'missing'),'warning');

    await probeRelated();

    const criticalFailures=result.checks.filter(x=>x.severity==='critical'&&!x.pass);
    const warnings=result.checks.filter(x=>x.severity==='warning'&&!x.pass);
    result.releaseReady=criticalFailures.length===0;

    if(!result.releaseReady){
      userNotice('Live opportunity data could not be loaded completely. Refresh and try again.');
      console.error('[IAO Stage 5] CRITICAL release verification failures',criticalFailures,result);
    }else{
      clearReleaseNotice();
      document.getElementById('status')?.setAttribute('title',warnings.length?'Live data · core checks passed; '+warnings.length+' diagnostic warning(s)':'Live data · release checks passed');
      if(warnings.length)console.warn('[IAO Stage 5] Core release checks passed with diagnostic warnings',warnings,result);
      else console.info('[IAO Stage 5] Release verification passed',result);
    }
  }

  function wait(){
    if(settled())return run();
    if(Date.now()-started>=MAX_WAIT_MS){
      result.checkedAt=new Date().toISOString();result.mode='timeout';
      add('Live public API settled',false,'Live-data startup did not settle within '+MAX_WAIT_MS/1000+' seconds','critical');
      result.releaseReady=false;
      console.warn('[IAO Stage 5] Release guard timed out waiting for live data.',result);
      return;
    }
    setTimeout(wait,300);
  }
  wait();
})();
