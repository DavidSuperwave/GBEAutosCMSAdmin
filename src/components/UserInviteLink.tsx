"use client"

import React, { type FormEvent, useEffect, useState } from "react"
import { createPortal } from "react-dom"

type InviteResult =
  | {
      message: string
      type: "error" | "success"
    }
  | null

function getResponseMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>
    if (typeof record.message === "string") return record.message
    if (typeof record.error === "string") return record.error
  }

  return fallback
}

export default function UserInviteLink() {
  const [target, setTarget] = useState<Element | null>(null)
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<InviteResult>(null)

  useEffect(() => {
    const findTarget = () => {
      const titleActions = document.querySelector(".collection-list--users .list-header__title-actions")
      setTarget(titleActions)
    }

    findTarget()
    const observer = new MutationObserver(findTarget)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    document.body.classList.toggle("user-invite-modal-is-open", open)
    return () => document.body.classList.remove("user-invite-modal-is-open")
  }, [open])

  async function submitInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setResult(null)

    try {
      const response = await fetch("/api/users/invite", {
        body: JSON.stringify({ email }),
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
        type: "success",
      })
      setEmail("")
    } catch (error) {
      setResult({
        message: error instanceof Error ? error.message : "No se pudo enviar la invitacion.",
        type: "error",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const trigger = (
    <button className="user-invite-trigger" onClick={() => setOpen(true)} type="button">
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
                onClick={() => setOpen(false)}
                type="button"
              />
              <div className="user-invite-modal__panel">
                <header className="user-invite-modal__header">
                  <div>
                    <p>Usuarios</p>
                    <h2>Invitar por correo</h2>
                  </div>
                  <button aria-label="Cerrar" onClick={() => setOpen(false)} type="button">
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

                  <p className="user-invite-modal__hint">
                    Se crea la cuenta y se envia un correo para definir la contrasena.
                  </p>

                  {result ? (
                    <p className={`user-invite-result user-invite-result--${result.type}`}>{result.message}</p>
                  ) : null}

                  <footer className="user-invite-modal__footer">
                    <button onClick={() => setOpen(false)} type="button">
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
