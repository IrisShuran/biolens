import json,pathlib,urllib.request,urllib.parse,concurrent.futures,time
root=pathlib.Path(__file__).resolve().parent.parent
file=root/'TRANSLATION_DRAFT.json'
data=json.loads(file.read_text(encoding='utf-8'))
donefile=root/'TRANSLATION_SINGLE_CHECKED.json'
done=json.loads(donefile.read_text(encoding='utf-8')) if donefile.exists() else {}
pending=[k for k in list(data)[450:] if k not in done]
def translate(s):
    url='https://translate.googleapis.com/translate_a/single?'+urllib.parse.urlencode({'client':'gtx','sl':'zh-CN','tl':'en','dt':'t','q':s})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(url,timeout=30) as response: result=json.load(response)
            return s,''.join(x[0] for x in result[0] if x[0])
        except Exception:
            if attempt==4: raise
            time.sleep(2+attempt*2)
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
    for i,future in enumerate(concurrent.futures.as_completed([pool.submit(translate,k) for k in pending]),1):
        k,v=future.result();done[k]=v
        if i%25==0:
            donefile.write_text(json.dumps(done,ensure_ascii=False,indent=2),encoding='utf-8')
            print(f'{i}/{len(pending)} independently checked',flush=True)
donefile.write_text(json.dumps(done,ensure_ascii=False,indent=2),encoding='utf-8')
print('Complete',flush=True)
