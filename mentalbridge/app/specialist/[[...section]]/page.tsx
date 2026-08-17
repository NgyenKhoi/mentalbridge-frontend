import RoleWorkspace from '@/components/RoleWorkspace'

export default async function SpecialistWorkspace({ params }: PageProps<'/specialist/[[...section]]'>) {
  const { section } = await params
  return <RoleWorkspace role="specialist" sectionKey={section?.[0] || 'dashboard'} />
}
