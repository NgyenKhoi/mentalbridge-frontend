import { connection } from 'next/server'
import { HomeHub } from '@/features/home/HomeHub'
import '../dashboard-page.css'

export default async function DashboardPage() {
  await connection()
  return <HomeHub />
}
