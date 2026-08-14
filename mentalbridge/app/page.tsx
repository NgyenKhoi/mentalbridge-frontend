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
import ScrollReveal from '@/components/ScrollReveal'

export default function Home() {
  return (
    <>
      <Header />
      <main id="top">
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
