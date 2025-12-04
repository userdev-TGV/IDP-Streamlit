import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSession } from '../context/SessionContext'

type TourStep = {
  selector: string
  title: string
  text: string
  route?: string
  key?: string
}

const steps: TourStep[] = [
  { selector: '[data-tour-target=nav-links]', key: 'header', title: 'Controles principales', text: 'Accede a las diferentes funcionalidades de la aplicacion', route: '/' },
  { selector: '[data-tour-target=nav-extract]', key: 'extract', title: 'Extraccion', text: 'Sube contratos y extrae datos en JSON.', route: '/extract' },
  { selector: '[data-tour-target=idp-upload]', key: 'upload', title: 'Subida de contratos', text: 'Selecciona PDFs o imagenes, agrega un prompt y procesa.', route: '/extract' },
  { selector: '[data-tour-target=idp-results-main]', key: 'results', title: 'Resultados extraidos', text: 'Aqui veras los valores de pago y datos clave del contrato.', route: '/extract' },
  { selector: '[data-tour-target=nav-chat-doc]', key: 'chatdoc', title: 'Chat con contrato', text: 'Pregunta en lenguaje natural sobre el contrato procesado.', route: '/chat-doc' },
  { selector: '[data-tour-target=idp-chat-doc-input]', key: 'chatdoc-input', title: 'Escribe tu pregunta', text: 'Formula la pregunta y envia; cada consulta consume tokens.', route: '/chat-doc' },
  { selector: '[data-tour-target=idp-chat-doc-answer]', key: 'chatdoc-answer', title: 'Respuesta del contrato', text: 'Aqui se mostrara la respuesta de la IA sobre el contrato.', route: '/chat-doc' },
  { selector: '[data-tour-target=nav-chat-db]', key: 'chatdb', title: 'Chat base de datos', text: 'Consulta Azure SQL en lenguaje natural.', route: '/chat-db' },
  { selector: '[data-tour-target=idp-chat-db-form]', key: 'chatdb-form', title: 'Consulta la base', text: 'Ingresa tu pregunta; el asistente genera el SQL y muestra la respuesta.', route: '/chat-db' },
  { selector: '[data-tour-target=idp-chat-db-answer]', key: 'chatdb-answer', title: 'Respuesta de la base', text: 'Aqui veras la respuesta del asistente sobre los datos.', route: '/chat-db' },
  { selector: '[data-tour-target=nav-charts]', key: 'charts', title: 'Graficas', text: 'Genera visualizaciones ejecutivas a partir de prompts.', route: '/charts' },
  { selector: '[data-tour-target=idp-charts-form]', key: 'charts-form', title: 'Crear grafica', text: 'Describe la grafica que necesitas y genera la imagen.', route: '/charts' },
  { selector: '[data-tour-target=idp-charts-result]', key: 'charts-result', title: 'Resultado de grafica', text: 'Aqui se previsualiza la grafica generada por la IA.', route: '/charts' },
  { selector: '[data-tour-target=nav-tokens]', key: 'tokens', title: 'Tokens', text: 'Monitorea tus creditos y solicita mas si se agotan.', route: '/' },
]

const TOUR_KEY = 'idp-tour-seen'

export function Tour() {
  const { isAuthenticated } = useAuth()
  const { extractedText, openaiResponse } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const [promptOpen, setPromptOpen] = useState(false)
  const [active, setActive] = useState(false)
  const [idx, setIdx] = useState(0)
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const step = useMemo(() => steps[idx], [idx])
  const computeCenter = () => ({
    top: window.scrollY + window.innerHeight / 2 - 120,
    left: window.scrollX + window.innerWidth / 2 - 160,
  })

  const clampPos = (pos: { top: number; left: number }) => {
    const minTop = window.scrollY + 24
    const minLeft = window.scrollX + 24
    const maxTop = window.scrollY + window.innerHeight - 220
    const maxLeft = window.scrollX + window.innerWidth - 220
    return {
      top: Math.min(Math.max(pos.top, minTop), maxTop),
      left: Math.min(Math.max(pos.left, minLeft), maxLeft),
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      const seen = localStorage.getItem(TOUR_KEY)
      if (!seen) setPromptOpen(true)
    } else {
      setPromptOpen(false)
      setActive(false)
    }

    const handleStartTour = (e: Event) => {
      const ev = e as CustomEvent<string>
      try {
        localStorage.removeItem(TOUR_KEY)
      } catch {
        // ignore
      }
      if (ev.detail) {
        const index = steps.findIndex((s) => s.key === ev.detail)
        if (index >= 0) {
          setIdx(index)
        } else {
          setIdx(0)
        }
      } else {
        setIdx(0)
      }
      setPromptOpen(false)
      setPopoverPos(clampPos(computeCenter()))
      setActive(true)
    }

    window.addEventListener('idp-start-tour', handleStartTour)
    return () => {
      window.removeEventListener('idp-start-tour', handleStartTour)
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (!active) return

    const placePopover = () => {
      const el = document.querySelector(step.selector) as HTMLElement | null
      document.querySelectorAll('.tour-highlight').forEach((n) => n.classList.remove('tour-highlight'))
      if (el) {
        el.classList.add('tour-highlight')
        const rect = el.getBoundingClientRect()
        const pos = calculatePlacement(step.selector, rect)
        setPopoverPos(clampPos(pos))
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } else {
        setPopoverPos(clampPos(computeCenter()))
      }
    }

    if (step.route && location.pathname !== step.route) {
      navigate(step.route)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => requestAnimationFrame(placePopover), 450)
    } else {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => requestAnimationFrame(placePopover), 150)
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [active, step, location.pathname, navigate])

  const next = () => {
    if (idx === steps.length - 1) {
      skipTour()
    } else {
      setIdx((i) => (i + 1) % steps.length)
    }
  }
  const prev = () => setIdx((i) => (i - 1 + steps.length) % steps.length)

  const startTour = () => {
    setPromptOpen(false)
    localStorage.setItem(TOUR_KEY, '1')
    setIdx(0)
    setActive(true)
    setPopoverPos(clampPos(computeCenter()))
  }

  const skipTour = () => {
    setPromptOpen(false)
    setActive(false)
    localStorage.setItem(TOUR_KEY, '1')
    document.querySelectorAll('.tour-highlight').forEach((n) => n.classList.remove('tour-highlight'))
    setPopoverPos(clampPos(computeCenter()))
  }

  const orientation = step.selector === '[data-tour-target=nav-links]' || step.selector === '[data-tour-target=nav-tokens]' ? 'left' : 'top'

  return (
    <>
      {promptOpen && isAuthenticated && (
        <div className="tour-overlay tour-centered">
          <div className="tour-card" style={{ maxWidth: 420 }}>
            <div className="tour-header">
              <h4>Bienvenido a IDP</h4>
              <button className="ghost" onClick={skipTour}>
                x
              </button>
            </div>
            <p className="muted">Te gustaria hacer un tour para conocer las funcionalidades principales?</p>
            <div className="tour-footer" style={{ justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button className="btn btn-secondary" onClick={skipTour}>
                Omitir
              </button>
              <button className="btn btn-primary" onClick={startTour}>
                Iniciar tour
              </button>
            </div>
          </div>
        </div>
      )}

      {active && (
        <div className="tour-overlay">
          <div
            className={`tour-card tour-pop ${orientationClass(step.selector)}`}
            style={
              popoverPos
                ? {
                    position: 'fixed',
                    top: `${popoverPos.top}px`,
                    left: `${popoverPos.left}px`,
                    maxWidth: 360,
                    zIndex: 1100,
                  }
                : { maxWidth: 360, zIndex: 1100 }
            }
          >
            <div className="tour-header">
              <h4>{step.title}</h4>
              <button className="tour-close" onClick={skipTour} aria-label="Cerrar">
                x
              </button>
            </div>
            <p className="muted">
              {step.selector === '[data-tour-target=idp-results-main]' && !openaiResponse
                ? 'Aun no se ha procesado un archivo. Sube un contrato en Extraccion y espera a que termine; luego veras los resultados aqui.'
                : step.selector === '[data-tour-target=idp-chat-doc-input]' && (!extractedText || extractedText.length === 0)
                  ? 'Primero procesa un contrato en Extraccion. Luego podras chatear con el contrato desde esta caja.'
                  : step.text}
            </p>
            <div className="tour-dots">
              {steps.map((_, i) => (
                <span key={i} className={i === idx ? 'active' : ''} />
              ))}
            </div>
            <div className="tour-footer">
              <button className="btn tour-secondary" onClick={prev}>
                Anterior
              </button>
              <span className="tour-progress">Paso {idx + 1} de {steps.length}</span>
              <button className="btn tour-primary" onClick={next}>
                {idx === steps.length - 1 ? 'Finalizar tour' : 'Siguiente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default Tour

function orientationClass(selector: string) {
  const leftTargets = [
    '[data-tour-target=nav-links]',
    '[data-tour-target=nav-extract]',
    '[data-tour-target=nav-chat-doc]',
    '[data-tour-target=nav-chat-db]',
    '[data-tour-target=nav-charts]',
    '[data-tour-target=nav-tokens]',
  ]
  if (leftTargets.includes(selector)) return 'left'
  if (selector === '[data-tour-target=idp-chat-db-form]' || selector === '[data-tour-target=idp-chat-db-answer]') return 'top'
  if (selector === '[data-tour-target=idp-charts-form]' || selector === '[data-tour-target=idp-charts-result]') return 'top'
  return 'top'
}

function calculatePlacement(selector: string, rect: DOMRect) {
  const baseLeft = {
    top: rect.top + window.scrollY + rect.height / 2 - 80,
    left: rect.right + 20,
  }
  const below = {
    top: rect.bottom + window.scrollY + 12,
    left: rect.left + window.scrollX,
  }
  if (
    selector === '[data-tour-target=nav-links]' ||
    selector === '[data-tour-target=nav-extract]' ||
    selector === '[data-tour-target=nav-chat-doc]' ||
    selector === '[data-tour-target=nav-chat-db]' ||
    selector === '[data-tour-target=nav-charts]' ||
    selector === '[data-tour-target=nav-tokens]'
  ) {
    return baseLeft
  }
  if (
    selector === '[data-tour-target=idp-chat-db-form]' ||
    selector === '[data-tour-target=idp-chat-db-answer]' ||
    selector === '[data-tour-target=idp-charts-form]' ||
    selector === '[data-tour-target=idp-charts-result]'
  ) {
    return below
  }
  return {
    top: rect.top + window.scrollY + rect.height + 12,
    left: rect.left + window.scrollX,
  }
}
