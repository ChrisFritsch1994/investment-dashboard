import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { password } = await request.json()

  const correctPassword = process.env.DASHBOARD_PASSWORD

  if (!correctPassword) {
    return NextResponse.json({ error: 'Server nicht konfiguriert' }, { status: 500 })
  }

  if (password !== correctPassword) {
    return NextResponse.json({ error: 'Falsches Passwort' }, { status: 401 })
  }

  // Session-Token = Base64 des Passworts (kein separates SECRET nötig)
  const sessionToken = Buffer.from(correctPassword).toString('base64')

  const response = NextResponse.json({ ok: true })
  response.cookies.set('auth_session', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 Tage
    path: '/',
  })
  return response
}
