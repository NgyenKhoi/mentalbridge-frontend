import Link from 'next/link'

import type { Workspace } from '../model/workspace'
import styles from './WorkspaceSwitcher.module.css'

export default function WorkspaceSwitcher({
  workspaces,
  currentRole,
}: Readonly<{
  workspaces: readonly Workspace[]
  currentRole: Workspace['role']
}>) {
  if (workspaces.length < 2) return null

  return (
    <nav className={styles.switcher} aria-label="Chuyển không gian làm việc">
      {workspaces.map((workspace) => (
        <Link
          href={workspace.path}
          key={workspace.role}
          aria-current={workspace.role === currentRole ? 'page' : undefined}
        >
          {workspace.label}
        </Link>
      ))}
    </nav>
  )
}
