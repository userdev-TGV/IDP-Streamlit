# Herramienta de Análisis de Contratos

Una aplicación web moderna con frontend React y backend FastAPI para analizar contratos PDF utilizando OCR e IA. Esta herramienta ofrece tres funciones principales:
1. **Extracción de Datos**: Extrae información clave de documentos como contratos, facturas, etc.
2. **Chat con Documentos**: Haz preguntas sobre el contenido de tus documentos y obtén respuestas generadas por IA.
3. **Chat con Base de Datos**: Consulta bases de datos SQL usando lenguaje natural.

## Características

- **Arquitectura Moderna**:
  - Frontend React con TypeScript y Vite
  - Backend FastAPI con Python
  - Comunicación API REST
  - Interfaz responsive y moderna

- **Soporte Multilingüe**:
  - Procesamiento de documentos en múltiples idiomas (Inglés, Español, etc.)
  - Análisis inteligente de contenido

- **OCR Avanzado**:
  - Azure AI Document Intelligence para reconocimiento de texto de alta precisión
  - Extracción automática de texto, tablas y formularios
  - Soporte para múltiples formatos de documentos

- **Análisis con IA**:
  - Extrae información específica utilizando modelos de OpenAI/Azure OpenAI
  - Chat interactivo con documentos
  - Consultas en lenguaje natural a bases de datos SQL

- **Opciones de Descarga**:
  - Exportación de datos extraídos en JSON
  - Resultados estructurados y listos para usar

## Requisitos Previos

- Node.js 16+ y npm
- Python 3.8+
- Credenciales de [Azure AI Document Intelligence](https://azure.microsoft.com/en-us/products/ai-services/ai-document-intelligence) (obligatorio para OCR)
- Clave API de OpenAI o Azure OpenAI (para análisis con IA)

## Instalación

1. Clona este repositorio:
   ```bash
   git clone <url-del-repositorio>
   cd TGV-IDP
   ```

2. Instala las dependencias del workspace (incluye frontend):
   ```bash
   npm install
   ```

3. Instala las dependencias de Python:
   ```bash
   pip install -r requirements.txt
   ```

4. Configura las variables de entorno:
   - Crea un archivo `.env` en la raíz del proyecto
   - Agrega tus credenciales:
     ```
     # OpenAI/Azure OpenAI
     OPENAI_API_KEY=your_openai_api_key_here
     
     # Azure Document Intelligence
     AZURE_ENDPOINT=your_endpoint_link_here
     AZURE_KEY=your_api_key_here
     
     # Base de datos (opcional, para Chat con DB)
     DB_CONNECTION_STRING=your_database_connection_string
     ```

## Uso

1. Inicia la aplicación en modo desarrollo (ambos servidores simultáneamente):
   ```bash
   npm run dev
   ```

   O inicia cada servidor por separado:
   
   Frontend (React + Vite):
   ```bash
   npm run dev:frontend
   ```
   
   Backend (FastAPI):
   ```bash
   npm run dev:backend
   ```

2. Abre tu navegador en:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8000
   - Documentación API: http://localhost:8000/docs

3. Navega por las diferentes secciones:
   - **Extracción**: Carga documentos PDF y extrae información estructurada
   - **Chat con Documentos**: Haz preguntas sobre el contenido de tus documentos
   - **Chat con BD**: Consulta bases de datos usando lenguaje natural
   - **Gráficos**: Visualiza datos y análisis

## Estructura del Proyecto

```
TGV-IDP/
├── frontend/           # Aplicación React + TypeScript
│   ├── src/
│   │   ├── components/
│   │   ├── features/
│   │   ├── api/
│   │   └── context/
│   └── package.json
├── backend/           # API FastAPI
│   ├── api.py        # Endpoints REST
│   ├── services.py   # Lógica de negocio
│   └── prompts.py    # Prompts de IA
├── package.json      # Workspace configuration
└── requirements.txt  # Dependencias Python
```

## Solución de Problemas

- **Problemas de OCR**: Verifica la calidad del PDF y tus credenciales de Azure
- **Errores de API**: Verifica las claves API en el archivo .env y asegúrate de tener suficientes créditos
- **Variables de Entorno**: Asegúrate de que el archivo .env esté en el directorio raíz
- **Errores de CORS**: El backend está configurado para permitir todas las origins en desarrollo
- **Puerto ocupado**: Si los puertos 5173 u 8000 están ocupados, modifica los comandos de inicio

## Licencia

Este proyecto está licenciado bajo la Licencia MIT - consulta el archivo LICENSE para más detalles.

## Tecnologías

- **Frontend**: React 18, TypeScript, Vite, TanStack Query, React Router
- **Backend**: FastAPI, Python 3.8+
- **IA/ML**: OpenAI API, Azure OpenAI, Azure AI Document Intelligence
- **UI**: CSS3, Driver.js (tours interactivos) 