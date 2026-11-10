import {key,parseRoster} from './core.mjs?v=20261110-leveling';

export const REPO='Alexwaukee/phoenix-rp';
export function snapshot(sha,at,rows){
 if(!/^[a-f0-9]{40}$/.test(sha)||!Number.isFinite(Date.parse(at)))throw Error('Invalid roster history timestamp or commit.');
 const seen=new Set();
 const characters=rows.map(r=>{if(typeof r.name!=='string'||!r.name.trim()||typeof r.class!=='string'||!Number.isInteger(r.level)||r.level<1||r.level>1000||seen.has(key(r.name)))throw Error('Invalid character in roster history.');seen.add(key(r.name));return {name:r.name,level:r.level,class:r.class};});
 return {sha,at:new Date(at).toISOString(),characters};
}
export function normalizeHistory(input){
 if(input.schemaVersion!==1||!Array.isArray(input.snapshots))throw Error('Invalid roster history file.');
 return [...new Map(input.snapshots.map(s=>{const clean=snapshot(s.sha,s.at,s.characters);return [clean.sha,clean];})).values()].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)||a.sha.localeCompare(b.sha));
}
export function levelingStats(roster,snapshots){
 const histories=new Map(),latest=snapshots.at(-1);
 for(const s of snapshots)for(const r of s.characters){const id=key(r.name);if(!histories.has(id))histories.set(id,[]);histories.get(id).push({at:s.at,sha:s.sha,level:r.level,class:r.class});}
 return new Map(roster.map(r=>{
  const points=histories.get(key(r.name))||[],first=points[0],last=points.at(-1),previous=points.at(-2);
  let status='ok';
  if(!last||last.sha!==latest?.sha||last.level!==r.level||last.class!==r.class)status='not-in-latest';
  else if(points.some((p,i)=>p.class!==r.class||(i&&p.level<points[i-1].level)))status='changed-history';
  else if(!previous||Date.parse(last.at)<=Date.parse(first.at))status='one-snapshot';
  const valid=status==='ok',days=valid?(Date.parse(last.at)-Date.parse(first.at))/86400000:null,gain=valid?last.level-first.level:null;
  const recentDays=valid?(Date.parse(last.at)-Date.parse(previous.at))/86400000:null,recentGain=valid?last.level-previous.level:null;
  return [key(r.name),{status,points,first,last,days,gain,perDay:valid?gain/days:null,recentGain,recentDays,recentPerDay:recentDays>0?recentGain/recentDays:null}];
 }));
}
const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';
export function levelingCSV(roster,stats){
 const rows=[['Name','Class','Current level','Status','First observed (UTC)','First level','Latest observed (UTC)','Snapshots','Days observed','Levels gained','Levels per calendar day','Previous observed (UTC)','Latest gain','Latest interval days','Latest levels per calendar day']];
 for(const r of roster){const s=stats.get(key(r.name));rows.push([r.name,r.class,r.level,s.status,s.first?.at,s.first?.level,s.last?.at,s.points.length,s.days,s.gain,s.perDay,s.points.at(-2)?.at,s.recentGain,s.recentDays,s.recentPerDay]);}
 return rows.map(r=>r.map(quote).join(',')).join('\r\n')+'\r\n';
}
export async function refreshHistory(bundled,request=(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(15000)})){
 const snapshots=new Map(bundled.map(s=>[s.sha,s]));let count=0;
 for(let page=1;page<=20;page++){
  const response=await request(`https://api.github.com/repos/${REPO}/commits?path=roster.csv&per_page=100&page=${page}`,{cache:'no-store'});
  if(!response.ok)throw Error(response.status===403||response.status===429?'GitHub history request limit reached.':'GitHub history could not be loaded.');
  const commits=await response.json();if(!Array.isArray(commits))throw Error('Invalid GitHub history response.');
  for(const c of commits){
   if(snapshots.has(c.sha))continue;
   const response=await request(`https://raw.githubusercontent.com/${REPO}/${c.sha}/roster.csv`,{cache:'no-store'});
   if(!response.ok)throw Error('A roster snapshot could not be loaded.');
   snapshots.set(c.sha,snapshot(c.sha,c.commit.committer.date,parseRoster(await response.text())));
  }
  count+=commits.length;if(commits.length<100)return normalizeHistory({schemaVersion:1,snapshots:[...snapshots.values()]});
 }
 throw Error(`History exceeds ${count} updates; showing bundled snapshots.`);
}
