/* Local reversible presentation translation. Simulation state stays in its owning module. */
(() => {
 'use strict';
 const key='biolens.language',valid=x=>x==='en'||x==='zh';
 let saved;try{saved=localStorage.getItem(key)}catch{}
 const requested=new URL(location.href).searchParams.get('lang');
 let language=valid(requested)?requested:valid(saved)?saved:'zh';
 const dictionary={...(window.BioEnglish||{})},records=new WeakMap(),listeners=new Set();
 let pattern,observer;
 const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 function compile(){const keys=Object.keys(dictionary).filter(Boolean).sort((a,b)=>b.length-a.length);pattern=keys.length?new RegExp(keys.map(escape).join('|'),'g'):null}
 function t(source){if(language!=='en'||typeof source!=='string'||!pattern)return source;return source.replace(pattern,match=>dictionary[match])}
 function write(target,attr){
  const current=attr?target.getAttribute(attr):target.nodeValue;if(current==null)return;
  let map=records.get(target);if(!map){map=new Map();records.set(target,map)}
  const id=attr||'#text',previous=map.get(id);
  const source=previous&&current===previous.rendered?previous.source:current;
  const rendered=t(source);map.set(id,{source,rendered});
  if(current!==rendered){if(attr)target.setAttribute(attr,rendered);else target.nodeValue=rendered}
 }
 function scan(root){
  if(root.nodeType===3){if(!root.parentElement?.closest('script,style,[data-language],.msp-plugin'))write(root);return}
  if(root.nodeType!==1&&root.nodeType!==9)return;
  if(root.nodeType===1&&root.closest('script,style,[data-language],.msp-plugin'))return;
  if(root.nodeType===1)for(const attr of ['aria-label','title','alt','placeholder','content'])if(root.hasAttribute(attr))write(root,attr);
  for(const child of root.childNodes)scan(child);
 }
 function observe(){observer?.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label','title','alt','placeholder','content']})}
 function refresh(){observer?.disconnect();scan(document);document.documentElement.lang=language==='en'?'en':'zh-CN';document.querySelectorAll('[data-language]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.language===language)));observe()}
 function url(){const u=new URL(location.href);u.searchParams.set('lang',language);history.replaceState(history.state,'',u)}
 function setLanguage(next,broadcast=true){
  if(!valid(next))return;language=next;try{localStorage.setItem(key,next)}catch{}url();refresh();
  for(const fn of listeners)fn(next);
  window.dispatchEvent(new Event('biolanguagechange'));
  if(broadcast){for(const frame of document.querySelectorAll('iframe'))frame.contentWindow?.postMessage({type:'biolens-language',language},location.origin);if(parent!==window)parent.postMessage({type:'biolens-language',language},location.origin)}
 }
 window.BioI18n={get language(){return language},t,setLanguage,refresh,register(root,copy){Object.assign(dictionary,copy);compile();if(document.readyState!=='loading')refresh()},subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn)}};
 compile();url();
 document.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-language]');if(button)setLanguage(button.dataset.language);
  const a=event.target.closest?.('a[href]');if(!a||a.hasAttribute('download'))return;
  const next=new URL(a.href,location.href);if(next.origin===location.origin&&/^https?:$/.test(next.protocol)){next.searchParams.set('lang',language);a.href=next.href}
 },true);
 window.addEventListener('message',event=>{if(event.origin===location.origin&&event.data?.type==='biolens-language'&&(event.source===parent||[...document.querySelectorAll('iframe')].some(f=>f.contentWindow===event.source)))setLanguage(event.data.language,false)});
 function start(){
  observer=new MutationObserver(changes=>{
   observer.disconnect();
   for(const c of changes){if(c.type==='attributes')write(c.target,c.attributeName);else if(c.type==='characterData')scan(c.target);else for(const node of c.addedNodes)scan(node)}
   observe();
  });
  refresh();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
