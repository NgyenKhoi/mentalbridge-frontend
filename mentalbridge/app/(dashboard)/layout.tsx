'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import './dashboard.css'
import './subscription/subscription.css'
import './dashboard-shell.css'

const Svg=({children}:{children:React.ReactNode})=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
const groups=[
 {title:'Tổng quan',items:[['/dashboard','Dashboard',<Svg key="h"><path d="M4 11 12 4l8 7M6 9.5V20h12V9.5"/></Svg>],['/journal','Journal',<Svg key="j"><path d="M6 3h9l3 3v15H6V3Z"/><path d="M9 9h6M9 13h6M9 17h3"/></Svg>],['/assessments','Assessments',<Svg key="a"><path d="m5 13 4 4L19 7"/></Svg>]]},
 {title:'Chăm sóc',items:[['/specialists','Specialists',<Svg key="s"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 20c1-3.5 3.3-5.3 5.5-5.3S14 16.5 15 20M17 6.2a2.3 2.3 0 1 1 0 4.6"/></Svg>],['/appointments','Appointments',<Svg key="c"><rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M8 3v4M16 3v4M4 10h16"/></Svg>],['/messages','Messages',<Svg key="m"><path d="M4 5h16v11H8l-4 4V5Z"/></Svg>,'3']]},
 {title:'Thông tin',items:[['/resources','Resources',<Svg key="r"><circle cx="12" cy="12" r="8.5"/><path d="M12 8v4l3 2"/></Svg>],['/analytics','Analytics',<Svg key="n"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></Svg>],['/subscription','Subscription',<Svg key="p"><rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M3 10h18"/></Svg>],['/notifications','Notifications',<Svg key="b"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/></Svg>]]}
]
const labels:Record<string,string>={'/dashboard':'Tổng quan','/journal':'Nhật ký','/assessments':'Đánh giá','/specialists':'Chuyên gia','/appointments':'Lịch hẹn','/messages':'Tin nhắn','/resources':'Tài nguyên','/analytics':'Phân tích','/subscription':'Gói dịch vụ','/notifications':'Thông báo','/profile':'Tài khoản'}

export default function DashboardLayout({children}:{children:React.ReactNode}){
 const pathname=usePathname(),router=useRouter();const [collapsed,setCollapsed]=useState(false),[mobile,setMobile]=useState(false)
 const logout=()=>{localStorage.removeItem('mentalbridge_session');sessionStorage.removeItem('mentalbridge_session');router.replace('/login')}
 return <div className={`ref-shell ${collapsed?'collapsed':''} ${mobile?'mobile-open':''}`}>
  <aside className="ref-sidebar">
   <div className="ref-brand"><Link href="/" aria-label="MentalBridge"><Svg><path d="M12 2C7 2 3 5 3 9.5c0 3 2 5 4 6.2V21l3-1.6c.7.1 1.3.2 2 .2 5 0 9-3 9-7.6S17 2 12 2Z"/></Svg></Link><div><b>MentalBridge</b><span>Health Tech</span></div><button onClick={()=>setCollapsed(!collapsed)} aria-label={collapsed?'Mở rộng sidebar':'Thu gọn sidebar'}>{collapsed?'›':'‹'}</button></div>
   <nav aria-label="Điều hướng chính">{groups.map(g=><section key={g.title}><h2>{g.title}</h2>{g.items.map(item=><Link key={item[0] as string} href={item[0] as string} onClick={()=>setMobile(false)} className={pathname===item[0]?'active':''} title={collapsed?item[1] as string:undefined}><i>{item[2]}</i><span>{item[1]}</span>{item[3]&&<b>{item[3]}</b>}</Link>)}</section>)}</nav>
   <div className="ref-sidebar-foot"><Link href="/profile" className={pathname==='/profile'?'active':''}><i><Svg><circle cx="12" cy="8" r="3.4"/><path d="M4.5 20c1.2-4 4-6 7.5-6s6.3 2 7.5 6"/></Svg></i><span>Profile &amp; Privacy</span></Link><div className="ref-user"><span className="ref-user-avatar">N</span><div><strong>Người dùng</strong><button onClick={logout}>Đăng xuất</button></div></div></div>
  </aside>
  <div className="ref-main"><header className="ref-topbar"><button className="ref-mobile" onClick={()=>setMobile(true)} aria-label="Mở menu"><Svg><path d="M4 7h16M4 12h16M4 17h16"/></Svg></button><div className="ref-context"><span>Workspace</span><strong>{labels[pathname]??'MentalBridge'}</strong></div><label><Svg><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></Svg><input type="search" placeholder="Tìm kiếm chuyên gia, nhật ký..."/><kbd>⌘ K</kbd></label><div className="ref-top-actions"><Link href="/notifications" className="ref-notify" aria-label="3 thông báo"><Svg><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/></Svg><b>3</b></Link><Link href="/profile" className="ref-avatar" aria-label="Hồ sơ người dùng">N</Link></div></header><main className={`ref-content ${pathname==='/dashboard'?'ref-content-dashboard':'ref-content-page'}`}>{children}</main></div>
  {mobile&&<button className="ref-overlay" onClick={()=>setMobile(false)} aria-label="Đóng menu"/>}
 </div>
}
