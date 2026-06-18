import { AuthProvider } from '@/contexts/AuthContext'
import AppShell from '@/components/layout/AppShell'
import { ToastProvider } from '@/components/feedback/toast'
import { ErrorBoundary } from '@/components/feedback/error-boundary'

export const dynamic = 'force-dynamic'

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <ErrorBoundary>
          <AppShell>{children}</AppShell>
        </ErrorBoundary>
      </ToastProvider>
    </AuthProvider>
  )
}
