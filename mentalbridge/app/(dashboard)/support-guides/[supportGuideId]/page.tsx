import SupportGuideJourney from '@/features/support-guide/components/SupportGuideJourney'

export default async function SupportGuidePage(
  props: PageProps<'/support-guides/[supportGuideId]'>,
) {
  const { supportGuideId } = await props.params
  return <SupportGuideJourney supportGuideId={supportGuideId} />
}
