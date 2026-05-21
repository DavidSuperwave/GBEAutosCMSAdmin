import { NextResponse } from "next/server"
import config from "@payload-config"
import { getPayload } from "payload"

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isDuplicateEmailError(message: string) {
  return /(already|exist|duplicate|unique|taken)/i.test(message)
}

function getUnknownErrorMessage(error: unknown, fallback: string) {
  if (!error) return fallback

  if (error instanceof Error) return error.message || fallback
  if (typeof error === "string") return error || fallback

  if (typeof error === "object") {
    const record = error as Record<string, unknown>
    if (typeof record.message === "string") return record.message
    if (typeof record.error === "string") return record.error
    if (Array.isArray(record.errors) && typeof (record.errors[0] as { message?: unknown })?.message === "string") {
      return (record.errors[0] as { message: string }).message
    }
  }

  return fallback
}

function createTemporaryPassword() {
  return `${crypto.randomUUID()}Aa!1`
}

export async function POST(request: Request) {
  let email = ""

  try {
    const body = (await request.json()) as { email?: unknown }
    email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
  } catch {
    return NextResponse.json({ error: "Solicitud invalida." }, { status: 400 })
  }

  if (!email || !EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: "Ingresa un correo electronico valido." }, { status: 400 })
  }

  const payload = await getPayload({ config })
  const authResult = await payload.auth({
    canSetHeaders: false,
    headers: request.headers,
  })

  if (!authResult.user) {
    return NextResponse.json({ error: "Sesion invalida. Inicia sesion de nuevo." }, { status: 401 })
  }

  let created = true
  try {
    await payload.create({
      collection: "users",
      data: { email, password: createTemporaryPassword() },
      overrideAccess: true,
      req: {
        headers: request.headers,
        user: authResult.user,
      },
    })
  } catch (error) {
    const createMessage = getUnknownErrorMessage(error, "No se pudo crear el usuario.")
    if (!isDuplicateEmailError(createMessage)) {
      return NextResponse.json({ error: createMessage }, { status: 400 })
    }
    created = false
  }

  try {
    await payload.forgotPassword({
      collection: "users",
      data: { email },
      overrideAccess: true,
      req: {
        headers: request.headers,
        user: authResult.user,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: getUnknownErrorMessage(error, "No se pudo enviar el correo de invitacion.") }, { status: 400 })
  }

  return NextResponse.json({
    created,
    message: created
      ? "Invitacion enviada. El usuario recibira un correo para crear su contrasena."
      : "El usuario ya existia. Se envio nuevamente el correo para establecer contrasena.",
    ok: true,
  })
}
