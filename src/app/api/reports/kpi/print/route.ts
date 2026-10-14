// src/app/api/reports/kpi/print/route.ts â€” V2.0: fetch from local API
import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/authz'

export async function GET(req: NextRequest) {
  const auth = await requireRoles(['admin', 'manager'])
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session

  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month') || (() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
  })()

  // Fetch data from local KPI API
  const base = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const res  = await fetch(`${base}/api/reports/kpi?month=${month}`, {
    headers: { Cookie: req.headers.get('cookie') || '' },
  })

  if (!res.ok) return new NextResponse('Lá»—i táº£i dá»¯ liá»‡u', { status: 500 })
  const { overview, staffStats, hotLeads, monthLabel } = await res.json()

  const medal = (i: number) => ['ðŸ¥‡', 'ðŸ¥ˆ', 'ðŸ¥‰'][i] || `${i + 1}.`

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BÃ¡o cÃ¡o KPI â€” ${monthLabel}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Be Vietnam Pro', sans-serif; background: #f8fafc; color: #1e293b; font-size: 13px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { max-width: 900px; margin: 0 auto; padding: 32px 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 20px; border-bottom: 2px solid #F97316; margin-bottom: 28px; }
    .brand { font-size: 22px; font-weight: 800; color: #F97316; letter-spacing: -0.5px; }
    .meta { text-align: right; color: #64748b; font-size: 11px; font-family: 'JetBrains Mono', monospace; }
    .meta strong { display: block; font-size: 16px; color: #1e293b; font-weight: 700; margin-bottom: 2px; }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 28px; }
    .stat { background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; text-align: center; }
    .stat-val { font-size: 28px; font-weight: 800; font-family: 'JetBrains Mono', monospace; color: #F97316; line-height: 1; }
    .stat-lbl { font-size: 10px; color: #94a3b8; margin-top: 4px; letter-spacing: 1.5px; text-transform: uppercase; }
    .section-title { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 2.5px; color: #94a3b8; text-transform: uppercase; margin-bottom: 14px; }
    .podium { display: flex; gap: 12px; justify-content: center; margin-bottom: 28px; }
    .podium-card { background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 20px; text-align: center; flex: 1; max-width: 180px; }
    .podium-card.top1 { border-color: #F97316; background: #FFF7ED; }
    .podium-rank { font-size: 22px; margin-bottom: 4px; }
    .podium-name { font-weight: 700; font-size: 14px; color: #1e293b; }
    .podium-score { font-family: 'JetBrains Mono', monospace; font-size: 20px; font-weight: 800; color: #F97316; margin-top: 4px; }
    .podium-calls { font-size: 11px; color: #64748b; }
    table { width: 100%; border-collapse: collapse; background: white; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0; margin-bottom: 28px; }
    th { background: #F97316; color: white; padding: 10px 14px; text-align: left; font-size: 10px; letter-spacing: 1.5px; font-family: 'JetBrains Mono', monospace; }
    td { padding: 10px 14px; border-bottom: 1px solid #f1f5f9; font-size: 12px; }
    tr:last-child td { border-bottom: none; }
    .bar-wrap { background: #f1f5f9; border-radius: 3px; height: 6px; min-width: 60px; }
    .bar { height: 6px; border-radius: 3px; background: #F97316; }
    .score-circle { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; background: #FFF7ED; border: 1.5px solid #F9731640; font-weight: 800; font-size: 12px; color: #F97316; font-family: 'JetBrains Mono', monospace; }
    .leads { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 28px; }
    .lead-card { background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; }
    .lead-phone { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #3B82F6; font-weight: 700; }
    .lead-name { font-size: 12px; color: #1e293b; margin-top: 2px; }
    .lead-score { font-family: 'JetBrains Mono', monospace; font-weight: 800; color: #F97316; font-size: 16px; float: right; margin-top: -24px; }
    .footer { border-top: 1px solid #e2e8f0; padding-top: 12px; text-align: center; color: #94a3b8; font-size: 10px; font-family: 'JetBrains Mono', monospace; }
    .print-btn { position: fixed; top: 20px; right: 20px; background: #F97316; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; z-index: 999; font-family: 'Be Vietnam Pro', sans-serif; }
    @media print { .print-btn { display: none; } body { background: white; } .page { padding: 20px; } }
  </style>
</head>
<body>
<button class="print-btn" onclick="window.print()">ðŸ–¨ï¸ In / LÆ°u PDF</button>
<div class="page">
  <!-- Header -->
  <div class="header">
    <div>
      <div class="brand">CRM Construction</div>
      <div style="font-size:12px;color:#64748b;margin-top:3px;">BÃ¡o cÃ¡o hiá»‡u suáº¥t kinh doanh</div>
    </div>
    <div class="meta">
      <strong>ThÃ¡ng ${monthLabel}</strong>
      Xuáº¥t bá»Ÿi: ${session.user.username}<br>
      ${new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
    </div>
  </div>

  <!-- Overview stats -->
  <div class="section-title">Tá»”NG QUAN</div>
  <div class="stats">
    <div class="stat"><div class="stat-val">${overview.totalCalls}</div><div class="stat-lbl">Tá»•ng cuá»™c gá»i</div></div>
    <div class="stat"><div class="stat-val">${overview.conversionRate}%</div><div class="stat-lbl">Tá»‰ lá»‡ tÃ­ch cá»±c</div></div>
    <div class="stat"><div class="stat-val">${overview.newCustomers}</div><div class="stat-lbl">KH má»›i</div></div>
    <div class="stat"><div class="stat-val">${overview.closedCustomers}</div><div class="stat-lbl">ÄÃ£ chá»‘t</div></div>
  </div>

  <!-- Podium top 3 -->
  ${staffStats.length > 0 ? `
  <div class="section-title">TOP NHÃ‚N VIÃŠN</div>
  <div class="podium">
    ${staffStats.slice(0, 3).map((s: any, i: number) => `
    <div class="podium-card ${i === 0 ? 'top1' : ''}">
      <div class="podium-rank">${medal(i)}</div>
      <div class="podium-name">${s.staff.username}</div>
      <div class="podium-score">${s.score}</div>
      <div class="podium-calls">${s.total_calls} cuá»™c Â· ${s.conversion_rate}% tÃ­ch cá»±c</div>
    </div>`).join('')}
  </div>` : ''}

  <!-- Staff table -->
  <div class="section-title">CHI TIáº¾T NHÃ‚N VIÃŠN</div>
  <table>
    <thead>
      <tr>
        <th>NhÃ¢n viÃªn</th>
        <th>Tá»•ng gá»i</th>
        <th>TÃ­ch cá»±c</th>
        <th>Gay gáº¯t</th>
        <th>NgÃ y active</th>
        <th>TB/ngÃ y</th>
        <th>Score</th>
        <th>Tiáº¿n Ä‘á»™</th>
      </tr>
    </thead>
    <tbody>
      ${staffStats.map((s: any) => `
      <tr>
        <td><strong>${s.staff.username}</strong></td>
        <td style="font-family:'JetBrains Mono',monospace;font-weight:700">${s.total_calls}</td>
        <td style="color:#22C55E;font-weight:600">${s.positive}</td>
        <td style="color:#EF4444;font-weight:600">${s.negative}</td>
        <td>${s.active_days}</td>
        <td style="font-family:'JetBrains Mono',monospace">${s.avg_per_day}</td>
        <td><div class="score-circle">${s.score}</div></td>
        <td><div class="bar-wrap"><div class="bar" style="width:${s.score}%"></div></div></td>
      </tr>`).join('')}
    </tbody>
  </table>

  <!-- Hot leads -->
  ${hotLeads.length > 0 ? `
  <div class="section-title">HOT LEADS (SCORE â‰¥ 7, CHÆ¯A CHá»T)</div>
  <div class="leads">
    ${hotLeads.map((c: any) => `
    <div class="lead-card">
      <div class="lead-score">${c.potential_score}</div>
      <div class="lead-phone">${c.phone_number}</div>
      <div class="lead-name">${c.full_name || 'ChÆ°a cÃ³ tÃªn'}</div>
      <div style="font-size:10px;color:#94a3b8;margin-top:4px">${c.status} Â· ${c.total_contacts} láº§n</div>
    </div>`).join('')}
  </div>` : ''}

  <div class="footer">CRM Construction â€” BÃ¡o cÃ¡o tá»± Ä‘á»™ng â€” ${new Date().getFullYear()}</div>
</div>
${searchParams.get('print') === '1' ? '<script>setTimeout(()=>window.print(),800)</script>' : ''}
</body>
</html>`

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}


