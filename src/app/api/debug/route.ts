import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    has_password: !!process.env.DASHBOARD_PASSWORD,
    password_length: process.env.DASHBOARD_PASSWORD?.length ?? 0,
    node_env: process.env.NODE_ENV,
  })
}
