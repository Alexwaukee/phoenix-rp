import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {parseRoster,parseCSV,rosterCSV,summarize,census,hoursAgo,parseLua,profilesFromLua,validateProfiles,validateGear,cleanText} from './core.mjs';
const csv=await fs.readFile(new URL('./roster.csv',import.meta.url),'utf8'),roster=parseRoster(csv);
test('Every row in the current CSV is included in the chart, including levels above 35',()=>{
 assert.ok(roster.length>0);assert.equal(new Set(roster.map(r=>r.name)).size,roster.length);
 const classes=[...new Set(roster.map(r=>r.class))],counts=census(roster,classes);
 assert.equal(counts.length,Math.max(35,...roster.map(r=>r.level)));
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
 assert.equal(census([] ,['Mage']).length,35);
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

