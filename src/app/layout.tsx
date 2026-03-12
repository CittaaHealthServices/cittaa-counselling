import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'Cittaa Mind Bridge – School Counselling Platform',
  description: 'Structured counselling request and escalation management for schools and Cittaa psychologists',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: { fontSize: '13px', borderRadius: '8px', background: '#1e293b', color: '#f8fafc' },
              success: { style: { background: '#052e16', color: '#86efac', border: '1px solid #16a34a' } },
              error:   { style: { background: '#450a0a', color: '#fca5a5', border: '1px solid #dc2626' } },
            }}
          />
        </Providers>
      </body>
    </html>
  )
}
