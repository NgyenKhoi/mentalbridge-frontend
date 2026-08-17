import RoleWorkspace from '@/components/RoleWorkspace'

export default async function AdminWorkspace({ params }: PageProps<'/admin/[[...section]]'>) {
  const { section } = await params
  return <RoleWorkspace role="admin" sectionKey={section?.[0] || 'dashboard'} />
}
