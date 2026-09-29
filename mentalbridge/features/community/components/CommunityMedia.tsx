import Image from 'next/image'

import type { components } from '@/contracts/community.generated'

type Media = components['schemas']['CommunityMedia']

const passthroughLoader = ({ src }: { src: string }) => src

export default function CommunityMedia({ media }: { media: readonly Media[] }) {
  if (media.length === 0) return null
  return (
    <div
      className={`community-media community-media-${Math.min(media.length, 3)}`}
    >
      {media.map((item) =>
        item.type === 'IMAGE' ? (
          <Image
            key={item.mediaId}
            loader={passthroughLoader}
            unoptimized
            src={item.url}
            alt={item.altText || 'Hình ảnh được chia sẻ trong cộng đồng'}
            width={item.width ?? 1200}
            height={item.height ?? 800}
            sizes="(max-width: 760px) 100vw, 680px"
          />
        ) : (
          <video
            key={item.mediaId}
            controls
            preload="metadata"
            aria-label={item.altText || 'Video được chia sẻ trong cộng đồng'}
          >
            <source src={item.url} />
          </video>
        ),
      )}
    </div>
  )
}
