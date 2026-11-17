const fs=require('fs'),path=require('path'),acorn=require('./acorn.cjs');
const root=path.resolve(__dirname,'../dist'), entries=new Map();
function add(value,file){
 for(const m of value.matchAll(/(?:aria-label|alt|title|content|placeholder)="([^"]*)"/g))if(/[\u3400-\u9fff]/.test(m[1])){if(!entries.has(m[1]))entries.set(m[1],[]);entries.get(m[1]).push(file)}
 for(const part of value.split(/<[^>]*>/g)) {
  const s=part.trim();
  if(/[\u3400-\u9fff]/.test(s) && !/[{};]|=>/.test(s)) {
   if(!entries.has(s))entries.set(s,[]);
   entries.get(s).push(file);
  }
 }
}
for(const file of fs.readdirSync(root)){
 if(/i18n/.test(file)||! /\.(js|html|json)$/.test(file))continue;
 const source=fs.readFileSync(path.join(root,file),'utf8');
 if(file.endsWith('.html')){
  const clean=source.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/g,'');
  add(clean,file);
  for(const m of clean.matchAll(/(?:aria-label|alt|title|content|placeholder)="([^"]*)"/g))add(m[1],file);
 }else if(file.endsWith('.json')){
  const walk=x=>{if(typeof x==='string')add(x,file);else if(x&&typeof x==='object')Object.values(x).forEach(walk)};walk(JSON.parse(source));
 }else{
  const ast=acorn.parse(source,{ecmaVersion:'latest',sourceType:'module'});
  const walk=n=>{if(!n||typeof n!=='object')return;if(n.type==='Literal'&&typeof n.value==='string')add(n.value,file);if(n.type==='TemplateElement')add(n.value.cooked||n.value.raw,file);for(const [k,v]of Object.entries(n)){if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v)}};walk(ast);
 }
}
fs.writeFileSync(path.resolve(__dirname,'../COPY_CATALOG.json'),JSON.stringify([...entries].map(([zh,files])=>({zh,files:[...new Set(files)]})),null,2));
console.log(entries.size+' unique copy fragments');
