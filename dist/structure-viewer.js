(()=>{
const el=id=>document.getElementById(id),captions=[
 '六种颜色区分 DnaB 的六个亚基。拖动旋转，滚轮或双指缩放。',
 '青色球棍是环中央的单链 DNA；蛋白质淡化以便观察。此结构没有展示被排开的另一条完整 DNA 链。',
 '粉色 GDP 与黄色 AlF₄⁻ 位于核苷酸结合区域。这里使用实验配体观察结构关系，不能把它们标成 ATP 或当作实时水解。'
];let viewer=null,rendering=false,pending=false,disposed=false;const started=performance.now();
const controller=new LessonPlayer({count:3,onStep:i=>{el('structureCaption').textContent=captions[i];document.querySelectorAll('[data-scene]').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.scene===i));queueRender()}});
function scene(){const builder=molstar.PluginExtensions.mvs.MVSData.createBuilder();builder.canvas({background_color:'#102132'});const structure=builder.download({url:new URL('data/4esv.cif',location.href).href}).parse({format:'mmcif'}).assemblyStructure({assembly_id:'1'});const colors=['#76a7ef','#9c8ee7','#e39aab','#eac27d','#8dbf9f','#63b9d0'];
 ['C','D','E','F','G','H'].forEach((chain,i)=>{const c=structure.component({selector:{label_asym_id:chain}});c.representation({type:'cartoon'}).color({color:colors[i]}).opacity({opacity:controller.index===0?1:.18});if(el('structureLabels').checked&&controller.index===0)c.label({text:'DnaB '+(i+1)})});
 const dna=structure.component({selector:{label_asym_id:'A'}});dna.representation({type:'ball_and_stick'}).color({color:'#5ce0bd'});if(el('structureLabels').checked&&controller.index!==2)dna.label({text:'ssDNA'});
 const gdp=structure.component({selector:{label_entity_id:'6'}});gdp.representation({type:'ball_and_stick'}).color({color:'#ef91ca'});
 const alf=structure.component({selector:{label_entity_id:'7'}});alf.representation({type:'ball_and_stick'}).color({color:'#f0d16d'});
 if(controller.index===0)structure.component({selector:'polymer'}).focus({});else if(controller.index===1)dna.focus({});else{structure.component({selector:[{label_asym_id:'Q'},{label_asym_id:'S'}]}).focus({radius:16});if(el('structureLabels').checked){structure.component({selector:{label_asym_id:'Q'}}).label({text:'GDP'});structure.component({selector:{label_asym_id:'S'}}).label({text:'AlF4-'})}}
 return builder.getState()}
async function queueRender(){pending=true;if(rendering||!viewer)return;rendering=true;el('structureStatus').hidden=false;try{while(pending&&!disposed){pending=false;await molstar.PluginExtensions.mvs.loadMVS(viewer.plugin,scene(),{replaceExisting:true,sanityChecks:true})}el('structureStatus').hidden=true;el('structureError').hidden=true;parent.postMessage({type:'biolens-structure-ready'},location.origin)}catch(e){el('structureStatus').hidden=true;el('structureError').hidden=false;console.error('Structure viewer failed',e)}finally{rendering=false}}
document.querySelectorAll('[data-scene]').forEach(b=>b.onclick=()=>controller.seek(+b.dataset.scene));el('structureLabels').onchange=queueRender;el('structureReset').onclick=queueRender;el('structureRetry').onclick=()=>location.reload();
window.addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==parent)return;if(event.data?.type==='biolens-structure-resize'){viewer?.plugin.canvas3d?.requestResize();}if(event.data?.type==='biolens-structure-pause')controller.pause()});
window.addEventListener('pagehide',()=>{disposed=true;controller.pause();viewer?.plugin.dispose()});
(async()=>{try{if(!window.molstar)throw Error('Viewer library unavailable');viewer=await molstar.Viewer.create('molecularViewer',{layoutIsExpanded:false,layoutShowControls:false,layoutShowSequence:false,layoutShowLog:false,layoutShowLeftPanel:false,layoutShowRemoteState:false,viewportShowExpand:false,viewportShowSelectionMode:false,viewportShowAnimation:false,viewportShowSettings:false,viewportShowControls:false,collapseLeftPanel:true});await queueRender();el('structureTiming').textContent='首次加载 '+((performance.now()-started)/1000).toFixed(1)+' 秒';}catch(e){el('structureStatus').hidden=true;el('structureError').hidden=false;console.error('Unable to initialize structure',e)}})();
})();
