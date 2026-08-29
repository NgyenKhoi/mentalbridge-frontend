import Header from '@/components/Header'
import Hero from '@/components/Hero'
import Showcase from '@/components/Showcase'
import Barriers from '@/components/Barriers'
import Journey from '@/components/Journey'
import Features from '@/components/Features'
import RiskLevels from '@/components/RiskLevels'
import Hotline from '@/components/Hotline'
import Cta from '@/components/Cta'
import Footer from '@/components/Footer'
import ScrollReveal from '../components/ScrollReveal'
import Preloader from '@/components/Preloader'

export default function Home() {
  return (
    <>
      <Preloader />
      <a className="skip-link" href="#top">Bỏ qua đến nội dung chính</a>
      <Header />
      <main id="top" className="marketing-page">
        <Hero />
        <Showcase />
        <Barriers />
        <Journey />
        <Features />
        <RiskLevels />
        <Hotline />
        <Cta />
      </main>
      <Footer />
      <ScrollReveal />
    </>
  )
}
