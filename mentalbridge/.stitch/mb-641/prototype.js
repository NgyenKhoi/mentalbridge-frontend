;(() => {
  const key = 'mb641-prototype-v1'
  const ids = {
    occurrenceId: '11111111-1111-4111-8111-111111111641',
    actionId: '22222222-2222-4222-8222-222222222641',
  }
  const initial = () => ({
    sourceState: 'MISSING',
    accepted: false,
    version: 0,
    completedAt: null,
    reconcileCount: 0,
    saveCount: 0,
    unavailable: false,
    saveError: false,
    mismatch: false,
    preactivation: false,
    removed: false,
    planStatus: 'ACTIVE',
    selectedEmotion: null,
    selectedIntensity: null,
  })
  let state
  try {
    state = JSON.parse(localStorage.getItem(key)) ?? initial()
  } catch {
    state = initial()
  }
  const persist = () => localStorage.setItem(key, JSON.stringify(state))
  const route = document.body.dataset.route
  let busy = false
  const action = document.querySelector('#activity-A')
  const $ = (s) => document.querySelector(s)
  const delay = () => new Promise((resolve) => setTimeout(resolve, 280))
  const params = new URLSearchParams(location.search)
  const originValid =
    params.get('occurrenceId') === ids.occurrenceId &&
    params.get('actionId') === ids.actionId
  const link = (page, returned = false) =>
    `${page}-prototype.html?occurrenceId=${ids.occurrenceId}&actionId=${ids.actionId}${returned ? '&returned=1' : ''}#${page === 'dashboard' ? 'canonical-check-in' : 'activity-A'}`
  const render = () => {
    if (route === 'support-plan') {
      $('[data-outcome]').classList.toggle('is-completed', state.accepted)
      $('[data-outcome] span').textContent = state.accepted
        ? 'Đã ghi nhận hoàn thành'
        : 'Chưa ghi nhận hoàn thành'
      $('[data-start]').href = link('dashboard')
      $('[data-start]').hidden = state.accepted || state.removed
      $('[data-reconcile]').hidden = state.removed
      $('[data-reconcile]').disabled = busy || state.planStatus !== 'ACTIVE'
      $('[data-start]').className =
        params.get('returned') === '1' ? 'btn btn-outline' : 'btn btn-primary'
      $('[data-reconcile]').className =
        params.get('returned') === '1' && !state.accepted
          ? 'btn btn-primary'
          : 'btn btn-outline'
      if (params.get('returned') === '1') {
        $('[data-origin-note]').textContent = originValid
          ? 'Bạn vừa quay lại từ ghi nhận cảm xúc. Kiểm tra để biết hoạt động này đã được ghi nhận chưa.'
          : 'Không xác định được hoạt động vừa mở. Quay lại kế hoạch hiện tại để tiếp tục.'
        $('[data-reconcile]').hidden = !originValid
      }
      $('[data-review-status]').textContent =
        state.planStatus === 'DRAFT'
          ? 'Lịch đã được đề xuất. Chỉ bắt đầu khi bạn chọn xác nhận.'
          : 'Kế hoạch đang hoạt động.'
      $('[data-activate]').disabled = state.planStatus !== 'DRAFT' || busy
      $('[data-activate]').textContent =
        state.planStatus === 'ACTIVE'
          ? 'Kế hoạch đã bắt đầu'
          : 'Bắt đầu kế hoạch'
      if (state.removed)
        $('[data-evidence-status]').textContent =
          'Hoạt động này đã thay đổi. Mở kế hoạch hiện tại để chọn hoạt động còn hiệu lực.'
    } else {
      $('.emotion-return-strip').hidden = !originValid
      $('[data-return]').href = link('support-plan', true)
      $('[data-delete-check-in]').hidden = state.sourceState !== 'RECORDED'
      $('button[type="submit"]').disabled =
        busy || !state.selectedEmotion || !state.selectedIntensity
      for (const input of document.querySelectorAll('input[type="radio"]')) {
        const selected =
          input.name === 'emotion'
            ? state.selectedEmotion === input.value
            : String(state.selectedIntensity) === input.value
        input.checked = selected
        input.closest('label').classList.toggle('mb641-selected', selected)
        const base = input.closest('label').className.split(' ')[0]
        const prefix = base.slice(0, base.lastIndexOf('__'))
        input
          .closest('label')
          .classList.toggle(
            `${prefix}__${input.name === 'emotion' ? 'selected' : 'intensitySelected'}`,
            selected,
          )
      }
      if (state.sourceState === 'RECORDED')
        $('[data-return-status]').textContent =
          'Đã lưu ghi nhận cảm xúc. Quay lại để kiểm tra hoạt động trong kế hoạch.'
    }
  }
  document.querySelectorAll('[data-fixture]').forEach((button) =>
    button.addEventListener('click', () => {
      const mode = button.dataset.fixture
      if (mode === 'reset') {
        state = initial()
        persist()
        location.href = 'support-plan-prototype.html'
        return
      }
      if (mode === 'missing') state.sourceState = 'MISSING'
      if (mode === 'deleted') state.sourceState = 'DELETED'
      if (mode === 'unavailable') state.unavailable = true
      if (mode === 'available') {
        state.unavailable = false
        state.saveError = false
        state.mismatch = false
        state.preactivation = false
      }
      if (mode === 'save-error') state.saveError = true
      if (mode === 'mismatch') state.mismatch = true
      if (mode === 'preactivation') {
        state.preactivation = true
        state.sourceState = 'RECORDED'
      }
      if (mode === 'draft') {
        state.planStatus = 'DRAFT'
        state.accepted = false
        state.version = 0
        state.completedAt = null
      }
      if (mode === 'removed') state.removed = true
      persist()
      render()
      $('[data-fixture-status]').textContent = `Fixture: ${mode}`
    }),
  )
  if (route === 'support-plan') {
    document.querySelectorAll('[role="tab"]').forEach((tab) => {
      const select = () => {
        for (const item of document.querySelectorAll('[role="tab"]')) {
          const selected = item === tab
          item.setAttribute('aria-selected', String(selected))
          item.tabIndex = selected ? 0 : -1
          item.classList.toggle('is-active', selected)
          const panel = document.getElementById(
            item.getAttribute('aria-controls'),
          )
          if (panel) {
            panel.classList.toggle('is-hidden', !selected)
            panel.classList.toggle('is-active', selected)
          }
        }
        tab.scrollIntoView({
          block: 'nearest',
          inline: 'nearest',
          behavior: 'instant',
        })
      }
      tab.addEventListener('click', select)
      tab.addEventListener('keydown', (event) => {
        const tabs = [...document.querySelectorAll('[role="tab"]')]
        let i = tabs.indexOf(tab)
        if (event.key === 'ArrowRight') i = (i + 1) % tabs.length
        else if (event.key === 'ArrowLeft')
          i = (i + tabs.length - 1) % tabs.length
        else if (event.key === 'Home') i = 0
        else if (event.key === 'End') i = tabs.length - 1
        else return
        event.preventDefault()
        tabs[i].click()
        tabs[i].focus()
      })
    })
    $('[data-reconcile]').addEventListener('click', async () => {
      if (busy || state.removed || state.planStatus !== 'ACTIVE') return
      busy = true
      action.setAttribute('aria-busy', 'true')
      render()
      const status = $('[data-evidence-status]')
      status.classList.remove('is-error')
      status.textContent = 'Đang kiểm tra ghi nhận…'
      await delay()
      state.reconcileCount++
      if (state.unavailable) {
        status.classList.add('is-error')
        status.textContent =
          'Chưa thể kiểm tra ghi nhận. Trạng thái trước đó vẫn được giữ. Bạn có thể thử lại.'
      } else if (state.mismatch || state.preactivation) {
        status.classList.add('is-error')
        status.textContent = state.mismatch
          ? 'Ghi nhận không cùng múi giờ với hoạt động này. Lịch sử hoạt động vẫn được giữ.'
          : 'Ghi nhận được lưu trước khi kế hoạch bắt đầu nên chưa thể dùng cho hoạt động này.'
      } else if (state.sourceState === 'RECORDED') {
        if (!state.accepted) {
          state.accepted = true
          state.version++
          state.completedAt = '2026-10-13T12:02:00Z'
        }
        status.textContent =
          'Đã kiểm tra: hoạt động này đã được ghi nhận hoàn thành.'
        action.classList.remove('is-updated')
        void action.offsetWidth
        action.classList.add('is-updated')
      } else if (state.sourceState === 'DELETED')
        status.textContent = state.accepted
          ? 'Ghi nhận cảm xúc đã được xóa. Hoạt động đã được ghi nhận trước khi xóa vẫn giữ nguyên.'
          : 'Ghi nhận của ngày này đã được xóa. Chưa ghi nhận hoàn thành hoạt động.'
      else
        status.textContent = state.accepted
          ? 'Không còn ghi nhận cảm xúc cho ngày này. Lịch sử hoạt động đã ghi nhận vẫn giữ nguyên.'
          : 'Chưa có ghi nhận cảm xúc cho ngày này. Hoạt động vẫn chưa hoàn thành.'
      persist()
      busy = false
      action.removeAttribute('aria-busy')
      render()
      $('[data-reconcile]').textContent = state.unavailable
        ? 'Thử lại'
        : 'Kiểm tra ghi nhận'
    })
    $('[data-activate]').addEventListener('click', async () => {
      if (busy || state.planStatus !== 'DRAFT') return
      busy = true
      render()
      $('[data-review-status]').textContent = 'Đang bắt đầu kế hoạch…'
      await delay()
      state.planStatus = 'ACTIVE'
      persist()
      busy = false
      render()
      $('#tab-today').click()
    })
    $('[data-progress-retry]').addEventListener('click', () => {
      $('[data-progress-status]').textContent = state.unavailable
        ? 'Chưa tải được ghi nhận cảm xúc. Dữ liệu đang hiển thị vẫn được giữ.'
        : 'Đã tải lại số ngày có ghi nhận.'
    })
    $('[data-other-details]').addEventListener('click', () => {
      $('#activity-B p').textContent =
        'Bài đọc này không bị thay đổi bởi việc kiểm tra cảm xúc.'
    })
    if (params.get('returned') === '1' && originValid) {
      requestAnimationFrame(() => {
        $('#activity-title-A').focus()
        action.scrollIntoView({ block: 'center', behavior: 'instant' })
      })
    }
  } else {
    document.querySelectorAll('input[type="radio"]').forEach((input) =>
      input.addEventListener('change', () => {
        if (input.name === 'emotion') state.selectedEmotion = input.value
        else state.selectedIntensity = Number(input.value)
        persist()
        render()
      }),
    )
    $('form').addEventListener('submit', async (event) => {
      event.preventDefault()
      if (busy || !state.selectedEmotion || !state.selectedIntensity) return
      busy = true
      render()
      $('[data-check-in-status]').textContent = 'Đang lưu ghi nhận…'
      await delay()
      if (state.saveError)
        $('[data-check-in-status]').textContent =
          'Chưa thể lưu thay đổi. Lựa chọn của bạn vẫn được giữ để thử lại.'
      else {
        state.sourceState = 'RECORDED'
        state.saveCount++
        $('[data-check-in-status]').textContent = 'Đã lưu ghi nhận hôm nay.'
      }
      persist()
      busy = false
      render()
    })
    const dialog = $('#delete-confirm')
    $('[data-delete-check-in]').addEventListener('click', () =>
      dialog.showModal(),
    )
    $('[data-delete-cancel]').addEventListener('click', () => dialog.close())
    $('[data-delete-confirm]').addEventListener('click', () => {
      state.sourceState = 'DELETED'
      persist()
      dialog.close()
      $('[data-check-in-status]').textContent =
        'Đã xóa ghi nhận cảm xúc hôm nay.'
      render()
      $('[data-return]').focus()
    })
  }
  render()
})()
