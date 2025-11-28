export function Home() {
  return (
    <div className="container">
      <div className="card">
        <h1>Extracción y Análisis de Contratos Multilingüe</h1>
        <p>
          Esta interfaz React replica la experiencia de la aplicación Streamlit: carga PDF o imágenes, ejecuta OCR con Azure Form
          Recognizer, extrae información con OpenAI, descarga resultados y permite chatear con el documento o con tu base de datos.
        </p>
        <ul>
          <li>Sube contratos y elige el idioma de extracción.</li>
          <li>Visualiza métricas y descarga resultados en JSON o CSV.</li>
          <li>Haz preguntas sobre el documento ya procesado.</li>
          <li>Conecta un archivo tabular para chatear con tu base de datos.</li>
          <li>Genera gráficas automáticas con OpenAI.</li>
        </ul>
      </div>
    </div>
  )
}

export default Home
