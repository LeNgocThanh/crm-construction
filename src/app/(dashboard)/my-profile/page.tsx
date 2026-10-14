'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'

type ProfileRef = {
  id: string
  key: string
  name: string
  is_primary?: boolean
}

type ProfileData = {
  id: string
  username: string
  full_name?: string | null
  email?: string | null
  phone?: string | null
  avatar_url?: string | null
  employee_code?: string | null
  job_title?: string | null
  role?: string | null
  is_active: boolean
  last_login_at?: string | null
  created_at: string
  updated_at: string
  groups?: ProfileRef[]
  primary_group?: ProfileRef | null
  account_types?: ProfileRef[]
  primary_account_type?: ProfileRef | null
  access_roles?: ProfileRef[]
  primary_access_role?: ProfileRef | null
}

type NotificationItem = {
  id: string
  headline?: string
  body?: string
  href?: string
  source_label?: string
  project_name?: string | null
  issue_code?: string | null
  notif_status?: string | null
  days_ago?: number | null
  is_read?: boolean
}

const PAGE_SIZE_OPTIONS = [10, 20, 30]

export default function MyProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [profileSaving, setProfileSaving] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [notificationsLoading, setNotificationsLoading] = useState(true)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [notificationsPage, setNotificationsPage] = useState(1)
  const [notificationsPageSize, setNotificationsPageSize] = useState(10)
  const [notificationsTotal, setNotificationsTotal] = useState(0)
  const [notificationsTotalPages, setNotificationsTotalPages] = useState(1)
  const [unread, setUnread] = useState(0)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [toast, setToast] = useState('')
  const [showGuide, setShowGuide] = useState(false)
  const [showProfileForm, setShowProfileForm] = useState(true)
  const [showPasswordForm, setShowPasswordForm] = useState(true)
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  })

  const identityRows = useMemo(() => {
    if (!profile) return []
    return [
      { label: 'Username', value: profile.username || '-' },
      { label: 'Mã nhân sự', value: profile.employee_code || '-' },
      { label: 'Chức danh', value: profile.job_title || '-' },
      { label: 'Nhóm chính', value: profile.primary_group?.name || '-' },
      { label: 'Loại tài khoản chính', value: profile.primary_account_type?.name || '-' },
      { label: 'Vai trò truy cập chính', value: profile.primary_access_role?.name || profile.role || '-' },
      { label: 'Đăng nhập cuối', value: formatDateTime(profile.last_login_at || null) },
      { label: 'Ngày tạo', value: formatDateTime(profile.created_at) },
    ]
  }, [profile])

  const loadProfile = useCallback(async () => {
    setLoadingProfile(true)
    const res = await fetch('/api/my-profile')
    const json = await res.json().catch(() => ({}))
    if (res.ok && json?.data) {
      setProfile(json.data)
      setFullName(json.data.full_name || '')
      setEmail(json.data.email || '')
      setPhone(json.data.phone || '')
      setAvatarUrl(json.data.avatar_url || '')
    } else {
      setToast(json?.error || 'Khong the tai thong tin ca nhan')
    }
    setLoadingProfile(false)
  }, [])

  const loadNotifications = useCallback(async (page = notificationsPage, pageSize = notificationsPageSize) => {
    setNotificationsLoading(true)
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    })
    const res = await fetch(`/api/notifications?${params.toString()}`)
    const json = await res.json().catch(() => ({}))
    if (res.ok) {
      setNotifications(Array.isArray(json?.data) ? json.data : [])
      setNotificationsTotal(Number(json?.total || 0))
      setNotificationsTotalPages(Number(json?.totalPages || 1))
      setUnread(Number(json?.unread || 0))
    } else {
      setToast(json?.error || 'Khong the tai notifications')
      setNotifications([])
    }
    setNotificationsLoading(false)
  }, [notificationsPage, notificationsPageSize])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  useEffect(() => {
    loadNotifications(notificationsPage, notificationsPageSize)
  }, [loadNotifications, notificationsPage, notificationsPageSize])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2400)
    return () => clearTimeout(t)
  }, [toast])

  async function saveProfile() {
    setProfileSaving(true)
    const res = await fetch('/api/my-profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: fullName,
        email,
        phone,
        avatar_url: avatarUrl,
      }),
    })
    const json = await res.json().catch(() => ({}))
    setProfileSaving(false)
    if (!res.ok) {
      setToast(json?.error || 'Khong the luu thong tin')
      return
    }
    setProfile(json.data)
    setFullName(json.data.full_name || '')
    setEmail(json.data.email || '')
    setPhone(json.data.phone || '')
    setAvatarUrl(json.data.avatar_url || '')
    setToast('Da cap nhat thong tin ca nhan')
  }

  async function changePassword() {
    setPasswordSaving(true)
    const res = await fetch('/api/my-profile/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(passwordForm),
    })
    const json = await res.json().catch(() => ({}))
    setPasswordSaving(false)
    if (!res.ok) {
      setToast(json?.error || 'Khong the doi mat khau')
      return
    }
    setPasswordForm({ current_password: '', new_password: '', confirm_password: '' })
    setToast('Da doi mat khau')
  }

  async function markRead(id: string) {
    const res = await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys: [id] }),
    })
    if (!res.ok) return
    setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, is_read: true } : item)))
    setUnread((prev) => Math.max(0, prev - 1))
  }

  async function markAllRead() {
    const res = await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mark_all: true }),
    })
    if (!res.ok) return
    await loadNotifications(notificationsPage, notificationsPageSize)
    setToast('Da danh dau da doc tat ca notifications')
  }

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)', marginBottom: 4 }}>CA NHAN</div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Hồ sơ cá nhân</h1>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>
          Xem thông tin tài khoản của chính bạn, đổi mật khẩu và theo dõi lịch sử notifications.
        </div>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 16, background: 'var(--panel)', padding: 16, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontWeight: 800 }}>Hướng dẫn sử dụng</div>
          <button className="btn ghost" onClick={() => setShowGuide((v) => !v)}>
            {showGuide ? 'Ẩn hướng dẫn' : 'Hiện hướng dẫn'}
          </button>
        </div>
        {showGuide ? (
          <div style={{ color: 'var(--text2)', lineHeight: 1.7 }}>
            <div>1. Thông tin tại đây là hồ sơ của chính bạn, không sửa vào user khác.</div>
            <div>2. Vai trò truy cập chính được lấy từ membership mới, không còn phụ thuộc vào role text cũ.</div>
            <div>3. Notifications cho phép mở nhanh nội dung liên quan và đánh dấu đã đọc ngay tại trang này.</div>
          </div>
        ) : null}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 14, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 14 }}>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: showProfileForm ? 12 : 0 }}>
              <div style={{ fontWeight: 800 }}>Thông tin cá nhân</div>
              <button className="btn ghost" onClick={() => setShowProfileForm((v) => !v)}>
                {showProfileForm ? 'Ẩn' : 'Hiện'}
              </button>
            </div>
            {showProfileForm ? (
              loadingProfile ? (
                <div style={{ padding: '10px 0', color: 'var(--text3)' }}>Đang tải thông tin...</div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                    {identityRows.map((row) => (
                      <label key={row.label} style={{ display: 'grid', gap: 6 }}>
                        <span style={{ fontSize: 12, color: 'var(--text3)' }}>{row.label}</span>
                        <input value={row.value} readOnly style={{ opacity: 0.85 }} />
                      </label>
                    ))}
                  </div>

                  <label style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
                    <span style={{ fontSize: 12, color: 'var(--text3)' }}>Họ tên</span>
                    <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nhập họ tên" />
                  </label>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                    <label style={{ display: 'grid', gap: 6 }}>
                      <span style={{ fontSize: 12, color: 'var(--text3)' }}>Email</span>
                      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Nhap email" />
                    </label>
                    <label style={{ display: 'grid', gap: 6 }}>
                      <span style={{ fontSize: 12, color: 'var(--text3)' }}>Số điện thoại</span>
                      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Nhập số điện thoại" />
                    </label>
                  </div>

                  <label style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
                    <span style={{ fontSize: 12, color: 'var(--text3)' }}>Avatar URL</span>
                    <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="Nhap URL avatar" />
                  </label>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                    <InfoBox title="Tất cả nhóm" values={profile?.groups?.map((item) => item.name) || []} />
                    <InfoBox title="Tất cả loại tài khoản" values={profile?.account_types?.map((item) => item.name) || []} />
                    <InfoBox title="Tất cả vai trò truy cập" values={profile?.access_roles?.map((item) => item.name) || []} />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn" onClick={saveProfile} disabled={profileSaving}>
                      {profileSaving ? 'Đang lưu...' : 'Lưu thông tin'}
                    </button>
                  </div>
                </>
              )
            ) : null}
          </div>

          <div className="card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: showPasswordForm ? 12 : 0 }}>
              <div style={{ fontWeight: 800 }}>Đổi mật khẩu</div>
              <button className="btn ghost" onClick={() => setShowPasswordForm((v) => !v)}>
                {showPasswordForm ? 'Ẩn' : 'Hiện'}
              </button>
            </div>
            {showPasswordForm ? (
              <>
                <div style={{ display: 'grid', gap: 10 }}>
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--text3)' }}>Mat khau hien tai</span>
                    <input
                      type="password"
                      value={passwordForm.current_password}
                      onChange={(e) => setPasswordForm((prev) => ({ ...prev, current_password: e.target.value }))}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--text3)' }}>Mat khau moi</span>
                    <input
                      type="password"
                      value={passwordForm.new_password}
                      onChange={(e) => setPasswordForm((prev) => ({ ...prev, new_password: e.target.value }))}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--text3)' }}>Xac nhan mat khau moi</span>
                    <input
                      type="password"
                      value={passwordForm.confirm_password}
                      onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirm_password: e.target.value }))}
                    />
                  </label>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                  <button className="btn" onClick={changePassword} disabled={passwordSaving}>
                    {passwordSaving ? 'Dang doi...' : 'Cap nhat mat khau'}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>

        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: 14, borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 800 }}>Notifications cua toi</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                  {unread} chua doc / {notificationsTotal} tong so
                </div>
              </div>
              <button className="btn ghost" onClick={markAllRead} disabled={notificationsLoading || unread <= 0}>
                Danh dau da doc tat ca
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '160px auto', gap: 10 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>So dong / trang</span>
                <select
                  value={notificationsPageSize}
                  onChange={(e) => {
                    const next = Number(e.target.value || 10)
                    setNotificationsPageSize(next)
                    setNotificationsPage(1)
                  }}
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>{size} dong</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div style={{ maxHeight: 720, overflowY: 'auto' }}>
            {notificationsLoading ? (
              <div style={{ padding: 20, color: 'var(--text3)' }}>Dang tai notifications...</div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: 20, color: 'var(--text3)' }}>Chua co notifications nao.</div>
            ) : (
              notifications.map((item) => (
                <div key={item.id} style={{ padding: 14, borderBottom: '1px solid var(--border)', background: item.is_read ? 'transparent' : 'rgba(249,115,22,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', marginBottom: 6 }}>
                    <div style={{ fontWeight: item.is_read ? 600 : 800, color: 'var(--text)' }}>
                      {item.headline || 'Thong bao'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text4)', whiteSpace: 'nowrap' }}>
                      {item.days_ago === null || item.days_ago === undefined ? '' : `${item.days_ago}d truoc`}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text4)', marginBottom: 6 }}>
                    {item.source_label || 'Thong bao'}
                    {item.project_name ? ` | ${item.project_name}` : ''}
                    {item.issue_code ? ` | ${item.issue_code}` : ''}
                    {item.notif_status ? ` | Trang thai: ${item.notif_status}` : ''}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>
                    {item.body || '-'}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    {item.href ? (
                      <Link href={item.href} className="btn ghost" style={{ textDecoration: 'none' }}>
                        Mo noi dung
                      </Link>
                    ) : null}
                    {!item.is_read ? (
                      <button className="btn ghost" onClick={() => markRead(item.id)}>
                        Danh dau da doc
                      </button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
              {notificationsTotal === 0 ? '0 notification' : `${(notificationsPage - 1) * notificationsPageSize + 1}-${Math.min(notificationsPage * notificationsPageSize, notificationsTotal)} / ${notificationsTotal}`}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="btn ghost" disabled={notificationsPage <= 1} onClick={() => setNotificationsPage((prev) => Math.max(1, prev - 1))}>
                Truoc
              </button>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>Trang {notificationsPage}/{notificationsTotalPages}</div>
              <button className="btn ghost" disabled={notificationsPage >= notificationsTotalPages} onClick={() => setNotificationsPage((prev) => Math.min(notificationsTotalPages, prev + 1))}>
                Sau
              </button>
            </div>
          </div>
        </div>
      </div>

      {toast ? (
        <div style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 1000 }} className="card">
          <div style={{ padding: '9px 12px', fontSize: 12 }}>{toast}</div>
        </div>
      ) : null}
    </div>
  )
}

function InfoBox({ title, values }: { title: string; values: string[] }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>{title}</div>
      {values.length ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {values.map((value) => (
            <span key={value} className="chip">{value}</span>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--text4)' }}>(chua co)</div>
      )}
    </div>
  )
}

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('vi-VN')
}
