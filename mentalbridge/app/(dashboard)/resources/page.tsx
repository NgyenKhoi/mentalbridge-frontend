'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';

const CATEGORIES = ['Tất cả', 'Thở', 'Thiền', 'Ngủ', 'Vận động', 'Tư duy tích cực'];

const RESOURCES = [
  {
    id: 1,
    title: 'Kỹ thuật thở 4-7-8',
    category: 'Thở',
    duration: '5 phút',
    description: 'Kỹ thuật thở giúp giảm căng thẳng và lo âu nhanh chóng',
    icon: '🌬️',
    color: 'var(--teal)'
  },
  {
    id: 2,
    title: 'Thiền chánh niệm buổi sáng',
    category: 'Thiền',
    duration: '10 phút',
    description: 'Bắt đầu ngày mới với tâm trí tỉnh táo và tập trung',
    icon: '🧘',
    color: 'var(--lavender)'
  },
  {
    id: 3,
    title: 'Thư giãn cơ thể trước khi ngủ',
    category: 'Ngủ',
    duration: '15 phút',
    description: 'Giải phóng căng thẳng cơ thể để có giấc ngủ ngon',
    icon: '😴',
    color: 'var(--amber)'
  },
  {
    id: 4,
    title: 'Yoga cho người mới',
    category: 'Vận động',
    duration: '20 phút',
    description: 'Các tư thế yoga cơ bản giúp thư giãn và linh hoạt',
    icon: '🤸',
    color: 'var(--teal)'
  },
  {
    id: 5,
    title: 'Viết nhật ký biết ơn',
    category: 'Tư duy tích cực',
    duration: '5 phút',
    description: 'Ghi nhận những điều tích cực trong ngày',
    icon: '📝',
    color: 'var(--amber)'
  },
  {
    id: 6,
    title: 'Thiền quét cơ thể',
    category: 'Thiền',
    duration: '12 phút',
    description: 'Kết nối với cơ thể và nhận diện các vùng căng thẳng',
    icon: '🎯',
    color: 'var(--lavender)'
  }
];

export default function ResourcesPage() {
  const [selectedCategory, setSelectedCategory] = useState('Tất cả');

  const filteredResources = selectedCategory === 'Tất cả' 
    ? RESOURCES 
    : RESOURCES.filter(r => r.category === selectedCategory);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ 
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(1.8rem, 4vw, 2.4rem)',
          marginBottom: '0.5rem'
        }}>
          Tài nguyên tự chăm sóc
        </h1>
        <p style={{ opacity: 0.7 }}>
          Bài tập và hướng dẫn giúp cải thiện sức khỏe tâm lý
        </p>
      </div>

      {/* Filters */}
      <div style={{ 
        display: 'flex',
        gap: '0.75rem',
        marginBottom: '2rem',
        flexWrap: 'wrap',
        overflowX: 'auto',
        paddingBottom: '0.5rem'
      }}>
        {CATEGORIES.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '999px',
              border: '1.5px solid',
              borderColor: selectedCategory === category ? 'var(--teal)' : 'var(--line)',
              background: selectedCategory === category ? 'var(--teal-pale)' : 'transparent',
              color: selectedCategory === category ? 'var(--teal-deep)' : 'var(--text)',
              fontSize: '0.9rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(.16,1,.3,1)',
              whiteSpace: 'nowrap'
            }}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Resources Grid */}
      <div className="feature-grid">
        {filteredResources.map((resource, index) => (
          <motion.div
            key={resource.id}
            className="feature-card reveal"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            style={{ cursor: 'pointer' }}
          >
            <div 
              className="feature-icon" 
              style={{ 
                background: `${resource.color}15`,
                color: resource.color,
                fontSize: '2rem'
              }}
            >
              {resource.icon}
            </div>

            <h3 className="feature-title">
              {resource.title}
            </h3>

            <div style={{ 
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '0.75rem',
              fontSize: '0.85rem'
            }}>
              <span style={{
                padding: '0.25rem 0.75rem',
                borderRadius: '999px',
                background: `${resource.color}15`,
                color: resource.color,
                fontWeight: 500
              }}>
                {resource.category}
              </span>
              <span style={{ opacity: 0.6, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 6v6l4 2"/>
                </svg>
                {resource.duration}
              </span>
            </div>

            <p className="feature-text">
              {resource.description}
            </p>

            <button 
              className="btn-outline"
              style={{ marginTop: 'auto' }}
            >
              Bắt đầu
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
