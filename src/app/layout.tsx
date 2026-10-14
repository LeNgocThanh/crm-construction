import type { Metadata } from 'next'
// @ts-expect-error CSS side-effect imports are handled by Next.js.
import './globals.css'
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import {Toaster} from '@/components/ui/sonner';

const geist = Inter({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: 'CRM Construction',
  description: 'Construction CRM System',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning className={cn("font-sans", geist.variable)}>
      <head>
        {/* Apply saved theme before first paint — prevents flash */}
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            var t = localStorage.getItem('crm-theme');
            if (t && ['dark','balance','light'].includes(t)) {
              document.documentElement.setAttribute('data-theme', t);
            }
          } catch(e) {}
        `}} />
      </head>
      <body>{children}
         <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
