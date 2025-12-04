import base64
import io
import json
from math import ceil
import os
import re
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
import pyodbc
import requests
from azure.ai.formrecognizer import DocumentAnalysisClient
from azure.core.credentials import AzureKeyCredential
from dotenv import load_dotenv
from fastapi import HTTPException, UploadFile
from openai import AzureOpenAI, OpenAI

from .prompts import SYSTEM_PROMPTS, SYSTEM_PROMPT_DEFAULT

load_dotenv()

AZURE_ENDPOINT = os.getenv("AZURE_ENDPOINT")
AZURE_KEY = os.getenv("AZURE_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_ASSISTANT_ID = os.getenv("OPENAI_ASSISTANT_ID")
AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
UPLOAD_URL = os.getenv("UPLOAD_URL")
AZURE_SQL_SCHEMA = os.getenv("AZURE_SQL_SCHEMA", "dbo")
AUTH_CONN_STR = os.getenv("AZURE_SQL_AUTH_CONNECTION_STRING") or os.getenv("AZURE_SQL_CONNECTION_STRING")
DEFAULT_DB_RETRIES = int(os.getenv("AZURE_SQL_RETRY_ATTEMPTS", "3"))
DEFAULT_DB_WAIT = float(os.getenv("AZURE_SQL_RETRY_BACKOFF", "1.0"))
SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASS = os.getenv("SMTP_PASS")
SMTP_FROM = os.getenv("SMTP_FROM") or os.getenv("SMTP_USER")
TOKEN_REQUEST_TO = os.getenv("TOKEN_REQUEST_TO", "fgentiletti@tgv.com.ar")
GRAPH_CLIENT_ID = os.getenv("AZURE_AD_CLIENT_ID")
GRAPH_CLIENT_SECRET = os.getenv("AZURE_AD_CLIENT_SECRET")
GRAPH_TENANT_ID = os.getenv("AZURE_AD_TENANT_ID")
MAIL_SENDER = os.getenv("MAIL_SENDER") or SMTP_FROM

IMAGES_DIR = "processed_images"
os.makedirs(IMAGES_DIR, exist_ok=True)

document_client = DocumentAnalysisClient(
    endpoint=AZURE_ENDPOINT,
    credential=AzureKeyCredential(AZURE_KEY),
)

if OPENAI_API_KEY:
    openai_client = OpenAI(api_key=OPENAI_API_KEY)
else:
    openai_client = AzureOpenAI(
        api_key=AZURE_OPENAI_API_KEY,
        api_version="2025-01-01-preview",
        azure_endpoint=AZURE_OPENAI_ENDPOINT,
    )

# Default model for chart generation (works for both OpenAI and AzureOpenAI if deployed)
CHART_MODEL = "gpt-4o-mini"


def _warmup_sql_connection(conn_str: str, context: str, retries: int = DEFAULT_DB_RETRIES, backoff: float = DEFAULT_DB_WAIT) -> None:
    """
    Intenta abrir la conexión y ejecutar un SELECT 1 hasta que el SQL Server se active.
    Esto reduce los timeouts cuando la base está pausada.
    """
    last_exc: Optional[Exception] = None
    for attempt in range(1, retries + 1):
        try:
            with pyodbc.connect(conn_str, timeout=5) as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT 1")
                cursor.fetchone()
                cursor.close()
            return
        except Exception as exc:  # pragma: no cover - external
            last_exc = exc
            time.sleep(backoff * attempt)
    raise HTTPException(
        status_code=503,
        detail=f"Base de datos {context} iniciando, intenta de nuevo en unos segundos. Error: {last_exc}",
    )


def send_token_request_email(full_name: str, email: str) -> None:
    """
    Envía un correo solicitando más tokens usando Microsoft Graph si está configurado, o SMTP como fallback.
    """
    subject = "Solicitud de tokens - IDP"
    body = f"Se recibió una solicitud de tokens.\n\nNombre: {full_name}\nCorreo: {email}\n"

    # Preferir Graph (client credentials)
    if GRAPH_CLIENT_ID and GRAPH_CLIENT_SECRET and GRAPH_TENANT_ID and MAIL_SENDER:
        token_url = f"https://login.microsoftonline.com/{GRAPH_TENANT_ID}/oauth2/v2.0/token"
        data = {
            "client_id": GRAPH_CLIENT_ID,
            "client_secret": GRAPH_CLIENT_SECRET,
            "grant_type": "client_credentials",
            "scope": "https://graph.microsoft.com/.default",
        }
        try:
            resp = requests.post(token_url, data=data, timeout=10)
            resp.raise_for_status()
            access_token = resp.json().get("access_token")
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"No se pudo obtener token de Graph: {exc}")

        url = f"https://graph.microsoft.com/v1.0/users/{MAIL_SENDER}/sendMail"
        payload = {
            "message": {
                "subject": subject,
                "body": {"contentType": "Text", "content": body},
                "toRecipients": [{"emailAddress": {"address": TOKEN_REQUEST_TO}}],
            },
            "saveToSentItems": "false",
        }
        headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
        try:
            r = requests.post(url, headers=headers, json=payload, timeout=10)
            if r.status_code >= 400:
                raise HTTPException(
                    status_code=500,
                    detail=f"Graph sendMail fallo ({r.status_code}): {r.text}",
                )
            return
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"No se pudo enviar el correo de solicitud (Graph): {exc}")

    # SMTP fallback
    if not (SMTP_HOST and SMTP_USER and SMTP_PASS and SMTP_FROM):
        raise HTTPException(
            status_code=500,
            detail="Faltan credenciales para enviar correo (Graph o SMTP).",
        )

    import smtplib
    from email.message import EmailMessage

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = SMTP_FROM
    msg["To"] = TOKEN_REQUEST_TO
    msg.set_content(body)

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No se pudo enviar el correo de solicitud (SMTP): {exc}")


def send_specialist_request_email(full_name: str, email: str, company: str = "", project: str = "") -> None:
    """
    Envía un correo para agendar sesión con un especialista.
    """
    subject = "Solicitud de sesión con especialista - IDP"
    html_body = f"""
    <h2>Solicitud de sesión con especialista</h2>
    <p><strong>Nombre:</strong> {full_name}</p>
    <p><strong>Correo:</strong> {email}</p>
    <p><strong>Empresa:</strong> {company or 'No especificada'}</p>
    <p><strong>Proyecto / Detalles:</strong><br/>{project or 'No detallado'}</p>
    <p style="margin-top:16px;">IDP - TGV</p>
    """

    # Preferir Graph (client credentials)
    if GRAPH_CLIENT_ID and GRAPH_CLIENT_SECRET and GRAPH_TENANT_ID and MAIL_SENDER:
        token_url = f"https://login.microsoftonline.com/{GRAPH_TENANT_ID}/oauth2/v2.0/token"
        data = {
            "client_id": GRAPH_CLIENT_ID,
            "client_secret": GRAPH_CLIENT_SECRET,
            "grant_type": "client_credentials",
            "scope": "https://graph.microsoft.com/.default",
        }
        try:
            resp = requests.post(token_url, data=data, timeout=10)
            resp.raise_for_status()
            access_token = resp.json().get("access_token")
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"No se pudo obtener token de Graph: {exc}")

        url = f"https://graph.microsoft.com/v1.0/users/{MAIL_SENDER}/sendMail"
        payload = {
            "message": {
                "subject": subject,
                "body": {"contentType": "HTML", "content": html_body},
                "toRecipients": [{"emailAddress": {"address": TOKEN_REQUEST_TO}}],
            },
            "saveToSentItems": "false",
        }
        headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
        try:
            r = requests.post(url, headers=headers, json=payload, timeout=10)
            if r.status_code >= 400:
                raise HTTPException(
                    status_code=500,
                    detail=f"Graph sendMail fallo ({r.status_code}): {r.text}",
                )
            return
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"No se pudo enviar el correo (Graph): {exc}")

    # SMTP fallback
    if not (SMTP_HOST and SMTP_USER and SMTP_PASS and SMTP_FROM):
        raise HTTPException(
            status_code=500,
            detail="Faltan credenciales para enviar correo (Graph o SMTP).",
        )

    import smtplib
    from email.message import EmailMessage

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = SMTP_FROM
    msg["To"] = TOKEN_REQUEST_TO
    msg.add_header("Content-Type", "text/html")
    msg.set_content(html_body, subtype="html")

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No se pudo enviar el correo (SMTP): {exc}")


def preprocess_string(s: Any) -> str:
    if isinstance(s, (int, float)):
        return str(s)
    s = str(s)
    s = re.sub(r"[^a-zA-Z0-9\s]", "", s)
    s = " ".join(s.split())
    return s.lower()


def flexible_string_match(s1: Any, s2: Any) -> bool:
    return preprocess_string(s1) == preprocess_string(s2)


def compare_dates(date1: str, date2: str) -> bool:
    formats = ["%Y-%m-%d", "%d/%m/%Y", "%Y/%m/%d", "%d-%m-%Y"]
    for fmt in formats:
        try:
            d1 = datetime.strptime(date1, fmt)
            d2 = datetime.strptime(date2, fmt)
            return d1 == d2
        except ValueError:
            continue
    return False


def process_with_openai(text: List[Dict[str, Any]], system_prompt: str) -> Tuple[Dict[str, Any], Dict[str, Optional[int]]]:
    formatted_text = "\n".join(
        [
            f"[Page {item.get('page', 1)}] {item['text']} (Confidence: {item['confidence']:.2f})"
            for item in text
        ]
    )

    response = openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": (
                    "Process the following Portuguese contract text following "
                    "the system instructions and return the data in JSON format. "
                    f"Each line is followed by its confidence score:\n\n{formatted_text}"
                ),
            },
        ],
        response_format={"type": "json_object"},
    )
    usage = getattr(response, "usage", None)
    usage_dict: Dict[str, Optional[int]] = {
        "prompt_tokens": getattr(usage, "prompt_tokens", None) if usage else None,
        "completion_tokens": getattr(usage, "completion_tokens", None) if usage else None,
        "total_tokens": getattr(usage, "total_tokens", None) if usage else None,
    }
    return json.loads(response.choices[0].message.content), usage_dict


def _estimate_tokens_fallback(text_items: List[Dict[str, Any]], system_prompt: str, response_obj: Dict[str, Any]) -> int:
    """
    Estima tokens cuando la API no devuelve usage o parece subestimado.
    Aproxima 1 token ~= 4 chars sumando prompt + texto OCR + respuesta JSON.
    """
    input_chars = sum(len(item.get("text", "")) + 12 for item in text_items)
    prompt_chars = len(system_prompt)
    output_chars = len(json.dumps(response_obj, ensure_ascii=False))
    total_chars = input_chars + prompt_chars + output_chars
    return ceil(total_chars / 4)


async def process_document(
    file_bytes: bytes,
    file_type: str,
    file_name: str,
    custom_prompt: Optional[str] = None,
    language: str = "English",
) -> Tuple[Dict[str, Any], Dict[str, Any], List[Dict[str, Any]]]:
    textract_start_time = time.time()
    all_extracted_text: List[Dict[str, Any]] = []
    image_paths: List[str] = []

    if file_type == "application/pdf":
        poller = document_client.begin_analyze_document(
            model_id="prebuilt-read", document=file_bytes
        )
        result = poller.result()

        for page_num, page in enumerate(result.pages, start=1):
            for line in page.lines:
                all_extracted_text.append(
                    {"text": line.content, "confidence": 0.98, "page": page_num}
                )
    else:
        poller = document_client.begin_analyze_document(
            model_id="prebuilt-read", document=file_bytes
        )
        result = poller.result()

        for page in result.pages:
            for line in page.lines:
                all_extracted_text.append(
                    {"text": line.content, "confidence": 0.97, "page": 1}
                )

    textract_duration = time.time() - textract_start_time

    system_prompt = custom_prompt or SYSTEM_PROMPTS.get(language, SYSTEM_PROMPT_DEFAULT)
    openai_start_time = time.time()
    openai_response, usage = process_with_openai(all_extracted_text, system_prompt)
    openai_duration = time.time() - openai_start_time

    reported_tokens = usage.get("total_tokens") or 0
    estimated_tokens = _estimate_tokens_fallback(all_extracted_text, system_prompt, openai_response)
    effective_tokens = max(reported_tokens, estimated_tokens)
    tokens_to_consume = max(1, ceil(effective_tokens / 1000))

    metrics = {
        "textract_duration": textract_duration,
        "openai_duration": openai_duration,
        "total_text_lines": len(all_extracted_text),
        "page_count": len(result.pages) if hasattr(result, "pages") else (len(image_paths) if image_paths else 1),
        "saved_images": image_paths,
        "openai_usage": usage,
        "openai_tokens": reported_tokens,
        "openai_tokens_estimated": estimated_tokens,
        "openai_tokens_effective": effective_tokens,
        "tokens_to_consume": tokens_to_consume,
    }

    return openai_response, metrics, all_extracted_text


def chat_with_document(extracted_text: List[Dict[str, Any]], question: str) -> str:
    formatted_text = "\n".join(
        [f"[Page {item.get('page', 1)}] {item['text']}" for item in extracted_text]
    )

    response = openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are an assistant that answers questions about contract "
                    "documents. Use only the information provided in the document "
                    "text. If the answer is not in the document, say you don't know."
                ),
            },
            {
                "role": "user",
                "content": (
                    "Here is the content of a contract document:\n\n"
                    f"{formatted_text}\n\n"
                    f"Answer this question about the document: {question}"
                ),
            },
        ],
    )
    return response.choices[0].message.content


def chat_with_database(data: pd.DataFrame, question: str) -> str:
    data_str = data.to_string(index=False)
    response = openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are an assistant that answers questions about contract "
                    "databases. Use only the information provided in the Excel "
                    "data. If the answer is not in the data, say you don't know. "
                    "When appropriate, refer to specific rows or entries from the data."
                ),
            },
            {
                "role": "user",
                "content": (
                    "Here is the content of a contract database:\n\n"
                    f"{data_str}\n\n"
                    f"Answer this question about the database: {question}"
                ),
            },
        ],
    )
    return response.choices[0].message.content


def _fetch_columns(table_name: str = "Contracts", schema: str = AZURE_SQL_SCHEMA) -> List[str]:
    conn_str = os.getenv("AZURE_SQL_CONNECTION_STRING")
    if not conn_str:
        raise HTTPException(status_code=500, detail="Missing AZURE_SQL_CONNECTION_STRING")
    try:
        _warmup_sql_connection(conn_str, context="contratos")
        with pyodbc.connect(conn_str) as conn:
            df_cols = pd.read_sql(
                """
                SELECT COLUMN_NAME
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_NAME = ? AND TABLE_SCHEMA = ?
                ORDER BY ORDINAL_POSITION
                """,
                conn,
                params=[table_name, schema],
            )
        cols = df_cols["COLUMN_NAME"].tolist()
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - external service
        raise HTTPException(status_code=500, detail=f"Error obteniendo columnas: {exc}")

    if not cols:
        raise HTTPException(
            status_code=500, detail=f"No se encontraron columnas para la tabla {schema}.{table_name}"
        )
    return cols


def _sanitize_sql(sql: str) -> str:
    cleaned = re.sub(r"^```[a-zA-Z]*\s*|\s*```$", "", sql.strip(), flags=re.MULTILINE).strip()
    cleaned = cleaned.rstrip(";").strip()
    return cleaned


def _df_to_records(df: pd.DataFrame) -> List[Dict[str, Any]]:
    # Ensure Timestamps and other non-serializable types convert to ISO strings
    return json.loads(df.to_json(orient="records", date_format="iso"))


def generate_sql_from_question(question: str, table_name: str = "Contracts") -> str:
    cols = _fetch_columns(table_name)
    instruction = (
        "You are a SQL assistant for Azure SQL. "
        f"Generate one SELECT statement on table {table_name} using these columns only: {', '.join(cols)}. "
        "Return ONLY the SQL. Never modify data. No updates/inserts/deletes. Prefer aggregated answers when possible."
    )
    response = openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": instruction},
            {"role": "user", "content": question},
        ],
        max_tokens=300,
        temperature=0.1,
    )
    raw_sql = response.choices[0].message.content or ""
    sql = _sanitize_sql(raw_sql)

    if not sql.lower().startswith("select"):
        raise HTTPException(status_code=400, detail="Solo se permiten consultas SELECT.")

    return sql


def run_sql_query(sql: str) -> pd.DataFrame:
    conn_str = os.getenv("AZURE_SQL_CONNECTION_STRING")
    if not conn_str:
        raise HTTPException(status_code=500, detail="Missing AZURE_SQL_CONNECTION_STRING")
    if not sql.lower().startswith("select"):
        raise HTTPException(status_code=400, detail="Solo se permiten consultas SELECT.")

    # Si el asistente genera agregaciones sobre PaymentValue (almacenado como NVARCHAR),
    # convertimos a decimal para evitar errores de tipo.
    def _coerce_payment_value(stmt: str) -> str:
        stmt = re.sub(r"SUM\\s*\\(\\s*PaymentValue\\s*\\)", "SUM(TRY_CONVERT(decimal(18,4), PaymentValue))", stmt, flags=re.IGNORECASE)
        stmt = re.sub(r"AVG\\s*\\(\\s*PaymentValue\\s*\\)", "AVG(TRY_CONVERT(decimal(18,4), PaymentValue))", stmt, flags=re.IGNORECASE)
        return stmt

    sql = _coerce_payment_value(sql)

    try:
        _warmup_sql_connection(conn_str, context="contratos")
        with pyodbc.connect(conn_str) as conn:
            df = pd.read_sql(sql, conn)
        return df
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error ejecutando SQL: {exc}")


def answer_from_dataframe(df: pd.DataFrame, question: str) -> str:
    # Limit what we send to the model to a reasonable sample to keep responses fast.
    sample = _df_to_records(df.head(200))
    response = openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "Eres un analista de datos. Responde la pregunta del usuario usando únicamente los registros provistos. "
                    "Si falta información, dilo. Devuelve una respuesta breve y clara en español."
                ),
            },
            {
                "role": "user",
                "content": f"Pregunta: {question}\nDatos:\n{json.dumps(sample, ensure_ascii=False)}",
            },
        ],
        temperature=0.2,
    )
    return response.choices[0].message.content


def chat_with_database_sql(question: str, table_name: str = "Contracts") -> Dict[str, Any]:
    sql = generate_sql_from_question(question, table_name)
    df = run_sql_query(sql)
    answer = answer_from_dataframe(df, question)
    return {"answer": answer}


# ---------- Auth & token consumption (Azure SQL auth DB) ----------

def _connect_auth_db():
    if not AUTH_CONN_STR:
        raise HTTPException(status_code=500, detail="Missing AZURE_SQL_AUTH_CONNECTION_STRING")
    try:
        _warmup_sql_connection(AUTH_CONN_STR, context="autenticacion")
        return pyodbc.connect(AUTH_CONN_STR)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error conectando a la base de autenticacion: {exc}")

def validate_login(access_id: str, poc_id: int = 1) -> Dict[str, Any]:
    conn = _connect_auth_db()
    cursor = conn.cursor()
    try:
        print(f"Validando acceso para access_id={access_id}, poc_id={poc_id}")
        cursor.execute("{CALL ValidarAccesoPoc (?, ?)}", (access_id, poc_id))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=401, detail="Usuario no encontrado o inactivo")
        acceso_activo = row[1]
        tokens_restantes = row[2]
        if not acceso_activo:
            raise HTTPException(status_code=401, detail="Acceso inactivo para este usuario/PoC")
        return {
            "access_id": access_id,
            "poc_id": poc_id,
            "tokens_remaining": tokens_restantes,
        }
    except HTTPException as exc:
        # Propagate explicit HTTP errors (e.g., usuario no encontrado)
        raise exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error validando acceso: {exc}")
    finally:
        try:
            cursor.close()
        except Exception:
            pass
        try:
            conn.close()
        except Exception:
            pass


def consume_tokens(access_id: str, poc_id: int = 1, tokens: int = 1) -> Dict[str, Any]:
    if tokens <= 0:
        raise HTTPException(status_code=400, detail="tokens debe ser mayor que 0")
    conn = _connect_auth_db()
    cursor = conn.cursor()
    try:
        cursor.execute("{CALL RegistrarConsumoPoc (?, ?, ?)}", (access_id, poc_id, tokens))
        conn.commit()
    except HTTPException as exc:
        conn.rollback()
        raise exc
    except Exception as exc:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Error registrando consumo: {exc}")
    finally:
        try:
            cursor.close()
        except Exception:
            pass
        try:
            conn.close()
        except Exception:
            pass
    # Return updated state once the transaction is fully closed
    return validate_login(access_id, poc_id)


class ChartUtil:
    def __init__(self):
        self.client = openai_client
        self.chart_out_path = os.path.join("assets", "chart.png")
        os.makedirs(os.path.dirname(self.chart_out_path), exist_ok=True)

    def generate_chart(self, message: str) -> Tuple[Optional[str], str]:
        # Build a strict prompt so the model only returns executable matplotlib code.
        palette = "#D7263D, #3F88C5, #F49D37, #2EBD59, #9552EA, #FF6B6B, #4ECDC4"
        ci_prompt = f"""
You are a Python data analyst creating executive-style charts (dashboard look) in matplotlib.
Steps you MUST follow:
1) Parse the user's text into structured data (categories/contracts and numeric values). Convert percentages like '4.5%' to float numbers. If multiple values belong to the same category, keep them together.
2) Clean the data: drop empty rows, ensure each category has numeric values, and align array lengths before plotting.
3) Choose the best chart type for readability (bar chart grouped by category, stacked bars if multiple values per category, or box/violin for distributions). Avoid pies.
4) Use distinct, high-contrast colors (palette: {palette}); add labels, title, legend (if multiple series), grid, and value annotations where helpful.
5) Never call plt.show(); only build the figure.
6) Return ONLY executable Python code (no markdown fences/comments) that defines a variable named 'fig'.

User request and data:
{message}
"""

        try:
            response = self.client.chat.completions.create(
                model=CHART_MODEL,
                messages=[
                    {"role": "system", "content": "You are a Python data analyst who only returns matplotlib code."},
                    {"role": "user", "content": ci_prompt},
                ],
            )

            raw_response = response.choices[0].message.content or ""

            code_pattern = re.compile(r"```python\n(.*?)```", re.DOTALL)
            match = code_pattern.search(raw_response)
            code = match.group(1) if match else raw_response

            plt = __import__("matplotlib.pyplot", fromlist=["plt"])
            try:
                plt.switch_backend("Agg")
            except Exception:
                pass
            plt.show = lambda *args, **kwargs: None  # avoid blocking calls

            local_vars: Dict[str, Any] = {}
            exec(code, {"plt": plt}, local_vars)

            fig = local_vars.get("fig")
            if fig:
                fig.savefig(self.chart_out_path)
                return self.chart_out_path, "Chart generated successfully."
            return None, "No 'fig' object found in the generated code."
        except Exception as exc:  # pragma: no cover - external service
            return None, f"An unexpected error occurred during chart generation process: {exc}"

        return None, "Could you please rephrase your query and try again?"


def dataframe_from_file(upload: UploadFile) -> pd.DataFrame:
    contents = upload.file.read()
    upload.file.seek(0)
    if upload.content_type and "csv" in upload.content_type:
        return pd.read_csv(io.BytesIO(contents))
    if upload.content_type and (
        "excel" in upload.content_type or "spreadsheet" in upload.content_type
    ):
        return pd.read_excel(io.BytesIO(contents))
    try:
        return pd.read_csv(io.BytesIO(contents))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {exc}")


def upload_records_to_db(records: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not UPLOAD_URL:
        raise HTTPException(status_code=500, detail="UPLOAD_URL is not configured")

    headers = {"Content-Type": "application/json"}
    response = requests.post(UPLOAD_URL, json=records, headers=headers)
    if response.status_code in [200, 202, 203]:
        return {"status": "success", "message": "Uploaded records to the database successfully!"}
    raise HTTPException(
        status_code=response.status_code,
        detail=f"Failed to upload data to the database. Status code: {response.status_code}",
    )


def build_csv_bytes(all_results: List[Dict[str, Any]]) -> bytes:
    if not all_results:
        return b""

    output = io.StringIO()
    fieldnames = sorted({key for item in all_results for key in item.keys()})
    writer = pd.DataFrame(all_results, columns=fieldnames)
    writer.to_csv(output, index=False)
    return output.getvalue().encode("utf-8")


def encode_file_to_base64(path: str) -> str:
    with open(path, "rb") as file:
        return base64.b64encode(file.read()).decode("utf-8")


def warmup_databases() -> Dict[str, Any]:
    """Despierta las bases de datos en segundo plano para acelerar el primer acceso."""
    result = {"auth_db": "not_configured", "contracts_db": "not_configured"}
    
    # Despertar BD de autenticación
    if AUTH_CONN_STR:
        try:
            _warmup_sql_connection(AUTH_CONN_STR, context="autenticacion", retries=2, backoff=0.5)
            result["auth_db"] = "ready"
        except Exception:
            result["auth_db"] = "warming_up"
    
    # Despertar BD de contratos
    conn_str = os.getenv("AZURE_SQL_CONNECTION_STRING")
    if conn_str:
        try:
            _warmup_sql_connection(conn_str, context="contratos", retries=2, backoff=0.5)
            result["contracts_db"] = "ready"
        except Exception:
            result["contracts_db"] = "warming_up"
    
    return result
