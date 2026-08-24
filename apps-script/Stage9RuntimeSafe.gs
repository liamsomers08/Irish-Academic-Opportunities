/**
 * Stage9RuntimeSafe.gs — deployment-safe provisioning wrapper for Stage 9.
 *
 * Google Apps Script Spreadsheet.insertSheet() advanced options only support a
 * template sheet. This wrapper creates the Stage 9 sheets using supported
 * overloads before the Stage9Autonomous runtime sees them, and schedules the
 * safe daily entry point below.
 */
function stage9EnsureSheetsSafe_(ss){
  let policy=ss.getSheetByName(STAGE9_CONFIG.SHEETS.policy);
  if(!policy){
    policy=ss.insertSheet(STAGE9_CONFIG.SHEETS.policy,Math.min(9,ss.getNumSheets()));
    stage9SeedPolicy_(policy);
  }

  let log=ss.getSheetByName(STAGE9_CONFIG.SHEETS.changeLog);
  if(!log){
    log=ss.insertSheet(STAGE9_CONFIG.SHEETS.changeLog,ss.getNumSheets());
    if(log.getMaxRows()<3000)log.insertRowsAfter(log.getMaxRows(),3000-log.getMaxRows());
    log.getRange(1,1,1,15).setValues([['Change ID','Applied At','Run ID','Kind','Opportunity ID','Opportunity Name','Field','Old Value','New Value','Confidence','Source URL','Evidence','Outcome','Regression Gate','Review IDs']]);
    stage9StyleHeader_(log,15);
    log.setFrozenRows(1);
    log.hideSheet();
  }
  return {policy:policy,changeLog:log};
}

function stage9EnsureSafeTrigger_(){
  const handler='stage9RunDailySafe';
  ScriptApp.getProjectTriggers().forEach(function(trigger){
    const fn=trigger.getHandlerFunction();
    if(fn==='stage9RunDaily'||fn===handler)ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger(handler)
    .timeBased()
    .everyDays(1)
    .atHour(STAGE9_CONFIG.DAILY_HOUR)
    .nearMinute(STAGE9_CONFIG.DAILY_MINUTE)
    .inTimezone(STAGE9_CONFIG.TIMEZONE)
    .create();
  return 'daily around '+String(STAGE9_CONFIG.DAILY_HOUR).padStart(2,'0')+':'+String(STAGE9_CONFIG.DAILY_MINUTE).padStart(2,'0')+' '+STAGE9_CONFIG.TIMEZONE;
}

function stage9RunDailySafe(){
  const ss=stage9Spreadsheet_();
  stage9EnsureSheetsSafe_(ss);
  return stage9RunDaily();
}

function stage9ProvisionSafe_(){
  const ss=stage9Spreadsheet_();
  stage9EnsureSheetsSafe_(ss);
  const trigger=stage9EnsureSafeTrigger_();
  const props=PropertiesService.getScriptProperties();
  // Prevent the older bootstrap helper from creating a second daily entry point.
  props.setProperty('stage9_bootstrap_version',STAGE9_CONFIG.VERSION);
  props.setProperty('stage9_provisioned_version',STAGE9_CONFIG.VERSION);
  stage9SetDashboardStatus_('Installed','Active','Stage 9 '+STAGE9_CONFIG.VERSION+' provisioned; '+trigger+'.');
  stage9AppendRunLog_({job:'stage9-provision',checked:0,changes:0,errors:0,reviewItems:0,notes:'Stage 9 '+STAGE9_CONFIG.VERSION+' policy/log sheets and safe daily trigger provisioned automatically after deployment.'});
  return {ok:true,version:STAGE9_CONFIG.VERSION,trigger:trigger,policy:stage9GetPolicy_(ss)};
}
