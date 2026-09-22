// Cada participante recebe uma credencial de escrita; ela nunca vai para URLs ou analytics.
export function createSync(getState,onCredential,onStatus){
  let timer,pending=null,running=null,stopped=false,retries=0;
  async function request(url,method,body,token){
    const res=await fetch(url,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
    const result=await res.json();if(!res.ok)throw Object.assign(new Error(result.error||'Falha ao salvar.'),{status:res.status});return result;
  }
  async function drain(){
    if(running||stopped||!pending)return running;
    running=(async()=>{
      try{
        while(pending&&!stopped){
          const snapshot=pending;pending=null;const current=getState();let credential=current.remote;
          if(!credential?.registered){
            if(!credential){credential={id:current.assessment.id,token:Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join(''),revision:0,registered:false};onCredential(credential);}
            const result=await request('/api/assessments','POST',{id:current.assessment.id,session_id:current.session.id,token:credential.token,state:snapshot});credential={...result,registered:true};onCredential(credential);
            // Uma repetição de cadastro pode recuperar registro anterior; enviar o snapshot mais recente.
            const saved=await request(`/api/assessments/${credential.id}`,'PUT',{revision:credential.revision+1,state:snapshot},credential.token);onCredential({...credential,revision:saved.revision});
          }
          else {const result=await request(`/api/assessments/${credential.id}`,'PUT',{revision:credential.revision+1,state:snapshot},credential.token);onCredential({...credential,revision:result.revision});}
          retries=0;onStatus('saved');
        }
      }catch(error){
        if(error.status===410){stopped=true;pending=null;onStatus('deleted');}
        else {pending=getState();onStatus('error');if(++retries<=3)timer=setTimeout(()=>drain(),2000*retries);}
      }finally{running=null;}
    })();return running;
  }
  const schedule=()=>{
    if(stopped||!getState().storage_consent?.accepted)return;
    const state=getState();pending=structuredClone({version:state.version,session:state.session,answers:state.answers,user:state.user,events:state.events,screen:state.screen,feedback:state.feedback,storage_consent:state.storage_consent});
    onStatus('saving');clearTimeout(timer);timer=setTimeout(drain,160);
  };
  const retry=()=>{retries=0;schedule();};window.addEventListener('online',retry);
  return {schedule,async flush(){clearTimeout(timer);await drain();if(pending&&!stopped)await drain();},async remove(){
    clearTimeout(timer);await running;pending=null;const credential=getState().remote;
    if(credential){try{await request(`/api/assessments/${credential.id}`,'DELETE',{},credential.token);}catch(error){if(![404,410].includes(error.status))throw error;}}
    stopped=true;window.removeEventListener('online',retry);
  }};
}
