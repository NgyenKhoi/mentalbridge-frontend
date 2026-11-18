import { router } from 'expo-router'
import { useState, type ReactNode } from 'react'
import {
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { PrimaryButton } from '@/components/PrimaryButton'
import { colors } from '@/theme/tokens'

import { HelpNowPanel } from './AssessmentJourneyScreen'
import type { AssessmentApi } from './assessment-api'
import type { ScreeningHistoryEpisode } from './assessment-history-api'

const dark = '#163B33'
const dateTime = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  dateStyle: 'short',
  timeStyle: 'medium',
})

function Disclosure({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <View style={s.soft}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((current) => !current)}
        style={s.row}
      >
        <Text style={[s.label, s.flex]}>{title}</Text>
        <Text style={s.label} aria-hidden>
          {open ? '⌃' : '⌄'}
        </Text>
      </Pressable>
      {open && <View style={s.disclosed}>{children}</View>}
    </View>
  )
}

function ScoreScale({
  record,
}: {
  record: ScreeningHistoryEpisode['evidence'][number]
}) {
  const phq = record.instrument === 'PHQ9'
  const bands = [
    ['Tối thiểu', '0–4', 'MINIMAL'],
    ['Nhẹ', '5–9', 'MILD'],
    ['Trung bình', '10–14', 'MODERATE'],
    ...(phq ? [['Khá nặng', '15–19', 'MODERATELY_SEVERE']] : []),
    ['Nặng', phq ? '20–27' : '15–21', 'SEVERE'],
  ]
  const currentLevel = record.screeningLevel
  const selected = bands.find((band) => band[2] === currentLevel)
  return (
    <View style={s.group}>
      <View style={s.row}>
        <Text style={[s.label, s.flex]}>
          {phq ? 'Dấu hiệu trầm cảm' : 'Dấu hiệu lo âu'}
        </Text>
        {record.state === 'AVAILABLE' &&
          selected &&
          record.totalScore !== null && (
            <Text style={s.badge}>
              {selected[0]} ({selected[1]})
            </Text>
          )}
      </View>
      {record.state === 'AVAILABLE' && selected ? (
        <View style={s.bands}>
          {bands.map(([label, range, level]) => (
            <View key={level} style={s.band}>
              <View
                style={[s.track, level === currentLevel && s.activeTrack]}
              />
              <Text style={[s.caption, level === currentLevel && s.label]}>
                {label}
              </Text>
              <Text style={s.caption}>{range}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={s.body}>Chưa có kết quả để hiển thị.</Text>
      )}
    </View>
  )
}

export function AssessmentSupportPanel({
  rows,
  api,
  headingFont,
  loadMore,
  onResult,
  onGuide,
}: {
  rows: ScreeningHistoryEpisode[]
  api: AssessmentApi
  headingFont: string | undefined
  loadMore?: (() => void) | undefined
  onResult: (row: ScreeningHistoryEpisode) => void
  onGuide: (id: string, evaluationId: string) => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const row = rows.find((item) => item.episodeId === selectedId) ?? rows[0]
  if (!row) {
    return (
      <View style={s.card}>
        <Text style={s.body}>
          Chưa có lượt sàng lọc hoàn thành. Bạn có thể xem các tài nguyên hỗ trợ
          hiện tại.
        </Text>
        <PrimaryButton
          tone="dashboard"
          label="Xem tài nguyên hiện tại"
          onPress={() => router.push('/(user)/resources')}
        />
        {loadMore && (
          <PrimaryButton
            tone="light"
            label="Tải thêm lượt sàng lọc"
            onPress={loadMore}
          />
        )}
      </View>
    )
  }

  const meaning = row.meaning
  const guideId = meaning?.supportGuideId
  const safety =
    meaning?.presentationPriority === 'SAFETY' ||
    row.evidence.some(
      (record) => record.safetyStatus === 'POSITIVE_SAFETY_SCREEN',
    )
  const timestamp = (item: ScreeningHistoryEpisode) =>
    dateTime.format(new Date(item.completedAt ?? item.startedAt))
  const purpose =
    row.purpose === 'REASSESSMENT' ? 'Đánh giá lại' : 'Kiểm tra ban đầu'

  return (
    <>
      <View style={s.card}>
        <View style={s.row}>
          <Text style={[s.label, s.flex]}>▦ Chọn lần sàng lọc</Text>
          <Pressable
            accessibilityRole="button"
            style={s.touch}
            onPress={() => onResult(row)}
          >
            <Text style={s.link}>Mở kết quả ↗</Text>
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: picking }}
          onPress={() => setPicking((value) => !value)}
          style={[s.selector, s.row]}
        >
          <Text style={[s.label, s.flex]}>{timestamp(row)}</Text>
          <Text style={s.label} aria-hidden>
            {picking ? '⌃' : '⌄'}
          </Text>
        </Pressable>
        {picking && (
          <View accessibilityRole="radiogroup" style={s.group}>
            {rows.map((item) => (
              <Pressable
                key={item.episodeId}
                accessibilityRole="radio"
                accessibilityState={{
                  checked: item.episodeId === row.episodeId,
                }}
                onPress={() => {
                  setSelectedId(item.episodeId)
                  setPicking(false)
                }}
                style={[s.selector, item.episodeId === row.episodeId && s.mint]}
              >
                <Text style={s.label}>{timestamp(item)}</Text>
              </Pressable>
            ))}
            {loadMore && (
              <PrimaryButton
                tone="light"
                label="Tải thêm lượt sàng lọc"
                onPress={loadMore}
              />
            )}
          </View>
        )}
      </View>

      <View style={s.card}>
        <Text style={s.label}>
          {purpose} · {timestamp(row)}
        </Text>
        {!guideId && (
          <Text style={s.info}>
            ⓘ Lần sàng lọc này chưa có gợi ý đã lưu. Bạn có thể xem các lựa chọn
            hỗ trợ hiện tại bên dưới.
          </Text>
        )}
        {safety && (
          <HelpNowPanel
            key={row.episodeId}
            api={api}
            defaultTrigger="POSITIVE_ITEM_9"
            {...(meaning?.safetyGuidance
              ? { guidance: meaning.safetyGuidance }
              : {})}
          />
        )}
        {!safety && meaning && (
          <ImageBackground
            source={require('../../assets/resource-covers/resource-mindfulness.webp')}
            style={s.hero}
          >
            <View style={s.heroCaption}>
              <Text style={[s.heroText, { fontFamily: headingFont }]}>
                {meaning.baseMeaning.text}
              </Text>
            </View>
          </ImageBackground>
        )}
        {row.evidence.map((record) => (
          <ScoreScale key={record.instrument} record={record} />
        ))}
        {meaning && (
          <View style={s.infoBox}>
            <Text style={s.label}>♧ Độ tin cậy kết quả</Text>
            <Text style={s.body}>{meaning.nextStep.boundary}</Text>
            {!safety && <Text style={s.body}>{meaning.nextStep.text}</Text>}
          </View>
        )}
        {meaning && guideId ? (
          <PrimaryButton
            tone="dashboard"
            label="Xem gợi ý đã lưu"
            onPress={() => onGuide(guideId, meaning.supportEvaluationId)}
          />
        ) : (
          <PrimaryButton
            tone="dashboard"
            label="Xem tài nguyên hiện tại"
            onPress={() => router.push('/(user)/resources')}
          />
        )}
        {!safety && meaning && (
          <Disclosure title="Vì sao có gợi ý này?">
            <Text style={s.body}>{meaning.baseMeaning.rationale}</Text>
          </Disclosure>
        )}
        <Disclosure title="Xem chi tiết điểm số và giới hạn công cụ">
          {row.evidence.map(
            (record) =>
              record.state === 'AVAILABLE' &&
              record.totalScore !== null && (
                <Text key={record.instrument} style={s.label}>
                  {record.instrument === 'PHQ9' ? 'PHQ-9' : 'GAD-7'} ·{' '}
                  {record.totalScore}/{record.instrument === 'PHQ9' ? 27 : 21}
                </Text>
              ),
          )}
          <Text style={s.body}>
            {meaning?.disclaimer ??
              'Sàng lọc chỉ để tham khảo và không thay thế chẩn đoán y khoa.'}
          </Text>
          <PrimaryButton
            tone="light"
            label="Mở kết quả"
            onPress={() => onResult(row)}
          />
        </Disclosure>
      </View>
      <View style={s.infoBox}>
        <Text style={s.body}>
          Nếu bạn lo lắng về tình trạng của mình, bạn có thể chủ động trao đổi
          với chuyên gia tâm lý.
        </Text>
        <Pressable
          accessibilityRole="link"
          style={[s.touch, s.end]}
          onPress={() => router.push('/(user)/specialists')}
        >
          <Text style={s.link}>Tìm chuyên gia →</Text>
        </Pressable>
      </View>
    </>
  )
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 21,
    padding: 14,
    gap: 14,
    borderColor: colors.line,
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'space-between',
  },
  flex: { flex: 1, minWidth: 0 },
  end: { alignSelf: 'flex-end' },
  touch: { minHeight: 44, justifyContent: 'center' },
  selector: {
    minHeight: 46,
    padding: 10,
    justifyContent: 'space-between',
    backgroundColor: '#F0F2ED',
    borderRadius: 6,
  },
  mint: { backgroundColor: '#DBEBE4' },
  label: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  link: { color: dark, fontSize: 13, fontWeight: '700' },
  body: { color: colors.inkSoft, fontSize: 13, lineHeight: 20 },
  caption: { color: colors.inkSoft, fontSize: 11, lineHeight: 15 },
  group: { gap: 7 },
  badge: {
    color: dark,
    backgroundColor: '#DCEDE4',
    borderRadius: 14,
    overflow: 'hidden',
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  bands: { flexDirection: 'row', gap: 5 },
  band: { flex: 1, gap: 3 },
  track: { height: 6, borderRadius: 3, backgroundColor: '#E7E9E3' },
  activeTrack: { backgroundColor: dark },
  info: {
    backgroundColor: '#E5F2ED',
    color: dark,
    padding: 12,
    fontSize: 13,
    lineHeight: 20,
  },
  infoBox: { backgroundColor: '#F0F2ED', padding: 12, gap: 6 },
  hero: {
    minHeight: 158,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    borderRadius: 6,
  },
  heroCaption: { backgroundColor: 'rgba(13, 44, 35, 0.86)', padding: 12 },
  heroText: { color: '#fff', fontWeight: '600', fontSize: 16, lineHeight: 23 },
  soft: { backgroundColor: '#F0F2ED', paddingHorizontal: 10, borderRadius: 6 },
  disclosed: { paddingBottom: 10, gap: 8 },
})
