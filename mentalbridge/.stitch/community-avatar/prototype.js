(() => {
  const byId = id => document.getElementById(id)
  const state = { savedName: 'Minh An', savedPreset: null, savedPhoto: null, file: null, preview: null, mediaId: null, busy: false, stale: false, failure: null, version: 1, uploads: 0, selections: 0, selectionSequence: 0, createdUrls: [], revokedUrls: [] }
  const presets = [ [null, 'Chữ cái tên', 'MA'], ['LEAF', 'Lá xanh', '<path d="M5 20c0-8 6-15 14-15 0 10-5 14-12 12M5 20l9-9"/>'], ['SUNRISE', 'Bình minh', '<path d="M3 20h18M5 16h14M7 16a5 5 0 0 1 10 0M12 3v3M4 8l2 2M20 8l-2 2"/>'], ['WAVE', 'Gợn sóng', '<path d="M3 9c3-4 6 4 9 0s6 4 9 0M3 15c3-4 6 4 9 0s6 4 9 0"/>'], ['LOTUS', 'Hoa sen', '<path d="M12 20C7 16 5 9 12 3c7 6 5 13 0 17M12 20C5 21 2 16 3 11c6 0 8 4 9 9M12 20c7 1 10-4 9-9-6 0-8 4-9 9"/>'], ['CLOUD', 'Mây nhẹ', '<path d="M6 18a4 4 0 0 1-1-8 6 6 0 0 1 11-2 5 5 0 0 1 2 10H6Z"/>'], ['SPROUT', 'Mầm cây', '<path d="M12 21v-9M12 13C5 13 4 8 4 5c6 0 8 3 8 8M12 16c7 0 8-5 8-8-6 0-8 3-8 8"/>'] ]
  byId('presets').innerHTML = presets.map(([value, label, icon]) => `<label><input type="radio" name="preset" value="${value ?? ''}" ${value === null ? 'checked' : ''}><span class="preset-icon">${value === null ? icon : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">${icon}</svg>`}</span><span>${label}</span></label>`).join('')
  function initials() { return [...byId('profile-name').value.trim()].slice(0, 2).join('').toUpperCase() || '?' }
  function release(url) { if (url && !state.revokedUrls.includes(url)) { URL.revokeObjectURL(url); state.revokedUrls.push(url) } }
  function clearDraft() { state.selectionSequence++; release(state.preview); state.preview = null; state.file = null; state.mediaId = null; state.stale = false; byId('photo-file').value = '' }
  function error(message) { byId('photo-error').textContent = message; byId('photo-error').hidden = !message }
  function status(message) { byId('photo-status').textContent = message }
  function fallback(target) {
    const preset = document.querySelector('[name="preset"]:checked').value || null
    target.dataset.preset = preset || 'MONOGRAM'
    const icon = presets.find(([value]) => value === preset)?.[2]
    if (preset && icon) target.innerHTML = `<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">${icon}</svg>`
    else target.textContent = initials()
  }
  function render() {
    const photo = state.preview || state.savedPhoto
    for (const id of ['photo-preview', 'public-avatar']) {
      const target = byId(id)
      target.replaceChildren()
      if (photo) { const image = document.createElement('img'); image.src = photo; image.alt = ''; image.addEventListener('error', () => fallback(target)); target.append(image) }
      else fallback(target)
    }
    byId('preview-name').textContent = byId('profile-name').value.trim() || 'Tên hiển thị của bạn'
    byId('photo-stage').hidden = !state.file
    byId('file-name').textContent = state.file?.name || ''
    byId('remove-photo').hidden = !state.savedPhoto
    byId('reload-profile').hidden = !state.stale
    document.querySelector('.photo-region').setAttribute('aria-busy', String(state.busy))
    for (const id of ['choose-photo', 'save-photo', 'cancel-photo', 'remove-photo', 'reload-profile']) byId(id).disabled = state.busy || (id === 'save-photo' && state.stale)
    byId('save-photo').textContent = state.busy ? 'Đang lưu ảnh…' : 'Lưu ảnh đại diện'
  }
  byId('choose-photo').addEventListener('click', () => byId('photo-file').click())
  byId('photo-file').addEventListener('change', async event => {
    if (state.busy) return
    const file = event.target.files[0]
    const sequence = ++state.selectionSequence
    if (!file) return
    if (!file.size) { error('Ảnh đang trống. Hãy chọn một ảnh khác.'); event.target.value = ''; return }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { error('Chọn ảnh JPEG, PNG hoặc WebP để tiếp tục.'); event.target.value = ''; return }
    if (file.size > 10 * 1024 * 1024) { error('Ảnh vượt quá 10 MiB. Hãy chọn ảnh nhỏ hơn.'); event.target.value = ''; return }
    const next = URL.createObjectURL(file); state.createdUrls.push(next)
    try { const probe = new Image(); probe.src = next; await probe.decode() } catch { release(next); if (sequence === state.selectionSequence) { error('Ảnh không mở được. Hãy chọn một ảnh khác.'); event.target.value = '' }; return }
    if (sequence !== state.selectionSequence) { release(next); return }
    clearDraft(); state.file = file; state.preview = next; error(''); status('Ảnh chưa được lưu.'); render()
  })
  byId('cancel-photo').addEventListener('click', () => { clearDraft(); error(''); status('Đã hủy lựa chọn ảnh.'); render(); byId('choose-photo').focus() })
  byId('save-photo').addEventListener('click', async () => {
    if (state.busy || !state.file || state.stale) return
    state.busy = true; error(''); status('Đang tải và kiểm tra ảnh…'); render()
    const failure = state.failure; state.failure = null
    await new Promise(resolve => setTimeout(resolve, 260))
    if (!state.mediaId && failure !== 'upload') { state.mediaId = `fixture-media-${++state.uploads}` }
    if (failure === 'upload' || failure === 'select' || failure === 'stale') {
      state.stale = failure === 'stale'
      error(state.stale ? 'Thông tin đã thay đổi ở nơi khác. Lựa chọn ảnh và tên đang sửa vẫn được giữ.' : 'Chưa thể lưu ảnh. Ảnh hiện tại không thay đổi; bạn có thể thử lại.')
      status(''); state.busy = false; render(); return
    }
    const reader = new FileReader(); reader.readAsDataURL(state.file)
    state.savedPhoto = await new Promise(resolve => { reader.onload = () => resolve(reader.result) })
    state.selections++; state.version++; clearDraft(); state.busy = false; status('Đã lưu ảnh đại diện.'); render()
  })
  byId('reload-profile').addEventListener('click', () => { state.version++; state.stale = false; error(''); status('Đã tải thông tin mới. Lựa chọn ảnh và tên đang sửa vẫn được giữ; hãy lưu lại ảnh.'); render() })
  const dialog = byId('remove-dialog')
  byId('remove-photo').addEventListener('click', () => { byId('remove-error').hidden = true; dialog.showModal() })
  byId('keep-photo').addEventListener('click', () => dialog.close())
  dialog.addEventListener('cancel', event => { if (state.busy) event.preventDefault() })
  dialog.addEventListener('close', () => (state.savedPhoto ? byId('remove-photo') : byId('choose-photo')).focus())
  byId('confirm-remove').addEventListener('click', async () => {
    if (state.busy) return
    state.busy = true; render(); status('Đang gỡ ảnh…'); byId('remove-error').hidden = true
    byId('confirm-remove').disabled = true; byId('keep-photo').disabled = true
    byId('confirm-remove').textContent = 'Đang gỡ ảnh…'
    const failure = state.failure; state.failure = null
    await new Promise(resolve => setTimeout(resolve, 260))
    if (failure === 'remove') { byId('remove-error').textContent = 'Chưa thể gỡ ảnh. Ảnh hiện tại không thay đổi; hãy thử lại.'; byId('remove-error').hidden = false; status('') }
    else { state.savedPhoto = null; state.version++; clearDraft(); error(''); status('Đã gỡ ảnh. Hồ sơ dùng biểu tượng dự phòng.'); dialog.close(); byId('choose-photo').focus() }
    state.busy = false; byId('confirm-remove').disabled = false; byId('keep-photo').disabled = false; byId('confirm-remove').textContent = 'Gỡ ảnh'; render()
  })
  byId('profile-name').addEventListener('input', render)
  document.querySelectorAll('[name="preset"]').forEach(input => input.addEventListener('change', render))
  byId('name-form').addEventListener('submit', event => {
    event.preventDefault()
    const name = byId('profile-name').value.trim().normalize('NFC')
    const invalid = !name || [...name].length > 80 || /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(name)
    byId('name-error').hidden = !invalid
    byId('name-error').textContent = invalid ? 'Tên hiển thị cần có từ 1 đến 80 ký tự an toàn.' : ''
    if (invalid) { byId('profile-name').focus(); return }
    state.savedName = name; state.savedPreset = document.querySelector('[name="preset"]:checked').value || null; state.version++
    byId('name-status').textContent = 'Đã lưu tên và biểu tượng. Lựa chọn ảnh đang sửa không thay đổi.'; render()
  })
  document.querySelectorAll('[data-failure]').forEach(button => button.addEventListener('click', () => { state.failure = button.dataset.failure; status('Đã chọn tình huống thử cho thao tác kế tiếp.') }))
  window.avatarFixture = { snapshot: () => ({ savedName: state.savedName, savedPreset: state.savedPreset, savedPhoto: Boolean(state.savedPhoto), draftName: byId('profile-name').value, fileName: state.file?.name ?? null, mediaId: state.mediaId, busy: state.busy, stale: state.stale, uploads: state.uploads, selections: state.selections, createdUrls: [...state.createdUrls], revokedUrls: [...state.revokedUrls] }), dispose: () => { clearDraft(); render() } }
  window.addEventListener('pagehide', () => release(state.preview))
  render()
})()
