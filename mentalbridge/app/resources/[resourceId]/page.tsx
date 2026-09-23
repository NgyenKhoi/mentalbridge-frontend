import ResourceDetail from '@/features/resources/components/ResourceDetail'

type Props = Readonly<{
  params: Promise<{ resourceId: string }>
  searchParams: Promise<{ from?: string }>
}>

export default async function ResourceDetailPage({
  params,
  searchParams,
}: Props) {
  const [{ resourceId }, query] = await Promise.all([params, searchParams])
  return (
    <ResourceDetail
      resourceId={resourceId}
      fromSupportPlan={query.from === 'support-plan'}
    />
  )
}
