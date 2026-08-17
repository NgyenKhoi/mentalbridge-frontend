'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import './journal.css'

const MOODS=[
 {emoji:'😊',label:'Tuyệt vời',value:5,tone:'deep'},
 {emoji:'🙂',label:'Tốt',value:4,tone:'teal'},
 {emoji:'😐',label:'Bình thường',value:3,tone:'amber'},
 {emoji:'😔',label:'Không tốt',value:2,tone:'terra'},
 {emoji:'😢',label:'Rất tệ',value:1,tone:'lavender'},
]
const ENTRIES=[
 {id:1,date:'2026-08-13',time:'20:30',mood:4,content:'Hôm nay làm việc hiệu quả, hoàn thành được 3 task quan trọng. Buổi tối đi bộ 30 phút, cảm thấy thoải mái hơn.',tags:['work','exercise']},
 {id:2,date:'2026-08-12',time:'21:15',mood:3,content:'Ngày bình thường, có chút áp lực deadline nhưng vẫn kiểm soát được. Ngủ trưa 20 phút giúp tỉnh táo hơn.',tags:['work','sleep']},
 {id:3,date:'2026-08-11',time:'19:45',mood:5,content:'Gặp bạn bè sau một thời gian dài, cười rất nhiều. Cảm giác được kết nối lại thật tuyệt vời!',tags:['social','happy']},
]
const topicCounts=[['work',8],['exercise',5],['sleep',4],['social',3],['happy',3]]

export default function JournalPage(){
 const [showForm,setShowForm]=useState(false),[selectedMood,setSelectedMood]=useState<number|null>(null),[content,setContent]=useState('')
 return <div className="journal-page">
  <header className="journal-hero"><div><span className="journal-eyebrow">Nhật ký cá nhân</span><h1>Nhật ký cảm xúc</h1><p>Ghi lại hành trình của bạn mỗi ngày.</p></div><button className="journal-new" onClick={()=>setShowForm(!showForm)} aria-expanded={showForm}><span>{showForm?'×':'+'}</span>{showForm?'Thu gọn':'Viết nhật ký'}</button></header>
  <AnimatePresence initial={false}>{showForm&&<motion.section className="journal-composer" initial={{opacity:0,y:-12,height:0}} animate={{opacity:1,y:0,height:'auto'}} exit={{opacity:0,y:-8,height:0}} transition={{duration:.3}}>
   <div className="journal-composer-head"><div><span>Check-in hôm nay</span><h2>Bạn đang cảm thấy thế nào?</h2></div><small>14 tháng 8, 2026</small></div>
   <div className="journal-moods">{MOODS.map(mood=><button key={mood.value} className={`${mood.tone} ${selectedMood===mood.value?'selected':''}`} onClick={()=>setSelectedMood(mood.value)} aria-pressed={selectedMood===mood.value}><span>{mood.emoji}</span><small>{mood.label}</small></button>)}</div>
   <label className="journal-field"><span>Ghi chú của bạn</span><textarea value={content} onChange={e=>setContent(e.target.value)} placeholder="Viết về ngày của bạn... Điều gì khiến bạn cảm thấy như vậy?"/></label>
   <div className="journal-composer-actions"><button className="btn-primary">Lưu nhật ký</button><button className="btn-ghost" onClick={()=>setShowForm(false)}>Hủy</button><span>{content.length}/1000</span></div>
  </motion.section>}</AnimatePresence>
  <div className="journal-layout">
   <section className="journal-stream" aria-label="Các nhật ký gần đây"><div className="journal-section-head"><div><span>Dòng thời gian</span><h2>Những ngày gần đây</h2></div><span className="journal-period">Tháng 8</span></div><div className="journal-timeline">
    {ENTRIES.map((entry,index)=>{const mood=MOODS.find(item=>item.value===entry.mood)!;return <motion.article className="journal-entry" key={entry.id} initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} transition={{delay:index*.08}}>
     <div className={`journal-node ${mood.tone}`}><span>{mood.emoji}</span></div><div className="journal-entry-card"><header><div><h3>{new Date(`${entry.date}T12:00:00`).toLocaleDateString('vi-VN',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</h3><p><span>◷</span>{entry.time}</p></div><span className={`journal-mood ${mood.tone}`}>{mood.label}</span></header><p className="journal-copy">{entry.content}</p><footer>{entry.tags.map(tag=><span key={tag}>#{tag}</span>)}</footer></div>
    </motion.article>})}
   </div></section>
   <aside className="journal-insights">
    <section className="journal-month"><span className="journal-orb"/><header><span>Tổng quan</span><h2>Tháng 8</h2></header><div><article><small>Số ngày ghi</small><strong>14<em>/31</em></strong><span>45% tháng này</span></article><article><small>Cảm xúc nổi bật</small><strong className="mood">🙂 <em>Tốt</em></strong><span>Xu hướng tích cực</span></article></div><div className="journal-progress"><i/></div>
    </section>
    <section className="journal-topics"><header><span>Chủ đề</span><h2>Thường xuất hiện</h2></header><div>{topicCounts.map(([topic,count],index)=><span className={index===0?'active':''} key={topic}>#{topic}<b>{count}</b></span>)}</div></section>
    <section className="journal-prompt"><span>✶</span><div><small>Gợi ý hôm nay</small><p>Điều gì đã mang lại cho bạn một khoảnh khắc bình yên?</p></div><button onClick={()=>setShowForm(true)} aria-label="Viết theo gợi ý">→</button></section>
   </aside>
  </div>
 </div>
}
