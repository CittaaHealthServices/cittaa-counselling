'use client'
import { useState } from 'react'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { ErrorBoundary } from '@/components/error-boundary'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:flex flex-col w-60 shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar drawer */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-60 flex flex-col transform transition-transform duration-200 lg:hidden
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main content — wrapped in ErrorBoundary to catch blank-page crashes */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <ErrorBoundary context="dashboard">
            {children}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
