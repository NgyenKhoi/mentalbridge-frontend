'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import './assessment.css';

const PHQ9_QUESTIONS = [
  'Ít quan tâm hoặc không vui khi làm việc gì',
  'Cảm thấy buồn chán, chán nản hoặc tuyệt vọng',
  'Khó ngủ, ngủ không say giấc, hoặc ngủ quá nhiều',
  'Cảm thấy mệt mỏi hoặc thiếu năng lượng',
  'Ăn kém hoặc ăn quá nhiều',
  'Cảm thấy tệ về bản thân - hoặc cảm thấy mình là kẻ thất bại hoặc đã làm gia đình thất vọng',
  'Khó tập trung vào việc gì, như đọc báo hoặc xem tivi',
  'Di chuyển hoặc nói chậm đến mức người khác để ý. Hoặc ngược lại - bồn chồn hoặc không yên đến nỗi di chuyển nhiều hơn bình thường',
  'Nghĩ rằng tốt hơn là chết đi hoặc tự làm tổn thương mình theo cách nào đó'
];

const OPTIONS = [
  { label: 'Không bao giờ', value: 0 },
  { label: 'Vài ngày', value: 1 },
  { label: 'Hơn nửa số ngày', value: 2 },
  { label: 'Gần như mỗi ngày', value: 3 }
];

export default function AnonymousAssessment() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<number[]>(Array(9).fill(-1));
  const [showResult, setShowResult] = useState(false);

  const currentQuestion = step;
  const totalScore = answers.reduce((sum, val) => sum + (val > 0 ? val : 0), 0);

  const handleAnswer = (value: number) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = value;
    setAnswers(newAnswers);

    if (step < 8) {
      setTimeout(() => setStep(step + 1), 300);
    } else {
      setTimeout(() => setShowResult(true), 300);
    }
  };

  const getRiskLevel = (score: number) => {
    if (score <= 4) return { level: 'Tối thiểu', color: 'teal', desc: 'Không có dấu hiệu đáng lo ngại' };
    if (score <= 9) return { level: 'Nhẹ', color: 'amber', desc: 'Nên theo dõi thường xuyên' };
    if (score <= 14) return { level: 'Trung bình', color: 'terra', desc: 'Nên gặp chuyên gia tư vấn' };
    if (score <= 19) return { level: 'Khá nặng', color: 'terra', desc: 'Cần hỗ trợ chuyên môn' };
    return { level: 'Nặng', color: 'terra', desc: 'Cần hỗ trợ khẩn cấp' };
  };

  const risk = getRiskLevel(totalScore);

  if (showResult) {
    return (
      <main className="anonymous-assessment assessment-result-page">
        <div className="assessment-breathing-zone" style={{ opacity: 0.4 }}>
          <div className="breathing-circle" />
        </div>

        <motion.div 
          className="anonymous-assessment-card assessment-result-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ maxWidth: '1100px' }}
        >
          <div className="assessment-result-header" style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div className="eyebrow" style={{ color: 'var(--teal)' }}>KẾT QUẢ SÀNG LỌC</div>
            <h1 style={{ 
              fontFamily: 'var(--font-display)', 
              fontSize: 'clamp(1.8rem, 4vw, 2.4rem)',
              marginTop: '0.5rem'
            }}>
              PHQ-9 Depression Screening
            </h1>
          </div>

          <motion.div 
            className={`risk-card ${risk.color}`}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            style={{ marginBottom: '2rem' }}
          >
            <div className="risk-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 6v6l4 2"/>
              </svg>
            </div>
            <div>
              <div className="risk-level">{risk.level}</div>
              <div className="risk-score">Điểm số: {totalScore}/27</div>
              <p style={{ marginTop: '0.5rem', opacity: 0.8 }}>{risk.desc}</p>
            </div>
          </motion.div>

          {totalScore > 9 && (
            <motion.div 
              className="hotline"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              style={{ marginBottom: '1.5rem' }}
            >
              <div className="hotline-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
              </div>
              <div>
                <strong>Đường dây nóng 24/7:</strong> 1800 599 920
              </div>
            </motion.div>
          )}

          <motion.div
            className="assessment-result-signup"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            style={{ 
              padding: '1.5rem',
              background: 'var(--surface-glass)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius)',
              marginBottom: '1.5rem'
            }}
          >
            <h3 style={{ 
              fontFamily: 'var(--font-display)',
              fontSize: '1.1rem',
              marginBottom: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M12 2v20M2 12h20"/>
              </svg>
              Đăng ký để lưu kết quả
            </h3>
            <p style={{ fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1rem', opacity: 0.8 }}>
              Tạo tài khoản để theo dõi xu hướng sức khỏe tâm lý, nhận hỗ trợ cá nhân hóa và kết nối với chuyên gia.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <Link href="/register" className="btn-primary">
                <span>Đăng ký ngay</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </Link>
              <Link href="/login" className="btn-outline">
                Đã có tài khoản
              </Link>
            </div>
          </motion.div>

          <button 
            onClick={() => {
              setStep(0);
              setAnswers(Array(9).fill(-1));
              setShowResult(false);
            }}
            className="btn-ghost assessment-restart"
            style={{ width: '100%' }}
          >
            Làm lại bài kiểm tra
          </button>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="anonymous-assessment">
      <div className="assessment-breathing-zone" style={{ opacity: 0.3 }}>
        <div className="breathing-circle" />
      </div>

      <motion.div 
        className="anonymous-assessment-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ maxWidth: '700px' }}
      >
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div className="eyebrow" style={{ color: 'var(--teal)' }}>BÀI SÀNG LỌC MIỄN PHÍ</div>
          <h1 style={{ 
            fontFamily: 'var(--font-display)', 
            fontSize: 'clamp(1.8rem, 4vw, 2.4rem)',
            marginTop: '0.5rem',
            marginBottom: '0.75rem'
          }}>
            PHQ-9 Depression Assessment
          </h1>
          <p style={{ fontSize: '0.95rem', opacity: 0.7 }}>
            Trong 2 tuần qua, bạn có bị ảnh hưởng bởi các vấn đề sau với tần suất như thế nào?
          </p>
        </div>

        {/* Progress */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            marginBottom: '0.5rem',
            fontSize: '0.9rem',
            fontWeight: 500
          }}>
            <span>Câu hỏi {step + 1}/9</span>
            <span>{Math.round(((step + 1) / 9) * 100)}%</span>
          </div>
          <div style={{ 
            height: '6px',
            background: 'var(--line)',
            borderRadius: '999px',
            overflow: 'hidden'
          }}>
            <motion.div
              style={{ 
                width: '100%',
                height: '100%',
                background: 'var(--teal)',
                borderRadius: '999px',
                transformOrigin: 'left center'
              }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: (step + 1) / 9 }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* Question */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <h2 style={{ 
              fontFamily: 'var(--font-display)',
              fontSize: '1.3rem',
              marginBottom: '1.5rem',
              lineHeight: 1.4
            }}>
              {PHQ9_QUESTIONS[currentQuestion]}
            </h2>

            <div style={{ 
              display: 'grid',
              gap: '0.75rem'
            }}>
              {OPTIONS.map((option) => (
                <motion.button
                  key={option.value}
                  onClick={() => handleAnswer(option.value)}
                  className="btn-outline"
                  style={{ 
                    justifyContent: 'flex-start',
                    padding: '1rem 1.25rem',
                    textAlign: 'left',
                    position: 'relative',
                    background: answers[currentQuestion] === option.value ? 'var(--teal-pale)' : 'transparent',
                    borderColor: answers[currentQuestion] === option.value ? 'var(--teal)' : 'var(--line)'
                  }}
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div style={{ 
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    border: '2px solid',
                    borderColor: answers[currentQuestion] === option.value ? 'var(--teal)' : 'var(--line)',
                    marginRight: '0.75rem',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {answers[currentQuestion] === option.value && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        style={{ 
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          background: 'var(--teal)'
                        }}
                      />
                    )}
                  </div>
                  <span style={{ flex: 1 }}>{option.label}</span>
                </motion.button>
              ))}
            </div>

            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="btn-ghost"
                style={{ marginTop: '1.5rem', width: '100%' }}
              >
                ← Câu trước
              </button>
            )}
          </motion.div>
        </AnimatePresence>

        <div style={{ 
          marginTop: '2rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid var(--line)',
          textAlign: 'center',
          fontSize: '0.85rem',
          opacity: 0.6
        }}>
          Bài kiểm tra này không thay thế chẩn đoán y khoa chuyên môn
        </div>
      </motion.div>
    </main>
  );
}
