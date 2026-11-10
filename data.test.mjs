import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {parseRoster,parseCSV,rosterCSV,summarize,census,classBreakdown,hoursAgo,parseLua,profilesFromLua,validateProfiles,validateGear,cleanText,applyArmoryRaces,ARMORY_GUILD_URL} from './core.mjs';
import {snapshot,normalizeHistory,levelingStats,levelingCSV,refreshHistory,medianXPPerHour,RELEASE_AT} from './leveling.mjs';
import {XP_TO_NEXT,cumulativeXP,milestoneXP} from './xp.mjs';
const csv=await fs.readFile(new URL('./roster.csv',import.meta.url),'utf8'),roster=parseRoster(csv);

const sample=(name,level,cls='Mage')=>({name,level,class:cls,rank:'Member',lastOnline:'Online'});
const snap=(letter,at,rows)=>snapshot(letter.repeat(40),at,rows);
test('Median uses only active leveling characters and handles even, odd and empty samples',()=>{
 const rows=[sample('Low',6),sample('Zero',7),sample('A',10),sample('B',20),sample('C',30),sample('Missing',30),{...sample('Abandoned',40),lastOnline:'1d ago'},sample('Stopped',50),sample('Capped',60),{...sample('Unknown',40),lastOnline:'Unknown'}];
 const stats=new Map([['low',{xpPerHour:99999,recentXP:400}],['zero',{xpPerHour:0,recentXP:0}],['a',{xpPerHour:100,recentXP:400}],['b',{xpPerHour:500,recentXP:900}],['c',{xpPerHour:900,recentXP:1400}],['missing',{xpPerHour:null,recentXP:400}],['abandoned',{xpPerHour:99999,recentXP:900}],['stopped',{xpPerHour:99999,recentXP:0}],['capped',{xpPerHour:99999,recentXP:209800}],['unknown',{xpPerHour:99999,recentXP:400}]]);
 assert.deepEqual(medianXPPerHour(rows,stats),{median:500,count:3});
 assert.deepEqual(medianXPPerHour(rows.filter(r=>r.name!=='C'),stats),{median:300,count:2});
 assert.deepEqual(medianXPPerHour(rows.filter(r=>!['A','B','C'].includes(r.name)),stats),{median:null,count:0});
 assert.deepEqual(medianXPPerHour([{...rows[2],lastOnline:'23h ago'}],stats),{median:100,count:1});
});
test('Release baseline includes pre-snapshot XP while real observation intervals stay separate',()=>{
 const rows=[sample('A',16),sample('B',8),sample('New',2),sample('Short',5)];
 const history=normalizeHistory({schemaVersion:1,snapshots:[snap('c','2026-11-10T12:00:00Z',rows),snap('a','2026-11-08T12:00:00Z',[sample('A',10),sample('B',8)]),snap('b','2026-11-10T00:00:00Z',[sample('A',15),sample('B',8),sample('Short',2)])]});
 const stats=levelingStats(rows,history),a=stats.get('a'),b=stats.get('b'),s=stats.get('short');
 assert.equal(a.gain,6);assert.equal(a.hours,133);assert.equal(a.perDay,6/(133/24));assert.equal(a.recentGain,1);assert.equal(a.recentDays,.5);assert.equal(a.recentPerDay,2);
 assert.equal(a.xpGain,92800);assert.equal(a.observedXP,65200);assert.equal(a.xpPerHour,92800/133);assert.equal(a.recentXPPerHour,1200);
 assert.equal(a.initialXP,27600);assert.equal(a.initialHours,85);assert.equal(a.initialXPPerHour,27600/85);assert.equal(a.initialXP+a.observedXP,a.xpGain);
 assert.equal(b.perDay,0);assert.equal(b.xpPerHour,15700/133);assert.equal(b.recentXP,0);
 assert.equal(s.hours,133);assert.equal(s.observedDays,.5);assert.equal(s.xpPerHour,4800/133);assert.equal(s.startedAt,a.startedAt);
 assert.equal(stats.get('new').status,'ok');assert.equal(stats.get('new').xpPerHour,400/133);assert.equal(stats.get('new').recentXP,null);
 assert.equal(a.points.length,3);assert.deepEqual(a.baseline,{at:RELEASE_AT,level:1,assumed:true});
 const exported=parseCSV(levelingCSV(rows,stats));assert.equal(exported.length,rows.length+1);assert.equal(exported[1][10],String(92800/133));assert.equal(exported[3][10],String(400/133));assert.equal(exported[1][15],RELEASE_AT);assert.equal(exported[1][21],String(27600/85));
});
test('An assumed first interval does not qualify a single-snapshot character as actively leveling',()=>{
 const rows=[sample('One',20)],stats=levelingStats(rows,[snap('a','2026-11-06T23:00:00Z',rows)]),s=stats.get('one');
 assert.equal(s.xpPerHour,167200/48);assert.equal(s.initialXPPerHour,167200/48);assert.equal(s.points.length,1);assert.equal(s.recentXP,null);assert.deepEqual(medianXPPerHour(rows,stats),{median:null,count:0});
});
test('Pre-release timestamps are rejected and a snapshot exactly at release avoids division by zero',()=>{
 const rows=[sample('A',2)];
 const invalid=levelingStats(rows,[snap('a','2026-11-03T23:00:00Z',rows)]).get('a');assert.equal(invalid.status,'before-release');assert.equal(invalid.xpPerHour,null);
 const valid=levelingStats(rows,[snap('a',RELEASE_AT,[sample('A',1)]),snap('b','2026-11-05T00:00:00Z',rows)]).get('a');assert.equal(valid.initialHours,0);assert.equal(valid.initialXPPerHour,null);assert.equal(valid.xpPerHour,400);
});
test('XP conversion uses cumulative level costs, handles the cap and rejects unsupported levels',()=>{
 assert.equal(XP_TO_NEXT.length,59);assert.equal(cumulativeXP(1),0);assert.equal(cumulativeXP(10),27600);assert.equal(cumulativeXP(60),4084700);
 assert.equal(milestoneXP(1,2),400);assert.equal(milestoneXP(20,21),23200);assert.equal(milestoneXP(10,16),65200);assert.equal(milestoneXP(60,60),0);
 for(const level of [0,61,2.5])assert.equal(cumulativeXP(level),null);
 assert.equal(milestoneXP(20,19),null);assert.equal(milestoneXP(59,61),null);
});
test('Changed identities, decreasing levels and untimestamped current levels are not treated as valid rates',()=>{
 const rows=[sample('Down',3),sample('Changed',8,'Warrior'),sample('New level',12),sample('Missing',5),sample('Gap',8)];
 const history=[snap('a','2026-11-08T12:00:00Z',[sample('Down',5),sample('Changed',4),sample('New level',10),sample('Missing',5),sample('Gap',2)]),snap('b','2026-11-09T12:00:00Z',[sample('Down',3)]),snap('c','2026-11-10T12:00:00Z',[...rows.filter(r=>!['New level','Missing'].includes(r.name)),sample('New level',11)])];
 const stats=levelingStats(rows,history);
 for(const name of ['down','changed']){assert.equal(stats.get(name).status,'changed-history');assert.equal(stats.get(name).perDay,null);}
 for(const name of ['new level','missing'])assert.equal(stats.get(name).status,'not-in-latest');
 assert.equal(stats.get('gap').hours,133);assert.equal(stats.get('gap').perDay,6/(133/24));
});
test('Future roster commits are loaded automatically, existing snapshots are reused and request limits are surfaced',async()=>{
 const old=snap('a','2026-11-08T12:00:00Z',[sample('A',1)]),sha='b'.repeat(40),calls=[];
 const updated=await refreshHistory([old],async url=>{calls.push(url);return url.includes('/commits?')?{ok:true,json:async()=>[{sha,commit:{committer:{date:'2026-11-10T12:00:00Z'}}},{sha:old.sha}]}:{ok:true,text:async()=>rosterCSV([sample('A',7)])};});
 assert.equal(calls.length,2);assert.equal(updated.length,2);assert.equal(levelingStats([sample('A',7)],updated).get('a').xpPerHour,11200/133);
 await assert.rejects(refreshHistory([old],async()=>({ok:false,status:403})),/limit reached/);
 assert.equal(old.characters[0].level,1);
});
test('All current characters have a history result and bundled counts match the source snapshots',async()=>{
 const history=normalizeHistory(JSON.parse(await fs.readFile(new URL('./leveling-history.json',import.meta.url),'utf8'))),stats=levelingStats(roster,history);
 assert.equal(stats.size,roster.length);assert.equal(history.at(-1).characters.length,roster.length);
 assert.equal(history.at(-1).characters.reduce((n,r)=>n+r.level,0),roster.reduce((n,r)=>n+r.level,0));
 for(const s of stats.values()){assert.ok(s.points.length>0);if(s.status==='ok'){assert.ok(Number.isFinite(s.xpPerHour));assert.equal(s.gain,s.last.level-s.first.level);assert.equal(s.xpPerHour,cumulativeXP(s.last.level)/((Date.parse(s.last.at)-Date.parse(RELEASE_AT))/3600000));assert.equal(s.startedAt,RELEASE_AT);assert.equal(s.initialXP+s.observedXP,s.xpGain);}}
});

test('Armory races require a matching name and class, preserve CSV races and never replace roster levels',()=>{
 const input=[sample('A',20),sample('B',3,'Warrior'),{...sample('C',8),race:'CSV race'},sample('D',9)];
 const data={schemaVersion:1,source:ARMORY_GUILD_URL,region:'us',mode:'rp',guild:'Phoenix RP',retrievedAt:'2026-11-10T15:00:00Z',characters:[{name:'A',level:10,class:'Mage',race:'Human'},{name:'B',class:'Mage',race:'Gnome'},{name:'C',class:'Mage',race:'Human'}]};
 const result=applyArmoryRaces(input,data);assert.equal(result[0].race,'Human');assert.equal(result[0].level,20);assert.equal(result[0].raceSource,ARMORY_GUILD_URL);assert.equal(input[0].race,undefined);assert.equal(result[1].race,undefined);assert.equal(result[2].race,'CSV race');assert.equal(result[3].race,undefined);
 assert.equal(parseRoster(rosterCSV(result))[0].race,'Human');
 assert.throws(()=>applyArmoryRaces(input,{...data,region:'eu'}),/Invalid/);
 assert.throws(()=>applyArmoryRaces(input,{...data,characters:[data.characters[0],data.characters[0]]}),/duplicate/);
});
test('Published armory races match every current roster name and class without altering roster stats',async()=>{
 const data=JSON.parse(await fs.readFile(new URL('./races.json',import.meta.url),'utf8')),enriched=applyArmoryRaces(roster,data);
 assert.equal(new Set(data.characters.map(r=>r.name)).size,data.characters.length);assert.equal(enriched.filter(r=>r.race).length,roster.length);assert.deepEqual(summarize(enriched),summarize(roster));
 for(const cls of classBreakdown(enriched))assert.equal(cls.races.reduce((n,r)=>n+r.count,0),cls.count);
});

test('Class totals and race subcounts include unknown races without inventing them',()=>{
 const rows=[{class:'Mage',race:'Human'},{class:'Mage',race:'Gnome'},{class:'Mage',race:'Human'},{class:'Mage'},{class:'Warrior',race:'Orc'}];
 assert.deepEqual(classBreakdown(rows),[{className:'Mage',count:4,races:[{name:'Human',count:2},{name:'Gnome',count:1}],unknown:1},{className:'Warrior',count:1,races:[{name:'Orc',count:1}],unknown:0}]);
 assert.equal(classBreakdown(roster).reduce((n,c)=>n+c.count,0),roster.length);
 for(const c of classBreakdown(rows))assert.equal(c.races.reduce((n,r)=>n+r.count,0)+c.unknown,c.count);
 assert.deepEqual(classBreakdown(rows.filter(r=>r.class==='Warrior'),['Mage','Warrior'])[0],{className:'Mage',count:0,races:[],unknown:0});
});

test('Optional Race column can be inserted anywhere and survives CSV downloads',()=>{
 const input='Name,Level,Class,Race,Rank,Last Online\nTest One,20,Mage,Human,Member,Online\nTest Two,36,Mage,,Member,1h ago';
 const rows=parseRoster(input);assert.equal(rows[0].race,'Human');assert.equal(rows[1].race,'');
 assert.deepEqual(parseRoster(rosterCSV(rows)),rows);
 assert.equal(parseCSV(rosterCSV(roster))[0].length,5);
 assert.throws(()=>parseRoster('Name,Level,Class,Rank,Last Online,Race,Race\nA,1,Mage,Member,Online,Human,Human'),/optional Race/);
});
test('Every row in the current CSV is included in the chart, including levels above 35',()=>{
 assert.ok(roster.length>0);assert.equal(new Set(roster.map(r=>r.name)).size,roster.length);
 const classes=[...new Set(roster.map(r=>r.class))],counts=census(roster,classes);
 assert.equal(counts.length,Math.max(...roster.map(r=>r.level)));
 assert.equal(counts.reduce((n,d)=>n+d.counts.reduce((a,b)=>a+b,0),0),roster.length);
 const expected=new Map();for(const r of roster)expected.set(r.class,(expected.get(r.class)||0)+1);
 assert.deepEqual(counts.reduce((n,d)=>n.map((x,i)=>x+d.counts[i]),Array(classes.length).fill(0)),classes.map(c=>expected.get(c)));
 assert.deepEqual(parseRoster(rosterCSV(roster)),roster);
});

test('A new CSV recalculates stacks and extends the level axis without dropping members',()=>{
 const old=[{name:'A',level:35,class:'Mage',rank:'Member',lastOnline:'Online'}];
 const updated=[...old,{name:'B',level:36,class:'Mage',rank:'Member',lastOnline:'Online'},{name:'C',level:46,class:'Warrior',rank:'Member',lastOnline:'Online'}];
 assert.equal(census(old,['Mage','Warrior']).length,35);
 const next=census(parseRoster(rosterCSV(updated)),['Mage','Warrior']);
 assert.equal(next.length,46);assert.deepEqual(next[34].counts,[1,0]);assert.deepEqual(next[35].counts,[1,0]);assert.deepEqual(next[45].counts,[0,1]);
 assert.equal(next.reduce((n,r)=>n+r.counts.reduce((a,b)=>a+b,0),0),3);
 assert.equal(census(old,['Mage','Warrior'],46).length,46);
 const lower=[{...old[0],level:12}];
 assert.equal(census(parseRoster(rosterCSV(lower)),['Mage','Warrior']).length,12);
 assert.equal(census([{...old[0],level:1}],['Mage']).length,1);
 assert.equal(census([] ,['Mage']).length,1);
});
test('CSV handles quoted commas, newlines, Unicode, BOM and escaped quotes',()=>{
 assert.deepEqual(parseCSV('\uFEFF"one","two,three","a""b"\r\n"Fionà","a\nb","c"'),[['one','two,three','a"b'],['Fionà','a\nb','c']]);
 assert.throws(()=>parseCSV('"unfinished'),/quoted field/);
 assert.throws(()=>parseRoster(rosterCSV([...roster,roster[0]])),/Duplicate/);
 assert.throws(()=>parseRoster(rosterCSV([{...roster[0],level:'oops'}])),/Invalid level/);
});
test('Activity cutoff excludes one day and accepts less than one hour',()=>{
 assert.equal(hoursAgo('1d ago'),24);assert.equal(hoursAgo('1d 13h ago'),37);assert.equal(hoursAgo('< 1h ago'),0);assert.equal(hoursAgo('23h ago'),23);assert.equal(hoursAgo('Unknown'),Infinity);
});
test('Lua parser reads data without executing Lua',()=>{
 const v=parseLua('--comment\nA = { ["x"] = "one\\nline", [1] = true, 8, ["long"] = [=[abc]=] }');assert.equal(v.A.x,'one\nline');assert.equal(v.A.long,'abc');
 assert.throws(()=>parseLua('A = os.execute("anything")'),/Unsupported/);
 assert.throws(()=>parseLua('A = function() end'),/Unsupported/);
});
test('TRP3 mapping includes matched public fields and excludes notes/unrelated profiles',()=>{
 const text='TRP3_Register = { character = { ["Acadiia Silverwing"] = {profileID="p"}, ["Other Person"]={profileID="q"} }, profiles={p={characteristics={FN="Acadiia",LN="Silverwing",RA="Human"},about={TE=3,T3={PH={TX="Appearance"},HI={TX="History"}}},notes="private"},q={characteristics={FN="Other"}}} }';
 const p=profilesFromLua(text,roster);assert.equal(p.length,1);assert.equal(p[0].history,'History');assert.equal(p[0].appearance,'Appearance');assert.ok(!JSON.stringify(p).includes('private'));assert.equal(p[0].race,'Human');
});
test('Published profile and gear inputs match roster names',async()=>{
 const p=validateProfiles(JSON.parse(await fs.readFile(new URL('./profiles.json',import.meta.url),'utf8')),roster);assert.equal(p.length,0);
 assert.throws(()=>validateProfiles({profiles:[{name:'Unrelated person'}]},roster),/not matched/);
 assert.throws(()=>validateGear({characters:[{name:'Acadiia Silverwing',equipment:[{name:'missing slot'}]}]},roster),/slot and name/);
 assert.equal(cleanText('|cffffffffText|r'), 'Text');
});
