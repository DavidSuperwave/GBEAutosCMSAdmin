"use client"

import React, { type FormEvent, useEffect, useState } from "react"
import { useAuth } from "@payloadcms/ui"
import { createPortal } from "react-dom"

import { canInviteUsers } from "../services/userInvite"

type InviteResult =
  | {
      message: string
      type: "error"
    }
  | {
      message: string
      setupUrl?: string
      type: "success"
    }
  | null

type CopyStatus = "copied" | "error" | "idle"

type InviteRole = "admin" | "general" | "sales"

const INVITE_ROLES: Array<{ description: string; label: string; value: InviteRole }> = [
  {
    description: "Acceso completo, incluyendo usuarios y asignacion de roles.",
    label: "Administrador",
    value: "admin",
  },
  {
    description: "Gestiona inventario, contenido, medios e importaciones.",
    label: "Operacion general",
    value: "general",
  },
  {
    description: "Gestiona prospectos y consulta el inventario.",
    label: "Ventas",
    value: "sales",
  },
]

function getResponseMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>
    if (typeof record.message === "string") return record.message
    if (typeof record.error === "string") return record.error
  }

  return fallback
}

function getResponseSetupUrl(payload: unknown) {
  if (!payload || typeof payload !== "object") return undefined

  const setupUrl = (payload as Record<string, unknown>).setupUrl
  return typeof setupUrl === "string" && /^https?:\/\//i.test(setupUrl) ? setupUrl : undefined
}

export default function UserInviteLink() {
  const { user } = useAuth<{ role?: unknown }>()
  const isAdmin = canInviteUsers(user)
  const [target, setTarget] = useState<Element | null>(null)
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<InviteRole>("sales")
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle")
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<InviteResult>(null)
  const selectedRole = INVITE_ROLES.find((option) => option.value === role) ?? INVITE_ROLES[2]

  useEffect(() => {
    if (!isAdmin) return

    const findTarget = () => {
      const titleActions = document.querySelector(".collection-list--users .list-header__title-actions")
      setTarget(titleActions)
    }

    findTarget()
    const observer = new MutationObserver(findTarget)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => observer.disconnect()
  }, [isAdmin])

  useEffect(() => {
    document.body.classList.toggle("user-invite-modal-is-open", open)
    return () => document.body.classList.remove("user-invite-modal-is-open")
  }, [open])

  function closeModal() {
    if (submitting) return
    setOpen(false)
    setResult(null)
    setCopyStatus("idle")
  }

  function openModal() {
    setResult(null)
    setCopyStatus("idle")
    setOpen(true)
  }

  async function copySetupLink() {
    if (result?.type !== "success" || !result.setupUrl) return

    try {
      await navigator.clipboard.writeText(result.setupUrl)
      setCopyStatus("copied")
    } catch {
      setCopyStatus("error")
    }
  }

  async function submitInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setResult(null)
    setCopyStatus("idle")

    try {
      const response = await fetch("/api/users/invite", {
        body: JSON.stringify({ email, role }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(getResponseMessage(payload, "No se pudo enviar la invitacion."))
      }

      setResult({
        message: getResponseMessage(payload, "Invitacion enviada correctamente."),
        setupUrl: getResponseSetupUrl(payload),
        type: "success",
      })
      setEmail("")
      setRole("sales")
    } catch (error) {
      setResult({
        message: error instanceof Error ? error.message : "No se pudo enviar la invitacion.",
        type: "error",
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (!isAdmin) return null

  const trigger = (
    <button className="user-invite-trigger" onClick={openModal} type="button">
      Invitar usuario
    </button>
  )

  return (
    <>
      {target ? createPortal(trigger, target) : <div className="user-invite-fallback">{trigger}</div>}
      {open
        ? createPortal(
            <div className="user-invite-modal" role="dialog" aria-modal="true" aria-label="Invitar usuario">
              <button
                aria-label="Cerrar formulario de invitacion"
                className="user-invite-modal__backdrop"
                disabled={submitting}
                onClick={closeModal}
                type="button"
              />
              <div className="user-invite-modal__panel">
                <header className="user-invite-modal__header">
                  <div>
                    <p>Usuarios</p>
                    <h2>Invitar por correo</h2>
                  </div>
                  <button aria-label="Cerrar" disabled={submitting} onClick={closeModal} type="button">
                    x
                  </button>
                </header>

                <form className="user-invite-modal__body" onSubmit={submitInvitation}>
                  <label>
                    <span>Correo electronico</span>
                    <input
                      autoComplete="email"
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="persona@empresa.com"
                      required
                      type="email"
                      value={email}
                    />
                  </label>

                  <label>
                    <span>Rol inicial</span>
                    <select
                      aria-describedby="user-invite-role-description"
                      onChange={(event) => setRole(event.target.value as InviteRole)}
                      value={role}
                    >
                      {INVITE_ROLES.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <small id="user-invite-role-description">{selectedRole.description}</small>
                  </label>

                  <p className="user-invite-modal__hint">
                    Se crea la cuenta con este rol y se genera un acceso. Si el correo esta configurado,
                    se envia automaticamente.
                  </p>

                  {result ? (
                    <p className={`user-invite-result user-invite-result--${result.type}`}>{result.message}</p>
                  ) : null}

                  {result?.type === "success" && result.setupUrl ? (
                    <div className="user-invite-setup-link">
                      <button onClick={copySetupLink} type="button">
                        {copyStatus === "copied" ? "Enlace copiado" : "Copiar enlace de acceso"}
                      </button>
                      <p aria-live="polite">
                        {copyStatus === "copied"
                          ? "Listo. Comparte el enlace directamente con el usuario."
                          : copyStatus === "error"
                            ? "No se pudo copiar el enlace. Vuelve a intentarlo."
                            : "El enlace es temporal y debe compartirse de forma privada."}
                      </p>
                    </div>
                  ) : null}

                  <footer className="user-invite-modal__footer">
                    <button disabled={submitting} onClick={closeModal} type="button">
                      Cerrar
                    </button>
                    <button disabled={submitting} type="submit">
                      {submitting ? "Enviando..." : "Enviar invitacion"}
                    </button>
                  </footer>
                </form>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
