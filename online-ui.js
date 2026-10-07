'use strict';
// Public search only runs when requested by the visitor. No keys, cookies or tracking.
function validatedSourceReaction(record){
 const convert=side=>Object.entries(side).map(([formula,coefficient])=>{if(!Number.isSafeInteger(coefficient)||coefficient<=0)throw Error('來源係數無效');const parsed=ChemEngine.parseFormula(formula);return {formula,coefficient,counts:parsed.counts,charge:parsed.charge}});
 const reactants=convert(record.inputs),products=convert(record.outputs),atoms={};let charge=0n;
 for(const[side,sign]of[[reactants,1n],[products,-1n]])for(const p of side){for(const[s,n]of Object.entries(p.counts))atoms[s]=(atoms[s]||0n)+sign*BigInt(n)*BigInt(p.coefficient);charge+=sign*BigInt(p.charge)*BigInt(p.coefficient)}
 if(!reactants.length||!products.length||charge!==0n||Object.values(atoms).some(n=>n!==0n))throw Error('來源反應未通過原子與電荷守恆檢查');return {reactants,products,equation:record.equation};
}
function loadPrebalanced(reaction){
 const balanced=validatedSourceReaction(reaction),product=balanced.products.find(p=>p.formula===reaction.product)||balanced.products[0];
 lab.balanced=balanced;lab.reaction=reaction;lab.reactionChoices=[];lab.mixture=null;lab.dirty=false;lab.formula=product.formula;lab.counts={...product.counts};lab.charge=product.charge;resolveComposition(product.formula);clearError();updateScene();
}
const provenanceLabel=document.createElement('label');provenanceLabel.className='catalog-select';provenanceLabel.innerHTML='來源<select id="library-provenance" aria-label="資料來源"><option value="all">全部來源</option></select>';document.querySelector('.catalog-toolbar').appendChild(provenanceLabel);
$('library-provenance').addEventListener('change',()=>{libraryState.provenance=$('library-provenance').value;libraryState.page=1;renderCards()});
const onlinePanel=document.createElement('div');onlinePanel.id='online-panel';onlinePanel.hidden=true;onlinePanel.innerHTML=`
 <div class="online-intro"><h3>讓探索延伸到公開資料庫</h3><p>PubChem 查物質名稱、分子式與式量；Rhea 查專家策展的生化反應。不同資料庫有不同範圍，沒有涵蓋全世界全部物質與反應。</p></div>
 <form id="online-form" class="online-form"><label>資料庫<select id="online-source"><option value="pubchem">PubChem · 物質</option><option value="rhea">Rhea · 生化反應</option></select></label><label class="online-query-label">英文名稱、化學式或資料庫 ID<input id="online-query" type="search" maxlength="160" placeholder="例如 caffeine、C2H6O、glucose" required autocomplete="off"></label><button class="accent-button" id="online-submit">搜尋資料庫</button><button type="button" class="quiet" id="online-cancel" hidden>取消</button></form>
 <p class="online-disclosure">搜尋內容將送至所選公開資料庫。每頁最多 20 筆；點選後才載入實驗台。線上查詢需要網路，離線庫仍可使用。</p><p id="online-status" role="status" aria-live="polite">輸入英文名稱、化學式或 ID，開始查詢。</p>
 <div id="online-results" class="online-results"></div><div id="online-pagination" class="catalog-pagination" hidden><button type="button" id="online-prev" class="quiet">上一頁</button><span id="online-page"></span><button type="button" id="online-next" class="quiet">下一頁</button></div>
 <p class="online-attribution">資料來源：<a href="https://pubchem.ncbi.nlm.nih.gov/" target="_blank" rel="noopener noreferrer">PubChem／NCBI</a> · <a href="https://www.rhea-db.org/" target="_blank" rel="noopener noreferrer">Rhea／SIB</a>（<a href="https://www.rhea-db.org/help/license-disclaimer" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>）。Rhea 搜尋限已核准、已配平的非運輸生化反應；泛化物質與只有結構改變的結果可能無法載入本模型。</p>`;
document.querySelector('.library-heading').insertAdjacentElement('afterend',onlinePanel);
const online={controller:null,loadController:null,results:[],source:'pubchem',query:'',offset:0,more:false};
function setOnlineBusy(busy){$('online-submit').disabled=busy;$('online-cancel').hidden=!busy;$('online-results').setAttribute('aria-busy',busy);$('online-next').disabled=busy||!online.more;$('online-prev').disabled=busy||online.offset===0}
function renderOnline(){
 $('online-results').innerHTML=online.results.map((record,index)=>`<article class="online-card"><div><span class="online-source-tag">${online.source==='pubchem'?'PUBCHEM · CID '+record.pubchemCid:'RHEA · '+record.rheaId}</span><h3>${escapeHTML(record.name)}</h3><p class="online-formula">${escapeHTML(online.source==='pubchem'?sub(record.formula):record.namedEquation)}</p>${record.supported===false?'<p class="online-warning">'+escapeHTML(record.unsupportedReason)+'</p>':online.source==='pubchem'?'<p class="muted">式量／相對分子質量 '+escapeHTML(record.mass)+' · 物態與危害未收錄</p>':''}</div><div class="online-card-actions"><button class="accent-button" data-online-index="${index}" ${record.supported===false?'disabled':''}>載入實驗台</button>${sourceLink(record.sourceUrl)}</div></article>`).join('');
 $('online-pagination').hidden=online.source!=='rhea'||!online.results.length;$('online-page').textContent='第 '+(online.offset/20+1)+' 頁';
}
async function runOnlineSearch(offset=0){
 online.loadController?.abort();
 online.controller?.abort();const controller=new AbortController();online.controller=controller;online.offset=offset;online.source=$('online-source').value;online.query=$('online-query').value.trim();online.more=false;online.results=[];renderOnline();setOnlineBusy(true);$('online-status').textContent='正在查詢 '+(online.source==='pubchem'?'PubChem':'Rhea')+'…';
 try{
  if(online.source==='pubchem'){
   let query=online.query;const local=ChemData.compounds.filter(c=>c.name===query||(c.aliases||[]).includes(query));if(/[\u3400-\u9fff]/.test(query)&&local.length===1)query=local[0].pubchemCid?String(local[0].pubchemCid):local[0].english;
   const results=await searchPubChem(query,controller.signal);if(online.controller!==controller||controller.signal.aborted)return;online.results=results;
  }else{let mode='text';try{ChemEngine.parseFormula(online.query);mode='formula'}catch{}const response=await RheaClient.search(online.query,{mode,limit:20,offset,signal:controller.signal});if(online.controller!==controller||controller.signal.aborted)return;online.results=response.results;online.more=response.mayHaveMore;}
  if(controller.signal.aborted)return;renderOnline();$('online-status').textContent=online.results.length?'本頁找到 '+online.results.length+' 筆。'+(online.source==='pubchem'?'同分子式可能對應不同物質，請選擇具體結果；更多結果可到 PubChem 查閱。':'資料庫記錄不表示混合後一定反應，請查看原始條件。'):'找不到符合的資料。可改用英文正式名稱、化學式或資料庫 ID。';
 }catch(error){if(online.controller!==controller)return;if(controller.signal.aborted){$('online-status').textContent='已取消搜尋。'}else $('online-status').textContent=error.name==='AbortError'?'連線逾時，請稍後重試。':error.message||'線上查詢失敗；你仍可使用離線資料庫。';}
 finally{if(online.controller===controller){online.controller=null;setOnlineBusy(false)}}
}
$('online-form').addEventListener('submit',event=>{event.preventDefault();runOnlineSearch(0)});$('online-cancel').addEventListener('click',()=>online.controller?.abort());$('online-prev').addEventListener('click',()=>runOnlineSearch(Math.max(0,online.offset-20)));$('online-next').addEventListener('click',()=>runOnlineSearch(online.offset+20));
$('online-source').addEventListener('change',()=>{online.controller?.abort();online.loadController?.abort();online.controller=null;online.results=[];online.source=$('online-source').value;online.offset=0;online.more=false;renderOnline();setOnlineBusy(false);$('online-status').textContent=online.source==='rhea'?'可用 glucose、ATP、C6H12O6 或 RHEA:10000 查詢。':'可用 caffeine、C2H6O 或 CID 962 查詢。'});
$('online-results').addEventListener('click',async event=>{
 const button=event.target.closest('[data-online-index]');if(!button)return;const selected=online.results[Number(button.dataset.onlineIndex)];if(!selected)return;button.disabled=true;
 online.loadController?.abort();const controller=new AbortController();online.loadController=controller;const revision=lab.revision;
 try{if(online.source==='pubchem'){
   if(!selected.supported)throw Error(selected.unsupportedReason);let compound=ChemData.compounds.find(c=>c.id===selected.id||c.pubchemCid===selected.pubchemCid);if(!compound){compound=selected;ChemData.compounds.push(compound);catalog=ChemCatalog.create(ChemData,ChemEngine)}setCompound(compound);
  }else{$('online-status').textContent='正在取得並檢查反應的原子與電荷守恆…';let reaction=ChemData.reactions.find(r=>r.id===selected.id);if(!reaction){reaction=await RheaClient.getReaction(selected.rheaId,{engine:ChemEngine,signal:controller.signal});if(controller.signal.aborted||online.loadController!==controller)return;if(lab.revision!==revision){$('online-status').textContent='實驗台已變更，保留你目前選擇的內容。';return}validatedSourceReaction(reaction);ChemData.reactions.push(reaction);catalog=ChemCatalog.create(ChemData,ChemEngine)}loadReaction(reaction.id);}
  $('online-status').textContent='已載入實驗台。新增線上資料僅保留在本次開啟的頁面。';
 }catch(error){if(!controller.signal.aborted&&online.loadController===controller)$('online-status').textContent=error.message||'無法載入這筆資料，請查看原始來源。'}finally{if(online.loadController===controller)online.loadController=null;button.disabled=false}
});
configureLibrary();
