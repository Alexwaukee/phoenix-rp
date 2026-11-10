// LevelExperience, WoW Forever build 1.60.1.70862.
// Game-file extraction and source: https://zephras.com/forever/enUS/experience/
// Values are XP needed to go from each level (1–59) to the next level.
export const XP_SOURCE='https://zephras.com/forever/enUS/experience/';
export const XP_BUILD='1.60.1.70862';
export const XP_TO_NEXT=Object.freeze([400,900,1400,2100,2800,3600,4500,5400,6500,7600,8800,10100,11400,12900,14400,16000,17700,19400,21300,23200,25200,27300,29400,31700,34000,36400,38900,41400,44300,47400,50800,54500,58600,62800,67100,71600,76100,80800,85700,90700,95800,101000,106300,111800,117500,123200,129100,135100,141200,147500,153900,160400,167100,173900,180800,187900,195000,202300,209800]);
const thresholds=[0];for(const xp of XP_TO_NEXT)thresholds.push(thresholds.at(-1)+xp);
export function cumulativeXP(level){return Number.isInteger(level)&&level>=1&&level<=thresholds.length?thresholds[level-1]:null;}
export function milestoneXP(firstLevel,lastLevel){const first=cumulativeXP(firstLevel),last=cumulativeXP(lastLevel);return first===null||last===null||last<first?null:last-first;}
