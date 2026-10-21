from pathlib import Path
from html import escape
import json
import re


ROOT = Path(__file__).resolve().parent.parent
STEM = 'AIRIOT大灣區高校產業聯盟_高校加入協議_範本'
MARKDOWN = ROOT / 'AIRIOT大湾区高校产业联盟_高校加入协议_范本.md'
STYLE_REFERENCE = ROOT / 'AIRIOT大灣區高校產業聯盟_構想初稿_A4.html'
VERSION = 'V1.2'
FOUNDERS = [
    '合作高校數據科學學院',
    '平台技術合作單位',
    '粵炬（澳門）科技有限公司',
]
TITLE = 'AIRIOT 大灣區高校產業聯盟'
SUBTITLE = '高校加入協議'
DATE = '2026 年 10 月 2 日'

# HTML and Markdown share the complete agreement text below.
# Only the visual styles are read from the existing construction proposal.
pages = [
    {
        'title': '協議主體與高校加入',
        'intro': [
            'AIRIOT 大灣區高校產業聯盟（以下簡稱「聯盟」）由合作高校數據科學學院、平台技術合作單位及粵炬（澳門）科技有限公司共同組成，上述單位以下合稱「三方組成單位」。三方組成單位各自指定負責高校加入審核及合作協調的代表，以下簡稱「三方代表」。',
            '聯盟以 AIRIOT 平台為實踐支撐，開展課程培訓、真實項目實踐、師資交流及成果評價，促進學生實踐技能、問題分析能力及應用能力培養。',
            '附件一所列高校自願申請加入聯盟，以下稱「申請高校」；取得成員資格後稱「成員高校」。為明確高校加入程序、成員權利義務及合作規則，三方組成單位與申請高校訂立本協議。',
        ],
        'sections': [
            ('第一條 加入申請及資格確認', [
                '1.1 申請高校應填寫附件一，載明高校名稱、參與院系、聯絡人、學生對象及合作意向，完成校內授權程序後簽署本協議。',
                '1.2 三方代表依各自單位的授權審核申請，並在附件二分別填寫審核意見及簽署。要求補充申請資料的，應向申請高校說明所需資料；不予通過的，應載明理由。',
                '1.3 申請高校完成簽署且三方代表均審核通過後，取得聯盟成員高校資格。三方代表應將審核結果書面通知申請高校，並完成成員登記。',
                '1.4 本協議生效之日即高校取得成員資格之日，以高校簽署日期與三方代表最後一位簽署通過意見的日期中較晚者為準，並在附件二記錄。',
            ]),
            ('第二條 合作範圍', [
                '2.1 合作範圍包括 AIRIOT 實踐課程、真實項目、雙導師指導、師資交流、教學案例共建、應用研究及優秀學生推薦。成員高校依專業特色及培養需求選擇參與事項。',
                '2.2 具體合作由參與合作的成員高校與提供資源或承擔實施責任的單位（以下合稱「合作單位」），以課程實施方案、項目任務書或專項協議（以下統稱「實施文件」）書面確認，載明合作內容、人員、資源、期限、責任、成果及評價要求。',
                '2.3 成員高校承擔其書面同意的合作事項。涉及本校課程認定、學分、教師工作量或實踐證明的，由成員高校依校內規定辦理。',
            ]),
            ('第三條 費用約定', [
                '3.1 本協議項下的入盟申請、資格審核、成員登記及成員資格管理均不收取費用。三方組成單位不得向成員高校收取入盟費、會費或成員資格管理費。',
                '3.2 具體合作涉及設備採購、差旅、第三方服務或項目實施支出的，由合作單位在實施前另行書面約定費用項目、金額、承擔主體及支付條件。',
                '3.3 未經成員高校書面同意，任何合作單位不得要求其承擔前款費用，亦不得將承擔具體合作費用作為取得或維持聯盟成員資格的條件。',
            ]),
        ],
    },
    {
        'title': '成員權利義務與合作職責',
        'sections': [
            ('第四條 成員高校的權利', [
                '4.1 成員高校有權依課程或項目的參與條件組織教師、學生報名，按照實施文件取得相應指導、技術支持及成果評價，並在授權範圍內使用共享教學資源。',
                '4.2 成員高校有權提出課題及課程建設建議，參與師資交流和案例共建，依第八條推薦符合條件的學生申請相關研究生課程。',
                '4.3 成員高校有權了解涉及本校的合作內容、資源安排及評價標準，提出改進意見，並依第十三條調整參與事項或退出聯盟。',
            ]),
            ('第五條 成員高校的義務', [
                '5.1 成員高校應保證申請資料真實、準確、完整，指定參與院系及教師聯絡人，負責本校參與事項的組織及校內協調。',
                '5.2 成員高校應履行實施文件中由本校承擔的師資、場地、設備及學生管理責任，參與教學檢查和成果評價，保存本校學生的任務分工及學習記錄。',
                '5.3 成員高校應向參與學生明確任務內容、實施時間、成果要求及資料使用規則，依校內規定辦理學生參與、現場實踐及安全管理事項。',
                '5.4 成員高校應督促本校教師及學生遵守平台授權、資料保護、保密及成果使用約定，妥善管理帳號與合作資料，及時報告影響合作履行的事項。',
            ]),
            ('第六條 三方組成單位的合作職責', [
                '6.1 合作高校數據科學學院牽頭協調課程建設、學術指導、教學評價及優秀學生推薦事項。平台技術合作單位負責 AIRIOT 平台及技術支持事項的協調。粵炬（澳門）科技有限公司負責企業需求徵集、實踐項目對接及實施協調。',
                '6.2 三方組成單位應分別指定合作聯絡人，對成員高校提出的課程、技術及項目事項進行協調；各單位承擔的具體資源投入及實施責任，應在實施文件中明確。',
                '6.3 合作單位應在實施文件中確定導師、任務及評價方式，將需求分析、方案設計、應用實現、測試驗證及個人貢獻納入學生實踐評價。',
                '6.4 用於真實場景的學生實踐成果，由實施文件指定的項目責任單位組織測試、接收及運行確認，承擔文件約定的交付與維護責任。',
            ]),
        ],
    },
    {
        'title': '平台使用與學生推薦及資料保護',
        'sections': [
            ('第七條 平台使用與技術支持', [
                '7.1 提供 AIRIOT 平台使用權限的單位（以下稱「平台提供方」）應與使用平台的成員高校（以下稱「使用高校」）書面確定平台版本、部署方式、使用目的、帳號權限、可用功能、授權期限及技術支持內容。',
                '7.2 使用高校應在平台提供方授權範圍內使用平台，管理本校帳號及使用人員。變更授權範圍或新增服務應取得平台提供方書面同意；涉及費用的，依第三條辦理。',
                '7.3 平台授權屆滿或終止時，平台提供方與使用高校應依授權文件完成帳號停用、資料導出及配置移交。確需延續使用的，應在原授權屆滿前另行取得授權。',
            ]),
            ('第八條 優秀學生推薦', [
                '8.1 成員高校可推薦參與聯盟培訓或項目實踐、學業及實踐表現優良、具有深造意願且符合申請資格的學生，申請合作高校數據科學學院相關碩士及博士學位課程。',
                '8.2 推薦課程、批次、遴選標準及材料要求，由合作高校數據科學學院與參與高校書面確認。推薦評議應綜合學生學業基礎、實踐能力、研究潛力、個人貢獻及導師評價。',
                '8.3 成員高校負責核查學生學業及參與記錄，取得學生同意後提交推薦材料；合作高校數據科學學院負責推薦評議及招生申請程序的對接；企業與平台導師依實際指導情況出具實踐評價。',
                '8.4 學生應依合作高校當年度招生規定提交正式申請、配合資格審核並參加相關考核。推薦意見作為申請材料供校方審核，錄取結果由校方依正式招生程序決定。',
            ]),
            ('第九條 資料使用及個人資料保護', [
                '9.1 資料提供方應具有合法提供資料的權限，並與資料接收方書面確定使用目的、資料範圍、接收人員、存放位置、訪問權限及保存期限。資料接收方應按約定使用，超出約定用途須另行取得授權。',
                '9.2 學生資料、成績、作品及導師評價的收集、使用或提供，應履行適用法律要求的告知、同意及其他法定程序。跨校共享或跨境傳輸資料，應由負責處理的單位依法完成相應程序。',
                '9.3 發生資料洩露、帳號異常或未經授權使用的，發現單位應立即採取控制措施，通知資料提供方及受影響的合作單位，保存處理記錄，並履行依法應承擔的報告義務。',
            ]),
        ],
    },
    {
        'title': '知識產權與保密及名稱使用',
        'sections': [
            ('第十條 知識產權與成果使用', [
                '10.1 合作單位及其他權利人於合作前享有的課程、軟件、代碼、算法、案例及資料等權利，歸原權利人享有。提供資源供合作使用的，應書面明確授權用途、範圍及期限。',
                '10.2 合作形成的教學、研究及應用成果，其權屬、使用、署名、共享及轉化條件，應由合作單位在實施文件中約定，並依法尊重學生及其他創作者的權利。處分涉及第三人權利的成果，應取得該權利人的授權。',
                '10.3 合作成果用於學生作品集、競賽、論文、教學共享或對外展示時，使用方應遵守成果授權、保密及資料使用約定，保留團隊分工與個人貢獻記錄，依法保障署名權。',
                '10.4 商業使用、成果轉化及工程交付應由有權處分成果的主體與實際承擔交付責任的單位另行簽署專項協議，載明權利、投入、驗收及維護責任；費用依第三條約定。',
            ]),
            ('第十一條 保密義務', [
                '11.1 保密資料包括提供方明確標示為保密或接收方依資料性質應知悉其保密性的技術資料、商業資訊及未公開成果。接收方應僅為約定的合作目的使用，限定知悉人員並採取保密措施。',
                '11.2 接收方能證明資料已合法公開、原已合法掌握、依法自第三方取得或獨立形成的，不受前款限制。依法須披露保密資料的，接收方應在法律允許範圍內提前通知提供方，並將披露限於法定要求的範圍。',
                '11.3 合作終止或成員資格終止後，接收方應依資料提供方的合法要求及實施文件約定歸還、刪除或保存保密資料；依法或依約須保存的資料，仍應履行保密義務。個人資料另依第九條處理。',
            ]),
            ('第十二條 名稱與標識使用', [
                '12.1 成員高校可在本校實際參與的聯盟合作事項中表明成員身份。使用三方組成單位或其他高校的名稱、標識，或以聯合名義發布內容的，應事先取得相應單位書面同意。',
                '12.2 成員高校及三方組成單位對外發布的合作、成果及學生推薦資訊應真實、準確。未經授權，不得以聯盟或其他單位名義作出資源、服務或錄取承諾。',
            ]),
        ],
    },
    {
        'title': '成員資格終止與履行及生效',
        'sections': [
            ('第十三條 參與調整及成員資格終止', [
                '13.1 成員高校調整或暫停具體合作的，應與該項合作的其他合作單位依實施文件書面確認。退出聯盟的，應向三方代表提交書面通知，以最後一名三方代表收到通知之日為通知送達日。退出自通知送達日生效；通知載明較後退出日期的，自該日期生效。',
                '13.2 成員高校提供重大失實資料或嚴重違反本協議的，三方代表應書面告知事由，聽取高校陳述，並在可予糾正的情況下給予整改機會。決定終止成員資格的，須經三方代表一致確認，載明理由及生效日期並書面通知高校。',
                '13.3 成員資格終止後，高校應停止以聯盟成員身份開展活動。尚未完成的課程、項目及成果移交，依實施文件繼續履行或另行辦理終止；其處理不影響成員資格終止的效力。',
                '13.4 成員資格終止不影響依法或依約應存續的費用結算、平台授權處理、資料保護、知識產權、保密及履行責任。',
            ]),
            ('第十四條 協調與書面通知', [
                '14.1 三方代表在所屬單位授權範圍內辦理成員審核及合作協調事項。具體課程、項目、平台授權及資源投入，由承擔該事項的合作單位書面確認並履行。',
                '14.2 本協議項下通知應以可確認送達的書面文件或電子郵件，送達附件一所列高校通訊地址或聯絡電子郵件、附件二所列三方代表聯絡電子郵件，並保留送達記錄。',
                '14.3 聯絡人或聯絡方式變更的，應及時書面通知本協議其他各方。涉及已簽署實施文件的，並應通知該項合作的其他合作單位。',
            ]),
            ('第十五條 履行責任與爭議解決', [
                '15.1 違反本協議或實施文件約定的單位，應及時採取糾正措施，並依法承擔相應責任。預計無法按約定履行的，應及時書面通知受影響的合作單位，協商處理履行、變更或終止事項。',
                '15.2 因本協議產生的爭議，由成員高校與涉及爭議的三方組成單位先行協商；協商不成的，相關當事方可依法向有管轄權的法院提起訴訟。',
                '15.3 具體合作的責任及爭議解決依實施文件辦理。未經有關單位書面同意，實施文件不得變更該單位在本協議項下的權利義務。',
            ]),
            ('第十六條 生效與協議變更', [
                '16.1 本協議依第一條生效，於成員資格存續期間適用；成員資格終止後的存續事項依第十三條辦理。',
                '16.2 附件一及附件二為本協議的組成部分。三方組成單位與成員高校各持完整文本；變更本協議須經三方組成單位與成員高校書面同意。',
            ]),
        ],
    },
    {
        'title': '附件一 申請高校資料及加入承諾',
        'form': 'applicant',
    },
    {
        'title': '附件二 三方代表審核及加入確認',
        'form': 'review',
    },
]

applicant_fields = [
    ('高校全稱', '________________________________________________'),
    ('通訊地址', '________________________________________________'),
    ('參與院系或團隊', '________________________________________________'),
    ('教師聯絡人及職務', '________________________________________________'),
    ('聯絡電話', '________________________________________________'),
    ('聯絡電子郵件', '________________________________________________'),
    ('擬參與學生對象', '專業／年級／學生基礎：____________________________'),
    ('主要培養需求', '________________________________________________'),
    ('擬參與合作內容', '課程培訓／真實項目／師資交流／案例共建／其他：______'),
    ('擬提供合作資源', '教師、場地、設備、課程或場景：______________________'),
]
applicant_commitment = '本校已閱讀並同意本協議，自願申請加入 AIRIOT 大灣區高校產業聯盟，確認申請資料真實、準確、完整，並已依校內規定完成申請及簽署授權程序。本校指定本表所列參與院系或團隊及聯絡人負責合作事項，依本協議及實施文件履行成員高校義務。本表所列合作意向及資源計劃，具體投入以實施文件為準。'
applicant_signatures = [
    '申請高校名稱：________________________________________',
    '申請高校蓋章：',
    '授權代表簽署：________________________________________',
    '代表職務：____________________________________________',
    '簽署日期：________年________月________日',
]
review_intro = '申請高校：________________________________________________\n三方代表依所屬單位授權審核本協議及附件一所載加入申請，分別記錄意見並簽署。高校完成簽署且三方均審核通過後，依第一條取得成員資格。'
review_fields = [
    '代表姓名及職務：______________________________________',
    '聯絡電子郵件：________________________________________',
    '審核意見：通過／補充資料後再審／不通過（請圈選）',
    '意見說明：____________________________________________',
    '代表簽署：________________　日期：______年____月____日',
]
review_confirmation = [
    '協議生效暨加入確認日期：________年________月________日',
    '日期依第一條第1.4款確定，於高校簽署及三方審核全部完成後填列。',
    '成員登記及通知經辦人：____________　通知日期：____________',
]


def html_p(text, cls=''):
    attr = f' class="{cls}"' if cls else ''
    return '<p' + attr + '>' + escape(text) + '</p>'


def page_body(page):
    parts = [html_p(text) for text in page.get('intro', [])]
    for title, texts in page.get('sections', []):
        parts.append('<h3>' + escape(title) + '</h3>')
        parts.extend(html_p(text) for text in texts)
    if page.get('form') == 'applicant':
        parts.extend(html_p(label + '：' + value, 'form-line') for label, value in applicant_fields)
        parts.append('<h3>加入承諾</h3>')
        parts.append(html_p(applicant_commitment))
        for text in applicant_signatures:
            parts.append(html_p(text, 'stamp' if text == '申請高校蓋章：' else 'form-line'))
    if page.get('form') == 'review':
        parts.extend(html_p(text) for text in review_intro.split('\n'))
        for number, name in enumerate(FOUNDERS, start=1):
            parts.append('<h3>' + str(number) + ' ' + escape(name) + '</h3>')
            parts.extend(html_p(text, 'review-line') for text in review_fields)
        parts.append('<h3>加入確認記錄</h3>')
        parts.extend(html_p(text, 'review-line') for text in review_confirmation)
    return ''.join(parts)


COVER_PURPOSE = '本協議規範高校加入 AIRIOT 大灣區高校產業聯盟的程序，明確成員資格、權利義務及課程培訓、項目實踐、師資交流與學生培養的合作規則。'
COVER_PROCESS = '申請高校完成簽署並經三方代表均審核通過後取得成員資格。入盟申請、資格審核、成員登記及成員資格管理不收取費用；具體合作由實際參與的合作單位另行書面確認。'
SUMMARY_ROWS = [
    ('聯盟組成', '合作高校數據科學學院、平台技術合作單位及粵炬（澳門）科技有限公司已共同組成聯盟。'),
    ('加入方式', '高校提交資料及簽署本協議，由三方代表分別審核，三方均通過後取得成員資格。'),
    ('費用約定', '入盟申請、資格審核、成員登記及成員資格管理不收取費用；具體合作支出另行書面約定。'),
    ('合作內容', '課程培訓、真實項目、雙導師指導、師資交流、教學案例與應用研究。'),
    ('學生推薦', '依經書面確認的推薦要求，推薦優秀學生申請合作高校數據科學學院相關碩士及博士學位課程。'),
    ('辦理文件', '協議正文、附件一高校資料及加入承諾、附件二三方代表審核與加入確認。'),
]
SUMMARY_TABLE = '<table><tbody>' + ''.join('<tr><td style="width:23%">' + escape(label) + '</td><td>' + escape(text) + '</td></tr>' for label, text in SUMMARY_ROWS) + '</tbody></table>'
SUMMARY_NOTE = '協議生效暨加入確認日期，以高校簽署日期與三方代表最後一位簽署通過意見的日期中較晚者為準。附件二記錄三方審核、聯絡方式及成員登記通知事項。'


def page_frame(number, title, body, total, extra=''):
    return f'''<article class="sheet agreement {extra}" id="page-{number}" aria-labelledby="title-{number}">
<header class="page-header"><span class="brand">AIRIOT · 大灣區高校產業聯盟</span><span>高校加入協議 · {VERSION}</span></header>
<div class="page-main"><h2 id="title-{number}">{escape(title)}</h2>{body}</div>
<footer class="page-footer"><span>{DATE} · 高校加入協議</span><span class="page-number">{number:02d} / {total:02d}</span></footer></article>'''


def build_html():
    total = len(pages) + 2
    reference = STYLE_REFERENCE.read_text(encoding='utf-8')
    css = re.search(r'<style>(.*?)</style>', reference, flags=re.S).group(1)
    css += '''
.agreement p{text-indent:0}.agreement .form-line{margin-bottom:15px;line-height:2}
.agreement .stamp{min-height:82px;margin-bottom:12px}.agreement .review-line{margin-bottom:9px;line-height:1.95}
.agreement.form-page h3{margin-top:20px}.agreement.form-page h3:first-of-type{margin-top:16px}
.agreement.dense p{line-height:1.8;margin-bottom:6px}.agreement.dense h3{margin-top:10px}
.agreement.review-page .review-line{line-height:1.9;margin-bottom:7px}.agreement.review-page h3{margin-top:18px}
.agreement .summary-lead{font-size:14px;line-height:1.9;margin-bottom:15px}.agreement.contents .toc{margin-bottom:30px}
.agreement .field-note{font-size:11px;color:var(--muted)}
'''
    founders_html = ''.join('<p class="cover-founder">' + escape(name) + '</p>' for name in FOUNDERS)
    cover = f'''<article class="sheet cover agreement" id="page-1" aria-labelledby="title-1">
<header class="page-header"><span class="brand">AIRIOT · 大灣區高校產業聯盟</span><span>{VERSION} · 協議範本</span></header>
<div class="page-main"><p class="cover-kicker">成員高校加入與協同育人</p>
<h1 id="title-1">AIRIOT 大灣區<br>高校產業聯盟</h1><p class="subtitle">高校加入協議</p><div class="cover-line"></div>
<div class="cover-summary"><h3>高校加入安排</h3>{html_p(COVER_PURPOSE)}{html_p(COVER_PROCESS)}</div>
<p class="cover-founder-title">聯盟組成單位</p>{founders_html}
<p class="cover-meta">申請高校資料及加入承諾：附件一。<br>三方代表審核及加入確認：附件二。<br>高校簽署並經三方均審核通過後，取得成員資格。</p>
<p class="cover-meta">編制日期：{DATE}<br>文件版本：{VERSION} · 繁體中文 · A4 直式</p></div>
<footer class="page-footer"><span>成員資格與合作規則</span><span class="page-number">01 / {total:02d}</span></footer></article>'''
    toc = ''.join('<a href="#page-' + str(i+3) + '"><span>' + escape(page['title']) + '</span><span class="num">' + f'{i+3:02d}' + '</span></a>' for i, page in enumerate(pages))
    summary = '<div class="toc">' + toc + '</div><h3>協議摘要</h3>' + html_p(COVER_PROCESS, 'summary-lead') + SUMMARY_TABLE + '<div class="notice">' + escape(SUMMARY_NOTE) + '</div>'
    rendered = [cover, page_frame(2, '目錄與協議摘要', summary, total, 'contents')]
    for number, page in enumerate(pages, 3):
        extra = 'form-page review-page' if page.get('form') == 'review' else ('form-page' if page.get('form') else 'dense')
        rendered.append(page_frame(number, page['title'], page_body(page), total, extra))
    document = f'''<!doctype html><html lang="zh-Hant-MO"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="AIRIOT 大灣區高校產業聯盟高校加入協議，載明加入程序、成員權利義務、費用約定及三方代表審核確認事項。"><title>{TITLE}｜{SUBTITLE}</title><style>{css}</style></head><body>
<nav class="toolbar" aria-label="文件操作"><div><strong>{TITLE} · {SUBTITLE}</strong><small>繁體中文 · A4 直式 · 共 {total} 頁 · {VERSION}</small></div><button id="print-button" type="button">列印／儲存 PDF</button></nav><main class="document">{''.join(rendered)}</main>
<script>(()=>{{const fit=()=>document.documentElement.style.setProperty('--page-zoom',String(Math.min(1,(innerWidth-24)/(210*96/25.4))));fit();addEventListener('resize',fit);document.getElementById('print-button').addEventListener('click',()=>print());}})();</script></body></html>'''
    path = ROOT / (STEM + '_A4.html')
    path.write_text(document.replace('代表审核', '代表審核'), encoding='utf-8')
    return path


def build_markdown():
    total = len(pages) + 2
    parts = [
        '# ' + TITLE,
        '## ' + SUBTITLE,
        f'版本：{VERSION}｜編制日期：{DATE}',
        '聯盟組成單位：' + '、'.join(FOUNDERS) + '。',
        f'本文件與 {total} 頁 A4 HTML 版本同步，供高校加入聯盟及合作安排使用。',
        '### 高校加入安排', COVER_PURPOSE, COVER_PROCESS,
        '## 協議摘要', SUMMARY_TABLE, SUMMARY_NOTE,
    ]
    for page in pages:
        parts.append('## ' + page['title'])
        parts.extend(page.get('intro', []))
        for title, texts in page.get('sections', []):
            parts.append('### ' + title)
            parts.extend(texts)
        if page.get('form') == 'applicant':
            parts.extend(label + '：' + value for label, value in applicant_fields)
            parts.extend(['### 加入承諾', applicant_commitment])
            parts.extend(applicant_signatures)
        if page.get('form') == 'review':
            parts.extend(review_intro.split('\n'))
            for number, name in enumerate(FOUNDERS, start=1):
                parts.append('### ' + str(number) + ' ' + name)
                parts.extend(review_fields)
            parts.append('### 加入確認記錄')
            parts.extend(review_confirmation)
    MARKDOWN.write_text('\n\n'.join(parts) + '\n', encoding='utf-8')
    return MARKDOWN


if __name__ == '__main__':
    # Normalize accidental Simplified characters outside the user-specified founder name.
    for page in pages:
        for key in ('intro',):
            page[key] = [s.replace('实际', '實際').replace('组织', '組織').replace('审核', '審核').replace('资格', '資格') for s in page.get(key, [])]
        page['sections'] = [(h, [s.replace('实际', '實際').replace('组织', '組織').replace('审核', '審核').replace('资格', '資格') for s in items]) for h, items in page.get('sections', [])]
    review_intro = review_intro.replace('资格', '資格')
    html_path = build_html()
    markdown_path = build_markdown()
    source_path = ROOT / 'scripts' / 'membership_agreement_source.json'
    source_path.write_text(json.dumps({'title': TITLE, 'subtitle': SUBTITLE, 'version': VERSION, 'date': DATE, 'founders': FOUNDERS, 'pages': pages,
                                       'applicant_fields': applicant_fields, 'applicant_commitment': applicant_commitment,
                                       'applicant_signatures': applicant_signatures, 'review_intro': review_intro,
                                       'review_fields': review_fields, 'review_confirmation': review_confirmation}, ensure_ascii=False, indent=2))
    print(json.dumps({'html': str(html_path), 'markdown': str(markdown_path), 'pages': len(pages) + 2}, ensure_ascii=False))
