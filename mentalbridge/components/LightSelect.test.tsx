import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import LightSelect from './LightSelect'

const options = [
  { value: 'weekly', label: 'Theo tuần' },
  { value: 'daily', label: 'Mỗi ngày' },
  { value: 'once', label: 'Một lần' },
]

function fixture(onChange = vi.fn(), disabled = false) {
  render(
    <>
      <label id="rhythm-label" htmlFor="rhythm">
        Nhịp hoạt động
      </label>
      <LightSelect
        id="rhythm"
        labelledBy="rhythm-label"
        options={options}
        defaultValue="weekly"
        onChange={onChange}
        disabled={disabled}
      />
      <button type="button">Tiếp theo</button>
    </>,
  )
  return onChange
}

describe('LightSelect', () => {
  it('bounds its popup to a scrolling dialog body rather than the window', async () => {
    const user = userEvent.setup()
    const rect = (top: number, bottom: number) =>
      ({
        top,
        bottom,
        left: 0,
        right: 300,
        width: 300,
        height: bottom - top,
        x: 0,
        y: top,
        toJSON() {},
      }) as DOMRect
    const geometry = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        if (this.dataset.scrollBoundary) return rect(100, 370)
        if (this.classList.contains('light-select-trigger'))
          return rect(260, 310)
        if (this.classList.contains('light-select-menu')) return rect(316, 516)
        return rect(0, 0)
      })
    try {
      render(
        <div data-scroll-boundary="true" style={{ overflowY: 'auto' }}>
          <LightSelect id="bounded" options={options} defaultValue="weekly" />
        </div>,
      )
      await user.click(screen.getByRole('combobox'))
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toHaveClass('opens-up')
        expect(screen.getByRole('listbox')).toHaveStyle({ maxHeight: '154px' })
      })
    } finally {
      geometry.mockRestore()
    }
  })

  it('labels the control, navigates options with keys and returns focus on selection', async () => {
    const user = userEvent.setup()
    const onChange = fixture()
    const trigger = screen.getByRole('combobox', { name: 'Nhịp hoạt động' })
    await user.tab()
    expect(trigger).toHaveFocus()
    await user.keyboard('{ArrowDown}{End}{Home}{ArrowDown}{Enter}')
    expect(onChange).toHaveBeenCalledWith('daily')
    expect(trigger).toHaveTextContent('Mỗi ngày')
    expect(trigger).toHaveFocus()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('supports pointer choice, typeahead, Escape and Tab without trapping focus', async () => {
    const user = userEvent.setup()
    const onChange = fixture()
    const trigger = screen.getByRole('combobox')
    await user.click(trigger)
    await user.click(screen.getByRole('option', { name: 'Một lần' }))
    expect(trigger).toHaveFocus()
    expect(onChange).toHaveBeenLastCalledWith('once')
    await user.keyboard('T')
    expect(screen.getByRole('option', { name: 'Theo tuần' })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(trigger).toHaveFocus()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    await user.click(trigger)
    await user.tab()
    expect(screen.getByRole('button', { name: 'Tiếp theo' })).toHaveFocus()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('does not open or submit when disabled', async () => {
    const user = userEvent.setup()
    const onChange = fixture(vi.fn(), true)
    const trigger = screen.getByRole('combobox')
    expect(trigger).toBeDisabled()
    await user.click(trigger)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Tiếp theo' })).toHaveFocus()
  })

  it('closes an open menu when disabled and does not reopen when enabled again', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <LightSelect id="rhythm" options={options} defaultValue="weekly" />,
    )
    await user.click(screen.getByRole('combobox'))
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    rerender(
      <LightSelect
        id="rhythm"
        options={options}
        defaultValue="weekly"
        disabled
      />,
    )
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox')).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    rerender(
      <LightSelect id="rhythm" options={options} defaultValue="weekly" />,
    )
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    await user.click(screen.getByRole('combobox'))
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })
})
