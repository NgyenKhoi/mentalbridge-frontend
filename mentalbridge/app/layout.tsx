import type { Metadata } from 'next'
import { Be_Vietnam_Pro, Fraunces, Lora } from 'next/font/google'
import CrisisSupportWidget from '../components/crisis-support/CrisisSupportWidget'
import MotionPreferences from '../components/motion/MotionPreferences'
import SmoothScroll from '../components/SmoothScroll'
import { Providers } from './providers'
import './globals.css'
import './theme-sync.css'

const fraunces = Fraunces({
  subsets: ['latin', 'vietnamese'],
  weight: ['300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-fraunces-variable',
  display: 'swap',
})

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-be-vietnam-variable',
  display: 'swap',
})

const lora = Lora({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-lora-variable',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'MentalBridge — Cây cầu đến sự an yên',
  description:
    'Nền tảng sàng lọc sức khỏe tâm thần, đồng hành riêng tư và thấu cảm.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="vi">
      <body
        className={`${fraunces.variable} ${beVietnamPro.variable} ${lora.variable}`}
      >
        <div className="ambient-bg" aria-hidden="true">
          <div className="ambient-blob b1"></div>
          <div className="ambient-blob b2"></div>
          <div className="ambient-blob b3"></div>
        </div>
        <MotionPreferences>
          <Providers>{children}</Providers>
        </MotionPreferences>
        <CrisisSupportWidget />
        <SmoothScroll />
      </body>
    </html>
  )
}
