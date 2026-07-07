import type { Metadata } from 'next'
import { DemoShell } from './_components/DemoShell'

export const metadata: Metadata = {
  title: 'Chidental — Redesign demo',
}

// Wraps every /demo/* page in the redesigned app shell so the tabs are clickable
// as one coherent app. Isolated from the real (authenticated) app entirely.
export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return <DemoShell>{children}</DemoShell>
}
