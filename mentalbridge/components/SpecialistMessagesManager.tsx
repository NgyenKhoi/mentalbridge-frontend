'use client'

import { FormEvent, KeyboardEvent, useMemo, useState } from 'react'
import './specialist-messages-manager.css'

type Message = { id: number; sender: 'client' | 'specialist'; content: string; time: string; read?: boolean }
type Conversation = {
  id: string
  name: string
  initials: string
  focus: string
  online: boolean
  unread: number
  time: string
  lastMessage: string
  nextAppointment: string
  messages: Message[]
}

const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: 'm1', name: 'Nguyễn Minh Anh', initials: 'MA', focus: 'Lo âu · Giấc ngủ', online: true, unread: 2, time: '5 phút', lastMessage: 'Em đã hoàn thành bài tập tuần này rồi ạ.', nextAppointment: '28/08 · 10:30 · Video call',
    messages: [
      { id: 1, sender: 'specialist', content: 'Chào Minh Anh, tuần này em cảm thấy giấc ngủ của mình thay đổi như thế nào?', time: '19:42', read: true },
      { id: 2, sender: 'client', content: 'Em đã dễ ngủ hơn một chút và không còn thức giấc nhiều như tuần trước ạ.', time: '19:48' },
      { id: 3, sender: 'specialist', content: 'Đó là một tín hiệu tích cực. Em tiếp tục giữ giờ ngủ ổn định và thực hành bài thở trước khi ngủ nhé.', time: '19:51', read: true },
      { id: 4, sender: 'client', content: 'Dạ, em đã hoàn thành bài tập tuần này rồi ạ.', time: '20:06' },
      { id: 5, sender: 'client', content: 'Em có ghi lại cảm xúc sau mỗi buổi tối như cô hướng dẫn.', time: '20:07' },
    ],
  },
  {
    id: 'm2', name: 'Trần Gia Hân', initials: 'GH', focus: 'Căng thẳng công việc', online: false, unread: 0, time: 'Hôm qua', lastMessage: 'Cảm ơn cô, em đã rõ hơn rồi ạ.', nextAppointment: '27/08 · 14:00 · Tại phòng tư vấn',
    messages: [
      { id: 1, sender: 'client', content: 'Tuần này em sẽ thử chia nhỏ công việc như mình đã trao đổi.', time: '15:12' },
      { id: 2, sender: 'specialist', content: 'Em ưu tiên ba việc quan trọng nhất mỗi ngày và nhớ để lại khoảng nghỉ ngắn giữa các việc nhé.', time: '15:16', read: true },
      { id: 3, sender: 'client', content: 'Cảm ơn cô, em đã rõ hơn rồi ạ.', time: '15:18' },
    ],
  },
  {
    id: 'm3', name: 'Lê Hoàng Nam', initials: 'HN', focus: 'Theo dõi sau tư vấn', online: false, unread: 0, time: 'Thứ Hai', lastMessage: 'Hẹn gặp bác sĩ trong phiên tiếp theo.', nextAppointment: '02/09 · 09:00 · Video call',
    messages: [
      { id: 1, sender: 'specialist', content: 'Anh đã nhận được cập nhật. Chúng ta sẽ xem lại tiến trình trong phiên tiếp theo.', time: '09:20', read: true },
      { id: 2, sender: 'client', content: 'Vâng, hẹn gặp bác sĩ trong phiên tiếp theo.', time: '09:25' },
    ],
  },
]

export default function SpecialistMessagesManager() {
  const [conversations, setConversations] = useState(INITIAL_CONVERSATIONS)
  const [selectedId, setSelectedId] = useState(INITIAL_CONVERSATIONS[0].id)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [draft, setDraft] = useState('')
  const [notice, setNotice] = useState('')

  const selected = conversations.find(conversation => conversation.id === selectedId) || conversations[0]
  const visibleConversations = useMemo(() => conversations.filter(conversation => {
    const matchesQuery = `${conversation.name} ${conversation.focus} ${conversation.lastMessage}`.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'))
    return matchesQuery && (filter === 'all' || conversation.unread > 0)
  }), [conversations, filter, query])
  const unreadTotal = conversations.reduce((total, conversation) => total + conversation.unread, 0)

  const flash = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2500)
  }

  const selectConversation = (id: string) => {
    setSelectedId(id)
    setConversations(current => current.map(conversation => conversation.id === id ? { ...conversation, unread: 0 } : conversation))
  }

  const sendMessage = () => {
    const content = draft.trim()
    if (!content) return
    const time = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())
    setConversations(current => current.map(conversation => conversation.id === selected.id ? {
      ...conversation,
      lastMessage: content,
      time: 'Vừa xong',
      messages: [...conversation.messages, { id: Date.now(), sender: 'specialist', content, time, read: false }],
    } : conversation))
    setDraft('')
  }

  const submitMessage = (event: FormEvent) => {
    event.preventDefault()
    sendMessage()
  }

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      sendMessage()
    }
  }

  return <section className="smm-manager">
    <header className="smm-heading">
      <div><span className="smm-eyebrow">Không gian chuyên gia</span><h1>Tin nhắn tư vấn</h1><p>Trao đổi bảo mật với khách hàng và theo dõi những nội dung cần phản hồi.</p></div>
      <aside><i /><div><strong>Kênh tư vấn bảo mật</strong><small>Tin nhắn được bảo vệ trong MentalBridge</small></div></aside>
    </header>

    <div className="smm-workspace">
      <aside className="smm-sidebar">
        <header><div><span>Hộp thư</span><h2>Cuộc trò chuyện</h2></div>{unreadTotal > 0 && <b>{unreadTotal} mới</b>}</header>
        <label className="smm-search"><span>⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm khách hàng..." /></label>
        <nav className="smm-filters" aria-label="Lọc cuộc trò chuyện"><button type="button" className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')}>Tất cả <b>{conversations.length}</b></button><button type="button" className={filter === 'unread' ? 'is-active' : ''} onClick={() => setFilter('unread')}>Chưa đọc <b>{unreadTotal}</b></button></nav>
        <div className="smm-conversations">
          {visibleConversations.map(conversation => <button type="button" key={conversation.id} className={selected.id === conversation.id ? 'is-selected' : ''} onClick={() => selectConversation(conversation.id)}>
            <span className="smm-conversation-avatar">{conversation.initials}{conversation.online && <i />}</span>
            <span className="smm-conversation-copy"><span><strong>{conversation.name}</strong><time>{conversation.time}</time></span><small>{conversation.focus}</small><p>{conversation.lastMessage}</p></span>
            {conversation.unread > 0 ? <b className="smm-unread">{conversation.unread}</b> : <span className="smm-chevron">›</span>}
          </button>)}
          {!visibleConversations.length && <div className="smm-empty"><span>○</span><strong>Không có cuộc trò chuyện</strong><p>Thử thay đổi từ khóa hoặc bộ lọc.</p><button type="button" onClick={() => { setQuery(''); setFilter('all') }}>Xóa bộ lọc</button></div>}
        </div>
        <footer><span>ⓘ</span><p>Không sử dụng tin nhắn cho tình huống khẩn cấp.</p></footer>
      </aside>

      <section className="smm-chat">
        <header className="smm-chat-head">
          <div className="smm-chat-person"><span>{selected.initials}<i className={selected.online ? 'is-online' : ''} /></span><div><h2>{selected.name}</h2><p><i />{selected.online ? 'Đang hoạt động' : 'Hoạt động gần đây'} · {selected.focus}</p></div></div>
          <div className="smm-chat-actions"><button type="button" onClick={() => flash(`Đã mở hồ sơ của ${selected.name}.`)}>♙ <span>Xem hồ sơ</span></button><button type="button" aria-label="Tùy chọn cuộc trò chuyện" onClick={() => flash('Tùy chọn cuộc trò chuyện đã sẵn sàng để kết nối API.')}>•••</button></div>
        </header>

        <aside className="smm-context"><span>◷</span><div><strong>Lịch hẹn tiếp theo</strong><p>{selected.nextAppointment}</p></div><button type="button" onClick={() => flash('Đã mở chi tiết lịch hẹn.')}>Xem lịch <span>→</span></button></aside>

        <div className="smm-thread" aria-live="polite">
          <div className="smm-day-divider"><span>Hôm nay</span></div>
          {selected.messages.map(message => <div key={message.id} className={`smm-message is-${message.sender}`}>
            {message.sender === 'client' && <span className="smm-message-avatar">{selected.initials}</span>}
            <div><p>{message.content}</p><span><time>{message.time}</time>{message.sender === 'specialist' && <b>{message.read === false ? 'Đã gửi' : 'Đã xem'} ✓</b>}</span></div>
          </div>)}
        </div>

        <form className="smm-composer" onSubmit={submitMessage}>
          <div className="smm-quick-replies"><span>Trả lời nhanh</span><button type="button" onClick={() => setDraft('Cảm ơn em đã cập nhật. Cô đã ghi nhận và sẽ trao đổi thêm trong phiên tới nhé.')}>Đã ghi nhận</button><button type="button" onClick={() => setDraft('Em tiếp tục theo dõi và ghi nhận cảm xúc mỗi ngày nhé.')}>Nhắc theo dõi</button></div>
          <div className="smm-compose-row"><button type="button" className="smm-attach" aria-label="Đính kèm tệp" onClick={() => flash('Tính năng đính kèm đang chờ kết nối API.')}>＋</button><textarea value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={handleComposerKeyDown} rows={1} placeholder={`Nhắn tin cho ${selected.name}...`} /><button type="submit" className="smm-send" disabled={!draft.trim()}><span>Gửi</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" /></svg></button></div>
          <small>Enter để gửi · Shift + Enter để xuống dòng</small>
        </form>
      </section>
    </div>
    {notice && <div className="smm-notice" role="status"><span>✓</span>{notice}</div>}
  </section>
}
