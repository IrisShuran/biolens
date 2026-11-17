const fs = require('node:fs');
const path = require('node:path');
const {spawn} = require('node:child_process');
const {connect, findBrowser} = require('./cdp-browser.cjs');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'qa');
fs.mkdirSync(out, {recursive:true});
const sleep = ms => new Promise(r => setTimeout(r, ms));
const server = spawn(process.execPath, [path.join(__dirname,'preview.cjs'), '4206'], {windowsHide:true, stdio:'ignore'});
const browser = spawn(findBrowser(), ['--headless=new','--remote-debugging-port=9406',`--user-data-dir=${path.join(out,'browser-profile')}`,'--no-first-run','--no-default-browser-check','--disable-background-networking'], {windowsHide:true, stdio:'ignore'});
const results=[];
function check(name, pass) { results.push({name,pass:!!pass}); if(!pass) throw Error(name); }
(async()=>{
  let b;
  try {
    await sleep(2000);
    b=await connect({port:9406,url:'http://127.0.0.1:4206/curriculum.html?lang=en#cycle',width:1440,height:900});
    await b.goto('http://127.0.0.1:4206/curriculum.html?lang=en#cycle');
    await sleep(400);
    check('explicit English and fragment',await b.evaluate("document.documentElement.lang==='en' && location.hash==='#cycle' && document.title==='Learning map · BioLens'"));
    check('no untranslated Chinese text except language control',await b.evaluate("!/[\\u3400-\\u9fff]/.test(document.body.innerText.replace('中文',''))"));
    for(const width of [1440,1024,768,390]) {
      await b.setViewport(width,900);
      check(`English ${width}: no horizontal overflow`,await b.evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
      await b.evaluate('scrollTo(0,0)');
      await b.screenshot(path.join(out,`curriculum-en-${width}.png`));
    }
    await b.evaluate("document.querySelector('[data-language=zh]').click()");
    check('Chinese restored, query and hash retained',await b.evaluate("document.title==='课程地图 · BioLens' && location.search==='?lang=zh' && location.hash==='#cycle'"));
    await b.goto('http://127.0.0.1:4206/curriculum.html');
    check('saved preference applied',await b.evaluate("document.documentElement.lang==='zh-CN'"));
    await b.goto('http://127.0.0.1:4206/curriculum.html?lang=en');
    check('URL overrides preference',await b.evaluate("document.documentElement.lang==='en'"));
    await b.evaluate("document.querySelector('[data-language=en]').click()");
    await b.goto('http://127.0.0.1:4206/curriculum.html');
    check('English preference survives navigation without query',await b.evaluate("document.documentElement.lang==='en'"));
    await b.evaluate("document.querySelector('a[href=\"#cycle\"]').click()");
    check('in-page link retains language',await b.evaluate("location.hash==='#cycle' && location.search==='?lang=en'"));
    await b.evaluate("document.querySelector('a[href=\"passive.html\"]').click()");
    await sleep(500);
    check('cross-page destination retains language',await b.evaluate("location.pathname==='/passive.html' && location.search==='?lang=en'"));
    await b.goto('http://127.0.0.1:4206/index.html?lang=en');
    await sleep(700);
    check('home translated',await b.evaluate("document.title==='BioLens · Explore life through the cell' && !/[\\u3400-\\u9fff]/.test(document.querySelector('#homeMain').innerText)"));
    for(const width of [1440,1024,768,390]) {
      await b.setViewport(width,900);
      check(`Home English ${width}: no horizontal overflow`,await b.evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
      await b.screenshot(path.join(out,`home-en-${width}.png`));
    }
    await b.evaluate("document.getElementById('worldCell').click();document.getElementById('worldHome').click()");
    check('world navigation retains query',await b.evaluate("location.search==='?lang=en' && !document.getElementById('homeMain').hidden"));
    await b.evaluate("document.querySelector('[data-language=zh]').click()");
    check('home restores Chinese',await b.evaluate("document.getElementById('homeTitle').innerText.includes('从一座细胞出发')"));
    check('no runtime exceptions',b.pageErrors.length===0);
  } finally {
    fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({results,errors:b?.pageErrors||[]},null,2));
    if(b) await b.close();
    browser.kill(); server.kill();
  }
  console.log(JSON.stringify(results));
})().catch(e=>{console.error(e);process.exitCode=1});
