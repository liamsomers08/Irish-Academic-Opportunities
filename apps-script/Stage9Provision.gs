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
    stage9ProvisionSafe_();
  }catch(err){
    console.log('Stage 9 automatic provisioning deferred: '+String(err&&err.message?err.message:err));
  }
}
stage9AutoProvision_();
