/**
 * OperationsV7.gs — Stage 7 continuous operations for Irish Academic Opportunities.
 *
 * PRIVATE ADMIN CODE. Do not expose these functions through PublicApi.gs.
 *
 * Safety model:
 * - fetched page changes NEVER overwrite Competitions, Programmes or Scholarships;
 * - successful changes must repeat on two consecutive checks before queueing;
 * - access restrictions (403/429/low-readable-content) become manual-review items,
 *   not evidence that an opportunity is broken;
 * - exact dates/fees are never inferred from page changes;
 * - every run is logged and all substantive changes require human review.
 *
 * Install in the EXISTING bound Apps Script project and run stage7Install() once.
 */

const STAGE7_CONFIG = Object.freeze({
  SPREADSHEET_ID: '1JH84XrYYxOlZgM8zqt9bn4Ndo-QwnpouDbgvMAoVevs',
  TIMEZONE: 'Europe/Dublin',
  DAILY_BATCH_PER_KIND: 30,
  BOOTSTRAP_BATCH_PER_KIND: 50,
  PENDING_SHARE: 0.72,
  ERROR_SHARE: 0.14,
  STALE_DAYS: 90,
  MIN_READABLE_CHARS: 120,
  CHANGE_CONFIRMATIONS: 2,
  ERROR_QUEUE_THRESHOLD: 3,
  FORTNIGHTLY_MIN_DAYS: 12,
  MANUAL_HTTP: Object.freeze([401, 403, 405, 406, 418, 429, 451]),
  USER_AGENT: 'Mozilla/5.0 (compatible; IrishAcademicOpportunitiesMonitor/7.0; +https://liamsomers08.github.io/Irish-Academic-Opportunities/)',
  SHEETS: Object.freeze({
    dashboard: 'Operations Dashboard',
    centralQueue: 'Operations Review Queue',
    runLog: 'Operations Run Log'
  }),
  KINDS: Object.freeze({
    competitions: Object.freeze({
      key: 'competitions', label: 'Competition', master: 'Competitions', monitor: '_UpdateMonitor', queue: 'Update Queue', log: 'Update Log',
      idHeader: 'Competition ID', nameHeader: 'Competition Name', statusHeaders: ['Status'], sourceHeaders: ['Current Year Page', 'Official Website'],
      verifiedHeaders: ['Eligibility Checked', 'Cost Checked'], deadlineHeaders: ['Registration Deadline', 'Submission Deadline'],
      openPattern: /\b(available|open)\b/i, skipPattern: /\b(not available|removed|archived|discontinued)\b/i
    }),
    programmes: Object.freeze({
      key: 'programmes', label: 'Programme', master: 'Programmes', monitor: '_ProgrammeMonitor', queue: 'Programme Update Queue', log: 'Programme Update Log',
      idHeader: 'Programme ID', nameHeader: 'Programme Name', statusHeaders: ['Application Status', 'Programme Status'],
      sourceHeaders: ['Monitoring Source', 'Current Intake Page', 'Official Website'], verifiedHeaders: ['Last Verified', 'Eligibility Checked', 'Cost Checked'],
      deadlineHeaders: ['Application Deadline'], finderEligibleHeader: 'Finder Eligible?',
      openPattern: /\b(open|accepting|available now|expression of interest|waitlist)\b/i, skipPattern: /\b(archive|removed|discontinued|not available)\b/i
    }),
    scholarships: Object.freeze({
      key: 'scholarships', label: 'Funding', master: 'Scholarships', monitor: '_ScholarshipMonitor', queue: 'Scholarship Update Queue', log: 'Scholarship Update Log',
      idHeader: 'Scholarship ID', nameHeader: 'Scholarship Name', statusHeaders: ['Current Status'], sourceHeaders: ['Official Link'],
      verifiedHeaders: ['Last Verified'], deadlineHeaders: ['Application Deadline'], finderEligibleHeader: 'Finder Eligible?',
      openPattern: /\b(open|available)\b/i, skipPattern: /\b(archive|removed|discontinued|not available)\b/i
    })
  })
});

function stage7Install() {
  const started = Date.now();
  const ss = stage7Spreadsheet_();
  stage7EnsureOperationalSheets_(ss);
  stage7CreateTriggers();
  const synced = stage7SyncOpenQueues_();
  stage7SetRuntimeStatus_('Installed', 'Active', 'Daily rotating checks + fortnightly Monday review are scheduled.');
  stage7AppendRunLog_({job:'install',kind:'all',checked:0,baselines:0,changes:0,manual:0,errors:0,reviewItems:synced,duration:Date.now()-started,notes:'Stage 7 installed. No master opportunity data was changed.'});
  return {ok:true,syncedReviewItems:synced,triggers:stage7TriggerSummary_()};
}

function stage7RunNow() { return stage7RunDaily(); }

function stage7RunDaily() {
  const started = Date.now();
  const totals = stage7EmptyTotals_();
  const defs = STAGE7_CONFIG.KINDS;
  Object.keys(defs).forEach(function(key) {
    const out = stage7MonitorKind_(defs[key], STAGE7_CONFIG.DAILY_BATCH_PER_KIND);
    stage7MergeTotals_(totals, out);
    stage7AppendRunLog_(Object.assign({job:'daily-monitor',kind:key,duration:out.duration},out));
  });
  totals.reviewItems += stage7SyncOpenQueues_();
  stage7SetRuntimeStatus_('Installed', 'Active', 'Last daily operations run: ' + stage7FormatDateTime_(new Date()));
  stage7AppendRunLog_({job:'daily-summary',kind:'all',checked:totals.checked,baselines:totals.baselines,changes:totals.changes,manual:totals.manual,errors:totals.errors,reviewItems:totals.reviewItems,duration:Date.now()-started,notes:'Rotating monitor completed; public master rows were not auto-edited.'});
  return totals;
}

function stage7BootstrapBaselines() {
  const started = Date.now();
  const totals = stage7EmptyTotals_();
  const defs = STAGE7_CONFIG.KINDS;
  Object.keys(defs).forEach(function(key) {
    const out = stage7MonitorKind_(defs[key], STAGE7_CONFIG.BOOTSTRAP_BATCH_PER_KIND, true);
    stage7MergeTotals_(totals, out);
    stage7AppendRunLog_(Object.assign({job:'baseline-pass',kind:key,duration:out.duration},out));
  });
  totals.reviewItems += stage7SyncOpenQueues_();
  stage7AppendRunLog_({job:'baseline-summary',kind:'all',checked:totals.checked,baselines:totals.baselines,changes:totals.changes,manual:totals.manual,errors:totals.errors,reviewItems:totals.reviewItems,duration:Date.now()-started,notes:'Accelerated baseline pass completed.'});
  return totals;
}

function stage7RunFortnightly() {
  const props = PropertiesService.getScriptProperties();
  const now = new Date();
  const last = Number(props.getProperty('stage7_last_fortnightly_ms') || 0);
  const minMs = STAGE7_CONFIG.FORTNIGHTLY_MIN_DAYS * 86400000;
  if (last && now.getTime() - last < minMs) {
    stage7AppendRunLog_({job:'fortnightly-review',kind:'all',checked:0,baselines:0,changes:0,manual:0,errors:0,reviewItems:0,duration:0,notes:'Skipped by fortnightly gate; last review was less than '+STAGE7_CONFIG.FORTNIGHTLY_MIN_DAYS+' days ago.'});
    return {ok:true,skipped:true};
  }
  const started = Date.now();
  const synced = stage7SyncOpenQueues_();
  const reviewed = stage7ReviewMasterHealth_();
  props.setProperty('stage7_last_fortnightly_ms', String(now.getTime()));
  stage7SetRuntimeStatus_('Installed', 'Active', 'Last fortnightly review: ' + stage7FormatDateTime_(now));
  stage7AppendRunLog_({job:'fortnightly-review',kind:'all',checked:reviewed.checked,baselines:0,changes:0,manual:0,errors:0,reviewItems:synced+reviewed.queued,duration:Date.now()-started,notes:'Stale/source/status checks completed. Findings were queued only; masters were not auto-edited.'});
  return {ok:true,skipped:false,synced:synced,health:reviewed};
}

function stage7CreateTriggers() {
  stage7RemoveTriggers();
  ScriptApp.newTrigger('stage7RunDaily').timeBased().everyDays(1).atHour(6).nearMinute(15).inTimezone(STAGE7_CONFIG.TIMEZONE).create();
  ScriptApp.newTrigger('stage7RunFortnightly').timeBased().everyWeeks(1).onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(7).nearMinute(15).inTimezone(STAGE7_CONFIG.TIMEZONE).create();
  return stage7TriggerSummary_();
}

function stage7RemoveTriggers() {
  const ours = {stage7RunDaily:true,stage7RunFortnightly:true};
  ScriptApp.getProjectTriggers().forEach(function(trigger) { if (ours[trigger.getHandlerFunction()]) ScriptApp.deleteTrigger(trigger); });
}

function stage7TriggerSummary_() {
  return ScriptApp.getProjectTriggers().filter(function(t){return /^stage7Run(Daily|Fortnightly)$/.test(t.getHandlerFunction());}).map(function(t){return t.getHandlerFunction();});
}

function stage7MonitorKind_(def, limit, preferPendingOnly) {
  const started = Date.now();
  const ss = stage7Spreadsheet_();
  const sheet = ss.getSheetByName(def.monitor);
  if (!sheet) throw new Error('Missing monitor sheet: ' + def.monitor);
  const lastRow = Math.max(2, sheet.getLastRow());
  const raw = sheet.getRange(2,1,lastRow-1,13).getValues();
  const rows = raw.map(function(values,i){return {row:i+2,values:values};}).filter(function(r){return String(r.values[0]||'').trim()&&String(r.values[3]||'').trim();});
  const selected = stage7SelectMonitorRows_(rows, limit, preferPendingOnly);
  if (!selected.length) return {checked:0,baselines:0,changes:0,manual:0,errors:0,reviewItems:0,duration:Date.now()-started,notes:'No monitor rows selected.'};
  const responses = stage7FetchAll_(selected);
  const out = {checked:0,baselines:0,changes:0,manual:0,errors:0,reviewItems:0,duration:0,notes:''};
  selected.forEach(function(item,index){
    const result = stage7ProcessMonitorResponse_(def,sheet,item,responses[index]);
    out.checked++; out.baselines+=result.baselines; out.changes+=result.changes; out.manual+=result.manual; out.errors+=result.errors; out.reviewItems+=result.reviewItems;
  });
  out.duration = Date.now()-started;
  out.notes = 'Checked '+out.checked+'; baselines '+out.baselines+'; changes queued '+out.changes+'; manual '+out.manual+'; errors '+out.errors+'.';
  return out;
}

function stage7SelectMonitorRows_(rows, limit, preferPendingOnly) {
  const pending=rows.filter(function(r){return !String(r.values[7]||'').trim();});
  const errors=rows.filter(function(r){return Number(r.values[10]||0)>0&&String(r.values[7]||'').trim();});
  const ordinary=rows.filter(function(r){return String(r.values[7]||'').trim()&&Number(r.values[10]||0)===0;});
  const byOldest=function(a,b){return stage7DateMs_(a.values[4])-stage7DateMs_(b.values[4]);};
  pending.sort(byOldest); errors.sort(byOldest); ordinary.sort(byOldest);
  if (preferPendingOnly&&pending.length) return pending.slice(0,limit);
  const pLimit=Math.min(pending.length,Math.ceil(limit*STAGE7_CONFIG.PENDING_SHARE));
  const eLimit=Math.min(errors.length,Math.ceil(limit*STAGE7_CONFIG.ERROR_SHARE));
  let chosen=pending.slice(0,pLimit).concat(errors.slice(0,eLimit));
  const used={}; chosen.forEach(function(r){used[r.row]=true;});
  const rest=pending.slice(pLimit).concat(errors.slice(eLimit),ordinary).filter(function(r){return !used[r.row];}).sort(byOldest);
  chosen=chosen.concat(rest.slice(0,Math.max(0,limit-chosen.length)));
  return chosen.slice(0,limit);
}

function stage7FetchAll_(selected) {
  const requests=selected.map(function(item){return {url:String(item.values[3]),method:'get',followRedirects:true,muteHttpExceptions:true,headers:{'User-Agent':STAGE7_CONFIG.USER_AGENT,'Accept':'text/html,application/xhtml+xml,application/pdf;q=0.8,*/*;q=0.5','Accept-Language':'en-IE,en;q=0.9'}};});
  try { return UrlFetchApp.fetchAll(requests).map(function(r){return {response:r,error:null};}); }
  catch (batchError) {
    return requests.map(function(req){try{return {response:UrlFetchApp.fetch(req.url,req),error:null};}catch(err){return {response:null,error:err};}});
  }
}

function stage7ProcessMonitorResponse_(def, monitorSheet, item, wrapped) {
  const values=item.values.slice(); const now=new Date(); const id=String(values[0]||'').trim(); const name=String(values[1]||'').trim(); const url=String(values[3]||'').trim(); const oldFingerprint=String(values[7]||'').trim();
  const out={baselines:0,changes:0,manual:0,errors:0,reviewItems:0}; values[4]=now;
  if (wrapped.error||!wrapped.response) {
    const count=Number(values[10]||0)+1; values[10]=count; values[11]='Fetch error: '+stage7ShortError_(wrapped.error); stage7WriteMonitorState_(def,monitorSheet,item.row,values,false); out.errors++;
    if (count>=STAGE7_CONFIG.ERROR_QUEUE_THRESHOLD) {
      if (stage7QueueLocal_(def,id,name,'Repeated fetch error',oldFingerprint,'',url,'ERROR',values[11])) out.changes++;
      if (stage7UpsertReview_(def.key,id,name,'Repeated fetch error','Medium',url,values[11])) out.reviewItems++;
    }
    return out;
  }
  const response=wrapped.response; const status=Number(response.getResponseCode()||0); let body=''; try{body=response.getContentText()||'';}catch(_){body='';}
  const visible=stage7ReadableText_(body); values[6]=status||'ERROR'; values[8]=visible.length;
  const manualStatus=STAGE7_CONFIG.MANUAL_HTTP.indexOf(status)!==-1; const tooLittle=status>=200&&status<400&&visible.length<STAGE7_CONFIG.MIN_READABLE_CHARS;
  if (manualStatus||tooLittle) {
    const reason=manualStatus?'Manual monitor: HTTP '+status:'Manual monitor: too little readable page content ('+visible.length+' chars)'; values[10]=0; values[11]=reason; stage7WriteMonitorState_(def,monitorSheet,item.row,values,false); stage7ClearCandidate_(def.key,id); out.manual++;
    if (stage7UpsertReview_(def.key,id,name,'Manual source monitoring required','Low',url,reason)) out.reviewItems++;
    return out;
  }
  if (status<200||status>=400) {
    const count=Number(values[10]||0)+1; values[10]=count; values[11]='HTTP '+status; stage7WriteMonitorState_(def,monitorSheet,item.row,values,false); out.errors++;
    if (count>=STAGE7_CONFIG.ERROR_QUEUE_THRESHOLD) {
      if (stage7QueueLocal_(def,id,name,'Repeated fetch error',oldFingerprint,'',url,status,values[11])) out.changes++;
      if (stage7UpsertReview_(def.key,id,name,'Repeated fetch error','Medium',url,values[11])) out.reviewItems++;
    }
    return out;
  }
  const fingerprint=stage7Fingerprint_(visible); values[5]=now; values[10]=0; values[11]='';
  if (!oldFingerprint) { values[7]=fingerprint; stage7WriteMonitorState_(def,monitorSheet,item.row,values,true); stage7ClearCandidate_(def.key,id); out.baselines++; return out; }
  if (fingerprint===oldFingerprint) { stage7ClearCandidate_(def.key,id); stage7WriteMonitorState_(def,monitorSheet,item.row,values,false); return out; }
  const candidate=stage7AdvanceCandidate_(def.key,id,fingerprint);
  if (candidate.count>=STAGE7_CONFIG.CHANGE_CONFIRMATIONS) {
    values[7]=fingerprint; values[9]=now;
    const note='The same changed fingerprint was confirmed on '+candidate.count+' consecutive successful checks. Review the official source; do not infer dates, eligibility or fees.';
    if (stage7QueueLocal_(def,id,name,'Page content changed',oldFingerprint,fingerprint,url,status,note)) out.changes++;
    if (stage7UpsertReview_(def.key,id,name,'Source content changed','Medium',url,note)) out.reviewItems++;
    stage7ClearCandidate_(def.key,id);
  }
  stage7WriteMonitorState_(def,monitorSheet,item.row,values,false); return out;
}

function stage7WriteMonitorState_(def,sheet,row,values,baselineCreated) {
  sheet.getRange(row,5,1,8).setValues([[values[4],values[5],values[6],values[7],values[8],values[9],values[10],values[11]]]);
  if (def.key==='competitions'&&baselineCreated) { const m=sheet.getRange(row,13); if(!m.getFormula())m.setValue('Monitoring'); }
}

function stage7CandidateKey_(kind,id){return 'stage7_candidate_'+kind+'_'+id;}
function stage7AdvanceCandidate_(kind,id,fingerprint){const props=PropertiesService.getScriptProperties();const key=stage7CandidateKey_(kind,id);let current={};try{current=JSON.parse(props.getProperty(key)||'{}');}catch(_){current={};}const count=current.fingerprint===fingerprint?Number(current.count||0)+1:1;const next={fingerprint:fingerprint,count:count,seenAt:new Date().toISOString()};props.setProperty(key,JSON.stringify(next));return next;}
function stage7ClearCandidate_(kind,id){PropertiesService.getScriptProperties().deleteProperty(stage7CandidateKey_(kind,id));}

function stage7QueueLocal_(def,id,name,detection,previousFingerprint,newFingerprint,sourceUrl,httpStatus,note){const ss=stage7Spreadsheet_();const sheet=ss.getSheetByName(def.queue);if(!sheet)return false;const last=sheet.getLastRow();if(last>=2){const rows=sheet.getRange(2,1,last-1,Math.min(11,sheet.getLastColumn())).getValues();const duplicate=rows.some(function(r){return String(r[2]||'')===id&&String(r[4]||'')===detection&&String(r[7]||'')===sourceUrl&&String(r[9]||'')==='New';});if(duplicate)return false;}sheet.appendRow([Utilities.getUuid(),new Date(),id,name,detection,previousFingerprint,newFingerprint,sourceUrl,httpStatus,'New',note||'']);return true;}

function stage7SyncOpenQueues_(){let added=0;const defs=STAGE7_CONFIG.KINDS;Object.keys(defs).forEach(function(key){const def=defs[key];const sheet=stage7Spreadsheet_().getSheetByName(def.queue);if(!sheet||sheet.getLastRow()<2)return;const rows=sheet.getRange(2,1,sheet.getLastRow()-1,Math.min(11,sheet.getLastColumn())).getValues();rows.forEach(function(r){if(String(r[9]||'')!=='New')return;const issue=String(r[4]||'Monitor review');const detail=String(r[10]||'')+(r[8]!==''?' HTTP: '+r[8]:'');if(stage7UpsertReview_(key,String(r[2]||''),String(r[3]||''),issue,'Medium',String(r[7]||''),detail))added++;});});added+=stage7SyncFeedback_();return added;}

function stage7SyncFeedback_(){const ss=stage7Spreadsheet_();const sheet=ss.getSheetByName('Feedback Queue');if(!sheet||sheet.getLastRow()<2)return 0;const width=sheet.getLastColumn();const values=sheet.getRange(1,1,sheet.getLastRow(),width).getValues();const headers=stage7HeaderMap_(values[0]);const statusCol=stage7FindHeader_(headers,['Review Status','Status']);const idCol=stage7FindHeader_(headers,['Opportunity ID','ID']);const nameCol=stage7FindHeader_(headers,['Opportunity Name','Title','Name']);const kindCol=stage7FindHeader_(headers,['Kind','Opportunity Type','Type']);const issueCol=stage7FindHeader_(headers,['Issue Type','Category']);const detailCol=stage7FindHeader_(headers,['Message','Details','Detail']);const sourceCol=stage7FindHeader_(headers,['Source URL','Official URL']);let added=0;values.slice(1).forEach(function(row){const status=statusCol>=0?String(row[statusCol]||''):'New';if(status&&!/^new$/i.test(status))return;const id=idCol>=0?String(row[idCol]||''):'';const name=nameCol>=0?String(row[nameCol]||''):'';if(!id&&!name)return;const kind=kindCol>=0?String(row[kindCol]||'feedback').toLowerCase():'feedback';const issue=issueCol>=0?String(row[issueCol]||'User feedback'):'User feedback';const detail=detailCol>=0?String(row[detailCol]||''):'';const source=sourceCol>=0?String(row[sourceCol]||''):'';if(stage7UpsertReview_(kind,id,name,'Feedback: '+issue,'Medium',source,detail))added++;});return added;}

function stage7UpsertReview_(kind,id,name,issueType,severity,sourceUrl,evidence){const sheet=stage7Spreadsheet_().getSheetByName(STAGE7_CONFIG.SHEETS.centralQueue);if(!sheet)return false;const last=sheet.getLastRow();if(last>=2){const rows=sheet.getRange(2,1,last-1,12).getValues();for(let i=0;i<rows.length;i++){const r=rows[i];const same=String(r[2]||'').toLowerCase()===String(kind||'').toLowerCase()&&String(r[3]||'')===String(id||'')&&String(r[5]||'')===String(issueType||'');const open=!/^(resolved|ignore \/ false positive|reviewed - no data change|data updated)$/i.test(String(r[9]||''));if(same&&open){sheet.getRange(i+2,8,1,5).setValues([[sourceUrl||r[7],evidence||r[8],r[9]||'New',r[10]||'',new Date()]]);return false;}}}sheet.appendRow([Utilities.getUuid(),new Date(),kind,id,name,issueType,severity,sourceUrl,evidence,'New','',new Date()]);return true;}

function stage7ReviewMasterHealth_(){const defs=STAGE7_CONFIG.KINDS;const out={checked:0,queued:0};Object.keys(defs).forEach(function(key){const result=stage7ReviewMasterKind_(defs[key]);out.checked+=result.checked;out.queued+=result.queued;});return out;}

function stage7ReviewMasterKind_(def){const sheet=stage7Spreadsheet_().getSheetByName(def.master);if(!sheet||sheet.getLastRow()<2)return {checked:0,queued:0};const values=sheet.getDataRange().getValues();const headers=stage7HeaderMap_(values[0]);const idCol=stage7FindHeader_(headers,[def.idHeader]);const nameCol=stage7FindHeader_(headers,[def.nameHeader]);const finderCol=def.finderEligibleHeader?stage7FindHeader_(headers,[def.finderEligibleHeader]):-1;let queued=0,checked=0;values.slice(1).forEach(function(row){const id=idCol>=0?String(row[idCol]||'').trim():'';if(!id)return;if(finderCol>=0&&String(row[finderCol]||'').trim()&&!/^yes$/i.test(String(row[finderCol]||'').trim()))return;checked++;const name=nameCol>=0?String(row[nameCol]||''):id;const status=stage7FirstHeaderValue_(row,headers,def.statusHeaders);if(def.skipPattern&&def.skipPattern.test(status))return;const source=stage7FirstHeaderValue_(row,headers,def.sourceHeaders);if(!source){if(stage7UpsertReview_(def.key,id,name,'Missing official/current source','High','', 'No usable official/current source is stored in the master.'))queued++;}if(/needs review/i.test(status)){if(stage7UpsertReview_(def.key,id,name,'Master status needs review','Medium',source,'Current master status: '+status))queued++;}const verified=stage7NewestDateFromHeaders_(row,headers,def.verifiedHeaders);if(verified&&(Date.now()-verified.getTime())/86400000>STAGE7_CONFIG.STALE_DAYS){if(stage7UpsertReview_(def.key,id,name,'Stale verification','Low',source,'Last verification evidence is more than '+STAGE7_CONFIG.STALE_DAYS+' days old.'))queued++;}if(def.openPattern&&def.openPattern.test(status)){const deadline=stage7LatestParsedDateFromHeaders_(row,headers,def.deadlineHeaders);if(deadline&&deadline.getTime()<stage7StartOfToday_().getTime()){if(stage7UpsertReview_(def.key,id,name,'Open status after stored deadline','Medium',source,'Stored application/entry deadline has passed while status still appears open/available. Human review required; no automatic status change.'))queued++;}}});return {checked:checked,queued:queued};}

function stage7EnsureOperationalSheets_(ss){const specs=[[STAGE7_CONFIG.SHEETS.dashboard,120,12,false],['_ScholarshipMonitor',1200,13,true],['Scholarship Update Queue',1200,11,true],['Scholarship Update Log',1200,10,true],[STAGE7_CONFIG.SHEETS.centralQueue,2000,12,true],[STAGE7_CONFIG.SHEETS.runLog,2000,11,true]];specs.forEach(function(spec){let sh=ss.getSheetByName(spec[0]);if(!sh)sh=ss.insertSheet(spec[0],ss.getNumSheets(),{rows:spec[1],columns:spec[2]});if(spec[3])sh.hideSheet();});}
function stage7SetRuntimeStatus_(value,health,action){const sheet=stage7Spreadsheet_().getSheetByName(STAGE7_CONFIG.SHEETS.dashboard);if(sheet)sheet.getRange('B3:D3').setValues([[value,health,action]]);}
function stage7AppendRunLog_(r){const sheet=stage7Spreadsheet_().getSheetByName(STAGE7_CONFIG.SHEETS.runLog);if(sheet)sheet.appendRow([new Date(),r.job||'',r.kind||'',Number(r.checked||0),Number(r.baselines||0),Number(r.changes||0),Number(r.manual||0),Number(r.errors||0),Number(r.reviewItems||0),Number(r.duration||0),r.notes||'']);}
function stage7Spreadsheet_(){return SpreadsheetApp.openById(STAGE7_CONFIG.SPREADSHEET_ID);}
function stage7EmptyTotals_(){return {checked:0,baselines:0,changes:0,manual:0,errors:0,reviewItems:0};}
function stage7MergeTotals_(target,source){['checked','baselines','changes','manual','errors','reviewItems'].forEach(function(k){target[k]+=Number(source[k]||0);});}
function stage7DateMs_(value){if(value instanceof Date&&!isNaN(value.getTime()))return value.getTime();const d=new Date(value||0);return isNaN(d.getTime())?0:d.getTime();}
function stage7StartOfToday_(){const d=new Date();d.setHours(0,0,0,0);return d;}
function stage7FormatDateTime_(d){return Utilities.formatDate(d,STAGE7_CONFIG.TIMEZONE,'d MMM yyyy HH:mm');}
function stage7ShortError_(err){return String(err&&err.message?err.message:err||'Unknown error').slice(0,400);}

function stage7ReadableText_(html){let s=String(html||'');s=s.replace(/<!--[\s\S]*?-->/g,' ').replace(/<(script|style|noscript|svg|iframe)[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;|&#34;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/\s+/g,' ').trim();if(!s)return '';const sentences=s.split(/[.!?]\s+|[\r\n]+/);const signal=sentences.filter(function(part){return /\b(apply|application|deadline|closing|register|registration|eligible|eligibility|age|student|school|teacher|fee|cost|free|award|scholarship|bursary|grant|competition|programme|program|2026|2027|date|open|closed)\b/i.test(part);}).join(' ');return signal.length>=STAGE7_CONFIG.MIN_READABLE_CHARS?signal.slice(0,60000):s.slice(0,60000);}
function stage7Fingerprint_(text){const normalized=String(text||'').toLowerCase().replace(/\s+/g,' ').trim();const digest=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,normalized,Utilities.Charset.UTF_8);return Utilities.base64EncodeWebSafe(digest);}
function stage7HeaderMap_(headers){const out={};headers.forEach(function(h,i){out[stage7Canon_(h)]=i;});return out;}
function stage7Canon_(v){return String(v||'').toLowerCase().replace(/[^a-z0-9]/g,'');}
function stage7FindHeader_(map,names){for(let i=0;i<names.length;i++){const key=stage7Canon_(names[i]);if(Object.prototype.hasOwnProperty.call(map,key))return map[key];}return -1;}
function stage7FirstHeaderValue_(row,map,names){for(let i=0;i<names.length;i++){const col=stage7FindHeader_(map,[names[i]]);if(col>=0&&String(row[col]||'').trim())return String(row[col]).trim();}return '';}
function stage7NewestDateFromHeaders_(row,map,names){let newest=null;names.forEach(function(name){const col=stage7FindHeader_(map,[name]);if(col<0||!row[col])return;const d=stage7ParseLooseDate_(row[col]);if(d&&(!newest||d>newest))newest=d;});return newest;}
function stage7LatestParsedDateFromHeaders_(row,map,names){let latest=null;names.forEach(function(name){const col=stage7FindHeader_(map,[name]);if(col<0||!row[col])return;const d=stage7ParseLooseDate_(row[col]);if(d&&(!latest||d>latest))latest=d;});return latest;}
function stage7ParseLooseDate_(value){if(value instanceof Date&&!isNaN(value.getTime()))return value;const s=String(value||'').trim();if(!s||/\b(tba|tbc|unknown|no separate application|current|varies)\b/i.test(s))return null;let m=s.match(/\b(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(20\d{2})\b/i);if(m){const months={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,sept:8,oct:9,nov:10,dec:11};const mon=m[2].toLowerCase().slice(0,4)==='sept'?'sept':m[2].toLowerCase().slice(0,3);return new Date(Number(m[3]),months[mon],Number(m[1]));}m=s.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);if(m)return new Date(Number(m[1]),Number(m[2])-1,Number(m[3]));const d=new Date(s);return isNaN(d.getTime())?null:d;}
