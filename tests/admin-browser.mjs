import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import {newState,attachLead,recordEvent} from '../dist/teste/engine.js';
import {config} from '../dist/teste/config.js';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.ROMPA_ADMIN_TEST_URL||'http://127.0.0.1:4181';
if(!base.endsWith(':4181'))throw new Error('Execute este teste apenas no servidor isolado da porta 4181.');
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
const context=await browser.newContext({viewport:{width:1440,height:1050}}),page=await context.newPage();const errors=[];
page.on('pageerror',e=>errors.push(e.message));
await mkdir(new URL('../test-artifacts/',import.meta.url),{recursive:true});
const screenshot=name=>page.screenshot({path:fileURLToPath(new URL(`../test-artifacts/${name}.png`,import.meta.url)),fullPage:true});
const noOverflow=async()=>{const result=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>({tag:e.tagName,cls:e.className,right:e.getBoundingClientRect().right})).slice(0,30)}));assert.ok(result.scroll<=result.width,JSON.stringify(result));};
const created=[];
try{
  await page.goto(`${base}/admin/`);await page.locator('#email').waitFor();
  await page.locator('#email').fill('admin-qa@example.test');await page.locator('#password').fill('Rompa-QA-only-2026!');
  if(await page.locator('#confirm').count())await page.locator('#confirm').fill('Rompa-QA-only-2026!');
  await page.locator('#auth-form button').click();await page.locator('.kpis').waitFor();await screenshot('admin-empty-desktop');
  for(let i=0;i<8;i++){
    const s=newState({utm_source:i%2?'instagram':'newsletter',utm_campaign:'qa-administracao'});s.storage_consent={accepted:true,version:config.privacyVersion};s.screen='Q02';s.answers={area_principal:i%2?'PROJETOS_OBJETIVOS':'FAMILIA'};recordEvent(s,'test_start');
    if(i<6){s.answers={area_principal:'PROJETOS_OBJETIVOS',frase_espelho:'P01',padrao_declarado:i===0?'<img src=x onerror=alert(1)>':'Começo projetos e paro antes de concluir.',frequencia_percebida:'FREQUENTE',tempo_percebido:'ANOS',gatilhos:['FRUSTRACAO','PRESSAO'],percepcao_sinais:'NAO',momento_percepcao:['BEFORE','AFTER','DURING'][i%3],capacidade_pausa:'RARAMENTE',resposta_recorrente:'Adio o próximo passo.',consequencias:['ABANDONO'],prioridade_mudanca:'Concluir um projeto.',resultado_desejado:'Terminar o que comecei.',solucoes_anteriores:['LIVROS','VIDEOS']};s.screen='complete';recordEvent(s,'test_completed');}
    if(i<4){attachLead(s,{first_name:`QA Pessoa ${i+1}`,whatsapp:'5511999999999',email:`pessoa${i+1}@example.test`,privacy_acceptance:true,marketing_consent:i%2===0});s.screen='profile';s.feedback=i%3;recordEvent(s,'profile_viewed');}
    const res=await fetch(`${base}/api/assessments`,{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({id:s.assessment.id,session_id:s.session.id,token:randomBytes(32).toString('hex'),state:s})});assert.equal(res.status,201);created.push(await res.json());
  }
  await page.getByRole('button',{name:'↻ Atualizar'}).click();await page.getByText('8 questionário(s) no recorte',{exact:false}).waitFor();await noOverflow();await screenshot('admin-dashboard-desktop');
  const nums=await page.locator('.kpi strong').allTextContents();assert.deepEqual(nums,['8','75%','4','4']);
  await page.locator('[data-view="insights"]').click();await page.getByRole('heading',{name:'Gatilhos relatados'}).waitFor();await screenshot('admin-indicators-desktop');
  await page.locator('[data-view="records"]').click();await page.locator('[name="search"]').fill('QA Pessoa 1');await page.getByRole('button',{name:'Aplicar filtros'}).click();await page.getByText('1 questionário(s) no recorte',{exact:false}).waitFor();assert.equal(await page.locator('tbody tr').count(),1);
  await page.getByRole('button',{name:'Ver questionário de QA Pessoa 1'}).click();await page.getByRole('heading',{name:'Respostas do questionário'}).waitFor();assert.equal(await page.locator('#detail img').count(),0);assert.ok((await page.locator('#detail').textContent()).includes('<img src=x'));await screenshot('admin-detail-desktop');
  await page.getByRole('button',{name:'Fechar detalhes'}).click();await page.getByRole('button',{name:'Limpar',exact:true}).click();await page.getByText('8 questionário(s) no recorte',{exact:false}).waitFor();
  await page.locator('[name="area"]').selectOption('DINHEIRO');await page.getByRole('button',{name:'Aplicar filtros'}).click();await page.getByRole('heading',{name:'Nenhum questionário encontrado'}).waitFor();
  await page.getByRole('button',{name:'Limpar',exact:true}).click();await page.getByText('8 questionário(s) no recorte',{exact:false}).waitFor();await page.locator('[data-view="dashboard"]').click();
  await page.setViewportSize({width:390,height:844});await noOverflow();await screenshot('admin-dashboard-mobile');
  await page.getByRole('button',{name:'Ver questionário de QA Pessoa 1'}).click();await page.getByRole('heading',{name:'Respostas do questionário'}).waitFor();await noOverflow();await screenshot('admin-detail-mobile');
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Excluir este questionário'}).click();await page.getByText('7 questionário(s) no recorte',{exact:false}).waitFor();
  await page.getByRole('button',{name:'Sair da conta'}).click();await page.locator('#auth-form').waitFor();await page.reload();await page.locator('#auth-form').waitFor();
  const protectedRes=await page.request.post(`${base}/api/admin/query`,{headers:{Origin:base},data:{}});assert.equal(protectedRes.status(),401);assert.deepEqual(errors,[]);
  console.log('Admin browser QA passed: setup/login, real API fixtures in isolated DB, metrics, search, filters, detail/XSS, deletion, logout, desktop/mobile.');
}finally{
  for(const c of created)await fetch(`${base}/api/assessments/${c.id}`,{method:'DELETE',headers:{Origin:base,'Content-Type':'application/json',Authorization:`Bearer ${c.token}`},body:'{}'});
  await browser.close();
}
