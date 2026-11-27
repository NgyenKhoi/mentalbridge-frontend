import { useQuery } from '@tanstack/react-query'
import type { AxiosInstance } from 'axios'
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { useDashboardFonts } from '@/theme/useDashboardFonts'

import { specialistAnalyticsSchema } from './specialist-analytics-contract'

const dark = '#143A32'
const muted = '#52645C'
const mint = '#DEEDE4'
const periods = [7, 30, 90] as const
const ticks = Array.from({ length: 73 }, (_, index) => {
  const angle = (Math.PI * index) / 72
  return {
    angle,
    left: 76 - 65 * Math.cos(angle),
    top: 77 - 65 * Math.sin(angle),
  }
})
const events = [
  ['requestedCount', 'Yêu cầu mới', 'Yêu cầu được gửi đến', '✉'],
  ['acceptedCount', 'Đã chấp nhận', 'Lịch đã xác nhận', '▦'],
  ['completedCount', 'Đã hoàn thành', 'Phiên đã hoàn tất', '✓'],
  ['rejectedCount', 'Từ chối', 'Yêu cầu bị từ chối', '×'],
  ['expiredCount', 'Hết hạn', 'Quá hạn tiếp nhận', '⌛'],
  ['cancelledCount', 'Đã hủy', 'Lịch đã hủy', '⊘'],
] as const
const number = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 })

function readable(section: { state: string } | undefined) {
  return section?.state === 'AVAILABLE' || section?.state === 'EMPTY'
}

function value(amount: number | null | undefined) {
  return amount == null ? '—' : number.format(amount)
}

function money(
  amount: number | null | undefined,
  currency: string | null | undefined,
) {
  if (amount == null || !currency) return '—'
  const format = new Intl.NumberFormat('vi-VN', { style: 'currency', currency })
  return format.format(
    amount / 10 ** (format.resolvedOptions().maximumFractionDigits ?? 0),
  )
}

function timestamp(date: string, timezone: string, showTime = false) {
  const options: Intl.DateTimeFormatOptions = {
    dateStyle: 'short',
    ...(showTime ? { timeStyle: 'short' } : {}),
  }
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      ...options,
      timeZone: timezone,
    }).format(new Date(date))
  } catch {
    return new Intl.DateTimeFormat('vi-VN', {
      ...options,
      timeZone: 'Asia/Ho_Chi_Minh',
    }).format(new Date(date))
  }
}

function UtilizationGauge({ rate }: { rate: number | null | undefined }) {
  const count = rate == null ? 0 : Math.round((rate / 100) * (ticks.length - 1))
  return (
    <View
      style={s.gauge}
      accessible
      accessibilityLabel={
        rate == null ? 'Chưa có tỷ lệ lấp đầy' : `Tỷ lệ lấp đầy ${value(rate)}%`
      }
    >
      {ticks.map(({ angle, left, top }, index) => (
        <View
          key={angle}
          style={[
            s.tick,
            { left, top },
            rate != null && rate > 0 && index <= count && s.tickActive,
          ]}
        />
      ))}
      <Text aria-hidden style={s.gaugeValue}>
        {rate == null ? '—' : `${value(rate)}%`}
      </Text>
      <Text aria-hidden style={s.small}>
        Tỷ lệ lấp đầy
      </Text>
      <View style={s.gaugeScale} aria-hidden>
        <Text style={s.small}>0%</Text>
        <Text style={s.small}>100%</Text>
      </View>
    </View>
  )
}

export function SpecialistAnalyticsPanel({
  api,
  subject,
}: {
  api: AxiosInstance
  subject: string | undefined
}) {
  const [days, setDays] = useState<(typeof periods)[number]>(30)
  const [showRange, setShowRange] = useState(false)
  const [finance, setFinance] = useState(false)
  const fonts = useDashboardFonts()
  const serif = fonts && s.serif
  const query = useQuery({
    queryKey: ['specialist-analytics', subject, days],
    enabled: Boolean(subject),
    queryFn: async ({ signal }) => {
      const now = Date.now()
      const params =
        days === 30
          ? undefined
          : {
              from: new Date(now - days * 86_400_000).toISOString(),
              to: new Date(now).toISOString(),
            }
      const response = await api.get('/api/v1/specialist/analytics', {
        params,
        signal,
      })
      return specialistAnalyticsSchema.parse(response.data)
    },
  })
  const refresh = query.refetch
  useFocusEffect(
    useCallback(() => {
      if (subject) void refresh({ cancelRefetch: false })
    }, [refresh, subject]),
  )

  const data = query.data
  const slots = readable(data?.availability) ? data?.availability : undefined
  const appointments = readable(data?.appointments)
    ? data?.appointments
    : undefined
  const rating = readable(data?.rating) ? data?.rating : undefined
  const financial = readable(data?.financials) ? data?.financials : undefined
  const range =
    data &&
    `${timestamp(data.period.from, data.period.timezone)} – ${timestamp(data.period.to, data.period.timezone)}`

  return (
    <View style={s.page}>
      {data?.operationalStatus === 'READY' && (
        <Text style={s.badge}>● HỒ SƠ ĐÃ ĐƯỢC DUYỆT</Text>
      )}
      <Text accessibilityRole="header" style={[s.title, serif]}>
        Phân tích vận hành
      </Text>
      {data && (
        <Text style={s.small}>
          Cập nhật lúc {timestamp(data.generatedAt, data.period.timezone, true)}
        </Text>
      )}
      <View accessibilityRole="tablist" style={s.segment}>
        {periods.map((period) => (
          <Pressable
            key={period}
            accessibilityRole="tab"
            accessibilityState={{ selected: days === period }}
            onPress={() => setDays(period)}
            style={[s.segmentItem, days === period && s.segmentActive]}
          >
            <Text style={[s.body, days === period && s.light]}>
              {period} ngày
            </Text>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Xem khoảng ngày thống kê"
          accessibilityState={{ expanded: showRange }}
          onPress={() => setShowRange(!showRange)}
          style={s.calendar}
        >
          <Text style={s.body} aria-hidden>
            ▦
          </Text>
        </Pressable>
      </View>
      {showRange && (
        <Text style={s.small}>{range ?? `${days} ngày gần nhất`}</Text>
      )}
      {query.isPending && (
        <ActivityIndicator
          accessibilityLabel="Đang tải phân tích vận hành"
          color={dark}
        />
      )}
      {query.isError && (
        <View style={s.card}>
          <Text accessibilityLiveRegion="polite" style={s.body}>
            Chưa tải được dữ liệu phân tích.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void refresh()}
            style={s.softAction}
          >
            <Text style={s.actionText}>Thử tải lại</Text>
          </Pressable>
        </View>
      )}

      {data && (
        <>
          <View style={s.card}>
            <View style={s.row}>
              <Text style={s.icon} aria-hidden>
                ◴
              </Text>
              <View style={s.fill}>
                <Text style={s.kicker}>LỊCH KHẢ DỤNG</Text>
                <Text accessibilityRole="header" style={[s.heading, serif]}>
                  Hiệu suất khai thác
                </Text>
              </View>
              {slots?.publishedSlotCount != null && (
                <Text style={s.badge}>
                  {value(slots.publishedSlotCount)} khung giờ
                </Text>
              )}
            </View>
            <UtilizationGauge rate={slots?.utilizationRate} />
            <View style={s.rowTiles}>
              <View style={s.tile}>
                <Text style={s.small}>● Đã sử dụng</Text>
                <Text style={[s.metric, serif]}>
                  {value(slots?.utilizedSlotCount)}
                </Text>
              </View>
              <View style={s.tile}>
                <Text style={s.small}>○ Chưa sử dụng</Text>
                <Text style={[s.metric, serif]}>
                  {value(slots?.unusedSlotCount)}
                </Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push('/(specialist)/availability')}
              style={s.softAction}
            >
              <Text style={s.actionText}>Xem lịch khả dụng →</Text>
            </Pressable>
          </View>

          <View style={s.card}>
            <View style={s.row}>
              <Text style={s.icon} aria-hidden>
                ☆
              </Text>
              <View style={s.fill}>
                <Text style={s.kicker}>PHẢN HỒI KHÁCH HÀNG</Text>
                <Text accessibilityRole="header" style={[s.heading, serif]}>
                  Đánh giá &amp; tin cậy
                </Text>
              </View>
              <Text style={s.badge}>Toàn thời gian</Text>
            </View>
            <View style={s.rating}>
              <Text style={[s.ratingValue, serif]}>
                {value(rating?.averageRating)}
                {rating?.averageRating != null && (
                  <Text style={s.small}> /5</Text>
                )}
              </Text>
              <Text style={s.body}>
                {rating?.ratingCount == null
                  ? 'Chưa có dữ liệu đánh giá'
                  : `${value(rating.ratingCount)} lượt đánh giá`}
              </Text>
            </View>
            <View style={s.rowTiles}>
              <View style={[s.tile, s.mintTile]}>
                <Text style={s.small}>Hoàn thành</Text>
                <Text style={[s.metric, serif]}>
                  {value(appointments?.completedCount)}
                </Text>
              </View>
              <View style={s.tile}>
                <Text style={s.small}>Khách vắng mặt</Text>
                <Text style={[s.metric, serif]}>
                  {value(appointments?.userNoShowCount)}
                </Text>
              </View>
            </View>
          </View>

          <View style={s.section}>
            <Text accessibilityRole="header" style={[s.heading, serif]}>
              Vòng đời lịch hẹn
            </Text>
            <Text style={s.small}>
              Các sự kiện được ghi nhận trong khoảng thời gian đã chọn.
            </Text>
            <View style={s.grid}>
              {events.map(([key, label, description, glyph]) => (
                <View key={key} style={s.event}>
                  <Text style={s.icon} aria-hidden>
                    {glyph}
                  </Text>
                  <Text style={[s.metric, serif]}>
                    {value(appointments?.[key])}
                  </Text>
                  <Text style={s.actionText}>{label}</Text>
                  <Text style={s.small}>{description}</Text>
                </View>
              ))}
            </View>
            <Text style={s.small}>
              ⓘ Các số đếm theo sự kiện phát sinh trong kỳ. Một lịch hẹn có thể
              xuất hiện ở nhiều nhóm.
            </Text>
          </View>

          <View style={[s.card, s.finance]}>
            <Text style={[s.kicker, s.light]}>TÀI CHÍNH CHUYÊN GIA</Text>
            <Text
              accessibilityRole="header"
              style={[s.heading, serif, s.light]}
            >
              Thu nhập &amp; Thanh toán
            </Text>
            <View style={s.rowTiles}>
              <View style={s.moneyTile}>
                <Text style={s.lightSmall}>Ghi nhận</Text>
                <Text style={[s.metric, serif, s.light]}>
                  {money(financial?.earnedAmountMinor, financial?.currency)}
                </Text>
              </View>
              <View style={s.moneyTile}>
                <Text style={s.lightSmall}>Đã thanh toán</Text>
                <Text style={[s.metric, serif, s.light]}>
                  {money(financial?.paidAmountMinor, financial?.currency)}
                </Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: finance }}
              style={s.softAction}
              onPress={() => setFinance(!finance)}
            >
              <Text style={s.actionText}>
                {finance ? 'Thu gọn chi tiết' : 'Chi tiết thu nhập trong kỳ'}{' '}
                {finance ? '⌃' : '⌄'}
              </Text>
            </Pressable>
            {finance && (
              <Text style={s.lightSmall}>
                {range}
                {'\n'}Ghi nhận theo khoản thu phát sinh. Đã thanh toán theo giao
                dịch chuyển khoản thành công trong kỳ.
              </Text>
            )}
          </View>
        </>
      )}

      <View style={s.scope}>
        <Text style={s.actionText}>Phạm vi dữ liệu</Text>
        <Text style={s.body}>
          Phân tích dựa trên dữ liệu vận hành lịch hẹn, khung giờ, đánh giá và
          thanh toán.
        </Text>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  page: { gap: 12 },
  serif: { fontFamily: 'DashboardSerif' },
  title: { fontSize: 27, color: dark, fontWeight: '700' },
  heading: { fontSize: 20, color: dark, fontWeight: '700' },
  small: { fontSize: 12, lineHeight: 18, color: muted },
  body: { fontSize: 13, lineHeight: 20, color: dark },
  kicker: { fontSize: 10, letterSpacing: 0.6, fontWeight: '700', color: muted },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: mint,
    color: dark,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
    overflow: 'hidden',
    fontSize: 11,
  },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    padding: 4,
    backgroundColor: '#EFF1EB',
  },
  segmentItem: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
  },
  segmentActive: { backgroundColor: dark },
  calendar: {
    width: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  light: { color: '#FFFFFF' },
  lightSmall: { color: '#E0F1E8', fontSize: 12, lineHeight: 19 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 23, padding: 15, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  icon: {
    backgroundColor: mint,
    borderRadius: 18,
    overflow: 'hidden',
    padding: 8,
    textAlign: 'center',
    color: dark,
    fontSize: 15,
    alignSelf: 'flex-start',
    minWidth: 34,
  },
  fill: { flex: 1, minWidth: 0 },
  gauge: {
    width: 165,
    minHeight: 111,
    alignSelf: 'center',
    alignItems: 'center',
    paddingTop: 40,
  },
  tick: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ECEFEA',
  },
  tickActive: { backgroundColor: dark },
  gaugeValue: { fontSize: 24, fontWeight: '800', color: dark },
  gaugeScale: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 5,
  },
  rowTiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tile: {
    flexGrow: 1,
    flexBasis: 105,
    backgroundColor: '#F0F2ED',
    padding: 9,
    gap: 3,
    borderRadius: 8,
  },
  mintTile: { backgroundColor: '#EAF4EE' },
  metric: { fontSize: 20, fontWeight: '700', color: dark },
  softAction: {
    backgroundColor: '#EEF2ED',
    padding: 10,
    minHeight: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: { fontSize: 13, color: dark, fontWeight: '700' },
  rating: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: '#F0F2ED',
    padding: 11,
    borderRadius: 9,
  },
  ratingValue: { fontSize: 30, fontWeight: '700', color: dark },
  section: { gap: 7 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  event: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: '#FFFFFF',
    padding: 11,
    gap: 4,
    borderRadius: 11,
  },
  finance: { backgroundColor: dark },
  moneyTile: {
    flexGrow: 1,
    flexBasis: 110,
    backgroundColor: '#285349',
    borderRadius: 8,
    padding: 10,
    gap: 4,
  },
  scope: { backgroundColor: '#EFF2EC', borderRadius: 19, padding: 14, gap: 4 },
})
