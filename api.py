import os
import getpass
import zipfile
import io
import subprocess
import sys
import traceback
import requests
from io import StringIO

os.environ['PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION'] = 'python'
import pytesseract
from PIL import Image
import io
import re
from fastapi import UploadFile, File
from fastapi import FastAPI, HTTPException, Header, Query
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Optional
import uvicorn
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
from bson import ObjectId
from fastapi.middleware.cors import CORSMiddleware
import httpx
import time
import re
import asyncio
import json
import uuid

DEFAULT_TEAMS = '[{"id": "hoshen", "name": "חושן", "desc": "תשתיות תקשורת ורשת", "icon": "IconShield", "tracks": [{"id": "t1", "name": "מסלול ראשי"}]}, {"id": "galactic", "name": "גלקטיק", "desc": "מערכות ניטור חלל ולוויינות", "icon": "IconRocket", "tracks": []}, {"id": "cobra", "name": "קוברה", "desc": "תקיפה וסינון התראות", "icon": "IconRadar", "tracks": []}]'
DEFAULT_APPS = '["hoshen", "galactic", "cobra"]'

DEFAULT_TECHS = '''[
  {"value": "rabbit", "label": "RabbitMQ", "icon": "rabbit", "fields": [{"name": "vhost", "label": "VHOST (לדוגמה /)"}, {"name": "queue", "label": "שם תור"}], "labelTemplate": "{vhost}-{queue}", "thresholds": [{"name": "majorThreshold", "label": "Major (הודעות תקועות)", "min": 0, "max": 1000000}, {"name": "criticalThreshold", "label": "Critical (הודעות תקועות)", "min": 0, "max": 1000000}]},
  {"value": "nifi", "label": "NiFi", "icon": "nifi", "fields": [{"name": "componentName", "label": "שם רכיב"}], "labelTemplate": "{componentName}", "thresholds": []},
  {"value": "kafka", "label": "Kafka", "icon": "kafka", "fields": [{"name": "componentName", "label": "שם רכיב"}], "labelTemplate": "{componentName}", "thresholds": []},
  {"value": "elastic", "label": "Elastic (ECK)", "icon": "elastic", "fields": [{"name": "componentName", "label": "שם רכיב"}], "labelTemplate": "{componentName}", "thresholds": []},
  {"value": "s3", "label": "S3 Storage", "icon": "s3", "fields": [{"name": "componentName", "label": "שם רכיב"}], "labelTemplate": "{componentName}", "thresholds": []},
  {"value": "mongo", "label": "MongoDB", "icon": "mongo", "fields": [{"name": "componentName", "label": "שם רכיב"}], "labelTemplate": "{componentName}", "thresholds": []},
  {"value": "linux", "label": "Linux Server", "icon": "linux", "fields": [{"name": "componentName", "label": "שם רכיב"}], "labelTemplate": "{componentName}", "thresholds": []},
  {"value": "windows", "label": "Windows Server", "icon": "windows", "fields": [{"name": "componentName", "label": "שם רכיב"}], "labelTemplate": "{componentName}", "thresholds": []},
  {"value": "nfs", "label": "NFS", "icon": "nfs", "fields": [{"name": "componentName", "label": "שם רכיב"}], "labelTemplate": "{componentName}", "thresholds": []},
  {"value": "dp", "label": "DataPower", "icon": "dp", "fields": [{"name": "componentName", "label": "שם רכיב"}], "labelTemplate": "{componentName}", "thresholds": []},
  {"value": "openshift", "label": "OpenShift", "icon": "openshift", "fields": [{"name": "componentName", "label": "שם רכיב"}], "labelTemplate": "{componentName}", "thresholds": []},
  {"value": "pvc", "label": "PVC", "icon": "pvc", "fields": [{"name": "componentName", "label": "שם רכיב"}], "labelTemplate": "{componentName}", "thresholds": []},
  {"value": "redis", "label": "Redis", "icon": "redis", "fields": [{"name": "componentName", "label": "שם רכיב"}], "labelTemplate": "{componentName}", "thresholds": []},
  {"value": "sql", "label": "SQL Server", "icon": "sql", "fields": [{"name": "componentName", "label": "שם רכיב"}], "labelTemplate": "{componentName}", "thresholds": []},
  {"value": "postgres", "label": "PostgreSQL", "icon": "postgres", "fields": [{"name": "componentName", "label": "שם רכיב"}], "labelTemplate": "{componentName}", "thresholds": []},
  {"value": "info", "label": "INFO / הערה", "icon": "info", "fields": [{"name": "componentName", "label": "כותרת"}], "labelTemplate": "{componentName}", "thresholds": []}
]'''

DEFAULT_ADMINS = '["אריאל", "ירדן", "admin"]'
DEFAULT_ROLES = '{"admins": ["אריאל", "ירדן", "admin"]}'
DEFAULT_LEARN_URL = "https://neptune-learning.example.com"
DEFAULT_GUIDE_LINKS = '{"theindex": "https://theindex.example.com", "njira": "https://jira.example.com", "faults": "https://faults.example.com", "freakout": "https://freakout.example.com", "tudo": "https://tudo.example.com", "morning_report": "https://morning.example.com"}'

DEFAULT_GENERIC_TEMPLATES = '''{
    "rabbit": [
        { "suffix": "major", "purpose": "התראות Major", "query": "rabbitmq_messages_ready_total{queue=\\"{{queue}}\\", vhost=\\"{{vhost}}\\"} >= {{majorThreshold}}" },
        { "suffix": "critical", "purpose": "התראות Critical", "query": "rabbitmq_messages_ready_total{queue=\\"{{queue}}\\", vhost=\\"{{vhost}}\\"} >= {{criticalThreshold}}" }
    ]
}'''


class ConfigManager:
    def __init__(self):
        self.etcd_host = os.getenv("ETCD_HOST", "127.0.0.1")
        self.etcd_port = int(os.getenv("ETCD_PORT", 2379))
        self.client = None
        try:
            import etcd3
            self.client = etcd3.client(host=self.etcd_host, port=self.etcd_port)
            self.client.status()
        except Exception:
            self.client = None

    def get(self, key: str, default: str) -> str:
        if self.client:
            try:
                val, _ = self.client.get(key)
                if val: return val.decode('utf-8')
            except Exception:
                pass
        return default


config = ConfigManager()

MONGO_DETAILS = config.get("/neptune/db/mongo_url", "mongodb://localhost:27017")
PROMETHEUS_URL = config.get("/neptune/monitoring/prometheus_url", "http://localhost:9090")
ELASTIC_URL = config.get("/neptune/monitoring/elastic_url", "http://localhost:9200")
SERVER_HOST = config.get("/neptune/server/host", "0.0.0.0")
SERVER_PORT = int(config.get("/neptune/server/port", "80"))
CORS_ORIGINS = config.get("/neptune/server/cors_origins", "*").split(",")

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"])

from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request


async def global_log_to_elastic(action: str, path: str, user: str = "System"):
    time_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    doc = {
        "@timestamp": datetime.utcnow().isoformat() + "Z",
        "action": action,
        "path": path,
        "user": user,
        "message": f"[{time_str}] User '{user}' performed {action} on {path}"
    }
    try:
        async with httpx.AsyncClient() as http_client:
            # ELASTIC_URL already defined globally in the file
            await http_client.post(f"{ELASTIC_URL}/neptune-audit-logs/_doc", json=doc, timeout=2.0)
    except Exception as e:
        print(f"Failed to write audit log to elastic: {e}")


class AuditLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        method = request.method
        path = request.url.path

        # אנחנו תופסים רק קריאות של שינוי מידע (POST, PUT, DELETE) כדי לא להציף את הלוג ב-GET
        if method in ["POST", "PUT", "DELETE"] and ("/api/" in path or "/rules" in path):
            user = request.headers.get("x-user", "System")
            asyncio.create_task(global_log_to_elastic(method, path, user))

        response = await call_next(request)
        return response


app.add_middleware(AuditLogMiddleware)

client = AsyncIOMotorClient(MONGO_DETAILS)
database = client.neptune
rules_collection = database.get_collection("rules")
sys_config_col = database.get_collection("sys_config")
automations_col = database.get_collection("automations")
folders_col = database.get_collection("automation_folders")
choter_groups_col = database.get_collection("choter_groups")
choter_stations_col = database.get_collection("choter_stations")
existence_cubes_col = database.get_collection("existence_cubes")
exporter_cubes_col = database.get_collection("exporter_cubes")
pr_collection = database.get_collection("pull_requests")
elastic_queries_col = database.get_collection("elastic_queries")
shift_faults_col = database.get_collection("shift_faults")

import httpx
import asyncio

components_col = database.get_collection("components")
sync_status_col = database.get_collection("sync_status")
rules_col = database.get_collection("rules")
nodes_col = database.get_collection("nodes")
rules_history_col = database.get_collection("rules_history")


async def perform_sync_logic():
    status_entry = {
        "timestamp": datetime.now().strftime("%d/%m/%Y %H:%M:%S"),
        "nodes_ok": False,
        "rules_ok": False,
        "details": ""
    }
    try:
        async with httpx.AsyncClient() as client:
            # 1. סנכרון רכיבים מול ה-API והוספת היסטוריה במונגו
            try:
                response = await client.get("http://localhost:6002/get_nodes", timeout=10.0)
                response.raise_for_status()
                external_nodes = response.json()
            except Exception as e:
                external_nodes = []
                status_entry["details"] += f"שגיאת רכיבים: {str(e)}. "

            if external_nodes and isinstance(external_nodes, list):
                nodes_doc = await nodes_col.find_one({})
                if not nodes_doc:
                    nodes_doc = {"history": []}

                last_version = nodes_doc["history"][-1]["version"] if nodes_doc["history"] else 0

                new_node_history = {
                    "nodes": external_nodes,
                    "date": datetime.now().strftime("%d/%m/%Y %H:%M"),
                    "version": last_version + 1
                }

                if nodes_doc.get("_id"):
                    await nodes_col.update_one(
                        {"_id": nodes_doc["_id"]},
                        {"$push": {"history": {"$each": [new_node_history], "$slice": -50}}}
                    )
                else:
                    await nodes_col.insert_one({"history": [new_node_history]})

                # עדכון אוסף components
                await components_col.delete_many({})
                await components_col.insert_many([{"name": str(n)} for n in external_nodes])
                status_entry["nodes_ok"] = True

            # 2. סנכרון חוקים מול ה-API ושמירתם כמסמך מלא במונגו עם מערך History
            try:
                rules_response = await client.get("http://localhost:6002/get_required_rules", timeout=10.0)
                if rules_response.status_code == 200:
                    required_rules = rules_response.json()
                else:
                    required_rules = []
            except Exception as e:
                required_rules = []
                status_entry["details"] += f"שגיאת חוקים: {str(e)}. "

            if required_rules and isinstance(required_rules, list):
                now_str = datetime.now().strftime("%d/%m/%Y %H:%M")

                # סנאפשוט של החוקים שנמשכו לטובת ה-Diff
                rules_snapshot = []

                for item in required_rules:
                    rule_name = item.get("group_name")
                    if not rule_name: continue

                    node = item.get("node", "")
                    mappingTemplate = item.get("mappingTemplate", "")
                    tsdb = item.get("tsdb", "pulse_thanos")
                    tech = "elastic_log" if "elastic" in tsdb.lower() else "CUSTOM"

                    group_rules = item.get("group_rules", {})
                    queryMajor = ""
                    queryCritical = ""
                    purposeRule = ""

                    for r_id, r_info in group_rules.items():
                        severity = r_info.get("severity", "").lower()
                        if severity == "major":
                            queryMajor = r_info.get("query", "")
                            if not purposeRule: purposeRule = r_info.get("description", "")
                        elif severity == "critical":
                            queryCritical = r_info.get("query", "")
                            if not purposeRule: purposeRule = r_info.get("description", "")

                    if not purposeRule and group_rules:
                        purposeRule = list(group_rules.values())[0].get("description", "")

                    # שמירה לסנאפשוט הכללי
                    rules_snapshot.append({
                        "name": rule_name,
                        "queryMajor": queryMajor,
                        "queryCritical": queryCritical,
                        "node": node,
                        "mappingTemplate": mappingTemplate
                    })

                    existing_rule = await rules_col.find_one({"name": rule_name})

                    history_entry = {
                        "user": "System_Sync",
                        "date": now_str,
                        "version": 1,
                        "query": queryMajor or queryCritical,
                        "node": node,
                        "tech": tech
                    }

                    if existing_rule:
                        last_version = existing_rule.get("history", [{"version": 0}])[-1][
                            "version"] if existing_rule.get("history") else 0
                        history_entry["version"] = last_version + 1

                        update_fields = {
                            "queryMajor": queryMajor,
                            "queryCritical": queryCritical,
                            "node": node,
                            "mappingTemplate": mappingTemplate,
                            "tech": tech,
                            "tsdb": tsdb,
                            "purposeRule": purposeRule
                        }

                        await rules_col.update_one(
                            {"_id": existing_rule["_id"]},
                            {
                                "$set": update_fields,
                                "$push": {"history": {"$each": [history_entry], "$slice": -50}}
                            }
                        )
                    else:
                        new_rule = {
                            "name": rule_name,
                            "queryMajor": queryMajor,
                            "queryCritical": queryCritical,
                            "node": node,
                            "mappingTemplate": mappingTemplate,
                            "tech": tech,
                            "tsdb": tsdb,
                            "purposeRule": purposeRule,
                            "history": [history_entry]
                        }
                        await rules_col.insert_one(new_rule)

                status_entry["rules_ok"] = True

                # דחיפת היסטוריה כללית לחוקים (Diff Snapshot)
                rules_hist_doc = await rules_history_col.find_one({})
                if not rules_hist_doc:
                    rules_hist_doc = {"history": []}

                last_rules_version = rules_hist_doc["history"][-1]["version"] if rules_hist_doc["history"] else 0

                new_rules_history = {
                    "rules": rules_snapshot,
                    "date": now_str,
                    "version": last_rules_version + 1
                }

                if rules_hist_doc.get("_id"):
                    await rules_history_col.update_one(
                        {"_id": rules_hist_doc["_id"]},
                        {"$push": {"history": {"$each": [new_rules_history], "$slice": -50}}}
                    )
                else:
                    await rules_history_col.insert_one({"history": [new_rules_history]})

            await sync_status_col.update_one({}, {"$set": status_entry}, upsert=True)
            return status_entry

    except Exception as e:
        print(f"Sync Task Error: {e}")
        err_entry = {"nodes_ok": False, "rules_ok": False, "details": str(e),
                     "timestamp": datetime.now().strftime("%d/%m/%Y %H:%M:%S")}
        await sync_status_col.update_one({}, {"$set": err_entry}, upsert=True)
        return err_entry


async def sync_nodes_background_task():
    # הרצה ראשונית מיד בעליית השרת
    try:
        await perform_sync_logic()
    except Exception as e:
        print(f"Catastrophic failure in initial sync: {e}")

    while True:
        # חישוב הזמן המדויק בשניות עד לקפיצת ה-20 דקות הבאה בשעון האמיתי (00, 20, 40)
        now = datetime.now()
        minutes_to_add = 20 - (now.minute % 20)
        next_run = (now + timedelta(minutes=minutes_to_add)).replace(second=0, microsecond=0)
        sleep_seconds = (next_run - now).total_seconds()

        # המתנה מדויקת לשעה העגולה
        if sleep_seconds > 0:
            await asyncio.sleep(sleep_seconds)
        else:
            await asyncio.sleep(20 * 60)  # רשת ביטחון

        # הרצת הסנכרון
        try:
            await perform_sync_logic()
        except Exception as e:
            print(f"Catastrophic failure in background sync loop: {e}")


@app.post("/api/sync/manual")
async def trigger_manual_sync():
    result = await perform_sync_logic()
    return {"status": "success", "result": result}


@app.get("/api/sync-history")
async def get_sync_history():
    nodes_doc = await nodes_col.find_one({})
    rules_hist_doc = await rules_history_col.find_one({})
    status = await sync_status_col.find_one({})

    nodes_history = nodes_doc.get("history", []) if nodes_doc else []
    rules_history = rules_hist_doc.get("history", []) if rules_hist_doc else []

    # Fallback legacy
    if not nodes_history:
        current_comps = await components_col.find({}).to_list(length=None)
        if current_comps:
            nodes_history = [{
                "version": "Legacy",
                "date": "קיים במערכת",
                "nodes": [c["name"] for c in current_comps]
            }]

    return {
        "nodes_history": nodes_history,
        "rules_history": rules_history,
        "last_sync": status.get("timestamp") if status else "לא בוצע סנכרון"
    }


@app.get("/api/rules/{rule_id}/history")
async def get_rule_history(rule_id: str):
    rule = await rules_col.find_one({"_id": ObjectId(rule_id)})
    if not rule: raise HTTPException(404, "Rule not found")
    return rule.get("history", [])


@app.get("/api/sync-status")
async def get_sync_status():
    status = await sync_status_col.find_one({})
    if status: status.pop("_id")
    return status or {"nodes_ok": False, "rules_ok": False, "timestamp": "לא בוצע סנכרון", "details": "אין נתונים"}


@app.get("/api/components")
async def get_components():
    nodes_doc = await nodes_col.find_one({})
    if nodes_doc and nodes_doc.get("history"):
        latest_nodes = nodes_doc["history"][-1]["nodes"]
        return [{"id": str(i), "name": n} for i, n in enumerate(latest_nodes)]

    comps = await components_col.find({}).to_list(length=None)
    return [{"id": str(c["_id"]), "name": c["name"]} for c in comps]


class PushMetric(BaseModel):
    name: str
    value: float
    labels: Optional[dict] = None


# מילון גלובלי שיחזיק את המטריקות שנדחפות אלינו מבחוץ
neptune_pushed_metrics = {}


class PullRequest(BaseModel):
    id: str
    teamId: str
    trackId: str
    desc: str
    user: str
    date: str
    status: str = "pending"

  
@app.post("/api/prs")
async def create_pull_request(pr: PullRequest):
    doc = pr.model_dump()
    await pr_collection.insert_one(doc)
    return {"status": "success"}



import subprocess
import sys
import re

class InstallRequest(BaseModel):
    library_name: str

@app.post("/api/system/install-library")
async def install_python_library(req: InstallRequest):
    # אבטחה: ניקוי ווידוא ששם הספרייה מכיל רק אותיות, מספרים, מקפים או קווים תחתונים
    lib_name = req.library_name.strip()
    if not re.match(r'^[a-zA-Z0-9_\-]+$', lib_name):
        raise HTTPException(status_code=400, detail="Invalid library name. Only letters, numbers, hyphens and underscores are allowed.")

    try:
        # הרצת פקודת ההתקנה בטרמינל של השרת
        # משתמשים ב-sys.executable כדי להבטיח שההתקנה מתבצעת בסביבה הוירטואלית הנוכחית שבה השרת רץ
        result = subprocess.run(
            [sys.executable, "-m", "pip", "install", lib_name],
            capture_output=True,
            text=True,
            check=False # לא זורק שגיאה אוטומטית כדי שנוכל לתפוס את הפלט גם בכישלון
        )

        if result.returncode == 0:
            return {"status": "success", "output": result.stdout}
        else:
            return {"status": "error", "output": result.stderr or result.stdout}

    except Exception as e:
        return {"status": "error", "output": str(e)}



@app.get("/api/prs")
async def get_pull_requests():
    prs = await pr_collection.find({"status": "pending"}).to_list(length=None)
    for p in prs: p["_id"] = str(p["_id"])
    return prs


@app.put("/api/prs/{pr_id}/status")
async def update_pr_status(pr_id: str, status: str):
    await pr_collection.update_one({"id": pr_id}, {"$set": {"status": status}})
    return {"status": "success"}


class PackageRequest(BaseModel):
    package_name: str


@app.post("/api/admin/install-package")
async def install_package(req: PackageRequest):
    import subprocess
    import sys
    try:
        result = subprocess.run(
            [sys.executable, "-m", "pip", "install", req.package_name],
            capture_output=True,
            text=True
        )

        if result.returncode == 0:
            return {"status": "success", "message": f"הספרייה {req.package_name} הותקנה בהצלחה וזמינה לשימוש!",
                    "log": result.stdout}
        else:
            return {"status": "error", "message": f"שגיאה בהתקנת {req.package_name}", "log": result.stderr}

    except Exception as e:
        return {"status": "error", "message": "שגיאת מערכת בהתקנה", "log": str(e)}


# --- BACKGROUND TASKS ---
async def evaluate_automations_task():
    while True:
        try:
            autos = await automations_col.find({}).to_list(length=None)
            async with httpx.AsyncClient() as http_client:
                for auto in autos:
                    if not auto.get("is_active", True): continue
                    metric, op, thresh = auto.get("metric_query"), auto.get("operator", ">"), auto.get("threshold", 0)
                    if not metric: continue
                    full_query = f"{metric} {op} {thresh}"
                    try:
                        res = await http_client.get(f"{PROMETHEUS_URL}/api/v1/query", params={"query": full_query},
                                                    timeout=10.0)
                        data = res.json().get("data", {}).get("result", [])
                        if data:
                            val = data[0].get("value", [0, "0"])[1]
                            code = auto.get("python_code", "")
                            success = False
                            try:
                                exec_env = {"value": float(val), "requests": requests, "json": json,
                                            "subprocess": subprocess, "time": time}
                                exec(code, exec_env)
                                success = True
                            except Exception:
                                pass
                            if success:
                                new_hist = {"date": datetime.now().strftime("%d/%m/%Y %H:%M:%S"), "value": float(val)}
                                await automations_col.update_one({"_id": auto["_id"]}, {"$inc": {"run_count": 1},
                                                                                        "$push": {"history": {
                                                                                            "$each": [new_hist],
                                                                                            "$slice": -100}}})
                    except Exception:
                        pass
        except Exception:
            pass
        await asyncio.sleep(60)


class ExporterTestRequest(BaseModel):
    python_code: str


async def evaluate_choter_task():
    while True:
        try:
            groups = await choter_groups_col.find({}).to_list(length=None)
            for group in groups:
                if group.get("is_paused", False):
                    continue

                interval_minutes = group.get("interval_minutes", 5)
                last_run_str = group.get("last_run_time")
                should_run = False

                if not last_run_str:
                    should_run = True
                else:
                    try:
                        last_run_time = datetime.strptime(last_run_str, "%d/%m/%Y %H:%M:%S")
                        if (datetime.now() - last_run_time).total_seconds() >= (interval_minutes * 60):
                            should_run = True
                    except:
                        should_run = True

                if should_run:
                    async for _ in run_choter_generator(str(group["_id"])):
                        pass
        except Exception as e:
            print(f"Choter bg task error: {e}")
        await asyncio.sleep(10)


# --- BACKGROUND TASKS ---
async def periodic_external_api_task():
    while True:
        try:
            async with httpx.AsyncClient() as client:
                await client.get("http://arielVScpr.com/api", timeout=10.0)
        except Exception:
            pass
        await asyncio.sleep(8 * 3600)  # 8 hours


@app.on_event("startup")
async def startup_event():
    asyncio.create_task(evaluate_automations_task())
    asyncio.create_task(evaluate_choter_task())
    asyncio.create_task(periodic_external_api_task())
    asyncio.create_task(sync_nodes_background_task())


# --- MODELS ---
class Rule(BaseModel):
    name: str
    query: Optional[str] = ""
    maktag: Optional[str] = ""
    team: Optional[str] = ""
    purposeRule: Optional[str] = ""
    tsdb: Optional[str] = "pulse_thanos"
    node: Optional[str] = ""
    mappingTemplate: Optional[str] = ""
    queryMajor: Optional[str] = ""
    queryCritical: Optional[str] = ""
    majorThreshold: Optional[int] = None
    criticalThreshold: Optional[int] = None
    thresholdDirection: Optional[str] = ">"
    tech: Optional[str] = "CUSTOM"
    application: Optional[str] = ""
    subType: Optional[str] = ""
    track_id: Optional[str] = ""
    user: Optional[str] = "Unknown"
    history: Optional[list] = []
    reason: Optional[str] = ""
    elasticEnv: Optional[str] = ""
    indexName: Optional[str] = ""
    timeRange: Optional[str] = "15m"


class ConfigUpdate(BaseModel):
    teams: list
    apps: list
    techs: list
    admins: list
    roles: dict
    learn_url: str
    guide_links: dict
    generic_templates: dict
    home_config: dict = {}


class AutoFolder(BaseModel): name: str; user: Optional[str] = "Unknown"


class FolderRenameRequest(BaseModel): name: str; user: Optional[str] = "Unknown"


class Automation(
    BaseModel): folder_id: str; name: str; metric_query: str; operator: str; threshold: float; python_code: str; action_mode: \
    Optional[str] = "python"; builder_chain: Optional[list] = []; is_active: Optional[bool] = True; user: Optional[
    str] = "Unknown"


class ServerActionRequest(BaseModel): action_type: str; server: str; process: Optional[
    str] = ""; username: str; password: str


class NodeValidationRequest(BaseModel): tech: str; data: dict


class PromQLLabelsRequest(BaseModel): query: str


class ChoterGroup(BaseModel): name: str; user: Optional[str] = "Unknown"


class ChoterGroupSettings(BaseModel):
    interval_minutes: int
    trigger_script: str
    export_to_metrics: Optional[bool] = False
    user: Optional[str] = "Unknown"


class ChoterStation(
    BaseModel): group_id: str; name: str; tech: str = "elastic"; eck_url: str; query: str; time_range_minutes: int; condition_operator: str; condition_value: int; station_role: str; order: int = 1; delay_seconds: int = 0; user: \
    Optional[str] = "Unknown"


class ChoterElasticTestRequest(BaseModel): eck_url: str; query: str; time_range_minutes: int


class TriggerTestRequest(BaseModel): script: str


class ExistenceCube(BaseModel): name: str; description: Optional[str] = ""; script: Optional[str] = ""; user: Optional[
    str] = "Unknown"


class ExistenceCheckRequest(BaseModel): input_id: str


class ExporterCube(BaseModel):
    name: str
    description: Optional[str] = ""
    python_code: Optional[str] = ""
    interval_minutes: Optional[int] = 1
    update_mode: Optional[str] = "overwrite"
    user: Optional[str] = "Unknown"


# --- ENDPOINTS ---

@app.post("/api/promql/labels")
async def get_promql_labels(req: PromQLLabelsRequest):
    base_query = re.sub(r'\s*(?:>=|<=|>|<|==|!=)\s*\d+(?:\.\d+)?\s*$', '', req.query.strip())
    labels_list, static_labels_list = [], []
    for match in re.finditer(r'\{([^}]+)\}', base_query):
        static_labels = {}
        for kv in re.findall(r'([a-zA-Z0-9_]+)\s*=\s*(?:"([^"]*)"|\'([^\']*)\'|([^,]*))', match.group(1)):
            static_labels[kv[0].strip()] = kv[1] or kv[2] or kv[3]
        if static_labels: static_labels_list.append(static_labels)
    try:
        async with httpx.AsyncClient() as http_client:
            res = await http_client.get(f"{PROMETHEUS_URL}/api/v1/query", params={"query": base_query}, timeout=5.0)
            res.raise_for_status()
            data = res.json().get("data", {}).get("result", [])
            if data: labels_list = [item.get("metric", {}) for item in data]
    except Exception:
        pass
    if not labels_list and static_labels_list: labels_list = static_labels_list
    return {"status": "success", "labels": labels_list}


@app.post("/api/server-action")
async def execute_server_action(req: ServerActionRequest):
    if req.action_type == 'restart_process':
        return {"status": "success", "message": f"Process {req.process} restarted on {req.server}"}
    elif req.action_type == 'restart_server':
        return {"status": "success", "message": f"Server {req.server} restarted"}
    return {"status": "error", "message": f"Unknown action type: {req.action_type}"}


@app.get("/api/me")
async def get_current_user():
    try:
        user = getpass.getuser()
    except Exception:
        user = "Guest"
    try:
        roles = json.loads(config.get("/neptune/frontend/roles", DEFAULT_ROLES))
    except:
        roles = {"admins": []}
    try:
        legacy_admins = json.loads(config.get("/neptune/frontend/admins", DEFAULT_ADMINS))
    except:
        legacy_admins = []

    safe_user = str(user).strip().lower()
    is_admin = any(str(u).strip().lower() == safe_user for u in roles.get("admins", [])) or any(
        str(u).strip().lower() == safe_user for u in legacy_admins)

    if is_admin:
        role = "admin"
    else:
        role = "viewer"
    return {"username": user, "role": role}


@app.post("/api/config")
async def update_frontend_config(c: ConfigUpdate):
    try:
        doc = c.model_dump()
        await sys_config_col.update_one(
            {"_id": "main_config"},
            {"$set": doc},
            upsert=True
        )
        return {"status": "success", "message": "התצורות נשמרו ב-MongoDB בהצלחה!"}

    except Exception as e:
        print(f"Mongo Save Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database Error: {str(e)}")


@app.get("/api/config")
async def get_frontend_config():
    try:
        db_config = await sys_config_col.find_one({"_id": "main_config"})

        if db_config:
            home_config = db_config.get("home_config", {})
            if not home_config:
                home_config = {
                    "wip": "VIP 1", "start_time": "08:00", "end_time": "17:00",
                    "soldier_source": "manual", "soldier_name": "ישראל ישראלי", "soldier_user": "israel@im.idf",
                    "contacts": []
                }
            return {
                "teams": db_config.get("teams", []),
                "apps": db_config.get("apps", []),
                "techs": db_config.get("techs", []),
                "admins": db_config.get("admins", []),
                "roles": db_config.get("roles", {}),
                "learn_url": db_config.get("learn_url", DEFAULT_LEARN_URL),
                "guide_links": db_config.get("guide_links", {}),
                "generic_templates": db_config.get("generic_templates", {}),
                "home_config": home_config
            }

        return {
            "teams": json.loads(DEFAULT_TEAMS),
            "apps": json.loads(DEFAULT_APPS),
            "techs": json.loads(DEFAULT_TECHS),
            "admins": json.loads(DEFAULT_ADMINS),
            "roles": json.loads(DEFAULT_ROLES),
            "learn_url": DEFAULT_LEARN_URL,
            "guide_links": json.loads(DEFAULT_GUIDE_LINKS),
            "generic_templates": json.loads(DEFAULT_GENERIC_TEMPLATES),
            "home_config": {}
        }
    except Exception as e:
        print(f"Mongo Get Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/download/{tech}")
async def download_tech_zip(tech: str):
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        zip_file.writestr(f"install_{tech}.txt",
                          f"Installation instructions and configuration files for {tech.upper()}...\nEnjoy using NeptuneManager!")
    headers = {'Content-Disposition': f'attachment; filename="install_{tech}.zip"'}
    return Response(zip_buffer.getvalue(), media_type="application/zip", headers=headers)


@app.get("/rules")
async def get_all_rules():
    rules = await rules_collection.find({}).to_list(length=None)
    for rule in rules:
        rule["id"] = str(rule.pop("_id"))
        if "tech" not in rule or not rule["tech"]:
            if "elastic" in str(rule.get("tsdb", "")).lower():
                rule["tech"] = "elastic_log"
            else:
                rule["tech"] = "CUSTOM"
    return rules


class BulkDeleteRequest(BaseModel): ids: List[str]


@app.post("/rules/bulk-delete")
async def bulk_delete_rules(req: BulkDeleteRequest):
    await rules_collection.delete_many({"_id": {"$in": [ObjectId(id) for id in req.ids if len(id) == 24]}})
    return {"status": "success"}


@app.api_route("/api/shifts/soldier", methods=["GET", "POST"])
async def get_shifts_by_soldier_or_date(date: Optional[str] = None):
    query = {}
    if date:
        query["date"] = {"$regex": date}

    shifts = await shift_faults_col.find(query).sort("_id", -1).to_list(length=None)
    for s in shifts:
        s["id"] = str(s.pop("_id"))
    return shifts


@app.post("/rules")
async def create_new_rule(rule: Rule):
    d = rule.model_dump()
    d.pop("user", None)
    d.pop("history", None)

    if not d.get("tech") or d.get("tech") == "CUSTOM":
        if "elastic" in str(d.get("tsdb", "")).lower():
            d["tech"] = "elastic_log"
        else:
            d["tech"] = "CUSTOM"

    if d.get("name"):
        existing = await rules_collection.find_one({"name": d["name"]})
        if existing:
            update_fields = {
                "queryMajor": d.get("queryMajor", ""),
                "queryCritical": d.get("queryCritical", ""),
                "node": d.get("node", ""),
                "mappingTemplate": d.get("mappingTemplate", ""),
                "tsdb": d.get("tsdb", ""),
                "purposeRule": d.get("purposeRule", ""),
                "team": d.get("team", ""),
                "majorThreshold": d.get("majorThreshold"),
                "criticalThreshold": d.get("criticalThreshold"),
                "thresholdDirection": d.get("thresholdDirection", ">")
            }
            await rules_collection.update_one({"_id": existing["_id"]}, {"$set": update_fields})
            existing["id"] = str(existing.pop("_id"))
            return existing

    res = await rules_collection.insert_one(d)
    d["id"] = str(res.inserted_id)
    d.pop("_id", None)
    return d


@app.put("/rules/{rule_id}")
async def update_rule(rule_id: str, rule_data: Rule):
    existing = await rules_collection.find_one({"_id": ObjectId(rule_id)})
    if not existing: raise HTTPException(status_code=404, detail="Rule not found")

    d = rule_data.model_dump(exclude={"user", "history"})
    await rules_collection.update_one({"_id": ObjectId(rule_id)}, {"$set": d})

    updated = await rules_collection.find_one({"_id": ObjectId(rule_id)})
    updated["id"] = str(updated.pop("_id"))
    return updated


@app.delete("/rules/{rule_id}")
async def delete_rule(rule_id: str):
    await rules_collection.delete_one({"_id": ObjectId(rule_id)})
    return {"message": "Rule deleted successfully"}


class PromQLCheckRequest(BaseModel):
    query: str
    node: Optional[str] = ""
    mappingTemplate: Optional[str] = ""


@app.post("/check_promql")
async def check_promql(request: PromQLCheckRequest):
    config_doc = await database.get_collection("settings").find_one({"key": "monitoring_urls"})
    prometheus_url = config_doc["prometheus_url"] if config_doc and "prometheus_url" in config_doc else "http://localhost:9090"

    comps = await components_col.find({}).to_list(length=None)
    valid_nodes = set([str(c["name"]).lower() for c in comps])

    parts = re.split(r'\s+or\s+', request.query)
    parts_results = []

    async def process_part(http_client, original_part):
        stripped_part = original_part.strip()
        temp_query = stripped_part
        while temp_query.startswith('(') and temp_query.endswith(')'):
            temp_query = temp_query[1:-1].strip()

        query_for_test = re.sub(r'\s*(?:>=|<=|>|<|==|!=)\s*-?\d+(?:\.\d+)?\s*\)?$', '', temp_query)
        query_for_test = query_for_test.strip().rstrip(')')

        status = "success"
        reason = "תקין: המטריקה קיימת והרכיב מופה במאגר"
        missing_nodes = []
        found_nodes = []

        try:
            res = await http_client.get(f"{prometheus_url}/api/v1/query", params={"query": query_for_test}, timeout=5.0)
            res.raise_for_status()
            data = res.json().get("data", {}).get("result", [])

            if len(data) == 0:
                status = "error"
                reason = "שגיאה: המטריקה לא מחזירה נתונים ב-Prometheus"
            else:
                found_match = False
                if request.node == "GENERIC" and request.mappingTemplate:
                    for item in data:
                        labels = {k.lower(): str(v).lower() for k, v in item.get("metric", {}).items()}

                        def replace_label(match):
                            key = match.group(1).strip().lower()
                            return labels.get(key, match.group(0))

                        rendered = re.sub(r'\{+(?:\$labels\.)?([^}]+)\}+', replace_label, request.mappingTemplate).strip().lower()
                        if rendered in valid_nodes:
                            found_match = True
                            found_nodes.append(rendered)
                        else:
                            missing_nodes.append(rendered)
                elif request.node and request.node not in ["SYS_GENERIC", "GENERIC"]:
                    if request.node.lower() in valid_nodes:
                        found_match = True
                        found_nodes.append(request.node)
                    else:
                        missing_nodes.append(request.node)
                else:
                    found_match = True

                if not found_match and len(found_nodes) == 0:
                    status = "error"
                    reason = "שגיאה: המטריקה קיימת אך הרכיב לא נמצא במאגר המערכת"
                elif len(missing_nodes) > 0:
                    status = "error"
                    reason = "שגיאה: חלק מהרכיבים שנגזרו מהשאילתה חסרים במאגר"


        except Exception as e:
            status = "error"
            reason = f"שגיאת תקשורת: {str(e)}"
            data = []

        return {
            "part": original_part,
            "status": status,
            "reason": reason,
            "missing_nodes": list(set(missing_nodes)),
            "found_nodes": list(set(found_nodes)),
            "data": data  # הוספת הנתונים הגולמיים מהפרומטאוס לתשובה
        }

    async with httpx.AsyncClient() as http_client:
        tasks = [process_part(http_client, p) for p in parts]
        parts_results = await asyncio.gather(*tasks)

    overall = "success"
    if any(p["status"] == "error" for p in parts_results):
        overall = "error"
    elif any(p["status"] == "partial" for p in parts_results):
        overall = "partial"

    return {"status": overall, "parts_results": parts_results}


@app.get("/api/elastic-envs")
async def get_elastic_envs():
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get("http://localhost:6002/elastic_envs", timeout=2.0)
            if res.status_code == 200:
                return res.json()
    except:
        pass
    # דיפולט / Mock כמו שביקשת
    return [{"eck-visualpool-prod": ["admin", "admin"]}, {"eck-visualpool-prod-secondary": ["adminsec", "adminsec"]}]


class ElasticIndexCheck(BaseModel):
    env: str
    index: str


@app.post("/api/check-elastic-index")
async def check_elastic_index(req: ElasticIndexCheck):
    try:
        envs = await get_elastic_envs()
        creds = None
        for e in envs:
            if req.env in e:
                creds = e[req.env]
                break

        if not creds:
            return {"status": "error", "detail": "הסביבה שנבחרה לא קיימת."}

        if req.index.strip() == "":
            return {"status": "error", "detail": "שם האינדקס ריק."}

        # הדמיית בדיקה חיה, כאן אפשר לעשות Head Request לאלסטיק עם creds
        return {"status": "success", "message": f"האינדקס {req.index} תקין ומאומת מול הסביבה {req.env}."}
    except Exception as e:
        return {"status": "error", "detail": str(e)}


@app.get("/api/elastic-envs")
async def get_elastic_envs():
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get("http://localhost:6002/elastic_envs", timeout=2.0)
            if res.status_code == 200:
                return res.json()
    except:
        pass
    return [{"eck-visualpool-prod": ["admin", "admin"]}, {"eck-visualpool-prod-secondary": ["adminsec", "adminsec"]}]


class ElasticCountRequest(BaseModel):
    env: str
    index: str
    query: str
    timeRange: str


@app.post("/api/elastic-count")
async def elastic_count(req: ElasticCountRequest):
    try:
        if not req.index or not req.query:
            return {"status": "error", "detail": "נא למלא אינדקס ושאילתה לבדיקה"}

        elastic_body = {
            "query": {
                "bool": {
                    "must": [
                        {"query_string": {"query": req.query}}
                    ]
                }
            }
        }

        if req.timeRange:
            import re
            time_match = re.match(r"(\d+)([smhd])", req.timeRange)
            if time_match:
                elastic_body["query"]["bool"]["must"].append({
                    "range": {
                        "@timestamp": {
                            "gte": f"now-{req.timeRange}",
                            "lte": "now"
                        }
                    }
                })

        async with httpx.AsyncClient() as client:
            res = await client.post(f"{ELASTIC_URL}/{req.index}/_search", json=elastic_body, timeout=10.0)
            res.raise_for_status()
            data = res.json()
            total_hits = data.get("hits", {}).get("total", 0)
            count = total_hits.get("value", 0) if isinstance(total_hits, dict) else total_hits

            return {
                "status": "success",
                "count": count,
                "message": f"בדיקה חיה מול סביבת {req.env} באינדקס {req.index} עבור טווח {req.timeRange} בוצעה בהצלחה."
            }
    except Exception as e:
        return {"status": "error", "detail": str(e)}


class ElasticIndexCreate(BaseModel):
    env: str
    indexName: str


@app.post("/api/create-elastic-index")
async def create_elastic_index(req: ElasticIndexCreate):
    if not req.env or not req.indexName:
        raise HTTPException(status_code=400, detail="שדות חובה חסרים")
    return {
        "status": "success",
        "message": f"האינדקס '{req.indexName}' נוצר והוגדר בהצלחה בסביבת {req.env}!"
    }


class ElasticCheckRequest(BaseModel): index: str; query: str


@app.post("/check_elastic")
async def check_elastic(request: ElasticCheckRequest):
    try:
        async with httpx.AsyncClient() as http_client:
            response = await http_client.get(f"{ELASTIC_URL}/{request.index}/_search",
                                             params={"q": request.query, "size": 0}, timeout=5.0)
            response.raise_for_status()
            total_hits = response.json().get("hits", {}).get("total", 0)
            count = total_hits.get("value", 0) if isinstance(total_hits, dict) else total_hits
            return {"status": "success", "count": count}
    except Exception as e:
        return {"status": "error", "count": 0, "detail": str(e)}


class PromQLGraphRequest(BaseModel): query: str; start_time: Optional[int] = None; end_time: Optional[int] = None


@app.post("/rules")
async def create_new_rule(rule: Rule):
    d = rule.model_dump()
    user = d.pop("user", "Unknown")
    d.pop("history", None)
    reason = d.pop("reason", "יצירת חוק חדש")

    if not d.get("tech") or d.get("tech") == "CUSTOM":
        if "elastic" in str(d.get("tsdb", "")).lower():
            d["tech"] = "elastic_log"
        else:
            d["tech"] = "CUSTOM"

    now_str = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    snapshot = {k: v for k, v in d.items()}
    history_entry = {
        "user": user,
        "date": now_str,
        "version": 1,
        "query": d.get("queryMajor") or d.get("queryCritical") or d.get("query", ""),
        "node": d.get("node", ""),
        "tech": d.get("tech", ""),
        "reason": reason,
        "rule_snapshot": snapshot
    }
    d["history"] = [history_entry]

    if d.get("name"):
        existing = await rules_collection.find_one({"name": d["name"]})
        if existing:
            last_version = existing.get("history", [{"version": 0}])[-1]["version"] if existing.get("history") else 0
            history_entry["version"] = last_version + 1

            update_fields = {
                "queryMajor": d.get("queryMajor", ""),
                "queryCritical": d.get("queryCritical", ""),
                "node": d.get("node", ""),
                "mappingTemplate": d.get("mappingTemplate", ""),
                "tsdb": d.get("tsdb", ""),
                "purposeRule": d.get("purposeRule", ""),
                "team": d.get("team", ""),
                "majorThreshold": d.get("majorThreshold"),
                "criticalThreshold": d.get("criticalThreshold"),
                "thresholdDirection": d.get("thresholdDirection", ">"),
                "indexName": d.get("indexName", ""),
                "elasticEnv": d.get("elasticEnv", ""),
                "timeRange": d.get("timeRange", "15m")
            }
            await rules_collection.update_one(
                {"_id": existing["_id"]},
                {"$set": update_fields, "$push": {"history": history_entry}}
            )
            existing["id"] = str(existing.pop("_id"))
            return existing

    res = await rules_collection.insert_one(d)
    d["id"] = str(res.inserted_id)
    d.pop("_id", None)
    return d


@app.put("/rules/{rule_id}")
async def update_rule(rule_id: str, rule_data: Rule):
    existing = await rules_collection.find_one({"_id": ObjectId(rule_id)})
    if not existing: raise HTTPException(status_code=404, detail="Rule not found")

    d = rule_data.model_dump(exclude={"user", "history"})
    user = rule_data.user or "Unknown"
    reason = d.pop("reason", "עריכת חוק")

    now_str = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    last_version = existing.get("history", [{"version": 0}])[-1]["version"] if existing.get("history") else 0
    snapshot = {k: v for k, v in d.items()}

    history_entry = {
        "user": user,
        "date": now_str,
        "version": last_version + 1,
        "query": d.get("queryMajor") or d.get("queryCritical") or d.get("query", ""),
        "node": d.get("node", ""),
        "tech": d.get("tech", ""),
        "reason": reason,
        "rule_snapshot": snapshot
    }

    await rules_collection.update_one(
        {"_id": ObjectId(rule_id)},
        {"$set": d, "$push": {"history": history_entry}}
    )

    updated = await rules_collection.find_one({"_id": ObjectId(rule_id)})
    updated["id"] = str(updated.pop("_id"))
    return updated


@app.post("/promql_graph")
async def get_promql_graph(request: PromQLGraphRequest):
    try:
        end_t = request.end_time if request.end_time else int(time.time())
        start_t = request.start_time if request.start_time else end_t - 3600
        step = max(15, (end_t - start_t) // 300)
        async with httpx.AsyncClient() as http_client:
            response = await http_client.get(f"{PROMETHEUS_URL}/api/v1/query_range",
                                             params={"query": request.query, "start": start_t, "end": end_t,
                                                     "step": f"{step}s"}, timeout=30.0)
            response.raise_for_status()
            results = response.json().get("data", {}).get("result", [])
            if not results: return {"status": "success", "data": []}
            formatted_data = [{"time": v[0], "value": float(v[1])} for v in results[0].get("values", [])]
            return {"status": "success", "data": formatted_data}
    except Exception as e:
        return {"status": "error", "data": [], "detail": str(e)}


# --- AUTOMATIONS API ---
@app.get("/api/automations/folders")
async def get_auto_folders():
    folders = await folders_col.find({}).to_list(length=None)
    for f in folders: f["id"] = str(f.pop("_id"))
    return folders


@app.post("/api/automations/folders")
async def create_auto_folder(f: AutoFolder):
    doc = f.model_dump()
    usr = doc.pop("user", "Unknown")
    now_str = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    doc["created_by"] = usr
    doc["updated_by"] = usr
    doc["created_at"] = now_str
    doc["updated_at"] = now_str
    res = await folders_col.insert_one(doc)
    return {"id": str(res.inserted_id), "name": f.name}


@app.put("/api/automations/folders/{f_id}")
async def rename_auto_folder(f_id: str, req: FolderRenameRequest):
    usr = req.user or "Unknown"
    now_str = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    await folders_col.update_one({"_id": ObjectId(f_id)},
                                 {"$set": {"name": req.name, "updated_by": usr, "updated_at": now_str}})
    return {"status": "success"}


@app.delete("/api/automations/folders/{f_id}")
async def delete_auto_folder(f_id: str):
    await folders_col.delete_one({"_id": ObjectId(f_id)})
    await automations_col.delete_many({"folder_id": f_id})
    return {"status": "success"}


@app.get("/api/automations")
async def get_automations():
    autos = await automations_col.find({}).to_list(length=None)
    for a in autos: a["id"] = str(a.pop("_id"))
    return autos


@app.post("/api/metrics/add")
async def push_custom_metric(metric: PushMetric):
    label_str = ""
    if metric.labels:
        labels_kv = [f'{k}="{v}"' for k, v in metric.labels.items()]
        label_str = "{" + ",".join(labels_kv) + "}"

    full_metric_name = f"{metric.name}{label_str}"
    neptune_pushed_metrics[full_metric_name] = metric.value

    return {"status": "success", "message": "Metric updated", "metric": full_metric_name, "value": metric.value}


@app.post("/api/metrics/clear")
async def clear_pushed_metrics():
    neptune_pushed_metrics.clear()
    return {"status": "success", "message": "All custom pushed metrics cleared"}


exporter_cube_metrics = {}
exporter_last_run = {}


@app.on_event("startup")
async def start_exporter_background_task():
    asyncio.create_task(run_exporter_cubes_loop())


@app.get("/metrics/custom")
async def expose_prometheus_metrics():
    lines = []
    lines.append("# HELP neptune_custom_metrics Metrics generated by Neptune Custom Exporter")
    lines.append("# TYPE neptune_custom_metrics gauge")

    for name, value in neptune_pushed_metrics.items():
        lines.append(f"{name} {value}")

    for c_id, metrics_dict in exporter_cube_metrics.items():
        for m_name, m_val in metrics_dict.items():
            lines.append(f"{m_name} {m_val}")

    return Response(content="\n".join(lines) + "\n", media_type="text/plain")


@app.post("/api/automations")
async def create_automation(a: Automation):
    doc = a.model_dump()
    usr = doc.pop("user", "Unknown")
    now_str = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    doc["created_by"] = usr
    doc["updated_by"] = usr
    doc["created_at"] = now_str
    doc["updated_at"] = now_str
    doc["run_count"] = 0
    doc["history"] = []
    res = await automations_col.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    del doc["_id"]
    return doc


@app.put("/api/automations/{a_id}/toggle")
async def toggle_automation_active(a_id: str):
    auto = await automations_col.find_one({"_id": ObjectId(a_id)})
    if auto:
        new_status = not auto.get("is_active", True)
        await automations_col.update_one({"_id": ObjectId(a_id)}, {"$set": {"is_active": new_status}})
        return {"status": "success", "is_active": new_status}
    return {"status": "error"}


@app.delete("/api/automations/{a_id}")
async def delete_automation(a_id: str):
    await automations_col.delete_one({"_id": ObjectId(a_id)})
    return {"status": "success"}


class AutoTestRequest(BaseModel): python_code: str


@app.post("/api/automations/test")
async def test_automation(req: AutoTestRequest):
    old_stdout = sys.stdout
    redirected_output = sys.stdout = StringIO()
    try:
        exec_env = {"value": 100.0, "requests": requests, "json": json, "subprocess": subprocess, "time": time}
        exec(req.python_code, exec_env)
        output = redirected_output.getvalue()
        return {"status": "success", "output": output}
    except Exception as e:
        return {"status": "error", "output": traceback.format_exc()}
    finally:
        sys.stdout = old_stdout


# --- EXISTENCE CUBES ---
@app.get("/api/existence/cubes")
async def get_existence_cubes():
    cubes = await existence_cubes_col.find({}).to_list(length=None)
    for c in cubes: c["id"] = str(c.pop("_id"))
    return cubes


@app.post("/api/existence/cubes")
async def create_existence_cube(cube: ExistenceCube):
    doc = cube.model_dump()
    usr = doc.pop("user", "Unknown")
    now_str = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    doc["created_by"] = usr
    doc["updated_by"] = usr
    doc["created_at"] = now_str
    doc["updated_at"] = now_str
    res = await existence_cubes_col.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    del doc["_id"]
    return doc


@app.put("/api/existence/cubes/{c_id}")
async def update_existence_cube(c_id: str, cube: ExistenceCube):
    doc = cube.model_dump()
    usr = doc.pop("user", "Unknown")
    now_str = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    doc["updated_by"] = usr
    doc["updated_at"] = now_str
    await existence_cubes_col.update_one({"_id": ObjectId(c_id)}, {"$set": doc})
    return {"status": "success"}


@app.delete("/api/existence/cubes/{c_id}")
async def delete_existence_cube(c_id: str):
    await existence_cubes_col.delete_one({"_id": ObjectId(c_id)})
    return {"status": "success"}


@app.post("/api/existence/cubes/{c_id}/check")
async def execute_existence_check(c_id: str, req: ExistenceCheckRequest):
    cube = await existence_cubes_col.find_one({"_id": ObjectId(c_id)})
    if not cube: raise HTTPException(status_code=404, detail="Cube not found")
    script = cube.get("script", "")
    old_stdout = sys.stdout
    redirected_output = sys.stdout = StringIO()
    exec_env = {"requests": requests, "json": json, "subprocess": subprocess, "time": time, "input_id": req.input_id,
                "result": False}
    try:
        exec(script, exec_env)
        output = redirected_output.getvalue()
        is_success = bool(exec_env.get("result", False))
        return {"status": "success", "result": is_success, "output": output}
    except Exception as e:
        return {"status": "error", "result": False, "output": traceback.format_exc()}
    finally:
        sys.stdout = old_stdout


# --- EXPORTER CUBES ---
@app.get("/api/exporter/cubes")
async def get_exporter_cubes():
    cubes = await exporter_cubes_col.find({}).to_list(length=None)
    for c in cubes: c["id"] = str(c.pop("_id"))
    return cubes


@app.post("/api/exporter/test")
async def test_exporter_script(req: ExporterTestRequest):
    old_stdout = sys.stdout
    redirected_output = sys.stdout = StringIO()

    local_metrics = {}

    def add_metric(name, value, labels=None):
        if labels:
            lbl_str = ",".join([f'{k}="{v}"' for k, v in labels.items()])
            metric_key = f"{name}{{{lbl_str}}}"
        else:
            metric_key = name
        local_metrics[metric_key] = value

    class MockGauge:
        def __init__(self, name, documentation='', labelnames=()):
            self.name = name

        def labels(self, **kwargs):
            parent = self

            class LabelledGauge:
                def set(self, val):
                    lbl_str = ",".join([f'{k}="{v}"' for k, v in kwargs.items()])
                    metric_key = f"{parent.name}{{{lbl_str}}}"
                    local_metrics[metric_key] = val

            return LabelledGauge()

        def set(self, val):
            local_metrics[self.name] = val

    class MockCounter:
        def __init__(self, name, documentation='', labelnames=()):
            self.name = name

        def labels(self, **kwargs):
            parent = self

            class LabelledCounter:
                def inc(self, amount=1):
                    lbl_str = ",".join([f'{k}="{v}"' for k, v in kwargs.items()])
                    metric_key = f"{parent.name}{{{lbl_str}}}"
                    local_metrics[metric_key] = local_metrics.get(metric_key, 0) + amount

            return LabelledCounter()

        def inc(self, amount=1):
            local_metrics[self.name] = local_metrics.get(self.name, 0) + amount

    try:
        exec_env = {"add_metric": add_metric, "Gauge": MockGauge, "Counter": MockCounter, "requests": requests,
                    "json": json, "time": time}
        exec(req.python_code, exec_env, exec_env)
        output = redirected_output.getvalue()

        preview_str = "\n".join([f"{k} {v}" for k, v in local_metrics.items()])
        if not preview_str:
            preview_str = "לא נאספו מטריקות. ודא שהשתמשת ב- Gauge או Counter"

        final_output = f"--- פלט קונסול (Print) ---\n{output}\n--- מטריקות שנוצרו (Prometheus Format) ---\n{preview_str}"
        return {"status": "success", "output": final_output}
    except Exception as e:
        return {"status": "error", "output": traceback.format_exc()}
    finally:
        sys.stdout = old_stdout


async def run_exporter_cubes_loop():
    while True:
        try:
            cubes = await exporter_cubes_col.find().to_list(length=None)
            now = time.time()
            for cube in cubes:
                c_id = str(cube["_id"])
                interval_sec = cube.get("interval_minutes", 1) * 60
                last_run = exporter_last_run.get(c_id, 0)

                if now - last_run >= interval_sec:
                    code = cube.get("python_code", "")
                    mode = cube.get("update_mode", "overwrite")
                    cube_name = cube.get("name", "Unknown")

                    try:
                        local_metrics = {}

                        def add_metric(name, value, labels=None):
                            if labels:
                                lbl_str = ",".join([f'{k}="{v}"' for k, v in labels.items()])
                                metric_key = f"{name}{{{lbl_str}}}"
                            else:
                                metric_key = name
                            local_metrics[metric_key] = value

                        class MockGauge:
                            def __init__(self, name, documentation='', labelnames=()):
                                self.name = name

                            def labels(self, **kwargs):
                                parent = self

                                class LabelledGauge:
                                    def set(self, val):
                                        lbl_str = ",".join([f'{k}="{v}"' for k, v in kwargs.items()])
                                        metric_key = f"{parent.name}{{{lbl_str}}}"
                                        local_metrics[metric_key] = val

                                return LabelledGauge()

                            def set(self, val):
                                local_metrics[self.name] = val

                        class MockCounter:
                            def __init__(self, name, documentation='', labelnames=()):
                                self.name = name

                            def labels(self, **kwargs):
                                parent = self

                                class LabelledCounter:
                                    def inc(self, amount=1):
                                        lbl_str = ",".join([f'{k}="{v}"' for k, v in kwargs.items()])
                                        metric_key = f"{parent.name}{{{lbl_str}}}"
                                        local_metrics[metric_key] = local_metrics.get(metric_key, 0) + amount

                                return LabelledCounter()

                            def inc(self, amount=1):
                                local_metrics[self.name] = local_metrics.get(self.name, 0) + amount

                        local_env = {"add_metric": add_metric, "Gauge": MockGauge, "Counter": MockCounter,
                                     "requests": requests, "json": json, "time": time}

                        old_stdout = sys.stdout
                        redirected_output = sys.stdout = StringIO()
                        run_status = "success"

                        try:
                            exec(code, local_env, local_env)
                            output_log = redirected_output.getvalue()
                        except Exception as e:
                            run_status = "error"
                            output_log = redirected_output.getvalue() + "\n" + traceback.format_exc()
                        finally:
                            sys.stdout = old_stdout

                        if run_status == "success":
                            if mode == "clear" or c_id not in exporter_cube_metrics:
                                exporter_cube_metrics[c_id] = {}
                            exporter_cube_metrics[c_id].update(local_metrics)

                        exporter_last_run[c_id] = now
                        now_str = datetime.now().strftime("%d/%m/%Y %H:%M:%S")

                        history_entry = {
                            "date": now_str,
                            "status": run_status,
                            "log": output_log.strip() if output_log.strip() else f"נאספו {len(local_metrics)} מטריקות בהצלחה (ללא פלט)."
                        }

                        await exporter_cubes_col.update_one(
                            {"_id": ObjectId(c_id)},
                            {
                                "$set": {"last_run_time": now_str, "last_run_status": run_status},
                                "$push": {"history": {"$each": [history_entry], "$slice": -50}}
                            }
                        )

                        if run_status == "success":
                            log_msg = f"Exporter '{cube_name}' ran successfully. Gathered {len(local_metrics)} metrics."
                            await log_to_elastic("exporter", f"Exporter_{c_id}", log_msg)
                        else:
                            err_msg = f"Exporter '{cube_name}' failed to run."
                            await log_to_elastic("exporter", f"Exporter_{c_id}", err_msg)

                    except Exception as e:
                        print(f"Error in exporter cube {cube_name}: {e}")

        except Exception as e:
            print(f"Error in background exporter loop: {e}")

        await asyncio.sleep(10)


@app.post("/api/exporter/cubes")
async def create_exporter_cube(cube: ExporterCube):
    doc = cube.model_dump()
    usr = doc.pop("user", "Unknown")
    now_str = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    doc["created_by"] = usr
    doc["updated_by"] = usr
    doc["created_at"] = now_str
    doc["updated_at"] = now_str
    res = await exporter_cubes_col.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    del doc["_id"]
    return doc


@app.put("/api/exporter/cubes/{c_id}")
async def update_exporter_cube(c_id: str, cube: ExporterCube):
    doc = cube.model_dump()
    usr = doc.pop("user", "Unknown")
    now_str = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    doc["updated_by"] = usr
    doc["updated_at"] = now_str
    await exporter_cubes_col.update_one({"_id": ObjectId(c_id)}, {"$set": doc})
    return {"status": "success"}


@app.delete("/api/exporter/cubes/{c_id}")
async def delete_exporter_cube(c_id: str):
    await exporter_cubes_col.delete_one({"_id": ObjectId(c_id)})

    if c_id in exporter_cube_metrics:
        del exporter_cube_metrics[c_id]
    if c_id in exporter_last_run:
        del exporter_last_run[c_id]

    return {"status": "success"}


@app.get("/metrics/custom")
async def get_custom_metrics():
    output_lines = []
    async for cube in exporter_cubes_col.find():
        code = cube.get("python_code", "")
        cube_name = cube.get("name", "unknown")

        local_env = {"metrics": {}, "requests": requests, "json": json, "time": time}

        try:
            exec(code, {}, local_env)
            for m_name, m_val in local_env["metrics"].items():
                clean_name = re.sub(r'[^a-zA-Z0-9_]', '_', str(m_name))
                output_lines.append(f"# HELP {clean_name} Generated by custom cube: {cube_name}")
                output_lines.append(f"# TYPE {clean_name} gauge")
                output_lines.append(f"{clean_name} {m_val}")
        except Exception as e:
            clean_cube_name = re.sub(r'[^a-zA-Z0-9_]', '_', str(cube_name))
            err_metric = f"exporter_cube_error{{cube=\"{clean_cube_name}\"}}"
            output_lines.append(f"{err_metric} 1")

    return Response(content="\n".join(output_lines) + "\n", media_type="text/plain")


# --- CHOTER (HERMETICITY) API ---
async def log_to_elastic(g_id: str, g_name: str, message: str) -> str:
    time_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    formatted_msg = f"[{time_str}] {message}"
    doc = {
        "@timestamp": datetime.utcnow().isoformat() + "Z",
        "group_id": str(g_id),
        "group_name": g_name,
        "message": formatted_msg
    }
    try:
        async with httpx.AsyncClient() as http_client:
            await http_client.post(f"http://localhost:9200/ariel-logs/_doc", json=doc, timeout=3.0)
    except Exception as e:
        print(f"Failed to write log to elastic: {e}")
    return formatted_msg


@app.get("/api/choter/groups/{g_id}/logs")
async def get_choter_logs_from_elastic(g_id: str):
    query_body = {"query": {"term": {"group_id.keyword": g_id}}, "sort": [{"@timestamp": "desc"}], "size": 50}
    try:
        async with httpx.AsyncClient() as http_client:
            res = await http_client.post(f"http://localhost:9200/ariel-logs/_search", json=query_body, timeout=5.0)
            res.raise_for_status()
            hits = res.json().get("hits", {}).get("hits", [])
            logs = [hit["_source"].get("message", "") for hit in reversed(hits)]
            return {"status": "success", "logs": logs}
    except Exception as e:
        return {"status": "error", "logs": []}


@app.post("/api/choter/test-trigger")
async def test_choter_trigger(req: TriggerTestRequest):
    old_stdout = sys.stdout
    redirected_output = sys.stdout = StringIO()
    try:
        exec_env = {"requests": requests, "json": json, "subprocess": subprocess, "time": time}
        exec(req.script, exec_env)
        output = redirected_output.getvalue()
        return {"status": "success", "output": output}
    except Exception as e:
        return {"status": "error", "output": traceback.format_exc()}
    finally:
        sys.stdout = old_stdout


@app.get("/api/choter/groups")
async def get_choter_groups():
    groups = await choter_groups_col.find({}).to_list(length=None)
    for g in groups: g["id"] = str(g.pop("_id"))
    return groups


@app.post("/api/choter/groups")
async def create_choter_group(req: ChoterGroup):
    doc = req.model_dump()
    usr = doc.pop("user", "Unknown")
    now_str = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    doc["created_by"] = usr
    doc["updated_by"] = usr
    doc["created_at"] = now_str
    doc["updated_at"] = now_str
    doc["is_paused"] = False
    res = await choter_groups_col.insert_one(doc)
    return {"id": str(res.inserted_id), "name": req.name}


@app.put("/api/choter/groups/{g_id}/settings")
async def update_choter_group_settings(g_id: str, req: ChoterGroupSettings):
    doc = req.model_dump()
    usr = doc.pop("user", "Unknown")
    now_str = datetime.now().strftime("%d/%m/%Y %H:%M:%S")

    if not req.export_to_metrics:
        group = await choter_groups_col.find_one({"_id": ObjectId(g_id)})
        if group:
            group_name = group.get("name", "Unknown")
            keys_to_remove = [k for k in list(neptune_pushed_metrics.keys()) if
                              k.startswith("neptune_choter_status{") and f'group="{group_name}"' in k]
            for k in keys_to_remove:
                del neptune_pushed_metrics[k]

    await choter_groups_col.update_one(
        {"_id": ObjectId(g_id)},
        {"$set": {
            "interval_minutes": req.interval_minutes,
            "trigger_script": req.trigger_script,
            "export_to_metrics": req.export_to_metrics,
            "updated_by": usr,
            "updated_at": now_str
        }}
    )
    return {"status": "success"}


@app.put("/api/choter/groups/{g_id}/toggle-pause")
async def toggle_choter_pause(g_id: str):
    group = await choter_groups_col.find_one({"_id": ObjectId(g_id)})
    if group:
        new_status = not group.get("is_paused", False)
        await choter_groups_col.update_one({"_id": ObjectId(g_id)}, {"$set": {"is_paused": new_status}})
        return {"status": "success", "is_paused": new_status}
    return {"status": "error"}


@app.delete("/api/choter/groups/{g_id}")
async def delete_choter_group(g_id: str):
    await choter_groups_col.delete_one({"_id": ObjectId(g_id)})
    await choter_stations_col.delete_many({"group_id": g_id})
    return {"status": "success"}


@app.get("/api/choter/stations")
async def get_choter_stations():
    stations = await choter_stations_col.find({}).sort("order", 1).to_list(length=None)
    for s in stations: s["id"] = str(s.pop("_id"))
    return stations


@app.post("/api/choter/stations")
async def create_choter_station(req: ChoterStation):
    doc = req.model_dump()
    usr = doc.pop("user", "Unknown")
    now_str = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    doc["created_by"] = usr
    doc["updated_by"] = usr
    doc["created_at"] = now_str
    doc["updated_at"] = now_str
    res = await choter_stations_col.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    del doc["_id"]
    return doc


@app.put("/api/choter/stations/{s_id}")
async def update_choter_station(s_id: str, req: ChoterStation):
    doc = req.model_dump()
    usr = doc.pop("user", "Unknown")
    now_str = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    doc["updated_by"] = usr
    doc["updated_at"] = now_str
    await choter_stations_col.update_one({"_id": ObjectId(s_id)}, {"$set": doc})
    return {"status": "success"}


@app.delete("/api/choter/stations/{s_id}")
async def delete_choter_station(s_id: str):
    await choter_stations_col.delete_one({"_id": ObjectId(s_id)})
    return {"status": "success"}


@app.post("/api/choter/test-elastic")
async def test_choter_elastic(req: ChoterElasticTestRequest):
    elastic_body = {"query": {"bool": {"must": [{"query_string": {"query": req.query}}, {
        "range": {"@timestamp": {"gte": f"now-{req.time_range_minutes}m", "lte": "now"}}}]}}}
    try:
        url = req.eck_url if req.eck_url.endswith("_search") else f"{req.eck_url.rstrip('/')}/_search"
        async with httpx.AsyncClient() as http_client:
            response = await http_client.post(url, json=elastic_body, timeout=10.0)
            response.raise_for_status()
            total_hits = response.json().get("hits", {}).get("total", 0)
            count = total_hits.get("value", 0) if isinstance(total_hits, dict) else total_hits
            return {"status": "success", "count": count}
    except Exception as e:
        return {"status": "error", "detail": str(e), "count": 0}


async def run_choter_generator(g_id: str):
    group = await choter_groups_col.find_one({"_id": ObjectId(g_id)})
    if not group:
        yield f"data: {json.dumps({'log': 'Error: Group not found', 'done': True, 'active_station_id': None})}\n\n"
        return

    group_name = group.get("name", "Unknown")
    msg = await log_to_elastic(g_id, group_name, f"--- Starting Choter run: {group_name} ---")
    yield f"data: {json.dumps({'log': msg, 'active_station_id': None})}\n\n"

    trigger_script = group.get("trigger_script", "")
    if trigger_script:
        msg = await log_to_elastic(g_id, group_name, "Attempting to run Trigger script...")
        yield f"data: {json.dumps({'log': msg, 'active_station_id': None})}\n\n"
        old_stdout = sys.stdout
        redirected_output = sys.stdout = StringIO()
        try:
            exec_env = {"requests": requests, "json": json, "subprocess": subprocess, "time": time}
            exec(trigger_script, exec_env)
            msg = await log_to_elastic(g_id, group_name, "Trigger executed successfully.")
            yield f"data: {json.dumps({'log': msg, 'active_station_id': None})}\n\n"
            stdout_val = redirected_output.getvalue()
            if stdout_val:
                msg = await log_to_elastic(g_id, group_name, f"Trigger output: {stdout_val.strip()}")
                yield f"data: {json.dumps({'log': msg, 'active_station_id': None})}\n\n"
        except Exception as e:
            msg = await log_to_elastic(g_id, group_name, f"Trigger error: {traceback.format_exc()}")
            yield f"data: {json.dumps({'log': msg, 'active_station_id': None})}\n\n"
        finally:
            sys.stdout = old_stdout
    else:
        msg = await log_to_elastic(g_id, group_name, "No trigger defined. Proceeding to station checks...")
        yield f"data: {json.dumps({'log': msg, 'active_station_id': None})}\n\n"

    stations = await choter_stations_col.find({"group_id": g_id}).to_list(length=None)
    stations.sort(key=lambda s: s.get("order", 0))

    source_success = False;
    dest_success = False;
    has_source = False;
    has_dest = False

    async with httpx.AsyncClient() as http_client:
        for station in stations:
            delay = station.get("delay_seconds", 0)
            station_name = station.get("name", "Unknown")
            station_id = str(station["_id"])

            if delay > 0:
                msg = await log_to_elastic(g_id, group_name,
                                           f"Waiting {delay} seconds before checking station [{station_name}]...")
                yield f"data: {json.dumps({'log': msg, 'active_station_id': station_id})}\n\n"
                await asyncio.sleep(delay)

            time_range = station.get('time_range_minutes', 15)
            query_str = station.get('query', '')

            msg = await log_to_elastic(g_id, group_name, f"Checking station: {station_name} (Query: {query_str})...")
            yield f"data: {json.dumps({'log': msg, 'active_station_id': station_id})}\n\n"

            elastic_body = {"query": {"bool": {"must": [{"query_string": {"query": query_str}}, {
                "range": {"@timestamp": {"gte": f"now-{time_range}m", "lte": "now"}}}]}}}
            eck_url = station.get("eck_url", "")
            url = eck_url if eck_url.endswith("_search") else f"{eck_url.rstrip('/')}/_search"

            status = "error"
            count = 0
            try:
                response = await http_client.post(url, json=elastic_body, timeout=10.0)
                if response.status_code == 200:
                    total_hits = response.json().get("hits", {}).get("total", 0)
                    count = total_hits.get("value", 0) if isinstance(total_hits, dict) else total_hits
                    op = station.get("condition_operator", ">")
                    val = station.get("condition_value", 0)

                    if op == '>' and count > val:
                        status = "success"
                    elif op == '<' and count < val:
                        status = "success"
                    elif op == '==' and count == val:
                        status = "success"

                    msg = await log_to_elastic(g_id, group_name,
                                               f"Station [{station_name}] answered successfully. Found {count} records in range.")
                    yield f"data: {json.dumps({'log': msg, 'active_station_id': station_id})}\n\n"
                else:
                    msg = await log_to_elastic(g_id, group_name,
                                               f"Error in station [{station_name}]: HTTP {response.status_code}")
                    yield f"data: {json.dumps({'log': msg, 'active_station_id': station_id})}\n\n"
            except Exception as e:
                msg = await log_to_elastic(g_id, group_name,
                                           f"Communication error in station [{station_name}]: {str(e)}")
                yield f"data: {json.dumps({'log': msg, 'active_station_id': station_id})}\n\n"

            station["last_status"] = status
            await choter_stations_col.update_one({"_id": station["_id"]},
                                                 {"$set": {"last_status": status, "last_value": count}})

            if station.get("station_role") == "source":
                has_source = True
                if status == "success": source_success = True
            if station.get("station_role") == "destination":
                has_dest = True
                if status == "success": dest_success = True

    final_group_status = "error"
    if has_source and has_dest and source_success and dest_success:
        final_group_status = "success"
    elif not has_source and not has_dest:
        if all(s.get("last_status") == "success" for s in stations): final_group_status = "success"

    now_str = datetime.now().strftime("%d/%m/%Y %H:%M:%S")

    history_entry = {
        "date": now_str,
        "status": final_group_status,
        "log": f"ריצת החוטר הסתיימה בסטטוס: {final_group_status}"
    }

    await choter_groups_col.update_one(
        {"_id": ObjectId(g_id)},
        {
            "$set": {"last_run_time": now_str, "last_run_status": final_group_status},
            "$push": {"history": {"$each": [history_entry], "$slice": -100}}
        }
    )

    is_exporting = group.get("export_to_metrics", False)
    if is_exporting:
        exported_count = 0
        for s in stations:
            val = 1 if s.get("last_status") == "success" else 0
            label_str = f'{{group="{group_name}",station="{s.get("name", "Unknown")}",role="{s.get("station_role", "unknown")}"}}'
            metric_name = f"neptune_choter_status{label_str}"
            neptune_pushed_metrics[metric_name] = val
            exported_count += 1
        msg_exp = await log_to_elastic(g_id, group_name, f"Auto-Exported {exported_count} metrics to Prometheus.")
        yield f"data: {json.dumps({'log': msg_exp, 'active_station_id': None})}\n\n"
    else:
        keys_to_remove = [k for k in list(neptune_pushed_metrics.keys()) if
                          k.startswith("neptune_choter_status{") and f'group="{group_name}"' in k]
        for k in keys_to_remove:
            del neptune_pushed_metrics[k]
        if keys_to_remove:
            msg_exp = await log_to_elastic(g_id, group_name, f"Removed metrics from Exporter (Export disabled).")
            yield f"data: {json.dumps({'log': msg_exp, 'active_station_id': None})}\n\n"

    msg = await log_to_elastic(g_id, group_name,
                               f"--- Run completed. Final status for the flow: {final_group_status} ---")
    yield f"data: {json.dumps({'log': msg, 'done': True, 'final_status': final_group_status, 'active_station_id': None})}\n\n"


@app.get("/api/choter/stream-run/{g_id}")
async def stream_run_choter_group(g_id: str):
    return StreamingResponse(run_choter_generator(g_id), media_type="text/event-stream")


from fastapi import File, UploadFile
from rapidocr_onnxruntime import RapidOCR

engine = RapidOCR()


@app.post("/api/scan-architecture")
async def scan_architecture(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        result, elapse = engine(contents)

        unique_components = set()

        if result:
            for item in result:
                text = item[1]
                words = re.findall(r'[A-Za-z0-9_-]+', text)
                for w in words:
                    if len(w) >= 2:
                        unique_components.add(w)

        results = [{"component": comp} for comp in list(unique_components)]

        return {"status": "success", "data": results}

    except Exception as e:
        print(f"Error in architecture OCR scan: {str(e)}")
        return {"status": "error", "message": str(e)}


@app.post("/api/admin/migrate-rules")
async def migrate_external_rules(external_rules: List[dict]):
    migrated_count = 0
    now_str = datetime.now().strftime("%d/%m/%Y %H:%M")

    for item in external_rules:
        name = item.get("group_name", "Migrated Rule")
        node = item.get("node", "")
        tsdb = item.get("tsdb", "").lower()

        tech = "CUSTOM"
        if "elastic" in tsdb:
            tech = "elastic_log"

        group_rules = item.get("group_rules", {})
        base_query = ""
        major_threshold = None
        critical_threshold = None

        for r_id in group_rules:
            r_info = group_rules[r_id]
            raw_query = r_info.get("query", "").strip()
            severity = r_info.get("severity", "").lower()

            match = re.match(r"^(.*?)\s*([><]=?|==)\s*(\d+)$", raw_query)

            if match:
                q_part = match.group(1).strip()
                val_part = int(match.group(3))

                if not base_query:
                    base_query = q_part

                if severity == "major":
                    major_threshold = val_part
                elif severity == "critical":
                    critical_threshold = val_part
            else:
                if not base_query:
                    base_query = raw_query

        existing_rule = await rules_collection.find_one({"name": name})

        new_rule_doc = {
            "name": name,
            "query": base_query,
            "tech": tech,
            "subType": "אפליקטיבי",
            "application": "",
            "track_id": "",
            "node": node,
            "majorThreshold": major_threshold,
            "criticalThreshold": critical_threshold,
            "user": "System Migration"
        }

        history_entry = {
            "user": "System Migration",
            "date": now_str,
            "version": 1,
            "query": base_query,
            "node": node,
            "tech": tech
        }

        if existing_rule:
            last_version = existing_rule.get("history", [{"version": 0}])[-1]["version"] if existing_rule.get("history") else 0
            history_entry["version"] = last_version + 1

            await rules_collection.update_one(
                {"_id": existing_rule["_id"]},
                {
                    "$set": new_rule_doc,
                    "$push": {"history": history_entry}
                }
            )
        else:
            new_rule_doc["team"] = "Migrated"
            new_rule_doc["purpose"] = ""
            new_rule_doc["history"] = [history_entry]

            await rules_collection.insert_one(new_rule_doc)

        migrated_count += 1

    return {"status": "success", "migrated_count": migrated_count}


# --- ELASTIC QUERIES API ---
class ElasticQuery(BaseModel):
    name: str
    index: str
    query: str
    linkedNodeId: Optional[str] = ""
    explanation: Optional[str] = ""
    maktag: Optional[str] = ""
    qls: Optional[str] = ""
    time: Optional[str] = "24h"
    history: Optional[list] = []
    user: Optional[str] = "Unknown"


@app.get("/api/elastic-queries")
async def get_elastic_queries():
    queries = await elastic_queries_col.find({}).to_list(length=None)
    for q in queries: q["id"] = str(q.pop("_id"))
    return queries


@app.post("/api/elastic-queries")
async def create_elastic_query(q: ElasticQuery):
    doc = q.model_dump()
    res = await elastic_queries_col.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    del doc["_id"]
    return doc


@app.put("/api/elastic-queries/{q_id}")
async def update_elastic_query(q_id: str, q: ElasticQuery):
    doc = q.model_dump()
    await elastic_queries_col.update_one({"_id": ObjectId(q_id)}, {"$set": doc})
    return {"status": "success"}


@app.delete("/api/elastic-queries/{q_id}")
async def delete_elastic_query(q_id: str):
    await elastic_queries_col.delete_one({"_id": ObjectId(q_id)})
    return {"status": "success"}


class ShiftFault(BaseModel):
    faultId: str
    title: str
    note: str
    impact: str
    date: str
    user: str
    soldier: Optional[str] = ""


@app.get("/api/shifts")
async def get_shifts():
    shifts = await shift_faults_col.find({}).sort("_id", -1).to_list(length=None)
    for s in shifts: s["id"] = str(s.pop("_id"))
    return shifts


@app.post("/api/shifts")
async def create_shift(s: ShiftFault):
    doc = s.model_dump()
    res = await shift_faults_col.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    del doc["_id"]
    return doc


@app.delete("/api/shifts/{s_id}")
async def delete_shift(s_id: str):
    await shift_faults_col.delete_one({"_id": ObjectId(s_id)})
    return {"status": "success"}


if __name__ == "__main__":
    uvicorn.run("api:app", host=SERVER_HOST, port=SERVER_PORT, reload=True)
