/* Stage 5 production release guard.
 * Read-only diagnostics for the public finder. It must never raise a user-facing
 * error banner; the finder loader itself owns genuine live-data fallback UX.
 */
(function stage5ReleaseVerification(){
  const MAX_WAIT_MS=45000;
  const started=Date.now();
  const result={version:'stage5-2026-08-25c',checkedAt:'',mode:'pending',counts:{},checks:[],relatedApi:'not-tested',releaseReady:false};
  window.IAO_RELEASE_HEALTH=result;

  const add=(name,pass,detail='',severity='warning')=>{result.checks.push({name,pass:Boolean(pass),detail,severity});return Boolean(pass)};
  const meaningful=value=>String(value??'').trim().length>0;
  const statusText=()=>String(document.getElementById('status')?.textContent||'').trim();
  const recordById=id=>{try{return typeof find==='function'?find(id):null}catch(_){return null}};
  const idsPresent=arr=>arr.every(x=>String(x?.id||'').trim().length>0);
  const uniqueIds=arr=>{const ids=arr.map(x=>String(x?.id||'').trim()).filter(Boolean);return ids.length===arr.length&&ids.length===new Set(ids).size};
  const richFields=(record,fields)=>Boolean(record)&&fields.every(field=>Array.isArray(field)?field.some(k=>meaningful(record[k])):meaningful(record[field]));

  function clearReleaseNotice(){
    const box=document.getElementById('siteNotice'),text=document.getElementById('siteNoticeText'),action=document.getElementById('siteNoticeAction');
    if(!box||!text)return;
    if(/Release verification detected incomplete live opportunity data|Live opportunity data could not be loaded completely/i.test(text.textContent||'')){
      text.textContent='';box.className='site-notice';
      if(action){action.classList.add('hide');action.onclick=null}
    }
  }

  function datasetSnapshot(){
    const snap={competitions:[],programmes:[],scholarships:[]};
    try{
      if(typeof allData==='function'){
        const records=allData();
        if(Array.isArray(records))for(const record of records){
          const kind=String(record?.kind||'').toLowerCase();
          if(kind==='competitions')snap.competitions.push(record);
          else if(kind==='programmes')snap.programmes.push(record);
          else if(kind==='scholarships')snap.scholarships.push(record);
        }
      }
    }catch(_){}
    return snap;
  }

  function snapshotReady(snap){
    return snap.competitions.length>0&&snap.programmes.length>0&&snap.scholarships.length>0;
  }

  async function probeRelated(){
    if(!window.IRISH_OPPORTUNITIES_CONFIG?.API_BASE_URL||typeof jsonp!=='function'){
      result.relatedApi='not-available';
      add('Related API frontend wiring',typeof s3GetRelated==='function','Local related fallback '+(typeof s3GetRelated==='function'?'available':'missing'));
      return;
    }
    try{
      const response=await jsonp(window.IRISH_OPPORTUNITIES_CONFIG.API_BASE_URL+'?api=related&kind=competitions&id=C001&limit=5');
      const arr=Array.isArray(response)?response:(response?.records||response?.items||[]);
      const valid=Array.isArray(arr)&&arr.length<=5&&arr.every(x=>String(x?.id||x?.competitionId||x?.['Competition ID']||'').toUpperCase()!=='C001');
      result.relatedApi=valid?'pass':'unexpected-response';
      add('Related API response',valid,valid?arr.length+' related records returned':'Unexpected related payload');
    }catch(_){result.relatedApi='fallback';add('Related API response',false,'Network/API probe failed; local similarity fallback remains active')}
  }

  async function run(snap){
    result.checkedAt=new Date().toISOString();result.mode='live';result.checks=[];
    result.counts={competitions:snap.competitions.length,programmes:snap.programmes.length,scholarships:snap.scholarships.length,total:snap.competitions.length+snap.programmes.length+snap.scholarships.length};

    add('Competition dataset loaded',snap.competitions.length>0,snap.competitions.length+' live records loaded','critical');
    add('Programme dataset loaded',snap.programmes.length>0,snap.programmes.length+' live records loaded','critical');
    add('Funding dataset loaded',snap.scholarships.length>0,snap.scholarships.length+' live records loaded','critical');
    add('Competition IDs present',idsPresent(snap.competitions),snap.competitions.length+' records checked','critical');
    add('Programme IDs present',idsPresent(snap.programmes),snap.programmes.length+' records checked','critical');
    add('Funding IDs present',idsPresent(snap.scholarships),snap.scholarships.length+' records checked','critical');
    add('Competition IDs unique',uniqueIds(snap.competitions),snap.competitions.length+' records checked','critical');
    add('Programme IDs unique',uniqueIds(snap.programmes),snap.programmes.length+' records checked','critical');
    add('Funding IDs unique',uniqueIds(snap.scholarships),snap.scholarships.length+' records checked','critical');

    const c001=recordById('C001'),p001=recordById('P001'),s001=recordById('S001');
    add('C001 regression anchor',Boolean(c001&&/Irish Mathematical Olympiad/i.test(c001.name||'')),c001?.name||'Missing');
    add('P001 regression anchor',Boolean(p001&&meaningful(p001.name)),p001?.name||'Missing');
    add('S001 regression anchor',Boolean(s001&&/Naughton/i.test(s001.name||'')),s001?.name||'Missing');
    add('Competition rich-detail payload',richFields(c001,['url','schoolYears','cost','costNotes','eligibility']),'Diagnostic content check');
    add('Programme rich-detail payload',richFields(p001,['url','schoolYears','mode','duration','cost','description','lastVerified']),'Diagnostic content check');
    add('Funding rich-detail payload',richFields(s001,['url',['applicantStage','schoolYears'],'awardValue','eligibility','lastVerified']),'Diagnostic content check');

    let calendarOk=true,calendarCount=0;
    try{if(typeof futureCalendarEvents==='function'){const events=futureCalendarEvents();calendarCount=events.length;for(let i=1;i<events.length;i++)if(events[i].date<events[i-1].date){calendarOk=false;break}}else calendarOk=false}catch(_){calendarOk=false}
    add('Unified calendar chronological',calendarOk,calendarCount+' future dated events checked');
    let directOk=false;try{directOk=typeof s3DirectUrl==='function'&&c001&&new URL(s3DirectUrl(c001),location.origin).searchParams.get('id')==='C001'}catch(_){}
    add('Direct opportunity links',directOk,directOk?'C001 direct URL resolves':'Direct URL diagnostic failed');
    add('Feedback frontend handler',typeof s3SubmitFeedback==='function','Anonymous feedback handler '+(typeof s3SubmitFeedback==='function'?'loaded':'missing'));

    const criticalFailures=result.checks.filter(x=>x.severity==='critical'&&!x.pass);
    result.releaseReady=criticalFailures.length===0;
    clearReleaseNotice();
    document.getElementById('status')?.setAttribute('title',result.releaseReady?'Live data · core release checks passed':'Live data · release diagnostics need review');
    if(result.releaseReady)console.info('[IAO Stage 5] Core release verification passed',result);else console.error('[IAO Stage 5] Core release verification failed',criticalFailures,result);

    // Optional probe is diagnostic only and cannot change releaseReady or show UI.
    await probeRelated();
  }

  function wait(){
    clearReleaseNotice();
    const status=statusText(),snap=datasetSnapshot();
    if(/live data/i.test(status)&&snapshotReady(snap))return run(snap);

    // The finder intentionally falls back to its preview if the API is unavailable.
    // That state is already communicated by the finder; Stage 5 stays silent.
    if(/frontend preview/i.test(status)&&Date.now()-started>1500){
      result.checkedAt=new Date().toISOString();result.mode='preview';result.releaseReady=false;
      add('Live public API available',false,'Finder is using its preview fallback','warning');
      console.warn('[IAO Stage 5] Finder is in preview fallback mode.',result);return;
    }

    if(Date.now()-started>=MAX_WAIT_MS){
      result.checkedAt=new Date().toISOString();result.mode='timeout';result.releaseReady=false;
      add('Live datasets ready',false,'Mapped datasets were not ready within '+MAX_WAIT_MS/1000+' seconds','critical');
      console.error('[IAO Stage 5] Timed out waiting for mapped live datasets.',result);return;
    }
    setTimeout(wait,300);
  }

  clearReleaseNotice();
  wait();
})();
