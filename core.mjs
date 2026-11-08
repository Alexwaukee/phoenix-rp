export const CLASS_COLORS={Druid:'#ff914d',Hunter:'#a8ce71',Mage:'#70c8ef',Paladin:'#ed8fba',Priest:'#ded9cf',Rogue:'#ecd05c',Shaman:'#478fe5',Warlock:'#ad94df',Warrior:'#bd9872'};
export const HEADERS=['Name','Level','Class','Rank','Last Online'];
export const key=name=>String(name).normalize('NFC').trim().toLocaleLowerCase('en');
export function parseCSV(text){
 text=String(text).replace(/^\uFEFF/,'');
 const rows=[];let row=[],field='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;continue;}
  if(c==='"'){if(field||closed)throw Error('Unexpected quote in CSV.');quoted=true;}
  else if(c===','){row.push(field);field='';closed=false;}
  else if(c==='\r'||c==='\n'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(x=>x!==''))rows.push(row);row=[];field='';closed=false;}
  else{if(closed)throw Error('Unexpected text after a quoted CSV field.');field+=c;}
 }
 if(quoted)throw Error('CSV ends inside a quoted field. Finish the export and try again.');
 row.push(field);if(row.some(x=>x!==''))rows.push(row);
 return rows;
}
export function parseRoster(text){
 const rows=parseCSV(text),header=rows.shift()?.map(h=>h.trim());
 if(!header||HEADERS.some(h=>!header.includes(h))||new Set(header).size!==header.length||header.some(h=>!HEADERS.includes(h)&&h!=='Race'))throw Error('Use Name, Level, Class, Rank, Last Online, plus an optional Race column.');
 const columns=Object.fromEntries(header.map((h,i)=>[h,i]));
 if(!rows.length)throw Error('The roster contains no characters.');
 if(rows.length>20000)throw Error('This export is too large (maximum 20,000 characters).');
 const seen=new Set();
 return rows.map((r,i)=>{
  if(r.length!==header.length||HEADERS.some(h=>!r[columns[h]]?.trim()))throw Error(`Row ${i+2} needs all five required fields.`);
  const [name,level,cls,rank,lastOnline]=HEADERS.map(h=>r[columns[h]].trim()),n=Number(level);
  if(!/^\d+$/.test(level)||!Number.isSafeInteger(n)||n<1||n>1000)throw Error(`Invalid level for ${name}.`);
  if(seen.has(key(name)))throw Error(`Duplicate character name: ${name}.`);seen.add(key(name));
  return {name,level:n,class:cls,rank,lastOnline,...(columns.Race!==undefined?{race:r[columns.Race].trim()}:{})};
 });
}
export function rosterCSV(rows){const race=rows.some(r=>Object.hasOwn(r,'race'));return [[...HEADERS,...(race?['Race']:[])],...rows.map(r=>[r.name,r.level,r.class,r.rank,r.lastOnline,...(race?[r.race||'']:[])])].map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n')+'\r\n';}
export function classBreakdown(rows,classes=[...new Set(rows.map(r=>r.class))].sort()){return classes.map(className=>{const members=rows.filter(r=>r.class===className),races=new Map();let unknown=0;for(const r of members){const race=r.race?.trim();if(race)races.set(race,(races.get(race)||0)+1);else unknown++;}return {className,count:members.length,races:[...races].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(([name,count])=>({name,count})),unknown};});}
export function hoursAgo(text){if(text==='Online'||text==='< 1h ago')return 0;const m=/^(?:(\d+)d(?: )?)?(?:(\d+)h)? ago$/.exec(text);return m&&(m[1]||m[2])?Number(m[1]||0)*24+Number(m[2]||0):Infinity;}
export function summarize(rows){const levels=rows.map(r=>r.level).sort((a,b)=>a-b),n=rows.length;return {count:n,online:rows.filter(r=>r.lastOnline==='Online').length,under24:rows.filter(r=>hoursAgo(r.lastOnline)<24).length,average:n?levels.reduce((a,b)=>a+b,0)/n:0,median:n?(levels[Math.floor((n-1)/2)]+levels[Math.floor(n/2)])/2:0};}
export function census(rows,classes,maxLevel=Math.max(35,...rows.map(r=>r.level))){return Array.from({length:Math.max(35,maxLevel)},(_,i)=>({level:i+1,counts:classes.map(c=>rows.filter(r=>r.level===i+1&&r.class===c).length)}));}
export function cleanText(value){return String(value??'').replace(/\|c[0-9a-fA-F]{8}|\|r/g,'').replace(/\|H[^|]*\|h([^]*?)\|h/g,'$1').replace(/\|[TA][^]*?\|[ta]/g,'').replace(/\{(?:\/?(?:h[123]|p|col|link|img)|img|icon)[^}]*\}/g,'').replace(/\{[lr]d\}/g,'').trim();}

// Read SavedVariables as literal data. No Lua code, functions or expressions are executed.
export function parseLua(text){
 if(text.length>25_000_000)throw Error('SavedVariables file is too large.');
 let p=0,depth=0,tokens=0;const fail=()=>{throw Error(`Unsupported SavedVariables syntax near character ${p}. Choose totalRP3_Data.lua or a Phoenix profiles JSON file.`);};
 function skip(){while(p<text.length){if(/\s/.test(text[p]))p++;else if(text.startsWith('--',p)){const lm=/^--\[(=*)\[/.exec(text.slice(p));if(lm){const end=text.indexOf(']'+lm[1]+']',p+lm[0].length);if(end<0)fail();p=end+lm[1].length+2;}else{const end=text.indexOf('\n',p);p=end<0?text.length:end+1;}}else break;}}
 function string(){const q=text[p++];let out='';while(p<text.length){let c=text[p++];if(c===q)return out;if(c!=='\\'){out+=c;continue;}c=text[p++];if(/[0-9]/.test(c)){let digits=c;while(digits.length<3&&/[0-9]/.test(text[p]||''))digits+=text[p++];out+=String.fromCharCode(Number(digits));}else if(c==='x'){const h=text.slice(p,p+2);if(!/^[0-9a-f]{2}$/i.test(h))fail();out+=String.fromCharCode(parseInt(h,16));p+=2;}else if(c==='z'){while(/\s/.test(text[p]||''))p++;}else out+=({n:'\n',r:'\r',t:'\t',b:'\b',f:'\f',v:'\v',a:'\x07','\n':'\n'}[c]??c);}fail();}
 function identifier(){const m=/^[A-Za-z_][A-Za-z_0-9]*/.exec(text.slice(p));if(!m)fail();p+=m[0].length;return m[0];}
 function value(){skip();if(++tokens>2_000_000||++depth>100)fail();let out;
  if(text[p]==='"'||text[p]==="'")out=string();
  else if(text[p]==='{'){p++;out=Object.create(null);let index=1;skip();while(text[p]!=='}'){if(p>=text.length)fail();let k,v;skip();const long=/^\[(=*)\[/.exec(text.slice(p));if(text[p]==='['&&!long){p++;k=value();skip();if(text[p++]!==']')fail();skip();if(text[p++]!=='=')fail();v=value();}else{const start=p,m=/^[A-Za-z_][A-Za-z_0-9]*\s*=/.exec(text.slice(p));if(m){k=identifier();skip();p++;v=value();}else{p=start;k=index++;v=value();}}if(k===null||typeof k==='object')fail();out[k]=v;skip();if(text[p]===','||text[p]===';'){p++;skip();}else if(text[p]!=='}')fail();}p++;}
  else if(/^\[(=*)\[/.test(text.slice(p))){const m=/^\[(=*)\[/.exec(text.slice(p));p+=m[0].length;const end=text.indexOf(']'+m[1]+']',p);if(end<0)fail();out=text.slice(p,end).replace(/^\r?\n/,'');p=end+m[1].length+2;}
  else{const n=/^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(text.slice(p));if(n){p+=n[0].length;out=Number(n[0]);}else{const id=identifier();if(id==='true')out=true;else if(id==='false')out=false;else if(id==='nil')out=null;else fail();}}
  depth--;return out;
 }
 const vars=Object.create(null);skip();while(p<text.length){const name=identifier();skip();if(text[p++]!=='=')fail();vars[name]=value();skip();if(text[p]===';')p++;skip();}return vars;
}
const vals=o=>o&&typeof o==='object'?Object.values(o):[];
function profileFromTRP(name,p){
 const c=p?.characteristics||p?.player?.characteristics||{},a=p?.about||p?.player?.about||{};
 const section=v=>cleanText(typeof v==='string'?v:v?.TX||'');
 const parts=[];let appearance='',personality='',history='';
 if(Number(a.TE)===3){appearance=section(a.T3?.PH);personality=section(a.T3?.PS);history=section(a.T3?.HI);}
 else if(Number(a.TE)===2){for(const v of vals(a.T2)){const tx=section(v);if(tx)parts.push(tx);}}
 else{const tx=section(a.T1);if(tx)parts.push(tx);}
 const glances=vals(p?.misc?.PE||p?.player?.misc?.PE).map(x=>({title:cleanText(x.NA),text:cleanText(x.TX)})).filter(x=>x.title||x.text);
 const pronouns=vals(c.MI).find(x=>x.ID===7||/pronouns/i.test(x.NA||''))?.VA;
 return {name,displayName:cleanText([c.FN,c.LN].filter(Boolean).join(' '))||name,title:cleanText(c.FT||c.TI),race:cleanText(c.RA),rpClass:cleanText(c.CL),age:cleanText(c.AG),eyes:cleanText(c.EC),height:cleanText(c.HE),birthplace:cleanText(c.BP),residence:cleanText(c.RE),pronouns:cleanText(pronouns),appearance,personality,history,about:parts.join('\n\n'),glances,source:'TRP3 SavedVariables'};
}
export function profilesFromLua(text,roster){
 const vars=parseLua(text),reg=vars.TRP3_Register,output=[];
 if(reg){const chars=reg.character||reg.characters||{},profiles=reg.profiles||reg.profile||{};for(const r of roster){const entry=chars[r.name]||Object.entries(chars).find(([n])=>key(n)===key(r.name))?.[1];if(!entry)continue;const p=profiles[entry.profileID];if(p&&(p.characteristics||p.about))output.push(profileFromTRP(r.name,p));}}
 else if(vars.TRP3_Characters&&vars.TRP3_Profiles){for(const r of roster){const entry=vars.TRP3_Characters[r.name];const p=vars.TRP3_Profiles[entry?.profileID];if(p)output.push(profileFromTRP(r.name,p));}}
 else throw Error('This file does not contain TRP3 profile data. Use totalRP3_Data.lua.');
 return output;
}
export function validateProfiles(json,roster){const rows=Array.isArray(json)?json:json.profiles;if(!Array.isArray(rows))throw Error('Profiles JSON must contain a profiles array.');const names=new Set(roster.map(r=>key(r.name))),seen=new Set();const allowed=['displayName','title','race','rpClass','age','eyes','height','birthplace','residence','pronouns','appearance','personality','history','about','source'];return rows.map(p=>{if(!p||typeof p.name!=='string'||!names.has(key(p.name)))throw Error(`Profile is not matched to a roster character: ${p?.name||'missing name'}.`);if(seen.has(key(p.name)))throw Error(`Duplicate profile: ${p.name}.`);seen.add(key(p.name));const out={name:p.name};for(const f of allowed)if(p[f]!=null){if(typeof p[f]!=='string'||p[f].length>100000)throw Error(`Invalid ${f} for ${p.name}.`);out[f]=cleanText(p[f]);}out.glances=Array.isArray(p.glances)?p.glances.slice(0,5).map(g=>({title:cleanText(g.title),text:cleanText(g.text)})):[];return out;});}
export function validateGear(json,roster){const rows=Array.isArray(json)?json:json.characters;if(!Array.isArray(rows))throw Error('Gear JSON must contain a characters array.');const names=new Set(roster.map(r=>key(r.name))),seen=new Set();return rows.map(p=>{if(!names.has(key(p.name||'')))throw Error(`Gear character is not in this roster: ${p.name||'missing name'}.`);if(seen.has(key(p.name)))throw Error(`Duplicate gear character: ${p.name}.`);seen.add(key(p.name));if(!Array.isArray(p.equipment))throw Error(`Missing equipment for ${p.name}.`);return {name:p.name,updatedAt:typeof p.updatedAt==='string'?p.updatedAt:null,equipment:p.equipment.slice(0,25).map(i=>{if(typeof i.slot!=='string'||typeof i.name!=='string')throw Error('Each item needs a slot and name.');return {slot:i.slot,name:i.name,itemId:Number.isSafeInteger(i.itemId)&&i.itemId>0?i.itemId:null,itemLevel:Number.isFinite(i.itemLevel)?i.itemLevel:null,quality:typeof i.quality==='string'?i.quality:'Unknown'};})};});}

