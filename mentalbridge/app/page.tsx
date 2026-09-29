import Header from '@/components/Header'
import Hero from '@/components/Hero'
import Showcase from '@/components/Showcase'
import Barriers from '@/components/Barriers'
import Journey from '@/components/Journey'
import Features from '@/components/Features'
import RiskLevels from '@/components/RiskLevels'
import Cta from '@/components/Cta'
import Footer from '@/components/Footer'
import ScrollReveal from '../components/ScrollReveal'
import Preloader from '@/components/Preloader'
import { cookies } from 'next/headers'
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
} from '@/lib/auth/session-cookies'

export default async function Home() {
  const cookieStore = await cookies()
  const hasSessionHint =
    cookieStore.has(ACCESS_COOKIE_NAME) || cookieStore.has(REFRESH_COOKIE_NAME)

  return (
    <>
      <Preloader />
      <a className="skip-link" href="#top">
        Bỏ qua đến nội dung chính
      </a>
      <Header hasSessionHint={hasSessionHint} />
      <main id="top" className="marketing-page">
        <Hero />
        <Showcase />
        <Barriers />
        <Journey />
        <Features />
        <RiskLevels />
        <Cta />
      </main>
      <Footer />
      <ScrollReveal />
    </>
  )
}
