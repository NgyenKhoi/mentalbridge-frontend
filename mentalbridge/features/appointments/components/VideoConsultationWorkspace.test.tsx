import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { VideoConsultationWorkspace } from './VideoConsultationWorkspace'

vi.mock('./VideoConsultationPanel', () => ({
  VideoSessionPanel: ({ role }: { role: string }) => (
    <section aria-label="Cuộc gọi tư vấn">{role}</section>
  ),
}))
vi.mock('./SpecialistConsultationBrief', () => ({
  SpecialistConsultationBrief: () => (
    <button>Xem tóm tắt được phê duyệt</button>
  ),
}))
const id = '10000000-0000-4000-8000-000000000001'
describe('dedicated appointment consultation workspace', () => {
  it('keeps User room and preparation linked to the same appointment', () => {
    render(<VideoConsultationWorkspace appointmentId={id} role="USER" />)
    expect(
      screen.getByRole('heading', { name: 'Phòng tư vấn video', level: 1 }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: 'Cuộc gọi tư vấn' }),
    ).toHaveTextContent('USER')
    expect(
      screen.getByRole('link', { name: 'Trở về lịch hẹn' }),
    ).toHaveAttribute('href', `/appointments/${id}`)
    expect(
      screen.getByRole('link', {
        name: 'Xem nội dung chuẩn bị trong lịch hẹn',
      }),
    ).toHaveAttribute('href', `/appointments/${id}`)
    expect(
      screen.queryByText('Xem tóm tắt được phê duyệt'),
    ).not.toBeInTheDocument()
  })
  it('preserves the assigned Specialist return context and existing approved brief boundary', () => {
    render(<VideoConsultationWorkspace appointmentId={id} role="SPECIALIST" />)
    expect(
      screen.getByRole('region', { name: 'Cuộc gọi tư vấn' }),
    ).toHaveTextContent('SPECIALIST')
    expect(
      screen.getByRole('link', { name: 'Trở về lịch hẹn' }),
    ).toHaveAttribute('href', `/specialist/appointments?appointmentId=${id}`)
    expect(
      screen.getByRole('button', { name: 'Xem tóm tắt được phê duyệt' }),
    ).toBeInTheDocument()
  })
})
