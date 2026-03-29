import React, { useState, useRef, useCallback, useEffect, createContext, useContext } from 'react';
import axios from 'axios';
import { 
  ReactFlow, ReactFlowProvider, addEdge, useNodesState, useEdgesState, 
  Controls, Handle, Position, useReactFlow, MarkerType, BaseEdge, getStraightPath
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Paper, Group, Text, Image, Stack, ActionIcon, Tooltip, Modal, Select, Button, TextInput, NumberInput, Code, Badge, Loader, Grid, Textarea, Title, ScrollArea, SimpleGrid, Menu, Drawer, Divider } from '@mantine/core';
import { IconTrash, IconLink, IconUnlink, IconActivity, IconDeviceFloppy, IconArrowsRightLeft, IconServer, IconAppWindow, IconPlus, IconSettings, IconInfoCircle, IconFileDescription, IconAlertCircle, IconCode, IconSend, IconBorderAll, IconTrashX, IconExternalLink } from '@tabler/icons-react';
import { API_BASE_URL } from '../config';

import mongoIcon from '../assets/iconsTech/mongo.png';
import elasticIcon from '../assets/iconsTech/elastic.png';
import dpIcon from '../assets/iconsTech/datapower.png';
import s3Icon from '../assets/iconsTech/s3.png';
import rabbitIcon from '../assets/iconsTech/rabbit.png';
import serverIcon from '../assets/iconsTech/server.png';
import nfsIcon from '../assets/iconsTech/nfs.png';
import windowsIcon from '../assets/iconsTech/windows.png';
import linuxIcon from '../assets/iconsTech/linux.png';
import openshiftIcon from '../assets/iconsTech/openshift.png';
import infoIcon from '../assets/iconsTech/info.png';
import kafkaIcon from '../assets/iconsTech/kafka.png';
import nifiIcon from '../assets/iconsTech/nifi.png';

import iconLogs from '../assets/iconNitur/logs.webp';
import iconMessages from '../assets/iconNitur/messages.png';
import iconStorage from '../assets/iconNitur/storage.png';
import iconCustom from '../assets/iconNitur/custom.png';
import elasticLogsIcon from '../assets/iconsTech/elasticLogs.png'; 

const CanvasContext = createContext(null);

const techIconMap = {
  mongo: mongoIcon, elastic: elasticIcon, dp: dpIcon, s3: s3Icon, rabbit: rabbitIcon, server: serverIcon, 
  nfs: nfsIcon, windows: windowsIcon, linux: linuxIcon, openshift: openshiftIcon, info: infoIcon, 
  kafka: kafkaIcon, nifi: nifiIcon
};

const getNiturIcon = (rule) => {
    if (rule.tech === 'elastic_log') return iconLogs;
    if (rule.tech === 'CUSTOM') return iconCustom;
    if (['rabbit', 'nifi'].includes(rule.tech)) return iconMessages;
    return iconStorage;
};

const getIconsForNode = (data) => {
    const icons = [];
    (data.rules || []).forEach(r => {
        icons.push({ src: getNiturIcon(r), name: r.name, rule: r });
    });
    if (['rabbit', 'nifi'].includes(data.tech) && data.majorThreshold !== undefined) {
        icons.push({ src: iconMessages, name: `הגדרות ספים - הודעות`, isThreshold: true });
    }
    if (['mongo', 'nfs'].includes(data.tech) && data.majorThreshold !== undefined) {
        icons.push({ src: iconStorage, name: `הגדרות ספים - אחסון`, isThreshold: true });
    }
    if (data.tech === 's3' && data.storageMajor !== undefined) {
        icons.push({ src: iconStorage, name: `הגדרות ספים - S3`, isThreshold: true });
    }
    if (['linux', 'windows', 'kafka'].includes(data.tech) && data.majorThreshold !== undefined) {
        icons.push({ src: iconStorage, name: `הגדרות ספים - ${data.tech}`, isThreshold: true });
    }
    return icons;
};

const CustomCenterEdge = ({ id, sourceX, sourceY, targetX, targetY, style, markerEnd }) => {
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const length = Math.sqrt(dx * dx + dy * dy);
  const targetPullback = 65; 
  let finalTargetX = targetX;
  let finalTargetY = targetY;
  
  if (length > targetPullback) {
      const ratio = (length - targetPullback) / length;
      finalTargetX = sourceX + dx * ratio;
      finalTargetY = sourceY + dy * ratio;
  }

  const [edgePath] = getStraightPath({
      sourceX,
      sourceY,
      targetX: finalTargetX,
      targetY: finalTargetY,
  });

  return <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />;
};

const edgeTypes = { centerEdge: CustomCenterEdge };

const TechNode = ({ id, data, selected }) => {
  const iconSrc = techIconMap[data.tech] || techIconMap.server;
  const { setNodes } = useReactFlow(); 
  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState(data.label);
  const { openNodeRules, handleNodeLabelChange, handleIconClick, userRole, openDocDrawer } = useContext(CanvasContext) || {};

  const finishEditing = () => {
    setIsEditing(false);
    if (label !== data.label) {
        if (handleNodeLabelChange) handleNodeLabelChange(id, label);
    }
  };

  const isConnecting = data.isConnecting; 
  const hasDocs = !!data.documentation || !!data.links;
  const nodeIcons = getIconsForNode(data);
  const isHighlighted = data.isHighlighted; 

  const diffStatus = data.diffStatus;
  const diffBorder = diffStatus === 'added' ? '3px solid #40c057' : (diffStatus === 'removed' ? '3px dashed #fa5252' : undefined);
  const diffBg = diffStatus === 'added' ? '#ebfbee' : (diffStatus === 'removed' ? '#ffe3e3' : undefined);
  const diffOpacity = diffStatus === 'removed' ? 0.6 : 1;

  const defaultBorder = isHighlighted ? '3px solid #40c057' : (selected ? '3px solid #fa5252' : (isConnecting ? '3px solid #339af0' : '1px solid #dee2e6'));
  const defaultBg = isConnecting ? '#e7f5ff' : (data.tech === 'info' ? '#fff9db' : 'white');
  const highlightBoxShadow = isHighlighted ? '0 0 0 6px rgba(64, 192, 87, 0.4), 0 0 20px rgba(64, 192, 87, 0.8)' : undefined;

  const displayLabel = data.tech === 'openshift' ? (data.deployment || data.label) : data.label;

  return (
    <div 
      style={{ 
        background: diffBg || defaultBg, width: 110, height: 110, borderRadius: '50%', 
        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
        textAlign: 'center', direction: 'rtl', position: 'relative',
        border: diffBorder || defaultBorder,
        opacity: diffOpacity,
        boxShadow: highlightBoxShadow || (selected ? '0 0 15px rgba(250, 82, 82, 0.5)' : (isConnecting ? '0 0 15px rgba(51, 154, 240, 0.5)' : '0 4px 6px rgba(0,0,0,0.1)')),
        transition: 'all 0.4s ease'
      }}
    >
      <Handle type="target" position={Position.Top} style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0, zIndex: -1 }} />
      <Handle type="source" position={Position.Bottom} style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0, zIndex: -1 }} />

      <Stack align="center" gap={4} style={{ width: '80%' }}>
        <Image src={iconSrc} w={28} h={28} fit="contain" />
        {isEditing ? (
          <TextInput 
            value={label} onChange={(e) => setLabel(e.currentTarget.value)} 
            onBlur={finishEditing} onKeyDown={(e) => e.key === 'Enter' && finishEditing()} 
            autoFocus size="xs" radius="xl"
            styles={{ input: { textAlign: 'center', fontWeight: 'bold', fontSize: '10px', padding: '0 4px', height: '24px', minHeight: '24px' } }}
          />
        ) : (
          <Text 
            size={data.tech === 'info' ? "10px" : "xs"} 
            fw={data.tech === 'info' ? 500 : 700} 
            c={data.tech === 'info' ? "dimmed" : "dark"} 
            onClick={() => {
                if(diffStatus !== 'removed' && userRole !== 'viewer') {
                    setIsEditing(true);
                }
            }} 
            style={{ cursor: diffStatus === 'removed' || userRole === 'viewer' ? 'default' : 'pointer', padding: '2px 4px', borderRadius: '4px', '&:hover': { backgroundColor: '#f1f3f5' }, lineHeight: 1.1, wordBreak: 'break-word' }}
          >
            {displayLabel}
          </Text>
        )}
      </Stack>

      <div style={{ position: 'absolute', top: -5, right: -5, display: 'flex', gap: '4px', flexWrap: 'wrap', maxWidth: '120px', zIndex: 10 }}>
        {hasDocs && (
          <Tooltip label="קיים תיעוד מורחב (לחץ לקריאה)" withArrow position="top">
             <ActionIcon size="sm" color="orange" variant="light" radius="xl" style={{ border: '1px solid #ff922b', backgroundColor: 'white' }} onClick={(e) => { e.stopPropagation(); if (openDocDrawer) openDocDrawer(id); }}>
               <IconFileDescription size={14} />
             </ActionIcon>
          </Tooltip>
        )}
        {nodeIcons.map((ic, idx) => (
          <Tooltip key={idx} label={ic.name} withArrow position="top">
            <div 
              onClick={(e) => { 
                e.stopPropagation(); 
                if (handleIconClick) handleIconClick(id, ic); 
                else if (openNodeRules) openNodeRules(id); 
              }}
              style={{ width: 22, height: 22, borderRadius: '50%', border: '1px solid #dee2e6', backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px', cursor: 'pointer' }}
            >
              <Image src={ic.src} w={16} h={16} />
            </div>
          </Tooltip>
        ))}
      </div>
    </div>
  );
};

const nodeTypes = { techNode: TechNode };
let globalId = 0;
const getId = () => `node_${Date.now()}_${globalId++}`; 

export default function ArchitectureCanvas({ team, track, rules = [], onRuleAdded, username, sysConfig, userRole, focusedNodeId }) {
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [shiftPressed, setShiftPressed] = useState(false);
  
  const techDefinitions = sysConfig?.techs || [];

  const [pendingNodeConfig, setPendingNodeConfig] = useState(null);
  const [nodeForm, setNodeForm] = useState({});
  const [thresholdNode, setThresholdNode] = useState(null);
  const [thresholdTechConfig, setThresholdTechConfig] = useState(null);
  const [thresholds, setThresholds] = useState({});

  const [graphData, setGraphData] = useState([]);
  const [isGraphLoading, setIsGraphLoading] = useState(false);
  const [graphStartTime, setGraphStartTime] = useState('');
  const [graphEndTime, setGraphEndTime] = useState('');
  const [hoverPoint, setHoverPoint] = useState(null); 
  const [zoomRange, setZoomRange] = useState(null); 
  const [selectionStart, setSelectionStart] = useState(null); 
  const [selectionEnd, setSelectionEnd] = useState(null); 
  const [isSelecting, setIsSelecting] = useState(false);

  const [contextMenu, setContextMenu] = useState(null);
  const [connectingSourceId, setConnectingSourceId] = useState(null);
  const [editNodeData, setEditNodeData] = useState(null);
  
  const [docDrawerNodeId, setDocDrawerNodeId] = useState(null);
  const docDrawerNode = nodes.find(n => n.id === docDrawerNodeId);

  const [customRuleModalOpen, setCustomRuleModalOpen] = useState(false);
  const [customRuleForm, setCustomRuleForm] = useState({ name: '', purpose: '', query: '', subType: 'תשתיתי' });
  const [selectedNodeId, setSelectedNodeId] = useState(null);

  const [elasticLogsModalOpen, setElasticLogsModalOpen] = useState(false);
  const [selectedElasticNode, setSelectedElasticNode] = useState(null);
  const [logIndex, setLogIndex] = useState('');
  const [logForm, setLogForm] = useState({ ruleName: '', query: '', impact: '', direction: '>', value: 100, severity: 'major', maktag: '' });
  const [isQueryModalOpen, setIsQueryModalOpen] = useState(false);
  const [jsonValidationMsg, setJsonValidationMsg] = useState(null);
  const [selectedLogCircle, setSelectedLogCircle] = useState(null);
  const [kqlInput, setKqlInput] = useState(''); 

  const [rulesModalNodeId, setRulesModalNodeId] = useState(null);
  const rulesModalNode = nodes.find(n => n.id === rulesModalNodeId);

  const [isDraftDirty, setIsDraftDirty] = useState(false);
  const [draftModalOpen, setDraftModalOpen] = useState(false);
  const [draftDesc, setDraftDesc] = useState('');
  
  const [pendingRequests, setPendingRequests] = useState([]);
  const [reviewMode, setReviewMode] = useState({ active: false, reqId: null, originalNodes: [], originalEdges: [] });

  const [originalNodeIds, setOriginalNodeIds] = useState([]);

  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === 'Shift') setShiftPressed(true); };
    const handleKeyUp = (e) => { if (e.key === 'Shift') setShiftPressed(false); };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
  }, []);

  useEffect(() => {
    if (!team || !track) return;
    axios.get(`${API_BASE_URL}/architecture/${team.id}/${track.id}`).then(async res => {
        const loadedNodes = res.data.nodes || [];
        setNodes(loadedNodes); 
        setOriginalNodeIds(loadedNodes.map(n => n.id));

        const loadedEdges = (res.data.edges || []).map(e => ({
            ...e, type: 'centerEdge',
            markerEnd: { type: MarkerType.ArrowClosed, color: e.style?.stroke || '#1c7ed6', width: 15, height: 15 },
            style: e.style || { stroke: '#1c7ed6', strokeWidth: 3 }
        }));
        setEdges(loadedEdges);

        if (userRole !== 'viewer') {
            try {
                const rulesRes = await axios.get(`${API_BASE_URL}/rules`);
                const allRules = rulesRes.data;
                const validIds = loadedNodes.map(n => n.id);
                const orphans = allRules.filter(r => r.track_id === track.id && r.node && !validIds.includes(r.node));
                if (orphans.length > 0) {
                    await Promise.all(orphans.map(o => axios.delete(`${API_BASE_URL}/rules/${o.id}`)));
                    if (onRuleAdded) onRuleAdded();
                }
            } catch (e) {}
        }
    });

    const localReqs = JSON.parse(localStorage.getItem(`reqs_${team.id}_${track.id}`) || '[]');
    setPendingRequests(localReqs);
  }, [team, track]);

  useEffect(() => {
      if (!reactFlowInstance || nodes.length === 0 || !focusedNodeId) return;

      let targetNodeId = null;
      if (typeof focusedNodeId === 'string') {
          targetNodeId = focusedNodeId;
      } else if (focusedNodeId.tech) {
          const n = nodes.find(nd => nd.data.tech === focusedNodeId.tech);
          if (n) targetNodeId = n.id;
      }

      if (targetNodeId) {
          setNodes(nds => nds.map(n => n.id === targetNodeId ? { ...n, data: { ...n.data, isHighlighted: true } } : n));
          setTimeout(() => reactFlowInstance.fitView({ nodes: [{ id: targetNodeId }], duration: 1200, maxZoom: 1.5 }), 300);
          setTimeout(() => setNodes(nds => nds.map(n => n.id === targetNodeId ? { ...n, data: { ...n.data, isHighlighted: false } } : n)), 4000);
      }
  }, [focusedNodeId, reactFlowInstance]); 

  const openThresholdModalForNode = useCallback((node) => {
    const techConf = techDefinitions.find(t => t.value === node.data.tech);
    if(techConf && techConf.thresholds && techConf.thresholds.length > 0) {
       setThresholdTechConfig(techConf);
       setThresholdNode(node);
       let currentThresholds = {};
       techConf.thresholds.forEach(t => { 
          if (node.data[t.name] !== undefined) {
             currentThresholds[t.name] = node.data[t.name];
          } else {
             const isCritical = t.name.toLowerCase().includes('critical');
             const isMessages = techConf.metricType === 'messages';
             currentThresholds[t.name] = isMessages ? (isCritical ? 10000 : 1000) : (isCritical ? 97 : 85);
          }
       });
       setThresholds(currentThresholds);
       
       const now = new Date();
       const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
       const toLocalISO = (d) => (new Date(d - (new Date()).getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
       setGraphStartTime(toLocalISO(oneHourAgo)); setGraphEndTime(toLocalISO(now));
    } else {
       alert("אין ספים גנריים מוגדרים לטכנולוגיה זו ב-ETCD.");
    }
    setRulesModalNodeId(null);
  }, [techDefinitions]);

  const handleIconClick = useCallback((nodeId, iconData) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    if (iconData.rule && iconData.rule.tech === 'elastic_log') {
        setSelectedLogCircle(iconData.rule);
    } else if (iconData.isThreshold) {
        openThresholdModalForNode(node);
    } else {
        setRulesModalNodeId(nodeId);
    }
  }, [nodes, openThresholdModalForNode]);

  useEffect(() => {
    if (!thresholdNode || ['dp', 'server', 'elastic', 'openshift', 'info'].includes(thresholdNode.data.tech)) {
      setGraphData([]); setHoverPoint(null); setZoomRange(null); return;
    }

    const fetchLiveGraph = async () => {
      setIsGraphLoading(true); setZoomRange(null); 
      let promQLQuery = "";
      const lbl = thresholdNode.data.label;
      if (thresholdNode.data.tech === 'rabbit') promQLQuery = `rabbitmq_messages_ready_total{queue="${thresholdNode.data.queue || lbl}", vhost="${thresholdNode.data.vhost || '/'}"}`;
      else if (thresholdNode.data.tech === 'mongo') promQLQuery = `mongodb_storage{storage="${lbl}"}`;
      else if (thresholdNode.data.tech === 'nfs') promQLQuery = `nfs_storage{name="${lbl}"}`;
      else if (thresholdNode.data.tech === 's3') promQLQuery = `s3_storage{user_id="${lbl}"}`; 
      else if (thresholdNode.data.tech === 'nifi') promQLQuery = `nifi_amount_files_in_queue{component="${lbl}"}`;
      else if (['linux', 'windows'].includes(thresholdNode.data.tech)) promQLQuery = `${thresholdNode.data.tech}_cpu_usage{server="${lbl}"}`;
      else if (thresholdNode.data.tech === 'kafka') promQLQuery = `kafka_consumer_lag{cluster="${lbl}"}`;
      
      try {
        if(!promQLQuery) return;
        const payload = { query: promQLQuery };
        if (graphStartTime && graphEndTime) {
            payload.start_time = Math.floor(new Date(graphStartTime).getTime() / 1000);
            payload.end_time = Math.floor(new Date(graphEndTime).getTime() / 1000);
        }
        const res = await axios.post(`${API_BASE_URL}/promql_graph`, payload);
        setGraphData(res.data.data || []);
      } catch (error) {} finally { setIsGraphLoading(false); }
    };

    fetchLiveGraph();
  }, [thresholdNode, graphStartTime, graphEndTime]);

  const onNodeDrag = useCallback((event, node) => {
    if (!shiftPressed) return;
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === node.id) {
          let newX = node.position.x;
          let newY = node.position.y;
          const otherNodes = nds.filter((on) => on.id !== node.id);
          otherNodes.forEach((o) => {
            if (Math.abs(o.position.x - node.position.x) < 30) newX = o.position.x;
            if (Math.abs(o.position.y - node.position.y) < 30) newY = o.position.y;
          });
          return { ...n, position: { x: newX, y: newY } };
        }
        return n;
      })
    );
  }, [shiftPressed, setNodes]);

  const onNodesChangeWithDraft = useCallback((changes) => {
      const isRealChange = changes.some(c => c.type === 'add' || c.type === 'remove' || (c.type === 'position' && c.dragging));
      if (userRole === 'viewer' && isRealChange) setIsDraftDirty(true);
      onNodesChange(changes);
  }, [onNodesChange, userRole]);

  const onEdgesChangeWithDraft = useCallback((changes) => {
      const isRealChange = changes.some(c => c.type === 'add' || c.type === 'remove');
      if (userRole === 'viewer' && isRealChange) setIsDraftDirty(true);
      onEdgesChange(changes);
  }, [onEdgesChange, userRole]);

  const submitDraftRequest = () => {
      const newReq = { id: Date.now().toString(), desc: draftDesc, user: username, nodes, edges, date: new Date().toLocaleString() };
      const currentReqs = JSON.parse(localStorage.getItem(`reqs_${team.id}_${track.id}`) || '[]');
      currentReqs.push(newReq);
      localStorage.setItem(`reqs_${team.id}_${track.id}`, JSON.stringify(currentReqs));
      setPendingRequests(currentReqs);
      
      setDraftModalOpen(false);
      setIsDraftDirty(false);
      alert('הבקשה נשלחה בהצלחה למנהל המערכת!');
  };

  const handleSaveArchitecture = async (overrideNodes = null, overrideEdges = null) => {
    if(userRole === 'viewer') return; 
    setIsSaving(true);
    try {
        const finalNodes = overrideNodes || nodes;
        await axios.post(`${API_BASE_URL}/architecture/${team.id}/${track.id}`, { nodes: finalNodes, edges: overrideEdges || edges });
        const res = await axios.get(`${API_BASE_URL}/architecture/${team.id}`);
        const allTeamNodes = res.data.nodes || [];
        
        const thresholdTechs = ['rabbit', 'mongo', 's3', 'nifi', 'nfs', 'linux', 'windows', 'kafka'];
        for (const t of thresholdTechs) {
            await rebuildGenericRulesForApp(team.id, allTeamNodes, t);
        }

        if(onRuleAdded) onRuleAdded();
        alert('הארכיטקטורה נשמרה בהצלחה והחוקים הגנריים עודכנו לכל הצוות!');
    } catch(e) { alert('שגיאה בשמירה'); } 
    finally { setIsSaving(false); }
  };

  const triggerAutoSave = (updatedNodes, updatedEdges) => {
    if(userRole !== 'viewer') {
        axios.post(`${API_BASE_URL}/architecture/${team.id}/${track.id}`, { nodes: updatedNodes, edges: updatedEdges });
    }
  };

  const rebuildGenericRulesForApp = async (appName, currentNodes, tech) => {
    if (!appName) return;
    const appNodes = currentNodes.filter(n => n.data.tech === tech);
    let currentRules = [];
    try { const res = await axios.get(`${API_BASE_URL}/rules`); currentRules = res.data; } catch(e) {}

    let purposeText = tech === 'rabbit' ? `ניטור הודעות גנרי עבור צוות ${appName}` : `ניצול אחסון גנרי עבור צוות ${appName} בטכנולוגיה ${tech}`;
    if (['linux', 'windows', 'kafka', 'nifi'].includes(tech)) {
        purposeText = `ניצול משאבים/ביצועים גנרי עבור צוות ${appName} בטכנולוגיה ${tech}`;
    }

    const saveRule = async (name, query, additionalPurpose) => {
        const existingRules = currentRules.filter(r => r.name === name);
        if (!query) { 
            for (const r of existingRules) { if (r.id) await axios.delete(`${API_BASE_URL}/rules/${r.id}`); }
            return; 
        }
        
        const fullPurpose = `${purposeText} - ${additionalPurpose}`;
        const payload = { name, tech, team: team.name, application: appName, query, purpose: fullPurpose, subType: 'אפליקטיבי', user: username };
        
        if (existingRules.length > 0) {
            await axios.put(`${API_BASE_URL}/rules/${existingRules[0].id}`, payload);
            for (let i = 1; i < existingRules.length; i++) {
                if (existingRules[i].id) await axios.delete(`${API_BASE_URL}/rules/${existingRules[i].id}`);
            }
        } else {
            await axios.post(`${API_BASE_URL}/rules`, payload);
        }
    };

    if (tech === 'rabbit') {
      const validNodes = appNodes.filter(n => n.data.majorThreshold !== undefined);
      const majorQ = validNodes.map(n => `rabbitmq_messages_ready_total{queue="${n.data.queue || n.data.label}", vhost="${n.data.vhost || '/'}"} >= ${n.data.majorThreshold}`).join('\n  or \n');
      const critQ = validNodes.map(n => `rabbitmq_messages_ready_total{queue="${n.data.queue || n.data.label}", vhost="${n.data.vhost || '/'}"} >= ${n.data.criticalThreshold}`).join('\n  or \n');
      await saveRule(`neptune_generic_rabbitmq_${appName}_major`, majorQ, `התראות Major`);
      await saveRule(`neptune_generic_rabbitmq_${appName}_critical`, critQ, `התראות Critical`);
    } else if (tech === 'nifi') {
      const validNodes = appNodes.filter(n => n.data.majorThreshold !== undefined);
      const majorQ = validNodes.map(n => `nifi_amount_files_in_queue{component="${n.data.label}"} >= ${n.data.majorThreshold}`).join('\n  or \n');
      const critQ = validNodes.map(n => `nifi_amount_files_in_queue{component="${n.data.label}"} >= ${n.data.criticalThreshold}`).join('\n  or \n');
      await saveRule(`neptune_generic_nifi_${appName}_major`, majorQ, `התראות Major`);
      await saveRule(`neptune_generic_nifi_${appName}_critical`, critQ, `התראות Critical`);
    } else if (tech === 'mongo') {
      const validNodes = appNodes.filter(n => n.data.majorThreshold !== undefined);
      const majorQ = validNodes.map(n => `mongodb_storage{storage="${n.data.label}"} >= ${n.data.majorThreshold}`).join('\n  or \n');
      const critQ = validNodes.map(n => `mongodb_storage{storage="${n.data.label}"} >= ${n.data.criticalThreshold}`).join('\n  or \n');
      await saveRule(`neptune_generic_mongo_${appName}_major`, majorQ, `התראות Major`);
      await saveRule(`neptune_generic_mongo_${appName}_critical`, critQ, `התראות Critical`);
    } else if (tech === 's3') {
      const validNodes = appNodes.filter(n => n.data.storageMajor !== undefined);
      const sMajorQ = validNodes.map(n => `s3_storage{user_id="${n.data.label}"} >= ${n.data.storageMajor}`).join('\n  or \n');
      const sCritQ = validNodes.map(n => `s3_storage{user_id="${n.data.label}"} >= ${n.data.storageCritical}`).join('\n  or \n');
      const oMajorQ = validNodes.map(n => `s3_storage_objects{user_id="${n.data.label}"} >= ${n.data.objectsMajor}`).join('\n  or \n');
      const oCritQ = validNodes.map(n => `s3_storage_objects{user_id="${n.data.label}"} >= ${n.data.objectsCritical}`).join('\n  or \n');
      await saveRule(`neptune_generic_s3_storage_${appName}_major`, sMajorQ, `S3 Storage Major`);
      await saveRule(`neptune_generic_s3_storage_${appName}_critical`, sCritQ, `S3 Storage Critical`);
      await saveRule(`neptune_generic_s3_objects_${appName}_major`, oMajorQ, `S3 Objects Major`);
      await saveRule(`neptune_generic_s3_objects_${appName}_critical`, oCritQ, `S3 Objects Critical`);
    } else if (tech === 'nfs') {
      const validNodes = appNodes.filter(n => n.data.majorThreshold !== undefined);
      const majorQ = validNodes.map(n => `nfs_storage{name="${n.data.label}"} >= ${n.data.majorThreshold}`).join('\n  or \n');
      const critQ = validNodes.map(n => `nfs_storage{name="${n.data.label}"} >= ${n.data.criticalThreshold}`).join('\n  or \n');
      await saveRule(`neptune_generic_nfs_${appName}_major`, majorQ, `התראות Major`);
      await saveRule(`neptune_generic_nfs_${appName}_critical`, critQ, `התראות Critical`);
    } else if (tech === 'linux' || tech === 'windows') {
      const validNodes = appNodes.filter(n => n.data.majorThreshold !== undefined);
      const majorQ = validNodes.map(n => `${tech}_cpu_usage{server="${n.data.label}"} >= ${n.data.majorThreshold}`).join('\n  or \n');
      const critQ = validNodes.map(n => `${tech}_cpu_usage{server="${n.data.label}"} >= ${n.data.criticalThreshold}`).join('\n  or \n');
      await saveRule(`neptune_generic_${tech}_${appName}_major`, majorQ, `התראות Major`);
      await saveRule(`neptune_generic_${tech}_${appName}_critical`, critQ, `התראות Critical`);
    } else if (tech === 'kafka') {
      const validNodes = appNodes.filter(n => n.data.majorThreshold !== undefined);
      const majorQ = validNodes.map(n => `kafka_consumer_lag{cluster="${n.data.label}"} >= ${n.data.majorThreshold}`).join('\n  or \n');
      const critQ = validNodes.map(n => `kafka_consumer_lag{cluster="${n.data.label}"} >= ${n.data.criticalThreshold}`).join('\n  or \n');
      await saveRule(`neptune_generic_kafka_${appName}_major`, majorQ, `התראות Major`);
      await saveRule(`neptune_generic_kafka_${appName}_critical`, critQ, `התראות Critical`);
    }
  };

  const deleteSpecificRules = async (nodeId, tech) => {
      const nodeRules = rules.filter(r => r.node === nodeId);
      for (const r of nodeRules) {
          if (r.id) await axios.delete(`${API_BASE_URL}/rules/${r.id}`);
      }
      
      setNodes(nds => {
          const updatedNds = nds.filter(n => n.id !== nodeId);
          setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId));
          
          axios.get(`${API_BASE_URL}/architecture/${team.id}`).then(res => {
              const allTeamNodes = res.data.nodes || [];
              const globalUpdatedNodes = allTeamNodes.filter(n => n.id !== nodeId);
              rebuildGenericRulesForApp(team.id, globalUpdatedNodes, tech);
          });
          
          setTimeout(() => triggerAutoSave(updatedNds, edges.filter(e => e.source !== nodeId && e.target !== nodeId)), 0);
          return updatedNds;
      });
      if(onRuleAdded) onRuleAdded();
  };

  const onNodesDelete = useCallback(async (deletedNodes) => {
      if (userRole === 'viewer') return;
      for (const node of deletedNodes) {
          await deleteSpecificRules(node.id, node.data.tech);
      }
  }, [userRole, rules, team, track]);

  const handleNodeLabelChange = async (nodeId, newLabel) => {
     setNodes(nds => {
         const oldNode = nds.find(n => n.id === nodeId);
         const oldLabel = oldNode?.data?.label;
         const updatedNodes = nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, label: newLabel } } : n);
         
         if (oldNode) {
             axios.get(`${API_BASE_URL}/architecture/${team.id}`).then(res => {
                 const allTeamNodes = res.data.nodes || [];
                 const gNodes = allTeamNodes.map(n => n.id === nodeId ? { ...n, data: { ...n.data, label: newLabel } } : n);
                 rebuildGenericRulesForApp(team.id, gNodes, oldNode.data.tech);
             });
             
             const linkedRules = rules.filter(r => r.node === nodeId);
             linkedRules.forEach(async (r) => {
                 let updatedName = r.name.replace(oldLabel, newLabel);
                 let updatedQuery = r.query.replace(oldLabel, newLabel);
                 if (r.id) await axios.put(`${API_BASE_URL}/rules/${r.id}`, { ...r, name: updatedName, query: updatedQuery });
             });
             if (linkedRules.length > 0 && onRuleAdded) onRuleAdded();
         }
         setTimeout(() => triggerAutoSave(updatedNodes, edges), 0);
         return updatedNodes;
     });
  };

  const onDragStart = (event, nodeTech) => { 
    event.dataTransfer.setData('application/reactflow', nodeTech); 
    event.dataTransfer.effectAllowed = 'move'; 
  };
  
  const onDrop = useCallback((event) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/reactflow');
    if (!type) return;
    const techConf = techDefinitions.find(t => t.value === type);
    if(!techConf) return;

    const position = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
    setPendingNodeConfig({ tech: techConf, position });
    setNodeForm({}); 
  }, [reactFlowInstance, techDefinitions]);

  const finalizeNodeDrop = () => {
    if (!pendingNodeConfig) return;
    const { tech, position } = pendingNodeConfig;
    
    let finalLabel = tech.labelTemplate || 'רכיב';
    Object.keys(nodeForm).forEach(key => {
        finalLabel = finalLabel.replace(`{${key}}`, nodeForm[key] || '');
    });

    const newNode = { id: getId(), type: 'techNode', position, data: { tech: tech.value, label: finalLabel, application: team.id, track_id: track?.id || '', ...nodeForm, rules: [] } };
    setNodes((nds) => { 
        const updated = nds.concat(newNode); 
        if (userRole !== 'viewer') setTimeout(() => triggerAutoSave(updated, edges), 0); 
        return updated; 
    });
    if (userRole === 'viewer') setIsDraftDirty(true);
    setPendingNodeConfig(null); 
  };

  const onNodeDoubleClick = useCallback((event, node) => {
    setRulesModalNodeId(node.id);
  }, []);

  const handleSaveThresholds = async () => {
    if (!thresholdNode) return;
    if (userRole === 'viewer') return;
    const tech = thresholdNode.data.tech;
    
    const updatedNodes = nodes.map(n => {
        if (n.id === thresholdNode.id) return { ...n, data: { ...n.data, ...thresholds } };
        return n;
    });
    setNodes(updatedNodes); 
    
    try {
        await axios.post(`${API_BASE_URL}/architecture/${team.id}/${track.id}`, { nodes: updatedNodes, edges });
        const res = await axios.get(`${API_BASE_URL}/architecture/${team.id}`);
        const allTeamNodes = res.data.nodes || [];
        await rebuildGenericRulesForApp(team.id, allTeamNodes, tech);
        if (onRuleAdded) onRuleAdded();
        setThresholdNode(null);
        setThresholdTechConfig(null);
    } catch (err) { alert("שגיאה בשמירת החוק הגנרי."); }
  };

  const onNodeContextMenu = useCallback((event, node) => { event.preventDefault(); if (connectingSourceId) return; setContextMenu({ x: event.clientX, y: event.clientY, type: 'node', id: node.id }); }, [connectingSourceId]);
  const onEdgeContextMenu = useCallback((event, edge) => { event.preventDefault(); if (connectingSourceId) return; setContextMenu({ x: event.clientX, y: event.clientY, type: 'edge', id: edge.id }); }, [connectingSourceId]);
  const closeContextMenu = () => setContextMenu(null);

  const onNodeClick = useCallback((event, node) => {
    if (connectingSourceId) {
      if (connectingSourceId !== node.id) {
        const newEdge = { 
           id: `edge_${connectingSourceId}_${node.id}_${Date.now()}`, 
           source: connectingSourceId, target: node.id, 
           type: 'centerEdge', animated: false, 
           style: { stroke: '#1c7ed6', strokeWidth: 3 },
           markerEnd: { type: MarkerType.ArrowClosed, color: '#1c7ed6', width: 15, height: 15 } 
        };
        setEdges((eds) => {
            const updatedEdges = addEdge(newEdge, eds);
            if (userRole !== 'viewer') setTimeout(() => triggerAutoSave(nodes, updatedEdges), 0);
            return updatedEdges;
        });
        if (userRole === 'viewer') setIsDraftDirty(true);
      }
      setConnectingSourceId(null);
    }
  }, [connectingSourceId, nodes, edges, setEdges, userRole]);

  const onPaneClick = useCallback(() => { if (connectingSourceId) setConnectingSourceId(null); closeContextMenu(); }, [connectingSourceId]);
  
  const handleDeleteEdge = () => { 
      setEdges((eds) => { 
          const updatedEdges = eds.filter((e) => e.id !== contextMenu.id); 
          if (userRole !== 'viewer') setTimeout(() => triggerAutoSave(nodes, updatedEdges), 0); 
          return updatedEdges; 
      }); 
      if (userRole === 'viewer') setIsDraftDirty(true);
      closeContextMenu(); 
  };

  const handleDeleteNodeContext = async () => {
    const nodeToDelete = nodes.find(n => n.id === contextMenu.id);
    if (!nodeToDelete) return;
    
    if (userRole === 'viewer') {
        setNodes(nds => nds.filter(n => n.id !== nodeToDelete.id));
        setEdges(eds => eds.filter(e => e.source !== nodeToDelete.id && e.target !== nodeToDelete.id));
        setIsDraftDirty(true);
    } else {
        await deleteSpecificRules(nodeToDelete.id, nodeToDelete.data.tech);
    }
    closeContextMenu();
  };

  const handleRemoveGenerics = async () => {
     const node = nodes.find(n => n.id === contextMenu.id);
     if (!node) return;
     const techConf = techDefinitions.find(t => t.value === node.data.tech);
     if (!techConf || !techConf.thresholds || techConf.thresholds.length === 0) return;

     const newData = { ...node.data };
     techConf.thresholds.forEach(t => delete newData[t.name]);

     setNodes(nds => {
         const updated = nds.map(n => n.id === node.id ? { ...n, data: newData } : n);
         setTimeout(() => triggerAutoSave(updated, edges), 0);
         
         axios.get(`${API_BASE_URL}/architecture/${team.id}`).then(res => {
             const allTeamNodes = res.data.nodes || [];
             const gNodes = allTeamNodes.map(n => n.id === node.id ? { ...n, data: newData } : n);
             rebuildGenericRulesForApp(team.id, gNodes, node.data.tech).then(() => {
                 if (onRuleAdded) onRuleAdded();
             });
         });
         return updated;
     });
     closeContextMenu();
  };

  const onConnect = useCallback((params) => {
    let newEdges = [];
    setEdges((eds) => {
      newEdges = addEdge({ ...params, animated: false, type: 'centerEdge', style: { stroke: '#1c7ed6', strokeWidth: 3 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#1c7ed6', width: 15, height: 15 } }, eds);
      return newEdges;
    });
    if (userRole !== 'viewer') setTimeout(() => triggerAutoSave(nodes, newEdges), 0);
    else setIsDraftDirty(true);
  }, [setEdges, nodes, team, track, userRole]);

  const handleStartConnectionMode = () => { setConnectingSourceId(contextMenu.id); closeContextMenu(); };
  const handleOpenCustomRuleModal = () => { setSelectedNodeId(contextMenu.id); setCustomRuleForm({ name: '', purpose: '', query: '', subType: 'תשתיתי' }); setCustomRuleModalOpen(true); closeContextMenu(); };
  
  const handleSaveCustomRule = async () => {
    if (!selectedNodeId) return;
    const payload = { name: customRuleForm.name, tech: 'CUSTOM', team: team.name, application: team.id, track_id: track?.id || '', query: customRuleForm.query, purpose: customRuleForm.purpose, subType: customRuleForm.subType, node: selectedNodeId, user: username };
    try {
      const response = await axios.post(`${API_BASE_URL}/rules`, payload);
      setNodes((nds) => {
        const updatedNodes = nds.map((n) => { if (n.id === selectedNodeId) { const currentRules = n.data.rules || []; return { ...n, data: { ...n.data, rules: [...currentRules, response.data] } }; } return n; });
        setTimeout(() => triggerAutoSave(updatedNodes, edges), 0); return updatedNodes;
      });
      if (onRuleAdded) onRuleAdded(); setCustomRuleModalOpen(false);
    } catch (error) { alert('שגיאה ביצירת חוק CUSTOM'); }
  };

  const convertKqlToDsl = () => {
    if (!kqlInput.trim()) return;
    const must = [];
    const must_not = [];
    const parts = kqlInput.split(/\s+and\s+/i);

    parts.forEach(part => {
      let isNot = false;
      let cleanPart = part.trim();
      if (cleanPart.toLowerCase().startsWith('not ')) {
        isNot = true;
        cleanPart = cleanPart.substring(4).trim();
      }
      const colonIndex = cleanPart.indexOf(':');
      if (colonIndex > 0) {
        const field = cleanPart.substring(0, colonIndex).trim();
        let value = cleanPart.substring(colonIndex + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.substring(1, value.length - 1);
        }
        const clause = { match_phrase: { [field]: value } };
        if (isNot) must_not.push(clause);
        else must.push(clause);
      } else {
         const clause = { multi_match: { query: cleanPart } };
         if (isNot) must_not.push(clause);
         else must.push(clause);
      }
    });

    const dsl = { query: { bool: {} } };
    if (must.length > 0) dsl.query.bool.must = must;
    if (must_not.length > 0) dsl.query.bool.must_not = must_not;
    if (must.length === 0 && must_not.length === 0) dsl.query = { query_string: { query: kqlInput.trim() } };

    setLogForm({ ...logForm, query: JSON.stringify(dsl, null, 2) });
    setJsonValidationMsg({ type: 'success', text: 'הומרה בהצלחה למבנה Bool מובנה!' });
  };

  const validateJson = () => {
    try {
        JSON.parse(logForm.query);
        setJsonValidationMsg({ type: 'success', text: 'ה-JSON תקין וחוקי!' });
    } catch (e) {
        setJsonValidationMsg({ type: 'error', text: 'שגיאת JSON: ' + e.message });
    }
  };

  const saveElasticLogRule = async () => {
    if (!selectedElasticNode) return;
    const existingRulesForNode = rules.filter(r => r.tech === 'elastic_log' && r.node === selectedElasticNode.id);
    const isDuplicate = existingRulesForNode.some(r => r.query === logForm.query && r.logSeverity === logForm.severity && r.indexName === logIndex);
    if (isDuplicate) return alert(`כבר מוגדרת חומרת ${logForm.severity.toUpperCase()} לשאילתה זו תחת האינדקס המבוקש.`);

    const fullPurpose = `התראת לוגים לאלסטיק (${logForm.severity}): אם מספר השורות ${logForm.direction} מ-${logForm.value}.\nאימפקט: ${logForm.impact || '-'}`;
    const payload = {
      name: logForm.ruleName, 
      tech: 'elastic_log', team: team.name, application: team.id, track_id: track?.id || '',
      indexName: logIndex, query: logForm.query, logSeverity: logForm.severity, logThreshold: logForm.value, thresholdDirection: logForm.direction, operationalImpact: logForm.impact, maktag: logForm.maktag,
      node: selectedElasticNode.id, purpose: fullPurpose, subType: 'אפליקטיבי', user: username
    };
    await axios.post(`${API_BASE_URL}/rules`, payload);
    if (onRuleAdded) onRuleAdded();
    setLogForm({ ruleName: '', query: '', impact: '', direction: '>', value: 100, severity: 'major', maktag: '' }); 
  };

  const displayData = zoomRange ? graphData.slice(zoomRange.start, zoomRange.end + 1) : graphData;
  let polylinePoints = ""; let currentMax = 10;
  const currentValue = graphData.length > 0 ? graphData[graphData.length - 1].value : 0;
  if (displayData.length > 0) {
    const maxDataVal = Math.max(...displayData.map(d => d.value));
    currentMax = Math.max(maxDataVal, (thresholds.criticalThreshold || thresholds.critical || 10) * 1.2, 10);
    if(isNaN(currentMax) || currentMax === 0) currentMax = 100;
    polylinePoints = displayData.map((d, i) => { const x = (i / (displayData.length - 1)) * 100; const y = 100 - ((d.value / currentMax) * 100); return `${x},${y}`; }).join(" ");
  }

  const criticalVal = thresholds.criticalThreshold || thresholds.critical || thresholds.storageCritical || thresholds.objectsCritical || 0;
  const majorVal = thresholds.majorThreshold || thresholds.major || thresholds.storageMajor || thresholds.objectsMajor || 0;
  const criticalY = currentMax > 0 ? 100 - ((criticalVal / currentMax) * 100) : 0;
  const majorY = currentMax > 0 ? 100 - ((majorVal / currentMax) * 100) : 0;

  const handleMouseDown = (e) => { if (displayData.length === 0) return; const rect = e.currentTarget.getBoundingClientRect(); const x = e.clientX - rect.left; const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100)); setSelectionStart(percentage); setSelectionEnd(percentage); setIsSelecting(true); };
  const handleMouseMoveGraph = (e) => {
    if (displayData.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect(); const x = e.clientX - rect.left; const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    if (isSelecting) setSelectionEnd(percentage); else { let index = Math.round((percentage / 100) * (displayData.length - 1)); index = Math.max(0, Math.min(index, displayData.length - 1)); setHoverPoint({ data: displayData[index], xPercentage: (index / (displayData.length - 1)) * 100 }); }
  };
  const handleMouseUp = () => {
    if (isSelecting) {
      setIsSelecting(false);
      if (Math.abs(selectionStart - selectionEnd) > 2) { const startPct = Math.min(selectionStart, selectionEnd); const endPct = Math.max(selectionStart, selectionEnd); const startIdx = Math.floor((startPct / 100) * (displayData.length - 1)); const endIdx = Math.ceil((endPct / 100) * (displayData.length - 1)); const absoluteStart = zoomRange ? zoomRange.start + startIdx : startIdx; const absoluteEnd = zoomRange ? zoomRange.start + endIdx : endIdx; setZoomRange({ start: absoluteStart, end: absoluteEnd }); }
      setSelectionStart(null); setSelectionEnd(null);
    }
  };
  const handleMouseLeaveGraph = () => { setHoverPoint(null); if (isSelecting) { setIsSelecting(false); setSelectionStart(null); setSelectionEnd(null); } };

  const addedCount = nodes.filter(n => !originalNodeIds.includes(n.id)).length;
  const deletedCount = originalNodeIds.filter(id => !nodes.find(n => n.id === id)).length;
  const totalChangesCount = addedCount + deletedCount;

  return (
    <div style={{ display: 'flex', height: '100%', direction: 'rtl', border: '1px solid #dee2e6', borderRadius: '8px', overflow: 'hidden' }}>
      <div style={{ width: '250px', backgroundColor: '#f8f9fa', borderLeft: '1px solid #dee2e6', padding: '15px', display: 'flex', flexDirection: 'column', zIndex: 10 }}>
          <Text fw={900} mb="md" ta="center">רכיבי מערכת</Text>
          <Text size="xs" c="dimmed" mb="md" ta="center">גרור רכיב אל תוך הקנבס</Text>
          <ScrollArea style={{ flexGrow: 1 }}>
            <SimpleGrid cols={2} spacing="sm">
              {techDefinitions.map(tech => (
                <Paper 
                  key={tech.value} shadow="sm" p="xs" withBorder draggable 
                  onDragStart={(e) => onDragStart(e, tech.value)} 
                  style={{ cursor: 'grab', textAlign: 'center', backgroundColor: 'white', transition: 'transform 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                   <Image src={techIconMap[tech.value] || techIconMap.server} w={32} h={32} mx="auto" />
                   <Text size="xs" mt="xs" fw={700} c="dark.7" style={{ wordBreak: 'break-word' }}>{tech.label}</Text>
                </Paper>
              ))}
            </SimpleGrid>
          </ScrollArea>
      </div>

      <div style={{ position: 'relative', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 5, direction: 'rtl', display: 'flex', gap: '10px' }}>
          {userRole !== 'viewer' && !reviewMode.active && <Button leftSection={<IconDeviceFloppy size={16} />} color="blue" onClick={() => handleSaveArchitecture(null, null)} loading={isSaving}>שמור פריסת מסך</Button>}
          
          {userRole === 'viewer' && isDraftDirty && (
            <Button color="orange" leftSection={<IconSend size={16}/>} onClick={() => setDraftModalOpen(true)}>
              הגש בקשת שינוי למנהל ({totalChangesCount > 0 ? `${totalChangesCount} שינויים ברכיבים` : 'שינויים בקווים/תיעוד'})
            </Button>
          )}

          {userRole !== 'viewer' && (
             <Tooltip label="ניהול ניטור לוגים לעיגולי אלסטיק" withArrow>
                <ActionIcon size="lg" radius="xl" color="teal" variant="filled" onClick={() => setElasticLogsModalOpen(true)}>
                    <Image src={elasticLogsIcon} w={20} h={20} />
                </ActionIcon>
             </Tooltip>
          )}
        </div>

        {connectingSourceId && (
          <div style={{ position: 'absolute', top: 15, left: '50%', transform: 'translateX(-50%)', zIndex: 10, pointerEvents: 'none' }}>
            <Paper p="xs" radius="xl" shadow="md" style={{ backgroundColor: '#e7f5ff', border: '1px solid #339af0', direction: 'rtl' }}>
              <Group gap="xs"><IconArrowsRightLeft size={16} color="#339af0" /><Text size="sm" fw={700} c="blue.9">מצב חיבור מופעל: לחץ על יעד למתיחת קו</Text></Group>
            </Paper>
          </div>
        )}

        {shiftPressed && (
          <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 10, pointerEvents: 'none' }}>
            <Badge color="blue" size="lg" variant="filled" style={{ boxShadow: '0 4px 6px rgba(0,0,0,0.2)' }}>מצב סרגל: החזק Shift וגרור רכיב כדי ליישר</Badge>
          </div>
        )}

        <div style={{ flexGrow: 1 }} ref={reactFlowWrapper}>
          <CanvasContext.Provider value={{ openNodeRules: setRulesModalNodeId, handleNodeLabelChange, handleIconClick, userRole, openDocDrawer: setDocDrawerNodeId }}>
            <ReactFlowProvider>
              <ReactFlow 
                nodes={nodes} edges={edges} 
                edgeTypes={edgeTypes}
                onNodesChange={onNodesChangeWithDraft} onEdgesChange={onEdgesChangeWithDraft} 
                onNodesDelete={onNodesDelete}
                onNodeDrag={onNodeDrag}
                onInit={setReactFlowInstance} 
                onDrop={onDrop} 
                onDragOver={(e)=>{e.preventDefault()}} 
                onNodeDoubleClick={onNodeDoubleClick} onNodeContextMenu={onNodeContextMenu} onEdgeContextMenu={onEdgeContextMenu}
                onNodeClick={onNodeClick} onPaneClick={onPaneClick} onConnect={onConnect}
                nodeTypes={nodeTypes} fitView minZoom={0.4} maxZoom={1.5} 
                style={{ backgroundColor: '#d0ebff' }} 
                defaultEdgeOptions={{ type: 'centerEdge', style: { stroke: '#1c7ed6', strokeWidth: 3 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#1c7ed6', width: 15, height: 15 } }}
              >
                <Controls showInteractive={false} />
              </ReactFlow>
            </ReactFlowProvider>
          </CanvasContext.Provider>
        </div>

        {/* --- מגירת התיעוד המוגדלת נפתחת רק מלחצן ימני או מהאייקון הכתום --- */}
        <Drawer opened={!!docDrawerNodeId} onClose={() => setDocDrawerNodeId(null)} position="right" title={<Text fw={900} size="xl">תיעוד והגדרות: {docDrawerNode?.data.label}</Text>} size="xl" dir="rtl">
           {docDrawerNode && (
              <Stack style={{ height: 'calc(100vh - 100px)' }}>
                 <Text size="sm" c="dimmed">כאן תוכל לשמור הערות, כתובות IP, או כל מידע רלוונטי על הרכיב.</Text>
                 
                 <Textarea 
                    label="פירוט והערות"
                    minRows={12} 
                    autosize
                    value={docDrawerNode.data.documentation || ''} 
                    onChange={(e) => {
                       const newDoc = e.currentTarget.value;
                       setNodes((nds) => nds.map((n) => n.id === docDrawerNode.id ? { ...n, data: { ...n.data, documentation: newDoc } } : n));
                       if (userRole === 'viewer') setIsDraftDirty(true);
                    }}
                    placeholder="כתוב כאן תיעוד..." 
                 />
                 
                 <Divider my="sm" />
                 
                 <Textarea 
                    label="קישורים מועילים (כל שורה נחשבת לקישור נפרד)"
                    minRows={4} 
                    autosize
                    value={docDrawerNode.data.links || ''} 
                    onChange={(e) => {
                       const newLinks = e.currentTarget.value;
                       setNodes((nds) => nds.map((n) => n.id === docDrawerNode.id ? { ...n, data: { ...n.data, links: newLinks } } : n));
                       if (userRole === 'viewer') setIsDraftDirty(true);
                    }}
                    placeholder="לדוגמה: https://wiki.example.com" 
                 />

                 {/* תצוגה לחיצה של הקישורים */}
                 {docDrawerNode.data.links && (
                     <Stack gap="xs" mt="xs">
                        {docDrawerNode.data.links.split('\n').map((l, i) => {
                           const linkStr = l.trim();
                           if(linkStr.startsWith('http://') || linkStr.startsWith('https://')) {
                              return (
                                 <Group key={i} gap="xs">
                                    <IconExternalLink size={14} color="#228be6" />
                                    <a href={linkStr} target="_blank" rel="noreferrer" style={{ fontSize: '14px', color: '#228be6', textDecoration: 'none', wordBreak: 'break-all' }}>
                                       {linkStr}
                                    </a>
                                 </Group>
                              );
                           }
                           return null;
                        })}
                     </Stack>
                 )}

                 <div style={{ flexGrow: 1 }}></div>

                 <Button color="blue" size="lg" onClick={() => {
                     if (userRole !== 'viewer') {
                        const updatedNodes = nodes.map((n) => n.id === docDrawerNode.id ? { ...n, data: { ...n.data, documentation: docDrawerNode.data.documentation, links: docDrawerNode.data.links } } : n);
                        triggerAutoSave(updatedNodes, edges);
                     }
                     setDocDrawerNodeId(null);
                 }}>
                     {userRole === 'viewer' ? 'אשר שינוי לבקשה וסגור' : 'שמור וסגור'}
                 </Button>
              </Stack>
           )}
        </Drawer>

        {contextMenu && (
          <Paper shadow="xl" p="xs" withBorder style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, zIndex: 1000, direction: 'rtl' }}>
            <Stack gap={4}>
              {contextMenu.type === 'edge' ? (
                <Button color="red" variant="subtle" size="xs" leftSection={<IconTrash size={14}/>} onClick={handleDeleteEdge}>מחק קו (חיבור)</Button>
              ) : (
                <>
                  <Button color="teal" variant="subtle" size="xs" leftSection={<IconFileDescription size={14}/>} onClick={() => {
                     setDocDrawerNodeId(contextMenu.id);
                     closeContextMenu();
                  }}>תיעוד וקישורים</Button>

                  {userRole !== 'viewer' && <Button color="gray" variant="subtle" size="xs" leftSection={<IconSettings size={14}/>} onClick={() => {
                    const node = nodes.find(n => n.id === contextMenu.id);
                    if (node) { setEditNodeData({ ...node.data, id: node.id }); closeContextMenu(); }
                  }}>הגדרות רכיב</Button>}
                  
                  <Button color="green" variant="subtle" size="xs" leftSection={<IconArrowsRightLeft size={14}/>} onClick={handleStartConnectionMode}>מתח קו מהרכיב</Button>
                  
                  {userRole !== 'viewer' && <Button color="grape" variant="subtle" size="xs" leftSection={<IconPlus size={14}/>} onClick={handleOpenCustomRuleModal}>צור חוק CUSTOM לרכיב</Button>}
                  
                  {userRole !== 'viewer' && <Button color="orange" variant="subtle" size="xs" leftSection={<IconTrashX size={14}/>} onClick={handleRemoveGenerics}>הסר חוקים גנריים (איפוס ספים)</Button>}

                  <Button color="red" variant="subtle" size="xs" leftSection={<IconTrash size={14}/>} onClick={handleDeleteNodeContext}>מחק רכיב זה</Button>
                </>
              )}
            </Stack>
          </Paper>
        )}

        <Modal opened={draftModalOpen} onClose={() => setDraftModalOpen(false)} title="הגשת בקשת שינוי ארכיטקטורה" centered dir="rtl">
            <Stack>
               <Text>עשית שינויים בקנבס (כמשתמש Viewer). אנא פרט מה השתנה כדי שהמנהל יאשר את תוספת הרכיבים או הקווים.</Text>
               <Textarea value={draftDesc} onChange={(e)=>setDraftDesc(e.currentTarget.value)} placeholder="לדוגמה: הוספתי שרת רביט חדש..." />
               <Button color="blue" onClick={submitDraftRequest} disabled={!draftDesc}>שלח לאישור מנהל</Button>
            </Stack>
        </Modal>

        <Modal opened={!!pendingNodeConfig} onClose={() => setPendingNodeConfig(null)} title={<Text fw={700} size="lg">הוספת רכיב {pendingNodeConfig?.tech.label}</Text>} centered dir="rtl">
          <form onSubmit={(e) => { e.preventDefault(); finalizeNodeDrop(); }}>
            <Stack>
              {(pendingNodeConfig?.tech.fields || []).map(field => (
                 <TextInput 
                    key={field.name} label={field.label} 
                    value={nodeForm[field.name] || ''} 
                    onChange={(e) => setNodeForm({...nodeForm, [field.name]: e.currentTarget.value})} 
                    required={field.required !== false}
                    pattern={field.pattern}
                    title={field.patternMsg}
                 />
              ))}
              <Textarea label="תיעוד הרכיב" value={nodeForm.documentation || ''} onChange={(e) => setNodeForm({...nodeForm, documentation: e.currentTarget.value})} minRows={2} />
              <Button type="submit" fullWidth mt="md" color="blue">הוסף לקנבס</Button>
            </Stack>
          </form>
        </Modal>

        <Modal opened={!!editNodeData} onClose={() => setEditNodeData(null)} title={<Text fw={700} size="lg">הגדרות רכיב</Text>} centered dir="rtl">
          {editNodeData && (() => {
              const techConf = techDefinitions.find(t => t.value === editNodeData.tech);
              return (
                 <form onSubmit={(e) => {
                     e.preventDefault();
                     setNodes((nds) => {
                          const updatedNodes = nds.map((n) => {
                              if (n.id === editNodeData.id) {
                                  let finalLabel = techConf?.labelTemplate || 'רכיב';
                                  Object.keys(editNodeData).forEach(key => { finalLabel = finalLabel.replace(`{${key}}`, editNodeData[key] || ''); });
                                  return { ...n, data: { ...n.data, ...editNodeData, label: finalLabel } };
                              }
                              return n;
                          });
                          setTimeout(() => triggerAutoSave(updatedNodes, edges), 0);
                          return updatedNodes;
                      });
                      setEditNodeData(null);
                 }}>
                  <Stack>
                      {(techConf?.fields || []).map(field => (
                          <TextInput 
                              key={field.name} label={field.label} 
                              value={editNodeData[field.name] || ''} 
                              onChange={(e) => setEditNodeData({...editNodeData, [field.name]: e.currentTarget.value})} 
                              required={field.required !== false} 
                              pattern={field.pattern}
                              title={field.patternMsg}
                          />
                      ))}
                      <Button type="submit" fullWidth color="blue" leftSection={<IconDeviceFloppy size={16}/>}>שמור הגדרות</Button>
                  </Stack>
                 </form>
              )
          })()}
        </Modal>

        <Modal opened={!!thresholdNode} onClose={() => setThresholdNode(null)} title={<Text fw={700} size="lg">ספים: {thresholdNode?.data.label}</Text>} centered dir="rtl" size="xl">
          <form onSubmit={(e) => { e.preventDefault(); handleSaveThresholds(); }}>
          <Stack>
            <Grid>
              {(thresholdTechConfig?.thresholds || []).map(thr => (
                <Grid.Col span={6} key={thr.name}>
                   <NumberInput 
                      label={thr.label} 
                      value={thresholds[thr.name] !== undefined ? thresholds[thr.name] : 0}
                      min={thr.min !== undefined ? thr.min : undefined} 
                      max={thr.max !== undefined ? thr.max : undefined} 
                      onChange={(val) => setThresholds({...thresholds, [thr.name]: val})} 
                      readOnly={userRole === 'viewer'}
                      styles={userRole === 'viewer' ? { input: { backgroundColor: '#f1f3f5', color: '#495057', cursor: 'not-allowed' } } : {}}
                   />
                </Grid.Col>
              ))}
            </Grid>

            {['rabbit', 'mongo', 'nfs', 's3', 'nifi', 'linux', 'windows', 'kafka'].includes(thresholdNode?.data.tech) && (
                <Paper bg="dark.7" p="md" radius="md" mt="sm" style={{ border: '1px solid #343a40' }}>
                  <Group justify="space-between" mb="sm" align="flex-start">
                    <Stack gap={0}><Group gap="xs">
                      <Text c="dimmed" size="xs" fw={700}>Prometheus Live Preview</Text>
                      {isGraphLoading && <Loader size="xs" color="gray" />}
                    </Group></Stack>
                    <Stack align="flex-end" gap={4}>
                      <Group gap="xs"><Text c="white" fw={900} size="xl">{currentValue.toLocaleString()}</Text><Text c="dimmed" size="xs">ערך נוכחי</Text></Group>
                      
                      <Group gap="xs" mt="xs">
                          <input type="datetime-local" value={graphStartTime} onChange={(e) => setGraphStartTime(e.target.value)} style={{ fontSize: '12px', padding: '4px', borderRadius: '4px', border: 'none' }} />
                          <Text c="white" size="xs">עד</Text>
                          <input type="datetime-local" value={graphEndTime} onChange={(e) => setGraphEndTime(e.target.value)} style={{ fontSize: '12px', padding: '4px', borderRadius: '4px', border: 'none' }} />
                      </Group>
                    </Stack>
                  </Group>
                  <div onMouseDown={handleMouseDown} onMouseMove={handleMouseMoveGraph} onMouseUp={handleMouseUp} onMouseLeave={handleMouseLeaveGraph} style={{ height: '180px', background: 'linear-gradient(0deg, rgba(43,138,62,0.15) 0%, rgba(43,138,62,0) 100%)', borderBottom: '2px solid #40c057', marginTop: '15px', position: 'relative', cursor: isSelecting ? 'ew-resize' : 'crosshair', userSelect: 'none' }}>
                     {zoomRange && (<Button size="compact-xs" color="gray" variant="light" style={{ position: 'absolute', top: 5, left: 5, zIndex: 10 }} onClick={(e) => { e.stopPropagation(); setZoomRange(null); }}>הצג טווח מלא</Button>)}
                     {isSelecting && selectionStart !== null && selectionEnd !== null && (<div style={{ position: 'absolute', top: 0, bottom: 0, left: `${Math.min(selectionStart, selectionEnd)}%`, width: `${Math.abs(selectionStart - selectionEnd)}%`, backgroundColor: 'rgba(51, 154, 240, 0.2)', borderLeft: '1px solid #339af0', borderRight: '1px solid #339af0' }} />)}
                     {displayData.length > 0 ? (<svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', position: 'absolute', bottom: 0 }} preserveAspectRatio="none"><polyline points={polylinePoints} fill="none" stroke="#40c057" strokeWidth="1.5" /></svg>) : (<Text c="dimmed" size="xs" ta="center" mt="xl" pt="xl">{isGraphLoading ? 'טוען נתונים...' : 'אין נתונים היסטוריים בטווח שנבחר'}</Text>)}
                     {thresholdNode?.data.tech !== 's3' && (<><div style={{ position: 'absolute', top: `${criticalY}%`, left: 0, right: 0, borderTop: '1px dashed #fa5252', display: criticalY >= 0 && criticalY <= 100 ? 'block' : 'none', pointerEvents: 'none' }}><Text size="10px" c="red.6" style={{ position: 'absolute', right: 5, top: -15 }}>CRITICAL ({criticalVal})</Text></div><div style={{ position: 'absolute', top: `${majorY}%`, left: 0, right: 0, borderTop: '1px dashed #fab005', display: majorY >= 0 && majorY <= 100 ? 'block' : 'none', pointerEvents: 'none' }}><Text size="10px" c="yellow.6" style={{ position: 'absolute', right: 5, top: -15 }}>MAJOR ({majorVal})</Text></div></>)}
                     {hoverPoint && !isSelecting && (<><div style={{ position: 'absolute', left: `${hoverPoint.xPercentage}%`, top: 0, bottom: 0, width: '1px', backgroundColor: 'rgba(255,255,255,0.4)', pointerEvents: 'none' }} /><Paper p="xs" radius="sm" bg="dark.8" style={{ position: 'absolute', left: `calc(${hoverPoint.xPercentage}% + 10px)`, top: '10%', border: '1px solid #495057', pointerEvents: 'none', transform: hoverPoint.xPercentage > 80 ? 'translateX(-120%)' : 'none', zIndex: 100 }}><Text size="xs" c="dimmed">{new Date(hoverPoint.data.time * 1000).toLocaleString('he-IL', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</Text><Text size="sm" fw={700} c="white">{hoverPoint.data.value.toLocaleString()} ערך</Text></Paper></>)}
                  </div>
                </Paper>
            )}

            {userRole !== 'viewer' && <Button type="submit" fullWidth color="blue" mt="md">שמור והפעל ספים לרכיב</Button>}
          </Stack>
          </form>
        </Modal>

        <Modal opened={elasticLogsModalOpen} onClose={() => {setElasticLogsModalOpen(false); setSelectedElasticNode(null);}} title={<Text fw={900} size="lg">הגדרת עיגולי ניטור - Elastic Logs</Text>} centered dir="rtl" size="xl">
          <Stack>
              <Select label="בחר סביבת אלסטיק מהקנבס" placeholder="בחר סביבה..." data={nodes.filter(n => n.data.tech === 'elastic').map(n => ({value: n.id, label: n.data.label}))} value={selectedElasticNode?.id} onChange={(val) => setSelectedElasticNode(nodes.find(n => n.id === val))} />
              
              {selectedElasticNode && (
                  <>
                    <TextInput label="אינדקס יעד (Index Name)" placeholder="לדוגמה: my-app-logs-*" value={logIndex} onChange={(e)=>setLogIndex(e.currentTarget.value)} required />
                    
                    <Paper withBorder p="md" radius="md" bg="gray.0">
                      <Text fw={700} mb="sm">צור עיגול ניטור חדש</Text>
                      <Grid mt="xs" align="flex-end">
                         <Grid.Col span={4}>
                            <TextInput label="שם הניטור (יוצג בעיגול)" placeholder="לדוגמה: שגיאות 500" value={logForm.ruleName} onChange={(e)=>setLogForm({...logForm, ruleName: e.currentTarget.value})} required />
                         </Grid.Col>
                         <Grid.Col span={8}>
                            <Button fullWidth variant="light" color="blue" leftSection={<IconCode size={16} />} onClick={() => setIsQueryModalOpen(true)}>
                               {logForm.query ? 'ערוך שאילתה (KQL/JSON)' : 'לחץ לכתיבת שאילתה חופשית'}
                            </Button>
                         </Grid.Col>
                      </Grid>

                      <Grid mt="sm" align="flex-end">
                        <Grid.Col span={4}><Select label="יחס" data={[{value: '>', label: 'גדול מ'}, {value: '<', label: 'קטן מ'}]} value={logForm.direction} onChange={(v)=>setLogForm({...logForm, direction: v})} /></Grid.Col>
                        <Grid.Col span={4}><NumberInput label="סף" value={logForm.value} onChange={(v)=>setLogForm({...logForm, value: v})} /></Grid.Col>
                        <Grid.Col span={4}><Select label="חומרה" data={[{value: 'major', label: 'Major'}, {value: 'critical', label: 'Critical'}]} value={logForm.severity} onChange={(v)=>setLogForm({...logForm, severity: v})} /></Grid.Col>
                      </Grid>
                      
                      <Grid mt="sm">
                         <Grid.Col span={6}><TextInput label="אימפקט מבצעי (השפעה)" placeholder="לדוגמה: המשתמשים יחוו איטיות..." value={logForm.impact} onChange={(e)=>setLogForm({...logForm, impact: e.currentTarget.value})} /></Grid.Col>
                         <Grid.Col span={6}><TextInput label="מקת''ג (מה עושים כשקורה?)" placeholder="לדוגמה: יש לבצע ריסטרט לסרביס X" value={logForm.maktag} onChange={(e)=>setLogForm({...logForm, maktag: e.currentTarget.value})} /></Grid.Col>
                      </Grid>

                      <Button fullWidth mt="md" onClick={saveElasticLogRule} color="teal" disabled={!logForm.query || !logIndex || !logForm.ruleName}>הוסף עיגול</Button>
                    </Paper>

                    <Group mt="md" justify="center">
                      {rules.filter(r => r.tech === 'elastic_log' && r.node === selectedElasticNode?.id).map((logRule, idx) => (
                        <Paper key={idx} p="md" shadow="sm" radius="100px" style={{ cursor: 'pointer', border: `2px solid ${logRule.logSeverity === 'critical' ? '#fa5252' : '#fab005'}`, backgroundColor: '#fff', width: '130px', height: '130px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }} onClick={() => setSelectedLogCircle(logRule)}>
                           <Text size="xs" fw={700} truncate="end" w={100} title={logRule.name}>{logRule.name}</Text>
                           <Text size="10px" c="dimmed" truncate="end" w={100} title={logRule.query} mt={2}>{logRule.query}</Text>
                           <Text size="sm" c="dark" fw={900} mt={4}>{logRule.thresholdDirection} {logRule.logThreshold}</Text>
                           <ActionIcon size="xs" color="red" mt="xs" onClick={(e) => { e.stopPropagation(); axios.delete(`${API_BASE_URL}/rules/${logRule.id}`).then(onRuleAdded) }}><IconTrash size={12}/></ActionIcon>
                        </Paper>
                      ))}
                    </Group>
                  </>
              )}
          </Stack>
        </Modal>

        <Modal opened={isQueryModalOpen} onClose={() => {setIsQueryModalOpen(false); setJsonValidationMsg(null);}} title={<Text fw={700} size="lg">עורך שאילתת Elastic (KQL / JSON)</Text>} centered size="xl" dir="rtl">
          <Stack>
              <Paper withBorder p="md" bg="gray.0" radius="md">
                 <Text fw={700} mb="xs">המרת שאילתה חופשית (כמו ב-Discover / KQL)</Text>
                 <Group align="flex-end">
                    <TextInput placeholder='לדוגמה: service.name: "ariel" and not log.level: info' value={kqlInput} onChange={(e) => setKqlInput(e.currentTarget.value)} style={{ flexGrow: 1 }} styles={{ input: { direction: 'ltr', fontFamily: 'monospace' } }} />
                    <Button variant="light" color="grape" onClick={convertKqlToDsl} disabled={!kqlInput.trim()}>המר ל-QUERY DSL ⬇</Button>
                 </Group>
              </Paper>

              <Textarea placeholder='הזן כאן את השאילתה שלך (JSON מלא)...' minRows={10} value={logForm.query} onChange={(e) => { setLogForm({...logForm, query: e.currentTarget.value}); setJsonValidationMsg(null); }} styles={{ input: { fontFamily: 'monospace', fontSize: '14px', direction: 'ltr', textAlign: 'left' } }} data-autofocus />
              <Group justify="space-between" mt="md">
                <Group>
                  <Button variant="light" color="teal" onClick={validateJson}>Validate JSON</Button>
                  {jsonValidationMsg && <Text c={jsonValidationMsg.type === 'success' ? 'teal' : 'red'} fw={700} size="sm">{jsonValidationMsg.text}</Text>}
                </Group>
                <Button onClick={() => setIsQueryModalOpen(false)} color="blue">שמור שאילתה וחזור</Button>
              </Group>
          </Stack>
        </Modal>

        <Modal opened={!!rulesModalNodeId} onClose={() => setRulesModalNodeId(null)} title={<Text fw={700} size="lg">ניהול ניטורים לרכיב: {rulesModalNode?.data.label}</Text>} centered dir="rtl" size="lg">
          <Stack>
             {rulesModalNode && ['rabbit', 'nifi', 'mongo', 's3', 'nfs', 'linux', 'windows', 'kafka'].includes(rulesModalNode.data.tech) && (
                <Paper withBorder p="sm" bg="blue.0" style={{ borderColor: '#339af0' }}>
                   <Group justify="space-between">
                      <Group gap="xs">
                         <Image src={iconStorage} w={20} h={20} />
                         <Text fw={700} c="blue.9">ספי ניטור גנריים (Major / Critical)</Text>
                      </Group>
                      <Button size="xs" color="blue" onClick={() => openThresholdModalForNode(rulesModalNode)}>
                         {userRole === 'viewer' ? 'צפה בספים' : 'ערוך ספים (OPT-IN)'}
                      </Button>
                   </Group>
                </Paper>
             )}

             {(rulesModalNode?.data.rules || []).map((rule, idx) => (
                <Paper key={idx} withBorder p="md" bg="gray.0">
                   <Group justify="space-between" wrap="nowrap" align="flex-start">
                      <Stack gap={8} style={{ overflow: 'hidden', flexGrow: 1 }}>
                         <Group gap="xs">
                            <Image src={getNiturIcon(rule)} w={24} h={24} />
                            <Text fw={900} size="lg">{rule.name}</Text>
                            <Badge size="xs" color={rule.tech === 'elastic_log' ? 'teal' : 'grape'}>{rule.tech === 'elastic_log' ? 'לוגים' : 'CUSTOM'}</Badge>
                         </Group>
                         <Text size="sm" c="dimmed" fw={600} style={{ wordBreak: 'break-word' }}>מטרה: {rule.purpose || 'לא מוגדרת מטרה'}</Text>
                         <Code block color="dark.8" c="blue.4" style={{ direction: 'ltr', textAlign: 'left', marginTop: '5px' }}>{rule.query}</Code>
                      </Stack>
                      <Group wrap="nowrap" mt="xs">
                         {rule.tech === 'elastic_log' && (
                            <ActionIcon color="teal" variant="light" onClick={() => { setSelectedLogCircle(rule); }}><IconFileDescription size={16} /></ActionIcon>
                         )}
                         {userRole !== 'viewer' && (
                            <ActionIcon color="red" variant="light" onClick={async () => {
                               if(!window.confirm('האם למחוק ניטור זה?')) return;
                               try {
                                  if (rule.id) await axios.delete(`${API_BASE_URL}/rules/${rule.id}`);
                                  if (onRuleAdded) onRuleAdded();
                                  setNodes(nds => nds.map(n => {
                                     if (n.id === rulesModalNodeId) { return { ...n, data: { ...n.data, rules: n.data.rules.filter(r => r.id !== rule.id) } }; }
                                     return n;
                                  }));
                                  triggerAutoSave(nodes.map(n => n.id === rulesModalNodeId ? { ...n, data: { ...n.data, rules: n.data.rules.filter(r => r.id !== rule.id) } } : n), edges);
                               } catch(e) {}
                            }}><IconTrash size={16} /></ActionIcon>
                         )}
                      </Group>
                   </Group>
                </Paper>
             ))}
          </Stack>
        </Modal>

        <Modal opened={!!selectedLogCircle} onClose={() => setSelectedLogCircle(null)} title={<Text fw={900} size="lg">פרטי ניטור לוג (Elastic)</Text>} centered dir="rtl">
           {selectedLogCircle && (
              <Stack>
                  <Paper withBorder p="sm" bg="gray.0"><Text fw={700}>שם הניטור:</Text><Text>{selectedLogCircle.name}</Text></Paper>
                  <Paper withBorder p="sm" bg="gray.0"><Text fw={700}>אינדקס:</Text><Text>{selectedLogCircle.indexName}</Text></Paper>
                  <Paper withBorder p="sm" bg="gray.0"><Text fw={700}>שאילתה (KQL/JSON):</Text><Code block style={{ direction: 'ltr', textAlign: 'left', maxHeight: '200px', overflowY: 'auto' }}>{selectedLogCircle.query}</Code></Paper>
                  <Group grow>
                      <Paper withBorder p="sm" bg="gray.0"><Text fw={700}>חומרה:</Text><Badge color={selectedLogCircle.logSeverity === 'critical' ? 'red' : 'yellow'}>{selectedLogCircle.logSeverity}</Badge></Paper>
                      <Paper withBorder p="sm" bg="gray.0"><Text fw={700}>תנאי הפעלה:</Text><Text fw={900}>{selectedLogCircle.thresholdDirection} {selectedLogCircle.logThreshold} רשומות</Text></Paper>
                  </Group>
                  <Paper withBorder p="sm" bg="gray.0"><Text fw={700}>אימפקט מבצעי:</Text><Text>{selectedLogCircle.operationalImpact || 'לא צוין'}</Text></Paper>
                  <Paper withBorder p="sm" bg="gray.0"><Text fw={700}>מקת"ג (פעולות לביצוע):</Text><Text>{selectedLogCircle.maktag || 'לא צוין מקת"ג'}</Text></Paper>
                  <Button onClick={() => setSelectedLogCircle(null)}>סגור</Button>
              </Stack>
           )}
        </Modal>

        <Modal opened={customRuleModalOpen} onClose={() => setCustomRuleModalOpen(false)} title={<Text fw={700} size="lg">יצירת חוק CUSTOM לרכיב ({nodes.find(n => n.id === selectedNodeId)?.data.label || ''})</Text>} centered dir="rtl" size="lg">
          <Stack gap="md">
            <TextInput label="שם החוק" placeholder="לדוגמה: בדיקת תהליכים מותאמת" value={customRuleForm.name} onChange={(e) => setCustomRuleForm({...customRuleForm, name: e.currentTarget.value})} required />
            <Textarea label="מטרת החוק" placeholder="למה משמש החוק..." value={customRuleForm.purpose} onChange={(e) => setCustomRuleForm({...customRuleForm, purpose: e.currentTarget.value})} minRows={2} />
            <Group grow><TextInput label="טכנולוגיה" value="CUSTOM" disabled /><TextInput label="צוות אחראי" value={team.name} disabled /></Group>
            <TextInput label="שאילתת PromQL" placeholder="לדוגמה: up == 1" value={customRuleForm.query} onChange={(e) => setCustomRuleForm({...customRuleForm, query: e.currentTarget.value})} required dir="ltr" />
            <Button fullWidth mt="md" color="blue" onClick={handleSaveCustomRule} disabled={!customRuleForm.name || !customRuleForm.query}>שמור חוק וקשר לרכיב</Button>
          </Stack>
        </Modal>
      </div>
    </div>
  );
}