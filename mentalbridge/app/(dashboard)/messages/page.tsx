'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import './messages.css';

const CONVERSATIONS = [
  {
    id: 1,
    name: 'TS. Nguyễn Thị Lan',
    avatar: '👩‍⚕️',
    lastMessage: 'Buổi tư vấn tiếp theo của chúng ta là thứ 5 lúc 10h nhé!',
    time: '2h',
    unread: 0,
    online: true
  },
  {
    id: 2,
    name: 'Hỗ trợ MentalBridge',
    avatar: '💬',
    lastMessage: 'Cảm ơn bạn đã liên hệ. Chúng tôi sẽ phản hồi sớm!',
    time: '1 ngày',
    unread: 0,
    online: false
  },
  {
    id: 3,
    name: 'ThS. Trần Văn Minh',
    avatar: '👨‍⚕️',
    lastMessage: 'Hãy tiếp tục ghi nhật ký mỗi ngày bạn nhé',
    time: '3 ngày',
    unread: 2,
    online: false
  }
];

const CHAT_MESSAGES = [
  {
    id: 1,
    sender: 'bot',
    content: 'Chào bạn! Tôi đã xem nhật ký của bạn tuần này. Có vẻ như bạn đang có nhiều tiến bộ tích cực.',
    time: '10:15'
  },
  {
    id: 2,
    sender: 'user',
    content: 'Dạ vâng, em cảm thấy tốt hơn nhiều sau khi áp dụng các kỹ thuật thầy hướng dẫn.',
    time: '10:17'
  },
  {
    id: 3,
    sender: 'bot',
    content: 'Tuyệt vời! Điều đó cho thấy bạn đang thực hành đều đặn. Hãy tiếp tục duy trì nhé.',
    time: '10:18'
  },
  {
    id: 4,
    sender: 'user',
    content: 'Em muốn hỏi về buổi tư vấn tiếp theo ạ.',
    time: '10:20'
  },
  {
    id: 5,
    sender: 'bot',
    content: 'Buổi tư vấn tiếp theo của chúng ta là thứ 5 lúc 10h nhé!',
    time: '10:22'
  }
];

export default function MessagesPage() {
  const [selectedConv, setSelectedConv] = useState(1);
  const [message, setMessage] = useState('');

  return (
    <div className="messages-page" style={{
      display: 'grid',
      gridTemplateColumns: '320px 1fr',
      gap: '1.5rem',
      height: 'calc(100vh - 140px)',
      maxHeight: '800px'
    }}>
      {/* Conversations List */}
      <div className="feature-card messages-list-panel" style={{
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '100%'
      }}>
        <h2 style={{ 
          fontFamily: 'var(--font-display)',
          fontSize: '1.3rem',
          marginBottom: '1rem',
          padding: '0 0.5rem'
        }}>
          Tin nhắn
        </h2>

        <div style={{ 
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}>
          {CONVERSATIONS.map((conv) => (
            <motion.button
              className={`message-conversation${selectedConv === conv.id ? ' is-selected' : ''}`}
              key={conv.id}
              onClick={() => setSelectedConv(conv.id)}
              whileHover={{ x: 4 }}
              style={{
                padding: '1rem',
                borderRadius: 'var(--radius)',
                border: '1px solid',
                borderColor: selectedConv === conv.id ? 'var(--teal)' : 'var(--line)',
                background: selectedConv === conv.id ? 'var(--teal-pale)' : 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                position: 'relative',
                transition: 'all 0.2s cubic-bezier(.16,1,.3,1)'
              }}
            >
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div style={{ position: 'relative' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: 'var(--surface-glass)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem',
                    flexShrink: 0
                  }}>
                    {conv.avatar}
                  </div>
                  {conv.online && (
                    <div className="message-online-dot" style={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: 'var(--terracotta)',
                      border: '2px solid var(--bg)'
                    }} />
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ 
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    marginBottom: '0.25rem'
                  }}>
                    <div className="message-conversation-name" style={{
                      fontWeight: 600,
                      fontSize: '0.95rem'
                    }}>
                      {conv.name}
                    </div>
                    <div className="message-conversation-time" style={{
                      fontSize: '0.75rem',
                      opacity: 0.6
                    }}>
                      {conv.time}
                    </div>
                  </div>

                  <div className="message-conversation-preview" style={{
                    fontSize: '0.85rem',
                    opacity: 0.7,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {conv.lastMessage}
                  </div>
                </div>

                {conv.unread > 0 && (
                  <div style={{
                    minWidth: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: 'var(--amber)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 600
                  }}>
                    {conv.unread}
                  </div>
                )}
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="feature-card messages-chat-panel" style={{
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '100%'
      }}>
        {/* Chat Header */}
        <div className="messages-chat-header" style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'var(--teal-pale)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem'
          }}>
            👩‍⚕️
          </div>
          <div>
            <h3 style={{ 
              fontFamily: 'var(--font-display)',
              fontSize: '1.1rem',
              marginBottom: '0.25rem'
            }}>
              TS. Nguyễn Thị Lan
            </h3>
            <div className="messages-online-label" style={{
              fontSize: '0.85rem',
              opacity: 0.6,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: 'var(--terracotta)'
              }} />
              Đang hoạt động
            </div>
          </div>
        </div>

        {/* Messages */}
        <div style={{ 
          flex: 1,
          overflowY: 'auto',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          {CHAT_MESSAGES.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                display: 'flex',
                justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start'
              }}
            >
              <div style={{
                maxWidth: '70%',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem'
              }}>
                <div
                  className={msg.sender === 'bot' ? 'chat-bubble bot' : 'chat-bubble user'}
                >
                  {msg.content}
                </div>
                <div className="message-time" style={{
                  fontSize: '0.75rem',
                  opacity: 0.5,
                  textAlign: msg.sender === 'user' ? 'right' : 'left',
                  paddingLeft: msg.sender === 'bot' ? '1rem' : 0,
                  paddingRight: msg.sender === 'user' ? '1rem' : 0
                }}>
                  {msg.time}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Input */}
        <div className="messages-composer" style={{
          padding: '1.25rem 1.5rem',
          borderTop: '1px solid var(--line)',
          background: 'var(--surface-glass)'
        }}>
          <div style={{ 
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'flex-end'
          }}>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Nhập tin nhắn..."
              rows={1}
              style={{
                flex: 1,
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--line)',
                fontFamily: 'var(--font-body)',
                fontSize: '0.95rem',
                resize: 'none',
                maxHeight: '120px'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  // Send message
                }
              }}
            />
            <button 
              className="btn-primary"
              style={{ 
                padding: '0.75rem 1.5rem',
                flexShrink: 0
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
              </svg>
              <span>Gửi</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
