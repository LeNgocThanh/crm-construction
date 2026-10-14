'use client'
// src/app/(auth)/login/page.tsx
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const fd = new FormData(e.currentTarget)
    const result = await signIn('credentials', {
      username: fd.get('username') as string,
      password: fd.get('password') as string,
      redirect: false,
    })

    if (result?.ok) {
      router.push('/dashboard')
      router.refresh()
    } else {
      setError('Tài khoản hoặc mật khẩu không đúng')
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 400,
        animation: 'fadeUp .4s ease forwards',
      }}
    >
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 56,
            height: 56,
            borderRadius: 16,
            background: 'var(--accent)',
            marginBottom: 16,
            fontSize: 24,
          }}
        >
          🏗️
        </div>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            letterSpacing: 4,
            color: 'var(--text3)',
            marginBottom: 6,
          }}
        >
          CRM // CONSTRUCTION
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--text)',
          }}
        >
          Đăng nhập
        </div>
      </div>

      {/* Form */}
      <div className="card" style={{ padding: 28 }}>
        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label className="label">Tài khoản</label>
            <input
              className="input"
              name="username"
              placeholder="admin"
              autoFocus
              required
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label className="label">Mật khẩu</label>
            <input
              className="input"
              name="password"
              type="password"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                background: '#EF444415',
                border: '1px solid #EF444430',
                color: 'var(--red)',
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ width: '100%', padding: '11px', fontSize: 14 }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <span className="spinner" style={{ width: 16, height: 16 }} />
                Đang đăng nhập...
              </span>
            ) : (
              'Đăng nhập'
            )}
          </button>
        </form>
      </div>

      <p
        style={{
          textAlign: 'center',
          color: 'var(--text3)',
          fontSize: 12,
          marginTop: 24,
        }}
      >
        CRM Construction v1.0
      </p>
    </div>
  )
}
