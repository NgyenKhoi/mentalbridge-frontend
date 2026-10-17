import { describe, expect, it } from 'vitest'

import { vietnameseVideoCues } from './vietnamese-video-cues'

const currentVideos = [
  'https://www.youtube.com/watch?v=wfDTp2GogaQ',
  'https://youtu.be/tfkhkFwCtxs',
  'https://www.youtube-nocookie.com/embed/9GURt2pvdAg',
]

describe('vietnameseVideoCues', () => {
  it.each(currentVideos)('returns ordered contextual cues for %s', (url) => {
    const cues = vietnameseVideoCues(url)

    expect(cues.length).toBeGreaterThan(0)
    cues.forEach((cue, index) => {
      expect(cue.text.length).toBeGreaterThan(0)
      expect(cue.endSeconds).toBeGreaterThan(cue.startSeconds)
      if (index > 0) {
        expect(cue.startSeconds).toBeGreaterThanOrEqual(
          cues[index - 1].endSeconds,
        )
      }
    })
  })

  it('does not invent contextual captions for an unknown video', () => {
    expect(
      vietnameseVideoCues('https://www.youtube.com/watch?v=unknown123'),
    ).toEqual([])
  })
})
