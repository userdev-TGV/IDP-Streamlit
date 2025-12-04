from typing import Any, Dict, List, Optional

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from . import services
from pydantic import BaseModel

app = FastAPI(title="IDP Streamlit Migration API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def _read_uploaded_file(upload_file: UploadFile) -> bytes:
    contents = await upload_file.read()
    upload_file.file.seek(0)
    return contents


@app.get("/api/status")
@app.get("/status", include_in_schema=False)
async def status() -> Dict[str, str]:
    return {"status": "ok"}


@app.get("/api/warmup")
@app.get("/warmup", include_in_schema=False)
async def warmup() -> Dict[str, Any]:
    """Endpoint para despertar las bases de datos proactivamente."""
    return services.warmup_databases()


@app.post("/api/process")
@app.post("/process", include_in_schema=False)
async def process_document(
    file: UploadFile = File(...),
    custom_prompt: Optional[str] = Form(default=None),
    language: str = Form(default="English"),
) -> Dict[str, Any]:
    file_bytes = await _read_uploaded_file(file)

    try:
        openai_response, metrics, extracted_text = await services.process_document(
            file_bytes=file_bytes,
            file_type=file.content_type,
            file_name=file.filename,
            custom_prompt=custom_prompt,
            language=language,
        )
    except Exception as exc:  # pragma: no cover - external service
        raise HTTPException(status_code=500, detail=str(exc))

    return {
        "openai_response": openai_response,
        "metrics": metrics,
        "extracted_text": extracted_text,
        "file_name": file.filename,
        "language": language,
    }


@app.post("/api/chat/document")
@app.post("/chat/document", include_in_schema=False)
async def chat_document(payload: Dict[str, Any]) -> Dict[str, str]:
    extracted_text = payload.get("extracted_text")
    question = payload.get("question")
    if not extracted_text or not question:
        raise HTTPException(status_code=400, detail="extracted_text and question are required")

    try:
        answer = services.chat_with_document(extracted_text, question)
    except Exception as exc:  # pragma: no cover - external service
        raise HTTPException(status_code=500, detail=str(exc))

    return {"answer": answer}


@app.post("/api/chat/database")
@app.post("/chat/database", include_in_schema=False)
async def chat_database(payload: Dict[str, Any]) -> Dict[str, Any]:
    question = payload.get("question")
    if not question:
        raise HTTPException(status_code=400, detail="question is required")

    try:
        result = services.chat_with_database_sql(question)
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - external service
        raise HTTPException(status_code=500, detail=str(exc))

    return result


@app.post("/api/auth/login")
@app.post("/auth/login", include_in_schema=False)
async def auth_login(payload: Dict[str, Any]) -> Dict[str, Any]:
    access_id = payload.get("access_id")
    poc_id = payload.get("poc_id", 1)
    if not access_id:
        raise HTTPException(status_code=400, detail="access_id is required")
    return services.validate_login(access_id, poc_id)


@app.post("/api/auth/consume")
@app.post("/auth/consume", include_in_schema=False)
async def auth_consume(payload: Dict[str, Any]) -> Dict[str, Any]:
    access_id = payload.get("access_id")
    poc_id = payload.get("poc_id", 1)
    tokens = payload.get("tokens", 1)
    if not access_id:
        raise HTTPException(status_code=400, detail="access_id is required")
    return services.consume_tokens(access_id, poc_id, tokens)


class TokenRequest(BaseModel):
    name: str
    email: str

class SpecialistRequest(BaseModel):
    name: str
    email: str
    company: str | None = None
    project: str | None = None


@app.post("/api/tokens/request")
@app.post("/tokens/request", include_in_schema=False)
async def request_tokens(payload: TokenRequest) -> Dict[str, str]:
    if not payload.name or not payload.email:
        raise HTTPException(status_code=400, detail="name y email son obligatorios")
    services.send_token_request_email(payload.name, payload.email)
    return {"status": "ok", "message": "Solicitud enviada"}

@app.post("/api/contact/specialist")
@app.post("/contact/specialist", include_in_schema=False)
async def request_specialist(payload: SpecialistRequest) -> Dict[str, str]:
    if not payload.name or not payload.email:
        raise HTTPException(status_code=400, detail="name y email son obligatorios")
    services.send_specialist_request_email(payload.name, payload.email, payload.company or "", payload.project or "")
    return {"status": "ok", "message": "Solicitud enviada"}


@app.post("/api/charts")
@app.post("/charts", include_in_schema=False)
async def generate_chart(payload: Dict[str, str]) -> Dict[str, Any]:
    prompt = payload.get("prompt", "")
    if not prompt:
        raise HTTPException(status_code=400, detail="prompt is required")

    chart_util = services.ChartUtil()
    path, description = chart_util.generate_chart(prompt)
    if not path:
        raise HTTPException(status_code=500, detail=description)

    encoded = services.encode_file_to_base64(path)
    return {"image": encoded, "description": description}


@app.post("/api/upload/db")
@app.post("/upload/db", include_in_schema=False)
async def upload_db_records(payload: Dict[str, List[Dict[str, Any]]]) -> Dict[str, Any]:
    records = payload.get("records")
    if not records:
        raise HTTPException(status_code=400, detail="records are required")

    return services.upload_records_to_db(records)


@app.post("/api/download/json")
@app.post("/download/json", include_in_schema=False)
async def download_json(payload: Dict[str, Any]) -> StreamingResponse:
    data = payload.get("data")
    if data is None:
        raise HTTPException(status_code=400, detail="data is required")

    json_bytes = JSONResponse(content=data).body
    return StreamingResponse(
        iter([json_bytes]),
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=results.json"},
    )


@app.post("/api/download/csv")
@app.post("/download/csv", include_in_schema=False)
async def download_csv(payload: Dict[str, Any]) -> StreamingResponse:
    results = payload.get("results")
    if results is None:
        raise HTTPException(status_code=400, detail="results are required")

    csv_bytes = services.build_csv_bytes(results)
    return StreamingResponse(
        iter([csv_bytes]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=results.csv"},
    )
