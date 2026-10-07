'use strict';
// Everyday search context is deliberately separate from chemical identity aliases.
(function (root) {
  const pubchem = cid => 'https://pubchem.ncbi.nlm.nih.gov/compound/' + cid;
  const entries = [
    {key:'salt',label:'食鹽與氯化鈉',terms:['食鹽','鹽巴','食用鹽','餐桌鹽'],ids:['core-1'],note:'食鹽的主要成分是氯化鈉 NaCl；市售食鹽也可能含碘化物或其他添加成分。這裡顯示的是氯化鈉。',sources:[pubchem(5234)]},
    {key:'baking-soda',label:'小蘇打',terms:['小蘇打','食用小蘇打','小蘇打粉','碳酸氫鈉'],ids:['sodium-bicarbonate'],note:'小蘇打是碳酸氫鈉 NaHCO₃。泡打粉則通常還含酸性成分與其他配料，不能把兩者當成同一種物質。',sources:[pubchem(516892)]},
    {key:'vinegar',label:'醋中的相關成分',terms:['醋','白醋','食醋','米醋','烏醋','白醋成分'],ids:['acetic-acid','core-0'],note:'醋是含乙酸（醋酸）的水溶液，也可能含其他成分；並非純乙酸。以下列出乙酸與水，未代表完整配方或濃度。',sources:[pubchem(176)]},
    {key:'alcohol',label:'日常所說的酒精',terms:['酒精','酒精成分','乙醇酒精'],ids:['ethanol','core-0'],note:'日常所說的酒精多指乙醇；市售酒精常是含水的溶液。以下顯示乙醇與水；消毒產品也可能採用異丙醇，須依成分標示辨認。',sources:[pubchem(702),'https://www.cdc.gov/infection-control/hcp/disinfection-sterilization/chemical-disinfectants.html']},
    {key:'disinfectant-alcohol',label:'消毒酒精的可能成分',terms:['消毒酒精','75%酒精','75％酒精','75度酒精','七十五度酒精','醫用酒精'],ids:['ethanol','2-propanol','core-0'],note:'消毒酒精可能使用乙醇或異丙醇，通常也含水。這裡列出可能的相關成分；產品實際採用哪一種、含量多少，應以標示為準。',sources:['https://www.cdc.gov/infection-control/hcp/disinfection-sterilization/chemical-disinfectants.html']},
    {key:'sugar',label:'砂糖與蔗糖',terms:['砂糖','白砂糖','白糖','冰糖','蔗糖'],ids:['sucrose'],note:'砂糖和冰糖的主要成分是蔗糖 C₁₂H₂₂O₁₁。「糖」是一大類物質，葡萄糖、乳糖、麥芽糖並不等同於蔗糖。',sources:[pubchem(5988)]},
    {key:'dry-ice',label:'乾冰是固態二氧化碳',terms:['乾冰','干冰'],ids:['core-2'],note:'乾冰是固態二氧化碳。下方二氧化碳資料以約 25 °C、1 atm 為參考，因此標示為氣體；乾冰與常溫氣體的物態條件不同。',sources:[pubchem(280)]},
    {key:'limestone',label:'石灰石中的碳酸鈣',terms:['石灰石','石灰岩','大理石'],ids:['core-13'],note:'石灰石及許多大理石的主要成分是碳酸鈣 CaCO₃，天然岩石也可含其他礦物。以下顯示相關成分碳酸鈣。',sources:[pubchem(10112)]},
    {key:'eggshell',label:'蛋殼中的碳酸鈣',terms:['蛋殼','雞蛋殼','貝殼','蚵殼'],ids:['core-13'],note:'蛋殼與許多貝殼含有大量碳酸鈣，也有有機物與其他成分；整個蛋殼或貝殼並不是純碳酸鈣。',sources:[pubchem(10112),'https://pubmed.ncbi.nlm.nih.gov/8894229/']},
    {key:'peroxide',label:'雙氧水中的相關成分',terms:['雙氧水','双氧水','過氧化氫水溶液'],ids:['hydrogen-peroxide','core-0'],note:'雙氧水通常指過氧化氫的水溶液。以下列出過氧化氫與水；純物質的物性不等於不同濃度溶液的物性。',sources:[pubchem(784)]},
    {key:'lye',label:'燒鹼',terms:['燒鹼','苛性鈉','火鹼','烧碱'],ids:['sodium-hydroxide'],note:'燒鹼與苛性鈉是氫氧化鈉 NaOH 的俗名；固體氫氧化鈉與它的水溶液有不同物態。',sources:[pubchem(14798)]},
    {key:'slaked-lime',label:'熟石灰',terms:['熟石灰','消石灰'],ids:['core-14'],note:'熟石灰、消石灰指氫氧化鈣 Ca(OH)₂；生石灰則是氧化鈣 CaO，是不同物質。',sources:['https://pubchem.ncbi.nlm.nih.gov/compound/Calcium-hydroxide']},
    {key:'quicklime',label:'生石灰',terms:['生石灰'],ids:['calcium-oxide'],note:'生石灰是氧化鈣 CaO；與熟石灰 Ca(OH)₂、石灰石中的 CaCO₃ 有不同組成。',sources:[pubchem(14778)]},
    {key:'rust',label:'鐵鏽與鐵氧化物',terms:['鐵鏽','鐵銹','生鏽','铁锈'],ids:['core-12'],note:'真實鐵鏽往往含多種含水氧化物與羥氧化物。氧化鐵(III) Fe₂O₃ 是相關物質，不能用它完全代表所有鐵鏽。',sources:['https://openstax.org/books/chemistry-atoms-first/pages/16-6-corrosion']},
    {key:'ammonia-water',label:'氨水中的相關成分',terms:['氨水','阿摩尼亞水'],ids:['core-8','core-0'],note:'氨水是氨溶於水的溶液，涉及溶液中的酸鹼平衡。下方氨的資料以純物質常溫常壓為準，因此標示為氣體。',sources:[pubchem(222)]},
    {key:'quartz',label:'石英與二氧化矽',terms:['石英','石英砂'],ids:['core-11'],note:'石英是二氧化矽 SiO₂ 的一種晶型。天然砂的成分不一定只有石英；這裡顯示二氧化矽的組成資料。',sources:[pubchem(24261)]},
    {key:'citric-acid',label:'檸檬酸',terms:['檸檬酸','柠檬酸','食品檸檬酸'],ids:['citric-acid'],note:'檸檬酸是有機酸，常用於食品與清潔產品。檸檬汁還含水、糖與其他成分，不能等同純檸檬酸。',sources:[pubchem(311)]},
    {key:'glycerol',label:'甘油',terms:['甘油','丙三醇'],ids:['glycerol'],note:'甘油是丙三醇 C₃H₈O₃ 的常用名稱，常作為保濕成分；含甘油的產品仍可能是多種成分的混合物。',sources:[pubchem(753)]},
    {key:'vitamin-c',label:'維生素 C',terms:['維生素C','維他命C','維他命 C','維生素 C','Vitamin C'],ids:['ascorbic-acid'],note:'這裡顯示抗壞血酸（維生素 C）。維生素產品也可能使用其鹽類或含其他配料，應區分產品與單一化合物。',sources:[pubchem(54670067)]},
    {key:'caffeine',label:'咖啡因',terms:['咖啡因','咖啡中的咖啡因','茶中的咖啡因'],ids:['caffeine'],note:'咖啡因是一種存在於咖啡、茶等飲品中的化合物；飲品還含水與許多其他成分。',sources:[pubchem(2519)]},
    {key:'epsom-salt',label:'瀉鹽',terms:['瀉鹽','浴鹽硫酸鎂','Epsom salt'],ids:['magnesium-sulfate-heptahydrate'],note:'瀉鹽通常指七水合硫酸鎂 MgSO₄·7H₂O，結晶水是化學式的一部分；一般浴鹽配方不一定只含這一種鹽。',sources:[pubchem(24843)]},
    {key:'washing-soda',label:'純鹼與碳酸鈉',terms:['純鹼','蘇打灰','碳酸鈉'],ids:['sodium-carbonate'],note:'純鹼、蘇打灰指碳酸鈉 Na₂CO₃；小蘇打是碳酸氫鈉 NaHCO₃。這筆碳酸鈉資料是無水物。',sources:[pubchem(10340)]}
  ];
  const normalize = value => String(value || '').normalize('NFKC').replace(/\s+/g, '').toLowerCase();
  const byTerm = new Map();
  for (const entry of entries) {
    Object.freeze(entry.terms); Object.freeze(entry.ids); Object.freeze(entry.sources); Object.freeze(entry);
    for (const term of entry.terms) byTerm.set(normalize(term), entry);
  }
  function apply(compounds) {
    const byId = new Map(compounds.map(compound => [compound.id, compound]));
    for (const entry of entries) for (const id of entry.ids) {
      const compound = byId.get(id);
      if (compound) compound.searchTerms = [...new Set([...(compound.searchTerms || []), ...entry.terms])];
    }
    return compounds;
  }
  function lookup(query) { return byTerm.get(normalize(query)) || null; }
  const api = Object.freeze({apply, lookup, entries:Object.freeze(entries), chips:Object.freeze(['食鹽','小蘇打','白醋','酒精','砂糖','乾冰','蛋殼','雙氧水'])});
  root.EverydayChem = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(globalThis);
