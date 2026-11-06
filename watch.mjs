import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {parseRoster,rosterCSV,profilesFromLua,validateProfiles,key} from './core.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const args=process.argv.slice(2);
const value=flag=>{const i=args.indexOf(flag);return i<0?null:args[i+1];};
const csv=value('--csv'),trp=value('--trp3'),push=args.includes('--push'),once=args.includes('--once');
const interval=Number(value('--seconds')||20);
if((!csv&&!trp)||!Number.isFinite(interval)||interval<5){console.error('Usage: node watch.mjs --csv "C:\\path\\roster.csv" [--trp3 "C:\\path\\totalRP3_Data.lua"] [--push] [--once] [--seconds 20]');process.exit(1);}
function git(args,allowFailure=false){const r=spawnSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true});if(r.error||r.status!==0){if(allowFailure)return null;throw Error(r.error?.message||r.stderr.trim()||'Git command failed.');}return r.stdout.trim();}
if(push){if(path.resolve(git(['rev-parse','--show-toplevel']))?.toLocaleLowerCase()!==root.toLocaleLowerCase())throw Error('--push requires this site folder to be its own Git repository.');git(['remote','get-url','origin']);console.log('Publishing changes to the current repository. Only validated roster/profile data files will be committed.');}
let lastCSV='',lastTRP='',pendingCSV='',pendingTRP='',running=false;
async function readStable(file){const before=await fs.stat(file);if(before.size>25_000_000)throw Error('Input file exceeds 25 MB.');const text=await fs.readFile(file,'utf8');const after=await fs.stat(file);if(before.size!==after.size||before.mtimeMs!==after.mtimeMs)throw Error('Input is still being saved; waiting for the next check.');return text;}
async function writeAtomic(file,text){const current=await fs.readFile(file,'utf8').catch(()=>null);if(current===text)return false;const temp=file+'.tmp';await fs.writeFile(temp,text,'utf8');await fs.rename(temp,file);return true;}
async function tick(){if(running)return;running=true;try{
 const nextCSV=csv?await readStable(path.resolve(csv)):await fs.readFile(path.join(root,'roster.csv'),'utf8');
 const nextTRP=trp?await readStable(path.resolve(trp)):'';
 if(!once&&(nextCSV!==pendingCSV||nextTRP!==pendingTRP)){pendingCSV=nextCSV;pendingTRP=nextTRP;return;}
 if(nextCSV===lastCSV&&nextTRP===lastTRP)return;
 const roster=parseRoster(nextCSV),names=new Set(roster.map(r=>key(r.name)));
 const old=JSON.parse(await fs.readFile(path.join(root,'profiles.json'),'utf8'));
 const existing=validateProfiles({profiles:old.profiles.filter(p=>names.has(key(p.name)))},roster);
 const merged=new Map(existing.map(p=>[key(p.name),p]));
 if(trp)profilesFromLua(nextTRP,roster).forEach(p=>merged.set(key(p.name),p));
 const updates=[];
 if(csv&&await writeAtomic(path.join(root,'roster.csv'),rosterCSV(roster)))updates.push('roster.csv');
 const json=JSON.stringify({schemaVersion:1,profiles:[...merged.values()]},null,2)+'\n';
 if(await writeAtomic(path.join(root,'profiles.json'),json))updates.push('profiles.json');
 if(updates.length)console.log(`${new Date().toLocaleTimeString()}: ${roster.length} characters, ${merged.size} RP profiles. ${push?'Publishing…':'Local site data updated.'}`);
 if(push){
  const files=['roster.csv','profiles.json'];
  // Refuse to include someone else's staged changes in an automatic data commit.
  const staged=git(['diff','--cached','--name-only']).split('\n').filter(Boolean);
  if(staged.some(f=>!files.includes(f)))throw Error('Other files are staged. Unstage them before automatic publishing.');
  git(['add','--',...files]);
  if(git(['diff','--cached','--name-only','--',...files]))git(['commit','-m','Update guild roster and public RP profiles','--',...files]);
  git(['push','origin','HEAD']);
 }
 lastCSV=nextCSV;lastTRP=nextTRP;
}catch(e){console.error('Update skipped: '+e.message+' Last published data is unchanged.');if(once)process.exitCode=1;}finally{running=false;}}
await tick();
if(!once){console.log(`Watching every ${interval}s. Press Ctrl+C to stop. Simple Guild Exporter still needs a copied/saved CSV; TRP3 files change when WoW saves them.`);setInterval(tick,interval*1000);}
