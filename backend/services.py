import base64
import io
import json
import os
import re
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
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


def process_with_openai(text: List[Dict[str, Any]], system_prompt: str) -> Dict[str, Any]:
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
    return json.loads(response.choices[0].message.content)


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
    openai_response = process_with_openai(all_extracted_text, system_prompt)
    openai_duration = time.time() - openai_start_time

    metrics = {
        "textract_duration": textract_duration,
        "openai_duration": openai_duration,
        "total_text_lines": len(all_extracted_text),
        "page_count": len(image_paths) if image_paths else 1,
        "saved_images": image_paths,
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


class ChartUtil:
    def __init__(self):
        self.client = openai_client
        self.chart_out_path = os.path.join("assets", "chart.png")

    def generate_chart(self, message: str) -> Tuple[Optional[str], str]:
        ci_prompt = (
            """You are a Python data analyst. Based on the following user data or description,
    generate clean and valid Python code using matplotlib to produce a chart.
    Do not include any markdown formatting (no ```), explanations, or comments.
    Only return executable Python code. The code must define a variable called 'fig' containing the plot.\n\n
    """
            + message
        )

        try:
            if OPENAI_API_KEY:
                thread = self.client.beta.threads.create(
                    messages=[{"role": "user", "content": ci_prompt}]
                )

                run = self.client.beta.threads.runs.create(
                    assistant_id=OPENAI_ASSISTANT_ID, thread_id=thread.id
                )

                while True:
                    run = self.client.beta.threads.runs.retrieve(
                        run_id=run.id, thread_id=thread.id
                    )

                    if run.status == "completed":
                        messages = self.client.beta.threads.messages.list(
                            thread_id=thread.id
                        )
                        if messages.data:
                            raw_response = messages.data[0].content[0].text.value
                        else:
                            return None, "No response from OpenAI"

                        code_pattern = re.compile(r"```python\n(.*?)```", re.DOTALL)
                        match = code_pattern.search(raw_response)
                        if match:
                            code = match.group(1)
                        else:
                            code = raw_response

                        local_vars: Dict[str, Any] = {}
                        exec(code, {"plt": __import__("matplotlib.pyplot", fromlist=["plt"])}, local_vars)

                        fig = local_vars.get("fig")
                        if fig:
                            fig.savefig(self.chart_out_path)
                            return self.chart_out_path, "Chart generated successfully."
                        return None, "No 'fig' object found in the generated code."

                    if run.status == "failed":
                        return None, "Chart generation failed."

                    time.sleep(1)
            else:
                response = self.client.chat.completions.create(
                    model="gpt-4",
                    messages=[
                        {
                            "role": "system",
                            "content": "You are a helpful data analyst who only response with matplotlib code",
                        },
                        {"role": "user", "content": ci_prompt},
                    ],
                )

                code = response.choices[0].message.content
                local_vars: Dict[str, Any] = {}
                exec(code, {"plt": __import__("matplotlib.pyplot", fromlist=["plt"])}, local_vars)

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
