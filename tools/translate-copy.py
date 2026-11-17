import json, pathlib, urllib.request, urllib.parse, concurrent.futures, time, re
root=pathlib.Path(__file__).resolve().parent.parent
catalog=json.loads((root/'COPY_CATALOG.json').read_text(encoding='utf-8'))
out=root/'TRANSLATION_DRAFT.json'
result=json.loads(out.read_text(encoding='utf-8')) if out.exists() else {}
pending=[r['zh'] for r in catalog if r['zh'] not in result]
def translate(s):
    url='https://translate.googleapis.com/translate_a/single?'+urllib.parse.urlencode({'client':'gtx','sl':'zh-CN','tl':'en','dt':'t','q':s})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(url,timeout=30) as response: data=json.load(response)
            return s,''.join(x[0] for x in data[0] if x[0])
        except Exception:
            if attempt==3: raise
            time.sleep(2+attempt*2)
def batch(items):
    combined='\n'.join('ZXQ'+str(i)+'ZXQ '+s for i,s in enumerate(items))
    _,translated=translate(combined)
    pieces=re.split(r'ZXQ\s*(\d+)\s*ZXQ\s*',translated,flags=re.I)
    values={int(pieces[i]):pieces[i+1].strip() for i in range(1,len(pieces)-1,2)}
    if len(values)==len(items) and all(i in values for i in range(len(items))):
        return [(s,values[i]) for i,s in enumerate(items)]
    return [translate(s) for s in items]
groups=[pending[i:i+6] for i in range(0,len(pending),6)]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    futures=[pool.submit(batch,items) for items in groups]
    for i,f in enumerate(concurrent.futures.as_completed(futures),1):
        for s,en in f.result():result[s]=en
        if i%5==0:
            out.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
            print(f'{len(result)}/{len(catalog)} translated',flush=True)
out.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(f'Complete: {len(result)} entries',flush=True)
