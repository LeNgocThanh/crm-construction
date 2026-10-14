'use client'
// src/components/dashboard/DashboardClient.tsx
import { formatDate } from '@/lib/utils'

interface Props {
  stats: {
    totalCustomers: number
    newThisMonth: number
    closedDeals: number
    totalCallsThisMonth: number
    recentLogs: any[]
    statusCounts: Record<string, number>
  }
  role: string
  username: string
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  'Mới':           { bg: '#3B82F615', text: '#3B82F6' },
  'Đang tư vấn':  { bg: '#F9731615', text: '#F97316' },
  'Đã chốt':      { bg: '#22C55E15', text: '#22C55E' },
  'Tạm ngưng':    { bg: '#64748B15', text: '#64748B' },
}

const SENTIMENT_ICON: Record<string, string> = {
  'Tích cực': '😊',
  'Trung lập': '😐',
  'Gay gắt': '😤',
}

function StatCard({
  label, value, sub, icon, color,
}: {
  label: string; value: string | number; sub?: string; icon: string; color: string
}) {
  return (
    <div
      className="card fade-up"
      style={{ padding: '20px 22px', flex: 1 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              letterSpacing: 2,
              color: 'var(--text3)',
              marginBottom: 8,
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontSize: 32,
              fontWeight: 700,
              color,
              letterSpacing: -1,
              lineHeight: 1,
            }}
          >
            {value}
          </div>
          {sub && (
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>
              {sub}
            </div>
          )}
        </div>
        <div
          style={{
            fontSize: 22,
            width: 44,
            height: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 10,
            background: `${color}12`,
          }}
        >
          {icon}
        </div>
      </div>
    </div>
  )
}

export default function DashboardClient({ stats, role, username }: Props) {
  const total = Object.values(stats.statusCounts).reduce((a, b) => a + b, 0)

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            color: 'var(--text3)',
            letterSpacing: 2,
            marginBottom: 4,
          }}
        >
          {new Date().toLocaleDateString('vi-VN', {
            weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
          })}
        </div>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: 'var(--text)',
          }}
        >
          Xin chào, {username} 👋
        </h1>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <StatCard
          label="TỔNG KHÁCH HÀNG"
          value={stats.totalCustomers}
          sub={`+${stats.newThisMonth} tháng này`}
          icon="👥"
          color="var(--blue)"
        />
        <StatCard
          label="GỌI THÁNG NÀY"
          value={stats.totalCallsThisMonth}
          sub="Cuộc gọi đã xử lý"
          icon="📞"
          color="var(--accent)"
        />
        <StatCard
          label="ĐÃ CHỐT"
          value={stats.closedDeals}
          sub="Tổng khách chốt hợp đồng"
          icon="✅"
          color="var(--green)"
        />
        <StatCard
          label="TỈ LỆ CHỐT"
          value={
            stats.totalCustomers > 0
              ? `${Math.round((stats.closedDeals / stats.totalCustomers) * 100)}%`
              : '0%'
          }
          sub="Trên tổng khách"
          icon="📈"
          color="var(--purple)"
        />
      </div>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
        {/* Recent logs */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                letterSpacing: 2,
                color: 'var(--text3)',
              }}
            >
              NHẬT KÝ GẦN NHẤT
            </span>
            <a
              href="/customers"
              style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}
            >
              Xem tất cả →
            </a>
          </div>
          {stats.recentLogs.length === 0 ? (
            <div
              style={{
                padding: 40,
                textAlign: 'center',
                color: 'var(--text3)',
                fontSize: 13,
              }}
            >
              Chưa có nhật ký liên hệ nào
            </div>
          ) : (
            stats.recentLogs.map((log, i) => (
              <div
                key={log.id}
                style={{
                  padding: '14px 20px',
                  borderBottom: i < stats.recentLogs.length - 1 ? '1px solid var(--border)' : 'none',
                  display: 'flex',
                  gap: 14,
                  alignItems: 'flex-start',
                }}
              >
                <div style={{ fontSize: 22, flexShrink: 0, marginTop: 2 }}>
                  {SENTIMENT_ICON[log.ai_sentiment || 'Trung lập']}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: 3,
                    }}
                  >
                    <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: 13 }}>
                      {log.customer?.full_name || log.customer?.phone_number || 'Không rõ'}
                    </span>
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 11,
                        color: 'var(--text3)',
                      }}
                    >
                      {formatDate(log.contact_date).split(' ')[0]}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--text2)',
                      marginBottom: 5,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {log.ai_summary || 'Chưa có tóm tắt'}
                  </div>
                  {log.next_action && (
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--accent)',
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      → {log.next_action}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Status Breakdown */}
        <div className="card" style={{ padding: 20 }}>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              letterSpacing: 2,
              color: 'var(--text3)',
              marginBottom: 20,
            }}
          >
            PHÂN BỔ TRẠNG THÁI
          </div>
          {Object.entries(stats.statusCounts).map(([status, count]) => (
            <div key={status} style={{ marginBottom: 18 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 6,
                }}
              >
                <span style={{ fontSize: 13, color: 'var(--text2)' }}>{status}</span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: STATUS_COLORS[status]?.text,
                  }}
                >
                  {count}
                </span>
              </div>
              <div
                style={{
                  height: 6,
                  background: 'var(--bg)',
                  borderRadius: 3,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: total > 0 ? `${(count / total) * 100}%` : '0%',
                    background: STATUS_COLORS[status]?.text,
                    borderRadius: 3,
                    transition: 'width 1s ease',
                  }}
                />
              </div>
            </div>
          ))}

          <div
            style={{
              marginTop: 24,
              paddingTop: 16,
              borderTop: '1px solid var(--border)',
              fontSize: 12,
              color: 'var(--text3)',
              textAlign: 'center',
            }}
          >
            Tổng: {total} khách hàng
          </div>
        </div>
      </div>
    </div>
  )
}
