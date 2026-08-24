/* Stage 2: unified upcoming/calendar layer derived from the three public live datasets. */
const calendarState={horizon:'30',kind:'',eventType:'',certainty:'',q:''};
let calendarCache={signature:'',events:[]};

function calToday(){const d=new Date();d.setHours(0,0,0,0);return d}
function calDate(v){
  if(v===null||v===undefined||v==='')return null;
  const s=text(v).replace(/\u00a0/g,' ').trim();
  if(!s||/\b(tba|tbc|unknown|no student application|no separate application|closed)\b/i.test(s))return null;
  if(/^\d{5}(?:\.\d+)?$/.test(s)){const n=Number(s);if(n>30000&&n<70000){const d=new Date(1899,11,30);d.setDate(d.getDate()+Math.floor(n));d.setHours(0,0,0,0);return d}}
  const months={january:0,february:1,march:2,april:3,may:4,june:5,july:6,august:7,september:8,october:9,november:10,december:11,jan:0,feb:1,mar:2,apr:3,jun:5,jul:6,aug:7,sep:8,sept:8,oct:9,nov:10,dec:11};
  let m=s.match(/\b(\d{1,2})(?:\s*[-–]\s*\d{1,2})?\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(20\d{2})\b/i);
  if(m){const d=new Date(+m[3],months[m[2].toLowerCase()],+m[1]);d.setHours(0,0,0,0);return d}
  m=s.match(/\b(20\d{2})[-\/](\d{1,2})[-\/](\d{1,2})\b/);
  if(m){const d=new Date(+m[1],+m[2]-1,+m[3]);d.setHours(0,0,0,0);return d}
  m=s.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,)?\s+(20\d{2})\b/i);
  if(m){const d=new Date(+m[3],months[m[1].toLowerCase()],+m[2]);d.setHours(0,0,0,0);return d}
  const parsed=new Date(s);
  if(!Number.isNaN(parsed.getTime())){parsed.setHours(0,0,0,0);return parsed}
  return null;
}
function calCertainty(x){const s=norm((x.dateStatus||'')+' '+(x.currentStatus||''));if(/expected|previous years|provisional|estimated|partially confirmed|partial confirmation/.test(s))return'expected';if(/confirmed|official|fixed|published/.test(s))return'confirmed';return'recorded'}
function calCertaintyLabel(v){return v==='confirmed'?'Confirmed':v==='expected'?'Expected / provisional':'Date recorded'}
function calEventLabel(v){return({deadline:'Deadline','programme-start':'Programme start','competition-date':'Competition date','application-open':'Applications open',other:'Other important date'})[v]||'Important date'}
function calKindLabel(v){return v==='competitions'?'Competition':v==='programmes'?'Programme':'Funding'}
function calDays(date){return Math.round((date-calToday())/86400000)}
function calRelative(date){const n=calDays(date);return n===0?'Today':n===1?'Tomorrow':n>1?'In '+n+' days':Math.abs(n)+' days ago'}
function calDateLong(date){return new Intl.DateTimeFormat('en-IE',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(date)}
function calDateShort(date){return new Intl.DateTimeFormat('en-IE',{day:'numeric',month:'short'}).format(date)}
function calMonth(date){return new Intl.DateTimeFormat('en-IE',{month:'long',year:'numeric'}).format(date)}

function buildCalendarEvents(){
  const source=allData(),signature=source.length+'|'+source.map(x=>x.id).slice(-4).join('|');
  if(calendarCache.signature===signature)return calendarCache.events;
  const events=[],seen=new Set();
  const add=(x,eventType,label,value)=>{
    const date=calDate(value);if(!date)return;
    const key=[x.id,eventType,label,date.getTime()].join('|');if(seen.has(key))return;seen.add(key);
    events.push({key,opportunity:x,id:x.id,kind:x.kind,eventType,label,rawDate:text(value),date,certainty:calCertainty(x),dateStatus:x.dateStatus||'',name:x.name,provider:x.provider,subject:x.subject,url:x.url});
  };
  source.forEach(x=>{
    if(x.kind==='competitions'){
      add(x,'application-open','Registration opens',x.applicationOpens);
      add(x,'deadline','Registration deadline',x.applicationDeadline);
      add(x,'deadline','Submission deadline',x.submissionDeadline);
      add(x,'competition-date','First / preliminary round',x.firstRound);
      add(x,'competition-date','Regional round',x.regionalRound);
      add(x,'competition-date','National round',x.nationalRound);
      add(x,'competition-date','National final',x.nationalFinal);
      add(x,'competition-date','International round / final',x.internationalFinal);
      add(x,'competition-date','Competition starts',x.startDate);
      add(x,'competition-date','Competition ends',x.endDate);
      add(x,'other','Results date',x.resultsDate);
    }else if(x.kind==='programmes'){
      add(x,'application-open','Applications open',x.applicationOpens);
      add(x,'deadline','Application deadline',x.applicationDeadline);
      add(x,'programme-start','Programme starts',x.startDate);
      add(x,'other','Programme ends',x.endDate);
    }else if(x.kind==='scholarships'){
      add(x,'application-open','Applications open',x.applicationOpens);
      add(x,'deadline','Application deadline',x.applicationDeadline);
    }
  });
  events.sort((a,b)=>a.date-b.date||(a.certainty==='confirmed'?-1:1)||a.name.localeCompare(b.name));
  calendarCache={signature,events};return events;
}
function futureCalendarEvents(){const today=calToday();return buildCalendarEvents().filter(e=>e.date>=today)}
function withinDays(events,days){if(days==='all')return events;const n=Number(days),today=calToday(),end=new Date(today);end.setDate(end.getDate()+n);return events.filter(e=>e.date>=today&&e.date<=end)}
function filteredCalendarEvents(){
  let arr=withinDays(futureCalendarEvents(),calendarState.horizon);
  if(calendarState.kind)arr=arr.filter(e=>e.kind===calendarState.kind);
  if(calendarState.eventType)arr=arr.filter(e=>e.eventType===calendarState.eventType);
  if(calendarState.certainty)arr=arr.filter(e=>e.certainty===calendarState.certainty);
  if(calendarState.q){const q=norm(calendarState.q);arr=arr.filter(e=>norm([e.name,e.provider,e.subject,e.label,e.rawDate,e.dateStatus,e.opportunity.searchText].join(' ')).includes(q))}
  return arr;
}
function calendarStats(){const all=futureCalendarEvents();return{d7:withinDays(all,'7').length,d30:withinDays(all,'30').length,d60:withinDays(all,'60').length,confirmed:all.filter(e=>e.certainty==='confirmed').length,expected:all.filter(e=>e.certainty==='expected').length}}

function calendarEventCard(e,{compact=false}={}){
  const x=e.opportunity,certainty=e.certainty==='expected'?' expected':e.certainty==='confirmed'?' confirmed':' recorded';
  if(compact)return '<article class="event-home-card"><div class="event-date"><strong>'+esc(calDateShort(e.date))+'</strong><small>'+esc(calRelative(e.date))+'</small></div><div class="event-home-body"><span class="type">'+esc(calKindLabel(e.kind))+' · '+esc(e.label)+'</span><h3>'+esc(e.name)+'</h3><p>'+esc(e.provider||'')+'</p><div class="badges">'+(e.subject?'<span class="badge sub">'+esc(e.subject)+'</span>':'')+'<span class="calendar-confidence'+certainty+'">'+esc(calCertaintyLabel(e.certainty))+'</span></div></div><button class="event-arrow" data-detail="'+esc(e.id)+'" aria-label="View details">›</button></article>';
  return '<article class="calendar-event"><div class="calendar-date-cell"><strong>'+esc(new Intl.DateTimeFormat('en-IE',{day:'2-digit'}).format(e.date))+'</strong><span>'+esc(new Intl.DateTimeFormat('en-IE',{month:'short'}).format(e.date))+'</span><small>'+esc(calRelative(e.date))+'</small></div><div class="calendar-event-body"><div class="calendar-event-top"><span class="type">'+esc(calKindLabel(e.kind))+(e.id?' · '+esc(e.id):'')+'</span><span class="calendar-confidence'+certainty+'">'+esc(calCertaintyLabel(e.certainty))+'</span></div><h3>'+esc(e.name)+'</h3><p class="provider">'+esc(e.provider||'')+'</p><div class="calendar-event-meta"><span><b>'+esc(e.label)+'</b></span><span>'+esc(e.rawDate)+'</span>'+(e.subject?'<span>'+esc(e.subject)+'</span>':'')+(e.dateStatus?'<span>'+esc(e.dateStatus)+'</span>':'')+'</div><div class="actions calendar-actions"><button class="detail" data-detail="'+esc(e.id)+'">Opportunity details</button>'+(e.url?'<a class="official" href="'+esc(e.url)+'" target="_blank" rel="noopener">Official page ↗</a>':'')+'<button class="heart '+(saved.has(e.id)?'on':'')+'" data-save="'+esc(e.id)+'" aria-label="'+(saved.has(e.id)?'Remove from saved':'Save opportunity')+'">'+(saved.has(e.id)?'♥':'♡')+'</button></div></div></article>';
}
function calendarEmpty(){return '<div class="empty"><strong>No dated events match this calendar view.</strong><br>Try a longer horizon or include expected / provisional dates.</div>'}
function renderCalendarTimeline(events){
  if(!events.length)return calendarEmpty();
  const groups=new Map();events.forEach(e=>{const key=calMonth(e.date);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(e)});
  return [...groups.entries()].map(([month,items])=>'<section class="calendar-month"><div class="calendar-month-head"><h2>'+esc(month)+'</h2><span>'+items.length+' event'+(items.length===1?'':'s')+'</span></div>'+items.map(e=>calendarEventCard(e)).join('')+'</section>').join('');
}
function syncCalendarControls(){
  document.querySelectorAll('[data-cal-horizon]').forEach(b=>b.classList.toggle('active',b.dataset.calHorizon===calendarState.horizon));
  if($('calendarKind'))$('calendarKind').value=calendarState.kind;if($('calendarEventType'))$('calendarEventType').value=calendarState.eventType;if($('calendarCertainty'))$('calendarCertainty').value=calendarState.certainty;if($('calendarQ'))$('calendarQ').value=calendarState.q;
}
function renderCalendarSummary(){const s=calendarStats();$('cal7').textContent=s.d7;$('cal30').textContent=s.d30;$('cal60').textContent=s.d60;$('calConfirmed').textContent=s.confirmed;$('calExpected').textContent=s.expected}
function renderUpcomingHub(){
  $('standardFinder').classList.add('hide');$('upcomingHub').classList.remove('hide');$('title').textContent='Upcoming & calendar';$('desc').textContent='Real dated events from competitions, programmes and funding — confirmed and expected dates are shown separately.';
  renderCalendarSummary();syncCalendarControls();const events=filteredCalendarEvents();$('calendarCount').textContent=events.length+' dated event'+(events.length===1?'':'s');$('calendarRangeLabel').textContent=calendarState.horizon==='all'?'all future dated events':'next '+calendarState.horizon+' days';$('calendarResults').innerHTML=renderCalendarTimeline(events);history.replaceState(null,'',urlFor());
}
function hideUpcomingHub(){$('upcomingHub')?.classList.add('hide');$('standardFinder')?.classList.remove('hide')}

const stage1RenderFinder=renderFinder;
renderFinder=function(){if(tab==='upcoming')return renderUpcomingHub();hideUpcomingHub();return stage1RenderFinder()};
const stage1RenderUpcoming=renderUpcoming;
renderUpcoming=function(){
  const items=futureCalendarEvents().slice(0,3),host=$('homeUpcoming');if(!host)return stage1RenderUpcoming();
  host.innerHTML=items.length?items.map(e=>calendarEventCard(e,{compact:true})).join(''):calendarEmpty();
  const counts=calendarStats();if($('homeUpcomingMeta'))$('homeUpcomingMeta').textContent=counts.d30+' dated events in the next 30 days';
};
const stage1UrlFor=urlFor;
urlFor=function(extra={}){const base=stage1UrlFor(extra);if(tab!=='upcoming')return base;const u=new URL(base,location.origin);if(calendarState.horizon!=='30')u.searchParams.set('calHorizon',calendarState.horizon);if(calendarState.kind)u.searchParams.set('calKind',calendarState.kind);if(calendarState.eventType)u.searchParams.set('calEvent',calendarState.eventType);if(calendarState.certainty)u.searchParams.set('calCertainty',calendarState.certainty);if(calendarState.q)u.searchParams.set('calQ',calendarState.q);return u.pathname+(u.searchParams.toString()?'?'+u.searchParams.toString():'')};
const stage1ApplyUrl=applyUrl;
applyUrl=function(){const p=new URLSearchParams(location.search);calendarState.horizon=['7','30','60','all'].includes(p.get('calHorizon'))?p.get('calHorizon'):'30';calendarState.kind=p.get('calKind')||'';calendarState.eventType=p.get('calEvent')||'';calendarState.certainty=p.get('calCertainty')||'';calendarState.q=p.get('calQ')||'';stage1ApplyUrl();if(tab==='upcoming')renderUpcomingHub()};

function updateCalendarState(){calendarState.kind=$('calendarKind').value;calendarState.eventType=$('calendarEventType').value;calendarState.certainty=$('calendarCertainty').value;calendarState.q=$('calendarQ').value.trim();renderUpcomingHub()}
document.addEventListener('click',e=>{const h=e.target.closest('[data-cal-horizon]');if(h){calendarState.horizon=h.dataset.calHorizon;renderUpcomingHub()}const open=e.target.closest('[data-open-calendar]');if(open){calendarState.horizon=open.dataset.openCalendar||'30';setTab('upcoming')}});
['calendarKind','calendarEventType','calendarCertainty'].forEach(id=>$(id)?.addEventListener('change',updateCalendarState));$('calendarQ')?.addEventListener('input',updateCalendarState);$('calendarReset')?.addEventListener('click',()=>{calendarState.horizon='30';calendarState.kind='';calendarState.eventType='';calendarState.certainty='';calendarState.q='';renderUpcomingHub()});
