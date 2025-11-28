from typing import Any, Dict, List, Optional

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from . import services

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
async def status() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/api/process")
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
async def chat_database(
    question: str = Form(...),
    file: Optional[UploadFile] = File(default=None),
) -> Dict[str, str]:
    if not file:
        raise HTTPException(status_code=400, detail="A CSV or Excel file is required")

    dataframe = services.dataframe_from_file(file)

    try:
        answer = services.chat_with_database(dataframe, question)
    except Exception as exc:  # pragma: no cover - external service
        raise HTTPException(status_code=500, detail=str(exc))

    return {"answer": answer, "preview": dataframe.head(5).to_dict(orient="records")}


@app.post("/api/charts")
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
async def upload_db_records(payload: Dict[str, List[Dict[str, Any]]]) -> Dict[str, Any]:
    records = payload.get("records")
    if not records:
        raise HTTPException(status_code=400, detail="records are required")

    return services.upload_records_to_db(records)


@app.post("/api/download/json")
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
