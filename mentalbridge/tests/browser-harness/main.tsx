import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '../../app/globals.css'
import '../../app/realtime-diagnostics/realtime-diagnostics.css'
import { SyntheticRealtimeHarness } from '../../app/realtime-diagnostics/synthetic-realtime-harness'

const root = document.getElementById('root')
if (!root) throw new Error('Synthetic Browser E2E root is missing.')

createRoot(root).render(
  <StrictMode>
    <SyntheticRealtimeHarness />
  </StrictMode>,
)
