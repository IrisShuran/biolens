const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'..');
const draft=JSON.parse(fs.readFileSync(path.join(root,'TRANSLATION_DRAFT.json'),'utf8'));
const singles=path.join(root,'TRANSLATION_SINGLE_CHECKED.json');if(fs.existsSync(singles))Object.assign(draft,JSON.parse(fs.readFileSync(singles,'utf8')));
for(const [key,value]of Object.entries(draft))draft[key]=value.replace(/inorganic phosphoric acid/gi,'inorganic phosphate').replace(/unreal proportions and rates/gi,'not to scale; not a measured rate').replace(/Biology Assembly/gi,'biological assembly').replace(/assisted diffusion/gi,'facilitated diffusion').replace(/sister chromatin/gi,'sister chromatids');
const corrections={
 '选择语言':'Choose a language','开始':'Start','播放':'Play','暂停':'Pause','继续':'Resume','重播':'Replay','下一步':'Next','上一步':'Previous','左侧':'Left','右侧':'Right','细胞膜':'Cell membrane',
 '预测':'Predict','观察扩散':'Observe diffusion','比较通路':'Compare pathways','动态平衡':'Dynamic equilibrium','检查理解':'Check your understanding',
 '易化扩散':'Facilitated diffusion','协助扩散':'Facilitated diffusion','被动运输':'Passive transport','主动运输':'Active transport','浓度梯度':'Concentration gradient','电化学梯度':'Electrochemical gradient',
 'ATP 合酶':'ATP synthase','ATP 合成':'ATP synthesis','质子梯度':'Proton gradient','姐妹染色单体':'Sister chromatids','胞质分裂':'Cytokinesis','冈崎片段':'Okazaki fragment','引物酶':'Primase','连接酶':'Ligase',
 '前导链与每个冈崎片段的延伸都遵守 5′→3′。这里仅完成一个小片段，不是整条染色体。':'The leading strand and each Okazaki fragment extend in the 5′→3′ direction. This exercise completes only a short segment, not a whole chromosome.',
 '染色质凝缩成可见的染色体；随后核膜逐渐解体，两极分开，纺锤体微管连接到着丝粒区域的动粒。':'Chromatin condenses into visible chromosomes. The nuclear envelope then breaks down, the poles separate, and spindle microtubules attach to kinetochores at the centromeres.',
 'Pᵢ 表示无机磷酸。此式省略电荷、质子化状态和 Mg²⁺ 配位；它是生化简写，不是指定 pH 下的完整离子方程式。ATP 没有变成 DNA 的组成部分。':'Pᵢ denotes inorganic phosphate. This biochemical shorthand omits charges, protonation states, and Mg²⁺ coordination; it is not a complete ionic equation at a specified pH. The ATP shown here does not become part of DNA.',
 '这是教学示意。两侧体积相同，点的数量代表相对浓度；速度、大小与时间不对应真实生理测量。':'This is a teaching model. The two compartments have equal volumes, so particle counts represent relative concentrations. Speeds, sizes, and time do not correspond to physiological measurements.',
 '科学解释：分子在两个方向都持续随机运动。左侧初始浓度更高，因此统计上左→右的跨膜机会更多，形成从高浓度到低浓度的净移动；单个分子仍可能向任一方向运动。':'Molecules move randomly in both directions. The initial concentration is higher on the left, so left-to-right crossings are statistically more likely, producing net movement down the concentration gradient. Individual molecules can still move either way.',
 '定性示意 · 非真实比例与速率':'Qualitative model · Not to scale or measured rates',
 '点 = 相对浓度 · 非真实比例':'Dots indicate concentration · Not to scale',
 '构象变化':'Conformational change','结合':'Binding','释放':'Release','空闲':'Idle','有载体':'With carriers','无载体':'Without carriers','载体':'Carrier','运行中':'Running','已暂停':'Paused',
 '已选择：':'Selected: ','已选择':'Selected','当前情境为':'Current scenario: ','模拟时钟':'Simulation time: ','模拟秒':'simulated seconds','个粒子':'particles','个）':' total)','个':'',
 '第':'Step ','步 / 5':' / 5','窗口':'Window','秒':'seconds','左→右':'Left → right','右→左':'Right → left',
 '预测已提交':'Prediction submitted','已提交预测':'Prediction submitted','提交预测':'Submit prediction','已提交答案':'Answer submitted','提交答案':'Submit answer',
 '首次加载':'Initial load: ','尚未选择':'Not selected','半保留复制':'Semiconservative replication','半保留':'Semiconservative','重置视角':'Reset view','重置镜头':'Reset view',
 '蛋白质':'Protein','来源：':'Sources: ','来源':'Sources','教学示意':'Teaching model','非真实比例':'Not to scale','模型限制':'Model limitations','标签':'Labels'
};
Object.assign(draft,corrections);
for(const [key,value]of Object.entries(draft)){
 let text=value.replace(/dynamic balanc(?:e|ing)/gi,'dynamic equilibrium').replace(/proton dynamic potential/gi,'proton-motive force').replace(/\bintima\b|\bendometrium\b/gi,'inner membrane').replace(/\badventitia\b/gi,'outer membrane').replace(/stromal side/gi,'matrix side').replace(/semi-preserving replication/gi,'semiconservative replication');
 if(key.includes('载体'))text=text.replace(/\bvectors?\b/gi,m=>m.endsWith('s')?'carriers':'carrier');
 if(key.includes('嵴'))text=text.replace(/\bridges?\b|\bcrests?\b/gi,'cristae');
 if(key.includes('骨架'))text=text.replace(/skeleton/gi,'backbone').replace(/fracture/gi,'nick');
 // "细胞骨架" is a different structure from the DNA sugar-phosphate backbone.
 if(key==='细胞骨架')text='cytoskeleton';
 if(key.includes('沿骨架移动'))text=text.replace(/\bbackbone\b/gi,'cytoskeleton').replace(/\bskeleton\b/gi,'cytoskeleton');
 if(key.includes('成核'))text=text.replace(/nucleation/gi,'nuclear envelope formation');
 draft[key]=text;
}
const extra=path.join(root,'COPY_REVIEW.json');if(fs.existsSync(extra))Object.assign(draft,JSON.parse(fs.readFileSync(extra,'utf8')));
// Keys that stitch a label and a clause lose the separator space; restore it.
for(const [key,value]of Object.entries(draft)){
 if(!key.includes('：'))continue;
 draft[key]=value.replace(/([A-Za-z\)]):(?=[^\s/\d])/g,'$1: ').replace(/^:(?=\S)/,': ');
}
fs.writeFileSync(path.join(root,'dist/en-copy.js'),'/* Local English catalog. Generated from public teaching copy; see TRANSLATION_REVIEW.md. */\nwindow.BioEnglish = '+JSON.stringify(draft,null,2)+';\n');
console.log(Object.keys(draft).length+' catalog entries');
