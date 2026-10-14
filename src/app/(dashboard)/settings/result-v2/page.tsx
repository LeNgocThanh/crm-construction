'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SettingsResultV2Page() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/estimates/result-v2')
  }, [router])

  return (
    <div className="fade-up">
      <div className="card" style={{ padding: 16, fontSize: 13, color: 'var(--text3)' }}>
        Đang chuyển đến trang kết quả...
      </div>
    </div>
  )
}
