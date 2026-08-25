/* Irish geographic availability search layer.
 * geo-search-2026-08-25a
 *
 * Turns place searches such as "Kildare", "Newbridge" or "Naas TY" into
 * availability searches rather than literal keyword-only searches.
 */
(function iaoGeographicSearch(){
  const VERSION='geo-search-2026-08-25a';
  const COUNTY_PLACES={
    'Carlow':['carlow town','tullow','bagenalstown','muine bheag','hacketstown'],
    'Cavan':['cavan town','bailieborough','ballyjamesduff','virginia','cootehill','kingscourt'],
    'Clare':['ennis','shannon','kilrush','ennistymon','lahinch','sixmilebridge'],
    'Cork':['cork city','mallow','midleton','cobh','fermoy','bandon','clonakilty','kinsale','youghal','macroom','skibbereen','bantry','carrigaline','ballincollig'],
    'Donegal':['letterkenny','donegal town','buncrana','ballybofey','stranorlar','bundoran','ballyshannon','carndonagh'],
    'Dublin':['dublin city','swords','tallaght','blanchardstown','lucan','clondalkin','malahide','balbriggan','skerries','dalkey','dun laoghaire','rathfarnham'],
    'Galway':['galway city','tuam','ballinasloe','loughrea','athenry','oranmore','gort','clifden'],
    'Kerry':['tralee','killarney','listowel','dingle','kenmare','castleisland','killorglin'],
    'Kildare':['naas','newbridge','kildare town','maynooth','leixlip','celbridge','athy','kilcock','monasterevin','clane','sallins','rathangan','curragh','prosperous'],
    'Kilkenny':['kilkenny city','castlecomer','thomastown','callan','graiguenamanagh'],
    'Laois':['portlaoise','mountmellick','abbeyleix','stradbally','mountrath'],
    'Leitrim':['carrick on shannon','manorhamilton','drumshanbo','mohill'],
    'Limerick':['limerick city','newcastle west','kilmallock','abbeyfeale','rathkeale'],
    'Longford':['longford town','granard','ballymahon','edgeworthstown'],
    'Louth':['dundalk','drogheda','ardee','dunleer'],
    'Mayo':['castlebar','westport','ballina','claremorris','ballinrobe','swinford','belmullet'],
    'Meath':['navan','trim','kells','ashbourne','ratoath','dunboyne','laytown','bettystown'],
    'Monaghan':['monaghan town','carrickmacross','castleblayney','clones'],
    'Offaly':['tullamore','birr','edenderry','clara','banagher'],
    'Roscommon':['roscommon town','boyle','castlerea','strokestown'],
    'Sligo':['sligo town','tubbercurry','ballymote'],
    'Tipperary':['clonmel','nenagh','thurles','tipperary town','cashel','roscrea','carrick on suir','cahir'],
    'Waterford':['waterford city','dungarvan','tramore','lismore'],
    'Westmeath':['mullingar','athlone','moate'],
    'Wexford':['wexford town','enniscorthy','gorey','new ross','rosslare'],
    'Wicklow':['bray','greystones','wicklow town','arklow','blessington','rathdrum'],
    'Antrim':['antrim town','ballymena','carrickfergus','larne','ballymoney'],
    'Armagh':['armagh city','portadown','lurgan'],
    'Down':['downpatrick','bangor','holywood'],
    'Fermanagh':['enniskillen','lisnaskea'],
    'Derry':['derry city','londonderry','coleraine','limavady','magherafelt'],
    'Tyrone':['omagh','dungannon','cookstown','strabane']
  };
  const SPECIAL_PLACES=[
    {label:'Belfast',aliases:['belfast'],counties:['Antrim','Down'],regions:['Northern Ireland']},
    {label:'Northern Ireland',aliases:['northern ireland'],counties:['Antrim','Armagh','Down','Fermanagh','Derry','Tyrone'],regions:['Northern Ireland']}
  ];
  const BASE_MATCHES=matchesQuery;
  const BASE_RELEVANCE=relevanceScore;
  const geoNorm=value=>norm(value).replace(/[’'.,()\/_-]+/g,' ').replace(/\s+/g,' ').trim();
  const wordHas=(value,phrase)=>(' '+geoNorm(value)+' ').includes(' '+geoNorm(phrase)+' ');
  const intersects=(a,b)=>a.some(v=>b.includes(v));
  const countyNorms=Object.keys(COUNTY_PLACES).reduce((m,k)=>(m[k]=geoNorm(k),m),{});
  const aliasEntries=[];
  for(const [county,towns] of Object.entries(COUNTY_PLACES)){
    const countyAliases=[county,'county '+county,'co '+county];
    if(county==='Derry')countyAliases.push('londonderry','county londonderry','co londonderry');
    for(const alias of countyAliases)aliasEntries.push({alias:geoNorm(alias),label:county,counties:[county],regions:[],isCounty:true});
    for(const town of towns)aliasEntries.push({alias:geoNorm(town),label:town.replace(/\b\w/g,m=>m.toUpperCase()),counties:[county],regions:[],isCounty:false});
  }
  for(const place of SPECIAL_PLACES)for(const alias of place.aliases)aliasEntries.push({alias:geoNorm(alias),label:place.label,counties:place.counties,regions:place.regions||[],isCounty:false});
  aliasEntries.sort((a,b)=>b.alias.length-a.alias.length);

  function resolve(query){
    const cleaned=geoNorm(query);
    if(!cleaned)return null;
    const padded=' '+cleaned+' ';
    for(const entry of aliasEntries){
      const needle=' '+entry.alias+' ';
      const at=padded.indexOf(needle);
      if(at<0)continue;
      const before=padded.slice(1,at).trim();
      const after=padded.slice(at+needle.length-1).trim();
      return {...entry,remainder:[before,after].filter(Boolean).join(' ').trim(),raw:text(query)};
    }
    return null;
  }

  const mentionCache=new WeakMap();
  function mentionedCounties(x,fields){
    const cacheKey=fields.join('|');
    let recordCache=mentionCache.get(x);
    if(!recordCache){recordCache={};mentionCache.set(x,recordCache)}
    if(recordCache[cacheKey])return recordCache[cacheKey];
    const source=geoNorm(fields.map(k=>x?.[k]||'').join(' '));
    const found=[];
    for(const [county,towns] of Object.entries(COUNTY_PLACES)){
      const aliases=[county,'county '+county,'co '+county,...towns];
      if(county==='Derry')aliases.push('londonderry');
      // Bare "Down" is ordinary English, so only use explicit forms/towns when
      // inferring restrictions from record prose.
      const safeAliases=county==='Down'?['county down','co down',...towns]:aliases;
      if(safeAliases.some(a=>wordHas(source,a)))found.push(county);
    }
    recordCache[cacheKey]=found;
    return found;
  }

  function targetHit(textValue,geo){
    const v=geoNorm(textValue);
    if(!v)return false;
    if(wordHas(v,geo.alias))return true;
    return geo.counties.some(c=>wordHas(v,c)||wordHas(v,'county '+c)||wordHas(v,'co '+c));
  }
  function regionHit(textValue,geo){return (geo.regions||[]).some(r=>wordHas(textValue,r))}
  function isOnline(x){return /\bonline\b|\bvirtual\b|\bremote\b|\bhybrid\b/.test(geoNorm([x.mode,x.location,x.scope].join(' ')))}
  function nationalCue(x){return /\bnational\b|\bnationwide\b|\ball ireland\b|\bireland wide\b|\birish national\b/.test(geoNorm([x.scope,x.competitionLevel,x.eligibility,x.entry].join(' ')))}
  function localRestrictionCue(x){return /\blocal\b|\bregional\b|\bcentre\b|\bcenter\b|\bparticipants?\b|\bmust be enrolled\b|\bschools? in\b|\bresidents?\b|\bcounty council\b|\bfrom county\b|\benrichment\b/.test(geoNorm([x.name,x.eligibility,x.accessRestrictions,x.entry,x.description].join(' ')))}

  function availabilityScore(x,geo){
    if(!geo)return 0;
    const targetCounties=geo.counties||[];
    const directFields=[x.county,x.location,x.scope,x.name,x.eligibility,x.accessRestrictions].join(' ');
    if(targetHit(directFields,geo)){
      if(wordHas([x.location,x.county].join(' '),geo.alias))return 130;
      return 115;
    }
    if(regionHit([x.county,x.location,x.scope,x.studyCountry,x.studyInstitution,x.eligibility].join(' '),geo))return 100;

    if(x.kind==='programmes'){
      const explicit=mentionedCounties(x,['county','location']);
      const matching=targetCounties.filter(c=>explicit.includes(c));
      if(matching.length)return 110;
      if(isOnline(x))return 85;
      if(explicit.length&&!matching.length)return 0;
      const restrictionCounties=mentionedCounties(x,['name','accessRestrictions','eligibility']);
      if(restrictionCounties.length&&!intersects(targetCounties,restrictionCounties)&&localRestrictionCue(x))return 0;
      if(nationalCue(x))return 60;
      return 0;
    }

    if(x.kind==='competitions'){
      const restrictionCounties=mentionedCounties(x,['name','eligibility','entry','accessRestrictions']);
      if(restrictionCounties.length&&!intersects(targetCounties,restrictionCounties)&&localRestrictionCue(x))return 0;
      if(isOnline(x))return 80;
      if(nationalCue(x)||/\birish school\b|\bireland\b/.test(geoNorm([x.eligibility,x.entry,x.description].join(' '))))return 65;
      // Competition records in this finder are already vetted for Irish access;
      // unless the record carries a local restriction, keep them discoverable.
      return 45;
    }

    if(x.kind==='scholarships'){
      const restrictionCounties=mentionedCounties(x,['name','provider','eligibility']);
      if(restrictionCounties.length&&!intersects(targetCounties,restrictionCounties)&&localRestrictionCue(x))return 0;
      if(regionHit([x.studyCountry,x.studyInstitution,x.eligibility].join(' '),geo))return 90;
      if(/\bireland\b|\birish\b|\bnorthern ireland\b/.test(geoNorm([x.studyCountry,x.eligibility,x.studyInstitution].join(' '))))return 65;
      // Funding can be used by an Irish applicant even when the study destination
      // is elsewhere; the master has already been vetted for Irish eligibility.
      return 45;
    }
    return 0;
  }

  matchesQuery=function geographicMatchesQuery(x,q){
    if(!q)return true;
    const geo=resolve(q);
    if(!geo)return BASE_MATCHES(x,q);
    if(geo.remainder&&!BASE_MATCHES(x,geo.remainder))return false;
    return availabilityScore(x,geo)>0;
  };

  relevanceScore=function geographicRelevanceScore(x,q){
    if(!q)return 0;
    const geo=resolve(q);
    if(!geo)return BASE_RELEVANCE(x,q);
    const textScore=geo.remainder?BASE_RELEVANCE(x,geo.remainder):0;
    return availabilityScore(x,geo)+textScore;
  };

  window.IAO_GEO_SEARCH={VERSION,resolve,availabilityScore,counties:Object.keys(COUNTY_PLACES)};
})();
