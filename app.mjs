import {CLASS_COLORS,key,parseRoster,rosterCSV,hoursAgo,summarize,census,classBreakdown,profilesFromLua,validateProfiles,validateGear,ARMORY_GUILD_URL,applyArmoryRaces} from './core.mjs?v=20261110-races-xp';
import {normalizeHistory,levelingStats,levelingCSV,refreshHistory,medianXPPerHour,RELEASE_AT,RELEASE_SOURCE} from './leveling.mjs?v=20261110-xp-release';
import {XP_SOURCE} from './xp.mjs?v=20261110-races-xp';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let roster=[],profiles=[],gear=[],classes=[],selected=new Set(),sort='name',direction=1,page=0,activeName=null,activeTab='story',watchHandle=null,watchTimer=null,watchText='',watchBusy=false,local=false;
const size=25,storageKey='phoenix-rp-data-v1';
const profileMap=()=>new Map(profiles.map(p=>[key(p.name),p]));
const gearMap=()=>new Map(gear.map(p=>[key(p.name),p]));
let snapshots=[],levelStats=new Map(),historyNote='Loading roster history…',armoryRaces=null;
const when=at=>new Date(at).toLocaleString(undefined,{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',timeZoneName:'short'});
const rate=n=>n===null||n===undefined?'—':n.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
const gain=n=>n===null||n===undefined?'—':(n>0?'+':'')+n;
const stat=r=>local?null:levelStats.get(key(r.name));
function historyReason(s){return local?'Local imports have no GitHub upload timestamp. Use the published roster for leveling rates.':s?.status==='before-release'?'A history timestamp predates release or has no elapsed time; a rate cannot be calculated.':s?.status==='changed-history'?'A level decrease or class change needs review; a rate cannot be calculated reliably.':'This character does not match the latest history snapshot. Rates will appear when its published history is available.';}
function renderLeveling(){
 levelStats=levelingStats(roster,snapshots);
 const valid=roster.filter(r=>stat(r)?.xpPerHour!=null).length,latest=snapshots.at(-1);
 $('#leveling-summary').textContent=local?historyReason():latest?`${snapshots.length} recorded roster snapshots + assumed level 1 at release (${when(RELEASE_AT)}). Rates available for ${valid} of ${roster.length} characters. Latest upload: ${when(latest.at)}.`:historyNote;
 const median=medianXPPerHour(filtered(),local?new Map():levelStats);
 $('#xp-median').textContent=median.count?`Active-leveling median est. XP/hour: ${rate(median.median)} across ${median.count} character${median.count===1?'':'s'} in the current filters. Levels 7–59, seen within 24h of export, with a level increase in their latest observation interval.`:'Active-leveling median est. XP/hour: unavailable — no eligible characters in the current filters. Requires level 7–59, seen within 24h of export, and a level increase in the latest observation interval.';
 $('#history-status').textContent=historyNote;
 $('#download-leveling').disabled=local||!snapshots.length;
}
async function loadHistory(){
 $('#refresh-history').disabled=true;historyNote='Checking GitHub for roster updates…';
 try{
  if(!snapshots.length){try{const r=await fetch('leveling-history.json',{cache:'no-store'});if(r.ok)snapshots=normalizeHistory(await r.json());}catch{}}
  renderTable();
  snapshots=await refreshHistory(snapshots);historyNote='History checked against GitHub. Dates are shown in your local time zone.';
 }catch(e){historyNote=e.message+(snapshots.length?' Showing bundled history; refresh to retry.':' Refresh to retry.');}
 finally{$('#refresh-history').disabled=false;renderTable();if(activeName)renderCharacter();}
}
function message(text){$('#notice').textContent=text;$('#notice').hidden=!text;}
function saveLocal(){local=true;try{localStorage.setItem(storageKey,JSON.stringify({csv:rosterCSV(roster),profiles,gear}));}catch{message('Data imported, but this browser could not save it for the next visit. Download a copy to keep it.');}}
function installOptions(){classes=[...new Set(roster.map(r=>r.class))].sort();selected=new Set(classes);$('#rank').replaceChildren(new Option('All ranks',''),...[...new Set(roster.map(r=>r.rank))].sort().map(v=>new Option(v,v)));$('#level').replaceChildren(new Option('All levels',''),...[...new Set(roster.map(r=>r.level))].sort((a,b)=>a-b).map(v=>new Option(v,v)));}
function filtered(ignoreLevel=false,ignoreClasses=false){const q=$('#search').value.trim().toLocaleLowerCase(),rank=$('#rank').value,act=$('#activity').value,level=$('#level').value,pf=$('#profile-filter').value,pm=profileMap(),gm=gearMap();return roster.filter(r=>(ignoreClasses||selected.has(r.class))&&(!rank||r.rank===rank)&&(!level||ignoreLevel||r.level===Number(level))&&(!act||(act==='online'?r.lastOnline==='Online':act==='recent'?hoursAgo(r.lastOnline)<24:hoursAgo(r.lastOnline)>=24&&Number.isFinite(hoursAgo(r.lastOnline))))&&(!pf||(pf==='story'?pm.has(key(r.name)):gm.has(key(r.name))))&&(!q||[r.name,pm.get(key(r.name))?.displayName,pm.get(key(r.name))?.title].some(s=>s?.toLocaleLowerCase().includes(q))));}
function render(){
 const summary=summarize(roster);$('#summary').textContent=`${summary.count} characters. ${summary.online} online at export. Average level ${summary.average.toFixed(1)}. ${profiles.filter(p=>roster.some(r=>key(r.name)===key(p.name))).length} RP profiles.`;
 $('#source').textContent=local?'Local data in this browser. Other visitors still see the published roster.':'Published roster snapshot. Online status is from the export, not live.';
 renderChart();renderTable();
}
function renderClassCounts(){
 const hasRace=roster.some(r=>r.race?.trim());
 $('#legend').innerHTML=classBreakdown(filtered(false,true),classes).map(c=>{const parts=c.races.map(r=>`${r.name}: ${r.count}`);if(c.unknown)parts.push(`Not provided: ${c.unknown}`);return `<span class="class-breakdown"><button aria-pressed="${selected.has(c.className)}" data-class="${esc(c.className)}"><span class="swatch" style="background:${CLASS_COLORS[c.className]||'#999'}"></span>${esc(c.className)} (${c.count})</button>${hasRace&&c.count?`<span class="class-races small muted">${esc(parts.join(', '))}</span>`:''}</span>`;}).join('');
 const known=roster.filter(r=>r.race?.trim()).length,fromArmory=roster.filter(r=>r.raceSource).length;
 $('#race-note').hidden=false;$('#race-note').innerHTML=hasRace?`Race known for ${known} of ${roster.length} characters.${fromArmory?` ${fromArmory} matched to the <a href="${ARMORY_GUILD_URL}" target="_blank" rel="noopener">US RP guild armory</a>; checked ${esc(when(armoryRaces.retrievedAt))}.`:''}${known<roster.length?' Unmatched races are marked Not provided.':''}`:'Race data is not available for these characters. An optional Race column can supply it.';
}
function renderChart(){
 const rows=filtered(true),levelCount=Math.max(1,...roster.map(r=>r.level)),data=census(rows,classes,levelCount),max=Math.max(1,...data.map(d=>d.counts.reduce((a,b)=>a+b,0))),step=max<=10?1:5,top=Math.ceil(max/step)*step;
 const width=Math.max(180,$('#chart').parentElement.clientWidth),left=36,right=width-8,bottom=263,height=235,w=(right-left)/levelCount,gap=Math.min(4,w*.18),tickEvery=Math.max(1,Math.ceil(levelCount/Math.max(1,Math.floor((right-left)/24))));
 let html=`<desc id="chart-description">Stacked columns for levels 1 through ${levelCount}. Each color is a class. Choose a level to filter the roster.</desc>`;
 for(let n=0;n<=top;n+=step){const y=bottom-n/top*height;html+=`<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" stroke="#ddd"/><text x="${left-9}" y="${y+4}" text-anchor="end" font-size="11" fill="#555">${n}</text>`;}
 for(const d of data){const x=left+(d.level-1)*w,count=d.counts.reduce((a,b)=>a+b,0),label=d.level===1||d.level===levelCount||(d.level%tickEvery===0&&d.level<levelCount-tickEvery/2&&d.level>tickEvery/2);html+=`<g class="bar ${$('#level').value===String(d.level)?'selected':''}" tabindex="0" role="button" aria-label="Level ${d.level}, ${count} characters" data-level="${d.level}" aria-pressed="${$('#level').value===String(d.level)}"><title>Level ${d.level}: ${count} characters\n${esc(classes.filter((_,i)=>d.counts[i]).map(c=>c+': '+d.counts[classes.indexOf(c)]).join('\n'))}</title><rect class="level-hit" x="${x}" y="18" width="${w}" height="265"/>`;let sum=0;d.counts.forEach((n,i)=>{if(!n)return;const h=n/top*height;html+=`<rect x="${x+gap}" y="${bottom-(sum+n)/top*height}" width="${w-2*gap}" height="${h}" fill="${CLASS_COLORS[classes[i]]||'#999'}"/>`;sum+=n;});html+=(label?`<text x="${x+w/2}" y="280" text-anchor="middle" font-size="10" fill="#444">${d.level}</text>`:'')+'</g>';}
 html+=`<text x="${(left+right)/2}" y="298" text-anchor="middle" font-size="11" fill="#555">Level</text><text x="3" y="13" font-size="11" fill="#555">Characters</text>`;
 $('#chart').setAttribute('viewBox',`0 0 ${width} 300`);
 $('#chart').innerHTML=html;
 $('#chart-note').hidden=false;$('#chart-note').textContent=`Chart total: ${rows.length} characters. Levels 1–${levelCount}.`;
}
function renderTable(){
 renderClassCounts();renderLeveling();
 const list=filtered(),pm=profileMap();list.sort((a,b)=>{let x=a[sort],y=b[sort];if(sort==='xpPerHour'){x=stat(a)?.[sort];y=stat(b)?.[sort];if(x==null||y==null)return x==null&&y==null?a.name.localeCompare(b.name):x==null?1:-1;}if(sort==='lastOnline'){x=hoursAgo(x);y=hoursAgo(y);}return direction*(typeof x==='number'?(x===y?0:x>y?1:-1):String(x).localeCompare(String(y)))||a.name.localeCompare(b.name);});
 const pages=Math.max(1,Math.ceil(list.length/size));page=Math.min(page,pages-1);$('#count').textContent=`(${list.length} of ${roster.length})`;
 $('#members').innerHTML=list.slice(page*size,(page+1)*size).map(r=>{const s=stat(r),hint=s?.status==='ok'?`Estimated XP from assumed level 1 at release to level ${s.last.level}, divided by ${s.hours.toFixed(2)} calendar hours since ${when(s.startedAt)}. Partial-level XP is unavailable.` :historyReason(s);return `<tr><td><button class="name-button" data-member="${esc(r.name)}">${esc(r.name)}</button></td><td>${r.level}</td><td><span class="class-dot" style="background:${CLASS_COLORS[r.class]||'#999'}"></span>${esc(r.class)}</td><td title="${esc(hint)}">${rate(s?.xpPerHour)}</td><td>${esc(r.rank)}</td><td>${esc(r.lastOnline)}</td><td>${pm.has(key(r.name))?'Available':'—'}</td></tr>`;}).join('')||'<tr><td colspan="7">No characters match these filters.</td></tr>';
 $('#page').textContent=`Page ${page+1} of ${pages}`;$('#previous').disabled=page===0;$('#next').disabled=page>=pages-1;
 $$('[data-sort]').forEach(b=>{const active=b.dataset.sort===sort;b.closest('th').setAttribute('aria-sort',active?(direction===1?'ascending':'descending'):'none');b.textContent=({name:'Name',level:'Level',class:'Class',xpPerHour:'Est. XP/hour',rank:'Rank',lastOnline:'Last online'}[b.dataset.sort])+(active?(direction===1?' ↑':' ↓'):'');});
}
function section(title,text){if(!text)return '';return `<section class="profile-section"><h3>${esc(title)}</h3><div class="story-text">${esc(text)}</div></section>`;}
function details(pairs){return '<dl>'+pairs.filter(([,v])=>v!==undefined&&v!==null&&v!=='').map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')+'</dl>';}
function showCharacter(name){const r=roster.find(r=>key(r.name)===key(name));if(!r)return;activeName=r.name;activeTab='story';renderCharacter();if(!$('#character-dialog').open)$('#character-dialog').showModal();history.replaceState(null,'','#character='+encodeURIComponent(r.name));}
function renderCharacter(){
 const r=roster.find(r=>r.name===activeName);if(!r)return;const p=profileMap().get(key(r.name)),g=gearMap().get(key(r.name));$('#character-name').textContent=p?.displayName||r.name;$('#character-subtitle').textContent=[p?.title,`Level ${r.level} ${r.class}`,r.name!==p?.displayName&&p?.displayName?r.name:null].filter(Boolean).join(' / ');
 $$('[data-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===activeTab)));$('#character-content').setAttribute('aria-labelledby','tab-'+activeTab);
 if(activeTab==='leveling'){
  const s=stat(r);$('#character-content').innerHTML=(s?.status==='ok'?details([['Est. XP/hour since release',rate(s.xpPerHour)],['Estimated XP since release',s.xpGain===null?'Unavailable for this level':s.xpGain.toLocaleString()],['Release baseline',`${when(s.startedAt)} — assumed level 1`],['Hours since release',s.hours.toFixed(2)],['First observed',`${when(s.first.at)} — level ${s.first.level}`],['Release → first snapshot',`${rate(s.initialXPPerHour)} estimated XP/hour over ${s.initialHours.toFixed(2)} hours`],['Latest recorded interval',s.recentDays===null?'Needs a second recorded snapshot':`${rate(s.recentXPPerHour)} estimated XP/hour over ${(s.recentDays*24).toFixed(2)} hours`]]):`<p class="muted">${esc(historyReason(s))}</p>`)+(s?.points.length?`<table class="history-table"><thead><tr><th>Time / source</th><th>Level</th></tr></thead><tbody><tr><td><a href="${RELEASE_SOURCE}" target="_blank" rel="noopener">${esc(when(RELEASE_AT))}</a><div class="small muted">Assumed release baseline</div></td><td>1 (assumed)</td></tr>${s.points.map(p=>`<tr><td><a href="https://github.com/Alexwaukee/phoenix-rp/commit/${p.sha}" target="_blank" rel="noopener">${esc(when(p.at))}</a><div class="small muted">Recorded roster snapshot</div></td><td>${p.level}</td></tr>`).join('')}</tbody></table>`:'')+`<p class="small muted">Assumes every character was level 1 at release. This includes the release-to-first-snapshot interval in the overall rate; later-created characters share the same assumed start. Partial-level XP is unknown, so this is an estimate. Includes offline time. Median eligibility still requires progression between two recorded snapshots. <a href="${XP_SOURCE}" target="_blank" rel="noopener">XP table: Zephras, Forever build 1.60.1.70862</a>.</p>`;
 }
 else if(activeTab==='details')$('#character-content').innerHTML=details([['Name',r.name],['Level',r.level],['Class',r.class],['Race',r.race],['Guild rank',r.rank],['Last online',r.lastOnline]])+(r.raceSource?`<p class="small muted">Race from the <a href="${ARMORY_GUILD_URL}" target="_blank" rel="noopener">US RP guild armory</a>; checked ${esc(when(r.raceCheckedAt))}.</p>`:'')+'<p class="small muted">Last online describes the roster export, not current activity.</p>';
 else if(activeTab==='gear')$('#character-content').innerHTML=g?.equipment.length?`<p class="small muted">${g.updatedAt?'Gear snapshot: '+esc(g.updatedAt):'Imported equipment snapshot; capture time was not provided.'}</p><table><thead><tr><th>Slot</th><th>Item</th><th>Item level</th></tr></thead><tbody>${g.equipment.map(i=>`<tr><td>${esc(i.slot)}</td><td>${esc(i.name)}${i.itemId?`<div class="small muted">Item ${i.itemId} / ${esc(i.quality)}</div>`:''}</td><td>${i.itemLevel??'—'}</td></tr>`).join('')}</tbody></table>`:'<p class="empty">No gear data has been imported for this character. The roster CSV does not include equipment.</p>';
 else if(!p)$('#character-content').innerHTML='<p class="empty">No RP profile has been imported for this character yet.</p><p class="small">Use Update data to import TRP3 saved profile data or a profiles JSON file.</p>';
 else $('#character-content').innerHTML=details([['Pronouns',p.pronouns],['Race',p.race],['RP class',p.rpClass],['Age',p.age],['Eye color',p.eyes],['Height',p.height],['Birthplace',p.birthplace],['Residence',p.residence]])+section('About',p.about)+section('Appearance',p.appearance)+section('Personality',p.personality)+section('History',p.history)+(p.glances||[]).map(g=>section(g.title||'At first glance',g.text)).join('')+'<p class="small muted">Imported public TRP3 fields. Private notes and relationships are excluded.</p>';
}
function reset(){for(const id of ['search','rank','activity','level','profile-filter'])$('#'+id).value='';selected=new Set(classes);page=0;render();}
function download(text,name,type){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function importHelp(){const kind=$('#import-kind').value;$('#import-text').value='';$('#import-error').hidden=true;$('#import-file').value='';$('#import-file').accept=kind==='roster'?'.csv,.txt':kind==='profiles'?'.lua,.json,.txt':'.json';$('#import-help').textContent=kind==='roster'?'In game: /grexport csv, copy all the text, then paste it below.':kind==='profiles'?'Choose totalRP3_Data.lua from your account’s SavedVariables folder, or a Phoenix profiles JSON file. Only characters in this roster are matched. Private notes are excluded. Native encoded TRP3 export strings are not supported yet.':'Import a gear JSON file with a characters array. Each character needs name and equipment fields. The README includes the format.';$('#import-text').placeholder=kind==='roster'?'"Name","Level","Class","Rank","Last Online"':kind==='profiles'?'Paste SavedVariables Lua or profiles JSON':'{"characters": [{"name": "…", "equipment": […]}]}';}
function apply(text,kind){
 if(text.length>25_000_000)throw Error('The file is too large.');
 if(kind==='roster'){const next=applyArmoryRaces(parseRoster(text),armoryRaces);roster=next;installOptions();}
 else if(kind==='profiles'){const next=text.trimStart().startsWith('{')||text.trimStart().startsWith('[')?validateProfiles(JSON.parse(text),roster):profilesFromLua(text,roster);if(!next.length)throw Error('No TRP3 profiles matched this roster. The local cache only includes profiles your client has received.');const merged=profileMap();next.forEach(p=>merged.set(key(p.name),p));profiles=[...merged.values()];}
 else gear=validateGear(JSON.parse(text),roster);
 saveLocal();page=0;render();if(activeName)renderCharacter();return kind==='roster'?`${roster.length} characters imported.`:kind==='profiles'?`${profiles.filter(p=>roster.some(r=>key(r.name)===key(p.name))).length} RP profiles available.`:`${gear.length} gear profiles imported.`;
}
function stopWatch(){clearInterval(watchTimer);watchTimer=null;watchHandle=null;$('#watch-file').textContent='Watch local file';$('#watch-status').textContent='File watching stopped.';}
$('#search').addEventListener('input',()=>{page=0;renderChart();renderTable();});for(const id of ['rank','activity','profile-filter','level'])$('#'+id).addEventListener('change',()=>{page=0;renderChart();renderTable();});
$('#legend').addEventListener('click',e=>{const b=e.target.closest('[data-class]');if(!b)return;selected.has(b.dataset.class)?selected.delete(b.dataset.class):selected.add(b.dataset.class);page=0;render();});
$('#chart').addEventListener('click',e=>{const b=e.target.closest('[data-level]');if(!b)return;const v=b.dataset.level;if(![...$('#level').options].some(o=>o.value===v))$('#level').add(new Option(v,v));$('#level').value=$('#level').value===v?'':v;page=0;renderChart();renderTable();});
$('#chart').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.target.closest('[data-level]')?.dispatchEvent(new MouseEvent('click',{bubbles:true}));}});
$('#members').addEventListener('click',e=>{const b=e.target.closest('[data-member]');if(b)showCharacter(b.dataset.member);});
$$('[data-sort]').forEach(b=>b.addEventListener('click',()=>{direction=sort===b.dataset.sort?-direction:b.dataset.sort==='xpPerHour'?-1:1;sort=b.dataset.sort;page=0;renderTable();}));
$('#refresh-history').onclick=loadHistory;
$('#download-leveling').onclick=()=>download(levelingCSV(filtered(),levelStats),'phoenix-rp-leveling.csv','text/csv;charset=utf-8');
new ResizeObserver(()=>requestAnimationFrame(renderChart)).observe($('#chart').parentElement);
$('#previous').onclick=()=>{page--;renderTable();};$('#next').onclick=()=>{page++;renderTable();};$('#reset').onclick=reset;
$$('[data-close]').forEach(b=>b.onclick=()=>$('#'+b.dataset.close).close());
$('#character-dialog').addEventListener('close',()=>{activeName=null;history.replaceState(null,'',location.pathname+location.search);});
$$('[data-tab]').forEach(b=>b.onclick=()=>{activeTab=b.dataset.tab;renderCharacter();});
$('#update').onclick=()=>$('#data-dialog').showModal();$('#import-kind').onchange=importHelp;
$('#import-file').onchange=async()=>{const f=$('#import-file').files[0];if(f){if(f.size>25_000_000){$('#import-error').textContent='The file is too large.';$('#import-error').hidden=false;return;}$('#import-text').value=await f.text();}};
$('#apply-import').onclick=()=>{try{const m=apply($('#import-text').value,$('#import-kind').value);$('#import-error').hidden=true;$('#data-dialog').close();message(m+' This is a local preview; download the data file to publish it.');}catch(e){$('#import-error').textContent=e.message;$('#import-error').hidden=false;}};
$('#download').onclick=()=>download(rosterCSV(filtered()),'roster.csv','text/csv;charset=utf-8');
$('#download-data').onclick=()=>{const k=$('#import-kind').value;download(k==='roster'?rosterCSV(roster):JSON.stringify(k==='profiles'?{schemaVersion:1,profiles:profiles.filter(p=>roster.some(r=>key(r.name)===key(p.name)))}:{characters:gear},null,2),k==='roster'?'roster.csv':k+'.json',k==='roster'?'text/csv;charset=utf-8':'application/json');};
$('#published').onclick=()=>{stopWatch();localStorage.removeItem(storageKey);location.reload();};
$('#watch-file').onclick=async()=>{
 if(watchHandle){stopWatch();return;}
 try{if(!window.showOpenFilePicker)throw Error('File watching is unavailable here. Use Chrome or Edge on desktop, or import the file manually.');const kind=$('#import-kind').value;[watchHandle]=await window.showOpenFilePicker({multiple:false});let f=await watchHandle.getFile();watchText=await f.text();apply(watchText,kind);$('#watch-file').textContent='Stop watching';$('#watch-status').textContent=`Watching ${f.name} every 20 seconds while this page is open. This updates this browser only.`;watchTimer=setInterval(async()=>{if(watchBusy)return;watchBusy=true;try{const f=await watchHandle.getFile();const text=await f.text();if(text!==watchText){const result=apply(text,kind);watchText=text;message(`${f.name}: ${result} Local preview only.`);}}catch(e){message('File update could not be read: '+e.message+' Keeping the last valid data.');}finally{watchBusy=false;}},20000);}
 catch(e){watchHandle=null;if(e.name!=='AbortError'){$('#import-error').textContent=e.message;$('#import-error').hidden=false;}}
};
async function init(){try{
 const [csv,p,g,races]=await Promise.all([fetch('roster.csv',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Roster could not be loaded.');return r.text();}),fetch('profiles.json',{cache:'no-store'}).then(r=>r.ok?r.json():{profiles:[]}),fetch('gear.json',{cache:'no-store'}).then(r=>r.ok?r.json():{characters:[]}),fetch('races.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null)]);
 roster=parseRoster(csv);try{roster=applyArmoryRaces(roster,races);armoryRaces=races;}catch{message('Armory race data could not be read. The roster is still available.');}const inRoster=p=>roster.some(r=>key(r.name)===key(p.name));profiles=validateProfiles({profiles:Array.isArray(p.profiles)?p.profiles.filter(inRoster):p.profiles},roster);gear=validateGear({characters:Array.isArray(g.characters)?g.characters.filter(inRoster):g.characters},roster);
 try{const saved=JSON.parse(localStorage.getItem(storageKey));if(saved){const r=applyArmoryRaces(parseRoster(saved.csv),armoryRaces),pm=validateProfiles({profiles:saved.profiles.filter(p=>r.some(x=>key(x.name)===key(p.name)))},r),gm=validateGear({characters:saved.gear.filter(p=>r.some(x=>key(x.name)===key(p.name)))},r);roster=r;profiles=pm;gear=gm;local=true;}}catch{message('Saved local data could not be read. Showing the published roster.');}
 installOptions();render();importHelp();loadHistory();const match=/^#character=(.+)/.exec(location.hash);if(match){try{showCharacter(decodeURIComponent(match[1]));}catch{}}
 }catch(e){$('#summary').textContent='The roster could not be loaded.';message(e.message+' Serve this folder over HTTP, rather than opening index.html directly.');}}
init();
