export function Home() {
  return (
    <div className="container" id="idp-home" data-tour-target="idp-home">
      <div className="hero deluxe" id="idp-home-hero" data-tour-target="idp-home-hero">
        <div>
          <h1>Contratos claros. Decisiones seguras.</h1>
          <p className="muted">
            Automatiza la extraccion de datos, chatea con el contrato, compara condiciones y obtén insights. Lleva tus equipos de legales y negocio a otro nivel.
          </p>
          <div className="pill-row" id="idp-cards">
            <span className="pill">OCR + IA</span>
            <span className="pill">Insights inmediatos</span>
            <span className="pill">Chat contextual</span>
            <span className="pill">Graficas ejecutivas</span>
          </div>
        </div>
      </div>

      <div className="cards-grid" data-tour-target="idp-home-cards">
        <div className="card icon-card">
          <div className="icon-badge">OCR</div>
          <h3>Extraccion multilenguaje</h3>
          <p>Sube PDF o imagenes. Normalizamos y devolvemos JSON listo para sistemas internos.</p>
        </div>
        <div className="card icon-card">
          <div className="icon-badge">CHAT</div>
          <h3>Chat inteligente</h3>
          <p>Preguntas al contrato o a la base de datos. Respuestas en contexto, sin SQL ni prompts complejos.</p>
        </div>
        <div className="card icon-card">
          <div className="icon-badge">DATA</div>
          <h3>Panel ejecutivo</h3>
          <p>Resumen de valores de pago, metricas clave y descargas en un clic.</p>
        </div>

      </div>

      <div className="section">
        <div className="section-header">
          <div>
            <p className="eyebrow">FAQ</p>
            <h2>Preguntas frecuentes</h2>
          </div>
        </div>
        <div className="faq-grid">
          <div className="faq-item">
            <h4>¿Que formato de archivos acepta?</h4>
            <p>PDF, PNG y JPG. Procesamos por medio de OCR y devolvemos JSON estructurado.</p>
          </div>
          <div className="faq-item">
            <h4>¿Necesito SQL para consultar la base?</h4>
            <p>No. Escribes en lenguaje natural y el asistente genera y ejecuta el SQL.</p>
          </div>
          <div className="faq-item">
            <h4>¿Puedo descargar los resultados?</h4>
            <p>Si, en JSON o CSV desde la misma pantalla de resultados.</p>
          </div>
          <div className="faq-item">
            <h4>¿Cómo solicito más tokens?</h4>
            <p>Desde la barra superior, "Solicitar tokens", o contactando a un ejecutivo.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home
