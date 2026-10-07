'use strict';
(function(root){
 const labels={all:'全部分類',gases:'常見氣體',acids:'酸',bases:'鹼',salts:'鹽類',oxides:'氧化物',organic:'有機物',biomolecules:'生物分子',elements:'元素物質',public:'PubChem 公開物質',other:'其他物質',neutralization:'酸鹼中和',precipitation:'沉澱反應',displacement:'金屬置換',oxidation:'氧化反應',decomposition:'分解反應',combustion:'燃燒反應',gas:'產氣反應',biochemistry:'生化反應',synthesis:'合成反應'};
 const normalize=value=>String(value||'').trim().replace(/[₀₁₂₃₄₅₆₇₈₉]/g,c=>'₀₁₂₃₄₅₆₇₈₉'.indexOf(c)).replace(/\s+/g,'').toLowerCase();
 const signature=counts=>Object.entries(counts).sort(([a],[b])=>a.localeCompare(b)).map(([s,n])=>s+':'+n).join('|');
 function create(data,engine){
  const compounds=data.compounds,reactions=data.reactions;
  const compoundMap=new Map(compounds.map(c=>[c.id,c])),compositionIndex=new Map(),aliasIndex=new Map(),speciesCache=new Map(),reactionIndex=new Map(),searchIndex=new Map();
  for(const c of compounds){const key=signature(c.counts);if(!compositionIndex.has(key))compositionIndex.set(key,[]);compositionIndex.get(key).push(c);for(const alias of c.aliases||[]){const a=normalize(alias);if(!aliasIndex.has(a))aliasIndex.set(a,[]);aliasIndex.get(a).push(c)}}
  const explicitAliases=value=>aliasIndex.get(normalize(value))||[];
  function candidates(formulaOrCounts){
   let counts,formula=null,charge=0;
   if(typeof formulaOrCounts==='string'){const parsed=engine.parseFormula(formulaOrCounts);counts=parsed.counts;charge=parsed.charge;formula=parsed.normalized;const alias=explicitAliases(formula);if(alias.length===1)return alias}
   else counts=formulaOrCounts;
   const key=signature(counts);
   return (compositionIndex.get(key)||[]).filter(c=>(c.charge||0)===charge);
  }
  function identify(formulaOrCounts){if(typeof formulaOrCounts==='string'){const aliases=explicitAliases(formulaOrCounts);if(aliases.length===1)return aliases[0]}const matches=candidates(formulaOrCounts);const safe=matches.filter(c=>c.compositionSafe);return safe.length===1&&matches.length===1?safe[0]:null}
  function speciesKey(formula){if(speciesCache.has(formula))return speciesCache.get(formula);const parsed=engine.parseFormula(formula),match=identify(formula),key=match?'id:'+match.id:'formula:'+parsed.normalized;speciesCache.set(formula,key);return key}
  function sideKey(side){return [...new Set((Array.isArray(side)?side.map(item=>typeof item==='string'?item:item.formula):Object.keys(side)).map(speciesKey))].sort().join('||')}
  for(const r of reactions){if(r.autoMatch===false)continue;const left=sideKey(r.inputs);if(!reactionIndex.has(left))reactionIndex.set(left,[]);reactionIndex.get(left).push({record:r,right:sideKey(r.outputs)})}
  for(const c of [...compounds,...reactions])searchIndex.set(c,normalize([c.name,c.english,c.formula,c.equation,c.namedEquation,c.short,labels[c.category],...(c.aliases||[])].filter(Boolean).join(' ')));
  function findReactions(reactants,products){const left=sideKey(reactants),right=products?sideKey(products):null;return (reactionIndex.get(left)||[]).filter(item=>!right||item.right===right).map(item=>item.record)}
  function query({kind='compounds',query='',category='all',state='all',provenance='all',page=1,pageSize=12}={}){const source=kind==='reactions'?reactions:compounds;const terms=String(query).split(/\s+/).map(normalize).filter(Boolean);const filtered=source.filter(c=>{
   if(category!=='all'&&c.category!==category)return false;
   if(kind!=='reactions'&&state!=='all'&&c.state!==state)return false;
   if(provenance!=='all'&&(c.provenance||'teaching')!==provenance)return false;
   const text=searchIndex.get(c);return terms.every(t=>text.includes(t));
  });const pages=Math.max(1,Math.ceil(filtered.length/pageSize));const safePage=Math.max(1,Math.min(Number.isFinite(page)?Math.floor(page):1,pages));return {items:filtered.slice((safePage-1)*pageSize,safePage*pageSize),total:filtered.length,pages,page:safePage}}
  return {candidates,identify,findReactions,query,getCompound:id=>compoundMap.get(id)||null,labels,signature};
 }
 root.ChemCatalog={create,labels};if(typeof module==='object'&&module.exports)module.exports=root.ChemCatalog;
})(globalThis);
