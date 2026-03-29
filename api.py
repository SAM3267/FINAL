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

from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
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

DEFAULT_TEAMS = '[{"id": "hoshen", "name": "חושן", "desc": "תשתיות תקשורת ורשת", "icon": "IconShield", "tracks": [{"id": "t1", "name": "מסלול ראשי"}]}, {"id": "galactic", "name": "גלקטיק", "desc": "מערכות ניטור חלל ולוויינות", "icon": "IconRocket", "tracks": []}, {"id": "cobra", "name": "קוברה", "desc": "תקיפה וסינון התראות", "icon": "IconRadar", "tracks": []}]'
DEFAULT_APPS = '["hoshen", "galactic", "cobra"]'

# הוספנו ולידציות: pattern לשדות טקסט, ו-min/max לספים.
DEFAULT_TECHS = '''[
  {"value": "rabbit", "label": "RabbitMQ", "icon": "rabbit", "metricType": "messages", "fields": [{"name": "vhost", "label": "VHOST (לדוגמה /)", "pattern": "^/.*", "patternMsg": "חייב להתחיל בלוכסן"}, {"name": "queue", "label": "שם תור"}], "labelTemplate": "{vhost}-{queue}", "thresholds": [{"name": "majorThreshold", "label": "Major (הודעות תקועות)", "min": 0, "max": 1000000}, {"name": "criticalThreshold", "label": "Critical (הודעות תקועות)", "min": 0, "max": 1000000}]},
  {"value": "nifi", "label": "NiFi", "icon": "nifi", "metricType": "messages", "fields": [{"name": "componentName", "label": "שם רכיב"}], "labelTemplate": "{componentName}", "thresholds": [{"name": "majorThreshold", "label": "Major (קבצים תקועים)", "min": 0}, {"name": "criticalThreshold", "label": "Critical (קבצים תקועים)", "min": 0}]},
  {"value": "kafka", "label": "Kafka", "icon": "kafka", "metricType": "custom", "fields": [{"name": "componentName", "label": "שם אשכול/רכיב"}], "labelTemplate": "{componentName}", "thresholds": [{"name": "majorThreshold", "label": "Lag Major", "min": 0}, {"name": "criticalThreshold", "label": "Lag Critical", "min": 0}]},
  {"value": "elastic", "label": "Elastic (ECK)", "icon": "elastic", "metricType": "logs", "fields": [{"name": "envName", "label": "שם סביבה"}], "labelTemplate": "{envName}", "thresholds": []},
  {"value": "s3", "label": "S3 Storage", "icon": "s3", "metricType": "storage", "fields": [{"name": "userId", "label": "User ID"}], "labelTemplate": "{userId}", "thresholds": [{"name": "storageMajor", "label": "Storage Major %", "min": 0, "max": 100}, {"name": "storageCritical", "label": "Storage Critical %", "min": 0, "max": 100}, {"name": "objectsMajor", "label": "Objects Major", "min": 0}, {"name": "objectsCritical", "label": "Objects Critical", "min": 0}]},
  {"value": "mongo", "label": "MongoDB", "icon": "mongo", "metricType": "storage", "fields": [{"name": "mongoDbName", "label": "DB Name", "required": true}, {"name": "mongoConn", "label": "Connection String (לא חובה)", "required": false}], "labelTemplate": "{mongoDbName}", "thresholds": [{"name": "majorThreshold", "label": "Major Storage %", "min": 0, "max": 100}, {"name": "criticalThreshold", "label": "Critical Storage %", "min": 0, "max": 100}]},
  {"value": "linux", "label": "Linux Server", "icon": "linux", "metricType": "infrastructure", "fields": [{"name": "serverName", "label": "שם שרת"}], "labelTemplate": "{serverName}", "thresholds": [{"name": "majorThreshold", "label": "CPU Major %", "min": 0, "max": 100}, {"name": "criticalThreshold", "label": "CPU Critical %", "min": 0, "max": 100}]},
  {"value": "windows", "label": "Windows Server", "icon": "windows", "metricType": "infrastructure", "fields": [{"name": "serverName", "label": "שם שרת"}], "labelTemplate": "{serverName}", "thresholds": [{"name": "majorThreshold", "label": "CPU Major %", "min": 0, "max": 100}, {"name": "criticalThreshold", "label": "CPU Critical %", "min": 0, "max": 100}]},
  {"value": "openshift", "label": "OpenShift", "icon": "openshift", "metricType": "infrastructure", "fields": [{"name": "env", "label": "Environment"}, {"name": "namespace", "label": "Namespace"}, {"name": "deployment", "label": "Deployment"}], "labelTemplate": "{deployment}", "thresholds": []},
  {"value": "nfs", "label": "NFS", "icon": "nfs", "metricType": "storage", "fields": [{"name": "folderName", "label": "שם תיקייה"}], "labelTemplate": "{folderName}", "thresholds": [{"name": "majorThreshold", "label": "Major Storage %", "min": 0, "max": 100}, {"name": "criticalThreshold", "label": "Critical Storage %", "min": 0, "max": 100}]},
  {"value": "dp", "label": "DataPower", "icon": "dp", "metricType": "infrastructure", "fields": [{"name": "componentName", "label": "שם רכיב"}], "labelTemplate": "{componentName}", "thresholds": []},
  {"value": "info", "label": "INFO / הערה", "icon": "info", "metricType": "none", "fields": [{"name": "componentName", "label": "כותרת"}], "labelTemplate": "{componentName}", "thresholds": []}
]'''

DEFAULT_ADMINS = '["אריאל", "ירדן", "admin"]'
DEFAULT_ROLES = '{"admins": ["אריאל", "ירדן", "admin"], "editors": ["editor1"]}'
DEFAULT_OCP_ENVS = '{"OS": ["os-namespace1", "os-namespace2"], "NEXT": ["next-namespace1"], "AMRICA": ["amrica-ns1"]}'
DEFAULT_LEARN_URL = "https://neptune-learning.example.com"
DEFAULT_GUIDE_LINKS = '{"theindex": "https://theindex.example.com", "sn": "https://sn.example.com", "faults": "https://faults.example.com", "freakout": "https://freakout.example.com", "tudo": "https://tudo.example.com"}'


class ConfigManager:
    def __init__(self):
        self.etcd_host = os.getenv("ETCD_HOST", "localhost")
        self.etcd_port = int(os.getenv("ETCD_PORT", 2379))
        self.client = None
        try:
            import etcd3
            self.client = etcd3.client(host=self.etcd_host, port=self.etcd_port)
            self.client.status()
            print("Connected to ETCD successfully.")
        except ImportError:
            print("etcd3 library not found. Please run 'pip install etcd3'.")
        except Exception as e:
            self.client = None
            print(f"Failed to connect to ETCD: {e}")

    def get(self, key: str, default: str) -> str:
        if self.client:
            try:
                val, _ = self.client.get(key)
                if val:
                    return val.decode('utf-8')
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = AsyncIOMotorClient(MONGO_DETAILS)
database = client.neptune
rules_collection = database.get_collection("rules")
automations_col = database.get_collection("automations")
folders_col = database.get_collection("automation_folders")


# --- BACKGROUND TASKS ---
async def evaluate_automations_task():
    while True:
        try:
            autos = await automations_col.find({}).to_list(length=None)
            async with httpx.AsyncClient() as client:
                for auto in autos:
                    if not auto.get("is_active", True):
                        continue

                    metric = auto.get("metric_query")
                    op = auto.get("operator", ">")
                    thresh = auto.get("threshold", 0)
                    if not metric: continue

                    full_query = f"{metric} {op} {thresh}"
                    try:
                        res = await client.get(f"{PROMETHEUS_URL}/api/v1/query", params={"query": full_query}, timeout=10.0)
                        data = res.json().get("data", {}).get("result", [])

                        if data:
                            val = data[0].get("value", [0, "0"])[1]
                            code = auto.get("python_code", "")

                            success = False
                            try:
                                exec_env = {
                                    "value": float(val),
                                    "requests": requests,
                                    "json": json,
                                    "subprocess": subprocess
                                }
                                exec(code, exec_env)
                                success = True
                            except Exception as code_e:
                                print(f"Automation execution error [{auto.get('name')}]: {code_e}")

                            if success:
                                new_hist = {
                                    "date": datetime.now().strftime("%d/%m/%Y %H:%M:%S"),
                                    "value": float(val)
                                }
                                await automations_col.update_one(
                                    {"_id": auto["_id"]},
                                    {
                                        "$inc": {"run_count": 1},
                                        "$push": {"history": {"$each": [new_hist], "$slice": -100}}
                                    }
                                )
                    except Exception as e:
                        print(f"Error checking promql for automation {auto.get('name')}: {e}")
        except Exception as e:
            print(f"Automations loop error: {e}")

        await asyncio.sleep(60)


@app.on_event("startup")
async def startup_event():
    asyncio.create_task(evaluate_automations_task())


# --- MODELS ---

class Rule(BaseModel):
    name: str
    team: str
    query: str
    tech: str
    purpose: str # עכשיו שדה חובה
    subType: Optional[str] = "תשתיתי"
    application: Optional[str] = ""
    track_id: Optional[str] = ""
    vhost: Optional[str] = ""
    queueName: Optional[str] = ""
    indexName: Optional[str] = ""
    environment: Optional[str] = ""
    namespace: Optional[str] = ""
    deployment: Optional[str] = ""
    majorThreshold: Optional[int] = None
    criticalThreshold: Optional[int] = None
    storageMajor: Optional[int] = None
    storageCritical: Optional[int] = None
    objectsMajor: Optional[int] = None
    objectsCritical: Optional[int] = None
    redSeverity: Optional[str] = None
    yellowSeverity: Optional[str] = None
    logSeverity: Optional[str] = None
    logThreshold: Optional[int] = None
    thresholdDirection: Optional[str] = ">"
    operationalImpact: Optional[str] = ""
    maktag: Optional[str] = ""
    node: Optional[str] = ""
    user: Optional[str] = "Unknown"
    history: Optional[list] = []


class Architecture(BaseModel):
    nodes: list
    edges: list


class ConfigUpdate(BaseModel):
    teams: list
    apps: list
    techs: list
    admins: list
    roles: dict
    ocp_envs: dict
    learn_url: str
    guide_links: dict


class AutoFolder(BaseModel):
    name: str

class FolderRenameRequest(BaseModel):
    name: str


class Automation(BaseModel):
    folder_id: str
    name: str
    metric_query: str
    operator: str
    threshold: float
    python_code: str
    action_mode: Optional[str] = "python"
    builder_chain: Optional[list] = []
    is_active: Optional[bool] = True


class ServerActionRequest(BaseModel):
    action_type: str
    server: str
    process: Optional[str] = ""
    username: str
    password: str


# --- ENDPOINTS ---

@app.post("/api/server-action")
async def execute_server_action(req: ServerActionRequest):
    if req.action_type == 'restart_process':
        print(f"Executing restart for process '{req.process}' on server '{req.server}' (User: {req.username})")
        return {"status": "success", "message": f"Process {req.process} restarted on {req.server}"}
    elif req.action_type == 'restart_server':
        print(f"Executing server reboot on '{req.server}' (User: {req.username})")
        return {"status": "success", "message": f"Server {req.server} restarted"}
    else:
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
        roles = {"admins": [], "editors": []}

    try:
        legacy_admins = json.loads(config.get("/neptune/frontend/admins", DEFAULT_ADMINS))
    except:
        legacy_admins = []

    safe_user = str(user).strip().lower()

    is_admin = any(str(u).strip().lower() == safe_user for u in roles.get("admins", [])) or \
               any(str(u).strip().lower() == safe_user for u in legacy_admins)

    is_editor = any(str(u).strip().lower() == safe_user for u in roles.get("editors", []))

    if is_admin:
        role = "admin"
    elif is_editor:
        role = "editor"
    else:
        role = "viewer"

    return {"username": user, "role": role}


@app.post("/api/config")
async def update_frontend_config(config_update: ConfigUpdate):
    try:
        import etcd3
        etcd_client = etcd3.client(host=config.etcd_host, port=config.etcd_port)
        etcd_client.put("/neptune/frontend/teams", json.dumps(config_update.teams, ensure_ascii=False).encode('utf-8'))
        etcd_client.put("/neptune/frontend/apps", json.dumps(config_update.apps, ensure_ascii=False).encode('utf-8'))
        etcd_client.put("/neptune/frontend/techs", json.dumps(config_update.techs, ensure_ascii=False).encode('utf-8'))
        etcd_client.put("/neptune/frontend/admins", json.dumps(config_update.admins, ensure_ascii=False).encode('utf-8'))
        etcd_client.put("/neptune/frontend/roles", json.dumps(config_update.roles, ensure_ascii=False).encode('utf-8'))
        etcd_client.put("/neptune/frontend/ocp_envs", json.dumps(config_update.ocp_envs, ensure_ascii=False).encode('utf-8'))
        etcd_client.put("/neptune/frontend/learn_url", config_update.learn_url.encode('utf-8'))
        etcd_client.put("/neptune/frontend/guide_links", json.dumps(config_update.guide_links, ensure_ascii=False).encode('utf-8'))
        return {"status": "success", "message": "התצורות נשמרו ב-ETCD בהצלחה!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/init-etcd")
async def init_etcd():
    try:
        import etcd3
        etcd_client = etcd3.client(host=config.etcd_host, port=config.etcd_port)
        configs = {
            "/neptune/db/mongo_url": "mongodb://localhost:27017",
            "/neptune/monitoring/prometheus_url": "http://localhost:9090",
            "/neptune/monitoring/elastic_url": "http://localhost:9200",
            "/neptune/server/host": "0.0.0.0",
            "/neptune/server/port": "80",
            "/neptune/server/cors_origins": "*",
            "/neptune/frontend/teams": DEFAULT_TEAMS,
            "/neptune/frontend/apps": DEFAULT_APPS,
            "/neptune/frontend/techs": DEFAULT_TECHS,
            "/neptune/frontend/admins": DEFAULT_ADMINS,
            "/neptune/frontend/roles": DEFAULT_ROLES,
            "/neptune/frontend/ocp_envs": DEFAULT_OCP_ENVS,
            "/neptune/frontend/learn_url": DEFAULT_LEARN_URL,
            "/neptune/frontend/guide_links": DEFAULT_GUIDE_LINKS
        }
        for key, value in configs.items():
            etcd_client.put(key, value.encode('utf-8'))
        return {"status": "success", "message": "הגדרות ETCD אופסו ועודכנו בהצלחה. רענן את העמוד."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ETCD Error: {str(e)}")


@app.get("/api/config")
async def get_frontend_config():
    try:
        teams = json.loads(config.get("/neptune/frontend/teams", DEFAULT_TEAMS))
    except:
        teams = json.loads(DEFAULT_TEAMS)
    try:
        apps = json.loads(config.get("/neptune/frontend/apps", DEFAULT_APPS))
    except:
        apps = json.loads(DEFAULT_APPS)
    try:
        techs = json.loads(config.get("/neptune/frontend/techs", DEFAULT_TECHS))
    except:
        techs = json.loads(DEFAULT_TECHS)
    try:
        admins = json.loads(config.get("/neptune/frontend/admins", DEFAULT_ADMINS))
    except:
        admins = json.loads(DEFAULT_ADMINS)
    try:
        roles = json.loads(config.get("/neptune/frontend/roles", DEFAULT_ROLES))
    except:
        roles = json.loads(DEFAULT_ROLES)
    try:
        ocp_envs = json.loads(config.get("/neptune/frontend/ocp_envs", DEFAULT_OCP_ENVS))
    except:
        ocp_envs = json.loads(DEFAULT_OCP_ENVS)
    try:
        guide_links = json.loads(config.get("/neptune/frontend/guide_links", DEFAULT_GUIDE_LINKS))
    except:
        guide_links = json.loads(DEFAULT_GUIDE_LINKS)

    learn_url = config.get("/neptune/frontend/learn_url", DEFAULT_LEARN_URL)
    return {"teams": teams, "apps": apps, "techs": techs, "admins": admins, "roles": roles, "ocp_envs": ocp_envs,
            "learn_url": learn_url, "guide_links": guide_links}


@app.get("/api/download/{tech}")
async def download_tech_zip(tech: str):
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        content = f"Installation instructions and configuration files for {tech.upper()}...\nEnjoy using NeptuneManager!"
        zip_file.writestr(f"install_{tech}.txt", content)
    headers = {'Content-Disposition': f'attachment; filename="install_{tech}.zip"'}
    return Response(zip_buffer.getvalue(), media_type="application/zip", headers=headers)


class OCPRequest(BaseModel):
    cluster: str
    target_user: str
    target_password: str


@app.post("/api/ocp/grant")
async def grant_ocp_permissions(req: OCPRequest):
    ocp_envs_str = config.get("/neptune/frontend/ocp_envs", DEFAULT_OCP_ENVS)
    ocp_envs = json.loads(ocp_envs_str)
    namespaces = ocp_envs.get(req.cluster, [])

    log_output = []
    log_output.append(f"Starting authorization process for {req.target_user} on cluster: {req.cluster}...")
    try:
        log_output.append(f"Successfully authenticated as Admin (userhazak).")
        for ns in namespaces:
            log_output.append(f"Granted 'admin' role to '{req.target_user}' in namespace '{ns}'.")
    except Exception as e:
        log_output.append(f"Error executing oc commands: {str(e)}")
        return {"status": "error", "log": log_output}

    log_output.append("Process completed successfully.")
    return {"status": "success", "log": log_output}


@app.get("/rules")
async def get_all_rules():
    cursor = rules_collection.find({})
    rules = await cursor.to_list(length=None)
    formatted_rules = []
    for rule in rules:
        rule["id"] = str(rule["_id"])
        del rule["_id"]
        formatted_rules.append(rule)
    return formatted_rules


@app.post("/rules")
async def create_new_rule(rule: Rule):
    new_rule_dict = rule.model_dump()
    history_entry = {
        "user": new_rule_dict.get("user", "Unknown"),
        "date": datetime.now().strftime("%d/%m/%Y %H:%M"),
        "version": 1,
        "query": new_rule_dict.get("query", ""),
        "node": new_rule_dict.get("node", ""),
        "tech": new_rule_dict.get("tech", "")
    }
    new_rule_dict["history"] = [history_entry]
    result = await rules_collection.insert_one(new_rule_dict)
    new_rule_dict["id"] = str(result.inserted_id)
    if "_id" in new_rule_dict:
        del new_rule_dict["_id"]
    return new_rule_dict


class BulkDeleteRequest(BaseModel):
    ids: List[str]


@app.post("/rules/bulk-delete")
async def bulk_delete_rules(req: BulkDeleteRequest):
    try:
        obj_ids = [ObjectId(id) for id in req.ids if len(id) == 24]
        await rules_collection.delete_many({"_id": {"$in": obj_ids}})
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/architecture/{team_id}/{track_id}")
async def delete_track_architecture(team_id: str, track_id: str):
    await database.get_collection("architectures").delete_one({"team_id": team_id, "track_id": track_id})
    return {"status": "success"}


@app.post("/architecture/{team_id}/{track_id}")
async def save_architecture(team_id: str, track_id: str, arch: Architecture):
    arch_dict = arch.model_dump()
    arch_dict["team_id"] = team_id
    arch_dict["track_id"] = track_id
    await database.get_collection("architectures").update_one(
        {"team_id": team_id, "track_id": track_id},
        {"$set": arch_dict},
        upsert=True
    )
    return {"message": "Architecture saved successfully"}


@app.get("/architecture/{team_id}/{track_id}")
async def get_architecture(team_id: str, track_id: str):
    doc = await database.get_collection("architectures").find_one({"team_id": team_id, "track_id": track_id})
    if doc:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
        return doc
    return {"team_id": team_id, "track_id": track_id, "nodes": [], "edges": []}


@app.get("/architecture/{team_id}")
async def get_team_architecture(team_id: str):
    cursor = database.get_collection("architectures").find({"team_id": team_id})
    docs = await cursor.to_list(length=None)
    all_nodes = []
    all_edges = []
    for doc in docs:
        all_nodes.extend(doc.get("nodes", []))
        all_edges.extend(doc.get("edges", []))
    return {"team_id": team_id, "nodes": all_nodes, "edges": all_edges}


@app.put("/rules/{rule_id}")
async def update_rule(rule_id: str, rule_data: Rule):
    try:
        obj_id = ObjectId(rule_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid ID format")

    existing_rule = await rules_collection.find_one({"_id": obj_id})
    if not existing_rule: raise HTTPException(status_code=404, detail="Rule not found")

    last_version = existing_rule.get("history", [{"version": 0}])[-1]["version"]
    new_history_entry = {
        "user": rule_data.user,
        "date": datetime.now().strftime("%d/%m/%Y %H:%M"),
        "version": last_version + 1,
        "query": rule_data.query,
        "node": rule_data.node,
        "tech": rule_data.tech
    }

    update_content = rule_data.model_dump(exclude={"user", "history"})
    result = await rules_collection.update_one(
        {"_id": obj_id},
        {"$set": update_content, "$push": {"history": new_history_entry}}
    )

    updated_doc = await rules_collection.find_one({"_id": obj_id})
    updated_doc["id"] = str(updated_doc["_id"])
    del updated_doc["_id"]
    return updated_doc


@app.delete("/rules/{rule_id}")
async def delete_rule(rule_id: str):
    try:
        obj_id = ObjectId(rule_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid ID format")
    await rules_collection.delete_one({"_id": obj_id})
    return {"message": "Rule deleted successfully"}


class PromQLCheckRequest(BaseModel):
    query: str


@app.post("/check_promql")
async def check_promql(request: PromQLCheckRequest):
    parts = re.split(r'\s+or\s+', request.query)

    async def check_part(client, original_part):
        stripped_part = original_part.strip()
        if stripped_part.startswith('(') and stripped_part.endswith(')'):
            stripped_part = stripped_part[1:-1].strip()
        stripped_part = re.sub(r'\s*(?:>=|<=|>|<|==|!=)\s*\d+(?:\.\d+)?\s*$', '', stripped_part)
        try:
            res = await client.get(f"{PROMETHEUS_URL}/api/v1/query", params={"query": stripped_part}, timeout=5.0)
            res.raise_for_status()
            if len(res.json().get("data", {}).get("result", [])) == 0:
                return original_part.strip()
            return None
        except Exception:
            return original_part.strip()

    try:
        async with httpx.AsyncClient() as client:
            tasks = [check_part(client, part) for part in parts]
            results = await asyncio.gather(*tasks)
            failing_parts = [r for r in results if r is not None]

            if len(failing_parts) == len(parts):
                return {"status": "error", "has_data": False, "failing_parts": failing_parts}
            elif len(failing_parts) > 0:
                return {"status": "partial", "has_data": True, "failing_parts": failing_parts}
            else:
                return {"status": "success", "has_data": True, "failing_parts": []}
    except Exception as e:
        return {"status": "error", "has_data": False, "detail": str(e), "failing_parts": [p.strip() for p in parts]}


class ElasticCheckRequest(BaseModel):
    index: str
    query: str


@app.post("/check_elastic")
async def check_elastic(request: ElasticCheckRequest):
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{ELASTIC_URL}/{request.index}/_search",
                                        params={"q": request.query, "size": 0}, timeout=5.0)
            response.raise_for_status()
            total_hits = response.json().get("hits", {}).get("total", 0)
            count = total_hits.get("value", 0) if isinstance(total_hits, dict) else total_hits
            return {"status": "success", "count": count}
    except Exception as e:
        return {"status": "error", "count": 0, "detail": str(e)}


class PromQLGraphRequest(BaseModel):
    query: str
    start_time: Optional[int] = None
    end_time: Optional[int] = None


@app.post("/promql_graph")
async def get_promql_graph(request: PromQLGraphRequest):
    try:
        end_t = request.end_time if request.end_time else int(time.time())
        start_t = request.start_time if request.start_time else end_t - 3600
        duration_seconds = end_t - start_t
        step = max(15, duration_seconds // 300)

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{PROMETHEUS_URL}/api/v1/query_range",
                params={"query": request.query, "start": start_t, "end": end_t, "step": f"{step}s"},
                timeout=30.0
            )
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
    cursor = folders_col.find({})
    folders = await cursor.to_list(length=None)
    for f in folders:
        f["id"] = str(f.pop("_id"))
    return folders


@app.post("/api/automations/folders")
async def create_auto_folder(f: AutoFolder):
    res = await folders_col.insert_one(f.model_dump())
    return {"id": str(res.inserted_id), "name": f.name}


@app.put("/api/automations/folders/{f_id}")
async def rename_auto_folder(f_id: str, req: FolderRenameRequest):
    await folders_col.update_one({"_id": ObjectId(f_id)}, {"$set": {"name": req.name}})
    return {"status": "success"}


@app.delete("/api/automations/folders/{f_id}")
async def delete_auto_folder(f_id: str):
    await folders_col.delete_one({"_id": ObjectId(f_id)})
    await automations_col.delete_many({"folder_id": f_id})
    return {"status": "success"}


@app.get("/api/automations")
async def get_automations():
    cursor = automations_col.find({})
    autos = await cursor.to_list(length=None)
    for a in autos:
        a["id"] = str(a.pop("_id"))
    return autos


@app.post("/api/automations")
async def create_automation(a: Automation):
    doc = a.model_dump()
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


class AutoTestRequest(BaseModel):
    python_code: str


@app.post("/api/automations/test")
async def test_automation(req: AutoTestRequest):
    old_stdout = sys.stdout
    redirected_output = sys.stdout = StringIO()
    try:
        exec_env = {
            "value": 100.0,
            "requests": requests,
            "json": json,
            "subprocess": subprocess
        }
        exec(req.python_code, exec_env)
        output = redirected_output.getvalue()
        return {"status": "success", "output": output}
    except Exception as e:
        error_msg = traceback.format_exc()
        return {"status": "error", "output": error_msg}
    finally:
        sys.stdout = old_stdout


if __name__ == "__main__":
    uvicorn.run(app, host=SERVER_HOST, port=SERVER_PORT)