# Submitted Stitch prompts

See brief.md for the task-required business boundary and locked source chrome.
The actual prompts for both variant batches are recorded with generation metadata
by the artifact retrieval script. At generation time no native Instant Prototype
had been created. The user subsequently created node678423c41ebc47d49538c0d6b85ebe38;
native play remains unverified because the supplied project URL is not shared
with a fresh unauthenticated browser. See native-prototype-qa/README.md.

Base frames: projects/1256373820415012052/screens/30da7195f4834d9b9f62bd43df12ac4b
and screens/8307652dfe2447038b369960b8e3834e. These are the closest full-frame
maintained references, NOT previously approved exact source chrome. The prompt
must restore current baseline sidebar (including Achievements), white Today
surface, source-owned four tabs, topbar and Journal dialog geometry.

Requested desktop/mobile screens 01–05: Today → canonical new Journal editor →
failed save with fields preserved → saved Journal → returned but not checked.
Separate follow-up states: accepted, check unavailable, leave-with-draft dialog.
Variants are journey states, not alternate visual themes.

Raw screenshots/HTML must be retrieved and compared before accepting. Tool prose,
screen title, a black prototype thumbnail, or generated JS do not prove a native
Stitch prototype or its interactions.

## Desktop batch — submitted 2026-10-14

```text
MB-642 Journey screen set for native Stitch Instant Prototype. Work from selected existing full-frame screen; DO NOT create a storyboard or label a HTML mockup a native prototype. Generate FIVE distinct screen variants in order, individually titled exactly "MB-642 D01 · Hôm nay", "MB-642 D02 · Viết nhật ký", "MB-642 D03 · Lưu chưa thành công", "MB-642 D04 · Đã lưu nhật ký", "MB-642 D05 · Quay lại hoạt động". These are journey states NOT style explorations.

Current repository baseline inspected, desktop viewport1440x900: left sidebar232px fixed, globaltopbar72px, main fromx232 padding46px; brand40px teal tile speechbubble icon + MentalBridge HealthTech, collapsebutton. Sidebar exactly3groups Tổngquan: Tổngquan,Nhậtký,Bàisànglọc,Gợiýhỗtrợ,Kếhoạchhỗtrợ; Chămsóc: Chuyêngia,Lịchhẹn,Tinnhắn; Thôngtin: Cộngđồng,Tàinguyên,Thànhtựu,Phântích,Góidịchvụ,Thôngbáo; profilefoot "Ngườidùngmẫu"/"Tàikhoảncánhân". Realglobaltopbar light sage includes eyebrow Không gian của bạn, route title Kế hoạch hỗ trợ (or Nhật ký onjournal), search "Tìm kiếm chuyên gia, nhật ký...", whiteCommunitypill iconlabel, notificationbox, avatarDM. NO top-onlynavigation, NO iconsreplacedbyfontmissingglyphs.
LOCK all sourcechrome geometry/menu/topbar. Plan leadheading52px Fraunces "Hôm nay, mình đi một bước nhỏ", description then FOUR existingtabs fullcontentwidth: Hômnay,Kếhoạch,Tiếntriển,Điềuchỉnh, tab stripwhiteactive and underline. Existing white Today work surface fromx278 y346 across1116px with title "Hoạt động của tôi"34px, native datepicker to itsright, left activities708px and right context320px. Right3 sourcepanels Nhịphômnay (realactivities), Khicầnthêmhỗtrợ, Điềuchỉnhnhịp (pause/end/adjust) unchanged. Do not make whiteworkspace disappear into sagecanvas. No inventedstats,weeklyscreener,rhythm metrics,newbrand ornav. Match current v3geometry not theoldtopnavtemplate.

Editable only JOURNAL row first/visible in Today, existing Journal origin/status strip and currentJournalcreate dialog. Fixturedate14/10/2026 is synthetic. JOURNALtitle "Viết một suy nghĩ ngắn" 19:05 ·5phút; summary "Dành vài phút để ghi lại điều bạn muốn giữ cho riêng mình." Inputneutral nonclinical. One primary perdecision.

D01: scheduledrow (notcompleted), bookoutlineicon, "Viết nhật ký" primary; tiny "Nội dung nhật ký vẫn riêng tư. Kế hoạch chỉ ghi nhận việc bạn đã lưu bài." Ordinaryotheractivity secondary. No checkpossiblewithoutsavedcandidate.
D02: sameuserchrome, routeNhậtký active, existingJournal hero/history blurred behind existingcanonical white dialog980px maxwidth centered(x230,y90), rounded22px, header "Viết nhật ký" /privacypill, leftform356px (5moodsemanticroadsbuttons Rấttốt,Tốt,Bìnhthường,Khôngtốt,Rấtkhôngtốt; recordeddate;tags), rightcolumnthoughtprompts+textarea, stickyfooter"Hủy","Lưu nhật ký". Add narrow plan-context strip "Từ kế hoạch · Viết một suy nghĩ ngắn" andprivacy inside currentdialog—not newwriterpage. Use synthetic sample "Mình muốn dành ít phút chậm lại và ghi lại một điều nhỏ trong ngày." MoodTốt selected,date14/10/2026. Labelreadonlyownercontext and separateAIexplicit: noautoanalysis/consent. Plainkeyboardaccessiblecontrols,target44px.
D03: sameD02 exactselectedmood/date/tags/text STILLPRESENT; inlineerror "Chưa lưu được nhật ký. Nội dung của bạn vẫn được giữ." primary"Thử lưu lại", secondary"Tiếp tục viết". Do notpretendsuccess/losetext/autoreturn.
D04: modalclosed currentJournalpage withsavedstatusstrip at top "Nhật ký đã được lưu." + "Quay lại hoạt động để kiểm tra ghi nhận." primary"Quay lại hoạt động". Privatewritingpreview belongsONLYJournal; notCare. ExistingJournal hero/history stillowned, no secondhero,neweditor,statsinvented,AIauto.
D05: exactcurrentTodayrow with "Bạn vừa quay lại từ Nhật ký. Hoạt động chưa được xác nhận hoàn thành." primary"Kiểm tra ghi nhận", secondary"Xem nhật ký". No automaticcomplete fromnavigation. Remainingotherdraft unaffected.
Nativeprototype intendededges D01write→D02;D02save→D04,error→D03;D03retry→D04;D04return→D05. Justprepareindividualscreens; nativeInstantPrototype must be separatelygenerated viaStitchUI, do notclaimdonefromtheseimages.
Fraunces + BeVietnamPro realVietnamese fonts, teal/sage tokens,#1E4A43/#3D7A6E/#E9EFE3/#1B2A22,body16px. Loadedglyphs, correctfontsnoNewsreader/Inter, useinlineSVGnoticonfont. Shortopacity/translate220ms interruptible feedback, reducedmotionimmediate; noglow,bounce,animationsdelayAPI. Shellandpermissionslocked. No private text travels toCare. No treatment/recovery claims.
```

## Mobile batch — submitted 2026-10-14

```text
MB-642 Journey screen set for native Stitch Instant Prototype. Work from selected existing full-frame screen; DO NOT create a storyboard or label a HTML mockup a native prototype. Generate FIVE distinct screen variants in order, individually titled exactly "MB-642 M01 · Hôm nay", "MB-642 M02 · Viết nhật ký", "MB-642 M03 · Lưu chưa thành công", "MB-642 M04 · Đã lưu nhật ký", "MB-642 M05 · Quay lại hoạt động". These are journey states NOT style explorations.

Current repository baseline inspected, desktop viewport1440x900: left sidebar232px fixed, globaltopbar72px, main fromx232 padding46px; brand40px teal tile speechbubble icon + MentalBridge HealthTech, collapsebutton. Sidebar exactly3groups Tổngquan: Tổngquan,Nhậtký,Bàisànglọc,Gợiýhỗtrợ,Kếhoạchhỗtrợ; Chămsóc: Chuyêngia,Lịchhẹn,Tinnhắn; Thôngtin: Cộngđồng,Tàinguyên,Thànhtựu,Phântích,Góidịchvụ,Thôngbáo; profilefoot "Ngườidùngmẫu"/"Tàikhoảncánhân". Realglobaltopbar light sage includes eyebrow Không gian của bạn, route title Kế hoạch hỗ trợ (or Nhật ký onjournal), search "Tìm kiếm chuyên gia, nhật ký...", whiteCommunitypill iconlabel, notificationbox, avatarDM. NO top-onlynavigation, NO iconsreplacedbyfontmissingglyphs.
LOCK all sourcechrome geometry/menu/topbar. Plan leadheading52px Fraunces "Hôm nay, mình đi một bước nhỏ", description then FOUR existingtabs fullcontentwidth: Hômnay,Kếhoạch,Tiếntriển,Điềuchỉnh, tab stripwhiteactive and underline. Existing white Today work surface fromx278 y346 across1116px with title "Hoạt động của tôi"34px, native datepicker to itsright, left activities708px and right context320px. Right3 sourcepanels Nhịphômnay (realactivities), Khicầnthêmhỗtrợ, Điềuchỉnhnhịp (pause/end/adjust) unchanged. Do not make whiteworkspace disappear into sagecanvas. No inventedstats,weeklyscreener,rhythm metrics,newbrand ornav. Match current v3geometry not theoldtopnavtemplate.

Editable only JOURNAL row first/visible in Today, existing Journal origin/status strip and currentJournalcreate dialog. Fixturedate14/10/2026 is synthetic. JOURNALtitle "Viết một suy nghĩ ngắn" 19:05 ·5phút; summary "Dành vài phút để ghi lại điều bạn muốn giữ cho riêng mình." Inputneutral nonclinical. One primary perdecision.

D01: scheduledrow (notcompleted), bookoutlineicon, "Viết nhật ký" primary; tiny "Nội dung nhật ký vẫn riêng tư. Kế hoạch chỉ ghi nhận việc bạn đã lưu bài." Ordinaryotheractivity secondary. No checkpossiblewithoutsavedcandidate.
D02: sameuserchrome, routeNhậtký active, existingJournal hero/history blurred behind existingcanonical white dialog980px maxwidth centered(x230,y90), rounded22px, header "Viết nhật ký" /privacypill, leftform356px (5moodsemanticroadsbuttons Rấttốt,Tốt,Bìnhthường,Khôngtốt,Rấtkhôngtốt; recordeddate;tags), rightcolumnthoughtprompts+textarea, stickyfooter"Hủy","Lưu nhật ký". Add narrow plan-context strip "Từ kế hoạch · Viết một suy nghĩ ngắn" andprivacy inside currentdialog—not newwriterpage. Use synthetic sample "Mình muốn dành ít phút chậm lại và ghi lại một điều nhỏ trong ngày." MoodTốt selected,date14/10/2026. Labelreadonlyownercontext and separateAIexplicit: noautoanalysis/consent. Plainkeyboardaccessiblecontrols,target44px.
D03: sameD02 exactselectedmood/date/tags/text STILLPRESENT; inlineerror "Chưa lưu được nhật ký. Nội dung của bạn vẫn được giữ." primary"Thử lưu lại", secondary"Tiếp tục viết". Do notpretendsuccess/losetext/autoreturn.
D04: modalclosed currentJournalpage withsavedstatusstrip at top "Nhật ký đã được lưu." + "Quay lại hoạt động để kiểm tra ghi nhận." primary"Quay lại hoạt động". Privatewritingpreview belongsONLYJournal; notCare. ExistingJournal hero/history stillowned, no secondhero,neweditor,statsinvented,AIauto.
D05: exactcurrentTodayrow with "Bạn vừa quay lại từ Nhật ký. Hoạt động chưa được xác nhận hoàn thành." primary"Kiểm tra ghi nhận", secondary"Xem nhật ký". No automaticcomplete fromnavigation. Remainingotherdraft unaffected.
Nativeprototype intendededges D01write→D02;D02save→D04,error→D03;D03retry→D04;D04return→D05. Justprepareindividualscreens; nativeInstantPrototype must be separatelygenerated viaStitchUI, do notclaimdonefromtheseimages.
Fraunces + BeVietnamPro realVietnamese fonts, teal/sage tokens,#1E4A43/#3D7A6E/#E9EFE3/#1B2A22,body16px. Loadedglyphs, correctfontsnoNewsreader/Inter, useinlineSVGnoticonfont. Shortopacity/translate220ms interruptible feedback, reducedmotionimmediate; noglow,bounce,animationsdelayAPI. Shellandpermissionslocked. No private text travels toCare. No treatment/recovery claims. MOBILE ADAPTATION IS REQUIRED at375x812, notdesktopshrunk: source65px topbar with hamburger,routecontext,Communityicon,notify/avatar; sidebaroffcanvas only existingmenubutton, no newbottomtabs orappbar. Existingroutelead and4tabs horizontallyscrollable notdeleted. SinglecolumnwhiteTodayworkspace fullavailablewidth, existingcontextpanelsfollowactivities. Journalcanonical dialog fullavailablewidth,maxheightviewport-safemargins, ownscrollbody and visible44pxfooter controls; planstrip and mood mustreachable, textarea mayfocus butheader/privacy accessible byscroll. Existingfloating safetywidget mustnotcover save/return/focus. Preserveunderlyingshell, lockfooter whenpending. All5 mobilevariants distinctjourneystates M01-M05.
```
