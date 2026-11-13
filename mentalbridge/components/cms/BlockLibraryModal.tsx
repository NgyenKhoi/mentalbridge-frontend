'use client'

import { useMemo, useState } from 'react'
import {
  Search,
  Check,
  Plus,
  X,
  Sparkles,
  Layers,
  Lock,
  Compass,
  Volume2,
  Video,
  ListChecks,
  Quote,
  ShieldAlert,
  FileCheck2,
  Sliders,
  Wind,
} from 'lucide-react'
import {
  BLOCK_LIBRARY_ITEMS,
  PRESET_TEMPLATES,
  type CmsBlockCategory,
  type CmsBlockType,
  type PresetTemplateDef,
} from './cms-types'
import styles from './cms-editor.module.css'

type Props = {
  isOpen: boolean
  onClose: () => void
  activeBlocks: CmsBlockType[]
  onAddBlock: (blockType: CmsBlockType) => void
  onApplyPreset: (preset: PresetTemplateDef) => void
}

const CATEGORY_TABS: { id: CmsBlockCategory; label: string }[] = [
  { id: 'all', label: 'Tất cả khối' },
  { id: 'content', label: 'Nội dung & Dẫn dắt' },
  { id: 'interactive', label: 'Tương tác tự chăm sóc' },
  { id: 'media', label: 'Đa phương tiện & Video' },
  { id: 'safety', label: 'Y văn & An toàn' },
]

export default function BlockLibraryModal({
  isOpen,
  onClose,
  activeBlocks,
  onAddBlock,
  onApplyPreset,
}: Props) {
  const [modalTab, setModalTab] = useState<'single' | 'presets'>('single')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] =
    useState<CmsBlockCategory>('all')

  const filteredBlocks = useMemo(() => {
    return BLOCK_LIBRARY_ITEMS.filter((item) => {
      const matchCategory =
        selectedCategory === 'all' || item.group === selectedCategory
      const query = searchQuery.trim().toLowerCase()
      const matchSearch =
        !query ||
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.badge.toLowerCase().includes(query)
      return matchCategory && matchSearch
    })
  }, [selectedCategory, searchQuery])

  if (!isOpen) return null

  return (
    <div className={styles.modalOverlay} onClick={onClose} role="dialog" aria-modal="true">
      <div
        className={styles.modalContent}
        onClick={(e) => e.stopPropagation()}
        aria-labelledby="block-library-title"
      >
        {/* Modal Header */}
        <header className={styles.modalHeader}>
          <div className={styles.modalHeaderTitleGroup}>
            <div className={styles.modalIconBadge}>
              <Layers size={20} className={styles.modalIcon} />
            </div>
            <div>
              <div className={styles.modalHeadingRow}>
                <h2 id="block-library-title" className={styles.modalTitle}>
                  Thư viện khối nội dung MentalBridge
                </h2>
                <span className={styles.versionBadge}>v2.4 Modular</span>
              </div>
              <p className={styles.modalSubtitle}>
                Chọn khối chức năng đơn lẻ hoặc áp dụng nhanh các gói mẫu dựng sẵn chuẩn y khoa
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={styles.modalCloseButton}
            aria-label="Đóng thư viện"
          >
            <X size={18} />
          </button>
        </header>

        {/* Tab switch: Single Blocks vs Presets */}
        <div className={styles.modalTabBar}>
          <div className={styles.modalTabsLeft}>
            <button
              type="button"
              className={`${styles.modalTabButton} ${modalTab === 'single' ? styles.modalTabActive : ''}`}
              onClick={() => setModalTab('single')}
            >
              <Layers size={15} />
              <span>Khối đơn lẻ ({BLOCK_LIBRARY_ITEMS.length})</span>
            </button>
            <button
              type="button"
              className={`${styles.modalTabButton} ${modalTab === 'presets' ? styles.modalTabActive : ''}`}
              onClick={() => setModalTab('presets')}
            >
              <Sparkles size={15} />
              <span>Gói mẫu dựng sẵn (Presets)</span>
            </button>
          </div>

          {modalTab === 'single' && (
            <div className={styles.modalSearchBox}>
              <Search size={14} className={styles.modalSearchIcon} />
              <input
                type="text"
                placeholder="Tìm tên khối hoặc tính năng..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.modalSearchInput}
              />
            </div>
          )}
        </div>

        {/* Body */}
        {modalTab === 'single' ? (
          <div className={styles.modalBodySingle}>
            {/* Category Filter Chips */}
            <div className={styles.categoryChipsBar}>
              {CATEGORY_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`${styles.categoryChip} ${selectedCategory === tab.id ? styles.categoryChipActive : ''}`}
                  onClick={() => setSelectedCategory(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* 3x3 Cards Grid */}
            <div className={styles.blocksGrid}>
              {filteredBlocks.map((block) => {
                const isInArticle = activeBlocks.includes(block.id)

                return (
                  <div
                    key={block.id}
                    className={`${styles.blockCard} ${isInArticle ? styles.blockCardInArticle : ''}`}
                  >
                    <div className={styles.blockCardTop}>
                      <span className={styles.blockNumberBadge}>{block.number}</span>
                      <span
                        className={`${styles.blockTagBadge} ${
                          block.badgeTone === 'danger'
                            ? styles.badgeDanger
                            : block.badgeTone === 'success'
                              ? styles.badgeSuccess
                              : block.badgeTone === 'purple'
                                ? styles.badgePurple
                                : styles.badgeNeutral
                        }`}
                      >
                        {block.isRequired && <Lock size={11} className={styles.lockIcon} />}
                        {block.badge}
                      </span>
                    </div>

                    <h3 className={styles.blockCardTitle}>{block.title}</h3>
                    <p className={styles.blockCardDesc}>{block.description}</p>

                    <div className={styles.blockCardFooter}>
                      <div className={styles.blockCardSub}>
                        {isInArticle ? (
                          <span className={styles.inArticleLabel}>
                            <Check size={13} strokeWidth={2.5} />
                            Đang trong bài
                          </span>
                        ) : (
                          <span className={styles.subtextHint}>{block.subText}</span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => onAddBlock(block.id)}
                        className={`${styles.insertBtn} ${
                          isInArticle ? styles.insertBtnSecondary : styles.insertBtnPrimary
                        }`}
                      >
                        <Plus size={13} />
                        {isInArticle ? 'Chèn' : 'Chèn vào bài'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          /* Presets Tab */
          <div className={styles.modalBodyPresets}>
            <div className={styles.presetsList}>
              {PRESET_TEMPLATES.map((preset) => (
                <div key={preset.id} className={styles.presetCard}>
                  <div className={styles.presetCardHeader}>
                    <div>
                      <div className={styles.presetHeadingRow}>
                        <h3 className={styles.presetName}>{preset.name}</h3>
                        <span className={styles.presetBadge}>{preset.badge}</span>
                      </div>
                      <p className={styles.presetDesc}>{preset.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onApplyPreset(preset)}
                      className={styles.applyPresetBtn}
                    >
                      <Sparkles size={14} />
                      Áp dụng mẫu này
                    </button>
                  </div>

                  <div className={styles.presetBlocksPreview}>
                    <span className={styles.presetBlocksLabel}>Các khối bao gồm:</span>
                    <div className={styles.presetBlocksChips}>
                      {preset.blocks.map((blockId) => {
                        const def = BLOCK_LIBRARY_ITEMS.find((b) => b.id === blockId)
                        return (
                          <span key={blockId} className={styles.presetBlockChip}>
                            {def?.title || blockId}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <footer className={styles.modalFooter}>
          <div className={styles.modalTip}>
            <span className={styles.tipIcon}>💡</span>
            <span>Mẹo: Bạn có thể kéo thả để sắp xếp lại thứ tự các khối sau khi chèn.</span>
          </div>
          <button type="button" onClick={onClose} className={styles.modalCloseFooterBtn}>
            Đóng thư viện
          </button>
        </footer>
      </div>
    </div>
  )
}
