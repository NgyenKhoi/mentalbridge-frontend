(() => {
  'use strict'
  const root = document.getElementById('prototype-editor')
  const clone = value => structuredClone(value)
  const labels = {
    cadence: [['WEEKLY', 'Theo tuần'], ['DAILY', 'Mỗi ngày'], ['ONCE', 'Một lần']],
    daypart: [['', 'Giờ cụ thể'], ['MORNING', 'Buổi sáng'], ['AFTERNOON', 'Buổi chiều'], ['EVENING', 'Buổi tối'], ['FLEXIBLE', 'Linh hoạt']],
    timezone: [['Asia/Ho_Chi_Minh', 'Việt Nam · UTC+7'], ['Asia/Bangkok', 'Bangkok · UTC+7'], ['Asia/Singapore', 'Singapore · UTC+8'], ['UTC', 'UTC']],
  }
  const weekdays = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật']
  const initial = {
    enabled: true, cadence: 'WEEKLY', daypart: 'EVENING', time: '19:00', duration: '10',
    timezone: 'Asia/Ho_Chi_Minh', starts: '2026-10-14', ends: '', reminder: true, days: [1, 4],
  }
  const state = {
    status: 'ACTIVE', source: 'READY', outcome: 'SUCCESS', version: 2, selectedTab: 'adjust',
    forms: { A: clone(initial), B: { ...clone(initial), time: '19:15' } },
    saved: { A: clone(initial), B: { ...clone(initial), time: '19:15' } },
    pending: null, messages: {}, stale: {}, server: {}, errors: {}, openSelect: null,
  }
  const titles = { A: 'Đi bộ nhẹ', B: 'Chuẩn bị một nhịp ngủ dễ chịu hơn' }
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
  const dirty = id => JSON.stringify(state.forms[id]) !== JSON.stringify(state.saved[id])
  const dirtyCount = () => ['A', 'B'].filter(dirty).length
  const editable = () => ['ACTIVE', 'DRAFT'].includes(state.status)
  const icon = name => {
    const paths = {
      walk: '<circle cx="13" cy="4" r="2"/><path d="m7 21 3-7 3 2 2 5M7 11l3-5 4 2 3 1M10 6l1 7 5-2 2-4"/>',
      moon: '<path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z"/>',
      clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      check: '<path d="m5 12 4 4L19 6"/>',
      chevron: '<path d="m6 9 6 6 6-6"/>',
      bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M10 21h4"/>',
      calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
      settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
      undo: '<path d="M3 9h12a6 6 0 0 1 0 12M3 9l5-5M3 9l5 5"/>',
    }
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.clock}</svg>`
  }
  const announce = message => { document.getElementById('prototype-announcement').textContent = message }
  const selectedLabel = (field, value) => labels[field].find(option => option[0] === value)?.[1] || value
  function select(id, field, label, disabled) {
    const buttonId = `${id}-${field}`
    const open = state.openSelect?.id === buttonId
    return `<div class="prototype-field prototype-select"><span id="${buttonId}-label">${label}</span><button type="button" id="${buttonId}" role="combobox" aria-labelledby="${buttonId}-label ${buttonId}-value" aria-controls="${buttonId}-list" aria-expanded="${open}" aria-haspopup="listbox" data-select="${field}" data-action="${id}" ${disabled ? 'disabled' : ''}><span id="${buttonId}-value">${escape(selectedLabel(field, state.forms[id][field]))}</span>${icon('chevron')}</button>${open ? `<div id="${buttonId}-list" role="listbox" aria-labelledby="${buttonId}-label" class="prototype-options">${labels[field].map(([value, text], index) => `<button type="button" role="option" id="${buttonId}-option-${index}" aria-selected="${state.forms[id][field] === value}" tabindex="-1" data-option="${field}" data-value="${value}" data-index="${index}" data-action="${id}">${text}${state.forms[id][field] === value ? icon('check') : ''}</button>`).join('')}</div>` : ''}</div>`
  }
  function checkbox(id, field, text, disabled, extra = '') {
    return `<label class="prototype-choice ${extra}" for="${id}-${field}"><input id="${id}-${field}" type="checkbox" data-field="${field}" data-action="${id}" ${state.forms[id][field] ? 'checked' : ''} ${disabled ? 'disabled' : ''}><span class="prototype-check" aria-hidden="true">${icon('check')}</span><span>${text}</span></label>`
  }
  function field(id, name, label, type, disabled, attributes = '') {
    return `<label class="prototype-field" for="${id}-${name}"><span>${label}</span><input id="${id}-${name}" type="${type}" value="${escape(state.forms[id][name])}" data-field="${name}" data-action="${id}" ${disabled ? 'disabled' : ''} ${attributes} ${state.errors[id]?.field === name ? `aria-invalid="true" aria-describedby="${id}-error"` : ''}></label>`
  }
  function activity(id) {
    const form = state.forms[id]
    const disabled = !editable() || state.pending === id
    const summary = form.enabled ? `${selectedLabel('cadence', form.cadence)} · ${form.time} · ${form.duration || '—'} phút` : 'Không có lịch tương lai'
    return `<article class="prototype-activity ${dirty(id) ? 'is-dirty' : ''}" data-activity="${id}" aria-labelledby="${id}-title" ${state.pending === id ? 'aria-busy="true"' : ''}>
      <div class="prototype-activity-heading"><div class="prototype-icon">${icon(id === 'A' ? 'walk' : 'moon')}</div><div class="prototype-activity-title"><h4 id="${id}-title">${titles[id]}</h4><p>${icon('clock')}<span data-summary="${id}">${escape(summary)}</span></p></div>${checkbox(id, 'enabled', 'Lên lịch', disabled, 'prototype-enabled')}</div>
      ${form.enabled ? `<div class="prototype-fields">${select(id, 'cadence', 'Nhịp hoạt động', disabled)}${select(id, 'daypart', 'Thời điểm trong ngày', disabled)}${field(id, 'time', 'Giờ địa phương', 'time', disabled, 'required')}${field(id, 'duration', 'Thời lượng dự kiến (phút)', 'number', disabled, 'min="5" max="180" step="5"')}${field(id, 'timezone', 'Múi giờ', 'text', disabled)}${field(id, 'starts', 'Bắt đầu từ', 'date', disabled, 'min="2026-10-14"')}${field(id, 'ends', 'Kết thúc vào (không bắt buộc)', 'date', disabled, `min="${form.starts}"`)}<div class="prototype-reminder">${checkbox(id, 'reminder', `${icon('bell')}Nhắc tôi về hoạt động này`, disabled)}</div>${form.cadence === 'WEEKLY' ? `<fieldset class="prototype-weekdays"><legend>Ngày trong tuần</legend><div>${weekdays.map((day, index) => `<label class="prototype-day" for="${id}-day-${index + 1}"><input id="${id}-day-${index + 1}" type="checkbox" data-field="days" data-day="${index + 1}" data-action="${id}" ${form.days.includes(index + 1) ? 'checked' : ''} ${disabled ? 'disabled' : ''}><span>${day}</span></label>`).join('')}</div></fieldset>` : ''}</div>` : `<p class="prototype-help">Hoạt động vẫn ở trong kế hoạch. Bạn có thể chủ động thực hiện mà không có lịch nhắc.</p>`}
      ${state.errors[id] ? `<p id="${id}-error" class="prototype-error" role="alert">${escape(state.errors[id].message)}</p>` : ''}
      ${state.stale[id] ? `<div class="prototype-conflict" role="alert"><strong>Lịch này vừa được cập nhật ở nơi khác.</strong><p>Chỉnh sửa của bạn chưa bị xóa. Chỉ tải lại lịch của ${titles[id]}; hoạt động khác vẫn được giữ.</p><button type="button" class="btn btn-outline" data-reload="${id}">Tải lịch mới của ${titles[id]}</button></div>` : ''}
      <footer class="prototype-activity-footer"><span id="${id}-status" tabindex="-1" class="prototype-item-status" role="status" data-status="${id}">${state.pending === id ? 'Đang lưu…' : state.messages[id] || (dirty(id) ? 'Có thay đổi chưa lưu' : 'Đã lưu lịch')}</span><div><button type="button" id="${id}-undo" class="btn btn-ghost" data-undo="${id}" ${!dirty(id) || disabled ? 'disabled' : ''}>${icon('undo')}Hoàn tác</button><button type="button" id="${id}-save" class="btn btn-primary" data-save="${id}" aria-label="Lưu lịch ${titles[id]}" ${!dirty(id) || disabled || state.pending || state.stale[id] ? 'disabled' : ''}>${state.pending === id ? '<span class="prototype-spinner" aria-hidden="true"></span>Đang lưu…' : icon('check') + 'Lưu lịch'}</button></div></footer>
    </article>`
  }
  function fixtureControls() {
    return `<details class="prototype-fixture"><summary>Dữ liệu mô phỏng · Không lưu vào tài khoản</summary><p>Chỉ dùng để thử hành vi trên máy, không gọi API hoặc dùng thông tin đăng nhập.</p><div class="prototype-fixture-row"><span>Trạng thái kế hoạch:</span>${[['ACTIVE', 'Đang hoạt động'], ['DRAFT', 'Bản nháp'], ['PAUSED', 'Tạm dừng']].map(([value, text]) => `<button type="button" id="fixture-plan-${value}" class="btn btn-outline" data-plan-state="${value}" aria-pressed="${state.status === value}" ${state.pending ? 'disabled' : ''}>${text}</button>`).join('')}</div><div class="prototype-fixture-row"><span>Lần lưu tiếp theo:</span>${[['SUCCESS', 'Thành công'], ['CONFLICT', 'Xung đột cập nhật'], ['ERROR', 'Lỗi kết nối']].map(([value, text]) => `<button type="button" id="fixture-outcome-${value}" class="btn btn-outline" data-outcome="${value}" aria-pressed="${state.outcome === value}" ${state.pending ? 'disabled' : ''}>${text}</button>`).join('')}</div><div class="prototype-fixture-row"><span>Nội dung:</span>${[['READY', 'Có dữ liệu'], ['LOADING', 'Đang tải'], ['EMPTY', 'Chưa có lịch'], ['ERROR', 'Lỗi tải'], ['READ_ONLY', 'Mục không lặp lịch']].map(([value, text]) => `<button type="button" id="fixture-source-${value}" class="btn btn-outline" data-source="${value}" aria-pressed="${state.source === value}" ${state.pending ? 'disabled' : ''}>${text}</button>`).join('')}</div></details>`
  }
  function render() {
    const focused = document.activeElement?.id
    const fixtureOpen = root.querySelector('.prototype-fixture')?.open || false
    const selection = ['text', 'search'].includes(document.activeElement?.type) ? [document.activeElement.selectionStart, document.activeElement.selectionEnd] : null
    let content = ''
    if (state.source === 'READY') content = ['A', 'B'].map(activity).join('')
    if (state.source === 'LOADING') content = '<div class="prototype-state" role="status"><span class="prototype-spinner"></span>Đang tải lịch hoạt động…</div>'
    if (state.source === 'EMPTY') content = '<div class="prototype-state"><h4>Bạn chưa lên lịch hoạt động</h4><p>Chọn một nhịp vừa sức khi bạn sẵn sàng.</p><button type="button" class="btn btn-primary" data-source="READY">Xem các hoạt động mẫu</button></div>'
    if (state.source === 'ERROR') content = '<div class="prototype-state" role="alert"><h4>Chưa tải được lịch hoạt động</h4><p>Chỉnh sửa đang có vẫn được giữ. Bạn có thể thử tải lại.</p><button type="button" class="btn btn-outline" data-source="READY">Thử tải lại lịch</button></div>'
    if (state.source === 'READ_ONLY') content = '<div class="prototype-state"><h4>Khi cần thêm hỗ trợ</h4><p>Mục này được thực hiện khi bạn chủ động cần đến, nên không bị đưa vào lịch lặp lại.</p></div>'
    root.innerHTML = `${fixtureControls()}<div class="prototype-section-heading"><div><span>Điều chỉnh khi cần</span><h3 id="prototype-title">Nhịp hoạt động phù hợp với bạn</h3><p>Chọn số lần, thời điểm và thời lượng vừa sức. Giảm hoặc bỏ lịch không được xem là thất bại.</p></div><span class="prototype-tag" data-plan-status>${{ ACTIVE: 'Đang hoạt động', DRAFT: 'Bản nháp', PAUSED: 'Đang tạm dừng', COMPLETED: 'Đã kết thúc' }[state.status]}</span></div>${!editable() ? '<p class="prototype-readonly" role="status">Kế hoạch đang chỉ đọc. Hãy tiếp tục kế hoạch trước khi thay đổi lịch hoạt động tương lai.</p>' : ''}<div class="prototype-activities">${content}</div><aside class="prototype-lifecycle"><div class="prototype-icon">${icon('settings')}</div><div><h4>Quản lý trạng thái kế hoạch</h4><p>Tạm dừng sẽ hủy các lịch tương lai; tiếp tục chỉ khôi phục các mục vẫn còn ở tương lai. Kết thúc không mang ý nghĩa phục hồi.</p><p role="status" data-dirty-summary>${dirtyCount() ? `Bạn còn ${dirtyCount()} hoạt động chưa lưu. Lưu hoặc hoàn tác trước khi đổi trạng thái kế hoạch.` : 'Mọi thay đổi lịch đã được lưu.'}</p><div class="prototype-lifecycle-actions">${state.status === 'DRAFT' ? `<button type="button" id="prototype-activate" class="btn btn-primary" data-lifecycle="activate" ${dirtyCount() ? 'disabled' : ''}>Bắt đầu kế hoạch này</button>` : state.status === 'PAUSED' ? '<button type="button" id="prototype-resume" class="btn btn-primary" data-lifecycle="resume">Tiếp tục kế hoạch</button>' : state.status === 'ACTIVE' ? `<button type="button" id="prototype-pause" class="btn btn-outline" data-lifecycle="pause" ${dirtyCount() ? 'disabled' : ''}>Tạm dừng kế hoạch</button><button type="button" id="prototype-complete" class="btn btn-ghost" data-lifecycle="complete" ${dirtyCount() ? 'disabled' : ''}>Kết thúc kế hoạch</button>` : ''}</div></div></aside>`
    const restored = focused ? document.getElementById(focused) : null
    root.querySelector('.prototype-fixture').open = fixtureOpen
    restored?.focus({ preventScroll: true })
    if (selection && restored) restored.setSelectionRange(...selection)
    if (state.openSelect) {
      const list = document.getElementById(`${state.openSelect.id}-list`)
      const bounds = list.getBoundingClientRect()
      list.classList.toggle('opens-up', bounds.bottom > innerHeight - 12 && bounds.height < bounds.top - 12)
    }
  }
  function update(id, field, value) {
    state.forms[id][field] = value
    if (field === 'cadence') state.forms[id].days = value === 'WEEKLY' ? state.forms[id].days.length ? state.forms[id].days : [1] : []
    delete state.messages[id]
    delete state.errors[id]
    render()
  }
  function validate(id) {
    const form = state.forms[id]
    if (!form.enabled) return null
    if (!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(form.time)) return { field: 'time', message: 'Chọn giờ hoạt động hợp lệ.' }
    const duration = Number(form.duration)
    if (!Number.isInteger(duration) || duration < 5 || duration > 180 || duration % 5 !== 0) return { field: 'duration', message: 'Chọn thời lượng từ 5 đến 180 phút, theo bước 5 phút.' }
    if (form.cadence === 'WEEKLY' && !form.days.length) return { field: 'days', message: 'Chọn ít nhất một ngày trong tuần.' }
    if (!form.starts || form.starts < '2026-10-14') return { field: 'starts', message: 'Chọn ngày bắt đầu từ 14/10/2026 trong kịch bản mô phỏng.' }
    if (form.ends && form.ends < form.starts) return { field: 'ends', message: 'Ngày kết thúc không thể trước ngày bắt đầu.' }
    return null
  }
  async function save(id) {
    if (state.pending) return
    const error = validate(id)
    if (error) {
      state.errors[id] = error
      render()
      document.getElementById(error.field === 'days' ? `${id}-day-1` : `${id}-${error.field}`)?.focus()
      return
    }
    const submitted = clone(state.forms[id])
    const outcome = state.outcome
    state.pending = id
    state.messages[id] = 'Đang lưu…'
    render()
    document.getElementById(`${id}-status`).focus({ preventScroll: true })
    await new Promise(resolve => setTimeout(resolve, 550))
    state.pending = null
    state.outcome = 'SUCCESS'
    if (outcome === 'CONFLICT') {
      state.stale[id] = true
      state.server[id] = { ...clone(state.saved[id]), time: '19:40', duration: '15' }
      state.messages[id] = 'Chưa lưu. Chỉnh sửa của bạn vẫn được giữ.'
    } else if (outcome === 'ERROR') {
      state.errors[id] = { field: null, message: 'Chưa lưu được lịch. Các thay đổi của bạn vẫn còn; hãy thử lại.' }
      state.messages[id] = 'Chưa lưu'
    } else {
      state.saved[id] = submitted
      delete state.errors[id]
      state.version++
      state.messages[id] = 'Đã lưu lịch. Chỉnh sửa ở hoạt động khác vẫn được giữ.'
    }
    render()
    announce(state.messages[id])
  }
  root.addEventListener('input', event => {
    const target = event.target
    if (!target.dataset.field || target.type === 'checkbox') return
    update(target.dataset.action, target.dataset.field, target.value)
  })
  root.addEventListener('change', event => {
    const target = event.target
    if (target.type !== 'checkbox' || !target.dataset.action) return
    const id = target.dataset.action
    if (target.dataset.field === 'days') {
      const day = Number(target.dataset.day)
      update(id, 'days', target.checked ? [...state.forms[id].days, day].sort((a, b) => a - b) : state.forms[id].days.filter(value => value !== day))
    } else update(id, target.dataset.field, target.checked)
  })
  root.addEventListener('click', event => {
    const target = event.target.closest('button')
    if (!target || target.disabled) return
    if (target.dataset.save) void save(target.dataset.save)
    if (target.dataset.undo) {
      const id = target.dataset.undo
      state.forms[id] = clone(state.saved[id])
      state.messages[id] = 'Đã hoàn tác về lịch vừa lưu.'
      delete state.errors[id]
      render()
      document.getElementById(`${id}-time`)?.focus()
    }
    if (target.dataset.reload) {
      const id = target.dataset.reload
      state.saved[id] = clone(state.server[id])
      state.forms[id] = clone(state.server[id])
      delete state.stale[id]
      delete state.errors[id]
      state.messages[id] = 'Đã tải lịch mới cho hoạt động này. Hoạt động khác không đổi.'
      render()
      document.getElementById(`${id}-time`)?.focus()
    }
    if (target.dataset.planState) { state.status = target.dataset.planState; render() }
    if (target.dataset.outcome) { state.outcome = target.dataset.outcome; render() }
    if (target.dataset.source) { state.source = target.dataset.source; render() }
    if (target.dataset.select) {
      const field = target.dataset.select
      state.openSelect = state.openSelect?.id === target.id ? null : { id: target.id, action: target.dataset.action, field }
      render()
      if (state.openSelect) {
        const index = labels[field].findIndex(option => option[0] === state.forms[target.dataset.action][field])
        document.getElementById(`${target.id}-option-${Math.max(0, index)}`)?.focus()
      }
    }
    if (target.dataset.option) {
      const { action, option, value } = target.dataset
      state.openSelect = null
      update(action, option, value)
      document.getElementById(`${action}-${option}`)?.focus()
    }
    if (target.dataset.lifecycle) openLifecycle(target.dataset.lifecycle, target.id)
  })
  root.addEventListener('keydown', event => {
    const target = event.target
    if (target.dataset.select && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault()
      state.openSelect = { id: target.id, action: target.dataset.action, field: target.dataset.select }
      render()
      const count = labels[target.dataset.select].length
      const index = ['End', 'ArrowUp'].includes(event.key) ? count - 1 : 0
      document.getElementById(`${target.id}-option-${index}`)?.focus()
    } else if (target.dataset.option) {
      const { action, option } = target.dataset
      const count = labels[option].length
      const index = Number(target.dataset.index)
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault()
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + count) % count
        document.getElementById(`${action}-${option}-option-${next}`)?.focus()
      } else if (event.key.length === 1 && event.key !== ' ') {
        const match = labels[option].findIndex(([, value]) => value.toLocaleLowerCase('vi').startsWith(event.key.toLocaleLowerCase('vi')))
        if (match >= 0) { event.preventDefault(); document.getElementById(`${action}-${option}-option-${match}`)?.focus() }
      }
    }
    if (event.key === 'Escape' && state.openSelect) {
      event.preventDefault()
      const id = state.openSelect.id
      state.openSelect = null
      render()
      document.getElementById(id)?.focus()
    }
    if (event.key === 'Tab' && state.openSelect) {
      const id = state.openSelect.id
      state.openSelect = null
      render()
      document.getElementById(id)?.focus()
    }
  })
  document.addEventListener('click', event => {
    if (state.openSelect && !event.target.closest('.prototype-select')) {
      state.openSelect = null
      render()
    }
  })
  const dialog = document.getElementById('prototype-confirm')
  let lifecycle = null
  function openLifecycle(action, returnId) {
    lifecycle = { action, returnId }
    document.getElementById('prototype-confirm-title').textContent = { pause: 'Tạm dừng kế hoạch?', complete: 'Kết thúc kế hoạch?', activate: 'Bắt đầu kế hoạch này?', resume: 'Tiếp tục kế hoạch?' }[action]
    document.getElementById('prototype-confirm-copy').textContent = action === 'complete' ? 'Các hoạt động tương lai sẽ không tiếp tục. Kết thúc không phải là đánh giá hồi phục. Đây chỉ là thao tác mô phỏng.' : 'Thay đổi này chỉ được áp dụng trong bản mô phỏng, không thay đổi tài khoản thật.'
    dialog.showModal()
    dialog.querySelector('[data-confirm-cancel]').focus()
  }
  dialog.querySelector('[data-confirm-cancel]').addEventListener('click', () => dialog.close())
  dialog.querySelector('[data-confirm-accept]').addEventListener('click', () => {
    state.status = { pause: 'PAUSED', complete: 'COMPLETED', activate: 'ACTIVE', resume: 'ACTIVE' }[lifecycle.action]
    render()
    dialog.close()
    announce('Đã cập nhật trạng thái trong bản mô phỏng.')
  })
  dialog.addEventListener('close', () => {
    const returnTarget = document.getElementById(lifecycle?.returnId) || document.querySelector('.prototype-lifecycle-actions button') || document.getElementById('prototype-title')
    returnTarget?.focus()
  })
  document.querySelectorAll('[role="tab"]').forEach(tab => {
    tab.addEventListener('click', () => selectTab(tab.id.replace('tab-', '')))
    tab.addEventListener('keydown', event => {
      const tabs = [...document.querySelectorAll('[role="tab"]')]
      const index = tabs.indexOf(tab)
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
      tabs[next].click()
      tabs[next].focus()
    })
  })
  function selectTab(id) {
    state.selectedTab = id
    document.querySelectorAll('[role="tab"]').forEach(tab => {
      const active = tab.id === `tab-${id}`
      tab.setAttribute('aria-selected', String(active))
      tab.tabIndex = active ? 0 : -1
      tab.classList.toggle('is-active', active)
      if (active) tab.parentElement.scrollLeft = Math.max(0, tab.offsetLeft - tab.parentElement.offsetLeft - 12)
    })
    document.querySelectorAll('[role="tabpanel"]').forEach(panel => {
      const active = panel.id === `panel-${id}`
      panel.classList.toggle('is-hidden', !active)
      panel.classList.toggle('is-active', active)
      panel.hidden = !active
    })
  }
  document.querySelector('.mb-support-workspace-adjust')?.addEventListener('click', () => selectTab('adjust'))
  const shell = document.querySelector('.ref-shell')
  const menu = document.querySelector('.ref-mobile')
  const closeMenu = () => { shell.classList.remove('mobile-open'); menu.setAttribute('aria-expanded', 'false') }
  menu.setAttribute('aria-expanded', 'false')
  menu.addEventListener('click', () => { shell.classList.add('mobile-open'); menu.setAttribute('aria-expanded', 'true'); document.querySelector('.ref-sidebar a').focus() })
  document.querySelector('.prototype-menu-overlay').addEventListener('click', () => { closeMenu(); menu.focus() })
  document.querySelector('.ref-brand button').addEventListener('click', () => {
    if (matchMedia('(max-width: 900px)').matches) { closeMenu(); menu.focus() } else shell.classList.toggle('collapsed')
  })
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && shell.classList.contains('mobile-open')) { closeMenu(); menu.focus() }
  })
  let returnFocus = null
  let returnScroll = 0
  document.querySelectorAll('a[href="#community"]').forEach(link => link.addEventListener('click', event => {
    event.preventDefault()
    returnFocus = link
    returnScroll = scrollY
    closeMenu()
    document.querySelector('.support-plan-page').hidden = true
    document.getElementById('prototype-community').hidden = false
    history.replaceState(null, '', '#community')
    window.scrollTo(0, 0)
    document.querySelector('#prototype-community h1').focus()
  }))
  document.querySelector('a[href="#support-plan"]').addEventListener('click', event => {
    event.preventDefault()
    document.getElementById('prototype-community').hidden = true
    document.querySelector('.support-plan-page').hidden = false
    history.replaceState(null, '', '#support-plan')
    window.scrollTo(0, returnScroll)
    if (returnFocus?.closest('.ref-sidebar') && matchMedia('(max-width: 900px)').matches) menu.focus()
    else returnFocus?.focus({ preventScroll: true })
  })
  document.querySelector('[data-community-save]').addEventListener('click', event => {
    const button = event.currentTarget
    const saved = button.getAttribute('aria-pressed') !== 'true'
    button.setAttribute('aria-pressed', String(saved))
    button.textContent = saved ? 'Đã lưu bài viết mẫu' : 'Lưu bài viết mẫu'
    document.querySelector('[data-community-status]').textContent = saved ? 'Đã lưu trong bản mô phỏng, không phải tài khoản thật.' : 'Đã bỏ lưu trong bản mô phỏng.'
  })
  document.querySelectorAll('a[href^="/"]').forEach(link => link.addEventListener('click', event => {
    event.preventDefault()
    announce('Liên kết ngoài phạm vi prototype. Không có API hoặc tài khoản thật được dùng.')
  }))
  render()
  selectTab('adjust')
})()
