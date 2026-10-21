from pathlib import Path
from html import escape
import re
from html import unescape

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / 'AIRIOT大灣區高校產業聯盟_構想初稿_A4.html'
MARKDOWN = ROOT / 'AIRIOT大湾区高校产业联盟_构想初稿.md'
VERSION = 'V0.8'
DOCUMENT_DATE = '2026 年 10 月 2 日'

chapters = [
('一、建設背景與合作基礎', '''
<h3>（一）建設背景</h3>
<p>物聯網應用涉及需求調研、設備與數據接入、業務分析、應用開發、測試及運行維護。學生需要綜合運用專業知識，理解現場條件，在時間與資源約束下形成可實施的方案。培養工作應將基礎知識、平台訓練、數據分析與完整項目實踐結合，促進學生由掌握操作技能進一步發展問題分析、方案判斷及驗證能力。</p>
<p>高校的教學與研究資源、企業的實際需求與工程經驗，以及平台方的技術與產品資源，可通過持續協作轉化為課程、課題與指導機制。聯盟建設的重點，是讓學生在真實需求中運用知識，讓教學成果接受實踐檢驗，並將有效經驗積累為可供成員高校共同使用的培養資源。</p>
<h3>（二）合作基礎與平台方身份</h3>
<p>依據發起人提供的校企合作基礎，本方案建議由合作高校數據科學學院、平台技術合作單位及粵炬（澳門）科技有限公司共同推進聯盟籌建。學院擬牽頭教學與學術工作，航天科技擬提供 AIRIOT 平台及相應技術支持，粵炬擬連接企業需求並組織項目實踐，促進既有合作向人才培養與區域高校共建延伸。</p>
<p>本方案航天參與方名稱列示為「平台技術合作單位」（正文簡稱「航天科技」）。其所屬企業的法定披露文件列明 AIRIOT 物聯網平台；AIRIOT 官網亦明確其品牌歸屬。智慧物联事业部及 AIRIOT 團隊的參與安排、具體簽署主體、授權與服務內容，應在合作文件中載明。</p>
<h3>（三）歷史教學合作經驗的參考價值</h3>
<p>發起人提供的 2022 年《AIRIOT 大學計劃》材料介紹了課程共建、師資培訓、實踐基地、畢業設計、橫向項目和成果轉化等合作形式。這些內容可為聯盟建立課程與實踐銜接機制提供參考。正式實施時，應結合當前平台版本、參與教師、學生基礎及可取得的場景資源重新確定具體安排。</p>
<h3>（四）區域協作的建設思路</h3>
<p>聯盟初期擬以學院為高校牽頭方，完成三方合作試點後，逐步向內地及澳門其他高校開放申請。成員高校依學科特色、師資與區域場景參與共同課程、跨校項目及學術交流，並通過優秀學生推薦機制銜接學院研究生培養，形成實踐教學與後續發展相互支持的合作關係。</p>
<div class="notice">企業全稱及 AIRIOT 歸屬依官方資料核驗；既有合作基礎及推優初步共識依發起人說明記述。聯盟正式發起與各方授權由合作文件確認。</div>
'''),
('二、聯盟定位、建設目標與基本原則', '''
<h3>（一）聯盟定位</h3>
<p>聯盟定位為以 AIRIOT 智慧物聯中台為實踐支撐、高校人才培養為核心、真實產業需求為牽引的產教融合合作平台。本方案建議將課程培訓、數據科學應用、項目實踐、師資協同及研究生培養銜接納入共同建設範圍。</p>
<p>通過高校、企業與航天科技共同參與，建立從課程學習、需求分析、方案設計到應用實現、驗證改進及研究深化的培養過程，促進學生實踐技能、思考能力與應用能力共同發展。</p>
<h3>（二）建設目標</h3>
<table><thead><tr><th style="width:23%">目標方向</th><th>建設內容與預期形成的能力</th></tr></thead><tbody>
<tr><td>完善實踐課程</td><td>建立基礎訓練、綜合實踐及進階拓展相銜接的課程安排，明確學習目標、先修要求、階段任務與成果標準。</td></tr>
<tr><td>強化問題分析</td><td>使學生能夠理解使用者、業務流程和現場條件，將實際需求轉化為明確的問題、任務及評價依據。</td></tr>
<tr><td>培養工程能力</td><td>使學生能夠完成數據接入、應用配置、業務流程設計、必要的開發集成與測試驗證，並說明技術選擇的理由。</td></tr>
<tr><td>深化數據應用</td><td>結合數據科學學院特色，支持學生開展數據質量檢查、分析與算法驗證，將分析成果接入具體應用。</td></tr>
<tr><td>建立協同師資</td><td>形成高校導師與企業導師共同設計課題、指導實踐及評價學習的工作方式，積累指導經驗與教學案例。</td></tr>
<tr><td>推動高校共建</td><td>建立其他高校申請、合作確認及持續參與機制，逐步擴大課程、教師、學生團隊和區域場景資源。</td></tr>
<tr><td>銜接研究生培養</td><td>建立優秀學生推薦機制，支持聯盟成員高校學生憑學業及實踐表現，申請合作高校數據科學學院碩士及博士學位課程。</td></tr>
</tbody></table>
<h3>（三）基本原則</h3>
<ol><li><strong>育人導向。</strong> 課程、項目和成果評價圍繞學生能力形成設計，兼顧團隊成果與個人學習，保留需求分析和設計思考的過程依據。</li>
<li><strong>需求牽引。</strong> 優先選取使用者明確、問題清楚、條件具備的課題，將實際需求轉化為學生能夠參與和完成的任務。</li>
<li><strong>協同共建。</strong> 各方按自身優勢參與教學、技術與項目組織，明確責任分工、資源投入和溝通方式，共同形成可持續的工作機制。</li>
<li><strong>分步實施。</strong> 首期採取範圍可控的試點，通過成果評審與實際回饋完善課程和組織方式，再逐步擴大合作規模。</li></ol>
'''),
('三、協同育人模式與合作價值', '''
<h3>（一）協同育人模式</h3>
<p>本方案建議建立由學院牽頭教學、高校與企業導師共同指導、航天科技提供平台技術支持、粵炬協調需求與實施的協同育人模式。將產業需求轉化為具有明確學習目標的課題，按學生基礎分層安排訓練與實踐，通過成果評審和使用方回饋檢查學習成效。</p>
<p>聯盟培養過程由平台基礎訓練起步，經綜合項目形成可核查的能力表現，再引導學生提煉有研究價值的問題。優秀學生可依推薦機制申請學院碩士及博士學位課程，將工程實踐與進一步學術培養相銜接。</p>
<h3>（二）各方合作價值</h3>
<table><thead><tr><th style="width:24%">參與方</th><th>合作價值與預期積累</th></tr></thead><tbody>
<tr><td>合作高校<br>數據科學學院</td><td>拓展實踐課題與应用研究來源，將數據科學教學與物聯網場景結合，积累教學案例，發掘具有實踐基礎與研究潛力的研究生申請者。</td></tr>
<tr><td>航天科技<br>AIRIOT 團隊</td><td>將平台能力與工程經驗轉化為課程、案例及師資資源，獲取高校教學及項目應用回饋，促進平台技術與人才培養協同發展。</td></tr>
<tr><td>粵炬（澳門）<br>科技有限公司</td><td>建立持續的高校與企業需求對接機制，通過共同指導、方案驗證及成果應用积累工程經驗，拓展具體項目合作與人才交流。</td></tr>
<tr><td>聯盟成員高校</td><td>共享經確認的課程與案例，參與跨校項目及師資交流，豐富實踐教學資源，為學生拓展項目實踐及研究生深造渠道。</td></tr>
<tr><td>參與學生</td><td>在導師指導下理解真實需求、承擔具體任務並驗證成果，形成個人實踐記錄與作品集，增進專業判斷、團隊協作及後續研究能力。</td></tr>
</tbody></table>
<h3>（三）課程、項目與研究的銜接</h3>
<p>課程任務、項目實踐及研究發展應採用相互銜接的成果要求。基礎訓練形成平台操作與數據管理能力；綜合實踐形成需求、方案、實現和驗證材料；進階課題形成方法比較、研究設想或專題報告。導師根據能力表現安排後續任務，使學生的成長過程與成果依據保持一致。</p>
<p>聯盟按每輪實踐整理需求來源、導師投入、學習成果與後續使用情況，將可共享的課程、案例及指導經驗納入共同資源，為成員高校持續參與及優秀學生後續培養提供支撐。</p>
'''),
('三、擬發起方職責與協同建設任務', '''
<h3>（一）合作高校數據科學學院</h3>
<p>學院擬承擔高校牽頭和教學組織工作，協調參與教師及學生團隊，結合專業培養要求共同制定課程與實踐安排。具體包括學生對象與先修要求確定、課程任務設計、教師指導安排、階段評審、學習評價及教學資料整理。</p>
<p>學院可結合數據科學相關方法，參與數據分析、算法驗證和應用評價類課題設計，指導學生分析數據來源、質量和適用範圍，解釋分析結果及其業務含義；並協調優秀學生推薦與研究生升學銜接，對接相關校方程序。涉及課程認定、學分、實踐證明或校級參與的事項，由校方依其內部程序確認。</p>
<h3>（二）平台技術合作單位</h3>
<p>航天科技擬由 AIRIOT 團隊提供平台與技術支持，參與師資培訓、課程共建、產品能力講解、技術指導及方案評審。合作清單應載明平台版本、教學使用範圍、部署方式、算法擴展條件及技術服務內容。</p>
<p>AIRIOT 團隊協助教學團隊運用官方文檔、接口及開發工具，對平台配置、數據接入與擴展集成提供指導意見，並共同整理可用於教學的案例與技術資料。支持人員、工作投入及費用安排按合作文件執行。</p>
<h3>（三）粵炬（澳門）科技有限公司</h3>
<p>粵炬擬承擔企業需求連接、項目實踐組織和日常實施協調工作，持續收集可供教學實踐的需求，協調需求方、企業導師、設備與現場資源，參與課題篩選、任務設計、方案評審、試用及成果回饋。</p>
<p>粵炬應在具體項目中明確企業項目負責人，協調工程交付、成果接收與後續維護安排，將學生任務與實際項目責任銜接。具備應用條件的成果，可由相關方共同研究後續實施或轉化方式，並另行確認投入、使用及相關權益。</p>
<h3>（四）三方共同建設任務</h3>
<table><thead><tr><th style="width:24%">共同任務</th><th>需共同形成的工作成果</th></tr></thead><tbody>
<tr><td>確定建設安排</td><td>聯盟名稱、合作主體、階段計劃、聯絡人及資源清單。</td></tr>
<tr><td>設計培養內容</td><td>課程模塊、先修要求、課題任務書、導師安排及考核方法。</td></tr>
<tr><td>組織實踐實施</td><td>項目評審記錄、階段成果、使用回饋及問題處理安排。</td></tr>
<tr><td>完善合作機制</td><td>成員加入程序、共享資源規則、成果使用及下一輪改進計劃。</td></tr>
</tbody></table>
<div class="notice">上述為首期建議分工。各方按已確認的合作範圍指定負責人，落實工作與資源；新增投入或工作範圍調整另行協商。</div>
'''),
('四、平台能力與實踐課程體系', '''
<h3>（一）平台能力與教學內容銜接</h3>
<p>課程設計應以學習任務為主線，按當前平台公開能力和具體使用條件組織。平台功能可為學生提供應用實現工具，教學工作同時應要求學生說明需求、數據與設計選擇，形成完整的分析和驗證記錄。</p>
<table><thead><tr><th style="width:22%">平台能力</th><th style="width:38%">公開介紹的功能方向</th><th>主要教學任務</th></tr></thead><tbody>
<tr><td>數據採集</td><td>設備接入、驅動、數據建模、告警、報表與權限。</td><td>分析數據來源，完成接入和建模，檢查數據可靠性及異常。</td></tr>
<tr><td>可視化組態</td><td>2D／3D 場景、工藝畫面、視頻與實時數據綁定。</td><td>按使用者需求設計界面，表達狀態與分析結果，驗證交互效果。</td></tr>
<tr><td>業務一體化</td><td>系統集成、業務聯動、審批工作流與主數據管理。</td><td>梳理業務流程，設計數據處理與協同操作，完成流程測試。</td></tr>
<tr><td>運維與擴展</td><td>API、部署、運行監控、日誌及二次開發。</td><td>开展接口集成、配置管理、部署驗證和運行問題分析。</td></tr>
</tbody></table>
<h3>（二）建議課程模塊</h3>
<table><thead><tr><th style="width:24%">模塊</th><th>主要內容及成果要求</th></tr></thead><tbody>
<tr><td>物聯網與場景認知</td><td>系統構成、設備與通信、現場調研方法；形成場景分析及需求說明。</td></tr>
<tr><td>數據接入與管理</td><td>接入配置、數據模型、質量檢查及告警；形成數據字典和接入測試記錄。</td></tr>
<tr><td>應用與流程配置</td><td>界面、報表、權限及業務流程；形成可演示的應用和操作說明。</td></tr>
<tr><td>數據分析與算法</td><td>清洗、分析、算法驗證及服務集成；形成方法說明和效果比較。</td></tr>
<tr><td>開發與系統集成</td><td>API、必要的編程擴展及外部系統銜接；形成接口說明和集成測試記錄。</td></tr>
<tr><td>工程驗證與復盤</td><td>測試、試用、回饋、移交與改進；形成驗證報告及個人學習復盤。</td></tr>
</tbody></table>
<h3>（三）數據科學進階方向</h3>
<p>官方文檔提供 Python 算法服務開發、打包及部署方法。進階課題要求學生說明分析方法、輸入輸出與適用條件，完成服務集成，再以數據及使用回饋驗證效果。具備研究價值的課題，可在導師指導下明確研究問題、比較方法與驗證依據，形成專題報告或研究設想。AI 大模型應用按具體模型、接入方式及已具備的教學條件另行安排。</p>
<div class="notice">課程學時、平台版本、賬號與項目範圍、設備條件及難度分層，由教學團隊與平台方在實施前共同確定。</div>
'''),
('五、培訓組織、師資協同與學生管理', '''
<h3>（一）培訓對象與分層安排</h3>
<p>首期學生對象由參與高校確定，可結合專業、年級、先修知識和參與意向進行遴選。教學團隊應在開課前了解學生的編程、數據分析和物聯網基礎，據此確定統一訓練內容及不同深度的實踐任務，並向學生說明學習要求、參與週期和成果提交方式。</p>
<p>培訓可按基礎訓練、綜合實踐及進階拓展三個層次組織。基礎訓練重點是理解系統與完成平台配置；綜合實踐要求圍繞明確需求形成可驗證的應用；進階拓展可加入算法服務、二次開發或跨系統集成。層次銜接以學生具備相應能力及課題條件為依據。</p>
<h3>（二）課程實施方式</h3>
<p>建議採用講解、示範、操作訓練、分組討論和項目指導相結合的方式。每個課程模塊應明確學習目標、操作任務與檢查要求，將相關文檔和範例提前提供給學生。課堂與課外任務應有相應指導和回饋，並保留必要的學習記錄。</p>
<p>平台基礎訓練完成後，教學團隊應檢查学生對數據模型、界面配置、流程和測試方法的掌握情況，再安排綜合課題。尚未達到要求的學生，可通過補充訓練或調整分工繼續學習，使項目任務與個人能力及學習目標相符。</p>
<h3>（三）雙導師協同機制</h3>
<table><thead><tr><th style="width:23%">參與方</th><th>指導重點</th><th style="width:29%">共同參與的工作</th></tr></thead><tbody>
<tr><td>高校導師</td><td>學習目標、分析方法、研究思路、個人貢獻與學習評價。</td><td rowspan="2">課題設計、方案討論、階段評審、問題協調及成果評價。</td></tr>
<tr><td>企業導師</td><td>需求解釋、現場條件、工程實現、使用回饋與項目銜接。</td></tr>
<tr><td>平台技術支持</td><td>按合作安排協助平台能力理解、配置、接口與擴展問題。</td><td>技術問題討論及相關方案評審。</td></tr>
</tbody></table>
<h3>（四）團隊組織與過程記錄</h3>
<p>每個學生團隊應明確負責人和分工，建立任務清單、進度記錄及問題記錄。導師應定期了解團隊進展，檢查需求理解、方案形成和測試依據，及時處理任務範圍、資源條件或協作方面的問題。個人貢獻應結合實際工作及成果記錄認定。</p>
<h3>（五）师資交流與教學改進</h3>
<p>三方可按培訓需要組織平台功能講解、課題設計研討和教學經驗交流。每輪課程結束後，教師與企業導師共同整理學生難點、指導方法和課程改進事項，為下一輪教學及其他高校參與提供依據。</p>
'''),
('六、真實項目徵集、篩選與立項', '''
<h3>（一）建立持續的需求來源</h3>
<p>粵炬擬牽頭協調企業需求來源，平台方及成員高校可共同提供可供實踐的應用場景。需求來源可包括企業運營、設備管理、校園應用及各方能够協調的其他場景。收集需求時，應記錄需求方、使用者、現有工作方式、主要問題和可提供的條件。</p>
<p>需求徵集应服務於學生培養和具體項目實施。對於問題尚不清楚或現場條件不足的需求，先安排調研和範圍討論；具備明確問題與實踐條件後，再納入候選課題。已納入的課題應指定需求聯絡人，便於學生理解業務及獲取回饋。</p>
<h3>（二）課題篩選條件</h3>
<table><thead><tr><th style="width:23%">檢查內容</th><th>立項前應明確的條件</th></tr></thead><tbody>
<tr><td>需求清晰度</td><td>使用者及問題明確，能夠說明預期改善和課題範圍。</td></tr>
<tr><td>教學適配性</td><td>任務適合學生基礎，能形成分析、設計、實現和驗證的學習過程。</td></tr>
<tr><td>資源可取得性</td><td>數據、設備、平台及現場條件可確認，相關使用安排可落实。</td></tr>
<tr><td>實施可控性</td><td>教學週期內可以形成階段成果，實施責任及主要依賴清楚。</td></tr>
<tr><td>效果可評價性</td><td>具有可用的測試方法、比較依據或使用方回饋渠道。</td></tr>
</tbody></table>
<h3>（三）課題任務書</h3>
<p>立項課題應形成任務書，載明需求背景、問題描述、使用對象、學習目標、學生任務、數據和設備條件、導師與項目負責人、階段成果、時間安排及評價方式。對於需要協同的外部系統或現場操作，應在啟動前確認相應聯絡及支持條件。</p>
<p>任務書應區分學生學習任務、企業工程交付和後續運行責任。課題發生調整時，相關負責人應共同確認變更內容，並記錄其對學生工作量、成果要求及實施時間的影響。</p>
<h3>（四）首期候選場景</h3>
<p>首期可研究校園能耗與環境監測、實驗室設備狀態與維護、樓宇或酒店運營數據應用等方向。可圍繞數據接入、異常識別、業務流程及管理信息展示設置任務。以上為備選方向，具體場景需以可落實的需求、數據和導師條件為依據。</p>
<div class="notice">官網行業案例可供課題設計參考；課題是否屬於真實應用項目，應以實際需求方、現場條件及可核查的實施狀態確認。</div>
'''),
('七、項目實施、階段評審與成果交付', '''
<h3>（一）需求分析與方案形成</h3>
<p>學生團隊應在導師指導下開展需求分析，整理使用者、業務流程、現場限制和數據條件，形成需求說明。方案設計應對可選方法作適當比較，說明所採用的數據模型、平台配置、分析方法及開發集成方式，並列出需要驗證的主要問題。</p>
<p>方案評審由高校導師、企業導師及需要參與的平台技術人員共同開展。評審重點包括需求與方案的對應關係、學生任務的適配性、數據及設備條件、實施工作量和驗證方法。評審意見應形成記錄，明確修改事項及後續檢查要求。</p>
<h3>（二）應用實現與過程檢查</h3>
<p>實施階段按確認的任務書開展數據接入、應用配置、分析和算法服務、流程設計及必要的開發工作。團隊應保留配置、接口、代碼或算法版本及相關測試記錄。導師依階段成果檢查任務完成情況，協調遇到的需求、技術或資源問題。</p>
<h3>（三）測試、試用與效果評價</h3>
<p>項目應先完成與成果範圍相符的測試，包括數據接入和處理、功能、業務流程、異常情況及必要的運行檢查。測試報告應說明測試條件、方法、結果與尚未解決的問題，為試用和成果評審提供依據。</p>
<p>具備現場試用條件的項目，由企業項目負責人協調需求方組織試用。學生收集使用者對功能、操作、信息表達和實際效果的意見，完成必要的迭代。成果評價應結合實測記錄和使用回饋，說明已驗證的效果及仍存在的限制。</p>
<h3>（四）成果交付與責任銜接</h3>
<table><thead><tr><th style="width:25%">成果類別</th><th>建议交付內容</th></tr></thead><tbody>
<tr><td>需求與方案材料</td><td>需求說明、設計方案、技術選擇及主要變更記錄。</td></tr>
<tr><td>應用與技術材料</td><td>應用或原型、必要的配置與代碼、數據模型及接口說明。</td></tr>
<tr><td>驗證與使用材料</td><td>測試報告、試用回饋、操作說明及待處理問題清單。</td></tr>
<tr><td>移交與學習材料</td><td>成果接收和維護安排、團隊分工、個人貢獻及復盤記錄。</td></tr>
</tbody></table>
<p>企業項目負責人統籌工程交付與持續運行，學生承擔與學習目標相符的任務。課程結束或團隊更替時，應完成文檔與配置移交，確認成果接收方和後續維護人員，確保既定工作能夠接續。</p>
<h3>（五）成果狀態與案例整理</h3>
<p>對外展示及案例整理應清楚標示成果狀態，區分教學案例、驗證原型與已投入使用的應用，並保留相應依據。经相關方確認可用於教學的材料，可整理為下一輪課程和實踐課題的參考資源。</p>
'''),
('八、學生考核與教學資源建設', '''
<h3>（一）考核基本要求</h3>
<p>學生考核應將結果評價與過程評價相結合，同時檢查團隊成果和個人貢獻。高校導師與企業導師共同參與考核，必要時邀請需求方提出使用意見。具體權重及成績认定方式由參與高校結合課程要求確定，並在課程開始前向學生說明。</p>
<table><thead><tr><th style="width:23%">考核維度</th><th>主要檢查內容</th><th style="width:27%">建議依據</th></tr></thead><tbody>
<tr><td>問題理解</td><td>能否理解實際需求，說明使用者、範圍和限制。</td><td>調研記錄、需求說明、答辯。</td></tr>
<tr><td>方案設計</td><td>能否比較可選方案，合理說明技術與方法選擇。</td><td>方案文檔、評審及修改記錄。</td></tr>
<tr><td>實現與數據</td><td>應用實現是否對應需求，數據和分析方法是否適當。</td><td>演示、配置或代碼、分析記錄。</td></tr>
<tr><td>驗證與改進</td><td>能否用測試及回饋支持結論，完成合理的問題處理。</td><td>測試報告、試用和迭代記錄。</td></tr>
<tr><td>協作與成長</td><td>個人貢獻是否明確，能否解釋工作過程及反思不足。</td><td>任務分工、個人復盤、導師評價。</td></tr>
</tbody></table>
<h3>（二）成果匯報與個人能力檢查</h3>
<p>成果匯報應要求學生說明問題、方案、實現及驗證過程，回答設計依據、數據適用性、效果證明和改進方法等問題。個人能力檢查可結合实际分工，要求學生解釋本人承擔的任務、遇到的問題和形成的成果，以確認其理解和參與程度。</p>
<p>對於尚未達到要求的成果，導師應明确主要不足及可完成的補充工作，按課程安排給予改進機會。學生實踐記錄和作品集可用於後續學習、實習及就業交流；課程認定、學分和證明形式由高校及相關參與方確認。</p>
<h3>（三）共同教學資源建設</h3>
<p>聯盟可逐步形成課程大綱、操作指引、示範數據、課題任務書、測試範例、評審與考核模板、應用案例及導師指導記錄等資源。每項資源应說明來源、適用對象、使用条件、版本和维护聯絡人，便於成員高校採用和完善。</p>
<p>課程與案例資料应按使用範圍整理。可公開或可在聯盟內共享的內容，經相關方確認後納入共同資源；涉及企業業務、現場數據或未公開成果的內容，按已确认的範圍另行管理。實際項目資料與教學案例可分别整理，以滿足不同用途。</p>
<h3>（四）教學質量改進</h3>
<p>每輪課程結束後，教學團隊應綜合学生考核、導師意見和需求方回饋，檢查課程難度、任务工作量、指導方式及案例適配性，形成下一輪修改清單。具備條件時，可組織成員高校交流，促進教學方法與資源的共同改進。</p>
'''),
('九、優秀學生推薦與研究生升學銜接', '''
<h3>（一）機制定位與合作共識</h3>
<p>根據發起人說明，已與合作高校數據科學學院就推薦聯盟優秀學生申請碩士及博士學位課程形成初步共識。聯盟擬據此建立推薦制度，面向成員高校中學業及實踐表現突出的學生，銜接平台訓練、真實項目與研究生培養，支持其後續學術發展。</p>
<h3>（二）推薦對象與遴選依據</h3>
<p>推薦對象為聯盟成員高校中參與培訓或項目實踐、具有相應深造意向，並符合擬申請課程資格要求的學生。遴選應綜合考察學業基礎、實踐能力、研究潛力與導師評價，重視學生個人貢獻及可核查的成果，依共同確認的標準擇優推薦。</p>
<table><thead><tr><th style="width:23%">評議方向</th><th>建議採用的材料與依據</th></tr></thead><tbody>
<tr><td>學業與專業基礎</td><td>學業成績、相關課程表現、專業背景及深造意向。</td></tr>
<tr><td>項目實踐能力</td><td>需求分析、方案設計、本人承擔的實現工作、測試及改進記錄。</td></tr>
<tr><td>研究與發展潛力</td><td>碩士側重專業基礎與學習潛力；博士進一步考察研究問題、方法運用及獨立研究能力，結合研究設想與成果匯報評議。</td></tr>
<tr><td>個人貢獻與評價</td><td>任務分工、個人復盤、高校及企業導師基於實際參與的評價。</td></tr>
</tbody></table>
<h3>（三）推薦程序與材料要求</h3>
<p>建議按「學生自願申請、所在高校初審、聯盟推薦評議、學院對接、學生正式申請」辦理，提前公布標準與材料要求。成員高校核查學業及參與記錄；學院及相關高校教師參與學術評議，企業與平台導師提供實踐評價；聯盟形成推薦意見並提交學院指定渠道。</p>
<p>推薦材料可包括學業資料、實踐作品集、個人貢獻說明、考核記錄及導師意見。申請博士課程者，可結合實踐形成研究設想，供推薦評議參考；正式申請材料則按當年度招生要求準備。材料提交應取得學生同意，明確接收方及用途。</p>
<h3>（四）各方分工與升學銜接</h3>
<p>成員高校負責候選學生遴選、資料核查及校內推薦程序；學院負責推薦渠道、專業方向和招生信息的對接。粵炬及平台方按實際指導情況提供项目實踐證明與能力評價，協助整理可用成果。學生依校方公布的正式渠道完成申請，推薦意見及實踐材料供校方審核參考。</p>
<h3>（五）實施細則與招生程序</h3>
<p>適用課程、推薦批次與名額、遴選標準、材料格式及聯絡安排，由學院、成員高校及相關校方部門進一步協商確認。推薦後的資格審核、考核及錄取依合作高校當年度招生規定和校方確認的安排執行；具體招生支持政策以校方正式公布或書面確認為準。</p>
'''),
('十、組織運行與成員高校加入', '''
<h3>（一）三方聯席協作機制</h3>
<p>聯盟初期擬以三方聯席工作機制統籌建設，由合作高校數據科學學院、航天科技及粵炬分別指定聯絡人，協調教學、技術與項目資源。聯盟名稱、建設方向、階段計劃及資源投入等主要事項，由三方共同討論；其他涉及各方內部權限的事項，由相應參與方完成確認程序。</p>
<p>日常工作建議由學院統籌教學與學術事項，航天科技負責平台與技術支持，粵炬負責項目對接及實施協調。首期由粵炬協助會議組織、事項追蹤、成員聯絡及資料整理，工作範圍由三方確認。聯席工作機制形成書面記錄，載明合作事項、責任方、所需資源及完成條件，按課程與項目進展跟進落實。</p>
<h3>（二）加入申請與基本資料</h3>
<p>後續擬向內地及澳門其他高校開放申請。申請高校提交加入申請，說明參與學院或團隊、教師聯絡人、學生對象和培養需求，並可列明擬參與的課程、師資交流、設備、研究方法或場景資源。各高校可依自身特色提出合作意向，具體參與安排在加入後對接。</p>
<h3>（三）三方代表簽字確認程序</h3>
<p>其他高校申請加入聯盟，由學院、航天科技及粵炬各指定一名代表，在同一份《高校加入聯盟確認書》上共同簽字通過，即可確認其聯盟成員資格。</p>
<table><thead><tr><th style="width:23%">程序</th><th>主要工作</th></tr></thead><tbody>
<tr><td>提出申請</td><td>提交加入申請、合作意向、培養需求及聯絡人資料。</td></tr>
<tr><td>資料對接</td><td>核對高校名稱、參與學院或團隊、聯絡人及合作意向，整理加入確認書。</td></tr>
<tr><td>共同簽字</td><td>學院、航天科技及粵炬三方代表共同簽字通過，確認高校加入。</td></tr>
<tr><td>登記通知</td><td>保存簽字確認書，更新成員名錄，並將確認結果通知申請高校。</td></tr>
</tbody></table>
<p>成員資格自三方代表完成簽字之日起生效。課程、平台使用、項目及資源投入等具體合作事項，在加入後由相關方對接落實。</p>
<h3>（四）成員參與與合作調整</h3>
<p>成員高校依合作安排參與課程建設、學生項目、師資交流或場景研究，使用經確認可共享的教學資源，並推薦符合條件的優秀學生申請學院碩士及博士學位課程。各校指定教師聯絡人，核查學生材料並參與指導及評價。聯盟定期檢查實際參與、學習成果與資源共享情況；平台使用及費用按具體合作安排執行。</p>
<p>需要調整、暫停或結束參與時，由相關方溝通确定後續安排，妥善處理在途課程、學生任務、平台使用和成果保存，維持教學連續性。聯盟可根據實際合作規模和工作需要，逐步完善協作機制。</p>
'''),
('十一、資源投入、成果安排與持續運行', '''
<h3>（一）資源清單與實施規模</h3>
<p>首期啟動前，三方共同建立資源清單，明確平台使用、教師與企業導師、設備與數據、現場協調、項目實施及後續維護所需條件。清單应記載提供方、使用範圍、可用期限和限制。課程人數、學時和項目數量，以已確認的資源條件為依據。</p>
<table><thead><tr><th style="width:24%">投入類別</th><th>應共同確認的內容</th></tr></thead><tbody>
<tr><td>平台與技術</td><td>版本、授權方式、賬號與項目範圍、部署環境、算法擴展及支持內容。</td></tr>
<tr><td>教師與導師</td><td>課程準備、指導時間、評審與考核，以及現場與技術溝通安排。</td></tr>
<tr><td>設備與場景</td><td>可用數據、設備、實踐場地、試用條件及相關聯絡和協調。</td></tr>
<tr><td>運營與維護</td><td>日常協調、成果接收、持續運行、系統維護和相應人員投入。</td></tr>
</tbody></table>
<h3>（二）費用與工作投入安排</h3>
<p>費用安排應區分教學活動、平台和設備使用、實際項目實施及成果轉化，按活動或項目分別商議。導師工作量应涵蓋準備、指導、評審與成果評價；企業導師工作量应涵蓋需求解釋、方案討論、現場協調和試用回饋。新增支出或支持範圍調整，由相關投入方確認。</p>
<h3>（三）成果接收與後續維護</h3>
<p>項目啟動時明确成果接收方、試用條件、運行責任與維護安排。課程結束或團隊更替時，完成必要的文檔、配置、測試和問題記錄移交。平台使用期限结束時，相關方另行確認成果導出、保存及後續使用方式，使教學與應用成果具備可接續的管理条件。</p>
<h3>（四）成果共享與相關權益</h3>
<p>課程材料、教學案例、學生作品、配置與代碼、算法服務、研究材料和實際應用成果的形成背景及用途不同。各方应在課程或項目啟動前區分原有資源與共同形成的成果，分别確認使用、修改、共享、署名和轉化安排。具體歸屬與使用方式由相關參與方按成果類型商定。</p>
<p>學生作品應保留團隊分工和個人貢獻記錄。用於作品集、競賽、論文或對外展示時，應確認成果狀態、參與者署名及相關方同意範圍。涉及商業使用或成果轉化的安排，需另行確認。具備共享条件的教學資源，可經相關方確認後納入聯盟共同資源。</p>
<h3>（五）週期復盤與持續運行</h3>
<p>每輪實踐结束後，三方綜合評估需求來源、導師投入、學生學習效果、使用方回饋及維護負擔，据此確定下一輪規模與內容。現場或數據条件不足時，可調整課題範圍，或採用明确標示的教學案例進行訓練，待条件具備後安排實地驗證。</p>
'''),
('十二、建設階段與成效評價', '''
<h3>（一）第一階段：合作確認與試點準備</h3>
<p>確認擬發起主體、校方參與形式、聯盟名稱及日常協作安排；共同核對平台使用、師資、數據、設備與場景條件；選定首期學生和候選課題。階段成果包括合作事項清單、資源清單、課程安排、導師名單及課題任務書。</p>
<h3>（二）第二階段：培訓與項目實施</h3>
<p>按確認的課程與課題開展基礎訓練和綜合實踐，組織需求討論、方案評審、實現和測試，安排具備條件的試用與成果匯報。階段管理重點是學生參與、導師指導、資源落实及問題處理，並持續記錄成果和進展。</p>
<h3>（三）第三階段：成果評價與資源建設</h3>
<p>完成學生考核、需求方回饋及項目復盤，確認成果接收和後續維護；整理課程、案例與指導材料，形成下一輪改進清單。階段成果包括學生作品與實踐記錄、測試及使用回饋、教學資源和試點評價報告。依確認的細則組織優秀學生推薦，記錄推薦及後續申請情況。</p>
<h3>（四）第四階段：成員高校共建與合作拓展</h3>
<p>依首期試點結果，與有意向的高校交流培養需求和參與資源，經三方代表共同簽字確認加入，再對接具體合作安排。逐步研究跨校項目、師資培訓、應用研究及成果轉化的可行安排。合作範圍和規模应以實際能力、資源投入和成果質量為依據。</p>
<h3>（五）建議成效觀察指標</h3>
<table><thead><tr><th style="width:22%">觀察方向</th><th>可記錄的內容</th><th style="width:30%">評價重點</th></tr></thead><tbody>
<tr><td>學生培養</td><td>參與與完成情況、個人貢獻、考核及能力表現。</td><td>能否完成分析、設計、驗證和改進。</td></tr>
<tr><td>項目實踐</td><td>課題來源、階段成果、試用及使用方回饋。</td><td>問題是否清楚，成果是否有驗證依據。</td></tr>
<tr><td>師資協同</td><td>指導投入、評審參與、研討和教學改進記錄。</td><td>高校與企業指導是否有效銜接。</td></tr>
<tr><td>資源建設</td><td>課程、案例和模板形成及實際採用情況。</td><td>資源是否可用、可重用及持續更新。</td></tr>
<tr><td>聯盟運行</td><td>需求來源、成員貢獻、投入與維護安排。</td><td>下一輪是否具備持续開展的條件。</td></tr>
</tbody></table>
<p>上述內容為首期可採用的觀察框架。具體指標、數值目標與統計方式由三方按試點規模确定，避免以單一活動數量或展示效果代替學生能力和應用成果的評價。</p>
'''),
('十三、待確認事項與編制依據', '''
<h3>（一）優先確認事項</h3>
<table><thead><tr><th style="width:25%">事項</th><th>需共同明確的內容</th></tr></thead><tbody>
<tr><td>參與與授權</td><td>航天科技參與團隊、具體簽署主體及授權、學院牽頭形式、各方內部確認程序與聯絡人。</td></tr>
<tr><td>發起與協作</td><td>聯盟正式名稱、三方分工、聯絡人及日常工作安排。</td></tr>
<tr><td>平台與教學</td><td>教學使用条件、平台版本、課程資源、師資培訓及技術支持範圍。</td></tr>
<tr><td>學生與課題</td><td>學生對象、先修基礎、導師團隊及首批可落實的真實需求。</td></tr>
<tr><td>優秀學生推薦</td><td>將學院初步共識細化為適用課程、推薦批次與名額、遴選標準、材料要求、對接渠道及校方確認安排。</td></tr>
<tr><td>投入與時間</td><td>設備、數據、場地、人员、費用、維護責任及實施週期。</td></tr>
<tr><td>成果與加入</td><td>學習評價、成果使用和共享安排，以及其他高校申請、三方代表簽字確認及登記安排。</td></tr>
</tbody></table>
<h3>（二）首期應形成的配套文件</h3>
<p>首期建議形成合作框架及運作安排、課程與項目實施方案、平台教學使用與技術支持清單、項目任務書及成果管理要求、優秀學生推薦實施細則。文件應列明參與主體、責任人、學生對象、課程與導師、需求與資源、評價方法及後續安排，經相應參與方確認後作為首期啟動依據。</p>
<h3>（三）編制依據</h3>
<p>本方案依據發起人提出的聯盟構想、三方擬共同發起方向、已有校企合作基礎及優秀學生推薦初步共識的說明，結合發起人提供的 2022 年宣講材料、AIRIOT 官網與官方文檔及合作高校公開招生信息編制。</p>
<ul class="sources">
<li>1. AIRIOT「關於我們」：<a href="https://airiot.cn/about/" target="_blank" rel="noopener noreferrer">airiot.cn/about/</a>。用于平台定位及集團背景的公開介紹。</li>
<li>2. AIRIOT「物聯中台」：<a href="https://airiot.cn/iot-platform/" target="_blank" rel="noopener noreferrer">airiot.cn/iot-platform/</a>。用於平台能力與課程內容映射。</li>
<li>3. 官方「Python 算法服務開發」：<a href="https://docs.airiot.cn/development-manual/sdk/python/python-sdk-algorithm" target="_blank" rel="noopener noreferrer">docs.airiot.cn/development-manual/sdk/python/python-sdk-algorithm</a>。用於算法集成方向參考。</li>
<li>4. AIRIOT「智慧項目」：<a href="https://airiot.cn/smart-projects/" target="_blank" rel="noopener noreferrer">airiot.cn/smart-projects/</a>。用於應用場景及項目組織參考。</li>
<li>5. AIRIOT 官網首頁：<a href="https://airiot.cn/" target="_blank" rel="noopener noreferrer">airiot.cn/</a>。用於當前產品與 AI 大模型融合介紹。</li>
<li>6. 發起人提供的 2022 年《AIRIOT 大學計劃》宣講材料，共 34 頁。用於歷史教學合作形式參考。</li>
<li>7. 合作高校「<a href="https://demo.example.invalid/zh/5sep2026-01/" target="_blank" rel="noopener noreferrer">2027/2028 學年研究生課程招生公告</a>」及<a href="https://demo.example.invalid/" target="_blank" rel="noopener noreferrer">招生事務處</a>。用於研究生正式申請渠道參考；聯盟推優細則需另行確認。</li>
<li>8. 航天科技<a href="https://disc.static.szse.cn/download/disc/disk03/finalpage/2026-04-29/bb33e8e8-f29a-41d1-8adb-cf2a535783d2.PDF" target="_blank" rel="noopener noreferrer">2025 年年度報告摘要</a>第 1、3 頁及<a href="https://disc.static.szse.cn/download/disc/disk03/finalpage/2026-04-29/29b229c2-56c9-4a65-a0af-ebbe65193583.PDF" target="_blank" rel="noopener noreferrer">2025 年 ESG 報告</a>印刷第 6、51 頁（PDF 物理第 5、28 頁）。用於核驗企業全稱、AIRIOT 歸屬及智慧物联事业部名稱。</li>
</ul>
<div class="notice">公開功能、歷史案例及本稿擬議安排，應與正式高校授權、各方資源投入和服務承諾分別確認。本方案供共同討論與完善，正式實施以各方確認的條件為依據。</div>
'''),
]

# Apply one consistent traditional vocabulary to drafting residues.
replacements = {
    '开展':'開展','学生':'學生','师資':'師資','能够':'能夠','应':'應','明确':'明確',
    '落实':'落實','建议':'建議','经':'經','认定':'認定','实际':'實際','条件':'條件',
    '维护':'維護','确认':'確認','分别':'分別','任务':'任務','认可':'認可',
    '确定':'確定','结束':'結束','据此':'據此','持续':'持續','人员':'人員',
    '相关':'相關','说明':'說明','用于':'用於','项目':'項目',
    '应用':'應用','积累':'積累','资源':'資源','信息':'資訊','復盤':'總結','賬號':'帳號',
}
chapter_numbers = ['一','二','三','四','五','六','七','八','九','十','十一','十二','十三','十四']
chapters = [(chapter_numbers[i]+'、'+title.split('、',1)[1], body) for i,(title,body) in enumerate(chapters)]
for source, target in replacements.items():
    chapters = [(title.replace(source,target), body.replace(source,target)) for title,body in chapters]

style = '''
:root{--ink:#1a2e40;--muted:#536473;--accent:#1b696d;--line:#dbe3e7;--wash:#f4f7f8;--page-zoom:1}
*{box-sizing:border-box}html{background:#e9edef;scroll-behavior:smooth}body{margin:0;color:var(--ink);font-family:"PingFang TC","Noto Sans CJK TC","Microsoft JhengHei",sans-serif;-webkit-font-smoothing:antialiased}
.toolbar{position:sticky;top:0;z-index:10;display:flex;align-items:center;justify-content:space-between;gap:16px;background:#1a2e40;color:white;padding:13px 24px}.toolbar strong{display:block;font-size:13px;line-height:1.6}.toolbar small{color:#c5d4db;font-size:11px}.toolbar button{font:inherit;font-size:12px;padding:10px 15px;background:#fff;color:var(--ink);border:1px solid #a5c5c8;border-radius:4px;cursor:pointer;white-space:nowrap}.toolbar button:hover{background:#e9f1f1}.toolbar button:focus-visible{outline:3px solid #c9a66b;outline-offset:3px}
.document{padding:26px 12px 40px}.sheet{width:210mm;height:297mm;margin:0 auto 24px;padding:16mm 18mm 13mm;display:flex;flex-direction:column;background:#fff;box-shadow:0 8px 28px #142d4312;zoom:var(--page-zoom)}
.page-header{flex:0 0 auto;display:flex;justify-content:space-between;align-items:baseline;gap:12px;border-bottom:1px solid var(--line);padding-bottom:10px;margin-bottom:20px;color:var(--muted);font-size:10px;letter-spacing:.4px}.brand{font-size:12px;letter-spacing:1px;font-weight:700;color:var(--ink)}.page-main{flex:1 1 auto;min-height:0}.page-footer{flex:0 0 auto;display:flex;justify-content:space-between;gap:10px;border-top:1px solid var(--line);padding-top:9px;margin-top:17px;font-size:9px;color:var(--muted)}.page-number{color:var(--accent);font-weight:650;letter-spacing:.8px}
h1,h2,h3,p{margin-top:0}h2{font-size:22px;line-height:1.55;letter-spacing:.2px;margin-bottom:17px;font-weight:700}h3{font-size:14px;line-height:1.6;margin:18px 0 8px;font-weight:650;color:var(--ink)}h3:first-of-type{margin-top:0}
p{font-size:14px;line-height:1.86;margin-bottom:9px;text-align:justify;text-justify:inter-ideograph;text-indent:2em}li{font-size:13px;line-height:1.82;margin-bottom:7px}ol,ul{padding-left:22px;margin:10px 0 14px}table{width:100%;border-collapse:collapse;margin:10px 0 14px}th,td{font-size:12.2px;line-height:1.75;text-align:left;vertical-align:top;border-bottom:1px solid var(--line);padding:8px 10px}th{font-weight:650;background:var(--wash)}td:first-child{font-weight:600}.notice{font-size:10.5px;line-height:1.75;color:var(--muted);background:var(--wash);border-left:2px solid var(--accent);padding:10px 13px;margin:14px 0 0;text-align:justify}a{color:var(--accent);text-underline-offset:3px}.sources{padding-left:0;list-style:none;margin:8px 0 0}.sources li{font-size:10.5px;line-height:1.75;margin-bottom:6px}.sources a{overflow-wrap:anywhere}
.cover .page-header{margin-bottom:62px}.cover-kicker{font-size:12px;letter-spacing:2px;color:var(--accent);text-indent:0;margin-bottom:15px}.cover h1{font-size:35px;line-height:1.55;letter-spacing:1px;margin:0 0 10px}.cover .subtitle{font-size:25px;line-height:1.6;text-indent:0;font-weight:600;margin-bottom:30px}.cover-line{width:55px;height:3px;background:var(--accent);margin:27px 0}.cover-summary{border:1px solid var(--line);padding:19px 22px;margin:22px 0}.cover-summary h3{margin-top:0}.cover-summary p{font-size:13px;line-height:1.9}.cover-founder-title{font-size:11px;color:var(--muted);text-indent:0;margin-top:27px;margin-bottom:11px}.cover-founder{font-size:15px;text-indent:0;margin-bottom:8px;font-weight:600}.cover-meta{font-size:11px;line-height:1.8;color:var(--muted);text-indent:0;margin-top:24px}.toc{display:grid;grid-template-columns:1fr 1fr;gap:0 24px;margin:16px 0 26px}.toc a{display:grid;grid-template-columns:1fr 22px;gap:10px;text-decoration:none;color:var(--ink);font-size:11.7px;line-height:1.8;padding:10px 0;border-bottom:1px solid var(--line)}.toc .num{text-align:right;color:var(--accent)}.contents p{text-indent:0}.contents td{font-size:12px}.tag{font-size:10px;letter-spacing:1px;color:var(--accent);margin-bottom:9px;text-indent:0}
.dense p{font-size:13.6px;line-height:1.84;margin-bottom:8px}.dense h3:first-of-type{margin-top:0}.dense h3{margin-top:15px}.dense td,.dense th{padding:7px 9px;line-height:1.7}.dense .notice{padding:9px 12px;margin-top:12px}.tight p{font-size:12.5px;line-height:1.8}.tight h3{margin-top:14px}.tight td,.tight th{font-size:11.5px;line-height:1.65;padding:6px 9px}
.goals li{margin-bottom:5px}.sheet{scroll-margin-top:85px}
.recommendation h3{margin-top:13px}.recommendation h3:first-of-type{margin-top:0}.recommendation p{margin-bottom:7px}
@media(max-width:600px){.toolbar{padding:11px 12px;gap:10px}.toolbar strong{font-size:11px}.toolbar small{font-size:9px}.toolbar button{font-size:10px;padding:9px}.document{padding-top:15px}}
@page{size:A4 portrait;margin:0}@media print{html,body{background:#fff;margin:0;padding:0}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.toolbar{display:none}.document{padding:0}.sheet{margin:0;box-shadow:none;zoom:1!important;break-after:page;page-break-after:always;break-inside:avoid;page-break-inside:avoid}.sheet:last-child{break-after:auto;page-break-after:auto}tr,.notice{break-inside:avoid;page-break-inside:avoid}a{color:inherit}}
'''

total = len(chapters) + 2
def page(number, title, body, extra=''):
    return f'''<article class="sheet {extra}" id="page-{number}" aria-labelledby="title-{number}">
<header class="page-header"><span class="brand">AIRIOT · 大灣區高校產業聯盟</span><span>建設方案（討論稿）· {VERSION}</span></header>
<div class="page-main"><h2 id="title-{number}">{title}</h2>{body}</div>
<footer class="page-footer"><span>{DOCUMENT_DATE} · 供擬發起方共同討論</span><span class="page-number">{number:02d} / {total:02d}</span></footer></article>'''

cover = f'''<article class="sheet cover" id="page-1" aria-labelledby="title-1">
<header class="page-header"><span class="brand">AIRIOT · 大灣區高校產業聯盟</span><span>{VERSION} · 討論稿</span></header>
<div class="page-main"><p class="cover-kicker">高校產教融合與實踐人才培養</p>
<h1 id="title-1">AIRIOT 大灣區<br>高校產業聯盟</h1><p class="subtitle">建設方案（討論稿）</p><div class="cover-line"></div>
<div class="cover-summary"><h3>總體構想</h3><p>本方案建議在既有校企合作基礎上，由合作高校數據科學學院、平台技術合作單位及粵炬（澳門）科技有限公司共同發起聯盟，以 AIRIOT 平台訓練與真實項目實踐為主要內容，建立高校、企業與技術平台協同育人的持續合作機制。</p><p>聯盟以學生實踐技能、問題分析及應用能力培養為核心，構建課程、項目、成果評價與研究發展相銜接的培養體系，逐步吸納內地及澳門其他高校參與共建；並依與學院達成的初步共識，推薦符合條件的優秀學生申請相關碩士及博士學位課程。</p></div>
<p class="cover-founder-title">擬共同發起方</p><p class="cover-founder">合作高校數據科學學院</p><p class="cover-founder">平台技術合作單位</p><p class="cover-founder">粵炬（澳門）科技有限公司</p>
<p class="cover-meta">擬由合作高校數據科學學院牽頭高校工作。<br>航天科技參與團隊：AIRIOT 團隊。<br>正式發起、簽署授權及投入安排按合作文件確認。</p>
<p class="cover-meta">編制日期：{DOCUMENT_DATE}<br>文件版本：{VERSION} · 繁體中文 · A4 直式</p></div>
<footer class="page-footer"><span>內部討論及合作方案完善之用</span><span class="page-number">01 / {total:02d}</span></footer></article>'''
cover=cover.replace('名称','名稱')

toc=''.join(f'<a href="#page-{i+3}"><span>{escape(title)}</span><span class="num">{i+3:02d}</span></a>' for i,(title,_) in enumerate(chapters))
summary='''<h3>方案摘要</h3><p>本方案以學院牽頭教學、航天科技提供平台技術支持、粵炬連接需求為基礎，構建課程訓練、真實項目、成果評價及研究發展相銜接的培養體系。首期完成合作試點後，逐步推動成員高校共建。</p>
<table><tbody><tr><td style="width:24%">核心培養任務</td><td>問題理解、方案設計、數據分析、應用實現、測試驗證及團隊協作。</td></tr><tr><td>主要建設內容</td><td>實踐課程、雙導師指導、真實課題、成果評價、教學資源與成員合作。</td></tr><tr><td>實施基本方式</td><td>課程與項目銜接，按任務書推進，通過階段評審和使用方回饋檢驗成果。</td></tr><tr><td>優秀學生推優</td><td>依與學院達成的初步共識，擇優推薦成員高校學生申請學院碩士及博士學位課程，銜接實踐培養與深造。</td></tr><tr><td>首期關鍵條件</td><td>合作主體、平台使用、師資、需求、數據與設備、投入和維護責任可確認。</td></tr><tr><td>後續發展方向</td><td>內地及澳門高校申請加入，參與課程、師資、項目和區域場景共建。</td></tr></tbody></table>
<div class="notice">本稿供合作各方共同討論。正文「航天科技」指平台技術合作單位；「平台方」指其 AIRIOT 團隊。各方參與、授權及投入按合作文件確認。</div>'''

pages=[cover,page(2,'目錄與方案摘要','<div class="toc">'+toc+'</div>'+summary,'contents')]
for i,(title,body) in enumerate(chapters,3):
    title_name=title.split('、',1)[1]
    extra='dense goals' if title_name=='聯盟定位、建設目標與基本原則' else ('' if title_name in ['建設背景與合作基礎','協同育人模式與合作價值','真實項目徵集、篩選與立項'] else 'dense')
    if title_name=='優秀學生推薦與研究生升學銜接':
        extra+=' recommendation'
    pages.append(page(i,title,body,extra))

document=f'''<!doctype html><html lang="zh-Hant-MO"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="AIRIOT 大灣區高校產業聯盟建設方案討論稿：三方擬共同發起、課程體系、項目實踐、組織運行與高校共建。"><title>AIRIOT 大灣區高校產業聯盟｜建設方案（討論稿）</title><style>{style}</style></head><body>
<nav class="toolbar" aria-label="文件操作"><div><strong>AIRIOT 大灣區高校產業聯盟 · 建設方案（討論稿）</strong><small>繁體中文 · A4 直式 · 共 {total} 頁 · {VERSION}</small></div><button id="print-button" type="button">列印／儲存 PDF</button></nav><main class="document">{''.join(pages)}</main>
<script>(()=>{{const fit=()=>document.documentElement.style.setProperty('--page-zoom',String(Math.min(1,(innerWidth-24)/(210*96/25.4))));fit();addEventListener('resize',fit);document.getElementById('print-button').addEventListener('click',()=>print());}})();</script></body></html>'''
OUTPUT.write_text(document,encoding='utf-8')

def to_markdown(body):
    tables=[]
    def keep_table(match):
        tables.append(match.group(0))
        return f'\n\nTABLEBLOCK{len(tables)-1}\n\n'
    body=re.sub(r'<table\b.*?</table>',keep_table,body,flags=re.S)
    body=re.sub(r'<a href="([^"]+)"[^>]*>(.*?)</a>',lambda m:f'[{m.group(2)}]({m.group(1)})',body,flags=re.S)
    body=re.sub(r'<h3>(.*?)</h3>',r'\n\n### \1\n\n',body,flags=re.S)
    body=re.sub(r'<strong>(.*?)</strong>',r'**\1**',body,flags=re.S)
    body=re.sub(r'<li[^>]*>',r'\n- ',body)
    body=re.sub(r'</(?:p|ul|ol|div)>',r'\n\n',body)
    body=re.sub(r'<br\s*/?>',r'\n',body)
    body=re.sub(r'<[^>]+>','',body)
    body=unescape(body)
    body=re.sub(r'\n[ \t]+','\n',body)
    body=re.sub(r'\n{3,}','\n\n',body).strip()
    for i,table in enumerate(tables):
        body=body.replace(f'TABLEBLOCK{i}',table)
    return body

cover_summary=re.search(r'<div class="cover-summary">(.*?)</div>',cover,flags=re.S).group(1)
markdown_parts=[f'''# AIRIOT 大灣區高校產業聯盟

## 建設方案（討論稿）

版本：{VERSION}｜編制日期：{DOCUMENT_DATE}

擬共同發起方：合作高校數據科學學院、平台技術合作單位、粵炬（澳門）科技有限公司。

擬由合作高校數據科學學院牽頭高校工作。正式發起、簽署授權及投入安排按合作文件確認。

本文件與 {total} 頁 A4 HTML 版本同步，供擬發起方共同討論。''',to_markdown(cover_summary),'## 方案摘要\n\n'+to_markdown(summary)]
for title,body in chapters:
    markdown_parts.append('## '+title+'\n\n'+to_markdown(body))
MARKDOWN.write_text('\n\n'.join(markdown_parts)+'\n',encoding='utf-8')
print('OUTPUT',OUTPUT)
print('MARKDOWN',MARKDOWN)
print('PAGES',total)
print('HTML_CHARACTERS',len(document))
print('BODY_CHARACTER_ESTIMATE',sum(len(body) for _,body in chapters))
