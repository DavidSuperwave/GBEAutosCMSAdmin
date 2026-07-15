import { NextResponse } from "next/server"

import { requireCmsRole } from "../../../../../services/cmsRequestAuth"
import {
  buildAdminResetUrl,
  isSmtpReady,
  parseInviteRole,
} from "../../../../../services/userInvite"

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
  // Authenticate before parsing the request body so anonymous or unauthorized
  // callers receive a consistent 401/403 without making the server consume an
  // arbitrary JSON payload first.
  const auth = await requireCmsRole(request, [], "Solo administradores pueden invitar usuarios.")
  if (auth.response) return auth.response
  const { payload, user } = auth

  let email = ""
  let role: "admin" | "general" | "sales" = "sales"

  try {
    const body = (await request.json()) as { email?: unknown; role?: unknown }
    email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    const parsedRole = parseInviteRole(body.role)
    if (!parsedRole.ok) {
      return NextResponse.json({ error: "Selecciona un rol de usuario valido." }, { status: 400 })
    }
    role = parsedRole.role
  } catch {
    return NextResponse.json({ error: "Solicitud invalida." }, { status: 400 })
  }

  if (!email || !EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: "Ingresa un correo electronico valido." }, { status: 400 })
  }

  const smtpReady = isSmtpReady(process.env)

  // Fail before creating an account if neither delivery path can produce a
  // usable invitation. This response is visible only after the admin guard.
  if (!smtpReady && !buildAdminResetUrl(process.env.NEXT_PUBLIC_SERVER_URL, "preflight")) {
    return NextResponse.json(
      { error: "Configura NEXT_PUBLIC_SERVER_URL para generar enlaces de acceso manuales." },
      { status: 500 },
    )
  }

  let created = true
  try {
    await payload.create({
      collection: "users",
      data: { email, password: createTemporaryPassword(), role },
      overrideAccess: true,
      req: {
        headers: request.headers,
        user,
      },
    })
  } catch (error) {
    const createMessage = getUnknownErrorMessage(error, "No se pudo crear el usuario.")
    if (!isDuplicateEmailError(createMessage)) {
      return NextResponse.json({ error: createMessage }, { status: 400 })
    }
    created = false
  }

  let setupUrl: string | undefined
  try {
    const resetToken = await payload.forgotPassword({
      collection: "users",
      data: { email },
      disableEmail: !smtpReady,
      overrideAccess: true,
      req: {
        headers: request.headers,
        user,
      },
    })

    if (!smtpReady) {
      setupUrl = buildAdminResetUrl(process.env.NEXT_PUBLIC_SERVER_URL, resetToken) ?? undefined
      if (!setupUrl) {
        return NextResponse.json(
          { error: "No se pudo generar el enlace de acceso manual." },
          { status: 500 },
        )
      }
    }
  } catch (error) {
    const fallback = smtpReady
      ? "No se pudo enviar el correo de invitacion."
      : "No se pudo generar el enlace de acceso manual."
    return NextResponse.json({ error: getUnknownErrorMessage(error, fallback) }, { status: 400 })
  }

  return NextResponse.json(
    {
      created,
      message: smtpReady
        ? created
          ? "Invitacion enviada. El usuario recibira un correo para crear su contrasena."
          : "El usuario ya existia. Se reenvio el correo para establecer su contrasena; su rol actual no cambio."
        : created
          ? "Cuenta creada. SMTP no esta configurado; copia el enlace de acceso y compartelo manualmente con el usuario."
          : "El usuario ya existia y su rol actual no cambio. SMTP no esta configurado; copia el nuevo enlace de acceso y compartelo manualmente.",
      ok: true,
      role: created ? role : undefined,
      roleUnchanged: !created,
      setupUrl,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  )
}
