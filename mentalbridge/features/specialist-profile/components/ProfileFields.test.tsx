import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { approvedProfile } from '@/tests/fixtures/profile-amendment'
import ProfileFields from './ProfileFields'
import { ProfileChecklist } from './ProfilePresentation'
import { profileFormValue } from './profile-form'

function Editor({
  years = 0,
  disabled = false,
}: {
  years?: number
  disabled?: boolean
}) {
  const [value, setValue] = useState({
    ...profileFormValue(approvedProfile),
    yearsOfExperience: years,
  })
  return (
    <>
      <ProfileFields value={value} onChange={setValue} disabled={disabled} />
      <ProfileChecklist value={value} />
    </>
  )
}

describe('prototype profile controls', () => {
  afterEach(() => vi.unstubAllGlobals())

  it.each([false, true])(
    'replays the number bounce only when reduced motion is %s',
    async (reduced) => {
      vi.stubGlobal(
        'matchMedia',
        vi.fn(() => ({ matches: reduced })),
      )
      const user = userEvent.setup()
      render(<Editor years={4} />)
      const input = screen.getByRole('spinbutton', {
        name: 'Số năm kinh nghiệm',
      })
      const cancel = vi.fn()
      const animate = vi.fn().mockReturnValue({ cancel })
      input.animate = animate
      await user.click(
        screen.getByRole('button', { name: 'Tăng năm kinh nghiệm' }),
      )
      expect(input).toHaveValue(5)
      if (reduced) expect(animate).not.toHaveBeenCalled()
      else
        expect(animate).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              transform: 'scale(1.28) translateY(-2px)',
            }),
          ]),
          expect.objectContaining({ duration: 300 }),
        )
      await user.click(
        screen.getByRole('button', { name: 'Giảm năm kinh nghiệm' }),
      )
      expect(input).toHaveValue(4)
      if (!reduced) {
        expect(animate).toHaveBeenCalledTimes(2)
        expect(cancel).toHaveBeenCalled()
      }
    },
  )

  it('supports bounded stepper and typed input, counting zero as a valid year', async () => {
    const user = userEvent.setup()
    render(<Editor />)
    const years = screen.getByRole('spinbutton', { name: 'Số năm kinh nghiệm' })
    expect(
      screen.getByRole('button', { name: 'Giảm năm kinh nghiệm' }),
    ).toBeDisabled()
    expect(
      within(
        screen.getByRole('region', { name: 'Mức độ hoàn thiện' }),
      ).getByText('6/6 mục đã điền'),
    ).toBeVisible()
    await user.click(
      screen.getByRole('button', { name: 'Tăng năm kinh nghiệm' }),
    )
    expect(years).toHaveValue(1)
    await user.clear(years)
    await user.type(years, '80')
    expect(
      screen.getByRole('button', { name: 'Tăng năm kinh nghiệm' }),
    ).toBeDisabled()
    await user.clear(years)
    expect(
      within(
        screen.getByRole('region', { name: 'Mức độ hoàn thiện' }),
      ).getByText('5/6 mục đã điền'),
    ).toBeVisible()
  })
  it('edits plain-text paragraphs and lists with restored caret, and expands the editor', async () => {
    const user = userEvent.setup()
    render(<Editor />)
    const bio = screen.getByRole('textbox', {
      name: 'Giới thiệu',
    }) as HTMLTextAreaElement
    await user.click(bio)
    bio.setSelectionRange(bio.value.length, bio.value.length)
    await user.click(screen.getByRole('button', { name: 'Thêm gạch đầu dòng' }))
    expect(bio).toHaveValue(approvedProfile.bio + '\n• ')
    expect(bio).toHaveFocus()
    await user.type(bio, 'Lắng nghe')
    await user.click(screen.getByRole('button', { name: 'Thêm đoạn mới' }))
    expect(bio.value).toContain('Lắng nghe\n\n')
    await user.click(
      screen.getByRole('button', { name: 'Mở rộng ô giới thiệu' }),
    )
    expect(bio).toHaveAttribute('rows', '12')
    expect(bio).toHaveStyle({ resize: 'none' })
  })
  it('supports keyboard choice toggling and recalculates the checklist from current values', async () => {
    const user = userEvent.setup()
    render(<Editor />)
    const language = screen.getByRole('checkbox', { name: 'Tiếng Việt' })
    language.focus()
    await user.keyboard(' ')
    expect(language).not.toBeChecked()
    expect(
      within(
        screen.getByRole('region', { name: 'Mức độ hoàn thiện' }),
      ).getByText('5/6 mục đã điền'),
    ).toBeVisible()
    await user.clear(screen.getByLabelText('Múi giờ'))
    await user.type(screen.getByLabelText('Múi giờ'), 'Mars/Unknown')
    expect(
      within(
        screen.getByRole('region', { name: 'Mức độ hoàn thiện' }),
      ).getByText('4/6 mục đã điền'),
    ).toBeVisible()
  })
  it('keeps all write controls disabled on a read-only profile', () => {
    render(<Editor disabled />)
    expect(screen.getByRole('textbox', { name: 'Tên hiển thị' })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: 'Lo âu' })).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Tăng năm kinh nghiệm' }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Thêm gạch đầu dòng' }),
    ).toBeDisabled()
  })
})
