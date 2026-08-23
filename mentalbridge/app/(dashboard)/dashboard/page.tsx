'use client'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import PlanGate, { type PlanId } from '@/components/PlanGate'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import '../dashboard-page.css'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}
const moods=[['😌','Thư giãn'],['😊','Ổn định'],['😄','Vui vẻ'],['🥱','Mệt mỏi'],['😟','Lo lắng']]
const tasks=['Viết nhật ký hôm nay','Hoàn thành bài tập thở','Đánh giá tâm trạng tuần này']
const SmallIcon=({type}:{type:'note'|'check'|'user'})=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{type==='note'?<><path d="M6 3h9l3 3v15H6V3Z"/><path d="M9 9h6M9 13h6M9 17h3"/></>:type==='check'?<path d="m5 13 4 4L19 7"/>:<><circle cx="9" cy="8" r="3.2"/><path d="M3.5 20c1-3.5 3.3-5.3 5.5-5.3S14 16.5 15 20"/></>}</svg>

export default function DashboardPage(){
  const [mood,setMood]=useState(1)
  const [done,setDone]=useState<number[]>([])
  const [plan,setPlan]=useState<PlanId>('free')
  const heroRef = useRef<HTMLElement>(null)
  const bentoRef = useRef<HTMLElement>(null)
  const todayRef = useRef<HTMLElement>(null)
  const quickRef = useRef<HTMLElement>(null)
  const streakRef = useRef<HTMLElement>(null)

  useEffect(()=>{
    const timer=window.setTimeout(()=>{
      const saved=localStorage.getItem('mentalbridge_plan')
      if(saved==='plus'||saved==='premium')setPlan(saved)
    },0)
    return()=>window.clearTimeout(timer)
  },[])

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) return

    const ctx = gsap.context(() => {
      // Hero entrance
      gsap.from(heroRef.current, {
        opacity: 0,
        y: 30,
        duration: 0.8,
        ease: 'power3.out'
      })

      // Bento cards stagger
      if (bentoRef.current) {
        gsap.from(bentoRef.current.querySelectorAll('.ref-card'), {
          scrollTrigger: {
            trigger: bentoRef.current,
            start: 'top 80%',
            toggleActions: 'play none none reverse'
          },
          opacity: 0,
          y: 40,
          duration: 0.6,
          stagger: 0.15,
          ease: 'power2.out'
        })
      }

      // Today section
      if (todayRef.current) {
        gsap.from(todayRef.current.querySelectorAll('.ref-card'), {
          scrollTrigger: {
            trigger: todayRef.current,
            start: 'top 80%',
            toggleActions: 'play none none reverse'
          },
          opacity: 0,
          y: 40,
          duration: 0.6,
          stagger: 0.2,
          ease: 'power2.out'
        })
      }

      // Quick actions
      if (quickRef.current) {
        gsap.from(quickRef.current.querySelector('header'), {
          scrollTrigger: {
            trigger: quickRef.current,
            start: 'top 80%',
            toggleActions: 'play none none reverse'
          },
          opacity: 0,
          y: 20,
          duration: 0.5,
          ease: 'power2.out'
        })

        gsap.from(quickRef.current.querySelectorAll('a'), {
          scrollTrigger: {
            trigger: quickRef.current,
            start: 'top 80%',
            toggleActions: 'play none none reverse'
          },
          opacity: 0,
          y: 30,
          duration: 0.6,
          stagger: 0.12,
          ease: 'back.out(1.2)'
        })
      }

      // Streak banner
      if (streakRef.current) {
        gsap.from(streakRef.current, {
          scrollTrigger: {
            trigger: streakRef.current,
            start: 'top 85%',
            toggleActions: 'play none none reverse'
          },
          opacity: 0,
          scale: 0.95,
          y: 20,
          duration: 0.6,
          ease: 'back.out(1.4)'
        })
      }
    })

    return () => ctx.revert()
  }, [])

  const toggle=(i:number)=>setDone(v=>v.includes(i)?v.filter(x=>x!==i):[...v,i])
  
  return <div className="ref-dashboard">
 <section ref={heroRef} className="ref-hero"><div><p><i/>Thứ Sáu, 14 tháng 8 năm 2026</p><h1>Chào buổi sáng, Người dùng 👋</h1><span>Hôm nay bạn cảm thấy thế nào?</span></div><div className="ref-streak">🔥<b>7 ngày<small>liên tiếp</small></b></div></section>
 <section ref={bentoRef} className="ref-bento"><article className="ref-card ref-mood"><header><div><h2>Cảm xúc hôm nay</h2><p>Chọn cảm xúc phù hợp nhất</p></div><i aria-hidden="true">🙂</i></header><div>{moods.map((x,i)=><button type="button" key={x[1]} onClick={()=>setMood(i)} className={mood===i?'active':''} aria-label={x[1]} aria-pressed={mood===i}>{x[0]}</button>)}</div><footer>Bạn đang cảm thấy <b>{moods[mood][1]}</b><Link href="/journal">Viết thêm →</Link></footer></article><article className="ref-card ref-result"><header><h2>Kết quả sàng lọc</h2><i aria-hidden="true">✓</i></header><p>PHQ-9 hiện tại</p><strong>Nhẹ</strong><span>↓ Giảm 30% so với tháng trước</span></article><PlanGate currentPlan={plan} required="plus" title="Phân tích xu hướng chi tiết"><article className="ref-card ref-trend"><header><h2>Xu hướng 7 ngày</h2><i aria-hidden="true">📈</i></header><div role="img" aria-label="Biểu đồ xu hướng cảm xúc trong 7 ngày">{[52,68,38,28,46,60,74].map((h,i)=><b key={i} aria-hidden="true" className={[1,5,6].includes(i)?'high':''} style={{height:`${h}%`}}/>)}</div><footer><span>T2</span><span>CN</span></footer></article></PlanGate></section>
 <section ref={todayRef} className="ref-today"><PlanGate currentPlan={plan} required="premium" title="Lịch hẹn ưu tiên"><article className="ref-card ref-appointment"><header><h2>Lịch hẹn sắp tới</h2><Link href="/appointments">Xem tất cả →</Link></header><div><b>BS</b><p><strong>Bs. Nguyễn Văn A</strong><span>Thứ 6, 15/08 · 10:00 AM</span></p><i>SẮP TỚI</i></div><footer>Không có lịch hẹn nào khác</footer></article></PlanGate><article className="ref-card ref-tasks"><header><h2>Nhiệm vụ hôm nay</h2><b>{done.length}/3</b></header>{tasks.map((task,i)=><button type="button" key={task} onClick={()=>toggle(i)} className={done.includes(i)?'done':''} aria-pressed={done.includes(i)}><i aria-hidden="true">{done.includes(i)?'✓':''}</i>{task}</button>)}</article></section>
 <section ref={quickRef} className="ref-quick"><header><h2>Hành động nhanh</h2><span>Những việc bạn có thể làm ngay</span></header><div><Link href="/journal" className="primary"><i><SmallIcon type="note"/></i><p><b>Viết nhật ký</b><span>Ghi lại cảm xúc và suy nghĩ hôm nay</span></p><strong>→</strong></Link><Link href="/assessments"><i><SmallIcon type="check"/></i><p><b>Làm bài đánh giá</b><span>PHQ-9, GAD-7 và các bài kiểm tra</span></p></Link><Link href="/specialists"><i className="amber"><SmallIcon type="user"/></i><p><b>Tìm chuyên gia</b><span>2 chuyên gia phù hợp với bạn</span></p></Link></div></section>
 <section ref={streakRef} className="ref-journal-streak"><i>📖</i><p><b>Chuỗi viết nhật ký</b><span>Bạn đã duy trì được 7 ngày liên tiếp!</span></p><strong>🔥 7 ngày</strong></section>
 </div>
}
