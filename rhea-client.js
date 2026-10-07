/* Read-only Rhea SPARQL client. CC BY 4.0 dataset: credit Rhea/SIB in the UI.
 * Browser: RheaClient.search('glucose', { mode:'text', limit:20, offset:0 })
 * Browser: RheaClient.search('C6H12O6', { mode:'formula' })
 * Browser: RheaClient.getReaction(10000, { engine:ChemEngine })
 * Search returns curated reaction summaries. getReaction validates the supplied
 * source coefficients, total atom counts and charge; it does not predict outcomes.
 * No credentials, API key, write call, build dependency or server proxy is used.
 */
(function(root){
  'use strict';
  const ENDPOINT='https://sparql.rhea-db.org/sparql';
  const PREFIX='PREFIX rh: <http://rdf.rhea-db.org/>\nPREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n';
  const SCOPE='?rhea rdfs:subClassOf rh:Reaction; rh:id ?id; rh:equation ?equation; rh:isChemicallyBalanced true; rh:isTransport false; rh:status rh:Approved.';
  const fields='?id ?equation ?side ?part ?coefficientPredicate ?compound ?name ?formula ?charge ?chebi';
  const participantPattern=`?rhea rh:side ?side. ?side rh:contains ?part. ?part rh:compound ?compound.
  OPTIONAL {?side ?coefficientPredicate ?part. FILTER(regex(str(?coefficientPredicate), "contains[0-9]+$"))}
  OPTIONAL {?compound rh:name ?name} OPTIONAL {?compound rh:formula ?formula}
  OPTIONAL {?compound rh:charge ?charge} OPTIONAL {?compound rh:chebi ?chebi}`;
  const value=s=>JSON.stringify(String(s).replace(/[\u0000-\u001f]/g,' ').trim());
  async function query(text,options={}){
    const controller=new AbortController();
    const abort=()=>controller.abort();
    if(options.signal?.aborted)abort();
    options.signal?.addEventListener('abort',abort,{once:true});
    const timer=setTimeout(abort,options.timeoutMs||25000);
    try{
      const response=await fetch(ENDPOINT+'?format=json&query='+encodeURIComponent(PREFIX+text),{headers:{Accept:'application/sparql-results+json'},signal:controller.signal,credentials:'omit'});
      if(!response.ok)throw Error('Rhea API HTTP '+response.status);
      const data=await response.json();
      if(!data.results?.bindings)throw Error('Rhea API 格式異常');
      return {release:response.headers.get('X-Release'),rows:data.results.bindings.map(row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k,v.value])))};
    }finally{clearTimeout(timer);options.signal?.removeEventListener('abort',abort)}
  }
  async function search(term,options={}){
    const q=String(term).trim();if(!q||q.length>160)throw Error('請輸入1至160字的搜尋字詞');
    const limit=Math.max(1,Math.min(20,Math.trunc(options.limit||20))),offset=Math.max(0,Math.trunc(options.offset||0));
    let filter;
    if(options.mode==='formula'){
      let formula=q,chargeFilter='';
      const engine=options.engine||root.ChemEngine;
      if(engine?.parseFormula){
        const parsed=engine.parseFormula(q),elements=Object.keys(parsed.counts);
        elements.sort((a,b)=>{
          if(parsed.counts.C){if(a==='C')return -1;if(b==='C')return 1;if(a==='H')return -1;if(b==='H')return 1}
          return a.localeCompare(b);
        });
        formula=elements.map(e=>e+(parsed.counts[e]===1?'':parsed.counts[e])).join('');
        chargeFilter=`?searchCompound rh:charge ?searchCharge. FILTER(?searchCharge = ${parsed.charge})`;
      }
      filter=`?rhea rh:side/rh:contains/rh:compound ?searchCompound. ?searchCompound rh:formula ${value(formula)}. ${chargeFilter}`;
    }
    else if(/^RHEA:\d+$/i.test(q)||/^\d+$/.test(q))filter='FILTER(?id = '+Number(q.replace(/^RHEA:/i,''))+')';
    else filter=`FILTER(CONTAINS(LCASE(?equation),LCASE(${value(q)})))`;
    const result=await query(`SELECT DISTINCT ?id ?equation WHERE {${SCOPE} ${filter}} ORDER BY ?id LIMIT ${limit} OFFSET ${offset}`,options);
    return {release:result.release,results:result.rows.map(r=>({id:'rhea-'+r.id,rheaId:Number(r.id),name:'RHEA:'+r.id,namedEquation:r.equation,sourceUrl:'https://www.rhea-db.org/rhea/'+r.id})),limit,offset,mayHaveMore:result.rows.length===limit};
  }
  function convertRows(rows,engine){
    if(!engine?.parseFormula)throw Error('需要 ChemEngine 進行組成驗證');
    if(!rows.length)throw Error('找不到可用的已核准生化反應');
    const id=Number(rows[0].id),sides={reactants:[],products:[]},seen=new Set();
    for(const row of rows){
      const key=row.side+'|'+row.part;if(seen.has(key))continue;seen.add(key);
      const coefficient=Number(row.coefficientPredicate?.match(/contains(\d+)$/)?.[1]);
      const charge=Number(row.charge);
      if(!row.formula||!row.name||row.charge===undefined||!Number.isSafeInteger(charge)||!Number.isSafeInteger(coefficient)||coefficient<1)throw Error('來源包含尚不支援的泛化參與物或係數');
      const parsed=engine.parseFormula(row.formula);
      if(parsed.charge!==0)throw Error('來源電荷標記異常');
      const formula=row.formula+(charge===0?'':'^'+(Math.abs(charge)===1?'':Math.abs(charge))+(charge>0?'+':'-'));
      const side=row.side.endsWith('_L')?'reactants':row.side.endsWith('_R')?'products':null;
      if(!side)throw Error('來源反應方向尚不支援');
      sides[side].push({name:row.name,formula,coefficient,charge,chebi:row.chebi,counts:parsed.counts});
    }
    if(!sides.reactants.length||!sides.products.length)throw Error('反應缺少其中一側');
    const totals={};let chargeSum=0;
    for(const [side,sign] of [['reactants',1],['products',-1]])for(const p of sides[side]){
      for(const [element,count] of Object.entries(p.counts))totals[element]=(totals[element]||0)+sign*count*p.coefficient;
      chargeSum+=sign*p.coefficient*p.charge;
    }
    if(chargeSum!==0||Object.values(totals).some(n=>n!==0))throw Error('此記錄未通過元素與電荷守恆檢查');
    const aggregate=parts=>parts.reduce((s,p)=>(s[p.formula]=(s[p.formula]||0)+p.coefficient,s),{});
    const inputs=aggregate(sides.reactants),outputs=aggregate(sides.products);
    const signature=x=>JSON.stringify(Object.entries(x).sort(([a],[b])=>a.localeCompare(b)));
    if(signature(inputs)===signature(outputs))throw Error('此反應僅改變結構、分子式不變；請至 Rhea 檢視完整結構。');
    const fmt=([formula,coefficient])=>(coefficient===1?'':coefficient+' ')+formula;
    const largest=parts=>[...parts].sort((a,b)=>Object.values(b.counts).reduce((x,y)=>x+y,0)-Object.values(a.counts).reduce((x,y)=>x+y,0))[0];
    const participants=Object.fromEntries(Object.entries(sides).map(([side,parts])=>[side,parts.map(({counts,...p})=>p)]));
    return {id:'rhea-'+id,rheaId:id,name:'RHEA:'+id+' · '+largest(sides.reactants).name,short:'Rhea 生化反應',category:'biochemistry',provenance:'rhea',equation:Object.entries(inputs).map(fmt).join(' + ')+' → '+Object.entries(outputs).map(fmt).join(' + '),inputs,outputs,product:largest(sides.products).formula,productState:'unknown',label:'生化反應・危害未評估',effect:'bond',hazard:'unknown',condition:'需查核原始文獻所述條件；此處只顯示已記錄的計量關係。',note:'Rhea 專家策展的生化反應。化學式不能唯一辨識結構；須對照參與物名稱。此資料不表示任意混合會發生反應，也未提供安全性判定。',conclusion:'依來源的原始係數，元素數量與總電荷已通過程式檢查。',sourceUrl:'https://www.rhea-db.org/rhea/'+id,source:'Rhea / SIB Swiss Institute of Bioinformatics',license:'CC BY 4.0',namedEquation:rows[0].equation,participants,participantNames:Object.fromEntries(Object.entries(participants).map(([side,parts])=>[side,parts.map(({name,formula,coefficient})=>({name,formula,coefficient}))])),prebalanced:true,autoMatch:false,sourceVerified:true};
  }
  async function getReaction(id,options={}){
    const rheaId=Number(String(id).replace(/^rhea[-:]/i,''));
    if(!Number.isSafeInteger(rheaId)||rheaId<=0)throw Error('Rhea ID 格式錯誤');
    const result=await query(`SELECT DISTINCT ${fields} WHERE {VALUES ?rhea {rh:${rheaId}} ${SCOPE} ${participantPattern}} ORDER BY ?side ?part`,options);
    return {...convertRows(result.rows,options.engine||root.ChemEngine),sourceRelease:result.release};
  }
  async function getStats(options={}){const result=await query(`SELECT (COUNT(DISTINCT ?rhea) AS ?count) WHERE {${SCOPE}}`,options);return{release:result.release,balancedNonTransportReactions:Number(result.rows[0]?.count||0)}}
  const api={search,getReaction,getStats,convertRows,endpoint:ENDPOINT};root.RheaClient=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
