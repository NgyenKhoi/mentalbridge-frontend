import { Text } from 'react-native'
import type { VideoMediaProps } from './video-media-props'
import { videoStyles } from './video-styles'

export default function VideoMedia(_props: VideoMediaProps) {
  return (
    <Text style={videoStyles.copy}>
      Cuộc gọi trong ứng dụng cần bản cài Android hoặc iOS. Trên trình duyệt,
      hãy dùng trang MentalBridge.
    </Text>
  )
}
