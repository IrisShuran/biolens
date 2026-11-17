const fs=require('fs'),path=require('path'),acorn=require('./acorn.cjs');
const root=path.resolve(__dirname,'../dist');
const controls='<div class="bio-language" role="group" aria-label="选择语言"><button type="button" data-language="zh" lang="zh-CN" aria-pressed="true">中文</button><button type="button" data-language="en" lang="en" aria-pressed="false">English</button></div>';
for(const file of ['index.html','curriculum.html','passive.html','membrane.html','mitosis.html','structure-viewer.html']){
 const p=path.join(root,file);let s=fs.readFileSync(p,'utf8');
 if(!s.includes('src="i18n.js"'))s=s.replace('</head>','<link rel="stylesheet" href="i18n.css"><script src="i18n.js"></script></head>');
 if(!s.includes('src="en-copy.js"'))s=s.replace('<script src="i18n.js">','<script src="en-copy.js"></script><script src="i18n.js">');
 if(!s.includes('data-language="en"'))s=s.includes('</header>')?s.replace('</header>',controls+'</header>'):s.replace('<body>','<body>'+controls);
 s=s.replace(/<p id="languageScope"[^>]*>.*?<\/p>/,'').replace(/<p class="bio-language-note">.*?<\/p>/,'');
 fs.writeFileSync(p,s);
}
// Translate canvas strings at the rendering boundary, including measurements.
for(const file of fs.readdirSync(root).filter(f=>f.endsWith('.js')&&!f.includes('i18n')&&f!=='en-copy.js')){
 const p=path.join(root,file);let s=fs.readFileSync(p,'utf8');const edits=[];
 const ast=acorn.parse(s,{ecmaVersion:'latest',sourceType:'module'});
 function walk(n){if(!n||typeof n!=='object')return;
  if(n.type==='CallExpression'&&n.callee.type==='MemberExpression'&&['fillText','strokeText','measureText'].includes(n.callee.property.name)&&n.arguments[0]){
   const a=n.arguments[0],raw=s.slice(a.start,a.end);if(!raw.startsWith('BioI18n.t('))edits.push({start:a.start,end:a.end,text:'BioI18n.t('+raw+')'});
  }
  for(const v of Object.values(n)){if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v)}
 }walk(ast);for(const e of edits.sort((a,b)=>b.start-a.start))s=s.slice(0,e.start)+e.text+s.slice(e.end);
 if(file==='app.js'&&!s.includes("subscribe(draw)"))s+='\nBioI18n.subscribe(draw);\n';
 if(file==='passive.js'&&!s.includes('subscribe(drawScene)'))s=s.replace('  exposeDebugApi();','  BioI18n.subscribe(drawScene);\n  exposeDebugApi();');
 if(file==='atp.js'&&!s.includes('subscribe(paint)'))s+='\nBioI18n.subscribe(paint);\n';
 if(file==='home-i18n.js')s=s.replace(/for\(const id of \['cellMain'.*?;\r?\n/,'');
 if(file==='helicase.js')s=s.replace("frame.src='structure-viewer.html'","frame.src='structure-viewer.html?lang='+BioI18n.language");
 fs.writeFileSync(p,s);
}
// Improve the original scientific wording in both languages.
const p=path.join(root,'mitosis.js');let s=fs.readFileSync(p,'utf8');s=s.replace('纺锤体微管连接到染色体的着丝粒。','纺锤体微管连接到着丝粒区域的动粒。');fs.writeFileSync(p,s);
console.log('All six entry pages wired; Canvas render boundaries translated.');
