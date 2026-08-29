'use client';
import { useState } from 'react';
import ConsultationNotesViewer from '@/components/ConsultationNotesViewer';
import ConsultationNotesModal, { type ConsultationNote } from '@/components/ConsultationNotesModal';
import './page.css';

export default function ConsultationNotesDemoPage() {
  const [currentNotes, setCurrentNotes] = useState<ConsultationNote | undefined>();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSaveNotes = (noteData: Omit<ConsultationNote, 'id' | 'createdAt' | 'updatedAt'>) => {
    const timestamp = new Date().toISOString();
    const savedNote: ConsultationNote = {
      id: `note_demo_${Date.now()}`,
      ...noteData,
      createdAt: currentNotes?.createdAt || timestamp,
      updatedAt: timestamp
    };
    setCurrentNotes(savedNote);
    setIsModalOpen(false);
  };

  const mockExistingNotes: ConsultationNote = {
    id: 'note_existing',
    appointmentId: '1',
    clientName: 'Nguyễn Minh Anh',
    date: '26/08/2026',
    time: '10:30 - 11:15',
    sessionSummary: 'Phiên tư vấn tập trung vào việc thảo luận về tình trạng lo âu và stress trong công việc. Khách hàng thể hiện sự cải thiện đáng kể so với các phiên trước, có khả năng nhận diện và quản lý cảm xúc tốt hơn.',
    keyObservations: 'Khách hàng có dấu hiệu tích cực hơn trong giao tiếp, tự tin hơn khi chia sẻ. Vẫn còn một số lo lắng về hiệu suất công việc nhưng đã phát triển được các phương pháp đối phó hiệu quả như kỹ thuật thở sâu và tư duy tích cực.',
    recommendations: 'Tiếp tục thực hiện các kỹ thuật mindfulness đã học, đặc biệt là bài tập thở sâu trước các cuộc họp quan trọng. Tăng cường hoạt động thể chất ít nhất 30 phút/ngày và duy trì lịch ngủ ổn định từ 22:30-6:30.',
    nextSteps: 'Theo dõi tiến triển trong 2 tuần tới thông qua nhật ký cảm xúc hàng ngày. Khách hàng sẽ thực hiện bài tập CBT về tái cấu trúc tư duy tiêu cực. Lên kế hoạch thảo luận về mối quan hệ gia đình trong phiên tiếp theo.',
    riskLevel: 'low',
    followUpDate: '2026-09-09',
    confidentialNotes: 'Khách hàng đã chia sẻ về những khó khăn trong mối quan hệ với cấp trên và áp lực từ gia đình về việc thăng tiến. Cần tiếp tục hỗ trợ trong việc xây dựng ranh giới cá nhân và kỹ năng giao tiếp assertive.',
    createdAt: '2026-08-26T15:30:00Z'
  };

  return (
    <div className="consultation-notes-demo">
      <div className="demo-container">
        <header className="demo-header">
          <div>
            <h1>Ghi chú tư vấn chuyên môn</h1>
            <p>Demo giao diện thêm và quản lý ghi chú tư vấn cho chuyên gia</p>
          </div>
        </header>

        <section className="demo-section">
          <div className="demo-section-header">
            <h2>Trường hợp 1: Chưa có ghi chú</h2>
            <p>Hiển thị khi phiên tư vấn chưa có ghi chú</p>
          </div>
          <div className="demo-card">
            <ConsultationNotesViewer
              appointmentId="demo1"
              clientName="Lê Hoàng Nam"
              date="Thứ Ba, 27 tháng 8, 2026"
              time="14:00 - 14:45"
              onNotesUpdate={setCurrentNotes}
            />
          </div>
        </section>

        <section className="demo-section">
          <div className="demo-section-header">
            <h2>Trường hợp 2: Đã có ghi chú</h2>
            <p>Hiển thị khi phiên tư vấn đã có ghi chú hoàn chỉnh</p>
          </div>
          <div className="demo-card">
            <ConsultationNotesViewer
              appointmentId="demo2"
              clientName="Nguyễn Minh Anh"
              date="Thứ Hai, 26 tháng 8, 2026"
              time="10:30 - 11:15"
              notes={mockExistingNotes}
              onNotesUpdate={setCurrentNotes}
            />
          </div>
        </section>

        <section className="demo-section">
          <div className="demo-section-header">
            <h2>Trường hợp 3: Ghi chú do người dùng tạo</h2>
            <p>Ghi chú được tạo thông qua demo này</p>
          </div>
          <div className="demo-card">
            <ConsultationNotesViewer
              appointmentId="demo3"
              clientName="Phạm Thảo Vy"
              date="Chủ Nhật, 25 tháng 8, 2026"
              time="09:00 - 09:45"
              notes={currentNotes}
              onNotesUpdate={setCurrentNotes}
            />
          </div>
        </section>

        <section className="demo-section">
          <div className="demo-section-header">
            <h2>Modal thêm ghi chú</h2>
            <p>Form nhập ghi chú tư vấn chi tiết</p>
          </div>
          <div className="demo-card demo-card-center">
            <button 
              className="demo-open-modal-btn"
              onClick={() => setIsModalOpen(true)}
            >
              Mở form thêm ghi chú
            </button>
          </div>
        </section>

        {isModalOpen && (
          <ConsultationNotesModal
            appointmentId="demo-modal"
            clientName="Demo Khách Hàng"
            date="Hôm nay"
            time="15:00 - 15:45"
            onClose={() => setIsModalOpen(false)}
            onSave={handleSaveNotes}
          />
        )}
      </div>
    </div>
  );
}