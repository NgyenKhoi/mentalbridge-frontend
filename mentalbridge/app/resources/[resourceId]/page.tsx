import ResourceDetail from '@/features/resources/components/ResourceDetail'

type Props = Readonly<{
  params: Promise<{ resourceId: string }>
  searchParams: Promise<{
    from?: string | string[]
    date?: string | string[]
    contentVersion?: string | string[]
  }>
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
      activityDate={typeof query.date === 'string' ? query.date : undefined}
      contentVersion={
        typeof query.contentVersion === 'string'
          ? query.contentVersion
          : undefined
      }
    />
  )
}
