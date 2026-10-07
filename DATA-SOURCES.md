# ATOM LAB 資料來源與轉換說明

離線資料取得與整理日期：**2026-10-07**。這是本網站使用的選取資料集，並非來源資料庫的完整鏡像。線上搜尋結果以查詢當時的來源回覆為準。

| 資料 | 筆數 | 來源與識別 |
|---|---:|---|
| 元素 | 118 | PubChem 元素資料；繁體中文名稱參考台灣化學學會 |
| 教學物質 | 148 | 人工整理；擴充項目附 PubChem CID／來源連結 |
| 公開物質擴充 | 1,500 | PubChem／NCBI PUG REST，逐筆保留 CID 與來源網址 |
| 教學反應 | 50 | 人工整理的守恆與現象範例，來源列於記錄或網站來源清單 |
| 生化反應擴充 | 2,028 | Rhea／SIB，逐筆保留 Rhea ID、來源網址與物質名稱 |

合計 **1,648 筆物質、2,078 筆反應**。物質筆數指資料庫記錄，不是不同分子式的數量；相同分子式可以對應多種物質。

## PubChem／NCBI

來源為 [PubChem](https://pubchem.ncbi.nlm.nih.gov/) 與 [PUG REST](https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest)。離線擴充以 18 批請求查取 CID 1–1800 範圍，選取 1,500 筆可解析、未與教學資料重複的記錄；這些記錄共有 1,218 種不同分子式。

匯入欄位為 `Title`、`MolecularFormula`、`MolecularWeight`；另以 `Charge`、`IsotopeAtomCount` 篩選。離線擴充只納入中性、未標記同位素、至少含兩種元素且名稱及式量有效的記錄。轉換為本網站資料格式後，以解析器取得元素組成，保留來源名稱、CID、分子式、式量與連結。物態、危害、鍵結及完整三維結構沒有由此介面匯入，均不推測補值。

線上模式另使用 `MolecularFormulaNoCharge` 與 `Charge` 組合明確離子式；來源缺少可靠欄位或模型不支援時，停用載入並說明原因。查詢依 CID、完整名稱或元素組成進行；分子式相符不保證結構相同。

PubChem 匯整多個資料提供者的內容，來源條件可在 [PubChem Data Sources](https://pubchem.ncbi.nlm.nih.gov/sources/) 查閱。本專案不將全部 PubChem 內容另行宣告為 CC BY 4.0，也未擷取其中的長篇說明或第三方影像。

## Rhea／SIB 與 ChEBI／EMBL-EBI

生化反應取自 [Rhea](https://www.rhea-db.org/)，由 SIB Swiss Institute of Bioinformatics 的 Swiss-Prot Group 策展與開發。Rhea 使用 [ChEBI（EMBL-EBI）](https://www.ebi.ac.uk/chebi/about) 描述反應參與物；本網站保留來源中的物質名稱及命名反應式，避免把分子式當成唯一結構識別。參見 [Rhea 致謝與資源說明](https://www.rhea-db.org/help/acknowledgment)。

取得介面為 [Rhea SPARQL](https://sparql.rhea-db.org/sparql)。離線取樣按 Rhea ID 排序，選取前 3,000 筆符合以下條件的主反應：

- 狀態為已核准（`rh:Approved`）。
- 已標示化學守恆（`rh:isChemicallyBalanced true`）。
- 非運輸反應（`rh:isTransport false`）。

其中 2,150 筆通過本網站的參與物解析、正整數係數、元素與電荷守恆檢查；再排除 122 筆左右兩側彙總分子式相同的記錄，留下 **2,028 筆**。無法表示泛化參與物、變數聚合物或不完整係數等情況，不納入離線模型。這項篩選是模型適用範圍，並不判定被排除的來源反應無效。

轉換保留來源係數、左右側與物質名稱，把來源的獨立電荷欄位轉為 `^+`、`^2-` 等語法，並按分子式彙總相同側的係數。匯入時逐項加總「元素數 × 係數」及「電荷 × 係數」，驗證兩側一致。畫面箭頭用於呈現來源左右側，不代表已確認單向反應或實際淨流向。

線上查詢沿用上述核准、守恆與非運輸條件；載入新記錄前再次檢查。僅分子式不變的異構化等反應，請至來源查看完整結構。所有 Rhea 擴充項目的產品物態與危害保持未知，反應條件須回到原始記錄與文獻查核。

### 授權與署名

Rhea 資料依 [Creative Commons Attribution 4.0 International（CC BY 4.0）](https://creativecommons.org/licenses/by/4.0/) 提供，見 [Rhea License & Disclaimer](https://www.rhea-db.org/help/license-disclaimer)。ChEBI 的資料亦採 CC BY 4.0，並受其 [官方來源與授權說明](https://www.ebi.ac.uk/chebi/about) 所列條件規範。

**署名：Rhea／SIB Swiss Institute of Bioinformatics；反應參與物資料基礎為 ChEBI／EMBL-EBI。** 本專案於 2026-10-07 取得選取記錄，完成上述格式轉換、篩選、電荷表示及元素與電荷守恆檢查。請保留這段來源、授權連結及變更說明；上述機構未為本網站背書。此資料授權說明不等同本專案程式碼授權。

## 元素與教學資料

- [PubChem 元素 JSON](https://pubchem.ncbi.nlm.nih.gov/rest/pug/periodictable/JSON)：原子序、符號、英文名稱、原子質量與分類。
- [台灣化學學會週期表](https://chemistry.org.tw/periodic-table.php)：繁體中文元素名稱。
- [PubChem 水](https://pubchem.ncbi.nlm.nih.gov/compound/Water)：基本物性與結構範例；其他擴充物質另有逐筆來源。
- [OpenStax 化學反應分類](https://openstax.org/books/chemistry-2e/pages/4-2-classifying-chemical-reactions) 與 [腐蝕](https://openstax.org/books/chemistry-atoms-first/pages/16-6-corrosion)：教學概念參考。依一般規則推導的範例於資料中明示。
- [NOAA CAMEO 氫氣](https://cameochemicals.noaa.gov/chemical/8729)、[甲烷](https://cameochemicals.noaa.gov/chemical/8823)、[ILO／WHO 鈉安全卡](https://inchem.org/documents/icsc/icsc/eics0717.htm) 與 [英國皇家化學學會鎂](https://periodic-table.rsc.org/element/12/magnesium)：部分物性及危害概念參考。

中文教學敘述是本網站整理的摘要，不是完整安全資料表。原子質量保留來源精度；參考物態需注意溫度、壓力、純度與物質形態。配平及守恆檢查不能證明反應可行性、危害程度或動畫的微觀準確性。
