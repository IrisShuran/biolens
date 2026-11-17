const fs=require('fs'),path=require('path'),{spawn}=require('child_process');
const {connect,findBrowser}=require('./cdp-browser.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'qa');fs.mkdirSync(out,{recursive:true});
const server=spawn(process.execPath,[path.join(__dirname,'preview.cjs'),'4206'],{windowsHide:true,stdio:'ignore'});
const browser=spawn(findBrowser(),['--headless=new','--remote-debugging-port=9406',`--user-data-dir=${path.join(out,'full-profile')}`,'--no-first-run','--no-default-browser-check','--disable-background-networking','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'],{windowsHide:true,stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let b;const checks=[],missing=[];
function check(name,pass){checks.push({name,pass:!!pass});if(!pass)console.log('FAIL '+name)}
async function audit(label){await sleep(150);await b.evaluate('BioI18n.refresh()');const untranslated=await b.evaluate(`(()=>{let a=[];const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){if(n.parentElement.closest('script,style,[data-language],.msp-plugin'))continue;if(/[\\u3400-\\u9fff]/.test(n.nodeValue))a.push(n.nodeValue.trim())}return [...new Set(a)]})()`);if(untranslated.length)missing.push({label,text:untranslated});check(label+' English text coverage',!untranslated.length)}
(async()=>{try{
 await sleep(1800);b=await connect({port:9406,autoLaunch:false});
 await b.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 for(const page of ['curriculum.html','index.html','passive.html','membrane.html','mitosis.html','structure-viewer.html']){
  await b.goto('http://127.0.0.1:4206/'+page+'?lang=en');await sleep(page==='structure-viewer.html'?2500:700);await audit(page);
  for(const width of [1440,390]){await b.setViewport(width,900);await sleep(200);check(page+' '+width+' no overflow',await b.evaluate('document.documentElement.scrollWidth<=innerWidth+1'));await b.screenshot(path.join(out,page+'-'+width+'.png'))}
 }
 await b.goto('http://127.0.0.1:4206/index.html?lang=en');await sleep(700);
 for(const world of ['cell','dna','mito','atp']){
  await b.evaluate(`showBioWorld('${world}')`);await sleep(400);await audit(world);
  await b.screenshot(path.join(out,world+'-390.png'));
 }
 await b.evaluate("showBioWorld('dna');document.querySelector('[data-chapter=\"2\"]').click()");
 check('DNA primer required',await b.evaluate("!document.querySelector('#synthesisControls button').disabled"));
 await b.evaluate("document.querySelector('#synthesisControls button').click();document.querySelector('[data-chapter=\"3\"]').click()");
 await b.evaluate("document.querySelector('[data-choice=T]').click()");
 check('DNA rejects noncomplementary nucleotide',await b.evaluate("!document.getElementById('joinNucleotide') && document.getElementById('synthesisFeedback').textContent.length>0"));
 await audit('DNA wrong pairing');
 for(const [i,base] of ['C','T','A','G','C'].entries()){
  await b.evaluate(`document.querySelector('[data-choice=${base}]').click()`);
  check('DNA candidate '+i,await b.evaluate("!!document.getElementById('joinNucleotide')"));
  await b.evaluate("window.dnaBefore=JSON.stringify([...document.querySelectorAll('.new-row .base')].map(n=>n.dataset.base));BioI18n.setLanguage('zh');BioI18n.setLanguage('en')");
  check('DNA candidate and chain retained '+i,await b.evaluate("window.dnaBefore===JSON.stringify([...document.querySelectorAll('.new-row .base')].map(n=>n.dataset.base)) && !!document.getElementById('joinNucleotide')"));
  await b.evaluate("document.getElementById('joinNucleotide').click()");await audit('DNA joined '+i);
 }
 check('DNA five nucleotides complete',await b.evaluate("document.querySelector('.lesson-chip').textContent.includes('5 / 5')"));
 await b.evaluate("document.querySelector('[data-chapter=\"4\"]').click()");
 for(let i=0;i<3;i++){await b.evaluate(`document.querySelectorAll('#finishTabs button')[${i}].click()`);await audit('DNA finishing '+i)}
 await b.evaluate("document.querySelector('[data-chapter=\"1\"]').click()");await audit('DNA AP scope and topoisomerase');
 await b.evaluate("document.querySelector('.below details').open=true");
 check('AP scope includes RNA polymerase',await b.evaluate("document.querySelector('.below details').innerText.includes('RNA polymerase')"));
 for(const [mode,choice] of [['primase',0],['ligase',1]]){
  await b.evaluate(`document.querySelector('[data-mode=${mode}]').click();document.querySelectorAll('#predictionOptions input')[${choice}].click();document.getElementById('runExperiment').click();setProgress(100)`);
  await audit('DNA enzyme '+mode);
  await b.evaluate("window.dnaBefore=JSON.stringify({progress,playing,experiment});BioI18n.setLanguage('zh');BioI18n.setLanguage('en')");
  check('DNA enzyme state retained '+mode,await b.evaluate('window.dnaBefore===JSON.stringify({progress,playing,experiment})'));
  await b.evaluate("document.getElementById('compareExperiment').click()");await audit('DNA control '+mode);
 }
 await b.evaluate("document.getElementById('openMicro').click()");await audit('DNA helicase dialog');
 await b.evaluate("document.getElementById('closeMicro').click()");
 await b.evaluate("showBioWorld('cell')");
 for(let i=0;i<13;i++){await b.evaluate(`document.querySelectorAll('[data-org]')[${i}]?.click()`);await audit('cell organelle '+i)}
 await b.evaluate("showBioWorld('mito')");
 for(let i=0;i<4;i++){await b.evaluate(`document.querySelectorAll('#mitoPartList button')[${i}]?.click()`);await audit('mitochondrion '+i)}
 await b.evaluate("showBioWorld('atp')");
 for(let i=0;i<5;i++){await b.evaluate(`document.querySelectorAll('#atpStepList button')[${i}]?.click()`);await audit('ATP step '+i)}
 await b.evaluate("document.querySelector('#atpPredictChoices button')?.click();document.getElementById('atpPredictSubmit').click()");await audit('ATP prediction');
 await b.evaluate("window.atpBefore=document.getElementById('atpCanvas').dataset.atpScene;BioI18n.setLanguage('zh');BioI18n.setLanguage('en')");
 check('ATP scene retained',await b.evaluate("window.atpBefore===document.getElementById('atpCanvas').dataset.atpScene"));
 await b.goto('http://127.0.0.1:4206/passive.html?lang=en');await sleep(500);
 await b.evaluate("document.getElementById('learningSkip').click();document.querySelector('input[name=passivePrediction]').click();document.getElementById('passivePredictSubmit').click();document.getElementById('passiveNext').click();passiveDebug.advance(8)");
 await audit('passive observed');
 await b.evaluate("window.before=JSON.stringify(passiveDebug.snapshot());BioI18n.setLanguage('zh');BioI18n.setLanguage('en')");
 check('passive particles, counts, prediction and step retained',await b.evaluate('window.before===JSON.stringify(passiveDebug.snapshot())'));
 for(let step=3;step<=5;step++){await b.evaluate(`document.querySelector('#passiveStepNav [data-step="${step}"]').click()`);await audit('passive step '+step)}
 await b.evaluate("document.querySelector('input[name=passiveQuiz5]').click();document.getElementById('passiveQuizSubmit').click()");await audit('passive quiz');
 await b.goto('http://127.0.0.1:4206/mitosis.html?lang=en');await sleep(500);
 for(const time of [0,6,12,18,24,30]){await b.evaluate(`__mitosisSeek(${time})`);await audit('mitosis '+time)}
 await b.evaluate("window.before=JSON.stringify(__mitosisSnapshot());BioI18n.setLanguage('zh');BioI18n.setLanguage('en')");check('mitosis state retained',await b.evaluate('window.before===JSON.stringify(__mitosisSnapshot())'));
 check('no runtime exceptions',b.pageErrors.length===0);
 }finally{fs.writeFileSync(path.join(out,'all-checks.json'),JSON.stringify({checks,missing,errors:b?.pageErrors},null,2));if(b)await b.close();browser.kill();server.kill()}
 if(checks.some(x=>!x.pass))process.exitCode=1;
 console.log(JSON.stringify({passed:checks.filter(x=>x.pass).length,total:checks.length,missing:missing.length}));
})().catch(e=>{console.error(e);process.exitCode=1});
