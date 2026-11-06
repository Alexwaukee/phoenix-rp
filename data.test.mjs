import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {parseRoster,parseCSV,rosterCSV,summarize,census,hoursAgo,parseLua,profilesFromLua,validateProfiles,validateGear,cleanText} from './core.mjs';
const csv=await fs.readFile(new URL('./roster.csv',import.meta.url),'utf8'),roster=parseRoster(csv);
test('All source records and independently counted census totals are preserved',()=>{
 assert.equal(roster.length,192);assert.equal(new Set(roster.map(r=>r.name)).size,192);
 assert.deepEqual(summarize(roster),{count:192,online:26,under24:166,average:11.90625,median:11});
 const classes=Object.keys({Druid:24,Hunter:22,Mage:21,Paladin:17,Priest:24,Rogue:17,Shaman:19,Warlock:16,Warrior:32}),counts=census(roster,classes);
 assert.equal(counts.length,35);assert.equal(counts.reduce((n,d)=>n+d.counts.reduce((a,b)=>a+b,0),0),192);
 assert.deepEqual(counts.reduce((n,d)=>n.map((x,i)=>x+d.counts[i]),Array(9).fill(0)),[24,22,21,17,24,17,19,16,32]);
 assert.equal(counts[9].counts.reduce((a,b)=>a+b,0),20);assert.equal(counts[34].counts.reduce((a,b)=>a+b,0),0);
 assert.deepEqual(parseRoster(rosterCSV(roster)),roster);
});
test('CSV handles quoted commas, newlines, Unicode, BOM and escaped quotes',()=>{
 assert.deepEqual(parseCSV('\uFEFF"one","two,three","a""b"\r\n"Fionà","a\nb","c"'),[['one','two,three','a"b'],['Fionà','a\nb','c']]);
 assert.throws(()=>parseCSV('"unfinished'),/quoted field/);
 assert.throws(()=>parseRoster(csv+'"Acadiia Silverwing","5","Rogue","Hatchling","Online"'),/Duplicate/);
 assert.throws(()=>parseRoster(csv.replace('"5","Rogue"','"oops","Rogue"')),/Invalid level/);
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
