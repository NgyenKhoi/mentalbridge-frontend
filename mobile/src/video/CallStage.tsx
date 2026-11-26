import { VideoTrack } from '@livekit/react-native'
import { useEffect, useRef, useState, type ComponentProps } from 'react'
import { Modal, Pressable, Text, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { callStyles as s } from './call-styles'

type Camera = ComponentProps<typeof VideoTrack>['trackRef']
type Props = {
  status: string
  connected: boolean
  reconnecting: boolean
  remoteCamera: Camera
  localCamera: Camera
  participantName: string
  participantPresent: boolean
  microphone: boolean
  camera: boolean
  facingFront: boolean
  busy: boolean
  error: string
  schedule: string
  outputs: readonly { value: string; label: string }[]
  output: string
  onOutput: (value: string) => void
  onMicrophone: () => void
  onCamera: () => void
  onFlip: () => void
  onLeave: () => void
}

export function CallIcon({
  kind,
  off = false,
}: {
  kind: 'microphone' | 'camera' | 'audio' | 'leave'
  off?: boolean
}) {
  return (
    <View accessible={false} style={s.icon}>
      {kind === 'microphone' && (
        <>
          <View style={s.micHead} />
          <View style={s.micCradle} />
          <View style={s.micStem} />
        </>
      )}
      {kind === 'camera' && (
        <>
          <View style={s.cameraBody} />
          <View style={s.cameraLens} />
        </>
      )}
      {kind === 'audio' && (
        <>
          <View style={s.speakerBody} />
          <View style={s.speakerCone} />
          <View style={s.soundWave} />
        </>
      )}
      {kind === 'leave' && (
        <>
          <View style={s.phoneArc} />
          <View style={[s.phoneEnd, { left: 1 }]} />
          <View style={[s.phoneEnd, { right: 1 }]} />
        </>
      )}
      {off && <View style={s.slash} />}
    </View>
  )
}

export function CallStage(p: Props) {
  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  const landscape = width > height
  const [headerHeight, setHeaderHeight] = useState(0)
  const [footerHeight, setFooterHeight] = useState(0)
  const [expanded, setExpanded] = useState(true)
  const [audioOpen, setAudioOpen] = useState(false)
  const [elapsed, setElapsed] = useState<number | null>(null)
  const connectedAt = useRef<number | null>(null)
  useEffect(() => {
    if (p.connected && p.participantPresent && connectedAt.current === null)
      connectedAt.current = Date.now()
    const timer = setInterval(() => {
      if (connectedAt.current !== null)
        setElapsed(
          Math.max(0, Math.floor((Date.now() - connectedAt.current) / 1000)),
        )
    }, 1000)
    return () => clearInterval(timer)
  }, [p.connected, p.participantPresent])
  const duration = `${String(Math.floor((elapsed ?? 0) / 60)).padStart(2, '0')}:${String((elapsed ?? 0) % 60).padStart(2, '0')}`
  const disabled = p.busy || !p.connected
  const initials = p.participantName
    .split(/\s+/)
    .slice(-2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
  return (
    <>
      {!expanded && (
        <View style={s.minimized}>
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={s.name}>{p.participantName}</Text>
            <Text style={s.muted}>{p.status}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => setExpanded(true)}
            style={s.returnButton}
          >
            <Text style={s.white}>Trở lại cuộc gọi</Text>
          </Pressable>
        </View>
      )}
      <Modal
        hardwareAccelerated
        visible={expanded}
        animationType="fade"
        presentationStyle="fullScreen"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setExpanded(false)}
      >
        <View style={s.screen}>
          {p.remoteCamera ? (
            <VideoTrack
              key={p.remoteCamera.publication.trackSid}
              trackRef={p.remoteCamera}
              style={{
                ...s.remoteVideo,
                top: headerHeight,
                bottom: footerHeight,
              }}
              objectFit="contain"
              zOrder={0}
            />
          ) : (
            <View style={s.waiting}>
              <View style={s.halo}>
                <View style={s.avatar}>
                  <Text style={s.initials}>{initials}</Text>
                </View>
              </View>
              <Text style={s.waitingName}>{p.participantName}</Text>
              <Text style={s.waitingCopy}>
                {p.participantPresent
                  ? 'Camera của người đối diện đang tắt'
                  : 'Cuộc gọi sẽ bắt đầu khi người đối diện tham gia'}
              </Text>
            </View>
          )}
          <View
            pointerEvents="box-none"
            onLayout={(event) =>
              setHeaderHeight(event.nativeEvent.layout.height)
            }
            style={[s.top, { paddingTop: insets.top + 12 }]}
          >
            <View style={s.header}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Thu gọn cuộc gọi"
                onPress={() => setExpanded(false)}
                style={s.round}
              >
                <Text style={s.chevron}>⌄</Text>
              </Pressable>
              <View style={s.connection}>
                <View style={[s.dot, p.reconnecting && s.amber]} />
                <Text style={s.connectionText}>
                  {p.reconnecting
                    ? 'Kết nối lại'
                    : p.connected && p.participantPresent
                      ? 'Trực tiếp'
                      : 'Đang chờ'}
                </Text>
                {elapsed !== null && <Text style={s.timer}>{duration}</Text>}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Đổi camera"
                disabled={disabled || !p.camera}
                accessibilityState={{ disabled: disabled || !p.camera }}
                onPress={p.onFlip}
                style={[s.round, (disabled || !p.camera) && s.disabled]}
              >
                <Text style={s.rotate}>↻</Text>
              </Pressable>
            </View>
            {p.schedule !== '' && (
              <View style={s.schedule}>
                <Text numberOfLines={1} style={s.scheduleText}>
                  {p.schedule} · Video trong ứng dụng
                </Text>
              </View>
            )}
          </View>
          <View
            style={[
              s.self,
              {
                top: insets.top + (!landscape && p.schedule ? 126 : 82),
                width: landscape ? 104 : Math.min(width * 0.29, 164),
                height: landscape
                  ? Math.min(height * 0.32, 138)
                  : Math.min(width * 0.4, 220),
              },
            ]}
          >
            {p.localCamera && p.camera ? (
              <VideoTrack
                key={p.localCamera.publication.trackSid}
                trackRef={p.localCamera}
                style={s.selfVideo}
                objectFit="cover"
                mirror={p.facingFront}
                zOrder={1}
              />
            ) : (
              <View style={s.selfPlaceholder}>
                <CallIcon kind="camera" off />
                <Text style={s.selfCopy}>Camera tắt</Text>
              </View>
            )}
            <View style={s.selfFooter}>
              <Text style={s.selfLabel}>Bạn</Text>
              <View style={[s.microphoneDot, !p.microphone && s.mutedMic]}>
                <Text style={s.microphoneState}>
                  {p.microphone ? 'Bật mic' : 'Tắt mic'}
                </Text>
              </View>
            </View>
          </View>
          <View
            pointerEvents="box-none"
            onLayout={(event) =>
              setFooterHeight(event.nativeEvent.layout.height)
            }
            style={[
              s.bottom,
              {
                paddingBottom: Math.max(insets.bottom, 16),
                paddingLeft: Math.max(insets.left, 16),
                paddingRight: Math.max(insets.right, 16),
              },
            ]}
          >
            {!landscape && (
              <View style={s.participantCard}>
                <Text style={s.eyebrow}>PHIÊN TƯ VẤN TRỰC TUYẾN</Text>
                <Text numberOfLines={2} style={s.participantName}>
                  {p.participantName}
                </Text>
                <Text accessibilityLiveRegion="polite" style={s.status}>
                  {p.status}
                </Text>
                <View style={s.privacy}>
                  <Text style={s.privacyText}>Không ghi âm hoặc ghi hình</Text>
                </View>
              </View>
            )}
            {landscape && (
              <Text accessibilityLiveRegion="polite" style={s.landscapeStatus}>
                {p.status}
              </Text>
            )}
            {p.error !== '' && (
              <View style={s.errorBox}>
                <Text accessibilityRole="alert" style={s.error}>
                  {p.error}
                </Text>
              </View>
            )}
            {audioOpen && (
              <View style={s.audioPanel}>
                <Text style={s.audioTitle}>Thiết bị âm thanh</Text>
                <View style={s.audioOptions}>
                  {p.outputs.map((item) => (
                    <Pressable
                      key={item.value}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: p.output === item.value }}
                      onPress={() => p.onOutput(item.value)}
                      style={[
                        s.audioOption,
                        p.output === item.value && s.audioSelected,
                      ]}
                    >
                      <Text style={s.white}>
                        {item.label}
                        {p.output === item.value ? ' ✓' : ''}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {p.outputs.length === 0 && (
                  <Text style={s.muted}>
                    Đang dùng thiết bị mặc định của máy.
                  </Text>
                )}
              </View>
            )}
            <View style={s.toolbar}>
              <Control
                label="Micro"
                accessibilityLabel={`Micro: ${p.microphone ? 'Đang bật' : 'Đang tắt'}`}
                kind="microphone"
                off={!p.microphone}
                disabled={disabled}
                selected={p.microphone}
                onPress={p.onMicrophone}
              />
              <Control
                label="Camera"
                accessibilityLabel={`Camera: ${p.camera ? 'Đang bật' : 'Đang tắt'}`}
                kind="camera"
                off={!p.camera}
                disabled={disabled}
                selected={p.camera}
                onPress={p.onCamera}
              />
              <Control
                label="Âm thanh"
                accessibilityLabel="Chọn thiết bị âm thanh"
                kind="audio"
                selected={audioOpen}
                onPress={() => setAudioOpen((value) => !value)}
              />
              <Control
                label="Rời phiên"
                accessibilityLabel="Rời cuộc gọi"
                kind="leave"
                onPress={p.onLeave}
              />
            </View>
          </View>
        </View>
      </Modal>
    </>
  )
}

function Control({
  label,
  accessibilityLabel,
  kind,
  off,
  disabled,
  selected,
  onPress,
}: {
  label: string
  accessibilityLabel: string
  kind: ComponentProps<typeof CallIcon>['kind']
  off?: boolean
  disabled?: boolean
  selected?: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{
        disabled: Boolean(disabled),
        selected: Boolean(selected),
      }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.control,
        pressed && s.pressed,
        disabled && s.disabled,
      ]}
    >
      <View
        style={[
          s.controlCircle,
          selected && s.controlSelected,
          kind === 'leave' && s.leave,
        ]}
      >
        <CallIcon kind={kind} off={Boolean(off)} />
      </View>
      <Text style={s.controlLabel}>{label}</Text>
    </Pressable>
  )
}
