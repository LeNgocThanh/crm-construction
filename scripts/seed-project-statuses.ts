import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  const statuses = [
    { status_key: 'draft', status_name: 'Nháp', sort_order: 0, is_terminal: false, color_hex: '#64748B' },
    { status_key: 'confirmed', status_name: 'Đã xác nhận', sort_order: 10, is_terminal: false, color_hex: '#0EA5E9' },
    { status_key: 'in_progress', status_name: 'Đang thi công', sort_order: 20, is_terminal: false, color_hex: '#F59E0B' },
    { status_key: 'paused', status_name: 'Tạm ngưng', sort_order: 30, is_terminal: false, color_hex: '#A855F7' },
    { status_key: 'completed', status_name: 'Hoàn thành', sort_order: 40, is_terminal: true, color_hex: '#22C55E' },
    { status_key: 'cancelled', status_name: 'Đã hủy', sort_order: 50, is_terminal: true, color_hex: '#EF4444' },
  ]

  for (const s of statuses) {
    await (db as any).projectStatus.upsert({
      where: { status_key: s.status_key },
      update: {
        status_name: s.status_name,
        sort_order: s.sort_order,
        is_terminal: s.is_terminal,
        color_hex: s.color_hex,
        is_active: true,
      },
      create: {
        ...s,
        is_active: true,
      },
    })
  }

  const rules = [
    {
      rule_code: 'project_draft_to_confirmed_require_customer_ready',
      rule_name: 'Nháp -> Đã xác nhận cần khách đủ điều kiện',
      from_status_key: 'draft',
      to_status_key: 'confirmed',
      rule_mode: 'warning',
      check_type: 'require_customer_confirm_ready',
      message: 'Khách hàng chưa đủ điều kiện xác nhận dự án.',
      sort_order: 10,
    },
    {
      rule_code: 'project_confirmed_to_in_progress_require_start_date',
      rule_name: 'Đã xác nhận -> Đang thi công cần ngày khởi công',
      from_status_key: 'confirmed',
      to_status_key: 'in_progress',
      rule_mode: 'warning',
      check_type: 'require_start_date',
      message: 'Chưa có ngày khởi công (start_date).',
      sort_order: 20,
    },
    {
      rule_code: 'project_any_to_paused_require_reason',
      rule_name: 'Chuyển sang Tạm ngưng cần lý do',
      from_status_key: 'in_progress',
      to_status_key: 'paused',
      rule_mode: 'warning',
      check_type: 'require_reason',
      message: 'Nên nhập lý do khi chuyển sang tạm ngưng.',
      sort_order: 30,
    },
    {
      rule_code: 'project_any_to_cancelled_require_reason',
      rule_name: 'Chuyển sang Đã hủy cần lý do',
      from_status_key: 'in_progress',
      to_status_key: 'cancelled',
      rule_mode: 'warning',
      check_type: 'require_reason',
      message: 'Nên nhập lý do khi chuyển sang đã hủy.',
      sort_order: 40,
    },
  ]

  for (const r of rules) {
    await (db as any).projectStatusTransitionRule.upsert({
      where: { rule_code: r.rule_code },
      update: {
        rule_name: r.rule_name,
        from_status_key: r.from_status_key,
        to_status_key: r.to_status_key,
        rule_mode: r.rule_mode,
        check_type: r.check_type,
        message: r.message,
        sort_order: r.sort_order,
        is_active: true,
      },
      create: {
        ...r,
        is_active: true,
      },
    })
  }

  console.log('Seeded project statuses and transition rules.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
