/**
 * Stage9Provision.gs — one-time-per-version provisioning hook.
 * Any normal Apps Script execution after a GitHub deployment provisions Stage 9
 * without a separate manual install action.
 */
function stage9AutoProvision_(){
  try{
    const props=PropertiesService.getScriptProperties();
    const key='stage9_provisioned_version';
    if(props.getProperty(key)===STAGE9_CONFIG.VERSION)return;
    const ss=stage9Spreadsheet_();
    stage9EnsureSheets_(ss);
    const trigger=stage9EnsureTrigger_();
    stage9SetDashboardStatus_('Installed','Active','Stage 9 '+STAGE9_CONFIG.VERSION+' auto-provisioned; '+trigger+'.');
    stage9AppendRunLog_({job:'stage9-provision',checked:0,changes:0,errors:0,reviewItems:0,notes:'Stage 9 '+STAGE9_CONFIG.VERSION+' policy/log sheets and daily trigger provisioned automatically after deployment.'});
    props.setProperty(key,STAGE9_CONFIG.VERSION);
  }catch(err){
    console.log('Stage 9 automatic provisioning deferred: '+String(err&&err.message?err.message:err));
  }
}
stage9AutoProvision_();
