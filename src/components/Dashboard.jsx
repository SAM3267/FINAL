// Dashboard.jsx
import React, { useState, useEffect, Fragment, useRef } from 'react';
import axios from 'axios';
import { ThemeIcon, AppShell, Container, Paper, Group, Title, Text, Button, TextInput, Stack, Menu, Tabs, SimpleGrid, Card, CopyButton, Code, ActionIcon, Select, Badge, Modal, Grid, Center, Loader, Table, ScrollArea, Accordion, Image, PasswordInput, Textarea, List, NumberInput, Tooltip, Affix, Transition, Collapse, Checkbox, Divider, Alert, Radio } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconChevronUp, IconSend, IconListDetails, IconSitemap, IconFileText, IconShield, IconRocket, IconRadar, IconAppWindow, IconTerminal2, IconCopy, IconCheck, IconFilter, IconServer, IconSettings, IconTrash, IconPlus, IconDeviceFloppy, IconSchool, IconReportAnalytics, IconFolder, IconPlayerPlay, IconHistory, IconCode, IconChartLine, IconArrowDownCircle, IconAlertTriangle, IconList, IconBriefcase, IconSearch, IconWorld, IconRestore, IconX, IconEdit, IconCube, IconDatabase, IconLogin, IconLogout, IconClock, IconPlayerPause, IconSearch as IconSearch2, IconChevronRight, IconChevronLeft, IconCrosshair, IconInfoCircle, IconActivity, IconClipboardList } from '@tabler/icons-react';
import RulesTable from './RulesTable';
import { AddRuleModal } from './AddRuleModal';
import ArchitectureScanner from './ArchitectureScanner';
import bgDashboard from '../assets/background_dashbord.png';
import { API_BASE_URL } from '../config';
import Editor from '@monaco-editor/react';
import iconLogs from '../assets/iconNitur/logs.webp';
import iconMessages from '../assets/iconNitur/messages.png';
import iconStorage from '../assets/iconNitur/storage.png';
import iconCustom from '../assets/iconNitur/custom.png';
import image1 from '../assets/image_1.png';

const pulseAnimation = `
  @keyframes activePulse {
    0% { box-shadow: 0 0 0 0 rgba(51, 154, 240, 0.7); transform: scale(1); border-color: #339af0; }
    70% { box-shadow: 0 0 0 15px rgba(51, 154, 240, 0); transform: scale(1.05); border-color: #74c0fc; }
    100% { box-shadow: 0 0 0 0 rgba(51, 154, 240, 0); transform: scale(1); border-color: #339af0; }
  }
`;

const iconMap = {
  IconShield: <IconShield size={32} color="#1c7ed6" />,
  IconRocket: <IconRocket size={32} color="#f59f00" />,
  IconRadar: <IconRadar size={32} color="#e03131" />,
  IconServer: <IconServer size={32} color="#40c057" />
};

export const getNiturIconSrc = (tech) => {
  if (!tech) return iconStorage;
  const t = tech.toLowerCase();
  if (t === 'elastic_log') return iconLogs;
  if (t === 'custom') return iconCustom;
  if (['rabbit', 'rabbitmq', 'nifi', 'kafka'].includes(t)) return iconMessages;
  return iconStorage;
};


const RuleStatusBadge = ({ rule }) => {
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    // דילוג על חיפוש ל-PromQL אם מדובר בחוק וירטואלי שטרם נקבעו לו labels
    if (!rule || (rule.tech === 'CUSTOM' && rule.node === 'GENERIC') || rule.node === 'SYS_GENERIC' || !rule.query) {
        setStatus('success'); 
        return;
    }

    setStatus('loading');
    const endpoint = rule.tech === 'elastic_log' ? '/check_elastic' : '/check_promql';
    const payload = rule.tech === 'elastic_log' ? { index: rule.indexName, query: rule.query } : { query: rule.query };
    
    axios.post(`${API_BASE_URL}${endpoint}`, payload)
      .then(res => {
        if (rule.tech === 'elastic_log') {
          setStatus(res.data.status === 'success' ? 'success' : 'error');
        } else {
          setStatus(res.data.status);
        }
      })
      .catch(() => setStatus('error'));
  }, [rule]);

  if (status === 'loading') return <Loader size="xs" />;
  if (status === 'success') return <Badge color="teal" variant="light" leftSection={<IconCheck size={12}/>}>תקין ורץ</Badge>;
  if (status === 'partial') return <Badge color="yellow" variant="light" leftSection={<IconAlertTriangle size={12}/>}>חלקי</Badge>;
  return <Badge color="red" variant="light" leftSection={<IconX size={12}/>}>שגיאה / חסר מידע</Badge>;
};

export default function Dashboard({ onLogout, username, userRole: initialRole }) {
  const [currentRole, setCurrentRole] = useState(initialRole || 'admin');

  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  // --- States for Library Installer ---
  const [installLibName, setInstallLibName] = useState('');
  const [installLogs, setInstallLogs] = useState(null);
  const [isInstallingLib, setIsInstallingLib] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [nodesOverviewOpened, setNodesOverviewOpened] = useState(false);
  const [syncManagementOpened, setSyncManagementOpened] = useState(false); // סטייט חדש להפרדה
  const [nodeSearchTerm, setNodeSearchTerm] = useState('');
  const [selectedNodesVersionIdx, setSelectedNodesVersionIdx] = useState(-1);
  const [selectedRulesVersionIdx, setSelectedRulesVersionIdx] = useState(-1);
  const [historyTab, setHistoryTab] = useState('nodes');
  const [clickedNodeRulesModal, setClickedNodeRulesModal] = useState({ opened: false, nodeName: '', rules: [], type: '' });
  const [syncHistory, setSyncHistory] = useState({ nodes_history: [], rules_history: [], last_sync: '' });
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [isSyncingRules, setIsSyncingRules] = useState(false);
  const [expandedElasticRuleId, setExpandedElasticRuleId] = useState(null);
// --- States for Elastic Cards (Live Count & Inline Edit) ---
  const [liveCounts, setLiveCounts] = useState({});
  const [isFetchingCount, setIsFetchingCount] = useState({});
  const [editingQueries, setEditingQueries] = useState({});
  const [editingTimeRanges, setEditingTimeRanges] = useState({}); // סטייט חדש לעריכת זמנים
  const fetchSyncStatus = async () => {
      try {
          const res = await axios.get(`${API_BASE_URL}/api/sync-status`);
          setSyncStatus(res.data);
      } catch (e) {}
  };

  const fetchSyncHistory = async () => {
      try {
          // תיקון ה-URL כך שיתאים בדיוק לראוט ב-Python: /api/sync-history
          const res = await axios.get(`${API_BASE_URL}/api/sync-history`);
          setSyncHistory(res.data);
      } catch (e) {
          console.error("Error fetching sync history:", e);
      }
  };

  const handleManualSync = async () => {
      setIsManualSyncing(true);
      try {
          await axios.post(`${API_BASE_URL}/api/sync/manual`);
          await fetchSyncStatus();
          await fetchSyncHistory();
      } catch(e) {
          alert("שגיאה בסנכרון הידני");
      }
      setIsManualSyncing(false);
  };

  useEffect(() => {
      fetchSyncStatus();
      const interval = setInterval(fetchSyncStatus, 60000); 
      return () => clearInterval(interval);
  }, []);

  useEffect(() => {
      if (nodesOverviewOpened) {
          fetchSyncHistory();
      }
  }, [nodesOverviewOpened]);

  

  const renderDiff = (historyArray, type) => {
      if (!historyArray || historyArray.length < 2) return <Text c="dimmed">אין מספיק היסטוריה כדי להציג שינויים.</Text>;
      
      // שליפת המערכים
      let current = historyArray[historyArray.length - 1][type] || [];
      let previous = historyArray[historyArray.length - 2][type] || [];
      
      // התיקון הקריטי: אם זה חוקים (אובייקטים), לחלץ מהם רק את הטקסט של השם
      if (type === 'rules') {
          current = current.map(r => r.name);
          previous = previous.map(r => r.name);
      }
      
      const currSet = new Set(current);
      const prevSet = new Set(previous);
      
      // מציאת ההבדלים אחרי שווידאנו שמדובר ב-Strings
      const added = current.filter(x => !prevSet.has(x));
      const removed = previous.filter(x => !currSet.has(x));
      
      return (
          <Stack gap="xs" mt="md">
              {added.length > 0 && (
                  <Paper p="xs" withBorder bg="teal.0" style={{ borderColor: '#40c057' }}>
                      <Text fw={800} c="teal.9">נוספו בגרסה האחרונה ({historyArray[historyArray.length - 1].date}):</Text>
                      <Group gap="xs" mt={4}>
                          {added.map((item, i) => <Badge key={`add-${i}`} color="teal">{item}</Badge>)}
                      </Group>
                  </Paper>
              )}
              {removed.length > 0 && (
                  <Paper p="xs" withBorder bg="red.0" style={{ borderColor: '#fa5252' }}>
                      <Text fw={800} c="red.9">הוסרו בגרסה האחרונה:</Text>
                      <Group gap="xs" mt={4}>
                          {removed.map((item, i) => <Badge key={`rem-${i}`} color="red">{item}</Badge>)}
                      </Group>
                  </Paper>
              )}
              {added.length === 0 && removed.length === 0 && <Text c="dimmed">לא היו שינויים בגרסה האחרונה.</Text>}
          </Stack>
      );
  };

  const [searchQuery, setSearchQuery] = useState('');

  const [editingRule, setEditingRule] = useState(null);
  const [selectedRuleForHistory, setSelectedRuleForHistory] = useState(null);
  const [historyOpened, setHistoryOpened] = useState(false);
  
  const [selectedArchTeam, setSelectedArchTeam] = useState(null);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [focusedNodeId, setFocusedNodeId] = useState(null);
  
  // -- סטייטים עבור העברת משמרת --
  const [shiftFaults, setShiftFaults] = useState([]);
  const [shiftSearch, setShiftSearch] = useState('');
  const [addShiftModal, setAddShiftModal] = useState({ opened: false, faultId: '', title: '', note: '', soldier: '' });
  const [currentShiftDate, setCurrentShiftDate] = useState(new Date());
  const [shiftSoldierName, setShiftSoldierName] = useState('טוען...');

  const formatShiftDate = (date) => {
      const d = date.getDate().toString().padStart(2, '0');
      const m = (date.getMonth() + 1).toString().padStart(2, '0');
      const y = date.getFullYear();
      return `${d}/${m}/${y}`;
  };

  useEffect(() => {
      const fetchSoldier = async () => {
          setShiftSoldierName('מאתר נתונים...');
          try {
              const dateStr = formatShiftDate(currentShiftDate);
              const res = await axios.get(`${API_BASE_URL}/api/shifts/soldier?date=${dateStr}`);
              setShiftSoldierName(res.data.soldierName || 'לא נמצא חייל למשמרת זו');
          } catch (e) {
              setShiftSoldierName('שגיאה / לא הוגדר');
          }
      };
      fetchSoldier();
  }, [currentShiftDate]);

  const handlePrevDay = () => { const d = new Date(currentShiftDate); d.setDate(d.getDate() - 1); setCurrentShiftDate(d); };
  const handleNextDay = () => { const d = new Date(currentShiftDate); d.setDate(d.getDate() + 1); setCurrentShiftDate(d); };
  const handleToday = () => { setCurrentShiftDate(new Date()); };

  useEffect(() => {
      axios.get(`${API_BASE_URL}/api/shifts`).then(res => setShiftFaults(res.data)).catch(console.error);
  }, []);


  const [activeTab, setActiveTab] = useState('home');
  const [rules, setRules] = useState([]);

  // חישוב חוקים חסרים/לא מלאים לאזהרה
  const incompleteRules = rules.filter(r => 
      !r.name || 
      !r.purposeRule || 
      !(r.query || r.queryMajor || r.queryCritical)
  );
  const [visibleTabs, setVisibleTabs] = useState(() => JSON.parse(localStorage.getItem('neptune_visible_tabs')) || { shifts: true, automations: true, exporter: true, queries: true });
  
  useEffect(() => {
      localStorage.setItem('neptune_visible_tabs', JSON.stringify(visibleTabs));
  }, [visibleTabs]);
  const [sysConfig, setSysConfig] = useState({ teams: [], roles: [], defaultRules: [] });
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [shiftSection, setShiftSection] = useState(null);
  const [shiftTeam, setShiftTeam] = useState(null);
  const [shiftAssignments, setShiftAssignments] = useState([{id: 1, date: '01/05', shift: '', onCall: ''}, {id: 2, date: '02/05', shift: '', onCall: ''}, {id: 3, date: '03/05', shift: '', onCall: ''}]);
  const sectionTeamsMap = { '673': ['חושן', 'אבנט', 'הנדסאר', 'גלקטיק'], '675': ['מאגמה', 'פלייר'], '676': ['קוברה', 'וויפר', 'ונום', 'ענקונדה'], '678': ['פגסוס', 'פאנטום', 'פלאש'], '679': ['ברק'] };


  const [selectedTechQuery, setSelectedTechQuery] = useState('rabbit');
  const [selectedRabbitTeam, setSelectedRabbitTeam] = useState(null);
  const [rabbitModalOpen, setRabbitModalOpen] = useState(false);
  const [rabbitForm, setRabbitForm] = useState({ vhost: '/', queue: '', reason: '' });
  
  // --- סטייטים היררכיים ומיפוי רכיבים מתקדם לאלסטיק ---
  const [appMonitoringTab, setAppMonitoringTab] = useState('rabbit');
  const [elasticEnvs, setElasticEnvs] = useState([]);
  
  // ניהול סביבה וטאבים פנימיים לאינדקסים
  const [selectedEnvForMgmt, setSelectedEnvForMgmt] = useState(null);
  const [envModalOpen, setEnvModalOpen] = useState(false);
  const [activeIndexTab, setActiveIndexTab] = useState(null);
  const [newIndexNameInput, setNewIndexNameInput] = useState('');
  const [customIndexes, setCustomIndexes] = useState({}); 
  const [elasticNodeOptions, setElasticNodeOptions] = useState([]);
  const [showNewQueryForm, setShowNewQueryForm] = useState(false); // סטייט לשליטה על הצגת טופס יצירת השליפה
  const [showNewIndexForm, setShowNewIndexForm] = useState(false); // סטייט ליצירת אינדקס מוסתר מאחורי כפתור
  
  // טופס חוק ניטור מקצועי כולל מיפוי רכיבים (רכיב יעד / טמפלייט)
  const [elasticForm, setElasticForm] = useState({ 
      query: '', 
      timeRange: '15m', 
      reason: '', 
      maktag: '',
      mappingType: 'node', 
      node: '', 
      mappingTemplate: '' 
  });
  const [isQueryTesting, setIsQueryTesting] = useState(false);
  const [queryTestResult, setQueryTestResult] = useState(null);

  // טעינת סביבות ורכיבי CPR מתוך השרת
  useEffect(() => {
      axios.get(`${API_BASE_URL}/api/elastic-envs`)
          .then(res => {
              setElasticEnvs(res.data);
              const initialIndexes = {};
              res.data.forEach(e => {
                  const envName = Object.keys(e)[0];
                  initialIndexes[envName] = ['app-logs-prod-*', 'security-gateway-*'];
              });
              setCustomIndexes(initialIndexes);
          }).catch(console.error);
  }, []);

  // משיכת רכיבים מהמאגר (בדיוק כמו בחוקי CUSTOM)
  useEffect(() => {
      const fetchElasticNodes = async () => {
          try {
              const res = await axios.get(`${API_BASE_URL}/api/components`);
              const formatted = res.data.map(c => ({ value: c.name, label: c.name }));
              setElasticNodeOptions(formatted);
          } catch(e) { console.error("Error fetching components for elastic", e); }
      };
      if (envModalOpen) {
          fetchElasticNodes();
      }
  }, [envModalOpen]);

  // --- סטייטים לסינון וחיפוש בתורי ראביט ---
  const [rabbitSearch, setRabbitSearch] = useState('');
  const [selectedVhost, setSelectedVhost] = useState(null);

  // --- המשתנים שהיו חסרים למודאל שאילתות מאוחדות ---
  const [appQueryModalOpen, setAppQueryModalOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [isCheckingRabbit, setIsCheckingRabbit] = useState(false);
  const [rabbitCheckResult, setRabbitCheckResult] = useState(null);

  // -- תוספת עבור עריכת ספי ראביט ונתונים חיים --
  const [editingRabbitThresholds, setEditingRabbitThresholds] = useState(null);
  const [rabbitLiveValues, setRabbitLiveValues] = useState({}); // שמירת ערכים נוכחיים: {ruleId: value}
  const [isLoadingLive, setIsLoadingLive] = useState(false);

  const extractParam = (query, param) => {
      if (!query) return '';
      const regex = new RegExp(`${param}="([^"]+)"`);
      const match = query.match(regex);
      return match ? match[1] : '';
  };

  const fetchLiveValues = async (teamId) => {
      setIsLoadingLive(true);
      const rabbitRules = rules.filter(r => r.tech === 'rabbit' && r.application === teamId);
      const newValues = {};
      
      await Promise.all(rabbitRules.map(async (r) => {
          try {
              // --- התיקון: החזרנו את הקריאה לשרת שמבקשת את הנתונים מ-Prometheus ---
              const res = await axios.post(`${API_BASE_URL}/check_promql`, {
                  query: r.query || r.queryMajor || r.queryCritical,
                  node: r.node || 'SYS_GENERIC',
                  mappingTemplate: r.mappingTemplate || '{{$labels.vhost}}-{{$labels.queue}}'
              });

              // ניווט בטוח למבנה הנתונים: מוודאים ש-parts_results הוא אכן מערך
              const results = res.data?.parts_results;
              
              // === דיבאג: בוא נראה בדיוק מה פרומטאוס עונה לנו ===
              console.log(`--- Debugging Rule: ${r.name} ---`);
              console.log("1. Exact Query sent to backend:", r.query);
              console.log("2. Raw Response from Prometheus:", results);
              // ====================================================

              if (Array.isArray(results) && results.length > 0) {
                  // מחפשים את החלק הראשון שיש בו מערך data עם נתונים
                  const partWithData = results.find(p => Array.isArray(p.data) && p.data.length > 0);
                  
                  // שימוש ב-Optional Chaining (?.) כדי למנוע קריסת JS אם value חסר
                  const val = partWithData?.data[0]?.value?.[1];
                  
                  if (val !== undefined) {
                      newValues[r.id] = val;
                      console.log(`3. Found Value! ->`, val);
                  } else {
                      newValues[r.id] = '0'; 
                      console.log(`3. No data returned from Prometheus (Empty Array). Set to 0.`);
                  }
              } else {
                  newValues[r.id] = '0'; 
              }
          } catch (e) {
              console.error(`Error fetching live value for rule ${r.id}:`, e);
              newValues[r.id] = '0'; 
          }
      }));
      setRabbitLiveValues(newValues);
      setIsLoadingLive(false);
  };

  const extractRabbitThreshold = (query) => {
      if (!query) return '';
      const match = query.match(/[><=]=?\s*(\d+(?:\.\d+)?)/);
      return match ? match[1] : '';
  };

  const handleSaveRabbitThresholds = async (ruleId) => {
      if (!editingRabbitThresholds) return;
      const rule = rules.find(r => r.id === ruleId);
      if (!rule) return;

      const reason = prompt("סיבת עדכון הספים (יופיע בהיסטוריה):", "עדכון ספים שוטף");
      if (reason === null) return; // User cancelled

      // חילוץ המטריקה הבסיסית נקייה ללא הסף הקודם
      const baseQuery = rule.query || (rule.queryMajor ? rule.queryMajor.replace(/\s*(?:>=|<=|>|<|==|!=)\s*[-+]?[0-9]*\.?[0-9]+\s*$/, '').trim() : '');

      const payload = {
          ...rule,
          queryMajor: `${baseQuery} >= ${editingRabbitThresholds.major}`,
          queryCritical: `${baseQuery} >= ${editingRabbitThresholds.critical}`,
          majorThreshold: parseInt(editingRabbitThresholds.major),
          criticalThreshold: parseInt(editingRabbitThresholds.critical),
          tsdb: 'unity', 
          reason: reason,
          user: username
      };

      try {
          await axios.put(`${API_BASE_URL}/rules/${rule.id}`, payload);
          fetchRules(); // רענון מול המונגו
          setEditingRabbitThresholds(null);
      } catch (e) {
          alert('שגיאה בעדכון הספים');
      }
  };
  // ----------------------------------

  // פונקציית האימות והוספת התור
  const handleAddRabbitQueue = async () => {
    if (!rabbitForm.vhost || !rabbitForm.queue || !rabbitForm.reason) return alert('נא למלא את כל השדות, כולל סיבת הוספה');
    setIsCheckingRabbit(true);
    setRabbitCheckResult(null);

    const queryToCheck = `rabbitmq_messages_ready_example{vhost="${rabbitForm.vhost}", queue="${rabbitForm.queue}"}`;

    try {
        const res = await axios.post(`${API_BASE_URL}/check_promql`, {
            query: queryToCheck,
            node: 'SYS_GENERIC',
            mappingTemplate: '{{$labels.vhost}}-{{$labels.queue}}'
        });

        if (res.data.status === 'error') {
            setRabbitCheckResult({ success: false, message: 'התור או ה-VHOST לא קיימים בפרומטאוס (לא מוחזרים נתונים).' });
        } else {
            const payload = {
                name: `rabbit_${selectedRabbitTeam.id}_${rabbitForm.queue}`,
                purposeRule: `ניטור תור RabbitMQ: ${rabbitForm.queue}`,
                query: queryToCheck,
                queryMajor: `${queryToCheck} >= 1000`,
                queryCritical: `${queryToCheck} >= 5000`,
                majorThreshold: 1000,
                criticalThreshold: 5000,
                tech: 'rabbit',
                tsdb: 'unity', 
                team: selectedRabbitTeam.name,
                application: selectedRabbitTeam.id,
                node: 'SYS_GENERIC', 
                mappingTemplate: '{{$labels.vhost}}-{{$labels.queue}}',
                user: username,
                reason: rabbitForm.reason
            };

            await axios.post(`${API_BASE_URL}/rules`, payload);
            setRabbitCheckResult({ success: true, message: 'התור אומת והתווסף בהצלחה!' });
            fetchRules(); 
            fetchLiveValues(selectedRabbitTeam.id); 

            setTimeout(() => {
                setRabbitCheckResult(null);
                setRabbitForm({ vhost: '/', queue: '', reason: '' });
            }, 3000);
        }
    } catch (e) {
        setRabbitCheckResult({ success: false, message: 'שגיאת תקשורת מול השרת.' });
    }
    setIsCheckingRabbit(false);
  };


  // פונקציה לשליפת חוקים
  const fetchRules = async () => {
      try {
          const res = await axios.get(`${API_BASE_URL}/rules`);
          setRules(res.data); 
      } catch (error) {
          console.error("Error fetching rules:", error);
      }
  };

  useEffect(() => {
      if (rules.length > 0 && syncHistory && !isSyncingRules) {
          const needsSync = rules.some(r => r.attachedComponents === undefined);
          if (needsSync) {
              runRuleSync(rules, syncHistory);
          }
      }
  }, [rules, syncHistory]);

  const runRuleSync = async (currentRules, syncData) => {
      setIsSyncingRules(true);
      const allNodesList = (syncData?.nodes_history?.[syncData.nodes_history.length - 1]?.nodes || [])
          .map(n => typeof n === 'string' ? { name: n } : n);

      const updatedRules = await Promise.all(currentRules.map(async (rule) => {
          if (rule.attachedComponents !== undefined) return rule;
          
          if (!rule.query && !rule.queryMajor && !rule.queryCritical) return { ...rule, attachedComponents: [] };
          
          if (rule.node && rule.node !== 'GENERIC' && rule.node !== 'SYS_GENERIC') {
              return { ...rule, attachedComponents: [rule.node] };
          }
          
          try {
              const query = rule.queryMajor || rule.queryCritical || rule.query;
              const strippedQuery = query.replace(/\s*(?:>=|<=|>|<|==|!=)\s*[^}]*$/, '').trim();
              const res = await axios.post(`${API_BASE_URL}/api/promql/labels`, { query: strippedQuery });
              const labelsArray = res.data.labels || [];
              
              const attachedNames = labelsArray.map(labels => {
                  const lowerLabels = {};
                  for (let k in labels) lowerLabels[k.toLowerCase()] = labels[k];
                  const tpl = rule.mappingTemplate || '{{$labels.label}}';
                  return tpl.replace(/\{+(?:\$labels\.)?([^}]+)\}+/gi, (m, p1) => {
                      const key = p1.trim().toLowerCase();
                      return lowerLabels[key] !== undefined ? lowerLabels[key] : m;
                  }).trim();
              });

              const validAttachments = attachedNames.filter(name => {
                  const sName = name.toLowerCase();
                  return allNodesList.some(n => {
                      const data = n.data || {};
                      const searchFields = [n.name, n.label, n.id, data.label, data.name];
                      return searchFields.filter(Boolean).some(f => String(f).toLowerCase() === sName);
                  });
              });

              return { ...rule, attachedComponents: [...new Set(validAttachments)] };
          } catch (e) { 
              return { ...rule, attachedComponents: [] }; 
          }
      }));
      
      setRules(updatedRules);
      setIsSyncingRules(false);
  };
  const [customGenericMappings, setCustomGenericMappings] = useState({});

  const [adminTeams, setAdminTeams] = useState([]);
  const [adminApps, setAdminApps] = useState([]);
  const [adminTechsStr, setAdminTechsStr] = useState('[]');
  const [adminRolesStr, setAdminRolesStr] = useState('{}');
  const [adminGuideLinksStr, setAdminGuideLinksStr] = useState('{}');
  const [adminGenericTemplatesStr, setAdminGenericTemplatesStr] = useState('{}');
  const [adminLearnUrl, setAdminLearnUrl] = useState('');
  
  

  // --- Advanced Smart Verify State ---
  const [advancedVerifyOpen, setAdvancedVerifyOpen] = useState(false);
  const [advancedVerifyRule, setAdvancedVerifyRule] = useState(null);
  const [advancedVerifyTemplate, setAdvancedVerifyTemplate] = useState('{{$labels.vhost}}-{{$labels.queue}}');
  const [advancedVerifyResults, setAdvancedVerifyResults] = useState([]);
  const [isAdvancedVerifyLoading, setIsAdvancedVerifyLoading] = useState(false);
  const [adminHomeConfig, setAdminHomeConfig] = useState({
      wip: '', start_time: '', end_time: '', is_24_7: false,
      soldier_source: 'manual', // <--- השדה החדש
      soldier_name: '', soldier_user: '',
      contacts: []
  });

  const [newTeamId, setNewTeamId] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [newApp, setNewApp] = useState('');

  const [editingTeamIndex, setEditingTeamIndex] = useState(null);
  const [newTrackId, setNewTrackId] = useState('');
  const [newTrackName, setNewTrackName] = useState('');
  const [adminEditorModal, setAdminEditorModal] = useState({ opened: false, title: '', field: '' });
  const [adminJsonError, setAdminJsonError] = useState(null);
  const [genericRuleModalOpen, setGenericRuleModalOpen] = useState(false);
  const [genericRuleForm, setGenericRuleForm] = useState({ id: null, name: '', purpose: '', query: '', mappingTemplate: '{{$labels.label}}', team: 'כללי', application: 'ALL' });
  const [genericRuleJump, setGenericRuleJump] = useState(null);
const [summaryModal, setSummaryModal] = useState({ opened: false, type: null, team: null, track: null });
// מנגנון רענון חי (Live Polling) לסיכום הניטורים
  useEffect(() => {
      let interval;
      if (summaryModal.opened) {
          fetchRules(); // רענון חוקים
          interval = setInterval(() => {
              fetchRules();
          }, 3000);
      }
      return () => clearInterval(interval);
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summaryModal.opened]);
const [summaryFilter, setSummaryFilter] = useState('all');
const [summarySearch, setSummarySearch] = useState('');
const [summaryRuleDetails, setSummaryRuleDetails] = useState(null);
  const [genericNavigateModalOpen, setGenericNavigateModalOpen] = useState(false);
  const [genericNavigateLoading, setGenericNavigateLoading] = useState(false);
  const [genericNavigateData, setGenericNavigateData] = useState([]);
  const [genericNavigateRule, setGenericNavigateRule] = useState(null);

  // --- FIFA Style Tech Carousel ---
  const [fifaTechIndex, setFifaTechIndex] = useState(0);

  // --- כלי בדיקת קיום רכיבים (Check if Exists) ---
  const [checkExistsModal, setCheckExistsModal] = useState({
      open: false,
      inputType: 'rule', // 'rule' או 'promql'
      selectedRuleId: null,
      promqlQuery: '',
      mappingTemplate: '{{$labels.vhost}}-{{$labels.queue}}',
      results: null,
      loading: false
  });

  // Automations State
  const [folders, setFolders] = useState([]);
  const [automations, setAutomations] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [autoModalOpen, setAutoModalOpen] = useState(false);
  
  const [autoForm, setAutoForm] = useState({ name: '', metric_query: '', operator: '>', threshold: 0, python_code: '', action_type: 'script' });
  const [promqlModalOpen, setPromqlModalOpen] = useState(false);
  const [pythonModalOpen, setPythonModalOpen] = useState(false);
  
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const [restartModalOpen, setRestartModalOpen] = useState(false);
  const [restartForm, setRestartForm] = useState({ restartType: 'server', server: '', service: '', process: '' });

  const [promqlGraphData, setPromqlGraphData] = useState([]);
  const [isGraphLoading, setIsGraphLoading] = useState(false);
  const [pythonTestOutput, setPythonTestOutput] = useState('');
  const [isPythonError, setIsPythonError] = useState(false);
  const [autoHistoryModal, setAutoHistoryModal] = useState({ open: false, auto: null });
const [downloadsMenuOpen, setDownloadsMenuOpen] = useState(false);
  const [autoGraphStartTime, setAutoGraphStartTime] = useState('');
  const [autoGraphEndTime, setAutoGraphEndTime] = useState('');
  const [autoHoverPoint, setAutoHoverPoint] = useState(null);
  
  // Choter State
// Choter State
  const [choterGroups, setChoterGroups] = useState([]);
  const [choterStations, setChoterStations] = useState([]);
  const [selectedChoterGroup, setSelectedChoterGroup] = useState(null);
  const [newChoterGroupName, setNewChoterGroupName] = useState('');
  const [choterStationModalOpen, setChoterStationModalOpen] = useState(false);
  const [choterSettingsModalOpen, setChoterSettingsModalOpen] = useState(false); // <-- זו השורה שהייתה חסרה!
  const [editingStationId, setEditingStationId] = useState(null);
  const [choterHistoryModal, setChoterHistoryModal] = useState({ open: false, group: null }); // <-- זו השורה שהייתה חסרה!
  const [choterHistoryDateFilter, setChoterHistoryDateFilter] = useState('all');
  const [quickDelayModal, setQuickDelayModal] = useState({ open: false, station: null, delay: 0 });
  const [choterGroupSettings, setChoterGroupSettings] = useState({ interval_minutes: 5, trigger_script: '', export_to_metrics: false });
    const [choterStationForm, setChoterStationForm] = useState({ name: '', tech: 'elastic', eck_url: '', query: '', time_range_minutes: 15, condition_operator: '>', condition_value: 0, station_role: 'intermediate', order: 1, delay_seconds: 0 });
  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isRunningGroup, setIsRunningGroup] = useState(false);
  const [liveLogs, setLiveLogs] = useState([]);
  const [triggerTestResult, setTriggerTestResult] = useState("");
  const [isTestingTrigger, setIsTestingTrigger] = useState(false);
  const [activeStationId, setActiveStationId] = useState(null);
    const [activeStationName, setActiveStationName] = useState(null); // המשתנה החדש שלנו
  // Existence Cubes State
  const [existenceCubes, setExistenceCubes] = useState([]);
  const [existenceStates, setExistenceStates] = useState({});
  const [existenceModalOpen, setExistenceModalOpen] = useState(false);
  const [existenceForm, setExistenceForm] = useState({ id: null, name: '', description: '', script: '' });
const [exporterHistoryModal, setExporterHistoryModal] = useState({ open: false, cube: null });
  // Exporter Cubes State
  const [exporterCubes, setExporterCubes] = useState([]);
  const [exporterModalOpen, setExporterModalOpen] = useState(false);
  const [exporterForm, setExporterForm] = useState({ id: null, name: '', description: '', python_code: '', interval_minutes: 1, update_mode: 'overwrite' });
  const [exporterTestOutput, setExporterTestOutput] = useState('');
  const [isExporterError, setIsExporterError] = useState(false);
  // Admin Packages State
  const [newPackage, setNewPackage] = useState('');
  const [installLog, setInstallLog] = useState('');
  const [isInstalling, setIsInstalling] = useState(false);

  const [tick, setTick] = useState(0);
  const logScrollRef = useRef(null);
    const [pendingPRs, setPendingPRs] = useState([]);
    const [reviewRequest, setReviewRequest] = useState(null);
    const [weekiData, setWeekiData] = useState(null);

    useEffect(() => {
      // מושך נתונים מ-WEEKI רק אם המשתמש הוא Viewer בטאב הבית, והמקור מוגדר ל-WEEKI
      if (activeTab === 'home' && sysConfig?.home_config?.soldier_source === 'weeki') {
          const today = new Date().toISOString().split('T')[0]; // מביא תאריך בפורמט YYYY-MM-DD
          
          // --- כאן שמים את כתובת ה-API האמיתית של ה-WEEKI שלכם ---
          axios.get(`https://weeki-api-url/getShift?date=${today}`)
              .then(res => {
                  setWeekiData({
                      name: res.data.soldierName, // שנה את זה לשדה האמיתי שמחזיר ה-API
                      user: res.data.jabberUser   // שנה את זה לשדה האמיתי שמחזיר ה-API
                  });
              })
              .catch(err => {
                  console.error('Failed to fetch from WEEKI', err);
                  setWeekiData({ name: 'שגיאה במשיכת הנתונים מ-WEEKI', user: '' });
              });
            }
        }, [activeTab, sysConfig]);
    useEffect(() => {
      // מעביר את ה-Viewer למסך הבית כברירת מחדל, אבל מאפשר לו להיות גם בסורק ובמשמרות
      if (currentRole === 'viewer' && activeTab !== 'scanner' && activeTab !== 'home' && activeTab !== 'shifts') {
          setActiveTab('home');
      }
  }, [currentRole, activeTab]);
    // פונקציה לשליפת הבקשות מהשרת
    const fetchPRs = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/prs`);
            setPendingPRs(res.data || []);
        } catch (e) {
            console.error("Error fetching PRs:", e);
        }
    };
  const toLocalISO = (d) => (new Date(d - (new Date()).getTimezoneOffset() * 60000)).toISOString().slice(0, 16);

  useEffect(() => {
    if (promqlModalOpen && !autoGraphStartTime) {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        setAutoGraphStartTime(toLocalISO(oneHourAgo));
        setAutoGraphEndTime(toLocalISO(now));
    }
  }, [promqlModalOpen]);

  useEffect(() => {
      if (logScrollRef.current) {
          logScrollRef.current.scrollTo({ top: logScrollRef.current.scrollHeight, behavior: 'smooth' });
      }
  }, [liveLogs]);

  useEffect(() => {
      const timer = setInterval(() => setTick(t => t + 1), 1000);
      return () => clearInterval(timer);
  }, []);


  const handleRunCheckExists = async (specificRule = null) => {
      setCheckExistsModal(prev => ({ ...prev, loading: true, results: null }));
      let queryToRun = "";
      let expectedNodeFromRule = null;
      let mappingTpl = checkExistsModal.mappingTemplate;

      if (specificRule) {
          queryToRun = specificRule.queryMajor || specificRule.queryCritical || specificRule.query;
          mappingTpl = specificRule.mappingTemplate || '{{$labels.label}}';
          if (specificRule.node && specificRule.node !== 'GENERIC' && specificRule.node !== 'SYS_GENERIC') expectedNodeFromRule = specificRule.node;
      } else if (checkExistsModal.inputType === 'rule') {
          const rule = rules.find(r => r.id === checkExistsModal.selectedRuleId);
          if (!rule) { setCheckExistsModal(prev => ({ ...prev, loading: false })); return; }
          queryToRun = rule.queryMajor || rule.queryCritical || rule.query;
          mappingTpl = rule.mappingTemplate || '{{$labels.label}}';
          if (rule.node && rule.node !== 'GENERIC' && rule.node !== 'SYS_GENERIC') expectedNodeFromRule = rule.node;
      } else {
          queryToRun = checkExistsModal.promqlQuery;
      }

      try {
          const rawSegments = queryToRun.split(/(?:\s+or\s+|\n\s*or\s*\n)/i).map(s => s.trim()).filter(Boolean);
          let allExtractedLabels = [];
          let allRawLabels = [];

          for (const segment of rawSegments) {
              try {
                  const strippedQuery = segment.replace(/\s*(?:>=|<=|>|<|==|!=)\s*[^}]*$/, '').trim();
                  const res = await axios.post(`${API_BASE_URL}/api/promql/labels`, { query: strippedQuery });
                  const labelsArray = res.data.labels || [];

                  labelsArray.forEach(labels => {
                      allRawLabels.push(labels);
                      const lowerLabels = {};
                      for (let k in labels) lowerLabels[k.toLowerCase()] = labels[k];

                      let resolvedName = expectedNodeFromRule;
                      if (!expectedNodeFromRule || expectedNodeFromRule === 'GENERIC' || expectedNodeFromRule === 'SYS_GENERIC') {
                          resolvedName = mappingTpl.replace(/\{+(?:\$labels\.)?([^}]+)\}+/gi, (m, p1) => {
                              const key = p1.trim().toLowerCase();
                              return lowerLabels[key] !== undefined ? lowerLabels[key] : m;
                          });
                      }
                      allExtractedLabels.push(resolvedName.trim());
                  });
              } catch (e) { console.error(e); }
          }

          const uniqueLabels = [...new Set(allExtractedLabels)];
          
          let latestSyncedNodes = [];
          if (syncHistory?.nodes_history?.length > 0) {
              const lastSync = syncHistory.nodes_history[syncHistory.nodes_history.length - 1];
              if (Array.isArray(lastSync.nodes)) {
                  latestSyncedNodes = lastSync.nodes.map(n => typeof n === 'string' ? { name: n, id: n } : n);
              }
          }

          const allNodes = latestSyncedNodes;
          
          let finalResults = [];
          if (uniqueLabels.length > 0) {
              finalResults = uniqueLabels.map(label => {
                  const searchLabel = label.toLowerCase().trim();
                  let foundNode = null;
                  const exists = allNodes.some(n => {
                      const data = n.data || {};
                      const searchFields = [n.name, n.label, n.id, data.label, data.name];
                      const isMatch = searchFields.filter(Boolean).some(s => {
                          const val = String(s).toLowerCase().trim();
                          return val === searchLabel || val.includes(searchLabel);
                      });
                      if (isMatch) foundNode = n;
                      return isMatch;
                  });
                  return {
                      name: label,
                      hasNode: exists,
                      node: foundNode,
                      color: exists ? 'teal' : 'red',
                      title: exists ? 'אותר במאגר' : 'חסר במאגר',
                      reason: exists ? 'המטריקה חיה, ואותר רכיב תואם במאגר המערכת.' : 'המטריקה חיה, אך הרכיב לא אותר במאגר המערכת כלל.'
                  };
              });
          } else {
              finalResults.push({
                  name: expectedNodeFromRule || 'שאילתה ללא דאטה',
                  hasNode: !!expectedNodeFromRule,
                  color: 'red',
                  title: 'אין נתונים',
                  reason: 'השאילתה לא מחזירה כרגע נתונים מ-Prometheus.'
              });
          }
          
          setCheckExistsModal(prev => ({ 
              ...prev, 
              loading: false, 
              results: finalResults, 
              rawLabels: allRawLabels, 
              selectedRuleName: specificRule ? specificRule.name : prev.selectedRuleName, 
              isAutoMode: !!specificRule 
          }));
      } catch (e) { setCheckExistsModal(prev => ({ ...prev, loading: false, results: [] })); }
  };
  const fetchConfig = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/config`);
      setSysConfig(res.data);
      setAdminTeams(res.data.teams || []);
      setAdminApps(res.data.apps || []);
      setAdminTechsStr(JSON.stringify(res.data.techs || [], null, 2));
      setAdminRolesStr(JSON.stringify(res.data.roles || {}, null, 2));
      setAdminGuideLinksStr(JSON.stringify(res.data.guide_links || {}, null, 2));
      setAdminGenericTemplatesStr(JSON.stringify(res.data.generic_templates || {}, null, 2));
      setAdminLearnUrl(res.data.learn_url || '');
      
      setAdminHomeConfig(res.data.home_config || { wip: '', start_time: '', end_time: '', is_24_7: false, soldier_source: 'manual', soldier_name: '', soldier_user: '', contacts: [] });
    } catch (error) { console.error('Error fetching config:', error); }
    };



  useEffect(() => {
    let isMounted = true;
    const calculateMappings = async () => {
        const mappings = {};
        // התיקון: תמיכה גם בחוקים גנריים רגילים וגם במערכתיים (כמו ראביט)
        const genericRules = rules.filter(r => r.node === 'GENERIC' || r.node === 'SYS_GENERIC');
        
        const latestSyncedNodes = (syncHistory?.nodes_history?.[syncHistory?.nodes_history?.length - 1]?.nodes || [])
            .map(n => typeof n === 'string' ? { id: n, name: n } : n);

        await Promise.all(genericRules.map(async (rule) => {
            try {
                const queryToProcess = rule.queryMajor || rule.queryCritical || rule.query || '';
                if (!queryToProcess) return;

                const segments = queryToProcess.split(/(\s+(?:or|and|unless)\s+)/i);
                
                const cleanedSegments = segments.map(seg => {
                    if (/^\s+(or|and|unless)\s+$/i.test(seg)) return ' or ';
                    const opMatch = seg.match(/(.*?)\s*(>=|<=|>|<|==|!=)\s*([0-9\.]+.*|{{.*}}.*)$/i);
                    return opMatch ? opMatch[1].trim() : seg.trim();
                });
                
                const baseQuery = cleanedSegments.join('');

                const res = await axios.post(`${API_BASE_URL}/api/promql/labels`, { query: baseQuery });
                const labelsArray = res.data.labels || [];
                const ruleNodes = [];
                const resolvedNames = [];
                
                labelsArray.forEach(labels => {
                    const lowerLabels = {};
                    for(let k in labels) lowerLabels[k.toLowerCase()] = labels[k];

                    const resolvedName = (rule.mappingTemplate || '').replace(/\{+(?:\$labels\.)?([^}]+)\}+/gi, (match, p1) => {
                        const key = p1.trim().toLowerCase();
                        return lowerLabels[key] !== undefined ? lowerLabels[key] : match;
                    });
                    const resolvedStr = resolvedName.trim().toLowerCase();
                    resolvedNames.push(resolvedStr);

                    latestSyncedNodes.forEach(n => {
                        const data = n.data || {};
                        const nodeMatchStrings = [
                            data.label, n.name, n.id 
                        ].filter(Boolean).map(s => String(s).trim().toLowerCase());
                        
                        if (nodeMatchStrings.some(str => str === resolvedStr || str.includes(resolvedStr))) {
                            ruleNodes.push({ nodeId: n.id, node: n });
                        }
                    });
                });
                mappings[rule.id] = { ruleNodes, resolvedNames };
            } catch (e) {
                mappings[rule.id] = { ruleNodes: [], resolvedNames: [] };
            }
        }));
        
        if (isMounted) setCustomGenericMappings(mappings);
    };
    
    if (rules.length > 0 && syncHistory) {
        calculateMappings();
    }
    return () => { isMounted = false; };
  }, [rules, syncHistory]);

  const fetchAutomationsData = async () => {
    try {
      const [fRes, aRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/automations/folders`),
        axios.get(`${API_BASE_URL}/api/automations`)
      ]);
      setFolders(fRes.data);
      setAutomations(aRes.data);
    } catch (e) { console.error("Error fetching automations", e); }
  };

  const fetchChoterData = async () => {
      try {
          const [gRes, sRes] = await Promise.all([
              axios.get(`${API_BASE_URL}/api/choter/groups`),
              axios.get(`${API_BASE_URL}/api/choter/stations`)
          ]);
          setChoterGroups(gRes.data);
          setChoterStations(sRes.data);
      } catch (e) { console.error("Error fetching choter data", e); }
  };

  const fetchExistenceCubes = async () => {
      try {
          const res = await axios.get(`${API_BASE_URL}/api/existence/cubes`);
          setExistenceCubes(res.data);
          setExistenceStates(prev => {
              const newState = { ...prev };
              res.data.forEach(c => {
                  if (!newState[c.id]) newState[c.id] = { input: '', status: 'idle', log: '', loading: false };
              });
              return newState;
          });
      } catch (e) { console.error("Error fetching existence cubes", e); }
  };

  const fetchExporterCubes = async () => {
      try {
          const res = await axios.get(`${API_BASE_URL}/api/exporter/cubes`);
          setExporterCubes(res.data);
      } catch (e) { console.error("Error fetching exporter cubes", e); }
  };

const fetchElasticLogs = async (groupId) => {
      try {
          const res = await axios.get(`${API_BASE_URL}/api/choter/groups/${groupId}/logs`);
          if(res.data.status === 'success') {
              const fetchedLogs = res.data.logs;
              setLiveLogs(fetchedLogs);
              
              // הפעלת הפנס לפי הלוגים (רק אם אנחנו לא בריצה יזומה כרגע)
              if (fetchedLogs.length > 0 && !isRunningGroup) {
                  // רצים מהסוף להתחלה כדי למצוא את הפעולה הכי עדכנית
                  for (let i = fetchedLogs.length - 1; i >= 0; i--) {
                      const log = fetchedLogs[i];
                      const lowerLog = log.toLowerCase();
                      
                      if (lowerLog.includes("--- run completed")) {
                          setActiveStationId(null);
                          setActiveStationName(null);
                          break;
                      }
                      
                      let sName = null;
                      if (lowerLog.includes("checking station: ")) {
                          const idx = lowerLog.indexOf("checking station: ");
                          sName = log.substring(idx + 18).split(" (Query:")[0].trim();
                      } else if (lowerLog.includes("station [")) {
                          const idx = lowerLog.indexOf("station [");
                          sName = log.substring(idx + 9).split("]")[0].trim();
                      }
                      
                      if (sName) {
                          setActiveStationName(sName);
                          break;
                      }
                  }
              }
          }
      } catch (e) {}
  };

useEffect(() => { 
    fetchConfig();
    fetchRules(); 
    fetchAutomationsData();
    fetchChoterData();
    fetchExistenceCubes();
    fetchExporterCubes();
    fetchPRs(); // <-- הוספנו את זה
    
    const syncRulesToComponents = async (currentRules) => {
        const allNodes = (syncHistory?.nodes_history?.[syncHistory.nodes_history.length - 1]?.nodes || []).map(n => typeof n === 'string' ? { name: n } : n);

        const updatedRules = await Promise.all(currentRules.map(async (rule) => {
            if (!rule.query && !rule.queryMajor && !rule.queryCritical) return rule;
            
            try {
                const query = rule.queryMajor || rule.queryCritical || rule.query;
                const strippedQuery = query.replace(/\s*(?:>=|<=|>|<|==|!=)\s*[^}]*$/, '').trim();
                const res = await axios.post(`${API_BASE_URL}/api/promql/labels`, { query: strippedQuery });
                const labelsArray = res.data.labels || [];
                
                const attachedNames = labelsArray.map(labels => {
                    const lowerLabels = {};
                    for (let k in labels) lowerLabels[k.toLowerCase()] = labels[k];
                    
                    if (rule.node && rule.node !== 'GENERIC' && rule.node !== 'SYS_GENERIC') return rule.node;
                    
                    const tpl = rule.mappingTemplate || '{{$labels.label}}';
                    return tpl.replace(/\{+(?:\$labels\.)?([^}]+)\}+/gi, (m, p1) => {
                        const key = p1.trim().toLowerCase();
                        return lowerLabels[key] !== undefined ? lowerLabels[key] : m;
                    }).trim();
                });

                const validAttachments = attachedNames.filter(name => {
                    const sName = name.toLowerCase();
                    return allNodes.some(n => {
                        const data = n.data || {};
                        const searchFields = [n.name, n.label, n.id, data.label, data.name];
                        return searchFields.filter(Boolean).some(f => String(f).toLowerCase() === sName);
                    });
                });

                return { ...rule, attachedComponents: [...new Set(validAttachments)] };
            } catch (e) { return rule; }
        }));
        
        setRules(updatedRules);
    };

    const intervalId = setInterval(() => {
        fetchChoterData();
        fetchPRs(); 
        fetchExporterCubes();
        axios.get(`${API_BASE_URL}/rules`).then(res => {
            syncRulesToComponents(res.data);
        });
    }, 60000); // רץ כל דקה
    
    return () => clearInterval(intervalId);
  }, [username]);

useEffect(() => {
      let logsInterval;
      if(selectedChoterGroup) {
          // משיכה ראשונית
          fetchElasticLogs(selectedChoterGroup);
          
          // הגדרת טיימר שימשוך לוגים ונתונים כל 5 שניות
          logsInterval = setInterval(() => {
              fetchElasticLogs(selectedChoterGroup);
              fetchChoterData(); // מושך גם את הסטטוס של התחנות מהמסד כדי לצבוע אותן בלייב!
          }, 5000);
      }
      
      // ניקוי הטיימר כשיוצאים
      return () => {
          if (logsInterval) clearInterval(logsInterval);
      };
  }, [selectedChoterGroup]);

  const getExporterNextRunText = (cube) => {
      if (!cube.last_run_time) return "ממתין לריצה ראשונה...";
      try {
          const [datePart, timePart] = cube.last_run_time.split(' ');
          const [day, month, year] = datePart.split('/');
          const [hours, minutes, seconds] = timePart.split(':');
          const lastRunDate = new Date(year, month - 1, day, hours, minutes, seconds);
          
          const nextRunDate = new Date(lastRunDate.getTime() + (cube.interval_minutes || 1) * 60000);
          const diff = nextRunDate - new Date();
          
          if (diff <= 0) return "רץ ברגעים אלו / בהמתנה לתור...";
          
          const m = Math.floor(diff / 60000);
          const s = Math.floor((diff % 60000) / 1000);
          return `הריצה הבאה בעוד ${m} דקות ו-${s} שניות`;
      } catch(e) {
          return "מחשב זמן...";
      }
  };

  const getNextRunText = (group) => {
      if (group.is_paused) return "הריצה האוטומטית מושהית (Paused)";
      if (!group.last_run_time) return "ממתין לריצה ראשונה...";
      
      try {
          const [datePart, timePart] = group.last_run_time.split(' ');
          const [day, month, year] = datePart.split('/');
          const [hours, minutes, seconds] = timePart.split(':');
          const lastRunDate = new Date(year, month - 1, day, hours, minutes, seconds);
          
          const nextRunDate = new Date(lastRunDate.getTime() + (group.interval_minutes || 5) * 60000);
          const diff = nextRunDate - new Date();
          
          if (diff <= 0) return "רץ ברגעים אלו / בהמתנה לתור...";
          
          const m = Math.floor(diff / 60000);
          const s = Math.floor((diff % 60000) / 1000);
          return `הריצה הבאה בעוד ${m} דקות ו-${s} שניות`;
      } catch(e) {
          return "מחשב זמן...";
      }
  };


  // --- פונקציות ניהול אנשי קשר (מסך בית) ---
  const handleAddHomeContact = () => {
      setAdminHomeConfig({
          ...adminHomeConfig,
          contacts: [...(adminHomeConfig.contacts || []), { id: Date.now(), label: '', value: '' }]
      });
  };

  const handleUpdateHomeContact = (index, field, value) => {
      const newContacts = [...adminHomeConfig.contacts];
      newContacts[index][field] = value;
      setAdminHomeConfig({ ...adminHomeConfig, contacts: newContacts });
  };

  const handleRemoveHomeContact = (index) => {
      const newContacts = adminHomeConfig.contacts.filter((_, i) => i !== index);
      setAdminHomeConfig({ ...adminHomeConfig, contacts: newContacts });
  };
  // -----------------------------------------

  const syncAllGenericRules = async (teams, templates) => {
      try {
          const rulesRes = await axios.get(`${API_BASE_URL}/rules`);
          let currentRules = rulesRes.data;
          
          let latestNodes = [];
          if (syncHistory?.nodes_history?.length > 0) {
              const lastSync = syncHistory.nodes_history[syncHistory.nodes_history.length - 1];
              if (Array.isArray(lastSync.nodes)) {
                  latestNodes = lastSync.nodes.map(n => typeof n === 'string' ? { id: n, data: { tech: 'rabbit' } } : n);
              }
          }

          for (const team of teams) {
              const teamNodes = latestNodes;
              const uniqueTechs = ['rabbit']; 
              
              for (const tech of uniqueTechs) {
                  if (!['rabbit', 'rabbitmq'].includes(tech)) continue;
                  if (!templates[tech]) continue;
                  
                  let mappedTech = tech;
                  if (mappedTech === 'rabbit') mappedTech = 'rabbitmq';
                  if (mappedTech === 's3') mappedTech = 's3_storage';

                  const templatesList = templates[tech];
                  const groupedList = [];
                  const processed = new Set();
                  
                  templatesList.forEach((tpl) => {
                    let ruleName = (tpl.customRuleName || '').trim();
                    if (!ruleName) ruleName = `neptune_generic_${mappedTech}_{$team}`;

                    if (processed.has(ruleName)) return;
                    processed.add(ruleName);
                    
                    const related = templatesList.map((t, i) => ({t, i})).filter(item => {
                        if(!item || !item.t) return false;
                        let k = (item.t.customRuleName || '').trim();
                        if (!k) k = `neptune_generic_${mappedTech}_{$team}`;
                        return k.toLowerCase() === ruleName.toLowerCase();
                    });
        
                    groupedList.push({ 
                        ruleName: ruleName, 
                        purpose: related[0]?.t?.purpose || `חוק גנרי מובנה ל-${tech}`, 
                        templates: related 
                    });
                  });

                  const activeRuleNames = [];

                  for (const group of groupedList) {
                      let finalRuleName = group.ruleName.replace(/\{\$team\}/g, team.id || '').trim();
                      activeRuleNames.push(finalRuleName.toLowerCase());
                      
                      const activeQueries = [];
                      
                      group.templates.forEach((t) => {
                          const activeNodes = teamNodes;
                          
                          if (activeNodes.length > 0) {
                              const evaluateRuleTemplate = (query, nodeData, tpl) => {
                                  const suffix = tpl.suffix || '';
                                  return query.replace(/\{\{([^}\|]+)(?:\|([^}]+))?\}\}/g, (match, key, fallback) => {
                                      if (key === 'queue') return nodeData.queue || nodeData.label || '';
                                      if (key === 'vhost') return nodeData.vhost || '/';
                                      
                                      let val = undefined;
                                      if (key.toLowerCase().includes('threshold') || key.toLowerCase().includes('major') || key.toLowerCase().includes('critical')) {
                                          if (tpl.defaultThreshold !== undefined && tpl.defaultThreshold !== '') return tpl.defaultThreshold;
                                          if (fallback !== undefined) return fallback;
                                          if (key.toLowerCase().includes('critical')) return '95';
                                          if (key.toLowerCase().includes('major') || key.toLowerCase().includes('warning')) return '85';
                                      }
                                      
                                      if (fallback !== undefined) return fallback;
                                      return '0';
                                  });
                              };

                              const nodeQueries = activeNodes.map(node => evaluateRuleTemplate(t.t.query, node.data, t.t));
                              activeQueries.push(...nodeQueries);
                          }
                      });
                      
                      const existingGroupRules = currentRules.filter(r => r.node === 'SYS_GENERIC' && r.application === team.id && r.tech === tech && r.name.toLowerCase() === finalRuleName.toLowerCase());
                      
                      if (activeQueries.length === 0) {
                          for (const r of existingGroupRules) {
                              if (r.id) { try { await axios.delete(`${API_BASE_URL}/rules/${r.id}`); } catch(e) {} }
                          }
                          continue;
                      }
                      
                      const uniqueQueries = [...new Set(activeQueries)];
                      const combinedQuery = uniqueQueries.join(' or ');
                      
                      const payload = {
                          name: finalRuleName,
                          purpose: group.purpose,
                          query: combinedQuery,
                          tech: tech,
                          team: team.name || 'מערכתי',
                          application: team.id,
                          node: 'SYS_GENERIC',
                          subType: 'תשתיתי',
                          mappingTemplate: '{{$labels.label}}',
                          user: 'מערכת'
                      };
                      
                      try {
                          for (let i = 0; i < existingGroupRules.length; i++) {
                              if (existingGroupRules[i].id) {
                                  await axios.delete(`${API_BASE_URL}/rules/${existingGroupRules[i].id}`);
                              }
                          }
                          await axios.post(`${API_BASE_URL}/rules`, payload);
                      } catch(e) {}
                  }

                  try {
                      const res = await axios.get(`${API_BASE_URL}/rules`);
                      const latestRules = res.data;
                      const orphanRules = latestRules.filter(r => r.node === 'SYS_GENERIC' && r.tech === tech && r.application === team.id && !activeRuleNames.includes(r.name.toLowerCase()));
                      
                      for (const orphan of orphanRules) {
                          if (orphan.id) await axios.delete(`${API_BASE_URL}/rules/${orphan.id}`);
                      }
                  } catch(e) {}
              }
          }
          fetchRules();
      } catch (error) {
          console.error("Error syncing generic rules:", error);
      }
  };
  const saveAdminConfigToMongo = async () => {
    try {
        // פונקציית עזר שמונעת קריסה אם התיבה ריקה ומגנה על השמירה
        const safeParse = (str, fallback) => {
            if (!str || str.trim() === '') return fallback;
            return JSON.parse(str);
        };

        const parsedTemplates = safeParse(adminGenericTemplatesStr, {});
        
        const payload = {
            teams: adminTeams,
            apps: adminApps,
            techs: safeParse(adminTechsStr, []),
            roles: safeParse(adminRolesStr, {}),
            guide_links: safeParse(adminGuideLinksStr, {}),
            learn_url: adminLearnUrl,
            admins: sysConfig?.admins || [],
            generic_templates: parsedTemplates,
            home_config: adminHomeConfig
        };

        await axios.post(`${API_BASE_URL}/api/config`, payload);
        
        // סנכרון החוקים מול טבלת ה-DB בכל שינוי הגדרה!
        await syncAllGenericRules(adminTeams, parsedTemplates);
        
        alert('הגדרות המערכת נשמרו ב-MongoDB וסונכרנו מול טבלת החוקים בהצלחה!');
        fetchConfig(); // מושך מחדש את הנתונים כדי לרענן את הממשק
      } catch (error) {
          console.error('Error saving config:', error);
          // זיהוי חכם: האם הבעיה היא ב-JSON או בשרת?
          if (error instanceof SyntaxError) {
              alert('❌ שגיאת תחביר (JSON): יש בעיה באחת מתיבות העריכה שלך (כנראה פסיק מיותר או סוגריים חסרים). ודא שכולן תקינות.');
          } else {
              alert('❌ שגיאת שרת: השמירה נכשלה מול הבאקאנד. בדוק את השרת שלך.');
          }
      }
  };

  const validateAndCloseAdminModal = () => {
    try {
        if (adminEditorModal.field === 'roles') JSON.parse(adminRolesStr);
        if (adminEditorModal.field === 'techs') JSON.parse(adminTechsStr);
        if (adminEditorModal.field === 'guide_links') JSON.parse(adminGuideLinksStr);
        if (adminEditorModal.field === 'generic_templates') JSON.parse(adminGenericTemplatesStr);
        
        setAdminEditorModal({ opened: false, title: '', field: '' });
        setAdminJsonError(null);
    } catch (err) {
        setAdminJsonError("שגיאת JSON - פורמט לא חוקי: " + err.message);
    }
  };

  const handleAdminJsonChange = (val) => {
    setAdminJsonError(null);
    if (adminEditorModal.field === 'roles') setAdminRolesStr(val);
    if (adminEditorModal.field === 'techs') setAdminTechsStr(val);
    if (adminEditorModal.field === 'guide_links') setAdminGuideLinksStr(val);
    if (adminEditorModal.field === 'generic_templates') setAdminGenericTemplatesStr(val);
  };

  const handleInstallPackage = async () => {
      if(!newPackage) return;
      setIsInstalling(true);
      setInstallLog('מתחיל בהתקנה, אנא המתן...');
      try {
          const res = await axios.post(`${API_BASE_URL}/api/admin/install-package`, { package_name: newPackage });
          setInstallLog(res.data.message + '\n\n' + res.data.log);
      } catch(e) {
          setInstallLog('שגיאת תקשורת מול השרת בזמן ההתקנה.');
      }
      setIsInstalling(false);
  };


  
const handleTestExporterScript = async () => {
      if(!exporterForm.python_code) return;
      setExporterTestOutput('מריץ קוד מול השרת...');
      setIsExporterError(false);
      try {
         const res = await axios.post(`${API_BASE_URL}/api/exporter/test`, { python_code: exporterForm.python_code });
         if (res.data.status === 'error') {
             setIsExporterError(true);
             setExporterTestOutput(res.data.output);
         } else {
             setExporterTestOutput(res.data.output);
         }
      } catch(e) {
         setIsExporterError(true);
         setExporterTestOutput('שגיאת תקשורת עם השרת בזמן הריצה.');
      }
  };  
  // --- Exporter Cubes Methods ---
const handleOpenExporterModal = (cube = null) => {
      setExporterTestOutput('');
      setIsExporterError(false);
      if (cube) {
          setExporterForm({ id: cube.id, name: cube.name, description: cube.description, python_code: cube.python_code, interval_minutes: cube.interval_minutes || 1, update_mode: cube.update_mode || 'overwrite' });
      } else {
          setExporterForm({ 
              id: null, 
              name: '', 
              description: '', 
              python_code: "# האובייקטים Gauge ו-Counter כבר זמינים לך מראש!\n# אין צורך לייבא את prometheus_client\n\nimport requests\nimport random\n\n# דוגמה ל-Gauge פשוט:\nmy_gauge = Gauge('my_app_active_users', 'Number of active users')\nmy_gauge.set(42)\n\n# דוגמה ל-Gauge עם Labels:\napi_latency = Gauge('my_api_latency_seconds', 'API Latency', ['endpoint', 'method'])\napi_latency.labels(endpoint='/login', method='POST').set(random.uniform(0.1, 0.5))\n\n# דוגמה ל-Counter:\nerror_counter = Counter('my_app_errors_total', 'Total errors', ['type'])\nerror_counter.labels(type='db_timeout').inc(1)\n",
              interval_minutes: 1,
              update_mode: 'overwrite'
          });
      }
      setExporterModalOpen(true);
  };

const handleSaveExporterCube = async () => {
      if(!exporterForm.name) return;
      const payload = { ...exporterForm, user: username };
      
      try {
          if (exporterForm.id) {
              await axios.put(`${API_BASE_URL}/api/exporter/cubes/${exporterForm.id}`, payload);
          } else {
              await axios.post(`${API_BASE_URL}/api/exporter/cubes`, payload);
          }
          setExporterModalOpen(false);
          fetchExporterCubes();
      } catch (error) {
          console.error("Save Exporter Error:", error);
          
          let errorMsg = error.message;
          if (error.response?.data?.detail) {
              // השרת של FastAPI מחזיר פירוט מדויק של מה שחסר לו
              errorMsg = JSON.stringify(error.response.data.detail, null, 2);
          }
          
          alert("שגיאה בשמירת האקספורטר מול השרת:\n" + errorMsg + "\n\n(אם השגיאה היא מסוג 422, זה אומר ששרת הפייתון עדיין רץ עם המבנה הישן. כבה אותו לחלוטין ב-PyCharm והדלק מחדש!)");
      }
  };

  const handleDeleteExporterCube = async (id) => {
      if(!window.confirm("למחוק קוביית אקספורטר זו?")) return;
      await axios.delete(`${API_BASE_URL}/api/exporter/cubes/${id}`);
      fetchExporterCubes();
  };

  // --- Existence Cubes Methods ---
  const handleOpenExistenceModal = (cube = null) => {
      if (cube) {
          setExistenceForm({ id: cube.id, name: cube.name, description: cube.description, script: cube.script });
      } else {
          setExistenceForm({ 
              id: null, 
              name: '', 
              description: '', 
              script: "# You have access to: input_id (string)\n# Set result to True or False\n\nimport requests\n\n# res = requests.get(f'http://my-api/{input_id}')\n# result = res.status_code == 200\n\nresult = True" 
          });
      }
      setExistenceModalOpen(true);
  };

  const handleSaveExistenceCube = async () => {
      if(!existenceForm.name) return;
      const payload = { ...existenceForm, user: username };
      if (existenceForm.id) {
          await axios.put(`${API_BASE_URL}/api/existence/cubes/${existenceForm.id}`, payload);
      } else {
          await axios.post(`${API_BASE_URL}/api/existence/cubes`, payload);
      }
      setExistenceModalOpen(false);
      fetchExistenceCubes();
  };

  const handleDeleteExistenceCube = async (id) => {
      if(!window.confirm("למחוק קוביה זו?")) return;
      await axios.delete(`${API_BASE_URL}/api/existence/cubes/${id}`);
      fetchExistenceCubes();
  };

  const handleRunExistenceCheck = async (cubeId) => {
      const inputId = existenceStates[cubeId]?.input || '';
      if (!inputId) return alert("יש להזין מזהה לפני הבדיקה.");
      
      setExistenceStates(prev => ({ ...prev, [cubeId]: { ...prev[cubeId], loading: true, status: 'idle', log: '' } }));
      
      try {
          const res = await axios.post(`${API_BASE_URL}/api/existence/cubes/${cubeId}/check`, { input_id: inputId });
          const isSuccess = res.data.result === true;
          setExistenceStates(prev => ({ 
              ...prev, 
              [cubeId]: { 
                  ...prev[cubeId], 
                  loading: false, 
                  status: isSuccess ? 'success' : 'error', 
                  log: res.data.output || (isSuccess ? "נמצא בהצלחה." : "לא נמצא התאמה / False.") 
              } 
          }));
      } catch (e) {
          setExistenceStates(prev => ({ 
              ...prev, 
              [cubeId]: { ...prev[cubeId], loading: false, status: 'error', log: "שגיאת תקשורת מול השרת" } 
          }));
      }
  };

  // --- Choter Methods ---
  const handleCreateChoterGroup = async () => {
      if(!newChoterGroupName) return;
      await axios.post(`${API_BASE_URL}/api/choter/groups`, { name: newChoterGroupName, user: username });
      setNewChoterGroupName('');
      fetchChoterData();
  };

  const handleTestTrigger = async () => {
      if(!choterGroupSettings.trigger_script) return;
      setIsTestingTrigger(true);
      setTriggerTestResult("מריץ טסט מול השרת...");
      try {
          const res = await axios.post(`${API_BASE_URL}/api/choter/test-trigger`, { script: choterGroupSettings.trigger_script });
          if (res.data.status === 'success') {
              setTriggerTestResult(res.data.output || "הסקריפט רץ בהצלחה (ללא פלט).");
          } else {
              setTriggerTestResult("שגיאה: \n" + res.data.output);
          }
      } catch(e) { setTriggerTestResult("שגיאת תקשורת."); }
      setIsTestingTrigger(false);
  };

  const handleSaveChoterSettings = async () => {
      if(!selectedChoterGroup) return;
      await axios.put(`${API_BASE_URL}/api/choter/groups/${selectedChoterGroup}/settings`, { ...choterGroupSettings, user: username });
      setChoterSettingsModalOpen(false);
      setTriggerTestResult("");
      fetchChoterData();
  };

  const handleOpenSettings = (group) => {
      setChoterGroupSettings({
          interval_minutes: group.interval_minutes || 5,
          trigger_script: group.trigger_script || '',
          export_to_metrics: group.export_to_metrics || false
      });
      setTriggerTestResult("");
      setChoterSettingsModalOpen(true);
  };

  const handleTestElastic = async () => {
      setIsTesting(true);
      setTestResult(null);
      try {
          const res = await axios.post(`${API_BASE_URL}/api/choter/test-elastic`, {
              eck_url: choterStationForm.eck_url,
              query: choterStationForm.query,
              time_range_minutes: choterStationForm.time_range_minutes
          });
          if (res.data.status === 'success') {
              setTestResult(`נמצאו ${res.data.count} רשומות בטווח הזמן.`);
          } else {
              setTestResult(`שגיאה בחיבור: ${res.data.detail}`);
          }
      } catch (e) {
          setTestResult("שגיאת תקשורת.");
      }
      setIsTesting(false);
  };

  const handleTogglePauseChoter = async (g_id) => {
      await axios.put(`${API_BASE_URL}/api/choter/groups/${g_id}/toggle-pause`);
      fetchChoterData();
  };

  const handleDeleteChoterGroup = async (g_id) => {
      if(!window.confirm("למחוק קוביית חוטר זו ואת כל התחנות שבתוכה? (הלוגים באלסטיק יישמרו)")) return;
      await axios.delete(`${API_BASE_URL}/api/choter/groups/${g_id}`);
      setSelectedChoterGroup(null);
      setLiveLogs([]);
      fetchChoterData();
  };

  const handleOpenAddStation = () => {
      setEditingStationId(null);
      setChoterStationForm({ name: '', tech: 'elastic', eck_url: 'http://localhost:9200/', query: '', time_range_minutes: 15, condition_operator: '>', condition_value: 0, station_role: 'intermediate', order: 1, delay_seconds: 0 });
      setTestResult(null);
      setChoterStationModalOpen(true);
  };

  const handleOpenEditStation = (station) => {
      setEditingStationId(station.id);
      setChoterStationForm({
          name: station.name,
          tech: station.tech || 'elastic',
          eck_url: station.eck_url || '',
          query: station.query,
          time_range_minutes: station.time_range_minutes,
          condition_operator: station.condition_operator,
          condition_value: station.condition_value,
          station_role: station.station_role || 'intermediate',
          order: station.order || 1,
          delay_seconds: station.delay_seconds || 0
      });
      setTestResult(null);
      setChoterStationModalOpen(true);
  };

  const handleSaveChoterStation = async () => {
      if(!choterStationForm.name || !choterStationForm.eck_url || !selectedChoterGroup) return;
      const payload = { ...choterStationForm, group_id: selectedChoterGroup, user: username };
      if(editingStationId) {
          await axios.put(`${API_BASE_URL}/api/choter/stations/${editingStationId}`, payload);
      } else {
          await axios.post(`${API_BASE_URL}/api/choter/stations`, payload);
      }
      setChoterStationModalOpen(false);
      fetchChoterData();
  };

  const handleDeleteChoterStation = async (s_id) => {
      if(!window.confirm("למחוק תחנה זו מהחוטר?")) return;
      await axios.delete(`${API_BASE_URL}/api/choter/stations/${s_id}`);
      fetchChoterData();
  };

  const handleSaveQuickDelay = async () => {
      if(!quickDelayModal.station) return;
      const payload = { ...quickDelayModal.station, delay_seconds: quickDelayModal.delay, user: username };
      delete payload.id; 
      await axios.put(`${API_BASE_URL}/api/choter/stations/${quickDelayModal.station.id}`, payload);
      setQuickDelayModal({ open: false, station: null, delay: 0 });
      fetchChoterData();
  };

  
  const handleRunChoterGroup = async () => {
      if(!selectedChoterGroup) return;
      setIsRunningGroup(true);
      setActiveStationId(null);
      setActiveStationName(null);
      
      try {
          const response = await fetch(`${API_BASE_URL}/api/choter/stream-run/${selectedChoterGroup}`);
          const reader = response.body.getReader();
          const decoder = new TextDecoder("utf-8");
          
          let done = false;
          while (!done) {
              const { value, done: readerDone } = await reader.read();
              done = readerDone;
              if (value) {
                  const chunk = decoder.decode(value, { stream: true });
                  const lines = chunk.split('\n\n');
                  lines.forEach(line => {
                      if (line.startsWith('data: ')) {
                          try {
                              const data = JSON.parse(line.slice(6));
                              if (data.log) {
                                  setLiveLogs(prev => [...prev, data.log]);
                              }
                              if (data.active_station_id !== undefined) {
                                  setActiveStationId(data.active_station_id);
                              }
                              if (data.done) {
                                  setIsRunningGroup(false);
                                  setActiveStationId(null);
                                  setActiveStationName(null);
                                  fetchChoterData();
                              }
                          } catch(e) {}
                      }
                  });
              }
          }
      } catch (e) {
          const timeStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
          setLiveLogs(prev => [...prev, `[${timeStr}] Critical communication error during stream run.`]);
          setIsRunningGroup(false);
          setActiveStationId(null);
          setActiveStationName(null);
      }
  };

  // --- משתנים חדשים לעורך המאוחד ---
  const [unifiedUIOpen, setUnifiedUIOpen] = useState(false);
  const [localTechs, setLocalTechs] = useState([]);
  const [localTemplates, setLocalTemplates] = useState({});
  const [activeUnifiedTech, setActiveUnifiedTech] = useState(null);

  const openUnifiedEditor = () => {
      try {
          // שומרים את כל הטכנולוגיות כדי שלא יימחקו ויהיה ניתן לגרור אותן בקנבס
          const parsedTechs = JSON.parse(adminTechsStr);
          const allowedTechs = ['rabbit', 'rabbitmq'];
          
          // אילוץ הרמטי: הספים התשתיתיים (כמות הודעות) יוגדרו רק על ראביט, שאר הטכנולוגיות יאופסו מספים
          parsedTechs.forEach(t => {
              if (allowedTechs.includes(t.value)) {
                  t.thresholds = [
                      { name: "majorThreshold", label: "Major (הודעות תקועות)", min: 0, max: 1000000 },
                      { name: "criticalThreshold", label: "Critical (הודעות תקועות)", min: 0, max: 1000000 }
                  ];
              } else {
                  t.thresholds = [];
              }
          });

          const parsedTpls = JSON.parse(adminGenericTemplatesStr);
          
          const unifiedTpls = {};
          for (const tech in parsedTpls) {
              if (!allowedTechs.includes(tech)) continue; // משאיר חוקים גנריים קיימים רק לראביט
              unifiedTpls[tech] = [];
              const grouped = {};
              parsedTpls[tech].forEach(tpl => {
                  let purp = tpl.purpose || '';
                  if (!grouped[purp]) {
                      grouped[purp] = {
                          ruleName: tpl.customRuleName || '',
                          purpose: purp,
                          majorQuery: '',
                          criticalQuery: '',
                          majorDefault: tpl.majorDefault || '',
                          criticalDefault: tpl.criticalDefault || ''
                      };
                  }
                  if (tpl.suffix.toLowerCase().includes('major') || purp.toLowerCase().includes('major')) {
                      grouped[purp].majorQuery = tpl.query;
                      if(tpl.defaultThreshold) grouped[purp].majorDefault = tpl.defaultThreshold;
                  } else if (tpl.suffix.toLowerCase().includes('critical') || purp.toLowerCase().includes('critical')) {
                      grouped[purp].criticalQuery = tpl.query;
                      if(tpl.defaultThreshold) grouped[purp].criticalDefault = tpl.defaultThreshold;
                  } else {
                      grouped[purp].majorQuery = tpl.query;
                  }
                  if (tpl.customRuleName) grouped[purp].ruleName = tpl.customRuleName;
              });
              unifiedTpls[tech] = Object.values(grouped);
          }
          
          setLocalTechs(parsedTechs);
          setLocalTemplates(unifiedTpls);
          
          if (parsedTechs.length > 0) {
              setActiveUnifiedTech(parsedTechs[0].value);
          }
          setUnifiedUIOpen(true);
      } catch(e) {
          alert("אחד מקבצי ה-JSON שבור. אנא תקן בעורך הקוד קודם.");
      }
  };
  // ----------------------------------------
  // --- Automations Methods ---
  const handleCreateFolder = async () => {
    if(!newFolderName) return;
    await axios.post(`${API_BASE_URL}/api/automations/folders`, { name: newFolderName, user: username });
    setNewFolderName('');
    fetchAutomationsData();
  };

  const handleDeleteFolder = async (folderId) => {
    if(!window.confirm("למחוק תיקייה זו וכל האוטומציות שבתוכה?")) return;
    await axios.delete(`${API_BASE_URL}/api/automations/folders/${folderId}`);
    setSelectedFolderId(null);
    fetchAutomationsData();
  };

const handleCreateAutomation = async () => {
    if(!autoForm.name || !autoForm.metric_query || !autoForm.python_code || !selectedFolderId || !autoForm.action_type) return;
    
    // בודק אם אנחנו במצב עריכה (יש ID) או יצירה חדשה
    if (autoForm.id) {
        await axios.put(`${API_BASE_URL}/api/automations/${autoForm.id}`, { ...autoForm, user: username });
    } else {
        await axios.post(`${API_BASE_URL}/api/automations`, { ...autoForm, folder_id: selectedFolderId, user: username });
    }
    
    setAutoModalOpen(false);
    setAutoForm({ id: null, name: '', metric_query: '', operator: '>', threshold: 0, python_code: '', action_type: 'script' });
    setRestartForm({ restartType: 'server', server: '', service: '', process: '' });
    fetchAutomationsData();
  };

  const handleSaveRestartAutomation = () => {
    if (!restartForm.server) return alert("יש להזין שרת יעד");
    if (restartForm.restartType === 'service' && !restartForm.service) return alert("יש להזין שם סרוויס");
    if (restartForm.restartType === 'process' && !restartForm.process) return alert("יש להזין שם פרוסס");

    const targetObj = restartForm.restartType === 'server' ? restartForm.server : (restartForm.restartType === 'service' ? restartForm.service : restartForm.process);

    const generatedScript = `import requests\nimport json\n\n# Auto-Generated Restart Action\n# Type: ${restartForm.restartType}\n# Server: ${restartForm.server}\n# Target: ${targetObj}\n\npayload = {\n    "restart_type": "${restartForm.restartType}",\n    "server": "${restartForm.server}",\n    "target": "${targetObj}"\n}\n\nprint(f"Initiating {payload['restart_type']} restart for {payload['target']} on {payload['server']}...")\n`;
    setAutoForm({ ...autoForm, python_code: generatedScript });
    setRestartModalOpen(false);
  };

  const handleFetchAutoGraph = async () => {
      if(!autoForm.metric_query) return;
      setIsGraphLoading(true);
      try {
          const payload = { query: autoForm.metric_query };
          if (autoGraphStartTime && autoGraphEndTime) {
             payload.start_time = Math.floor(new Date(autoGraphStartTime).getTime() / 1000);
             payload.end_time = Math.floor(new Date(autoGraphEndTime).getTime() / 1000);
          }
          const res = await axios.post(`${API_BASE_URL}/promql_graph`, payload);
          setPromqlGraphData(res.data.data || []);
      } catch(e) {} finally { setIsGraphLoading(false); }
  };

  const checkCondition = (val) => {
      if(autoForm.operator === '>') return val > autoForm.threshold;
      if(autoForm.operator === '<') return val < autoForm.threshold;
      if(autoForm.operator === '==') return val === autoForm.threshold;
      return false;
  };

  const handleMouseMoveAutoGraph = (e) => {
    if (promqlGraphData.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect(); 
    const x = e.clientX - rect.left; 
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    let index = Math.round((percentage / 100) * (promqlGraphData.length - 1)); 
    index = Math.max(0, Math.min(index, promqlGraphData.length - 1)); 
    setAutoHoverPoint({ data: promqlGraphData[index], xPercentage: (index / (promqlGraphData.length - 1)) * 100 }); 
  };

  const renderAutoGraph = () => {
      if(promqlGraphData.length === 0) return <Text c="dimmed" ta="center" mt="xl">אין נתונים להצגה.</Text>;
      const maxVal = Math.max(...promqlGraphData.map(d => d.value), autoForm.threshold * 1.2, 10);
      const points = promqlGraphData.map((d, i) => { const x = (i / (promqlGraphData.length - 1)) * 100; const y = 100 - ((d.value / maxVal) * 100); return `${x},${y}`; }).join(" ");
      const threshY = 100 - ((autoForm.threshold / maxVal) * 100);

      return (
          <div 
             onMouseMove={handleMouseMoveAutoGraph} 
             onMouseLeave={() => setAutoHoverPoint(null)}
             style={{ height: '200px', position: 'relative', borderBottom: '2px solid #40c057', background: 'linear-gradient(0deg, rgba(43,138,62,0.1) 0%, rgba(43,138,62,0) 100%)', cursor: 'crosshair' }}
          >
             <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', position: 'absolute', bottom: 0 }} preserveAspectRatio="none">
                 <polyline points={points} fill="none" stroke="#40c057" strokeWidth="1.5" />
             </svg>
             {threshY >= 0 && threshY <= 100 && (
                 <div style={{ position: 'absolute', top: `${threshY}%`, left: 0, right: 0, borderTop: '2px dashed #fa5252', pointerEvents: 'none' }}>
                    <Text size="xs" c="red.6" style={{ position: 'absolute', right: 5, top: -20, fontWeight: 'bold' }}>סף הרצה ({autoForm.threshold})</Text>
                 </div>
             )}
             {promqlGraphData.map((d, i) => {
                 if(checkCondition(d.value)) {
                     const x = (i / (promqlGraphData.length - 1)) * 100;
                     const y = 100 - ((d.value / maxVal) * 100);
                     return (
                         <div key={i} style={{ position: 'absolute', left: `${x}%`, top: `calc(${y}% - 15px)`, transform: 'translateX(-50%)', pointerEvents: 'none' }}>
                             <IconArrowDownCircle size={14} color="#fa5252" />
                         </div>
                     )
                 }
                 return null;
             })}

             {autoHoverPoint && (
                <>
                  <div style={{ position: 'absolute', left: `${autoHoverPoint.xPercentage}%`, top: 0, bottom: 0, width: '1px', backgroundColor: 'rgba(255,255,255,0.4)', pointerEvents: 'none' }} />
                  <Paper p="xs" radius="sm" bg="dark.8" style={{ position: 'absolute', left: `calc(${autoHoverPoint.xPercentage}% + 10px)`, top: '10%', border: '1px solid #495057', pointerEvents: 'none', zIndex: 100 }}>
                     <Text size="xs" c="dimmed">{new Date(autoHoverPoint.data.time * 1000).toLocaleString('he-IL', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</Text>
                     <Text size="sm" fw={700} c="white">{autoHoverPoint.data.value.toLocaleString()} ערך</Text>
                  </Paper>
                </>
             )}
          </div>
      );
  };

  const handleTestPython = async () => {
    if(!autoForm.python_code) return;
    setPythonTestOutput('מריץ קוד מול השרת...');
    setIsPythonError(false);
    try {
       const res = await axios.post(`${API_BASE_URL}/api/automations/test`, { python_code: autoForm.python_code });
       if (res.data.status === 'error') {
           setIsPythonError(true);
           setPythonTestOutput(res.data.output);
       } else {
           setPythonTestOutput(res.data.output || 'הריצה הסתיימה בהצלחה (ללא פלט).');
       }
    } catch(e) {
       setIsPythonError(true);
       setPythonTestOutput('שגיאת תקשורת עם השרת בזמן הריצה.');
    }
  };

  const handleDeleteAutomation = async (autoId) => {
    if(!window.confirm("למחוק אוטומציה זו?")) return;
    await axios.delete(`${API_BASE_URL}/api/automations/${autoId}`);
    fetchAutomationsData();
  };


  const handleDeleteRule = async (ruleId) => {
    if (String(ruleId).startsWith('sys_gen_')) {
        alert("לא ניתן למחוק חוק מערכתי מובנה מכאן. עליך לגשת לטאב אדמין -> עריכת טמפלטים גנריים (PromQL).");
        return;
    }
    if (!window.confirm('מחיקה? הנתונים יסתנכרנו בכל רחבי המערכת.')) return;
    try { 
      await axios.delete(`${API_BASE_URL}/rules/${ruleId}`); 
      fetchRules();
    } catch (error) { console.error('Error deleting rule', error); }
  };

  const handleBulkDelete = async (selectedIds) => {
      const hasSystemRules = selectedIds.some(id => String(id).startsWith('sys_gen_'));
      if (hasSystemRules) {
          alert("חלק מהחוקים שבחרת הם חוקים גנריים מובנים שלא ניתנים למחיקה מכאן. אנא הסר אותם מהבחירה ונסה שוב.");
          return;
      }
      if (!window.confirm(`האם אתה בטוח שברצונך למחוק ${selectedIds.length} חוקים?`)) return;
      try {
          await axios.post(`${API_BASE_URL}/rules/bulk-delete`, { ids: selectedIds });
          fetchRules();
      } catch (e) { alert("שגיאה במחיקה הרוחבית"); }
  };

  const handleSaveRule = async (values) => {
    try {
      const payload = { 
          ...values, 
          user: username, 
          // התיקון: לוקחים את הבחירה מהטופס קודם, כדי לא לדרוס אותה עם הערך הישן
          node: values.node !== undefined ? values.node : (editingRule?.node || ''), 
          mappingTemplate: values.mappingTemplate !== undefined ? values.mappingTemplate : (editingRule?.mappingTemplate || ''),
          track_id: editingRule?.track_id || selectedTrack?.id || '' 
      };
      if (editingRule && editingRule.id) { await axios.put(`${API_BASE_URL}/rules/${editingRule.id}`, payload); } 
      else { await axios.post(`${API_BASE_URL}/rules`, payload); }
      fetchRules(); 
    } catch (error) { console.error('Error saving rule:', error); throw error; } 
  };

  const handleRestore = async (ruleId, historicalVersion) => {
    if (!window.confirm(`לשחזר לגרסה ${historicalVersion.version}?`)) return;
    try {
      const restoredData = historicalVersion.rule_snapshot || historicalVersion;
      const payload = { ...restoredData, user: `${username} (שחזור)`, reason: `שחזור לגרסה ${historicalVersion.version}` };
      delete payload.version; delete payload.date; delete payload.rule_snapshot;
      await axios.put(`${API_BASE_URL}/rules/${ruleId}`, payload);
      fetchRules(); setHistoryOpened(false);
    } catch (error) { alert("השחזור נכשל"); }
  };

  const handleEditClick = (rule) => { 
      if (rule.isVirtual) {
          alert("לעריכת חוק מערכתי מובנה, עליך לגשת לטאב אדמין -> עריכת טמפלטים גנריים (PromQL).");
          return;
      }
      // פתיחת מודאל העריכה הראשי תמיד כדי לשמור על UI אחיד
      setEditingRule(rule); 
      openModal(); 
  };

  const handleHistoryClick = (rule) => { 
      if (rule.isVirtual) {
          alert("לחוקים מערכתיים דינמיים מה-ETCD אין היסטוריית גרסאות בעמוד זה.");
          return;
      }
      setSelectedRuleForHistory(rule); 
      setHistoryOpened(true); 
  };

  const handleCloseModal = () => { setEditingRule(null); closeModal(); };

  // סיכום ניטורים פר רכיב - חילוץ ספים חכם מתוך הרכיבים והשאילתות
  const renderSummaryContent = () => {
    const filterTech = summaryModal.filterTech || null;
    const filterRule = summaryModal.filterRule || '';

    let latestSyncedNodes = [];
    if (syncHistory?.nodes_history?.length > 0) {
        const lastSync = syncHistory.nodes_history[syncHistory.nodes_history.length - 1];
        if (Array.isArray(lastSync.nodes)) {
            latestSyncedNodes = lastSync.nodes.map(n => typeof n === 'string' ? { id: n, data: { label: n, tech: 'כללי' } } : n);
        }
    }
    const allNodesInArch = latestSyncedNodes;

    if (allNodesInArch.length === 0) {
        return (
            <Center h={250}>
                <Stack align="center" gap="xs">
                    <IconRadar size={50} color="gray" />
                    <Text fw={700} size="lg" c="dark.7">לא נמצאו רכיבים במאגר</Text>
                    <Text c="dimmed" size="sm" ta="center">ודא שבוצע סנכרון רכיבים מוצלח מול ה-API.</Text>
                </Stack>
            </Center>
        );
    }

    // פונקציית עזר לאיחוד חוקי MAJOR ו-CRITICAL ומשיכת ספים מדויקת וחכמה
    const deduplicateRules = (rulesList, nodeData = {}) => {
        const grouped = {};
        rulesList.forEach(r => {
            let baseName = r.name || '';
            baseName = baseName.replace(/_(critical|warning|major|info)$/i, '');
            const key = r.purpose || baseName || r.id || 'unknown';

            // 1. שליפת ספים ברורים מהחוק
            let c = r.critical ?? r.critical_threshold;
            let w = r.warning ?? r.warning_threshold;

            if (c === undefined && w === undefined) {
                const t = r.threshold ?? r.condition_value ?? r.value;
                if (t !== undefined && t !== null && t !== '') {
                    if (r.name?.toLowerCase().includes('warn') || r.name?.toLowerCase().includes('major')) w = t;
                    else c = t;
                }
            }

            // 2. חיפוש ספים שהוגדרו ישירות על הרכיב בקנבס (למשל בחוקים גנריים)
            if (c === undefined && w === undefined) {
                Object.entries(nodeData).forEach(([k, val]) => {
                    if (typeof val === 'number' || (typeof val === 'string' && !isNaN(val) && val.trim() !== '')) {
                        const lowK = k.toLowerCase();
                        // זיהוי חכם לפי שם המפתח
                        if (lowK.includes('crit') || lowK.includes('thresh')) c = c ?? val;
                        else if (lowK.includes('warn') || lowK.includes('maj')) w = w ?? val;
                    }
                });
            }

            // 3. גיבוי אחרון: ניתוח קוד השאילתה וחילוץ המספר! (PromQL regex)
            if (c === undefined && w === undefined && r.query) {
                const match = r.query.match(/[><=]=?\s*(\d+(?:\.\d+)?)/);
                if (match) {
                    if (r.name?.toLowerCase().includes('warn') || r.name?.toLowerCase().includes('major')) w = match[1];
                    else c = match[1];
                }
            }

            // 4. אם בכל זאת מצאנו סתם מספר בהגדרות הרכיב, נניח שהוא הסף
            if (c === undefined && w === undefined) {
                const anyNum = Object.values(nodeData).find(v => typeof v === 'number');
                if (anyNum !== undefined) c = anyNum;
            }

            if (!grouped[key]) {
                grouped[key] = { 
                    ...r, 
                    mergedCritical: c,
                    mergedWarning: w,
                    originalNames: [r.name].filter(Boolean),
                    allQueries: [r.query].filter(Boolean)
                };
            } else {
                if (r.name && !grouped[key].originalNames.includes(r.name)) grouped[key].originalNames.push(r.name);
                if (r.query && !grouped[key].allQueries.includes(r.query)) grouped[key].allQueries.push(r.query);
                
                if (c !== undefined && c !== null && c !== '') grouped[key].mergedCritical = c;
                if (w !== undefined && w !== null && w !== '') grouped[key].mergedWarning = w;
            }
        });
        return Object.values(grouped);
    };

    const availableTechs = Array.from(new Set(allNodesInArch.map(n => n.data?.tech || 'כללי')));
    
    let possibleRules = rules;
    let possibleElastic = allNodesInArch.flatMap(n => (n.data?.elasticQueries || []).map(eq => ({...eq, internalNodeId: n.id})));

    if (filterTech) {
        possibleRules = rules.filter(r => {
            const mappedTech = r.tech === 'rabbitmq' ? 'rabbit' : (r.tech === 's3_storage' ? 's3' : r.tech);
            return mappedTech?.toLowerCase() === filterTech?.toLowerCase() || r.tech?.toLowerCase() === filterTech?.toLowerCase();
        });
        if (filterTech !== 'elastic_log' && filterTech !== 'elastic') possibleElastic = [];
    }

    const ruleOptionsMap = new Map();
    possibleRules.forEach(r => {
        let baseName = r.name || '';
        baseName = baseName.replace(/_(critical|warning|major|info)$/i, '');
        const key = r.purpose || baseName || 'חוק ניטור';
        const label = currentRole === 'admin' ? `${key} (${baseName})` : key;
        ruleOptionsMap.set(key, label);
    });
    possibleElastic.forEach(eq => {
        const key = eq.description || eq.name || 'שאילתה מובנית';
        const label = currentRole === 'admin' ? `${key} (${eq.name || 'מובנה'})` : key;
        ruleOptionsMap.set(key, label);
    });

    const allRuleOptions = Array.from(ruleOptionsMap.entries()).map(([val, lbl]) => ({ value: val, label: lbl }));

    return (
        <Stack gap="lg" style={{ overflow: 'hidden' }}>
            <Group grow>
                <Select 
                    data={availableTechs} 
                    clearable 
                    searchable
                    placeholder="סנן לפי טכנולוגיה..." 
                    value={filterTech} 
                    onChange={(val) => setSummaryModal({ ...summaryModal, filterTech: val, filterRule: '' })} 
                    leftSection={<IconFilter size={16} color="#339af0" />}
                    size="md"
                />
                <Select 
                    data={allRuleOptions} 
                    clearable 
                    searchable
                    placeholder={filterTech ? `בחר מטרת חוק הקשורה ל-${filterTech}...` : "בחר מטרת חוק לחיפוש מהרשימה..."}
                    value={filterRule} 
                    onChange={(val) => setSummaryModal({ ...summaryModal, filterRule: val || '' })}
                    leftSection={<IconSearch size={16} color="#339af0" />}
                    size="md"
                    disabled={allRuleOptions.length === 0}
                />
            </Group>

            <ScrollArea h={550} offsetScrollbars type="auto">
                <Table striped highlightOnHover withTableBorder withColumnBorders bg="white" verticalSpacing="md" style={{ borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                    <Table.Thead bg="gray.1" style={{ position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                        <Table.Tr>
                            <Table.Th w={200}><Text fw={800} c="dark.7">שם הרכיב בקנבס</Text></Table.Th>
                            <Table.Th w={120}><Text fw={800} c="dark.7">טכנולוגיה</Text></Table.Th>
                            <Table.Th ta="center" w={150}><Text fw={800} c="blue.8">תשתיתי / גנרי</Text></Table.Th>
                            <Table.Th ta="center" w={150}><Text fw={800} c="grape.8">ייעודי (CUSTOM)</Text></Table.Th>
                            <Table.Th ta="center" w={150}><Text fw={800} c="teal.8">לוגים (Elastic)</Text></Table.Th>
                            <Table.Th ta="center" w={100} bg="blue.1"><Text fw={900} c="blue.9">סה"כ (ייחודיים)</Text></Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {allNodesInArch.map(node => {
                            const nodeName = String(node.data?.label || node.id || '');
                            const nodeTech = String(node.data?.tech || 'כללי');

                            if (filterTech && nodeTech !== filterTech) return null;

                            const rawGenericRules = rules.filter(r => {
                                if (r.node === 'SYS_GENERIC' || (r.name && r.name.startsWith('neptune_generic_'))) {
                                    const mappedTech = r.tech === 'rabbitmq' ? 'rabbit' : (r.tech === 's3_storage' ? 's3' : r.tech);
                                    if (nodeTech?.toLowerCase() === mappedTech?.toLowerCase() || nodeTech?.toLowerCase() === r.tech?.toLowerCase()) {
                                        return true;
                                    }
                                }
                                return false;
                            });

                            const rawElasticRules = rules.filter(r => r.tech === 'elastic_log' && (String(r.node) === String(node.id) || r.node?.toLowerCase() === nodeName.toLowerCase()));
                            if (node.data?.elasticQueries) {
                                node.data.elasticQueries.forEach((eq, idx) => {
                                    rawElasticRules.push({ 
                                        ...eq,
                                        name: eq.name || `שאילתה מובנית ${idx+1}`, 
                                        purpose: eq.description || 'שאילתה מובנית ברכיב', 
                                        query: eq.query, 
                                        tech: 'elastic_log', 
                                        internal: true,
                                        condition_value: eq.condition_value
                                    });
                                });
                            }

                            const rawCustomRules = rules.filter(r => {
                                if (r.node === 'SYS_GENERIC' || (r.name && r.name.startsWith('neptune_generic_')) || r.tech === 'elastic_log') return false;
                                
                                const nName = nodeName.toLowerCase();
                                const nId = String(node.id || '').toLowerCase();

                                // הוספת בדיקה מול מנגנון הצימוד החכם (PromQL Labels)
                                if (r.attachedComponents && r.attachedComponents.some(c => c.toLowerCase() === nName || c.toLowerCase() === nId)) return true;
                                
                                if (r.node === 'GENERIC') {
                                    const mapping = customGenericMappings[r.id];
                                    if (!mapping) return false;
                                    
                                    const hasNodeMatch = mapping.ruleNodes?.some(m => String(m.node.id) === String(node.id) || String(m.node) === String(node.id));
                                    const hasNameMatch = mapping.resolvedNames?.includes(nName);
                                    
                                    return hasNodeMatch || hasNameMatch;
                                }
                                
                                const ruleNode = String(r.node || '').toLowerCase();
                                return ruleNode === nId || ruleNode === nName || nName.includes(ruleNode);
                            });

                            // מעבירים גם את המידע של הרכיב (node.data) כדי שנדע לשלוף ממנו ספים!
                            const genericRules = deduplicateRules(rawGenericRules, node.data);
                            const elasticRules = deduplicateRules(rawElasticRules, node.data);
                            const customRules = deduplicateRules(rawCustomRules, node.data);

                            const ruleMatchesFilter = (r) => {
                                let bName = r.name?.replace(/_(critical|warning|major|info)$/i, '') || '';
                                const key = r.purpose || bName || 'חוק ניטור';
                                return key === filterRule;
                            };
                            
                            const matchedGen = filterRule ? genericRules.filter(ruleMatchesFilter) : [];
                            const matchedEl = filterRule ? elasticRules.filter(ruleMatchesFilter) : [];
                            const matchedCus = filterRule ? customRules.filter(ruleMatchesFilter) : [];

                            const hasAnyMatch = filterRule ? (matchedGen.length > 0 || matchedEl.length > 0 || matchedCus.length > 0) : false;

                            if (filterRule && !hasAnyMatch) return null;

                            const rowBg = filterRule ? 'indigo.0' : 'transparent';
                            const totalRules = genericRules.length + elasticRules.length + customRules.length;

                            const renderCell = (rulesList, baseColor, category, matchedList) => {
                                if (rulesList.length === 0) return <Badge color="gray" variant="light" size="md">לא קיים</Badge>;
                                
                                const hasMatchHere = filterRule && matchedList.length > 0;
                                const displayColor = hasMatchHere ? 'yellow' : baseColor;
                                const displayVariant = hasMatchHere ? 'filled' : 'light';

                                return (
                                    <Tooltip label="לחץ לפירוט קוביות ספים והצעת עריכה" position="top" withArrow>
                                        <Badge 
                                            color={displayColor} 
                                            variant={displayVariant} 
                                            size="lg" 
                                            leftSection={<IconListDetails size={14} />}
                                            style={{ cursor: 'pointer', transition: 'all 0.3s ease', boxShadow: hasMatchHere ? `0 0 12px var(--mantine-color-yellow-6)` : '0 2px 4px rgba(0,0,0,0.05)', transform: hasMatchHere ? 'scale(1.05)' : 'scale(1)' }}
                                            onClick={() => setSummaryRuleDetails({ nodeName, category, rules: rulesList })}
                                        >
                                            {rulesList.length} חוקים
                                        </Badge>
                                    </Tooltip>
                                );
                            };

                            return (
                                <Table.Tr key={node.id} bg={rowBg} style={{ transition: 'all 0.3s ease' }}>
                                    <Table.Td fw={700} c="dark.7">{nodeName}</Table.Td>
                                    <Table.Td><Badge size="sm" color="indigo" variant="outline">{nodeTech}</Badge></Table.Td>
                                    <Table.Td ta="center">{renderCell(genericRules, 'blue', 'תשתיתי גנרי', matchedGen)}</Table.Td>
                                    <Table.Td ta="center">{renderCell(customRules, 'grape', 'ייעודי קאסטום', matchedCus)}</Table.Td>
                                    <Table.Td ta="center">{renderCell(elasticRules, 'teal', 'לוגים / אלסטיק', matchedEl)}</Table.Td>
                                    <Table.Td ta="center" bg={hasAnyMatch ? 'indigo.1' : 'blue.1'}><Text fw={900} c="blue.9" size="lg">{totalRules}</Text></Table.Td>
                                </Table.Tr>
                            );
                        })}
                    </Table.Tbody>
                </Table>
            </ScrollArea>
        </Stack>
    );
  };

  if (!sysConfig) return <Center style={{ height: '100vh', backgroundImage: `url(${bgDashboard})`, backgroundSize: 'cover' }}><Loader size="xl" color="blue" /></Center>;

  const allDisplayRules = [...rules];

  // הפילטור החכם לטבלה
  const filteredRules = allDisplayRules.filter((rule) => {
    const searchLower = searchQuery.toLowerCase();
    return !searchQuery || (
        (rule.name && rule.name.toLowerCase().includes(searchLower)) ||
        (rule.purposeRule && rule.purposeRule.toLowerCase().includes(searchLower)) ||
        (rule.queryMajor && rule.queryMajor.toLowerCase().includes(searchLower)) ||
        (rule.queryCritical && rule.queryCritical.toLowerCase().includes(searchLower)) ||
        (rule.tsdb && rule.tsdb.toLowerCase().includes(searchLower))
    );
  });

  const currentGroup = choterGroups.find(g => g.id === selectedChoterGroup);
  const groupStations = choterStations.filter(s => s.group_id === selectedChoterGroup)
                                      .sort((a, b) => (a.order || 0) - (b.order || 0));

  let cumulativeDelay = 0; 

  return (
    <AppShell header={{ height: { base: 110, md: 70 } }} padding="md">
      <style>{pulseAnimation}</style>
      
      {/* תפריט מודאל עריכת JSON של הגדרות ה-Admin */}
      <Modal opened={adminEditorModal.opened} onClose={validateAndCloseAdminModal} title={<Text fw={900} size="lg">{adminEditorModal.title}</Text>} centered dir="rtl" size="85%" bg="dark.7">
        <Stack>
            <Group justify="space-between">
                <Text size="sm" c="dimmed">עורך מתקדם - כולל בדיקת תקינות אוטומטית (Syntax Highlighting) וקווי מתאר</Text>
                <Button size="xs" variant="light" color="indigo" onClick={() => {
                    try {
                        let val = adminEditorModal.field === 'roles' ? adminRolesStr :
                                  adminEditorModal.field === 'techs' ? adminTechsStr :
                                  adminEditorModal.field === 'guide_links' ? adminGuideLinksStr : 
                                  adminEditorModal.field === 'generic_templates' ? adminGenericTemplatesStr : '';
                        const parsed = JSON.parse(val);
                        handleAdminJsonChange(JSON.stringify(parsed, null, 2));
                        setAdminJsonError('✅ ה-JSON תקין ועוצב בהצלחה!');
                        setTimeout(() => setAdminJsonError(''), 4000);
                    } catch(e) {
                        setAdminJsonError('❌ שגיאת תקינות (Validate Error): ' + e.message);
                    }
                }}>בדוק תקינות וסדר קוד (Validate & Format)</Button>
            </Group>
            
            <div style={{ height: '65vh', border: '1px solid #ced4da', borderRadius: '4px', overflow: 'hidden' }} dir="ltr">
                <Editor
                    height="100%"
                    language="json"
                    theme="vs-dark"
                    value={
                        adminEditorModal.field === 'roles' ? adminRolesStr :
                        adminEditorModal.field === 'techs' ? adminTechsStr :
                        adminEditorModal.field === 'guide_links' ? adminGuideLinksStr : 
                        adminEditorModal.field === 'generic_templates' ? adminGenericTemplatesStr : ''
                    }
                    onChange={(val) => handleAdminJsonChange(val || '')}
                    options={{ 
                        formatOnPaste: true, 
                        formatOnType: true, 
                        minimap: { enabled: false }, 
                        fontSize: 14,
                        renderIndentGuides: true,
                        bracketPairColorization: { enabled: true }
                    }}
                />
            </div>
            {adminJsonError && <Text c={adminJsonError.includes('✅') ? "teal" : "red"} fw={700} size="sm" dir="ltr" ta="left">{adminJsonError}</Text>}
            <Button color="blue" onClick={validateAndCloseAdminModal}>שמור וסגור עריכה</Button>
        </Stack>
      </Modal>

      {/* מודאל ניהול תתי מסלולים דינמי */}
      <Modal opened={editingTeamIndex !== null} onClose={() => setEditingTeamIndex(null)} title={<Text fw={900} size="lg">עריכת תתי-מסלולים לצוות</Text>} centered dir="rtl" size="lg">
         {editingTeamIndex !== null && adminTeams[editingTeamIndex] && (
            <Stack>
               <Text fw={700} size="lg">צוות: {adminTeams[editingTeamIndex].name}</Text>
               <Text size="sm" c="dimmed">כל מסלול (Track) יוצג כקנבס נפרד תחת צוות זה.</Text>
               <Table highlightOnHover>
                  <Table.Thead>
                     <Table.Tr><Table.Th>מזהה פנימי (ID)</Table.Th><Table.Th>שם המסלול</Table.Th><Table.Th>פעולות</Table.Th></Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                     {(adminTeams[editingTeamIndex].tracks || []).map((tr, i) => (
                        <Table.Tr key={i}>
                           <Table.Td>{tr.id}</Table.Td>
                           <Table.Td>{tr.name}</Table.Td>
                           <Table.Td>
                              <ActionIcon color="red" variant="light" onClick={() => {
                                 const updated = [...adminTeams];
                                 updated[editingTeamIndex].tracks = updated[editingTeamIndex].tracks.filter((_, idx) => idx !== i);
                                 setAdminTeams(updated);
                              }}>
                                 <IconTrash size={16}/>
                              </ActionIcon>
                           </Table.Td>
                        </Table.Tr>
                     ))}
                     <Table.Tr bg="blue.0">
                        <Table.Td>
                           <TextInput placeholder="מזהה (למשל: track1)" value={newTrackId} onChange={(e) => setNewTrackId(e.currentTarget.value)} size="sm" />
                        </Table.Td>
                        <Table.Td>
                           <TextInput placeholder="שם (למשל: מסלול בנקאות)" value={newTrackName} onChange={(e) => setNewTrackName(e.currentTarget.value)} size="sm" />
                        </Table.Td>
                        <Table.Td>
                           <Button size="sm" color="blue" onClick={() => {
                              if(!newTrackId || !newTrackName) return;
                              const updated = [...adminTeams];
                              if(!updated[editingTeamIndex].tracks) updated[editingTeamIndex].tracks = [];
                              updated[editingTeamIndex].tracks.push({ id: newTrackId, name: newTrackName });
                              setAdminTeams(updated);
                              setNewTrackId(''); setNewTrackName('');
                           }}>
                              הוסף למסלולים
                           </Button>
                        </Table.Td>
                     </Table.Tr>
                  </Table.Tbody>
               </Table>
               <Button mt="sm" color="teal" onClick={() => setEditingTeamIndex(null)}>סגור ושמור (לפני שליחה ל-ETCD)</Button>
            </Stack>
         )}
      </Modal>

      <AppShell.Header>
        <Container fluid h="100%" px="md">
          <Group justify="space-between" align="center" dir="rtl" h="100%" wrap="nowrap" style={{ overflow: 'hidden' }}>
            
            <Group gap="md" wrap="nowrap" style={{ flexGrow: 1, minWidth: 0, overflow: 'hidden' }}>
              <Text 
                 fw={900} 
                 c="blue.9" 
                 size="xl" 
                 style={{ whiteSpace: 'nowrap', flexShrink: 0, cursor: 'pointer' }} 
                 onClick={() => setActiveTab('rules')}
              >
                 neptuneManager
              </Text>
              
              <ScrollArea type="auto" scrollbars="x" style={{ flexGrow: 1, minWidth: 0 }}>
                <Tabs value={activeTab} onChange={setActiveTab} variant="pills" radius="md">
                  <Tabs.List style={{ flexWrap: 'nowrap', width: 'max-content', paddingBottom: '4px' }}>
                    {currentRole === 'viewer' && <Tabs.Tab value="home" leftSection={<IconAppWindow size={16} />}>מסך בית</Tabs.Tab>}
                    {currentRole === 'admin' && <Tabs.Tab value="rules" leftSection={<IconFileText size={16} />}>ניהול חוקים</Tabs.Tab>}
                    {currentRole === 'admin' && visibleTabs.queries && <Tabs.Tab value="queries" leftSection={<IconAppWindow size={16} />}>ניטורים אפליקטיביים</Tabs.Tab>}                    {currentRole === 'admin' && visibleTabs.automations && <Tabs.Tab value="automations" leftSection={<IconCode size={16} />} c="indigo.7">אוטומציות והרמטיות (חוטר)</Tabs.Tab>}
                    {currentRole === 'admin' && visibleTabs.exporter && <Tabs.Tab value="exporter" leftSection={<IconCube size={16} />} c="yellow.8">האקספורטר האולטימטיבי</Tabs.Tab>}
                    {visibleTabs.shifts && <Tabs.Tab value="shifts" leftSection={<IconClipboardList size={16} />}>העברת משמרת</Tabs.Tab>}
                    {currentRole === 'admin' && <Tabs.Tab value="admin" leftSection={<IconSettings size={16} />}>הגדרות מערכת</Tabs.Tab>}
                  </Tabs.List>
                </Tabs>
              </ScrollArea>
            </Group>

            <Group wrap="nowrap" style={{ flexShrink: 0 }}>
              <Group gap="xs" style={{ borderLeft: '1px solid #ccc', paddingLeft: '15px' }}>
                 <Text size="xs" fw={700}>TEST Role:</Text>
                 <Select data={['admin', 'viewer']} value={currentRole} onChange={setCurrentRole} size="xs" w={90} styles={{ input: { backgroundColor: '#fff3cd' } }} />
              </Group>

              {currentRole === 'admin' && pendingPRs.length > 0 && (
                <Menu shadow="md" width={350}>
                    <Menu.Target>
                        <Button color="orange" variant="light" leftSection={<IconAlertTriangle size={16} />} style={{ animation: 'pulse 2s infinite' }}>
                            ישנן {pendingPRs.length} בקשות אישור (PR)
                        </Button>
                    </Menu.Target>
                    <Menu.Dropdown dir="rtl">
                        <Menu.Label>בקשות ממתינות לאישור</Menu.Label>
                        <ScrollArea h={300}>
                            {pendingPRs.map(pr => {
                                const teamObj = adminTeams.find(t => t.id === pr.teamId);
                                const trackObj = teamObj?.tracks?.find(t => t.id === pr.trackId);
                                return (
                                    <Menu.Item key={pr.id} onClick={() => {
                                        setSelectedArchTeam(teamObj);
                                        setSelectedTrack(trackObj);
                                        setActiveTab('routes');
                                        setReviewRequest({ req: pr, teamId: pr.teamId, trackId: pr.trackId });
                                    }}>
                                        <Text fw={900} size="sm">{teamObj?.name} ➔ {trackObj?.name}</Text>
                                        <Text size="xs" c="dimmed">מאת: {pr.user} | {pr.date}</Text>
                                        <Text size="xs" mt={4} truncate>{pr.desc}</Text>
                                    </Menu.Item>
                                )
                            })}
                        </ScrollArea>
                    </Menu.Dropdown>
                </Menu>
            )}
              <Badge color={currentRole === 'admin' ? 'red' : 'gray'} size="lg" variant="light">
                {username} ({(currentRole || 'admin').toUpperCase()})
              </Badge>
              <Button variant="outline" color="red" size="xs" onClick={onLogout}>התנתק</Button>
            </Group>
          </Group>
        </Container>
      </AppShell.Header>

      <AppShell.Main pt={{ base: 130, md: 100 }} style={{ backgroundImage: `url(${bgDashboard})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed', minHeight: '100vh' }}>
        
        {/* טאב 1: חוקים */}
        {activeTab === 'rules' && (
          <Container fluid px="md" pb={120}>
            <Paper shadow="xl" p="xl" radius="md" withBorder>
              {/* מודאל הוספת/עריכת חוק ייעודי */}
      <AddRuleModal 
        opened={modalOpened} 
        onClose={handleCloseModal} 
        onAdd={handleSaveRule} 
        editingRule={editingRule} 
      />

      {/* מודאל היסטוריית שינויים יציב ומאובטח */}
      <Modal opened={historyOpened} onClose={() => { setHistoryOpened(false); setSelectedRuleForHistory(null); }} title={<Group gap="xs"><IconHistory size={22} color="#4c6ef5"/><Text fw={900} size="lg">היסטוריית גרסאות ושינויים לחוק: {selectedRuleForHistory?.name}</Text></Group>} size="lg" centered dir="rtl">
          <ScrollArea h={500} offsetScrollbars>
              {selectedRuleForHistory?.history && selectedRuleForHistory.history.length > 0 ? (
                  <Stack gap="md" pr="xs">
                      {selectedRuleForHistory.history.slice().reverse().map((h, idx, arr) => {
                          const prev = arr[idx + 1];
                          const queryChanged = prev && h.query !== prev.query;
                          return (
                              <Paper key={idx} withBorder p="md" radius="md" shadow="xs" style={{ borderRight: '4px solid #4c6ef5' }}>
                                  <Group justify="space-between" mb="xs">
                                      <Group gap="xs">
                                          <Badge size="md" radius="sm" variant="filled" color="indigo">גרסה {h.version}</Badge>
                                          <Text fw={800} size="sm" c="dark.7">{h.user || 'מערכת'}</Text>
                                      </Group>
                                      <Group gap="xs">
                                          <Text size="xs" c="dimmed" fw={600}>{h.date}</Text>
                                          <Button size="compact-xs" variant="light" color="blue" leftSection={<IconRestore size={12}/>} onClick={() => handleRestore(selectedRuleForHistory.id, h)}>
                                              שחזר לגרסה זו
                                          </Button>
                                      </Group>
                                  </Group>
                                  
                                  {h.reason && (
                                      <Paper withBorder p="xs" bg="grape.0" style={{ borderColor: '#eebefa', borderRadius: '6px' }} mb="xs">
                                          <Text size="xs" fw={800} c="grape.9">סיבת השינוי/העדכון:</Text>
                                          <Text size="sm" fw={700} c="dark.8">{h.reason}</Text>
                                      </Paper>
                                  )}

                                  <Stack gap={4}>
                                      <Text size="xs" fw={800} c="dimmed">השאילתה שהוגדרה בגרסה זו:</Text>
                                      <Code block style={{ direction: 'ltr', textAlign: 'left', fontSize: '11px', backgroundColor: '#1a1b26', color: '#9ece6a', border: queryChanged ? '1px solid #fab005' : 'none' }}>
                                          {h.query || 'לא זמינה'}
                                      </Code>
                                      {queryChanged && <Badge color="orange" variant="light" size="xs">שינוי שאילתה זוהה</Badge>}
                                  </Stack>
                              </Paper>
                          );
                      })}
                  </Stack>
              ) : (
                  <Center py="xl">
                      <Stack align="center" gap="xs">
                          <IconInfoCircle size={36} color="gray"/>
                          <Text c="dimmed" size="sm" fw={700}>לא נמצאו גרסאות קודמות לחוק זה במערכת.</Text>
                      </Stack>
                  </Center>
              )}
          </ScrollArea>
      </Modal>

      {/* מודאל 1: סקירת רכיבים ב-Live (Current State) */}
      <Modal 
        opened={nodesOverviewOpened} 
        onClose={() => setNodesOverviewOpened(false)} 
        title={<Group gap="sm"><IconSitemap color="#339af0" size={28}/><Text fw={900} size="xl" c="blue.9">סקירת רכיבים פעילים ומצב ניטור</Text></Group>} 
        size="85%" 
        dir="rtl"
        bg="gray.0"
      >
        <Stack gap="lg" pb="md">
            <Group justify="space-between" align="center">
                <Text c="dimmed" size="sm" fw={500}>סקירה חיה של כלל הרכיבים שזוהו בשרת, כולל ספירת חוקי הניטור המשויכים אליהם.</Text>
                <TextInput 
                    placeholder="חיפוש מהיר של רכיב..." 
                    size="md"
                    radius="md"
                    leftSection={<IconSearch size={18} />} 
                    value={nodeSearchTerm}
                    onChange={(e) => setNodeSearchTerm(e.currentTarget.value)}
                    w={{ base: '100%', sm: '300px' }}
                    styles={{ input: { border: '2px solid #e9ecef', '&:focus': { borderColor: '#339af0' } } }}
                />
            </Group>
            
            <ScrollArea h={600} offsetScrollbars type="auto" bg="gray.0" p="sm" style={{ borderRadius: '8px' }}>
                {(() => {
                    let latestNodes = [];
                    if (syncHistory?.nodes_history?.length > 0) {
                        const lastSync = syncHistory.nodes_history[syncHistory.nodes_history.length - 1];
                        if (Array.isArray(lastSync.nodes)) latestNodes = lastSync.nodes;
                    }
                    latestNodes = Array.from(new Set(latestNodes)).filter(n => n && typeof n === 'string');
                    
                    if (latestNodes.length === 0) {
                        return (
                            <Center h={300}>
                                <Stack align="center" gap="xs">
                                    <IconInfoCircle size={50} color="gray" />
                                    <Text fw={700} c="dimmed" size="lg">לא נמצאו רכיבים במאגר.</Text>
                                    <Text size="sm" c="dimmed">יש לבצע סנכרון רכיבים מהשרת כדי להציג מידע.</Text>
                                </Stack>
                            </Center>
                        );
                    }

                    const filteredNodes = latestNodes.filter(n => n.toLowerCase().includes(nodeSearchTerm.toLowerCase()));

                    return (
                        <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="lg">
                            {filteredNodes.map((nodeName, idx) => {
                                const lowerNodeName = nodeName.toLowerCase();
                                
                                const customRules = rules.filter(r => {
                                    if (r.tech !== 'CUSTOM' && r.tech !== 'rabbit' && r.tech !== 'rabbitmq') return false;
                                    
                                    // 1. חיפוש ישיר מתוך השאילתה (vhost-queue) עבור ראביט
                                    const q = (r.queryMajor || '') + ' ' + (r.queryCritical || '') + ' ' + (r.query || '');
                                    if (r.tech === 'rabbit' || q.toLowerCase().includes('rabbitmq')) {
                                        const queueMatch = q.match(/queue\s*=\s*["']([^"']+)["']/i);
                                        const vhostMatch = q.match(/vhost\s*=\s*["']([^"']+)["']/i);
                                        if (queueMatch && vhostMatch) {
                                            const vhost = vhostMatch[1].toLowerCase().trim();
                                            const queue = queueMatch[1].toLowerCase().trim();
                                            // התיקון: הצמדה אך ורק לפי vhost-queue
                                            if (`${vhost}-${queue}` === lowerNodeName) return true;
                                        }
                                    }

                                    // 2. בדיקות צימוד ומיפוי גנרי
                                    if (r.attachedComponents && r.attachedComponents.some(c => c.toLowerCase() === lowerNodeName)) return true;
                                    if (r.node === 'GENERIC' || r.node === 'SYS_GENERIC') return customGenericMappings[r.id]?.resolvedNames?.includes(lowerNodeName);
                                    
                                    return String(r.node).toLowerCase() === lowerNodeName || String(r.name).toLowerCase() === lowerNodeName;
                                });
                                
                                const elasticRules = rules.filter(r => {
                                    if (r.tech !== 'elastic_log') return false;
                                    if (r.attachedComponents && r.attachedComponents.some(c => c.toLowerCase() === lowerNodeName)) return true;
                                    if (r.node === 'GENERIC') return customGenericMappings[r.id]?.resolvedNames?.includes(lowerNodeName);
                                    return String(r.node).toLowerCase() === lowerNodeName;
                                });
                                
                                const totalRules = customRules.length + elasticRules.length;

                                return (
                                    <Card key={idx} shadow="sm" p="md" radius="md" withBorder style={{ transition: 'transform 0.2s ease, box-shadow 0.2s ease' }} onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.1)'; }} onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--mantine-shadow-sm)'; }}>
                                        <Group justify="space-between" mb="sm" align="flex-start" wrap="nowrap">
                                            <Stack gap={2} style={{ flexGrow: 1, overflow: 'hidden' }}>
                                                <Text fw={900} size="lg" c="dark.8" truncate="end" style={{ fontFamily: 'monospace', direction: 'ltr', textAlign: 'left' }} title={nodeName}>
                                                    {nodeName}
                                                </Text>
                                                <Group gap="xs" mt={2}>
                                                    <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: totalRules > 0 ? '#40c057' : '#ced4da' }} />
                                                    <Text size="xs" c={totalRules > 0 ? "teal.7" : "dimmed"} fw={600}>
                                                        {totalRules > 0 ? `מנוטר ע"י ${totalRules} חוקים` : 'לא מנוטר כרגע'}
                                                    </Text>
                                                </Group>
                                            </Stack>
                                            <ThemeIcon size="xl" radius="md" variant={totalRules > 0 ? "light" : "outline"} color={totalRules > 0 ? "blue" : "gray"}>
                                                <IconServer size={22} />
                                            </ThemeIcon>
                                        </Group>

                                        <Divider my="sm" color="gray.1" />

                                        <Group grow gap="xs">
                                            <Button 
                                                variant={customRules.length > 0 ? "light" : "subtle"} 
                                                color={customRules.length > 0 ? "grape" : "gray"} 
                                                size="xs" 
                                                radius="md"
                                                onClick={() => setClickedNodeRulesModal({ opened: true, nodeName, rules: customRules, type: 'CUSTOM / Rabbit' })} 
                                                disabled={customRules.length === 0}
                                                leftSection={<IconCode size={14} />}
                                            >
                                                {customRules.length} חוקי רכיב
                                            </Button>
                                            <Button 
                                                variant={elasticRules.length > 0 ? "light" : "subtle"} 
                                                color={elasticRules.length > 0 ? "teal" : "gray"} 
                                                size="xs" 
                                                radius="md"
                                                onClick={() => setClickedNodeRulesModal({ opened: true, nodeName, rules: elasticRules, type: 'Elastic' })} 
                                                disabled={elasticRules.length === 0}
                                                leftSection={<IconDatabase size={14} />}
                                            >
                                                {elasticRules.length} Logs
                                            </Button>
                                        </Group>
                                    </Card>
                                );
                            })}
                        </SimpleGrid>
                    );
                })()}
            </ScrollArea>
        </Stack>
      </Modal>

      // NEW
      {/* מודאל 2: ניהול סנכרון והיסטוריה (Sync Control Center) */}
      <Modal 
        opened={syncManagementOpened} 
        onClose={() => setSyncManagementOpened(false)} 
        title={<Text fw={900} size="xl">מרכז ניהול סנכרון והיסטוריה</Text>} 
        size="90%" 
        dir="rtl"
      >
        <Tabs value={historyTab} onChange={setHistoryTab} mb="md">
            <Tabs.List grow>
                <Tabs.Tab value="nodes" leftSection={<IconSitemap size={16} />}>היסטוריית רכיבים (Nodes)</Tabs.Tab>
                <Tabs.Tab value="rules" leftSection={<IconFileText size={16} />}>היסטוריית חוקים (Rules)</Tabs.Tab>
            </Tabs.List>
        </Tabs>

        <Grid gutter="xl">
          <Grid.Col span={4}>
            <Stack>
                <Paper withBorder p="md" bg="gray.0" radius="md">
                    <Text fw={700} mb="xs">סטטוס סנכרון נוכחי</Text>
                    <Group justify="space-between">
                        <Text size="sm">ריצה אחרונה:</Text>
                        <Badge color="blue" variant="filled">{syncHistory.last_sync}</Badge>
                    </Group>
                    <Button 
                        fullWidth mt="md" 
                        leftSection={<IconPlayerPlay size={16} />} 
                        onClick={handleManualSync} 
                        loading={isManualSyncing}
                        variant="gradient" gradient={{ from: 'grape', to: 'indigo' }}
                    >
                        הפעל סנכרון ידני עכשיו
                    </Button>
                </Paper>
                
                <Divider label="לוג גרסאות היסטורי" labelPosition="center" />
                
                <ScrollArea h={350}>
                    <Stack gap="xs">
                        {(historyTab === 'nodes' ? syncHistory.nodes_history : syncHistory.rules_history || []).slice().reverse().map((rev, idx) => {
                            const historyArr = historyTab === 'nodes' ? syncHistory.nodes_history : (syncHistory.rules_history || []);
                            const actualIdx = historyArr.length - 1 - idx;
                            const isSelected = (historyTab === 'nodes' ? selectedNodesVersionIdx : selectedRulesVersionIdx) === actualIdx;
                            return (
                                <Paper 
                                    key={actualIdx} withBorder p="sm" radius="md"
                                    style={{ 
                                        cursor: 'pointer', 
                                        backgroundColor: isSelected ? '#f0f7ff' : 'white',
                                        borderColor: isSelected ? '#228be6' : '#e9ecef' 
                                    }}
                                    onClick={() => historyTab === 'nodes' ? setSelectedNodesVersionIdx(actualIdx) : setSelectedRulesVersionIdx(actualIdx)}
                                >
                                    <Group justify="space-between">
                                        <Text fw={isSelected ? 800 : 500} size="sm">V{rev.version} - {rev.date}</Text>
                                        {actualIdx === historyArr.length - 1 && <Badge size="xs" color="green">Live</Badge>}
                                    </Group>
                                </Paper>
                            );
                        })}
                    </Stack>
                </ScrollArea>
            </Stack>
          </Grid.Col>

          <Grid.Col span={8}>
            <Stack>
                <Text fw={800} size="lg">שינויים בגרסה הנבחרת (Diff Mode):</Text>
                {((historyTab === 'nodes' && selectedNodesVersionIdx !== -1) || (historyTab === 'rules' && selectedRulesVersionIdx !== -1)) ? (
                    <Paper withBorder p="md" radius="md" bg="gray.0">
                        {renderDiff((historyTab === 'nodes' ? syncHistory.nodes_history : syncHistory.rules_history).slice(0, (historyTab === 'nodes' ? selectedNodesVersionIdx : selectedRulesVersionIdx) + 1), historyTab)}
                        
                        <Text mt="md" fw={700} size="sm">
                            רשימת {historyTab === 'nodes' ? 'רכיבים' : 'חוקים'} בגרסה זו (
                            {(historyTab === 'nodes' 
                                ? syncHistory.nodes_history[selectedNodesVersionIdx]?.nodes 
                                : syncHistory.rules_history[selectedRulesVersionIdx]?.rules || []).length}
                            ):
                        </Text>
                        <ScrollArea h={300} mt="xs">
                            <Group gap="xs">
                                {historyTab === 'nodes' 
                                    ? (syncHistory.nodes_history[selectedNodesVersionIdx]?.nodes || []).map((n, idx) => (
                                        <Badge key={idx} variant="outline" color="gray">{n}</Badge>
                                      ))
                                    : (syncHistory.rules_history[selectedRulesVersionIdx]?.rules || []).map((r, idx) => (
                                        <Badge key={idx} variant="outline" color="grape">{r.name}</Badge>
                                      ))
                                }
                            </Group>
                        </ScrollArea>
                    </Paper>
                ) : (
                    <Center h={300} style={{ border: '2px dashed #e9ecef', borderRadius: '8px' }}>
                        <Text c="dimmed">בחר גרסה מהרשימה כדי לראות את השינויים שבוצעו בה</Text>
                    </Center>
                )}
            </Stack>
          </Grid.Col>
        </Grid>
      </Modal>

      {/* מודאל צפייה בחוקי רכיב ספציפי לאחר לחיצה מהטבלה */}
      <Modal opened={clickedNodeRulesModal.opened} onClose={() => setClickedNodeRulesModal({ ...clickedNodeRulesModal, opened: false })} title={<Text fw={900} size="lg">חוקי {clickedNodeRulesModal.type} עבור רכיב: {clickedNodeRulesModal.nodeName}</Text>} centered dir="rtl" size="xl">
          <Stack gap="xl">
              {clickedNodeRulesModal.rules.length === 0 ? (
                  <Text c="dimmed" ta="center">אין חוקים מוצמדים לרכיב זה.</Text>
              ) : (
                  clickedNodeRulesModal.rules.map((r, index) => (
                      <Paper key={r.id} withBorder p="md" radius="md" shadow="md" bg="gray.0" style={{ borderRight: '6px solid #339af0' }}>
                          <Group justify="space-between" mb="md">
                              <Group gap="xs">
                                  <Badge color={r.tech === 'CUSTOM' ? 'grape' : (r.tech === 'rabbit' ? 'orange' : 'teal')} size="lg">{r.tech}</Badge>
                                  {/* חילוץ והצגת תגיות ספים */}
                                  {(() => {
                                      const extractThreshold = (query) => {
                                          if (!query) return null;
                                          const match = query.match(/(?:>=|<=|>|<|==|!=)\s*([-+]?[0-9]*\.?[0-9]+)\s*$/);
                                          return match ? match[1] : null;
                                      };
                                      const majorVal = r.majorThreshold !== undefined && r.majorThreshold !== null ? r.majorThreshold : extractThreshold(r.queryMajor);
                                      const criticalVal = r.criticalThreshold !== undefined && r.criticalThreshold !== null ? r.criticalThreshold : extractThreshold(r.queryCritical);
                                      
                                      return (
                                          <Group gap={4}>
                                              {majorVal !== null && <Badge color="yellow" variant="light">Major: {majorVal}</Badge>}
                                              {criticalVal !== null && <Badge color="red" variant="light">Critical: {criticalVal}</Badge>}
                                          </Group>
                                      );
                                  })()}
                              </Group>
                              <Badge color="gray" variant="outline">חוק {index + 1}</Badge>
                          </Group>

                          <Stack gap="sm">
                              {r.queryMajor && (
                                  <Paper withBorder p="xs" bg="yellow.0" style={{ borderColor: '#fcc419' }}>
                                      <Group justify="space-between" mb="xs">
                                          <Text fw={800} c="yellow.9">MAJOR (אזהרה)</Text>
                                          <CopyButton value={r.queryMajor} timeout={2000}>
                                              {({ copied, copy }) => (
                                                  <Button color={copied ? 'teal' : 'yellow.7'} variant="light" size="xs" onClick={copy} leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}>
                                                      {copied ? 'הועתק!' : 'העתק שאילתה'}
                                                  </Button>
                                              )}
                                          </CopyButton>
                                      </Group>
                                      <Code block c="yellow.9" style={{ direction: 'ltr', textAlign: 'left', backgroundColor: '#fff9db' }}>{r.queryMajor}</Code>
                                  </Paper>
                              )}
                              
                              {r.queryCritical && (
                                  <Paper withBorder p="xs" bg="red.0" style={{ borderColor: '#fa5252' }}>
                                      <Group justify="space-between" mb="xs">
                                          <Text fw={800} c="red.9">CRITICAL (קריטי)</Text>
                                          <CopyButton value={r.queryCritical} timeout={2000}>
                                              {({ copied, copy }) => (
                                                  <Button color={copied ? 'teal' : 'red.7'} variant="light" size="xs" onClick={copy} leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}>
                                                      {copied ? 'הועתק!' : 'העתק שאילתה'}
                                                  </Button>
                                              )}
                                          </CopyButton>
                                      </Group>
                                      <Code block c="red.9" style={{ direction: 'ltr', textAlign: 'left', backgroundColor: '#fff5f5' }}>{r.queryCritical}</Code>
                                  </Paper>
                              )}

                              {!r.queryMajor && !r.queryCritical && r.query && (
                                  <Paper withBorder p="xs" bg="blue.0" style={{ borderColor: '#339af0' }}>
                                      <Group justify="space-between" mb="xs">
                                          <Text fw={800} c="blue.9">שאילתה כללית</Text>
                                          <CopyButton value={r.query} timeout={2000}>
                                              {({ copied, copy }) => (
                                                  <Button color={copied ? 'teal' : 'blue.7'} variant="light" size="xs" onClick={copy} leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}>
                                                      {copied ? 'הועתק!' : 'העתק שאילתה'}
                                                  </Button>
                                              )}
                                          </CopyButton>
                                      </Group>
                                      <Code block c="blue.9" style={{ direction: 'ltr', textAlign: 'left', backgroundColor: '#e7f5ff' }}>{r.query}</Code>
                                  </Paper>
                              )}
                          </Stack>

                          <Divider my="sm" />
                          
                          <Stack gap={4}>
                              <Text fw={900} size="lg" c="dark.8">שם החוק: <Text span fw={700} c="blue.9">{r.name}</Text></Text>
                              <Text size="md" fw={600} c="dark.6">מטרה: <Text span fw={500} c="dimmed">{r.purposeRule || r.purpose || 'ללא תיאור'}</Text></Text>
                          </Stack>

                          {r.history && r.history.length > 0 && (
                              <Text size="xs" c="dimmed" mt="md" ta="left">
                                  V{r.history[r.history.length - 1].version} | {r.history[r.history.length - 1].date}
                              </Text>
                          )}
                      </Paper>
                  ))
              )}
          </Stack>
      </Modal>

              <Paper withBorder p="sm" radius="md" mb="md" bg="gray.0" dir="rtl">
                <TextInput 
                   label="חיפוש חופשי" 
                   placeholder="שם חוק, שאילתה, מטרה..." 
                   value={searchQuery} 
                   onChange={(e) => setSearchQuery(e.currentTarget.value)} 
                   leftSection={<IconSearch size={16} />} 
                />
              </Paper>

              <Paper withBorder p="md" radius="md" bg="gray.0">
                <Group justify="space-between" mb="md">
                    <Group>
                        <Text fw={900} size="xl" c="blue.9">ניהול חוקים מפורט</Text>
                        <Group gap="sm">
                            <Button 
                                variant="light" 
                                color="blue" 
                                leftSection={<IconSitemap size={20} />}
                                onClick={() => setNodesOverviewOpened(true)}
                            >
                                סקירת רכיבים (Live)
                            </Button>
                            <Button 
                                variant="light" 
                                color="grape" 
                                leftSection={<IconHistory size={20} />}
                                onClick={() => setSyncManagementOpened(true)}
                            >
                                לוג סנכרון והיסטוריה
                            </Button>
                        </Group>
                        {syncStatus && (
                            <Tooltip label={syncStatus.details || "הכל תקין מסונכרן מול השרת"}>
                                <Badge 
                                    color={syncStatus.nodes_ok && syncStatus.rules_ok ? 'teal' : 'red'} 
                                    variant="filled"
                                    size="lg"
                                    leftSection={<IconHistory size={14}/>}
                                >
                                    סנכרון שרת: {syncStatus.timestamp}
                                </Badge>
                            </Tooltip>
                        )}
                    </Group>
                </Group>
                
                {incompleteRules.length > 0 && (
                    <Alert icon={<IconAlertTriangle size={16} />} title={`שים לב: ישנם ${incompleteRules.length} חוקים שלא מלאים!`} color="orange" mb="md">
                        לפחות אחד מהחוקים בטבלה חסר בשדות מהותיים כגון שם, מטרה או שאילתת ניטור. אנא ערוך אותם.
                    </Alert>
                )}
                


        <Tabs defaultValue="custom" color="blue" radius="md">
            <Tabs.List mb="md">
             <Tabs.Tab value="custom" leftSection={<IconCode size={16}/>} color="grape">
                <Text fw={700}>ניטורי CUSTOM ({filteredRules.filter(r => r.tech === 'CUSTOM').length})</Text>
             </Tabs.Tab>
             <Tabs.Tab value="elastic" leftSection={<IconDatabase size={16}/>} color="teal">
                <Text fw={700}>ניטורי אלסטיק ({filteredRules.filter(r => r.tech === 'elastic_log').length})</Text>
             </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="custom">
            <RulesTable 
              rules={filteredRules.filter(r => r.tech === 'CUSTOM')} 
              onDelete={handleDeleteRule} 
              onBulkDelete={handleBulkDelete} 
              onEdit={handleEditClick} 
              onViewHistory={handleHistoryClick} 
              userRole={currentRole} 
              onOpenCheckExists={(rule) => {
                  setCheckExistsModal({ open: true, inputType: 'rule', selectedRuleId: rule.id, promqlQuery: '', mappingTemplate: rule.mappingTemplate || '{{$labels.label}}', results: null, loading: true, selectedRuleName: rule.name, isAutoMode: true });
                  handleRunCheckExists(rule);
              }} 
              onAddRule={() => { setEditingRule(null); openModal(); }} 
            />
          </Tabs.Panel>
          <Tabs.Panel value="elastic">
            <RulesTable 
              rules={filteredRules.filter(r => r.tech === 'elastic_log')} 
              onDelete={handleDeleteRule} 
              onBulkDelete={handleBulkDelete} 
              onEdit={handleEditClick} 
              onViewHistory={handleHistoryClick} 
              userRole={currentRole} 
              onOpenCheckExists={(rule) => {
                  setCheckExistsModal({ open: true, inputType: 'rule', selectedRuleId: rule.id, promqlQuery: '', mappingTemplate: rule.mappingTemplate || '{{$labels.label}}', results: null, loading: true, selectedRuleName: rule.name, isAutoMode: true });
                  handleRunCheckExists(rule);
              }} 
              onAddRule={() => { setEditingRule(null); openModal(); }} 
            />
          </Tabs.Panel>
        </Tabs>
              </Paper>
            </Paper>
          </Container>
        )}

        {/* טאב מסך בית (VIEWER בלבד) - דף נחיתה */}
        {activeTab === 'home' && currentRole === 'viewer' && (
          <Container fluid px="md" style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
            <Paper shadow="xl" p="xl" radius="md" withBorder style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: '#f8f9fa', position: 'relative', overflow: 'hidden' }} dir="rtl">
                
                <Stack align="center" gap="sm" mt="xl" style={{ zIndex: 2, textAlign: 'center' }}>
                    <Title order={1} c="blue.9" style={{ fontSize: '3rem' }}>כלל ניטורי נפטון עבור מערכות 670</Title>
                    
                    {/* כותרת דינמית לפי מצב 24/7 */}
                    <Title order={3} c="dimmed">
                        {sysConfig?.home_config?.is_24_7 ? (
                            `זמינים 24/7 בוויפ של המשמרת ${sysConfig?.home_config?.wip || 'X'}`
                        ) : (
                            `זמינים בוויפ של המשמרת ${sysConfig?.home_config?.wip || 'X'} מהשעה ${sysConfig?.home_config?.start_time || 'Y'} עד השעה ${sysConfig?.home_config?.end_time || 'T'}`
                        )}
                    </Title>
                    
                    {/* בלוק חייל במשמרת - דינמי לפי מקור (WEEKI או ידני) */}
                    {(() => {
                        const isWeeki = sysConfig?.home_config?.soldier_source === 'weeki';
                        const displayName = isWeeki ? (weekiData?.name || 'טוען נתונים מ-WEEKI...') : (sysConfig?.home_config?.soldier_name || 'שם חייל');
                        const displayUser = isWeeki ? (weekiData?.user || '') : (sysConfig?.home_config?.soldier_user || 'user@domain.com');

                        return (
                            <Paper withBorder p="md" radius="md" mt="md" bg="white" shadow="sm">
                                <Text size="xl" fw={700}>
                                    <Text component="a" href={`xmpp:${displayUser}`} c="teal.7" style={{ textDecoration: 'none', cursor: 'pointer', borderBottom: '2px dashed #20c997' }}>
                                        @{displayName}
                                    </Text>
                                    {' '}מאייש/ת את המשמרת היום ({new Date().toLocaleDateString('he-IL')})
                                </Text>
                            </Paper>
                        );
                    })()}

                    {/* אנשי קשר יורדים שורה - השתמשנו ב-Stack במקום ב-Group */}
                    {sysConfig?.home_config?.contacts?.length > 0 && (
                        <Paper withBorder p="md" radius="md" mt="sm" bg="red.0" style={{ borderColor: '#ffa8a8', minWidth: '300px' }}>
                            <Text fw={700} c="red.8" ta="center" mb="xs" style={{ borderBottom: '1px solid #ffc9c9', paddingBottom: '4px' }}>אנשי קשר נוספים -</Text>
                            <Stack align="center" gap={4}>
                                {sysConfig.home_config.contacts.map((contact, idx) => (
                                    <Text key={idx} fw={600} c="red.9" size="lg">{contact.label}: {contact.value}</Text>
                                ))}
                            </Stack>
                        </Paper>
                    )}
                </Stack>

                <div style={{ flexGrow: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', width: '100%', opacity: 0.9, marginTop: '20px' }}>
                    <Image src={image1} style={{ maxHeight: '45vh', width: 'auto', objectFit: 'contain' }} />
                </div>
            </Paper>
          </Container>
        )}

        {/* טאב 2: סורק ארכיטקטורה (OCR) - מחליף את המסלולים */}
        {activeTab === 'scanner' && (
          <Container fluid px="md" pb={120}>
            <Paper shadow="xl" p="xl" radius="md" withBorder dir="rtl" bg="white">
               <ArchitectureScanner rules={rules} />
            </Paper>
          </Container>
        )}

        {/* טאב 3: ניטורים אפליקטיביים (ראביט ואלסטיק) */}
        {activeTab === 'queries' && (
          <Container fluid px="md" pb={120}>
            <Paper shadow="xl" p="xl" radius="md" withBorder dir="rtl">
              <Group justify="space-between" mb="xl">
                <Title order={2} c="blue.9">ניטורים אפליקטיביים - תורים ולוגים</Title>
              </Group>

              <Tabs value={appMonitoringTab} onChange={setAppMonitoringTab} color="blue" radius="md" variant="pills">
                  <Tabs.List mb="lg" justify="center">
                      <Tabs.Tab value="rabbit" leftSection={<Image src={iconMessages} w={20} />}>
                          <Text fw={700} size="lg">ניהול ניטורי תורים (RabbitMQ)</Text>
                      </Tabs.Tab>
                      <Tabs.Tab value="elastic" leftSection={<Image src={iconLogs} w={20} />} color="teal">
                          <Text fw={700} size="lg">ניהול ניטורי אלסטיק (Logs)</Text>
                      </Tabs.Tab>
                  </Tabs.List>

                  <Tabs.Panel value="rabbit">
                      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
                        {adminTeams.filter(t => t.hasRabbit !== false).map(teamObj => {
                          const teamRabbitRules = rules.filter(r => r.tech === 'rabbit' && r.application === teamObj.id);
                          return (
                            <Card key={teamObj.id} shadow="sm" p="lg" withBorder radius="md" style={{ cursor: 'pointer', transition: 'transform 0.2s ease', display: 'flex', flexDirection: 'column' }} onClick={() => { setSelectedRabbitTeam(teamObj); setRabbitModalOpen(true); }} onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
                              <Group justify="center" mb="sm" mt="sm"><IconAppWindow size={40} color="#339af0" /></Group>
                              <Text fw={900} size="xl" ta="center" mb="xs">{teamObj.name}</Text>
                              <Group justify="center" mb="md">
                                <Badge color={teamRabbitRules.length > 0 ? "blue" : "gray"} variant="light" size="lg">
                                  {teamRabbitRules.length > 0 ? `${teamRabbitRules.length} תורים מנוטרים` : "לא הוגדרו תורים"}
                                </Badge>
                              </Group>
                              
                              {teamRabbitRules.length > 0 && (() => {
                                  const combinedMajor = teamRabbitRules.map(r => r.queryMajor).filter(Boolean).join('\n or \n');
                                  const combinedCritical = teamRabbitRules.map(r => r.queryCritical).filter(Boolean).join('\n or \n');

                                  return (
                                      <Paper withBorder p="sm" bg="gray.0" radius="md" mt="auto" onClick={(e) => e.stopPropagation()}>
                                          <Text fw={800} size="sm" mb="xs" ta="center" c="dark.7">סיכום ניטור מאוחד (העתק-הדבק)</Text>
                                          <Stack gap="xs">
                                              <Group justify="space-between" bg="yellow.0" p={4} style={{ borderRadius: '4px', border: '1px solid #fcc419' }}>
                                                  <Text fw={800} size="xs" c="yellow.9" ml="xs">MAJOR</Text>
                                                  <CopyButton value={combinedMajor} timeout={2000}>
                                                      {({ copied, copy }) => (
                                                          <Button color={copied ? 'teal' : 'yellow.7'} variant="light" size="compact-xs" onClick={(e) => { e.stopPropagation(); copy(); }} leftSection={copied ? <IconCheck size={12} /> : <IconCopy size={12} />}>
                                                              {copied ? 'הועתק!' : 'העתק'}
                                                          </Button>
                                                      )}
                                                  </CopyButton>
                                              </Group>
                                              <Group justify="space-between" bg="red.0" p={4} style={{ borderRadius: '4px', border: '1px solid #fa5252' }}>
                                                  <Text fw={800} size="xs" c="red.9" ml="xs">CRITICAL</Text>
                                                  <CopyButton value={combinedCritical} timeout={2000}>
                                                      {({ copied, copy }) => (
                                                          <Button color={copied ? 'teal' : 'red.7'} variant="light" size="compact-xs" onClick={(e) => { e.stopPropagation(); copy(); }} leftSection={copied ? <IconCheck size={12} /> : <IconCopy size={12} />}>
                                                              {copied ? 'הועתק!' : 'העתק'}
                                                          </Button>
                                                      )}
                                                  </CopyButton>
                                              </Group>
                                          </Stack>
                                      </Paper>
                                  );
                              })()}
                            </Card>
                          );
                        })}
                      </SimpleGrid>
                  </Tabs.Panel>

                  <Tabs.Panel value="elastic">
                      <Stack gap="md">
                          <Paper bg="gray.0" p="md" radius="md" withBorder>
                              <Text fw={800} size="lg" c="teal.9">סביבות אלסטיק קיימות במערכת (פורט 6002)</Text>
                              <Text size="xs" c="dimmed">לחץ על קוביית הסביבה המבוקשת כדי לנהל את האינדקסים שלה, לבצע שליפות ולהוסיף חוקי ניטור לוגים.</Text>
                          </Paper>

                          {/* חלוקה לסביבות אלסטיק בצורה של קוביות ויזואליות מקצועיות */}
                          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
                              {elasticEnvs.map((envObj, idx) => {
                                  const envName = Object.keys(envObj)[0];
                                  const envRules = rules.filter(r => r.tech === 'elastic_log' && r.elasticEnv === envName);
                                  const envIndexesList = Array.from(new Set([
                                      ...(customIndexes[envName] || []),
                                      ...envRules.map(r => r.indexName).filter(Boolean)
                                  ]));

                                  return (
                                      <Card 
                                          key={idx} 
                                          shadow="md" 
                                          p="xl" 
                                          withBorder 
                                          radius="lg" 
                                          style={{ 
                                              cursor: 'pointer', 
                                              transition: 'all 0.2s ease', 
                                              borderTop: '6px solid #20c997',
                                              backgroundColor: '#fff'
                                          }}
                                          onClick={() => {
                                              setSelectedEnvForMgmt(envName);
                                              setActiveIndexTab(null);
                                              setEnvModalOpen(true);
                                              setQueryTestResult(null);
                                              setElasticForm({ query: '', timeRange: '15m', reason: '', maktag: '', mappingType: 'node', node: '', mappingTemplate: '' });
                                          }}
                                          onMouseEnter={(e) => {
                                              e.currentTarget.style.transform = 'translateY(-4px)';
                                              e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.1)';
                                          }}
                                          onMouseLeave={(e) => {
                                              e.currentTarget.style.transform = 'translateY(0)';
                                              e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.04)';
                                          }}
                                      >
                                          <Group justify="space-between" align="center" mb="md">
                                              <Group gap="sm">
                                                  <ThemeIcon size="xl" radius="md" color="teal" variant="light">
                                                      <IconDatabase size={24} />
                                                  </ThemeIcon>
                                                  <Text fw={900} size="xl" c="dark.8" dir="ltr">{envName}</Text>
                                              </Group>
                                              <Badge color="teal" size="lg" variant="filled">סביבה פעילה</Badge>
                                          </Group>

                                          <Divider my="sm" />
                                          
                                          <Grid grow mt="xs">
                                              <Grid.Col span={6}>
                                                  <Stack gap={2} align="center">
                                                      <Text size="xs" c="dimmed" fw={700}>אינדקסים מוגדרים</Text>
                                                      <Text size="xl" fw={900} c="teal.7">{envIndexesList.length}</Text>
                                                  </Stack>
                                              </Grid.Col>
                                              <Grid.Col span={6}>
                                                  <Stack gap={2} align="center">
                                                      <Text size="xs" c="dimmed" fw={700}>חוקי ניטור פעילים</Text>
                                                      <Text size="xl" fw={900} c="indigo.7">{envRules.length}</Text>
                                                  </Stack>
                                              </Grid.Col>
                                          </Grid>
                                      </Card>
                                  );
                              })}
                          </SimpleGrid>
                      </Stack>

                      {/* מודאל ניהול היררכי מתקדם - טאבים של אינדקסים ושליפות מרובות עם מיפוי רכיב */}
                      <Modal 
                          opened={envModalOpen} 
                          onClose={() => { setEnvModalOpen(false); setSelectedEnvForMgmt(null); setActiveIndexTab(null); setShowNewIndexForm(false); setShowNewQueryForm(false); }} 
                          title={<Group gap="xs"><IconDatabase size={24} color="#20c997" /><Text fw={900} size="xl" c="dark.8">ניהול ארכיטקטורת אלסטיק: <span dir="ltr">{selectedEnvForMgmt}</span></Text></Group>} 
                          size="90%" 
                          centered 
                          dir="rtl"
                          styles={{ body: { paddingBottom: '40px' } }}
                      >
                          <Stack gap="lg">
                              {/* אזור יצירת אינדקס חדש בנפרד */}
                              {!showNewIndexForm ? (
                                  <Button variant="light" color="teal" leftSection={<IconPlus size={16} />} onClick={() => setShowNewIndexForm(true)} style={{ alignSelf: 'flex-start' }}>
                                      הוסף אינדקס חדש לסביבה (רכיב)
                                  </Button>
                              ) : (
                                  <Paper withBorder p="md" bg="gray.0" radius="md" shadow="xs" style={{ position: 'relative' }}>
                                      <ActionIcon color="gray" variant="subtle" style={{ position: 'absolute', top: 10, left: 10 }} onClick={() => setShowNewIndexForm(false)}>
                                          <IconX size={16} />
                                      </ActionIcon>
                                      <Grid align="flex-end" mt="sm">
                                          <Grid.Col span={{ base: 12, sm: 8 }}>
                                              <TextInput 
                                                  label="הוספת אינדקס חדש לסביבה זו (במידה ולא קיים בטאבים)" 
                                                  placeholder="למשל: payment-service-logs-*" 
                                                  value={newIndexNameInput} 
                                                  onChange={(e) => setNewIndexNameInput(e.currentTarget.value)}
                                                  dir="ltr"
                                                  fw={700}
                                              />
                                          </Grid.Col>
                                          <Grid.Col span={{ base: 12, sm: 4 }}>
                                              <Button 
                                                  color="teal" 
                                                  fullWidth 
                                                  leftSection={<IconPlus size={16} />}
                                                  disabled={!newIndexNameInput.trim()}
                                                  onClick={async () => {
                                                      const indexName = newIndexNameInput.trim();
                                                      try {
                                                          await axios.post(`${API_BASE_URL}/api/create-elastic-index`, {
                                                              env: selectedEnvForMgmt,
                                                              indexName: indexName
                                                          });
                                                          const currentEnvIndexes = customIndexes[selectedEnvForMgmt] || [];
                                                          if (!currentEnvIndexes.includes(indexName)) {
                                                              setCustomIndexes({
                                                                  ...customIndexes,
                                                                  [selectedEnvForMgmt]: [...currentEnvIndexes, indexName]
                                                              });
                                                          }
                                                          setActiveIndexTab(indexName);
                                                          setNewIndexNameInput('');
                                                          setShowNewIndexForm(false);
                                                      } catch (e) {
                                                          alert('שגיאה ביצירת האינדקס החדש');
                                                      }
                                                  }}
                                              >
                                                  צור אינדקס באלסטיק
                                              </Button>
                                          </Grid.Col>
                                      </Grid>
                                  </Paper>
                              )}

                              {/* מנגנון הטאבים המקצועי למעבר בין אינדקסים */}
                              {(() => {
                                  const envRules = rules.filter(r => r.tech === 'elastic_log' && r.elasticEnv === selectedEnvForMgmt);
                                  const mergedIndexes = Array.from(new Set([
                                      ...(customIndexes[selectedEnvForMgmt] || []),
                                      ...envRules.map(r => r.indexName).filter(Boolean)
                                  ]));

                                  if (mergedIndexes.length > 0 && !activeIndexTab) {
                                      setTimeout(() => setActiveIndexTab(mergedIndexes[0]), 0);
                                  }

                                  return (
                                      <Tabs value={activeIndexTab} onChange={setActiveIndexTab} variant="outline" radius="md" color="teal">
                                          <Tabs.List mb="md">
                                              {mergedIndexes.map((indexName) => (
                                                  <Tabs.Tab 
                                                      key={indexName} 
                                                      value={indexName} 
                                                      leftSection={<IconList size={14} color="#20c997" />}
                                                  >
                                                      <Text fw={700} size="sm" dir="ltr">{indexName}</Text>
                                                  </Tabs.Tab>
                                              ))}
                                          </Tabs.List>

                                          {mergedIndexes.map((indexName) => {
                                              const indexRules = envRules.filter(r => r.indexName === indexName);
                                              return (
                                                  <Tabs.Panel key={indexName} value={indexName} pt="xs">
                                                      <Stack gap="md">
                                                          <Text fw={800} size="sm" c="dimmed">שליפות ושאילתות ניטור פעילות תחת אינדקס זה:</Text>

                                                          {/* רשימת השליפות המרובות הקיימות */}
                                                          <Stack gap="sm">
                                                              {indexRules.length === 0 ? (
                                                                  <Paper withBorder p="xl" bg="white" radius="md" style={{ borderStyle: 'dashed' }}>
                                                                      <Text size="xs" c="dimmed" ta="center" fw={700}>אין שליפות לוגים מוגדרות תחת אינדקס זה כרגע במערכת.</Text>
                                                                  </Paper>
                                                              ) : (
                                                                  <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
                                                                      {indexRules.map((r, rIdx) => {
                                                                          // השאילתה והזמן הנוכחיים כפי שנערכים ברגע זה (או הערך השמור אם לא נערך)
                                                                          const rid = r.id || r._id;
                                                                          const currentEditedQuery = editingQueries[rid] !== undefined ? editingQueries[rid] : (r.query || '*');
                                                                          const currentEditedTime = editingTimeRanges[rid] !== undefined ? editingTimeRanges[rid] : (r.timeRange || '15m');
                                                                          
                                                                          const lastEditor = r.history && r.history.length > 0 ? r.history[r.history.length - 1].user : (r.user || localStorage.getItem('username') || 'Ariel');

                                                                          return (
                                                                              <Card key={rIdx} withBorder radius="lg" bg="white" shadow="sm" p="md" style={{ display: 'flex', flexDirection: 'column', transition: 'all 0.25s ease', border: '1px solid #e9ecef', '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', borderColor: '#ced4da' } }}>
                                                                                  {/* כותרת הקלף: תגים ופעולות ניהול */}
                                                                                  <Group justify="space-between" align="center" mb="sm">
                                                                                      <Group gap="xs">
                                                                                          <Badge color="blue" variant="light" size="sm" radius="sm" leftSection={<IconClock size={12} />}>{r.timeRange || '15m'}</Badge>
                                                                                          {r.maktag && <Badge color="grape" variant="outline" size="sm" radius="sm">מקת"ג: {r.maktag}</Badge>}
                                                                                      </Group>
                                                                                      
                                                                                      <Group gap={4}>
                                                                                          <Tooltip label="היסטוריית עריכות">
                                                                                              <ActionIcon color="indigo" variant="subtle" size="sm" onClick={() => { setSelectedRuleForHistory(r); setHistoryOpened(true); }}><IconHistory size={16} /></ActionIcon>
                                                                                          </Tooltip>
                                                                                          <Tooltip label="מחיקת שליפה">
                                                                                              <ActionIcon color="red" variant="subtle" size="sm" onClick={async () => {
                                                                                                  if (window.confirm(`האם למחוק שליפה זו מהאינדקס?`)) {
                                                                                                      await axios.delete(`${API_BASE_URL}/rules/${rid}`, { headers: { 'x-user': localStorage.getItem('username') || 'Ariel' } });
                                                                                                      fetchRules();
                                                                                                  }
                                                                                              }}><IconTrash size={16} /></ActionIcon>
                                                                                          </Tooltip>
                                                                                      </Group>
                                                                                  </Group>

                                                                                  {/* גוף הקלף: שם השליפה ומטרה */}
                                                                                  <Stack gap={4} style={{ flexGrow: 1 }} mb="xs">
                                                                                      <Text fw={900} size="lg" c="dark.9" style={{ direction: 'ltr', textAlign: 'left', letterSpacing: '-0.3px' }}>
                                                                                          {r.name}
                                                                                      </Text>
                                                                                      <Text size="sm" c="gray.6" fw={500} style={{ direction: 'rtl', textAlign: 'right', lineHeight: '1.4' }}>
                                                                                          {r.purposeRule || r.purpose || 'ללא מטרה מוגדרת'}
                                                                                      </Text>
                                                                                      
                                                                                      <Group justify="flex-end" align="center" mt="sm">
                                                                                          {r.node && r.node !== 'GENERIC' && r.node !== 'SYS_GENERIC' ? (
                                                                                              <Badge size="xs" color="teal" variant="dot">רכיב: {r.node}</Badge>
                                                                                          ) : (
                                                                                              <Badge size="xs" color="violet" variant="dot">תבנית: {r.mappingTemplate}</Badge>
                                                                                          )}
                                                                                      </Group>
                                                                                  </Stack>

                                                                                  <Divider my="sm" color="gray.2" />

                                                                                  {/* אזור פעולות תחתי: הרצה והצגת שליפה */}
                                                                                  <Group justify="space-between" align="center">
                                                                                      <Tooltip label="הרץ שליפה עם הזמן והקוד המעודכנים כעת">
                                                                                          <Button 
                                                                                              variant="light" 
                                                                                              color={liveCounts[rid] !== undefined ? "teal" : "orange"}
                                                                                              size="xs" 
                                                                                              radius="xl"
                                                                                              leftSection={isFetchingCount[rid] ? <Loader size="xs" color="orange" /> : <IconPlayerPlay size={14} />}
                                                                                              onClick={async () => {
                                                                                                  setIsFetchingCount(prev => ({...prev, [rid]: true}));
                                                                                                  try {
                                                                                                      const res = await axios.post(`${API_BASE_URL}/api/elastic-count`, {
                                                                                                          env: r.elasticEnv || selectedEnvForMgmt || "unknown_env",
                                                                                                          index: r.indexName || indexName || "unknown_index",
                                                                                                          query: currentEditedQuery,  // משתמש בשאילתה הערוכה בזמן אמת!
                                                                                                          timeRange: currentEditedTime // משתמש בזמן הערוך בזמן אמת!
                                                                                                      });
                                                                                                      const val = res.data.count !== undefined ? res.data.count : (res.data.value !== undefined ? res.data.value : JSON.stringify(res.data));
                                                                                                      setLiveCounts(prev => ({...prev, [rid]: val}));
                                                                                                  } catch(e) {
                                                                                                      setLiveCounts(prev => ({...prev, [rid]: 'שגיאה'}));
                                                                                                  }
                                                                                                  setIsFetchingCount(prev => ({...prev, [rid]: false}));
                                                                                              }}
                                                                                          >
                                                                                              {liveCounts[rid] !== undefined ? `תוצאה: ${liveCounts[rid]}` : 'בדוק ערך נוכחי'}
                                                                                          </Button>
                                                                                      </Tooltip>

                                                                                      <Button 
                                                                                          variant="subtle" 
                                                                                          color="blue" 
                                                                                          size="xs" 
                                                                                          leftSection={expandedElasticRuleId === rid ? <IconChevronUp size={14} /> : <IconCode size={14} />}
                                                                                          onClick={() => {
                                                                                              if (expandedElasticRuleId === rid) {
                                                                                                  setExpandedElasticRuleId(null);
                                                                                              } else {
                                                                                                  setExpandedElasticRuleId(rid);
                                                                                                  // אתחול הסטייטים בעת פתיחת החלונית
                                                                                                  setEditingQueries(prev => ({...prev, [rid]: r.query || ''}));
                                                                                                  setEditingTimeRanges(prev => ({...prev, [rid]: r.timeRange || '15m'}));
                                                                                              }
                                                                                          }}
                                                                                      >
                                                                                          {expandedElasticRuleId === rid ? 'הסתר עורך' : 'הצג / ערוך שליפה'}
                                                                                      </Button>
                                                                                  </Group>

                                                                                  {/* אזור העריכה הנפתח */}
                                                                                  <Collapse in={expandedElasticRuleId === rid} mt="md">
                                                                                      <Paper withBorder p="sm" radius="md" bg="#f8f9fa" shadow="none">
                                                                                          <Tabs defaultValue="edit" color="indigo" variant="pills" radius="sm">
                                                                                              <Tabs.List grow mb="sm">
                                                                                                  <Tabs.Tab value="edit"><Text size="xs" fw={700}>ערוך שאילתה (KQL)</Text></Tabs.Tab>
                                                                                                  <Tabs.Tab value="qsl"><Text size="xs" fw={700}>תצוגת המלאה (QSL + Time)</Text></Tabs.Tab>
                                                                                              </Tabs.List>
                                                                                              
                                                                                              <Tabs.Panel value="edit" pt="xs">
                                                                                                  {/* בחירת זמן עצמאית מעל אזור הטקסט (הוסר הפילטר המהיר) */}
                                                                                                  <Group gap="sm" mb="sm" align="flex-end" dir="ltr" wrap="nowrap">
                                                                                                      <Select 
                                                                                                          label="Lookback Time"
                                                                                                          size="xs"
                                                                                                          data={['1m', '5m', '15m', '30m', '1h', '3h', '12h', '24h', '7d', '14d']}
                                                                                                          value={currentEditedTime}
                                                                                                          onChange={(val) => {
                                                                                                              setEditingTimeRanges(prev => ({...prev, [rid]: val}));
                                                                                                          }}
                                                                                                          style={{ width: '130px' }}
                                                                                                          styles={{ input: { fontWeight: 700, color: '#228be6' } }}
                                                                                                      />
                                                                                                  </Group>

                                                                                                  <Textarea 
                                                                                                      size="sm"
                                                                                                      styles={{ input: { direction: 'ltr', fontFamily: 'monospace', fontSize: '13px', backgroundColor: '#1a1b26', color: '#a9b1d6', border: '1px solid #2f334d', padding: '12px' } }}
                                                                                                      value={currentEditedQuery}
                                                                                                      onChange={(e) => {
                                                                                                          const val = e.currentTarget.value; 
                                                                                                          setEditingQueries(prev => ({...prev, [rid]: val}));
                                                                                                      }}
                                                                                                      minRows={4}
                                                                                                      maxRows={10}
                                                                                                      autosize
                                                                                                  />
                                                                                                  
                                                                                                  <Group justify="flex-end" mt="md">
                                                                                                      <Button 
                                                                                                          size="sm" 
                                                                                                          color="teal" 
                                                                                                          radius="md"
                                                                                                          leftSection={<IconDeviceFloppy size={16} />}
                                                                                                          disabled={currentEditedQuery === r.query && currentEditedTime === r.timeRange}
                                                                                                          onClick={async () => {
                                                                                                              try {
                                                                                                                  await axios.put(`${API_BASE_URL}/rules/${rid}`, { ...r, query: currentEditedQuery, timeRange: currentEditedTime }, { headers: { 'x-user': localStorage.getItem('username') || 'Ariel' } });
                                                                                                                  alert('השאילתה והזמן עודכנו ונשמרה בהצלחה!');
                                                                                                                  fetchRules();
                                                                                                              } catch(e) {
                                                                                                                  alert('שגיאה בעדכון השליפה');
                                                                                                              }
                                                                                                          }}
                                                                                                      >
                                                                                                          שמור שינויים ל-DB
                                                                                                      </Button>
                                                                                                  </Group>
                                                                                              </Tabs.Panel>

                                                                                              <Tabs.Panel value="qsl" pt="xs">
                                                                                                  <Text size="xs" c="dimmed" mb="xs" ta="center">מבנה ה-JSON כפי שיישלח ב-API לאלסטיק (כולל פילטר הזמן)</Text>
                                                                                                  <Code block color="dark.8" c="teal.3" style={{ backgroundColor: '#1a1b26', direction: 'ltr', textAlign: 'left', fontSize: '12px', maxHeight: '220px', overflowY: 'auto', whiteSpace: 'pre-wrap', padding: '12px', border: '1px solid #2f334d' }}>
                                                                                                      {JSON.stringify({
                                                                                                          query: {
                                                                                                              bool: {
                                                                                                                  must: [
                                                                                                                      { query_string: { query: currentEditedQuery } }
                                                                                                                  ],
                                                                                                                  filter: [
                                                                                                                      { range: { "@timestamp": { gte: `now-${currentEditedTime}` } } }
                                                                                                                  ]
                                                                                                              }
                                                                                                          },
                                                                                                          size: 10
                                                                                                      }, null, 2)}
                                                                                                  </Code>
                                                                                              </Tabs.Panel>
                                                                                          </Tabs>
                                                                                      </Paper>
                                                                                  </Collapse>
                                                                              </Card>
                                                                          );
                                                                      })}
                                                                  </SimpleGrid>
                                                              )}
                                                          </Stack>

                                                          {/* טופס יצירת שליפה מקצועי כולל מנגנון מיפוי רכיב יעד */}
                                                          {!showNewQueryForm ? (
                                                              <Button mt="md" variant="light" color="blue" leftSection={<IconPlus size={16} />} onClick={() => setShowNewQueryForm(true)}>
                                                                  הוסף שליפת לוגים חדשה (חוק ניטור)
                                                              </Button>
                                                          ) : (
                                                          <Paper withBorder p="lg" radius="md" bg="white" style={{ borderTop: '4px solid #20c997', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', position: 'relative' }}>
                                                              <ActionIcon color="gray" variant="subtle" style={{ position: 'absolute', top: 10, left: 10 }} onClick={() => setShowNewQueryForm(false)}>
                                                                  <IconX size={16} />
                                                              </ActionIcon>
                                                              <Text fw={900} size="sm" c="teal.9" mb="md">הגדרת שליפת לוגים חדשה (KQL) ורכיב יעד במערכת</Text>
                                                              
                                                              <Grid align="flex-end" spacing="md">
                                                                  <Grid.Col span={{ base: 12, sm: 8 }}>
                                                                      <Textarea 
                                                                          label="שאילתת לוגים (Discover KQL Syntax)" 
                                                                          placeholder='למשל: level: "ERROR" AND application_name: "auth-server"'
                                                                          value={elasticForm.query}
                                                                          onChange={(e) => setElasticForm({...elasticForm, query: e.currentTarget.value})}
                                                                          dir="ltr"
                                                                          minRows={2}
                                                                          styles={{ input: { fontFamily: 'monospace', fontSize: '13px' } }}
                                                                          required
                                                                      />
                                                                  </Grid.Col>
                                                                  <Grid.Col span={{ base: 12, sm: 4 }}>
                                                                      <TextInput 
                                                                          label="טווח זמן חופשי ועצמאי (Lookback)" 
                                                                          placeholder="למשל: 30s, 15m, 1h, 14d"
                                                                          value={elasticForm.timeRange}
                                                                          onChange={(e) => setElasticForm({...elasticForm, timeRange: e.currentTarget.value})}
                                                                          required
                                                                          dir="ltr"
                                                                      />
                                                                  </Grid.Col>

                                                                  {/* רכיב מיפוי רכיב יעד (מסתנכרן ישירות מול ה-CPR) */}
                                                                  <Grid.Col span={12}>
                                                                      <Paper withBorder p="sm" bg="gray.0" radius="sm">
                                                                          <Text fw={800} size="xs" mb="xs">מיפוי רכיב יעד (לסריקה וצימוד ויזואלי בסורק הארכיטקטורה):</Text>
                                                                          <Radio.Group 
                                                                              value={elasticForm.mappingType} 
                                                                              onChange={(val) => setElasticForm({...elasticForm, mappingType: val})}
                                                                          >
                                                                              <Group gap="xl">
                                                                                  <Radio value="node" label="בחר רכיב מהמאגר (או הקלד חדש)" />
                                                                                  <Radio value="template" label="שיוך דינמי (Template)" />
                                                                              </Group>
                                                                          </Radio.Group>

                                                                          {elasticForm.mappingType === 'node' ? (
                                                                              <Select 
                                                                                  mt="xs"
                                                                                  placeholder="חפש רכיב במאגר (CPR) או הקלד רכיב חדש..."
                                                                                  data={elasticNodeOptions}
                                                                                  value={elasticForm.node}
                                                                                  onChange={(val) => {
                                                                                      setElasticForm({...elasticForm, node: val});
                                                                                      if (val && !elasticNodeOptions.some(o => o.value === val)) {
                                                                                          setElasticNodeOptions(prev => [...prev, { value: val, label: val }]);
                                                                                      }
                                                                                  }}
                                                                                  searchable
                                                                                  clearable
                                                                                  required={elasticForm.mappingType === 'node'}
                                                                                  styles={{ input: { direction: 'ltr', textAlign: 'right' } }}
                                                                              />
                                                                          ) : (
                                                                              <TextInput 
                                                                                  mt="xs"
                                                                                  placeholder="למשל: {{$labels.application_name}}"
                                                                                  value={elasticForm.mappingTemplate}
                                                                                  onChange={(e) => setElasticForm({...elasticForm, mappingTemplate: e.currentTarget.value})}
                                                                                  required={elasticForm.mappingType === 'template'}
                                                                                  dir="ltr"
                                                                              />
                                                                          )}
                                                                      </Paper>
                                                                  </Grid.Col>

                                                                  <Grid.Col span={{ base: 12, sm: 3 }}>
                                                                      <TextInput 
                                                                          label="שם באנגלית (חובה)" 
                                                                          placeholder="e.g. sys_errors"
                                                                          value={elasticForm.ruleName || ''}
                                                                          onChange={(e) => setElasticForm({...elasticForm, ruleName: e.currentTarget.value.replace(/[^a-zA-Z0-9_]/g, '')})}
                                                                          required
                                                                      />
                                                                  </Grid.Col>
                                                                  <Grid.Col span={{ base: 12, sm: 3 }}>
                                                                      <TextInput 
                                                                          label="מטרת השליפה (חובה)" 
                                                                          placeholder="תיאור הניטור..."
                                                                          value={elasticForm.reason}
                                                                          onChange={(e) => setElasticForm({...elasticForm, reason: e.currentTarget.value})}
                                                                          required
                                                                      />
                                                                  </Grid.Col>
                                                                  <Grid.Col span={{ base: 12, sm: 3 }}>
                                                                      <TextInput 
                                                                          label='מקת"ג (אופציונלי)' 
                                                                          placeholder='למשל: 123456'
                                                                          value={elasticForm.maktag}
                                                                          onChange={(e) => setElasticForm({...elasticForm, maktag: e.currentTarget.value})}
                                                                      />
                                                                  </Grid.Col>
                                                                  <Grid.Col span={{ base: 12, sm: 3 }}>
                                                                      <Select 
                                                                          label="זמן אחורה (Lookback)"
                                                                          data={['1m', '5m', '15m', '30m', '1h', '3h', '12h', '24h', '7d', '14d']}
                                                                          value={elasticForm.timeRange || '15m'}
                                                                          onChange={(val) => setElasticForm({...elasticForm, timeRange: val})}
                                                                      />
                                                                  </Grid.Col>
                                                                  
                                                                  <Grid.Col span={12}>
                                                                      <Group justify="flex-end" gap="sm">
                                                                          <Button 
                                                                              color="orange" 
                                                                              variant="light" 
                                                                              disabled={!elasticForm.query}
                                                                              loading={isQueryTesting}
                                                                              onClick={async () => {
                                                                                  setIsQueryTesting(true);
                                                                                  setQueryTestResult(null);
                                                                                  try {
                                                                                      const res = await axios.post(`${API_BASE_URL}/api/elastic-count`, {
                                                                                          env: selectedEnvForMgmt,
                                                                                          index: indexName,
                                                                                          query: elasticForm.query,
                                                                                          timeRange: elasticForm.timeRange || '15m'
                                                                                      });
                                                                                      setQueryTestResult(res.data);
                                                                                  } catch(e) {
                                                                                      alert('שגיאה בבדיקת השאילתה מול שרת האלסטיק');
                                                                                  }
                                                                                  setIsQueryTesting(false);
                                                                              }}
                                                                          >
                                                                              בדוק שליפה בלייב
                                                                          </Button>

                                                                          <Button 
                                                                              color="teal" 
                                                                              disabled={!elasticForm.ruleName || !elasticForm.query || !elasticForm.reason || !queryTestResult || (elasticForm.mappingType === 'node' && !elasticForm.node) || (elasticForm.mappingType === 'template' && !elasticForm.mappingTemplate)}
                                                                              onClick={async () => {
                                                                                  const payload = {
                                                                                      name: elasticForm.ruleName,
                                                                                      purposeRule: elasticForm.reason,
                                                                                      maktag: elasticForm.maktag,
                                                                                      query: elasticForm.query,
                                                                                      tech: 'elastic_log',
                                                                                      tsdb: 'elastic',
                                                                                      team: 'אפליקטיבי',
                                                                                      application: selectedEnvForMgmt,
                                                                                      node: elasticForm.mappingType === 'node' ? elasticForm.node : 'GENERIC',
                                                                                      mappingTemplate: elasticForm.mappingType === 'template' ? elasticForm.mappingTemplate : '',
                                                                                      elasticEnv: selectedEnvForMgmt,
                                                                                      indexName: indexName,
                                                                                      timeRange: elasticForm.timeRange || '15m',
                                                                                      user: username,
                                                                                      reason: elasticForm.reason
                                                                                  };

                                                                                  try {
                                                                                      await axios.post(`${API_BASE_URL}/rules`, payload);
                                                                                      alert('השליפה נוספה ואומתה בהצלחה!');
                                                                                      fetchRules();
                                                                                      // איפוס הטופס לאחר הצלחה
                                                                                      setElasticForm({ ruleName: '', query: '', timeRange: '15m', reason: '', maktag: '', mappingType: 'node', node: '', mappingTemplate: '' });
                                                                                      setQueryTestResult(null);
                                                                                      setShowNewQueryForm(false);
                                                                                  } catch(e) {
                                                                                      alert('שגיאה בשמירת השליחה במערכת');
                                                                                  }
                                                                              }}
                                                                          >
                                                                              שמור שליפה
                                                                          </Button>
                                                                      </Group>
                                                                  </Grid.Col>

                                                                  {queryTestResult && (
                                                                      <Grid.Col span={12}>
                                                                          <Alert color={queryTestResult.status === 'success' ? 'blue' : 'red'} title="תוצאות בדיקת הרצה בזמן אמת">
                                                                              <Text fw={700} size="sm">{queryTestResult.message}</Text>
                                                                              {queryTestResult.count !== undefined && (
                                            <Text size="xs" mt={2} fw={800}>כמות שורות לוג (Hits) שנמצאו בטווח הזמן: <b>{queryTestResult.count} שורות.</b></Text>
                                        )}
                                    </Alert>
                                </Grid.Col>
                            )}
                        </Grid>
                    </Paper>
                )} {/* <--- התווים שצריך להוסיף כאן */}
                </Stack>
            </Tabs.Panel>
                                              );
                                          })}
                                      </Tabs>
                                  );
                              })()}
                          </Stack>
                      </Modal>
                  </Tabs.Panel>
              </Tabs>
            </Paper>

            {/* Modal RabbitMQ */}
            <Modal opened={rabbitModalOpen} onClose={() => { setRabbitModalOpen(false); setRabbitCheckResult(null); setRabbitForm({ vhost: '/', queue: '', reason: ''}); setRabbitSearch(''); setSelectedVhost(null); }} title={<Text fw={900} size="lg">ניהול תורי RabbitMQ: {selectedRabbitTeam?.name}</Text>} size="xl" centered dir="rtl">
                <Stack>
                    <Text size="sm" c="dimmed">הזן את פרטי התור שברצונך לנטר. המערכת תוודא מול Prometheus שהתור קיים לפני שתוסיף אותו לניטור. כל הוספה/עריכה נשמרת בהיסטוריית החוק.</Text>

                    <Paper withBorder p="md" bg="blue.0" style={{ borderColor: '#74c0fc' }}>
                        <Grid align="flex-end">
                            <Grid.Col span={3}>
                                <TextInput label="VHOST" placeholder="/" value={rabbitForm.vhost} onChange={(e) => setRabbitForm({...rabbitForm, vhost: e.currentTarget.value})} required dir="ltr" />
                            </Grid.Col>
                            <Grid.Col span={4}>
                                <TextInput label="שם תור (Queue)" placeholder="למשל: alert_queue" value={rabbitForm.queue} onChange={(e) => setRabbitForm({...rabbitForm, queue: e.currentTarget.value})} required dir="ltr" />
                            </Grid.Col>
                            <Grid.Col span={5}>
                                <TextInput label="סיבת הוספה (תישמר בהיסטוריה)" placeholder="הקמת תור חדש בגרסה X..." value={rabbitForm.reason} onChange={(e) => setRabbitForm({...rabbitForm, reason: e.currentTarget.value})} required />
                            </Grid.Col>
                        </Grid>
                        <Button mt="md" fullWidth color="blue" onClick={handleAddRabbitQueue} loading={isCheckingRabbit} disabled={!rabbitForm.vhost || !rabbitForm.queue || !rabbitForm.reason}>
                            בדוק והוסף תור
                        </Button>
                    </Paper>

                    {rabbitCheckResult && (
                        <Alert icon={rabbitCheckResult.success ? <IconCheck size={16} /> : <IconX size={16} />} title={rabbitCheckResult.success ? 'הצלחה' : 'שגיאת אימות'} color={rabbitCheckResult.success ? 'teal' : 'red'}>
                            {rabbitCheckResult.message}
                        </Alert>
                    )}

                    <Divider my="sm" label="תורים מנוטרים קיימים לצוות זה" labelPosition="center" />

                    <Paper withBorder p="md" radius="md" bg="gray.0" mb="sm">
                        <Grid align="flex-end">
                            <Grid.Col span={{ base: 12, sm: 5 }}>
                                <TextInput label="חיפוש לפי שם תור" placeholder="הקלד שם תור לחיפוש..." leftSection={<IconSearch size={16} />} value={rabbitSearch} onChange={(e) => setRabbitSearch(e.currentTarget.value)} />
                            </Grid.Col>
                            <Grid.Col span={{ base: 12, sm: 4 }}>
                                <Select label="סינון לפי VHOST" placeholder="כל ה-VHOSTs..." data={Array.from(new Set(rules.filter(r => r.tech === 'rabbit' && r.application === selectedRabbitTeam?.id).map(r => extractParam(r.query, 'vhost') || '/')))} value={selectedVhost} onChange={setSelectedVhost} clearable searchable />
                            </Grid.Col>
                            <Grid.Col span={{ base: 12, sm: 3 }}>
                                <Button fullWidth variant="light" leftSection={<IconRestore size={14}/>} onClick={() => fetchLiveValues(selectedRabbitTeam?.id)} loading={isLoadingLive}>רענן נתונים</Button>
                            </Grid.Col>
                        </Grid>
                    </Paper>

                    <ScrollArea h={450} offsetScrollbars>
                        <Stack gap="sm">
                            {(() => {
                                const teamRules = rules.filter(r => r.tech === 'rabbit' && r.application === selectedRabbitTeam?.id);
                                const filteredRabbitRules = teamRules.filter(r => {
                                    const queueName = extractParam(r.query, 'queue') || r.name;
                                    const vhost = extractParam(r.query, 'vhost') || '/';
                                    return queueName.toLowerCase().includes(rabbitSearch.toLowerCase()) && (!selectedVhost || vhost === selectedVhost);
                                });

                                if (teamRules.length === 0) return <Paper withBorder p="xl" radius="md" bg="gray.0"><Stack align="center" gap="xs"><IconSearch size={32} color="gray"/><Text c="dimmed" ta="center" size="sm">אין תורים מנוטרים כרגע עבור צוות זה.</Text></Stack></Paper>;
                                if (filteredRabbitRules.length === 0) return <Center py="xl"><Stack align="center" gap="xs"><IconFilter size={40} color="gray" /><Text c="dimmed" fw={700}>לא נמצאו תורים העונים לסינון הנוכחי</Text></Stack></Center>;

                                return filteredRabbitRules.map((r, i) => {
                                    const isEditing = editingRabbitThresholds?.id === r.id;
                                    const majorVal = extractRabbitThreshold(r.queryMajor) || r.majorThreshold || '1000';
                                    const criticalVal = extractRabbitThreshold(r.queryCritical) || r.criticalThreshold || '5000';
                                    const vhost = extractParam(r.query, 'vhost') || '/';
                                    const queueName = extractParam(r.query, 'queue') || r.name.replace(`rabbit_${selectedRabbitTeam?.id}_`, '');
                                    const currentValue = rabbitLiveValues[r.id] || '0';

                                    let latestNodesNames = [];
                                    if (syncHistory?.nodes_history?.length > 0) {
                                        const lastSync = syncHistory.nodes_history[syncHistory.nodes_history.length - 1];
                                        if (Array.isArray(lastSync.nodes)) {
                                            latestNodesNames = lastSync.nodes.map(n => typeof n === 'string' ? n.toLowerCase() : (n.name || '').toLowerCase());
                                        }
                                    }
                                    const expectedNodeName = `${vhost}-${queueName}`.toLowerCase();
                                    const queueExists = latestNodesNames.includes(expectedNodeName);

                                    return (
                                        <Paper key={i} withBorder p="md" radius="md" shadow="sm" bg={!isNaN(parseFloat(currentValue)) && parseFloat(currentValue) >= parseFloat(criticalVal) ? 'red.0' : 'white'}>
                                            <Group justify="space-between" wrap="nowrap" align="center">
                                                <Group gap="sm" style={{ flexGrow: 1 }}>
                                                    <Badge size="md" variant="filled" color="dark" styles={{ root: { textTransform: 'none', minWidth: '40px' } }}>{vhost}</Badge>
                                                    <Tooltip label={queueExists ? "תור זה קיים במאגר הרכיבים (CPR/שרטוט)" : "תור זה אינו קיים במאגר הרכיבים"}>
                                                        <Text fw={900} size="lg" c={queueExists ? "teal.6" : "red.6"}>
                                                            {queueName} {queueExists ? <IconCheck size={16} style={{verticalAlign: 'middle', marginLeft: '4px'}}/> : <IconX size={16} style={{verticalAlign: 'middle', marginLeft: '4px'}}/>}
                                                        </Text>
                                                    </Tooltip>
                                                </Group>

                                                <Stack gap={0} align="center" mx="lg" style={{ minWidth: '80px' }}>
                                                    <Text size="10px" fw={800} c="dimmed">ערך נוכחי</Text>
                                                    <Text size="xl" fw={900} c={!isNaN(parseFloat(currentValue)) && parseFloat(currentValue) > 0 ? 'blue.6' : 'dark.4'}>
                                                        {!isNaN(parseFloat(currentValue)) ? parseFloat(currentValue).toLocaleString() : currentValue}
                                                    </Text>
                                                </Stack>

                                                <Group gap="xs">
                                                    {isEditing ? (
                                                        <Group gap="xs" align="center">
                                                            <NumberInput label="MAJOR" size="xs" w={70} value={editingRabbitThresholds.major} onChange={(v) => setEditingRabbitThresholds({...editingRabbitThresholds, major: v})} hideControls />
                                                            <NumberInput label="CRITICAL" size="xs" w={70} value={editingRabbitThresholds.critical} onChange={(v) => setEditingRabbitThresholds({...editingRabbitThresholds, critical: v})} hideControls />
                                                            <ActionIcon color="teal" variant="filled" size="md" mt={18} onClick={() => handleSaveRabbitThresholds(r.id)}><IconCheck size={16}/></ActionIcon>
                                                            <ActionIcon color="gray" variant="subtle" size="md" mt={18} onClick={() => setEditingRabbitThresholds(null)}><IconX size={16}/></ActionIcon>
                                                        </Group>
                                                    ) : (
                                                        <Group gap={6}>
                                                            <Tooltip label="ספי התראה">
                                                                <Group gap={6} bg="gray.1" px="sm" py={4} style={{ borderRadius: '6px', border: '1px solid #dee2e6' }}>
                                                                    <Text size="xs" fw={800} c="yellow.9">{majorVal}</Text>
                                                                    <Divider orientation="vertical" />
                                                                    <Text size="xs" fw={800} c="red.9">{criticalVal}</Text>
                                                                </Group>
                                                            </Tooltip>
                                                            
                                                            <ActionIcon color="blue" variant="subtle" onClick={() => setEditingRabbitThresholds({ id: r.id, major: parseInt(majorVal), critical: parseInt(criticalVal) })}>
                                                                <IconEdit size={18} />
                                                            </ActionIcon>
                                                            <ActionIcon color="red" variant="subtle" onClick={async () => {
                                                                if (window.confirm(`למחוק ניטור לתור ${queueName}?`)) {
                                                                    await axios.delete(`${API_BASE_URL}/rules/${r.id}`);
                                                                    fetchRules();
                                                                }
                                                            }}>
                                                                <IconTrash size={18} />
                                                            </ActionIcon>
                                                            <Tooltip label="היסטוריית שינויים (Timeline)">
                                                                <ActionIcon color="indigo" variant="subtle" onClick={() => { setSelectedRuleForHistory(r); setHistoryOpened(true); }}>
                                                                    <IconHistory size={18} />
                                                                </ActionIcon>
                                                            </Tooltip>
                                                        </Group>
                                                    )}
                                                </Group>
                                            </Group>
                                        </Paper>
                                    );
                                });
                            })()}
                        </Stack>
                    </ScrollArea>
                </Stack>
            </Modal>

            
          </Container>
        )}

        {/* טאב 4: אוטומציות, חוטר וקיימות */}
        {activeTab === 'automations' && (
           <Container fluid px="md" pb={120}>
             <Paper shadow="xl" p="xl" radius="md" withBorder dir="rtl">
                <Tabs defaultValue="auto" color="indigo" radius="md">
                    <Tabs.List mb="xl">
                        <Tabs.Tab value="auto" leftSection={<IconCode size={18} />}><Text size="lg" fw={700}>אוטומציות מתקדמות</Text></Tabs.Tab>
                        <Tabs.Tab value="hermetic" leftSection={<IconDatabase size={18} />} c="cyan.7"><Text size="lg" fw={700}>הרמטיות המידע (חוטר)</Text></Tabs.Tab>
                        <Tabs.Tab value="existence" leftSection={<IconSearch2 size={18} />} c="pink.7"><Text size="lg" fw={700}>בדיקות קיימות (Check in...)</Text></Tabs.Tab>
                    </Tabs.List>

                    <Tabs.Panel value="auto">
                        <Grid>
                           <Grid.Col span={4}>
                               <Paper withBorder p="md" bg="gray.0" style={{ height: '100%', minHeight: '60vh' }}>
                                   <Text fw={900} mb="md">תיקיות אוטומציה</Text>
                                   <Stack gap="sm">
                                       {folders.map(f => (
                                           <Button 
                                               component="div" 
                                               style={{ cursor: 'pointer' }} 
                                               key={f.id} 
                                               variant={selectedFolderId === f.id ? "filled" : "light"} 
                                               color="indigo" 
                                               fullWidth 
                                               justify="space-between" 
                                               leftSection={<IconFolder size={18} />}
                                               rightSection={<ActionIcon component="button" color="red" variant="transparent" onClick={(e) => { e.stopPropagation(); handleDeleteFolder(f.id); }}><IconTrash size={14} /></ActionIcon>}
                                               onClick={() => setSelectedFolderId(f.id)}
                                           >
                                               <Stack gap={0} align="flex-start">
                                                  <Text>{f.name}</Text>
                                                  <Text size="10px" c={selectedFolderId === f.id ? "indigo.2" : "dimmed"}>עודכן ע"י {f.updated_by || f.created_by || 'לא ידוע'} ב-{f.updated_at || f.created_at || 'לא ידוע'}</Text>
                                               </Stack>
                                           </Button>
                                       ))}
                                   </Stack>
                                   <Group mt="xl">
                                        <TextInput placeholder="שם תיקייה חדשה..." value={newFolderName} onChange={(e) => setNewFolderName(e.currentTarget.value)} style={{ flexGrow: 1 }} size="xs" />
                                        <Button size="xs" onClick={handleCreateFolder} disabled={!newFolderName}><IconPlus size={14}/></Button>
                                    </Group>
                               </Paper>
                           </Grid.Col>
                           <Grid.Col span={8}>
                               <Paper withBorder p="md" bg="white" style={{ height: '100%', minHeight: '60vh' }}>
                                   {selectedFolderId ? (
                                       <Stack>
                                           <Group justify="space-between" mb="md">
                                               <Text fw={900} size="xl">אוטומציות בתיקייה</Text>
                                               <Button leftSection={<IconPlus size={16}/>} color="indigo" onClick={() => setAutoModalOpen(true)}>הוסף אוטומציה</Button>
                                           </Group>
                                           
                                           {automations.filter(a => a.folder_id === selectedFolderId).length === 0 ? (
                                                <Text c="dimmed" ta="center" mt="xl">אין אוטומציות בתיקייה זו. לחץ להוספה.</Text>
                                           ) : (
                                                automations.filter(a => a.folder_id === selectedFolderId).map(auto => (
                                                    <Paper key={auto.id} withBorder p="md" shadow="sm">
                                                        <Group justify="space-between" align="flex-start">
                                                            <Stack gap={4}>
                                                                <Text fw={700} size="lg">{auto.name}</Text>
                                                                <Text size="xs" c="dimmed" dir="ltr" ta="left">Trigger: {auto.metric_query} {auto.operator} {auto.threshold}</Text>
                                                                <Text size="10px" c="dimmed" mt={4}>עודכן ע"י {auto.updated_by || auto.created_by || 'לא ידוע'} ב-{auto.updated_at || auto.created_at || 'לא ידוע'}</Text>
                                                            </Stack>
                                                            <Group>
                                                                <Badge color="teal" size="lg" variant="light" leftSection={<IconPlayerPlay size={14}/>}>רצה {auto.run_count} פעמים</Badge>
                                                                <Tooltip label="היסטוריית ריצות">
                                                                    <ActionIcon color="blue" variant="light" size="lg" onClick={() => setAutoHistoryModal({open: true, auto})}>
                                                                        <IconHistory size={18}/>
                                                                    </ActionIcon>
                                                                </Tooltip>
                                                                <Tooltip label="ערוך אוטומציה">
                                                                    <ActionIcon color="cyan" variant="light" size="lg" onClick={() => {
                                                                        setAutoForm({ 
                                                                            id: auto.id, 
                                                                            name: auto.name, 
                                                                            metric_query: auto.metric_query, 
                                                                            operator: auto.operator || '>', 
                                                                            threshold: auto.threshold || 0, 
                                                                            python_code: auto.python_code, 
                                                                            action_type: auto.action_type || 'script' 
                                                                        });
                                                                        setAutoModalOpen(true);
                                                                    }}>
                                                                        <IconEdit size={18}/>
                                                                    </ActionIcon>
                                                                </Tooltip>
                                                                <ActionIcon color="red" variant="light" size="lg" onClick={() => handleDeleteAutomation(auto.id)}>
                                                                    <IconTrash size={18}/>
                                                                </ActionIcon>
                                                            </Group>
                                                        </Group>
                                                    </Paper>
                                                ))
                                           )}
                                       </Stack>
                                   ) : (
                                       <Center h="100%"><Text c="dimmed" size="lg">בחר תיקייה מצד ימין כדי לראות אוטומציות</Text></Center>
                                   )}
                               </Paper>
                           </Grid.Col>
                        </Grid>
                    </Tabs.Panel>

                    <Tabs.Panel value="hermetic">
                        <Grid>
                            <Grid.Col span={3}>
                                <Paper withBorder p="md" bg="cyan.0" style={{ height: '100%', minHeight: '60vh', borderColor: '#99e9f2' }}>
                                    <Text fw={900} mb="md" c="cyan.9">מערכות חוטר (Data Flow)</Text>
                                    <Stack gap="sm">
                                        {choterGroups.map(g => {
                                            const bgCol = g.last_run_status === 'success' ? '#ebfbee' : g.last_run_status === 'error' ? '#fff0f6' : '#e3fafc';
                                            const bordCol = g.last_run_status === 'success' ? '#40c057' : g.last_run_status === 'error' ? '#fa5252' : '#15aabf';
                                            
                                            return (
                                            <Paper 
                                                key={g.id} 
                                                withBorder 
                                                p="sm" 
                                                radius="md"
                                                style={{ 
                                                    cursor: 'pointer', 
                                                    backgroundColor: selectedChoterGroup === g.id ? bordCol : bgCol, 
                                                    borderColor: bordCol,
                                                    color: selectedChoterGroup === g.id ? 'white' : 'black',
                                                    transition: 'all 0.2s',
                                                    opacity: g.is_paused ? 0.6 : 1
                                                }}
                                                onClick={() => setSelectedChoterGroup(g.id)}
                                            >
                                                <Group justify="space-between" align="flex-start" wrap="nowrap">
                                                    <Stack gap={2} style={{ overflow: 'hidden' }}>
                                                        <Text fw={900} truncate>{g.name}</Text>
                                                        <Text size="10px" fw={600} truncate>{g.last_run_time ? `ריצה אחרונה: ${g.last_run_time}` : 'טרם רץ'}</Text>
                                                        <Text size="10px" truncate>{getNextRunText(g)}</Text>
                                                        <Text size="8px" c={selectedChoterGroup === g.id ? "cyan.1" : "dimmed"} mt={2}>
                                                            נוצר/נערך ע"י {g.updated_by || g.created_by || 'לא ידוע'}
                                                        </Text>
                                                    </Stack>
                                                    <Stack gap={4} align="center">
                                                        <ActionIcon size="sm" variant="transparent" color={selectedChoterGroup === g.id ? 'white' : 'red'} onClick={(e) => { e.stopPropagation(); handleDeleteChoterGroup(g.id); }}><IconTrash size={14}/></ActionIcon>
                                                        <Tooltip label={g.is_paused ? "הפעל מחדש ריצה אוטומטית" : "השהה ריצה אוטומטית"}>
                                                            <ActionIcon size="sm" variant="transparent" color={selectedChoterGroup === g.id ? 'white' : 'dark'} onClick={(e) => { e.stopPropagation(); handleTogglePauseChoter(g.id); }}>
                                                                {g.is_paused ? <IconPlayerPlay size={14}/> : <IconPlayerPause size={14}/>}
                                                            </ActionIcon>
                                                        </Tooltip>
                                                    </Stack>
                                                </Group>
                                            </Paper>
                                        )})}
                                    </Stack>
                                    <Group mt="xl">
                                        <TextInput placeholder="שם חוטר חדש..." value={newChoterGroupName} onChange={(e) => setNewChoterGroupName(e.currentTarget.value)} style={{ flexGrow: 1 }} size="xs" />
                                        <Button size="xs" color="cyan" onClick={handleCreateChoterGroup} disabled={!newChoterGroupName}><IconPlus size={14}/></Button>
                                    </Group>
                                </Paper>
                            </Grid.Col>
                            
                            <Grid.Col span={9}>
                                <Paper withBorder p="md" bg="white" style={{ height: '100%', minHeight: '60vh', display: 'flex', flexDirection: 'column' }}>
                                    {selectedChoterGroup && currentGroup ? (
                                        <Stack h="100%" justify="space-between">
                                            <div>
                                                <Group justify="space-between" mb="sm" align="flex-start">
                                                    <Stack gap={4}>
                                                       <Text fw={900} size="xl">תחנות עבודה: {currentGroup.name}</Text>
                                                       {currentGroup.last_run_time && (
                                                          <Badge color={currentGroup.last_run_status === 'success' ? 'green' : 'red'} size="lg" variant="light">
                                                              {currentGroup.last_run_status === 'success' ? `רץ בהצלחה (${currentGroup.last_run_time})` : `נכשל בריצה אחרונה (${currentGroup.last_run_time})`}
                                                          </Badge>
                                                       )}
                                                    </Stack>

                                                    <Group>
                                                        <Button variant="light" color="cyan" leftSection={<IconSettings size={16}/>} onClick={() => handleOpenSettings(currentGroup)}>הגדרות וטריגר</Button>
                                                        <Button variant="light" color="blue" leftSection={<IconHistory size={16}/>} onClick={() => { setChoterHistoryDateFilter('all'); setChoterHistoryModal({open: true, group: currentGroup}); }}>היסטוריית ריצות</Button>
                                                        <Button color="cyan" leftSection={<IconPlus size={16}/>} onClick={handleOpenAddStation}>הוסף תחנה למסלול</Button>
                                                        <Button color="orange" leftSection={<IconPlayerPlay size={16}/>} onClick={handleRunChoterGroup} loading={isRunningGroup}>הרץ בדיקה מלאה עכשיו</Button>
                                                    </Group>
                                                </Group>

                                                <Paper bg="dark.8" p="xl" radius="md" style={{ border: currentGroup.last_run_status === 'success' ? '2px solid #40c057' : '1px solid #495057' }}>
                                                    {groupStations.length === 0 ? (
                                                        <Center h="100%"><Text c="dimmed">אין תחנות בחוטר. הוסף תחנה כדי לייצר את מפת זרימת הנתונים.</Text></Center>
                                                    ) : (
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', flexWrap: 'nowrap', overflowX: 'auto', padding: '20px 0', marginTop: '20px' }} dir="rtl">
                                                            {groupStations.map((station, idx) => {
                                                                cumulativeDelay += (station.delay_seconds || 0);
                                                                const isActive = activeStationId === station.id || activeStationName === station.name;
                                                                
                                                                return (
                                                                <Fragment key={station.id}>
                                                                    <Stack align="center" gap="xs" style={{ minWidth: '150px', position: 'relative' }}>
                                                                        
                                                                        {isActive && (
                                                                            <div style={{ position: 'absolute', top: -55, zIndex: 20 }}>
                                                                                <IconRadar size={32} color="#339af0" style={{ animation: 'activePulse 1s infinite', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.9)' }} />
                                                                            </div>
                                                                        )}

                                                                        <Group gap={4}>
                                                                            <Badge color="cyan" size="sm" variant="filled" leftSection={<IconClock size={12}/>}>
                                                                                המתנה {station.delay_seconds || 0}s
                                                                            </Badge>
                                                                            <Tooltip label="עריכה מהירה לזמן המתנה">
                                                                                <ActionIcon size="xs" variant="light" color="cyan" onClick={() => setQuickDelayModal({ open: true, station: station, delay: station.delay_seconds || 0 })}>
                                                                                    <IconEdit size={12} />
                                                                                </ActionIcon>
                                                                            </Tooltip>
                                                                        </Group>
                                                                        <Text size="xs" c="cyan.2" fw={700} mb="-xs">סה"כ מצטבר: T+{cumulativeDelay}s</Text>

                                                                        <Tooltip label={`נמצאו רשומות: ${station.last_value || 0}`}>
                                                                            <div style={{
                                                                                width: 80, height: 80, borderRadius: '50%',
                                                                                border: `6px solid ${isActive ? '#339af0' : (station.last_status === 'success' ? '#40c057' : station.last_status === 'error' ? '#fa5252' : '#dee2e6')}`,
                                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                                backgroundColor: '#2C2E33',
                                                                                boxShadow: isActive ? '0 0 20px rgba(51, 154, 240, 0.8)' : '0 4px 15px rgba(0,0,0,0.5)',
                                                                                position: 'relative',
                                                                                zIndex: isActive ? 10 : 2,
                                                                                animation: isActive ? 'activePulse 1.5s infinite' : 'none',
                                                                                transition: 'all 0.3s'
                                                                            }}>
                                                                                {station.station_role === 'source' ? <IconLogin size={32} color={isActive ? '#339af0' : (station.last_status === 'success' ? '#40c057' : '#ced4da')} /> : 
                                                                                 station.station_role === 'destination' ? <IconLogout size={32} color={isActive ? '#339af0' : (station.last_status === 'success' ? '#40c057' : '#ced4da')} /> : 
                                                                                 <IconCheck size={32} color={isActive ? '#339af0' : (station.last_status === 'success' ? '#40c057' : '#ced4da')} />}
                                                                            </div>
                                                                        </Tooltip>
                                                                        <Group gap={4} style={{ position: 'relative', justifyContent: 'center' }}>
                                                                           <Text size="sm" fw={800} c="white" ta="center" style={{ wordWrap: 'break-word', maxWidth: '80px' }}>
                                                                               {station.order}. {station.name}
                                                                           </Text>
                                                                           <ActionIcon size="xs" color="blue" variant="transparent" onClick={() => handleOpenEditStation(station)}><IconEdit size={14}/></ActionIcon>
                                                                           <ActionIcon size="xs" color="red" variant="transparent" onClick={() => handleDeleteChoterStation(station.id)}><IconTrash size={14}/></ActionIcon>
                                                                        </Group>
                                                                        <Badge size="xs" color={station.station_role === 'source' ? 'blue' : station.station_role === 'destination' ? 'grape' : 'gray'}>
                                                                            {station.station_role === 'source' ? 'תחנת מקור' : station.station_role === 'destination' ? 'תחנת יעד' : 'תחנת מעבר'}
                                                                        </Badge>
                                                                        <Text size="8px" c="gray.6">נערך: {station.updated_by || station.created_by || 'לא ידוע'}</Text>
                                                                    </Stack>
                                                                    
                                                                    {idx < groupStations.length - 1 && (
                                                                        <div style={{ height: 8, flexGrow: 1, minWidth: 80, backgroundColor: (station.last_status === 'success' && groupStations[idx+1].last_status === 'success') ? '#40c057' : '#495057', marginTop: '-75px', zIndex: 1, transition: 'background-color 0.3s' }} />
                                                                    )}
                                                                </Fragment>
                                                            )})}
                                                        </div>
                                                    )}
                                                </Paper>
                                            </div>

                                            <Paper bg="black" p="sm" mt="md" radius="md" style={{ border: '1px solid #333' }}>
                                                <Group justify="space-between" mb="xs">
                                                    <Group gap="xs">
                                                        <IconTerminal2 color="cyan" size={18} />
                                                        <Text fw={700} c="cyan" size="sm">Live Execution Logs (from Elastic)</Text>
                                                    </Group>
                                                    <Button size="compact-xs" color="gray" variant="subtle" onClick={() => fetchElasticLogs(selectedChoterGroup)}>רענן לוגים</Button>
                                                </Group>
                                                <ScrollArea h={150} viewportRef={logScrollRef}>
                                                    {liveLogs.length === 0 ? (
                                                        <Text c="dimmed" size="xs" style={{ fontFamily: 'monospace' }}>No logs found in Elastic for this group.</Text>
                                                    ) : (
                                                        <Stack gap={2}>
                                                            {liveLogs.map((log, i) => (
                                                                <Text key={i} c={(log.includes('Error') || log.includes('error') || log.includes('Failed')) ? 'red.4' : 'green.4'} size="xs" style={{ fontFamily: 'monospace', direction: 'ltr', textAlign: 'left' }}>
                                                                    {">"} {log}
                                                                </Text>
                                                            ))}
                                                        </Stack>
                                                    )}
                                                </ScrollArea>
                                            </Paper>
                                        </Stack>
                                    ) : (
                                        <Center h="100%"><Text c="dimmed" size="lg">בחר קוביית חוטר מצד ימין לבניית זרימת המידע</Text></Center>
                                    )}
                                </Paper>
                            </Grid.Col>
                        </Grid>
                    </Tabs.Panel>

                    <Tabs.Panel value="existence">
                        <Paper bg="pink.0" p="md" withBorder style={{ minHeight: '60vh', borderColor: '#fcc2d7' }}>
                            <Group justify="space-between" mb="xl">
                                <Text fw={900} size="xl" c="pink.9">מערך בדיקות קיימות (Existence Checks)</Text>
                                {currentRole === 'admin' && (
                                    <Button color="pink" leftSection={<IconPlus size={16} />} onClick={() => handleOpenExistenceModal()}>
                                        צור קוביית בדיקה חדשה
                                    </Button>
                                )}
                            </Group>

                            {existenceCubes.length === 0 ? (
                                <Center h="200px"><Text c="dimmed" size="lg">לא קיימות קוביות בדיקה. (אדמין יכול ליצור קוביות חדשות)</Text></Center>
                            ) : (
                                <SimpleGrid cols={3} spacing="lg">
                                    {existenceCubes.map(cube => {
                                        const cState = existenceStates[cube.id] || {};
                                        const borderColor = cState.status === 'success' ? '#40c057' : cState.status === 'error' ? '#fa5252' : '#dee2e6';
                                        const bgColor = cState.status === 'success' ? '#ebfbee' : cState.status === 'error' ? '#fff0f6' : 'white';
                                        
                                        return (
                                        <Card key={cube.id} shadow="sm" p="lg" radius="md" style={{ border: `2px solid ${borderColor}`, backgroundColor: bgColor, transition: 'all 0.3s' }}>
                                            <Group justify="space-between" align="flex-start" mb="md">
                                                <Group gap="xs">
                                                    <IconSearch2 size={24} color={cState.status === 'success' ? '#40c057' : cState.status === 'error' ? '#fa5252' : '#f06595'} />
                                                    <Text fw={900} size="lg">{cube.name}</Text>
                                                </Group>
                                                {currentRole === 'admin' && (
                                                    <Group gap={4}>
                                                        <ActionIcon variant="subtle" color="blue" onClick={() => handleOpenExistenceModal(cube)}><IconEdit size={16} /></ActionIcon>
                                                        <ActionIcon variant="subtle" color="red" onClick={() => handleDeleteExistenceCube(cube.id)}><IconTrash size={16} /></ActionIcon>
                                                    </Group>
                                                )}
                                            </Group>
                                            
                                            <Text size="sm" c="dimmed" mb="xs" style={{ minHeight: '40px' }}>{cube.description || 'ללא תיאור'}</Text>
                                            <Text size="10px" c="dimmed" mb="lg">נוצר/עודכן ע"י {cube.updated_by || cube.created_by || 'לא ידוע'} ב-{cube.updated_at || cube.created_at || ''}</Text>

                                            <Group align="flex-end" mb="xs">
                                            <TextInput 
                                                style={{ flexGrow: 1 }}
                                                placeholder="הזן מזהה לחיפוש (input_id)..." 
                                                value={cState.input} 
                                                onChange={(e) => {
                                                    const val = e.currentTarget.value;
                                                    setExistenceStates(prev => ({ 
                                                        ...prev, 
                                                        [cube.id]: { ...prev[cube.id], input: val } 
                                                    }));
                                                }}
                                            />
                                                <Button 
                                                    color={cState.status === 'success' ? 'green' : cState.status === 'error' ? 'red' : 'pink'}
                                                    loading={cState.loading}
                                                    onClick={() => handleRunExistenceCheck(cube.id)}
                                                    disabled={!cState.input}
                                                >
                                                    בדוק
                                                </Button>
                                            </Group>

                                            <Collapse in={!!cState.log}>
                                                <Paper mt="sm" p="xs" bg="dark.8" radius="sm">
                                                    <Text size="xs" c={cState.status === 'success' ? 'green.4' : 'red.4'} style={{ fontFamily: 'monospace', direction: 'ltr', whiteSpace: 'pre-wrap' }}>
                                                        {cState.log}
                                                    </Text>
                                                </Paper>
                                            </Collapse>
                                        </Card>
                                    )})}
                                </SimpleGrid>
                            )}
                        </Paper>
                    </Tabs.Panel>
                </Tabs>
             </Paper>
           </Container>
        )}

        {/* טאב חדש: האקספורטר האולטימטיבי */}
        {activeTab === 'exporter' && (
           <Container fluid px="md" pb={120}>
             <Paper shadow="xl" p="xl" radius="md" withBorder dir="rtl" bg="yellow.0" style={{ borderColor: '#ffe066' }}>
                <Group justify="space-between" mb="xl">
                    <Stack gap={0}>
                        <Text fw={900} size="xl" c="yellow.9">האקספורטר האולטימטיבי (Custom Metrics Exporter)</Text>
                        <Text size="sm" c="dimmed">בנה קוביות קוד פייתון קצרות המחשבות מידע, וכלל המטריקות ייחשפו החוצה דרך Endpoint ייעודי.</Text>
                    </Stack>
                    {currentRole === 'admin' && (
                        <Button color="yellow" leftSection={<IconPlus size={16} />} onClick={() => handleOpenExporterModal()}>
                            צור קוביית אקספורט חדשה
                        </Button>
                    )}
                </Group>

                {exporterCubes.length === 0 ? (
                    <Center h="200px"><Text c="dimmed" size="lg">אין כרגע קוביות מוגדרות. צור קוביה כדי להתחיל לחשב מטריקות מותאמות אישית.</Text></Center>
                ) : (
                    <SimpleGrid cols={3} spacing="lg">
                        {exporterCubes.map(cube => (
                            <Card key={cube.id} shadow="sm" p="lg" radius="md" style={{ border: `1px solid #fcc419`, backgroundColor: 'white' }}>
                                <Group justify="space-between" align="flex-start" mb="sm">
                                    <Group gap="xs">
                                        <IconCube size={24} color="#f59f00" />
                                        <Text fw={900} size="lg">{cube.name}</Text>
                                    </Group>
                                    {currentRole === 'admin' && (
                                        <Group gap={4}>
                                            <Tooltip label="ערוך אקספורטר">
                                                <ActionIcon variant="subtle" color="blue" onClick={() => handleOpenExporterModal(cube)}><IconEdit size={16} /></ActionIcon>
                                            </Tooltip>
                                            <Tooltip label="היסטוריית ריצות ולוגים">
                                                <ActionIcon variant="subtle" color="indigo" onClick={() => setExporterHistoryModal({open: true, cube: cube})}><IconHistory size={16} /></ActionIcon>
                                            </Tooltip>
                                            <Tooltip label="מחק אקספורטר">
                                                <ActionIcon variant="subtle" color="red" onClick={() => handleDeleteExporterCube(cube.id)}><IconTrash size={16} /></ActionIcon>
                                            </Tooltip>
                                        </Group>
                                    )}
                                </Group>
                                
                                <Text size="sm" mb="xs" style={{ minHeight: '40px' }}>{cube.description || 'ללא תיאור'}</Text>
                                <Text size="10px" c="dimmed" mb="4px">
                                    {cube.last_run_time ? `ריצה אחרונה: ${cube.last_run_time}` : 'טרם רץ'}
                                    {cube.last_run_status === 'success' && <Badge size="xs" color="teal" ml="xs">תקין</Badge>}
                                    {cube.last_run_status === 'error' && <Badge size="xs" color="red" ml="xs">שגיאה</Badge>}
                                </Text>
                                <Text size="10px" fw={700} c="indigo.6" mb="md">{getExporterNextRunText(cube)}</Text>
                                <Text size="10px" c="dimmed" mb="md">נוצר/עודכן ע"י {cube.updated_by || cube.created_by || 'לא ידוע'} ב-{cube.updated_at || cube.created_at || ''}</Text>
                                
                                <Paper bg="dark.8" p="xs" radius="sm">
                                    <Text size="xs" c="green.4" style={{ fontFamily: 'monospace', direction: 'ltr', whiteSpace: 'pre-wrap', maxHeight: '100px', overflowY: 'auto' }}>
                                        {cube.python_code}
                                    </Text>
                                </Paper>
                            </Card>
                        ))}
                    </SimpleGrid>
                )}

                <Center mt="xl" pt="xl" style={{ borderTop: '1px dashed #fcc419' }}>
                    <Button component="a" href={`${API_BASE_URL}/metrics/custom`} target="_blank" color="dark" size="lg" leftSection={<IconChartLine size={20} />}>
                        פתח את חלון ה-Exporter (מייצא מטריקות בזמן אמת)
                    </Button>
                </Center>
             </Paper>
           </Container>
        )}


        {/* טאב העברת משמרת */}
        {activeTab === 'shifts' && (
          <Container fluid px="md" pb={120}>
            <Paper shadow="xl" p="xl" radius="md" withBorder dir="rtl" bg="white">
                <Group justify="space-between" mb="lg">
                    <Title order={2} c="blue.9">יומן משמרות ותקלות</Title>
                    <Group>
                        <TextInput 
                            placeholder="חיפוש חופשי ביום זה..." 
                            leftSection={<IconSearch size={16} />} 
                            value={shiftSearch} 
                            onChange={(e) => setShiftSearch(e.currentTarget.value)}
                            w={200}
                        />
                        {currentRole !== 'viewer' && (
                            <Button color="blue" leftSection={<IconPlus size={16} />} onClick={() => setAddShiftModal({ opened: true, faultId: '', title: '', note: '', soldier: shiftSoldierName })}>
                                הוסף תקלה
                            </Button>
                        )}
                    </Group>
                </Group>

                <Group justify="center" mb="xl">
                    <Button variant="light" size="md" onClick={handleNextDay} rightSection={<IconChevronRight size={16}/>}>יום הבא</Button>
                    <Paper p="sm" px="xl" withBorder radius="md" bg="gray.0" w={350} ta="center" style={{ borderColor: '#339af0' }}>
                        <Text fw={900} size="xl" c="blue.9" mb={4}>{formatShiftDate(currentShiftDate)}</Text>
                        <Text size="sm" c="dimmed" fw={600}>חייל/ת במשמרת: <Text span fw={800} c="teal.7">{shiftSoldierName}</Text></Text>
                    </Paper>
                    <Button variant="light" size="md" onClick={handlePrevDay} leftSection={<IconChevronLeft size={16}/>}>יום קודם</Button>
                    <Button variant="subtle" color="gray" size="md" onClick={handleToday}>היום</Button>
                </Group>

                <Table striped highlightOnHover withTableBorder withColumnBorders verticalSpacing="md">
                    <Table.Thead>
                        <Table.Tr bg="gray.1">
                            <Table.Th w={150}>מזהה תקלה</Table.Th>
                            <Table.Th w={300}>כותרת התקלה</Table.Th>
                            <Table.Th>הערת סגירה / עבודה</Table.Th>
                            {currentRole !== 'viewer' && <Table.Th w={100} ta="center">פעולות</Table.Th>}
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {shiftFaults
                            .filter(s => s.date && s.date.includes(formatShiftDate(currentShiftDate)))
                            .filter(s => !shiftSearch || Object.values(s).some(v => String(v).toLowerCase().includes(shiftSearch.toLowerCase())))
                            .map((shift, idx) => (
                            <Table.Tr key={idx}>
                                <Table.Td fw={700}><Badge color="indigo" variant="light" size="lg">{shift.faultId || 'ללא מזהה'}</Badge></Table.Td>
                                <Table.Td fw={700} size="sm" c="dark.8">{shift.title}</Table.Td>
                                <Table.Td><Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{shift.note}</Text></Table.Td>
                                {currentRole !== 'viewer' && (
                                    <Table.Td ta="center">
                                        <ActionIcon color="red" variant="subtle" onClick={async () => {
                                            if(window.confirm('למחוק שורה זו מהמשמרת?')) {
                                                await axios.delete(`${API_BASE_URL}/api/shifts/${shift.id}`);
                                                setShiftFaults(shiftFaults.filter(x => x.id !== shift.id));
                                            }
                                        }}>
                                            <IconTrash size={16} />
                                        </ActionIcon>
                                    </Table.Td>
                                )}
                            </Table.Tr>
                        ))}
                        {shiftFaults.filter(s => s.date && s.date.includes(formatShiftDate(currentShiftDate))).length === 0 && (
                            <Table.Tr>
                                <Table.Td colSpan={currentRole !== 'viewer' ? 4 : 3} ta="center" py="xl">
                                    <Text c="dimmed" size="lg">אין תקלות מתועדות במשמרת זו ({formatShiftDate(currentShiftDate)}).</Text>
                                </Table.Td>
                            </Table.Tr>
                        )}
                    </Table.Tbody>
                </Table>

                {currentRole !== 'viewer' && (
                    <Modal opened={addShiftModal.opened} onClose={() => setAddShiftModal({...addShiftModal, opened: false})} title={<Text fw={900} size="xl" c="blue.9">הוספת תקלה למשמרת - {formatShiftDate(currentShiftDate)}</Text>} centered dir="rtl" size="lg">
                        <Stack gap="md">
                            <TextInput label="חייל/ת המשמרת" placeholder="למשל: סמל אריאל" value={addShiftModal.soldier} onChange={(e) => setAddShiftModal({...addShiftModal, soldier: e.currentTarget.value})} required />
                            <TextInput label="מזהה תקלה (Jira/ServiceNow)" placeholder="INC-1234" value={addShiftModal.faultId} onChange={(e) => setAddShiftModal({...addShiftModal, faultId: e.currentTarget.value})} required />
                            <TextInput label="כותרת התקלה" placeholder="קריסת שרת..." value={addShiftModal.title} onChange={(e) => setAddShiftModal({...addShiftModal, title: e.currentTarget.value})} required />
                            <Textarea label="הערת סגירה / סטאטוס טיפול" placeholder="מה המצב כרגע? פעולות שבוצעו..." value={addShiftModal.note} onChange={(e) => setAddShiftModal({...addShiftModal, note: e.currentTarget.value})} minRows={5} required />
                            <Button color="blue" size="lg" onClick={async () => {
                                const dateStr = `${formatShiftDate(currentShiftDate)} ${new Date().toLocaleTimeString('he-IL')}`;
                                const payload = { ...addShiftModal, date: dateStr, impact: 'רלוונטי', user: username || 'מערכת' };
                                delete payload.opened;
                                const res = await axios.post(`${API_BASE_URL}/api/shifts`, payload);
                                setShiftFaults([res.data, ...shiftFaults]);
                                setAddShiftModal({ opened: false, faultId: '', title: '', note: '', soldier: '' });
                            }}>שמור תקלה למשמרת</Button>
                        </Stack>
                    </Modal>
                )}
            </Paper>
          </Container>
        )}

        {/* טאב 5: אדמין */}
        {activeTab === 'admin' && currentRole === 'admin' && (
          <Container fluid px="md" pb={120}>
            <Title order={3} mb="md" c="blue.9">ניהול תצוגת טאבים במערכת</Title>
            <Paper withBorder p="md" radius="md" mb="xl" bg="gray.0">
                <Group gap="xl">
                    <Checkbox size="md" label="שאילתות מאוחדות" checked={visibleTabs.queries} onChange={(e) => setVisibleTabs({...visibleTabs, queries: e.currentTarget.checked})} />
                    <Checkbox size="md" label="אוטומציות והרמטיות" checked={visibleTabs.automations} onChange={(e) => setVisibleTabs({...visibleTabs, automations: e.currentTarget.checked})} />
                    <Checkbox size="md" label="האקספורטר האולטימטיבי" checked={visibleTabs.exporter} onChange={(e) => setVisibleTabs({...visibleTabs, exporter: e.currentTarget.checked})} />
                    <Checkbox size="md" label="יומן העברת משמרת" checked={visibleTabs.shifts} onChange={(e) => setVisibleTabs({...visibleTabs, shifts: e.currentTarget.checked})} />
                </Group>
            </Paper>

            {/* מתקין הספריות שהוספנו */}
            <Card withBorder radius="md" p="md" shadow="sm" mb="lg">
                <Group mb="xs">
                    <ThemeIcon size="lg" radius="md" variant="light" color="indigo">
                        <IconTerminal2 size={20} />
                    </ThemeIcon>
                    <Text fw={700} size="lg">מתקין ספריות Python (PIP Installer)</Text>
                </Group>
                
                <Text size="sm" c="dimmed" mb="md">
                    התקן ספריות פייתון חסרות ישירות על השרת המארח. ההתקנה תתבצע בסביבה שבה שרת ה-API רץ כעת.
                </Text>

                <Group align="flex-end" dir="ltr" mb="sm">
                    <TextInput 
                        label="Library Name" 
                        placeholder="e.g., pandas, requests, beautifulsoup4" 
                        style={{ flexGrow: 1 }}
                        value={installLibName}
                        onChange={(e) => setInstallLibName(e.currentTarget.value)}
                        disabled={isInstallingLib}
                    />
                    <Button 
                        color="indigo" 
                        loading={isInstallingLib}
                        disabled={!installLibName.trim()}
                        onClick={async () => {
                            setIsInstallingLib(true);
                            setInstallLogs('מתחיל התקנה, אנא המתן...\n(פעולה זו עשויה לקחת מספר שניות/דקות תלוי בגודל הספרייה)');
                            try {
                                const res = await axios.post(`${API_BASE_URL}/api/system/install-library`, {
                                    library_name: installLibName
                                });
                                
                                if (res.data.status === 'success') {
                                    setInstallLogs(`✅ התקנה הושלמה בהצלחה!\n\n${res.data.output}`);
                                    setInstallLibName(''); // ניקוי השדה
                                } else {
                                    setInstallLogs(`❌ שגיאה בהתקנה:\n\n${res.data.output}`);
                                }
                            } catch (error) {
                                setInstallLogs(`❌ שגיאת תקשורת:\n\n${error.response?.data?.detail || error.message}`);
                            }
                            setIsInstallingLib(false);
                        }}
                    >
                        התקן ספרייה (pip install)
                    </Button>
                </Group>

                {/* חלון טרמינל וירטואלי להצגת הלוגים של ההתקנה */}
                <Collapse in={!!installLogs}>
                    <Paper withBorder p="xs" radius="sm" bg="#1a1b26" mt="sm">
                        <Text size="xs" fw={700} c="gray.5" mb={4}>Terminal Output:</Text>
                        <Code block color="dark.8" c="green.4" style={{ backgroundColor: 'transparent', direction: 'ltr', textAlign: 'left', fontSize: '12px', maxHeight: '200px', overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                            {installLogs}
                        </Code>
                    </Paper>
                </Collapse>
            </Card>

            <Paper shadow="xl" p="xl" radius="md" withBorder dir="rtl">
              <Group justify="space-between" mb="lg">
                <Title order={2}>הגדרות מתקדמות (ניהול דינמי MongoDB)</Title>
                <Button color="blue" onClick={saveAdminConfigToMongo} leftSection={<IconDeviceFloppy size={16} />}>שמור הכל למסד הנתונים</Button>
              </Group>

              <Grid>
                <Grid.Col span={12}>
                  <Paper withBorder p="md" bg="blue.0" style={{ borderColor: '#74c0fc' }}>
                    <Text fw={900} mb="sm" c="blue.9">הגדרות מסך נחיתה (משמרת נוכחית ל-Viewer)</Text>
                    <Grid>
                        <Grid.Col span={4}>
                            <TextInput label="שם המשמרת (VIP)" value={adminHomeConfig.wip || ''} onChange={(e) => setAdminHomeConfig({...adminHomeConfig, wip: e.currentTarget.value})} />
                        </Grid.Col>
                        <Grid.Col span={2}>
                            <Checkbox 
                                label="משמרת 24/7" 
                                mt="xl" 
                                color="blue"
                                fw={700}
                                checked={adminHomeConfig.is_24_7 || false} 
                                onChange={(e) => setAdminHomeConfig({...adminHomeConfig, is_24_7: e.currentTarget.checked})} 
                            />
                        </Grid.Col>
                        <Grid.Col span={3}>
                            <TextInput label="שעת התחלה" disabled={adminHomeConfig.is_24_7} value={adminHomeConfig.start_time || ''} onChange={(e) => setAdminHomeConfig({...adminHomeConfig, start_time: e.currentTarget.value})} />
                        </Grid.Col>
                        <Grid.Col span={3}>
                            <TextInput label="שעת סיום" disabled={adminHomeConfig.is_24_7} value={adminHomeConfig.end_time || ''} onChange={(e) => setAdminHomeConfig({...adminHomeConfig, end_time: e.currentTarget.value})} />
                        </Grid.Col>
{/* --- שורת הגדרות חייל ו-WEEKI --- */}
                        <Grid.Col span={12}>
                            <Select 
                                label="מקור נתוני חייל במשמרת" 
                                data={[
                                    {value: 'manual', label: 'הזנה ידנית (סטטי)'}, 
                                    {value: 'weeki', label: 'משיכה אוטומטית מ-WEEKI (לפי תאריך)'}
                                ]} 
                                value={adminHomeConfig.soldier_source || 'manual'} 
                                onChange={(v) => setAdminHomeConfig({...adminHomeConfig, soldier_source: v})} 
                            />
                        </Grid.Col>
                        
                        <Grid.Col span={6}>
                            <TextInput 
                                label="שם החייל במשמרת" 
                                disabled={adminHomeConfig.soldier_source === 'weeki'} 
                                value={adminHomeConfig.soldier_name || ''} 
                                onChange={(e) => setAdminHomeConfig({...adminHomeConfig, soldier_name: e.currentTarget.value})} 
                            />
                        </Grid.Col>
                        <Grid.Col span={6}>
                            <TextInput 
                                label="יוזר Jabber של החייל" 
                                dir="ltr" 
                                disabled={adminHomeConfig.soldier_source === 'weeki'} 
                                value={adminHomeConfig.soldier_user || ''} 
                                onChange={(e) => setAdminHomeConfig({...adminHomeConfig, soldier_user: e.currentTarget.value})} 
                            />
                        </Grid.Col>
                        
                        <Grid.Col span={12}>
                            <Divider my="sm" color="blue.2" />
                            <Group justify="space-between" mb="sm">
                                <Text fw={700} size="sm">אנשי קשר למקרים דחופים (דינמי)</Text>
                                <Button size="xs" color="teal" variant="light" leftSection={<IconPlus size={14}/>} onClick={handleAddHomeContact}>
                                    הוסף איש קשר
                                </Button>
                            </Group>
                            
                            <Stack gap="xs">
                                {(adminHomeConfig.contacts || []).map((contact, idx) => (
                                    <Group key={contact.id || idx} grow align="flex-end">
                                        <TextInput 
                                            label="כותרת (למשל: נוקאאוט)" 
                                            value={contact.label} 
                                            onChange={(e) => handleUpdateHomeContact(idx, 'label', e.currentTarget.value)} 
                                        />
                                        <TextInput 
                                            label="ערך / טלפון" 
                                            value={contact.value} 
                                            onChange={(e) => handleUpdateHomeContact(idx, 'value', e.currentTarget.value)} 
                                        />
                                        <ActionIcon color="red" variant="subtle" size="lg" mb={4} onClick={() => handleRemoveHomeContact(idx)}>
                                            <IconTrash size={20} />
                                        </ActionIcon>
                                    </Group>
                                ))}
                            </Stack>
                        </Grid.Col>
                    </Grid>
                  </Paper>
                </Grid.Col>

                <Grid.Col span={{ base: 12, md: 2 }}>
                   <Paper withBorder p="md" bg="gray.0" ta="center">
                      <Text fw={700} mb="sm">ניהול הרשאות</Text>
                      <Button variant="light" onClick={() => setAdminEditorModal({ opened: true, title: 'עריכת הרשאות', field: 'roles' })}>לעריכה</Button>
                   </Paper>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 2 }}>
                   <Paper withBorder p="md" bg="gray.0" ta="center">
                      <Text fw={700} mb="sm">קישורי מערכות</Text>
                      <Button variant="light" onClick={() => setAdminEditorModal({ opened: true, title: 'עריכת קישורים וכלים', field: 'guide_links' })}>לעריכה</Button>
                   </Paper>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 2 }}>
                   <Paper withBorder p="md" bg="gray.0" ta="center">
                      <Text fw={700} mb="sm">טכנולוגיות (JSON)</Text>
                      <Button variant="light" color="orange" onClick={() => setAdminEditorModal({ opened: true, title: 'עריכת טכנולוגיות', field: 'techs' })}>לעריכה</Button>
                   </Paper>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Paper withBorder p="md" bg="gray.0" shadow="sm">
                    <Text fw={800} mb="sm" ta="center">עורכי תצורה ויזואליים (UI Edition)</Text>
                    <Group grow>
                      <Button 
                        variant="filled" 
                        color="teal" 
                        leftSection={<IconServer size={18}/>}
                        onClick={() => openUnifiedEditor('techs')}
                      >
                        עורך טכנולוגיות ושדות
                      </Button>
                      <Button 
                        variant="filled" 
                        color="grape" 
                        leftSection={<IconCode size={18}/>}
                        onClick={() => openUnifiedEditor('templates')}
                      >
                        עורך טמפלטים גנריים
                      </Button>
                    </Group>
                    <Text size="xs" c="dimmed" ta="center" mt="sm">
                      * מומלץ להשתמש בעורך הויזואלי כדי למנוע שגיאות Syntax ב-JSON.
                    </Text>
                  </Paper>
                </Grid.Col>

                <Grid.Col span={12}>
                  <Paper withBorder p="md" bg="gray.0">
                    <Text fw={700} mb="sm">ניהול צוותים במערכת</Text>
                    <Table highlightOnHover>
                      <Table.Thead>
                        <Table.Tr><Table.Th>שם צוות</Table.Th><Table.Th ta="center">קוביית ראביט</Table.Th><Table.Th>אפשרות מחיקה</Table.Th></Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {adminTeams.map((team, idx) => (
                          <Table.Tr key={idx}>
                            <Table.Td>{team.name}</Table.Td>
                            <Table.Td ta="center">
                              <Checkbox 
                                color="orange"
                                size="md"
                                checked={team.hasRabbit !== false}
                                onChange={(e) => {
                                  const updated = [...adminTeams];
                                  updated[idx].hasRabbit = e.currentTarget.checked;
                                  setAdminTeams(updated);
                                }}
                              />
                            </Table.Td>
                            <Table.Td>
                              <ActionIcon color="red" variant="subtle" onClick={() => setAdminTeams(adminTeams.filter((_, i) => i !== idx))}><IconTrash size={16}/></ActionIcon>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                        <Table.Tr bg="gray.0">
                          <Table.Td><TextInput placeholder="שם צוות" value={newTeamName} onChange={(e) => setNewTeamName(e.currentTarget.value)} size="xs" /></Table.Td>
                          <Table.Td ta="center"><Text size="xs" c="dimmed">יופעל אוטומטית</Text></Table.Td>
                          <Table.Td>
                             <Button size="xs" variant="light" color="teal" onClick={() => { setAdminTeams([...adminTeams, {id: newTeamName.toLowerCase().trim().replace(/\s+/g, '_') || `team_${Date.now()}`, name: newTeamName, desc: '', icon: 'IconServer', tracks: [], hasRabbit: true}]); setNewTeamName(''); }} disabled={!newTeamName}>הוסף</Button>
                          </Table.Td>
                        </Table.Tr>
                      </Table.Tbody>
                    </Table>
                  </Paper>
                </Grid.Col>
              </Grid>
            </Paper>
          </Container>
        )}

      </AppShell.Main>
      
      {/* תפריט כלים צף */}
      <Affix position={{ bottom: 20, left: 20 }} style={{ zIndex: 100 }}>
         <Stack align="flex-start" gap="sm">
            <Transition mounted={toolsMenuOpen} transition="slide-up" duration={200} timingFunction="ease">
               {(styles) => (
                  <Paper style={{ ...styles, backgroundColor: 'rgba(255,255,255,0.95)', border: '1px solid #dee2e6' }} p="xs" radius="lg" shadow="xl">
                     <Group gap="xs">
                        {[
                          { key: 'tudo', label: 'TUDO', color: 'blue', icon: IconCheck },
                          { key: 'freakout', label: 'FREAKOUT', color: 'red', icon: IconAlertTriangle },
                          { key: 'morning_report', label: 'דוח בוקר', color: 'orange', icon: IconFileText },
                          { key: 'faults', label: 'רשימת תקלות', color: 'grape', icon: IconList },
                          { key: 'njira', label: 'NJIRA', color: 'teal', icon: IconBriefcase },
                          { key: 'theindex', label: 'THEINDEX', color: 'indigo', icon: IconSearch }
                        ].map(tool => (
                            <Tooltip key={tool.key} label={tool.label} position="top" withArrow>
                               <ActionIcon 
                                 size="xl" radius="md" variant="light" color={tool.color}
                                 onClick={() => window.open(sysConfig?.guide_links?.[tool.key] || '#', '_blank')}
                               >
                                 <tool.icon size={24} />
                               </ActionIcon>
                            </Tooltip>
                        ))}
                     </Group>
                  </Paper>
               )}
            </Transition>
            
            <ActionIcon 
               radius="xl" size="xl" color="dark" shadow="xl" variant="filled"
               style={{ width: 54, height: 54, boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}
               onClick={() => setToolsMenuOpen(!toolsMenuOpen)}
            >
               {toolsMenuOpen ? <IconX size={24} /> : <IconPlus size={24} />}
            </ActionIcon>
         </Stack>
      </Affix>
      
      {/* תפריט הורדות צף */}
      <Affix position={{ bottom: 20, left: 90 }} style={{ zIndex: 100 }}>
         <Stack align="flex-start" gap="sm">
            <Transition mounted={downloadsMenuOpen} transition="slide-up" duration={200} timingFunction="ease">
               {(styles) => (
                  <Paper style={{ ...styles, backgroundColor: 'rgba(255,255,255,0.95)', border: '1px solid #dee2e6' }} p="xs" radius="lg" shadow="xl">
                     <Group gap="xs">
                        <Tooltip label="הורדת סוכן Windows" position="top" withArrow>
                           <ActionIcon size="xl" radius="md" variant="light" color="blue" onClick={() => window.open(`${API_BASE_URL}/api/download/windows`, '_blank')}>
                             <IconServer size={24} />
                           </ActionIcon>
                        </Tooltip>
                        <Tooltip label="הורדת סוכן Linux" position="top" withArrow>
                           <ActionIcon size="xl" radius="md" variant="light" color="orange" onClick={() => window.open(`${API_BASE_URL}/api/download/linux`, '_blank')}>
                             <IconAppWindow size={24} />
                           </ActionIcon>
                        </Tooltip>
                     </Group>
                  </Paper>
               )}
            </Transition>
            
            <ActionIcon 
               radius="xl" size="xl" color="teal" shadow="xl" variant="filled"
               style={{ width: 54, height: 54, boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}
               onClick={() => setDownloadsMenuOpen(!downloadsMenuOpen)}
            >
               {downloadsMenuOpen ? <IconX size={24} /> : <IconArrowDownCircle size={24} />}
            </ActionIcon>
         </Stack>
      </Affix>
      {/* ----- מודל מרכזי אחד - דאשבורד סיכום ל-VIEWER ול-ADMIN ----- */}
      <Modal 
          opened={summaryModal.opened} 
          onClose={() => setSummaryModal({ opened: false, type: null, team: null, track: null })} 
          title={
              <Group>
                  <IconReportAnalytics size={28} color="#20c997" />
                  <Text fw={900} size="xl" c="teal.9">
                      סיכום ניטורים כולל - {summaryModal.type === 'track' ? `מסלול ${summaryModal.track?.name}` : `צוות ${summaryModal.team?.name}`}
                  </Text>
              </Group>
          } 
          centered 
          size="85%" 
          dir="rtl"
      >
          {renderSummaryContent()}
      </Modal>

      {/* מודאל פירוט חוקים דינמי מתקדם - קוביות MAJOR ו-CRITICAL מעוצבות עם כפתורי עריכה */}
      <Modal 
          opened={!!summaryRuleDetails} 
          onClose={() => setSummaryRuleDetails(null)} 
          title={
              <Group gap="sm">
                  <ThemeIcon size="lg" radius="md" color="blue" variant="light">
                      <IconListDetails size={20} />
                  </ThemeIcon>
                  <Text fw={900} size="xl">
                      פירוט חוקים: {summaryRuleDetails?.nodeName} <Text span c="dimmed" fw={400}>({summaryRuleDetails?.category})</Text>
                  </Text>
              </Group>
          } 
          centered 
          dir="rtl" 
          size="lg"
      >
          {summaryRuleDetails && summaryRuleDetails.rules && (
              <Stack gap="md">
                  {summaryRuleDetails.rules.map((r, idx) => (
                      <Paper key={idx} withBorder p="md" radius="md" shadow="sm" bg="white" style={{ borderRight: currentRole === 'viewer' ? '4px solid #339af0' : '4px solid #1c7ed6' }}>
                          <Group justify="space-between" mb="xs">
                              <Group gap="xs">
                                  <Badge color="indigo" variant="dot" size="md">{r.tech || 'כללי'}</Badge>
                                  <Text fw={800} size="md" c="dark.9">
                                      {currentRole === 'viewer' ? `חוק ניטור ${idx + 1}` : (r.originalNames?.[0] || r.name || 'שאילתה מובנית')}
                                  </Text>
                                  {r.internal && <Badge color="orange" variant="light" size="xs">פנימי</Badge>}
                              </Group>
                          </Group>

                          <Text size="sm" fw={700} c="dimmed" mb={4}>מטרה / תיאור פעולה:</Text>
                          <Text size="sm" mb="md" fw={500}>{r.purpose || 'לא הוגדרה מטרה / תיאור לחוק זה במערכת.'}</Text>

                          {/* בלוק תצוגת ספים והצעת עריכה גלוי לכולם (כולל VIEWER) */}
                          <Paper bg="gray.0" p="md" radius="md" mb={currentRole !== 'viewer' ? 'md' : 0} withBorder>
                              {summaryRuleDetails.editRuleIdx === idx ? (
                                  <Stack gap="sm">
                                      <Group justify="space-between">
                                          <Text fw={900} c="blue.9" size="lg">טופס הצעת שינוי ספים</Text>
                                          <ActionIcon color="gray" variant="subtle" onClick={() => setSummaryRuleDetails(prev => ({...prev, editRuleIdx: null}))}><IconX size={16}/></ActionIcon>
                                      </Group>
                                      <Grid>
                                          <Grid.Col span={6}>
                                              <NumberInput label={<Text fw={800} c="red.8">סף קריטי (CRITICAL)</Text>} value={summaryRuleDetails.prCritical} onChange={(v) => setSummaryRuleDetails(prev => ({...prev, prCritical: v}))} hideControls />
                                          </Grid.Col>
                                          <Grid.Col span={6}>
                                              <NumberInput label={<Text fw={800} c="yellow.8">סף אזהרה (MAJOR)</Text>} value={summaryRuleDetails.prWarning} onChange={(v) => setSummaryRuleDetails(prev => ({...prev, prWarning: v}))} hideControls />
                                          </Grid.Col>
                                      </Grid>
                                      <Textarea label={<Text fw={800} c="blue.8">סיבת השינוי (חובה)</Text>} placeholder="הסבר מדוע צריך לשנות את הספים (למשל: למנוע התראות שווא)..." value={summaryRuleDetails.prReason} onChange={(e) => setSummaryRuleDetails(prev => ({...prev, prReason: e.currentTarget.value}))} />
                                      <Button fullWidth color="teal" size="md" mt="xs" leftSection={<IconSend size={18}/>} onClick={async () => {
                                          if(!summaryRuleDetails.prReason) return alert('חובה להזין סיבת שינוי!');
                                          try {
                                              await axios.post(`${API_BASE_URL}/api/prs`, {
                                                  id: Date.now().toString(),
                                                  teamId: summaryModal.team?.id || 'all',
                                                  trackId: summaryModal.track?.id || 'all',
                                                  desc: `בקשת עריכת ספים לחוק: ${r.purpose || r.originalNames?.[0] || 'כללי'}\n\nסף קריטי חדש: ${summaryRuleDetails.prCritical}\nסף אזהרה חדש: ${summaryRuleDetails.prWarning}\nסיבה: ${summaryRuleDetails.prReason}`,
                                                  user: username || 'משתמש',
                                                  nodes: [], edges: [],
                                                  date: new Date().toLocaleString('he-IL'),
                                                  status: "pending"
                                              });
                                              alert('הבקשה לשינוי ספים נשלחה בהצלחה ותמתין לאישור צוות האדמין!');
                                              setSummaryRuleDetails(prev => ({...prev, editRuleIdx: null}));
                                          } catch(e) { alert('שגיאה בשליחת הבקשה מול השרת. ודא שהראוט /api/prs קיים בשרת.'); }
                                      }}>
                                          שלח בקשה לאישור
                                      </Button>
                                  </Stack>
                              ) : (
                                  <Stack gap="md">
                                      <Text size="sm" fw={800} c="dark.7">ספי התראה נוכחיים:</Text>
                                      <Group gap="lg">
                                          {/* קובייה לסף הקריטי */}
                                          {r.mergedCritical !== undefined && (
                                              <Paper p="sm" radius="md" bg="red.0" style={{ border: '2px solid #fa5252', width: '150px', position: 'relative', boxShadow: '0 4px 12px rgba(250, 82, 82, 0.15)', transition: 'transform 0.2s', cursor: 'default' }} onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
                                                  <Tooltip label="ערוך סף קריטי">
                                                      <ActionIcon size="sm" variant="transparent" color="red.9" style={{ position: 'absolute', top: 8, left: 8 }} onClick={() => setSummaryRuleDetails(prev => ({...prev, editRuleIdx: idx, prCritical: r.mergedCritical || '', prWarning: r.mergedWarning || '', prReason: ''}))}>
                                                          <IconEdit size={18} />
                                                      </ActionIcon>
                                                  </Tooltip>
                                                  <Stack gap={0} align="center" mt="xs">
                                                      <Text size="xs" fw={900} c="red.9" style={{ letterSpacing: '1px' }}>CRITICAL</Text>
                                                      <Text size="sm" fw={700} c="red.7">קריטי</Text>
                                                      <Text fw={900} c="red.9" mt="xs" style={{ fontSize: '32px', lineHeight: 1 }}>{r.mergedCritical}</Text>
                                                  </Stack>
                                              </Paper>
                                          )}
                                          
                                          {/* קובייה לסף האזהרה */}
                                          {r.mergedWarning !== undefined && (
                                              <Paper p="sm" radius="md" bg="yellow.0" style={{ border: '2px solid #fab005', width: '150px', position: 'relative', boxShadow: '0 4px 12px rgba(250, 176, 5, 0.15)', transition: 'transform 0.2s', cursor: 'default' }} onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
                                                  <Tooltip label="ערוך סף אזהרה">
                                                      <ActionIcon size="sm" variant="transparent" color="yellow.9" style={{ position: 'absolute', top: 8, left: 8 }} onClick={() => setSummaryRuleDetails(prev => ({...prev, editRuleIdx: idx, prCritical: r.mergedCritical || '', prWarning: r.mergedWarning || '', prReason: ''}))}>
                                                          <IconEdit size={18} />
                                                      </ActionIcon>
                                                  </Tooltip>
                                                  <Stack gap={0} align="center" mt="xs">
                                                      <Text size="xs" fw={900} c="yellow.9" style={{ letterSpacing: '1px' }}>MAJOR</Text>
                                                      <Text size="sm" fw={700} c="yellow.8">אזהרה</Text>
                                                      <Text fw={900} c="yellow.9" mt="xs" style={{ fontSize: '32px', lineHeight: 1 }}>{r.mergedWarning}</Text>
                                                  </Stack>
                                              </Paper>
                                          )}
                                          
                                          {/* אם אין ספים מספריים בכלל, ניתן כפתור עריכה כללי כדי שאפשר יהיה להוסיף */}
                                          {r.mergedCritical === undefined && r.mergedWarning === undefined && (
                                              <Paper p="sm" radius="md" bg="gray.1" style={{ border: '2px dashed #ced4da', width: '150px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                                                  <Text size="xs" fw={700} c="dimmed" ta="center" mb="xs">ללא סף מספרי</Text>
                                                  <Button size="xs" variant="light" color="blue" leftSection={<IconEdit size={14} />} onClick={() => setSummaryRuleDetails(prev => ({...prev, editRuleIdx: idx, prCritical: '', prWarning: '', prReason: ''}))}>
                                                      הוסף ספים
                                                  </Button>
                                              </Paper>
                                          )}
                                      </Group>
                                  </Stack>
                              )}
                          </Paper>

                          {/* שאילתת הקוד גלויה רק ל-Admin. אם יש כמה שאילתות מאוחדות, נציג אותן */}
                          {currentRole !== 'viewer' && (r.query || r.allQueries?.length > 0) && (
                              <Paper bg="dark.8" p="xs" radius="sm">
                                  <Group justify="space-between" mb={4}>
                                      <Text size="xs" fw={700} c="blue.3">שאילתת בסיס קונפיגורטיבית:</Text>
                                      <CopyButton value={r.allQueries ? r.allQueries.join('\n\n') : r.query} timeout={2000}>
                                          {({ copied, copy }) => (
                                              <ActionIcon color={copied ? 'teal' : 'gray'} variant="transparent" size="xs" onClick={copy}>
                                                  {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                                              </ActionIcon>
                                          )}
                                      </CopyButton>
                                  </Group>
                                  <Code block color="transparent" c="green.4" style={{ direction: 'ltr', textAlign: 'left', whiteSpace: 'pre-wrap', fontSize: '12px', backgroundColor: 'transparent' }}>
                                      {r.allQueries ? r.allQueries.join('\n\n') : r.query}
                                  </Code>
                              </Paper>
                          )}
                      </Paper>
                  ))}
                  <Button fullWidth mt="sm" variant="subtle" color="gray" onClick={() => setSummaryRuleDetails(null)}>סגור פירוט</Button>
              </Stack>
          )}
      </Modal>


      {/* מודלים של אוטומציות */}
            <Modal opened={autoModalOpen && !pythonModalOpen && !promqlModalOpen && !restartModalOpen} onClose={() => setAutoModalOpen(false)} title={<Text fw={900} size="lg">יצירת אוטומציה חדשה</Text>} centered dir="rtl" size="md">        <Stack>
            <TextInput label="שם האוטומציה" placeholder="לדוגמה: Restart on high CPU" value={autoForm.name} onChange={(e) => setAutoForm({...autoForm, name: e.currentTarget.value})} required />
            <Select label="סוג פעולה מבוקשת" placeholder="בחר סוג פעולה" data={[{value: 'script', label: 'סקריפט Python מותאם אישית'}, {value: 'server', label: 'ביצוע Restart לשירות/שרת'}]} value={autoForm.action_type} onChange={(v) => setAutoForm({...autoForm, action_type: v})} required />
            
            <Paper withBorder p="sm" bg="gray.0">
                <Group justify="space-between">
                    <Text fw={700} size="sm">הגדרת טריגר (PromQL)</Text>
                    <Button size="xs" variant="light" color="indigo" onClick={() => setPromqlModalOpen(true)}>
                        {autoForm.metric_query ? 'ערוך טריגר' : 'הגדר טריגר'}
                    </Button>
                </Group>
                {autoForm.metric_query && (
                    <Text size="xs" mt="xs" c="dimmed" dir="ltr" ta="left">{autoForm.metric_query} {autoForm.operator} {autoForm.threshold}</Text>
                )}
            </Paper>

            <Paper withBorder p="sm" bg="gray.0">
                <Group justify="space-between">
                    <Text fw={700} size="sm">פעולה לביצוע (Action)</Text>
                    <Button size="xs" variant="light" color="indigo" onClick={() => {
                        if (autoForm.action_type === 'server') setRestartModalOpen(true);
                        else setPythonModalOpen(true);
                    }}>
                        {autoForm.python_code ? 'ערוך פעולה' : 'הגדר פעולה'}
                    </Button>
                </Group>
                {autoForm.python_code && (
                    <Text size="xs" mt="xs" c="green.7">הוגדרה פעולה בהצלחה.</Text>
                )}
            </Paper>

            <Button fullWidth color="indigo" mt="md" onClick={handleCreateAutomation} disabled={!autoForm.name || !autoForm.metric_query || !autoForm.python_code}>
                שמור אוטומציה
            </Button>
        </Stack>
      </Modal>

<Modal opened={promqlModalOpen} onClose={() => setPromqlModalOpen(false)} title="הגדרת טריגר (PromQL)" size="lg" centered dir="rtl" zIndex={10000}>        <Stack>
            <Textarea 
               label="שאילתת בסיס (PromQL)" 
               placeholder="up == 0" 
               value={autoForm.metric_query} 
               onChange={(e) => setAutoForm({...autoForm, metric_query: e.currentTarget.value})} 
               dir="ltr" 
               minRows={3}
               styles={{ input: { fontFamily: 'monospace', backgroundColor: '#2d2d2d', color: '#a5d8ff', fontSize: '14px' } }}
            />
            <Group grow>
                <Select label="תנאי הפעלה" data={['>', '<', '==']} value={autoForm.operator} onChange={(v) => setAutoForm({...autoForm, operator: v})} />
                <NumberInput label="סף (Threshold)" value={autoForm.threshold} onChange={(v) => setAutoForm({...autoForm, threshold: v})} />
            </Group>
            
            <Paper withBorder p="md">
                <Group justify="space-between" mb="sm">
                    <Text fw={700}>תצוגה מקדימה מהשרת</Text>
                    <Group>
                        <input type="datetime-local" value={autoGraphStartTime} onChange={(e) => setAutoGraphStartTime(e.target.value)} style={{ fontSize: '12px', padding: '4px', borderRadius: '4px', border: '1px solid #ccc' }} />
                        <Text size="xs">עד</Text>
                        <input type="datetime-local" value={autoGraphEndTime} onChange={(e) => setAutoGraphEndTime(e.target.value)} style={{ fontSize: '12px', padding: '4px', borderRadius: '4px', border: '1px solid #ccc' }} />
                        <Button size="xs" variant="light" onClick={handleFetchAutoGraph} loading={isGraphLoading}>רענן נתונים</Button>
                    </Group>
                </Group>
                {renderAutoGraph()}
            </Paper>
            
            <Button fullWidth onClick={() => setPromqlModalOpen(false)}>שמור טריגר</Button>
        </Stack>
      </Modal>

<Modal opened={pythonModalOpen} trapFocus={false} onClose={() => setPythonModalOpen(false)} title="עורך Python לאוטומציה" size="xl" centered dir="rtl" zIndex={10000}>
        <Stack>
            {/* התיקון הקריטי: הוספנו dir="ltr" לעטיפה של העורך כדי שיעבוד חלק */}
            <Paper withBorder radius="md" dir="ltr" style={{ overflow: 'hidden', border: '1px solid #333', textAlign: 'left' }}>
                <Group bg="#2d2d2d" p="xs" gap="xs">
                    <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#ff5f56' }} />
                    <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#ffbd2e' }} />
                    <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#27c93f' }} />
                    <Text size="xs" c="dimmed" ml="md">action_script.py</Text>
                </Group>
                <Editor
                    height="400px"
                    defaultLanguage="python"
                    theme="vs-dark"
                    value={autoForm.python_code}
                    onChange={(value) => setAutoForm({...autoForm, python_code: value})}
                    options={{ minimap: { enabled: false }, fontSize: 14 }}
                />
            </Paper>
            
            <Group justify="space-between" mt="sm">
                <Button variant="light" color="orange" onClick={handleTestPython}>Test Script</Button>
                <Button color="indigo" onClick={() => setPythonModalOpen(false)}>שמור סקריפט</Button>
            </Group>
            
            {pythonTestOutput && (
                <Paper bg="dark.8" p="sm" mt="sm">
                    <Text c={isPythonError ? "red.4" : "green.4"} style={{ fontFamily: 'monospace', direction: 'ltr', whiteSpace: 'pre-wrap', fontSize: '12px' }}>{pythonTestOutput}</Text>
                </Paper>
            )}
        </Stack>
      </Modal>

      <Modal opened={restartModalOpen} onClose={() => setRestartModalOpen(false)} title={<Text fw={900} size="lg">הגדרת פעולת ריסטרט לשחזור</Text>} centered dir="rtl" size="md" zIndex={10000}>
        <Stack>
            <Select label="סוג ריסטרט" data={[{value: 'server', label: 'הפעלת שרת מחדש'}, {value: 'service', label: 'ריסטרט לסרוויס ב-Linux'}, {value: 'process', label: 'הריגת תהליך (Kill Process)'}]} value={restartForm.restartType} onChange={(v) => setRestartForm({...restartForm, restartType: v})} />
            <TextInput label="שרת יעד (IP / Hostname)" placeholder="10.0.0.1" value={restartForm.server} onChange={(e) => setRestartForm({...restartForm, server: e.currentTarget.value})} required />
            
            {restartForm.restartType === 'service' && <TextInput label="שם סרוויס" placeholder="rabbitmq-server" value={restartForm.service} onChange={(e) => setRestartForm({...restartForm, service: e.currentTarget.value})} required />}
            {restartForm.restartType === 'process' && <TextInput label="שם הפרוסס" placeholder="java" value={restartForm.process} onChange={(e) => setRestartForm({...restartForm, process: e.currentTarget.value})} required />}
            
            <Button fullWidth onClick={handleSaveRestartAutomation}>שמור והגדר כפעולת שחזור</Button>
        </Stack>
      </Modal>

      <Modal opened={autoHistoryModal.open} onClose={() => setAutoHistoryModal({open: false, auto: null})} title={<Text fw={900} size="lg">היסטוריית ריצות: {autoHistoryModal.auto?.name}</Text>} centered dir="rtl" size="lg">
        {autoHistoryModal.auto && (
            <ScrollArea h={300}>
            {!autoHistoryModal.auto.history || autoHistoryModal.auto.history.length === 0 ? (
                <Text c="dimmed" ta="center" mt="xl">אין היסטוריית ריצות לאוטומציה זו.</Text>
            ) : (
                <Table highlightOnHover dir="rtl">
                    <Table.Thead>
                        <Table.Tr><Table.Th>תאריך</Table.Th><Table.Th>סטטוס</Table.Th><Table.Th>פירוט</Table.Th></Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {autoHistoryModal.auto.history.map((h, idx) => (
                            <Table.Tr key={idx}>
                                <Table.Td>{h.date}</Table.Td>
                                <Table.Td>
                                    <Badge color={h.status === 'success' ? 'teal' : 'red'}>{h.status}</Badge>
                                </Table.Td>
                                <Table.Td><Text size="xs" truncate w={200}>{h.log}</Text></Table.Td>
                            </Table.Tr>
                        ))}
                    </Table.Tbody>
                </Table>
            )}
            </ScrollArea>
        )}
      </Modal>

      {/* מודאל הוספת/עריכת חוק ייעודי */}
      <AddRuleModal 
        opened={modalOpened} 
        onClose={handleCloseModal} 
        onAdd={handleSaveRule} 
        editingRule={editingRule} 
      />
      
      {/* מודאל יצירת חוק CUSTOM גנרי / עריכת תבנית מיפוי */}
      <Modal opened={genericRuleModalOpen} onClose={() => setGenericRuleModalOpen(false)} title={<Text fw={900} size="lg">{genericRuleForm.id ? 'עריכת חוק גנרי או תבנית מיפוי' : 'יצירת חוק CUSTOM גנרי (מבוסס Labels)'}</Text>} centered dir="rtl" size="md">
          <Stack>
              <TextInput label="שם החוק (Generic)" placeholder="לדוגמה: neptune_custom_rule" value={genericRuleForm.name} disabled={!!genericRuleForm.id} onChange={(e) => setGenericRuleForm({...genericRuleForm, name: e.currentTarget.value})} required />
              
              {!genericRuleForm.id && (
                  <Select 
                      label="שיוך לצוות / Application" 
                      placeholder="בחר צוות... (השאר ריק או בחר 'כללי' לחוק חוצה-מערכת)"
                      data={[
                          {value: 'ALL', label: 'כללי (כל הצוותים והמסלולים)'},
                          ...(sysConfig?.teams || []).map(t => ({value: t.id, label: t.name}))
                      ]} 
                      value={genericRuleForm.application} 
                      onChange={(val) => {
                          const t = sysConfig?.teams.find(x => x.id === val);
                          setGenericRuleForm({...genericRuleForm, application: val, team: t ? t.name : 'כללי'});
                      }} 
                      required 
                  />
              )}

              <Textarea label="מטרת החוק" value={genericRuleForm.purpose} onChange={(e) => setGenericRuleForm({...genericRuleForm, purpose: e.currentTarget.value})} />
              
              <Textarea 
                 label="שאילתת PromQL" 
                 placeholder="לדוגמה: up == 1" 
                 value={genericRuleForm.query} 
                 onChange={(e) => setGenericRuleForm({...genericRuleForm, query: e.currentTarget.value})} 
                 dir="ltr" 
                 required 
                 minRows={3}
                 styles={{ input: { fontFamily: 'monospace', backgroundColor: '#2d2d2d', color: '#a5d8ff', fontSize: '14px' } }}
              />
              
              <TextInput 
                 label="תבנית מיפוי (Mapping Template)"
                 description="לדוגמה: {{$labels.label}} או {{$labels.vhost}}-{{$labels.queue}} יחבר את הלייבלים מפרומטאוס ויחפש רכיב בקנבס עם שם זהה."
                 value={genericRuleForm.mappingTemplate} 
                 onChange={(e) => setGenericRuleForm({...genericRuleForm, mappingTemplate: e.currentTarget.value})} 
                 dir="ltr"
                 required
              />

              <Button fullWidth color="blue" mt="md" disabled={!genericRuleForm.name || !genericRuleForm.query || (!genericRuleForm.id && !genericRuleForm.application)} onClick={async () => {
                  try {
                      if (genericRuleForm.id) {
                          await axios.put(`${API_BASE_URL}/rules/${genericRuleForm.id}`, { ...genericRuleForm, tech: 'CUSTOM', node: 'GENERIC', subType: 'אפליקטיבי', user: username });
                      } else {
                          await axios.post(`${API_BASE_URL}/rules`, { ...genericRuleForm, tech: 'CUSTOM', node: 'GENERIC', subType: 'אפליקטיבי', user: username });
                      }
                      fetchRules();
                      setGenericRuleModalOpen(false);
                  } catch(e) { alert('שגיאה בשמירת החוק הגנרי'); }
              }}>שמור חוק גנרי</Button>
          </Stack>
      </Modal>

    {/* ----------------- המודאלים החסרים שהוספנו ----------------- */}
{/* 1. מודאל עריכת קוביית קיימות (Existence) */}
      <Modal opened={existenceModalOpen} trapFocus={false} onClose={() => setExistenceModalOpen(false)} title={<Text fw={900}>{existenceForm.id ? 'עריכת קוביית בדיקה (Existence)' : 'יצירת קוביית בדיקה חדשה'}</Text>} centered dir="rtl" size="xl">
          <Stack>
              <TextInput label="שם הבדיקה" value={existenceForm.name} onChange={(e) => setExistenceForm({...existenceForm, name: e.currentTarget.value})} required />
              <TextInput label="תיאור קצר (אופציונלי)" value={existenceForm.description} onChange={(e) => setExistenceForm({...existenceForm, description: e.currentTarget.value})} />
              
              <div style={{ direction: 'ltr', textAlign: 'left' }}>
                  <Text fw={600} size="sm" mb={4}>קוד בדיקה (Python)</Text>
                  <Text size="xs" c="dimmed" mb="sm">יש להשתמש במשתנה input_id. יש להגדיר את משתנה התוצאה הסופית result (True/False).</Text>
                  <div style={{ border: '1px solid #495057', borderRadius: '8px', overflow: 'hidden' }}>
                      <Editor
                          height="300px"
                          defaultLanguage="python"
                          theme="vs-dark"
                          value={existenceForm.script}
                          onChange={(value) => setExistenceForm({...existenceForm, script: value})}
                          options={{ minimap: { enabled: false }, fontSize: 14 }}
                      />
                  </div>
              </div>

              <Button fullWidth color="pink" size="lg" mt="sm" onClick={handleSaveExistenceCube} disabled={!existenceForm.name}>שמור קוביית בדיקה</Button>
          </Stack>
      </Modal>

{/* 2. מודאל עריכת קוביית אקספורטר */}
{/* 2. מודאל עריכת קוביית אקספורטר */}
      <Modal opened={exporterModalOpen} trapFocus={false} onClose={() => setExporterModalOpen(false)} title={<Text fw={900}>{exporterForm.id ? 'עריכת אקספורטר' : 'יצירת אקספורטר חדש'}</Text>} centered dir="rtl" size="xl">
          <Stack>
              <Group grow>
                  <TextInput label="שם (לצורך זיהוי)" value={exporterForm.name} onChange={(e) => setExporterForm({...exporterForm, name: e.currentTarget.value})} required />
                  <TextInput label="תיאור קצר" value={exporterForm.description} onChange={(e) => setExporterForm({...exporterForm, description: e.currentTarget.value})} />
              </Group>
              
              <Group grow mb="xs">
                  <NumberInput label="תדירות דגימה (בדקות)" min={1} value={exporterForm.interval_minutes} onChange={(v) => setExporterForm({...exporterForm, interval_minutes: v})} required />
                  <Select 
                      label="אופן איסוף הנתונים (Update Mode)" 
                      data={[
                          {value: 'overwrite', label: 'הוסף/דרוס ערכים (מטריקות ישנות יישמרו)'}, 
                          {value: 'clear', label: 'נקה זיכרון קוביה לפני כל דגימה'}
                      ]} 
                      value={exporterForm.update_mode} 
                      onChange={(v) => setExporterForm({...exporterForm, update_mode: v})} 
                      required 
                  />
              </Group>
                  
              <div style={{ direction: 'ltr', textAlign: 'left' }}>
                  <Text fw={600} size="sm" mb={4}>קוד חישוב פייתון</Text>
                  <Text size="xs" c="dimmed" mb="sm">עדכן את המילון metrics עם המטריקות שלך. למשל: metrics['my_val'] = 5</Text>
                  
                  <div style={{ border: '1px solid #495057', borderRadius: '8px', overflow: 'hidden' }}>
                      <Editor
                          height="400px"
                          defaultLanguage="python"
                          theme="vs-dark"
                          value={exporterForm.python_code}
                          onChange={(value) => setExporterForm({...exporterForm, python_code: value})}
                          options={{
                              minimap: { enabled: false },
                              fontSize: 14,
                              scrollBeyondLastLine: false,
                              smoothScrolling: true,
                              wordWrap: 'on'
                          }}
                      />
                  </div>
              </div>

            <Group justify="space-between" mt="sm">
                  <Button variant="light" color="orange" onClick={handleTestExporterScript}>Test Script</Button>
                  <Button color="yellow" size="md" onClick={handleSaveExporterCube} disabled={!exporterForm.name}>שמור אקספורטר</Button>
              </Group>

              {exporterTestOutput && (
                  <Paper bg="dark.8" p="sm" mt="sm" radius="md">
                      <Text c={isExporterError ? "red.4" : "green.4"} style={{ fontFamily: 'monospace', direction: 'ltr', whiteSpace: 'pre-wrap', fontSize: '13px' }}>
                          {exporterTestOutput}
                      </Text>
                  </Paper>
              )}          </Stack>
      </Modal>

      {/* 3. מודאל עריכת תחנה בחוטר */}
      <Modal opened={choterStationModalOpen} onClose={() => setChoterStationModalOpen(false)} title={<Text fw={900} size="lg">{editingStationId ? 'עריכת תחנת חוטר' : 'הוספת תחנת חוטר'}</Text>} centered dir="rtl" size="xl">
          <Stack>
              <Group grow>
                  <TextInput label="שם התחנה" value={choterStationForm.name} onChange={(e) => setChoterStationForm({...choterStationForm, name: e.currentTarget.value})} required />
                  <Select label="תפקיד התחנה" data={[{value: 'source', label: 'מקור (Source)'}, {value: 'intermediate', label: 'תחנת מעבר'}, {value: 'destination', label: 'יעד (Destination)'}]} value={choterStationForm.station_role} onChange={(v) => setChoterStationForm({...choterStationForm, station_role: v})} />
              </Group>
              <Group grow>
                  <NumberInput label="סדר ריצה (Order)" value={choterStationForm.order} onChange={(v) => setChoterStationForm({...choterStationForm, order: v})} />
                  <NumberInput label="זמן המתנה לפני חיפוש (בשניות)" value={choterStationForm.delay_seconds} onChange={(v) => setChoterStationForm({...choterStationForm, delay_seconds: v})} />
              </Group>
              <TextInput label="כתובת אלסטיק (ECK URL)" value={choterStationForm.eck_url} onChange={(e) => setChoterStationForm({...choterStationForm, eck_url: e.currentTarget.value})} dir="ltr" required />
              <Textarea label="שאילתת חיפוש (Lucene/KQL)" value={choterStationForm.query} onChange={(e) => setChoterStationForm({...choterStationForm, query: e.currentTarget.value})} dir="ltr" />
              <Group grow>
                  <NumberInput label="טווח חיפוש (דקות אחורה)" value={choterStationForm.time_range_minutes} onChange={(v) => setChoterStationForm({...choterStationForm, time_range_minutes: v})} />
                  <Select label="תנאי להצלחה" data={['>', '<', '==', '>=', '<=']} value={choterStationForm.condition_operator} onChange={(v) => setChoterStationForm({...choterStationForm, condition_operator: v})} />
                  <NumberInput label="ערך נדרש להצלחה" value={choterStationForm.condition_value} onChange={(v) => setChoterStationForm({...choterStationForm, condition_value: v})} />
              </Group>
              
              <Group justify="space-between" mt="md">
                  <Button variant="light" color="orange" onClick={handleTestElastic} loading={isTesting}>בדוק חיבור לשאילתה</Button>
                  <Button color="blue" onClick={handleSaveChoterStation}>שמור תחנה</Button>
              </Group>
              
              {testResult && (
                  <Paper bg="dark.8" p="xs" mt="xs">
                      <Text size="xs" c={testResult.includes('שגיאה') ? 'red.4' : 'green.4'}>{testResult}</Text>
                  </Paper>
              )}
          </Stack>
      </Modal>

{/* 4. מודאל הגדרות ריצה וטריגר לחוטר */}
      <Modal opened={choterSettingsModalOpen} trapFocus={false} onClose={() => setChoterSettingsModalOpen(false)} title={<Text fw={900} size="lg">הגדרות הרצת חוטר וטריגר</Text>} centered dir="rtl" size="xl">
          <Stack>
              <NumberInput label="תדירות הרצה אוטומטית (בדקות)" value={choterGroupSettings.interval_minutes} onChange={(v) => setChoterGroupSettings({...choterGroupSettings, interval_minutes: v})} />
              <Checkbox 
                  label="ייצא סטטוס תחנות אוטומטית לאקספורטר (Prometheus)" 
                  description="כאשר מסומן, כל ריצה תדחוף את סטטוס התחנות למערכת. ביטול הסימון ימחק אותן משם."
                  checked={choterGroupSettings.export_to_metrics} 
                  onChange={(e) => {
                      const isChecked = e.currentTarget.checked;
                      if (!isChecked) {
                          // אם מנסים לכבות, נקפיץ אזהרה
                          if (window.confirm("האם אתה בטוח? שמירת ההגדרות ללא סימון זה תמחק באופן מיידי את המטריקות של חוטר זה מפרומטאוס!")) {
                              setChoterGroupSettings({...choterGroupSettings, export_to_metrics: false});
                          }
                      } else {
                          // אם רק מדליקים, אין צורך באזהרה
                          setChoterGroupSettings({...choterGroupSettings, export_to_metrics: true});
                      }
                  }} 
                  color="cyan"
                  size="md"
                  mt="sm"
                  fw={700}
              />
              <div style={{ direction: 'ltr', textAlign: 'left' }}>
                  <Text fw={600} size="sm" mb={4}>סקריפט טריגר (Python) אופציונלי</Text>
                  <Text size="xs" c="dimmed" mb="sm">סקריפט שירוץ לפני תחילת המסלול (למשל כדי לייצר מידע באלסטיק). השאר ריק אם אין צורך.</Text>
                  <div style={{ border: '1px solid #495057', borderRadius: '8px', overflow: 'hidden' }}>
                      <Editor
                          height="250px"
                          defaultLanguage="python"
                          theme="vs-dark"
                          value={choterGroupSettings.trigger_script}
                          onChange={(value) => setChoterGroupSettings({...choterGroupSettings, trigger_script: value})}
                          options={{ minimap: { enabled: false }, fontSize: 14 }}
                      />
                  </div>
              </div>

              <Group justify="space-between" mt="sm">
                  <Button variant="light" color="orange" onClick={handleTestTrigger} loading={isTestingTrigger}>בדוק טריגר מול השרת</Button>
                  <Button color="blue" onClick={handleSaveChoterSettings}>שמור הגדרות</Button>
              </Group>
              {triggerTestResult && (
                  <Paper bg="dark.8" p="xs" mt="xs">
                      <Text size="xs" c={triggerTestResult.includes('שגיאה') ? 'red.4' : 'green.4'} style={{ whiteSpace: 'pre-wrap', direction: 'ltr', fontFamily: 'monospace' }}>{triggerTestResult}</Text>
                  </Paper>
              )}
          </Stack>
      </Modal>

      {/* 5. מודאל השהיה (Delay) מהירה לתחנה בחוטר */}
      <Modal opened={quickDelayModal.open} onClose={() => setQuickDelayModal({ open: false, station: null, delay: 0 })} title="עריכת זמן השהיה (Delay)" centered dir="rtl" size="sm">
          <Stack>
              <NumberInput label="זמן המתנה (בשניות) לפני ביצוע הבדיקה בתחנה זו" value={quickDelayModal.delay} onChange={(v) => setQuickDelayModal({...quickDelayModal, delay: v})} min={0} />
              <Button fullWidth color="cyan" onClick={handleSaveQuickDelay}>שמור זמן השהיה</Button>
          </Stack>
      </Modal>

{/* 6. מודאל היסטוריית ריצות לחוטר */}
      <Modal opened={choterHistoryModal.open} onClose={() => setChoterHistoryModal({open: false, group: null})} title={<Text fw={900} size="lg">היסטוריית ריצות: {choterHistoryModal.group?.name}</Text>} centered dir="rtl" size="lg">
        {choterHistoryModal.group && (() => {
            const historyData = choterHistoryModal.group.history || [];
            
            // שולף תאריכים ייחודיים מתוך הלוגים (חותך את השעה)
            const availableDates = [...new Set(historyData.map(h => h.date.split(' ')[0]))].reverse();
            
            // מסנן את ההיסטוריה לפי התאריך שנבחר
            const filteredHistory = [...historyData].reverse().filter(h => {
                if (choterHistoryDateFilter === 'all') return true;
                return h.date.startsWith(choterHistoryDateFilter);
            });

            return (
                <Stack>
                    {historyData.length > 0 && (
                        <Select 
                            label="סנן לפי תאריך" 
                            data={[{value: 'all', label: 'כל התאריכים'}, ...availableDates.map(d => ({value: d, label: d}))]} 
                            value={choterHistoryDateFilter} 
                            onChange={setChoterHistoryDateFilter} 
                        />
                    )}
                    <ScrollArea h={300}>
                        {historyData.length === 0 ? (
                            <Text c="dimmed" ta="center" mt="xl">אין עדיין היסטוריית ריצות לחוטר זה.</Text>
                        ) : filteredHistory.length === 0 ? (
                            <Text c="dimmed" ta="center" mt="xl">אין ריצות בתאריך שנבחר.</Text>
                        ) : (
                            <Table highlightOnHover dir="rtl">
                                <Table.Thead>
                                    <Table.Tr><Table.Th>תאריך שעה</Table.Th><Table.Th>סטטוס סופי</Table.Th><Table.Th>פירוט</Table.Th></Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {filteredHistory.map((h, idx) => (
                                        <Table.Tr key={idx}>
                                            <Table.Td>{h.date}</Table.Td>
                                            <Table.Td>
                                                <Badge color={h.status === 'success' ? 'teal' : 'red'}>{h.status}</Badge>
                                            </Table.Td>
                                            <Table.Td><Text size="xs" truncate w={200} title={h.log}>{h.log}</Text></Table.Td>
                                        </Table.Tr>
                                    ))}
                                </Table.Tbody>
                            </Table>
                        )}
                    </ScrollArea>
                </Stack>
            );
        })()}
      </Modal>

{/* 7. מודאל שאילתות מאוחדות (Generic Queries) */}
      <Modal opened={appQueryModalOpen} onClose={() => setAppQueryModalOpen(false)} title={<Text fw={900} size="lg">שאילתות מאוחדות: {adminTeams.find(t => t.id === selectedApp)?.name || selectedApp} - {(selectedTechQuery || '').toUpperCase()}</Text>} size="xl" centered dir="rtl">
          {(() => {
              let mappedTech = selectedTechQuery === 'rabbit' ? 'rabbitmq' : selectedTechQuery;
              if (selectedTechQuery === 's3') mappedTech = 's3_storage';
              
              const relevantRules = rules.filter(r => 
                  (r.name || '').toLowerCase().includes(`neptune_generic_${mappedTech}_${(selectedApp || '').toLowerCase()}`) ||
                  (r.tech === selectedTechQuery && (r.application === selectedApp || r.application === 'ALL' || r.team === selectedApp) && (r.node === 'GENERIC' || r.node === 'SYS_GENERIC'))
              );

              if (relevantRules.length === 0) return <Text c="dimmed" ta="center" mt="xl">לא נמצאו חוקים מאוחדים לשילוב זה.</Text>;

              // קיבוץ כל החוקים לפי המטרה (Purpose) שלהם, ופיצול חכם של השאילתות לפי חומרה (מספרים)
              const groupedByPurpose = {};
              
              relevantRules.forEach(r => {
                  let cleanPurp = (r.purpose || r.name || 'ללא הגדרה').replace(/\b(major|critical|warning|info|%)\b/ig, '').replace(/[\(\)]/g, '').trim();
                  if (!groupedByPurpose[cleanPurp]) {
                      groupedByPurpose[cleanPurp] = { majorQueries: [], criticalQueries: [], otherQueries: [], sampleRule: r };
                  }
                  
                  // פיצול השאילתה המלאה לחלקים קטנים (כי חוק גנרי מכיל את כולם מחוברים ב-or)
                  const parts = (r.query || '').split(/(?:\s+or\s+|\n\s*or\s*\n)/i).map(p => p.trim()).filter(Boolean);
                  
                  // מיפוי לפי בסיס השאילתה (כדי למצוא מי גדול ממי)
                  const baseMap = {};
                  parts.forEach(part => {
                      const match = part.match(/(.*?)\s*(>=|<=|>|<|==|!=)\s*(.*)$/);
                      if (match && !isNaN(parseFloat(match[3]))) {
                          const base = match[1].trim();
                          if (!baseMap[base]) baseMap[base] = [];
                          baseMap[base].push({ full: part, val: parseFloat(match[3]), op: match[2] });
                      } else {
                          groupedByPurpose[cleanPurp].otherQueries.push(part);
                      }
                  });

                  // מיון והשמה לפי חומרה
                  Object.values(baseMap).forEach(arr => {
                      if (arr.length === 1) {
                          // סף בודד נחשב ל-MAJOR
                          groupedByPurpose[cleanPurp].majorQueries.push(arr[0].full);
                      } else {
                          arr.sort((a, b) => a.val - b.val);
                          if (arr[0].op.includes('>')) {
                              groupedByPurpose[cleanPurp].majorQueries.push(arr[0].full);
                              groupedByPurpose[cleanPurp].criticalQueries.push(arr[arr.length - 1].full);
                          } else if (arr[0].op.includes('<')) {
                              groupedByPurpose[cleanPurp].criticalQueries.push(arr[0].full);
                              groupedByPurpose[cleanPurp].majorQueries.push(arr[arr.length - 1].full);
                          } else {
                              groupedByPurpose[cleanPurp].majorQueries.push(arr[0].full);
                              groupedByPurpose[cleanPurp].criticalQueries.push(arr[arr.length - 1].full);
                          }
                          // כל מה שבאמצע
                          for (let i = 1; i < arr.length - 1; i++) {
                              groupedByPurpose[cleanPurp].otherQueries.push(arr[i].full);
                          }
                      }
                  });
              });

              const renderCombinedRuleCard = (purpose, queries, severityColor, severityLabel, sampleRule) => {
                  if (queries.length === 0) return null;
                  
                  // סינון כפילויות: מוודאים שכל שאילתה מופיעה רק פעם אחת לפני החיבור ב-OR
                  const uniqueQueries = [...new Set(queries.map(q => q.trim()))];
                  const combinedQuery = uniqueQueries.join('\n  or \n');
                  
                  return (
                      <Paper withBorder p="md" radius="md" bg="gray.0" mb="sm" style={{ borderRight: `5px solid ${severityColor}` }}>
                          <Group justify="space-between" mb="xs">
                              <Group gap="xs">
                                  <Text fw={800} size="lg">{purpose}</Text>
                                  {severityColor === '#fa5252' && <Badge color="red" variant="filled">CRITICAL</Badge>}
                                  {severityColor === '#fab005' && <Badge color="yellow" variant="filled">MAJOR</Badge>}
                                  {severityColor === '#339af0' && <Badge color="blue" variant="filled">INFO</Badge>}
                              </Group>

                          </Group>
                          
                          <div style={{ position: 'relative' }}>
                              <Code block color="dark.8" c="blue.4" style={{ direction: 'ltr', textAlign: 'left', whiteSpace: 'pre-wrap', paddingRight: '40px', fontSize: '14px' }}>
                                  {combinedQuery}
                              </Code>
                              <div style={{ position: 'absolute', top: '5px', right: '5px' }}>
                                  <CopyButton value={combinedQuery} timeout={2000}>
                                      {({ copied, copy }) => (
                                          <Tooltip label={copied ? 'הועתק!' : 'העתק שאילתה'} withArrow position="left">
                                              <ActionIcon color={copied ? 'teal' : 'gray'} variant="transparent" onClick={copy}>
                                                  {copied ? <IconCheck size={20} /> : <IconCopy size={20} />}
                                              </ActionIcon>
                                          </Tooltip>
                                      )}
                                  </CopyButton>
                              </div>
                          </div>
                      </Paper>
                  );
              };

              return (
                  <ScrollArea h={550} offsetScrollbars>
                      <Stack gap="xl" pb="xl">
                          {Object.entries(groupedByPurpose).map(([purpose, data], idx) => (
                              <div key={idx}>
                                  <Text fw={900} c="dark.7" mb="sm" size="xl" style={{ borderBottom: '2px solid #e9ecef', paddingBottom: '4px' }}>
                                      {purpose}
                                  </Text>
                                  {renderCombinedRuleCard(purpose, data.criticalQueries, '#fa5252', 'CRITICAL', data.sampleRule)}
                                  {renderCombinedRuleCard(purpose, data.majorQueries, '#fab005', 'MAJOR', data.sampleRule)}
                                  {renderCombinedRuleCard(purpose, data.otherQueries, '#339af0', 'INFO', data.sampleRule)}
                              </div>
                          ))}
                      </Stack>
                  </ScrollArea>
              );
          })()}
      </Modal>


      {/* 8. מודאל היסטוריה ולוגים לאקספורטר */}
      <Modal opened={exporterHistoryModal.open} onClose={() => setExporterHistoryModal({open: false, cube: null})} title={<Text fw={900} size="lg">לוגים והיסטוריית ריצות: {exporterHistoryModal.cube?.name}</Text>} centered dir="rtl" size="xl">
        {exporterHistoryModal.cube && (
            <ScrollArea h={400} offsetScrollbars>
            {!exporterHistoryModal.cube.history || exporterHistoryModal.cube.history.length === 0 ? (
                <Text c="dimmed" ta="center" mt="xl">אין עדיין היסטוריית ריצות (או לוגים) לאקספורטר זה. הריצה הבאה תתועד כאן.</Text>
            ) : (
                <Table highlightOnHover dir="rtl">
                    <Table.Thead>
                        <Table.Tr><Table.Th w={150}>תאריך שעה</Table.Th><Table.Th w={100}>סטטוס</Table.Th><Table.Th>פלט הקונסול (Logs)</Table.Th></Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {[...exporterHistoryModal.cube.history].reverse().map((h, idx) => (
                            <Table.Tr key={idx}>
                                <Table.Td style={{ whiteSpace: 'nowrap' }}>{h.date}</Table.Td>
                                <Table.Td>
                                    <Badge color={h.status === 'success' ? 'teal' : 'red'}>{h.status}</Badge>
                                </Table.Td>
                                <Table.Td>
                                    <Code block color="dark.8" c={h.status === 'success' ? 'green.4' : 'red.4'} style={{ whiteSpace: 'pre-wrap', direction: 'ltr', maxHeight: '150px', overflowY: 'auto', fontSize: '13px' }}>
                                        {h.log}
                                    </Code>
                                </Table.Td>
                            </Table.Tr>
                        ))}
                    </Table.Tbody>
                </Table>
            )}
            </ScrollArea>
        )}
      </Modal>

        {/* מודאל סורק מתקדם ומיקום בקנבס מעוצב */}
      <Modal opened={checkExistsModal.open} onClose={() => setCheckExistsModal({...checkExistsModal, open: false})} title={<Group gap="xs"><IconCrosshair color="#4c6ef5" /><Text fw={900} size="lg">סורק מתקדם: {checkExistsModal.isAutoMode ? checkExistsModal.selectedRuleName : 'בדיקה כללית'}</Text></Group>} centered dir="rtl" size="xl">
          <Stack>
              {checkExistsModal.isAutoMode ? (
                  <Text size="sm" c="dimmed">המערכת גזרה את הרכיבים הבאים ישירות מהמטריקה שרצה בפרומטאוס (לפי ה-Labels או בחירת הרכיב), ובדקה האם הם מופיעים כרגע במאגר הרכיבים של המערכת.</Text>
              ) : (
                  <>
                      <Text size="sm" c="dimmed">בחר האם להשתמש בחוק קיים מהמערכת או להזין שאילתת PromQL.</Text>
                      <Tabs value={checkExistsModal.inputType} onChange={(val) => setCheckExistsModal({...checkExistsModal, inputType: val})} color="indigo" radius="md">
                          <Tabs.List grow>
                              <Tabs.Tab value="rule" leftSection={<IconListDetails size={16} />}>בחר חוק מהמערכת</Tabs.Tab>
                              <Tabs.Tab value="promql" leftSection={<IconCode size={16} />}>הזן שאילתת PromQL</Tabs.Tab>
                          </Tabs.List>
                          <Tabs.Panel value="rule" pt="md">
                              <Select label="בחר חוק ניטור קיים" placeholder="חפש חוק..." searchable data={rules.filter(r => r.query || r.queryMajor).map(r => ({value: r.id, label: `${r.name} (${r.tech || 'כללי'})`}))} value={checkExistsModal.selectedRuleId} onChange={(v) => setCheckExistsModal({...checkExistsModal, selectedRuleId: v})} />
                          </Tabs.Panel>
                          <Tabs.Panel value="promql" pt="md">
                              <Textarea label="שאילתת PromQL" placeholder='לדוגמה: up{job="my-app"} == 0' value={checkExistsModal.promqlQuery} onChange={(e) => setCheckExistsModal({...checkExistsModal, promqlQuery: e.currentTarget.value})} dir="ltr" minRows={4} styles={{ input: { fontFamily: 'monospace' } }} />
                          </Tabs.Panel>
                      </Tabs>
                      <Paper withBorder p="md" bg="indigo.0" style={{ borderColor: '#bac8ff' }}>
                          <Grid align="flex-end">
                              <Grid.Col span={8}>
                                  <TextInput label="תבנית חילוץ לייבלים (Mapping Template)" placeholder="לדוגמה: {{$labels.vhost}}-{{$labels.queue}}" value={checkExistsModal.mappingTemplate} onChange={(e) => setCheckExistsModal({...checkExistsModal, mappingTemplate: e.currentTarget.value})} dir="ltr" styles={{ input: { fontFamily: 'monospace', fontWeight: 600 } }} />
                              </Grid.Col>
                              <Grid.Col span={4}>
                                  <Button fullWidth color="indigo" onClick={() => handleRunCheckExists()} loading={checkExistsModal.loading}>בדוק האם קיימים במסלולים</Button>
                              </Grid.Col>
                          </Grid>
                      </Paper>
                  </>
              )}
              
              {checkExistsModal.loading ? (
                  <Center h={150}><Stack align="center"><Loader size="lg" color="blue" /><Text fw={700}>מנתח נתונים מהפרומטאוס ומצליב מול הארכיטקטורה...</Text></Stack></Center>
              ) : checkExistsModal.results && (
                  <Paper withBorder p="0" radius="md" mt="xs" style={{ overflow: 'hidden' }}>
                      <Table striped highlightOnHover verticalSpacing="md">
                          <Table.Thead bg="blue.1">
                              <Table.Tr>
                                  <Table.Th w={50}></Table.Th>
                                  <Table.Th><Text fw={800} c="blue.9">שם הרכיב (שנגזר או הוגדר)</Text></Table.Th>
                                  <Table.Th><Text fw={800} c="blue.9">סטטוס צימוד למאגר</Text></Table.Th>
                                  <Table.Th ta="center"><Text fw={800} c="blue.9">פעולה</Text></Table.Th>
                              </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                              {checkExistsModal.results.map((r, i) => (
                                  <Table.Tr key={i}>
                                      <Table.Td>
                                          {r.hasNode ? <IconCheck color="teal" size={24} /> : r.color === 'orange' ? <IconAlertTriangle color="orange" size={24} /> : <IconX color="red" size={24} />}
                                      </Table.Td>
                                      <Table.Td>
                                          <Text fw={900} size="md" dir="ltr" ta="left" c="dark.8">{r.name}</Text>
                                          <Text size="xs" c="dimmed" mt={4}>{r.reason}</Text>
                                      </Table.Td>
                                      <Table.Td>
                                          <Badge color={r.color} variant="light" size="lg">{r.title}</Badge>
                                      </Table.Td>
                                      <Table.Td ta="center">
                                          {r.hasNode ? (
                                              <Badge color="blue" variant="light">רכיב מוכר</Badge>
                                          ) : (
                                              <Text size="xs" c="dimmed">לא ניתן לאתר</Text>
                                          )}
                                      </Table.Td>
                                  </Table.Tr>
                              ))}
                          </Table.Tbody>
                      </Table>
                  </Paper>
              )}
          </Stack>
      </Modal>

      {/* ================= המודאלים הויזואליים החדשים ================= */}

      {/* ================= עורך התצורה המאוחד: שדות וחוקים פר טכנולוגיה ================= */}
      <Modal opened={unifiedUIOpen} onClose={() => setUnifiedUIOpen(false)} title={<Text fw={900} size="xl" c="blue.9">עורך תצורה מערכתי ויזואלי</Text>} size="90%" centered dir="rtl" bg="gray.0">
          
          <Group grow mb="xl" align="flex-end">
              <Select 
                  label="בחר טכנולוגיה לעריכה" 
                  data={localTechs.map(t => ({ value: t.value, label: `${t.label} (${t.value})` }))} 
                  value={activeUnifiedTech} 
                  onChange={setActiveUnifiedTech} 
                  searchable
                  size="md"
              />
              <Button size="md" variant="outline" color="teal" onClick={() => {
                  const newVal = prompt("הזן מזהה לטכנולוגיה חדשה (באנגלית, למשל: kafka):");
                  const newLabel = prompt("הזן שם תצוגה לטכנולוגיה (למשל: Kafka Cluster):");
                  if (newVal && newLabel) {
                      setLocalTechs([...localTechs, { value: newVal, label: newLabel, icon: 'server', metricType: 'custom', labelTemplate: '{name}', fields: [], thresholds: [] }]);
                      setLocalTemplates({...localTemplates, [newVal]: []});
                      setActiveUnifiedTech(newVal);
                  }
              }}>
                  <IconPlus size={18} style={{ marginLeft: '8px' }}/> פתח טכנולוגיה חדשה
              </Button>
          </Group>

          {activeUnifiedTech && (() => {
              const activeTechIndex = localTechs.findIndex(t => t.value === activeUnifiedTech);
              const techData = localTechs[activeTechIndex];
              const rulesData = localTemplates[activeUnifiedTech] || [];
              let mappedTech = activeUnifiedTech === 'rabbit' ? 'rabbitmq' : (activeUnifiedTech === 's3' ? 's3_storage' : activeUnifiedTech);

              if(!techData) return null;

              return (
                  <ScrollArea h="65vh" offsetScrollbars>
                      <Stack gap="xl" pb="xl" pr="sm">
                          
                          {/* חלק 1: שדות נדרשים ליצירה */}
                          <Paper withBorder p="md" shadow="sm" radius="md" style={{ borderRight: '6px solid #20c997' }}>
                              <Group justify="space-between" mb="md">
                                  <Stack gap={0}>
                                      <Text fw={900} size="lg" c="teal.9">1. שדות נדרשים ליצירה (Variables)</Text>
                                      <Text size="sm" c="dimmed">שדות אלו יוצגו למשתמש. ה-KEY משמש כמשתנה (למשל {'{{KEY}}'}) בתוך השאילתות למטה.</Text>
                                  </Stack>
                                  <ActionIcon color="teal" variant="light" size="lg" onClick={() => {
                                      const upd = [...localTechs];
                                      if(!upd[activeTechIndex].fields) upd[activeTechIndex].fields = [];
                                      upd[activeTechIndex].fields.push({ name: 'new_key', label: 'שדה חדש' });
                                      setLocalTechs(upd);
                                  }}><IconPlus size={20}/></ActionIcon>
                              </Group>
                              
                              <Stack gap="xs">
                                  {(techData.fields || []).length === 0 && <Text c="dimmed" size="sm">לא הוגדרו שדות (הרכיב ישתמש ב-Label בלבד).</Text>}
                                  {(techData.fields || []).map((f, fIdx) => (
                                      <Group key={fIdx} wrap="nowrap" align="flex-end" bg="gray.0" p="xs" style={{ borderRadius: '8px', border: '1px solid #dee2e6' }}>
                                          <TextInput size="sm" label="KEY פנימי (לשימוש בשאילתה)" value={f.name} onChange={(e) => { const upd = [...localTechs]; upd[activeTechIndex].fields[fIdx].name = e.currentTarget.value; setLocalTechs(upd); }} />
                                          <TextInput size="sm" label="שם תצוגה למשתמש" value={f.label} style={{ flexGrow: 1 }} onChange={(e) => { const upd = [...localTechs]; upd[activeTechIndex].fields[fIdx].label = e.currentTarget.value; setLocalTechs(upd); }} />
                                          <ActionIcon color="red" variant="subtle" onClick={() => {
                                              const upd = [...localTechs];
                                              upd[activeTechIndex].fields.splice(fIdx, 1);
                                              setLocalTechs(upd);
                                          }}><IconTrash size={18}/></ActionIcon>
                                      </Group>
                                  ))}
                              </Stack>
                          </Paper>

                          {/* חלק 2: חוקים מאוחדים */}
                          <Paper withBorder p="md" shadow="sm" radius="md" style={{ borderRight: '6px solid #ae3ec9' }}>
                              <Group justify="space-between" mb="md">
                                  <Stack gap={0}>
                                      <Text fw={900} size="lg" c="grape.9">2. חוקים ותבניות ניטור (Templates)</Text>
                                      <Text size="sm" c="dimmed">כל בלוק מייצג מטרה אחת ומכיל את התנאים ל-MAJOR ול-CRITICAL, כולל ספים דיפולטיביים.</Text>
                                  </Stack>
                                  <Button variant="light" color="grape" onClick={() => {
                                      if (!['rabbit', 'rabbitmq'].includes(activeUnifiedTech)) {
                                          alert('ניתן להוסיף ניטור תשתיתי (חוקים מאוחדים) רק ל-RabbitMQ.');
                                          return;
                                      }
                                      const updated = {...localTemplates};
                                      if(!updated[activeUnifiedTech]) updated[activeUnifiedTech] = [];
                                      updated[activeUnifiedTech].push({ ruleName: "", purpose: "התראה חדשה", majorQuery: "", criticalQuery: "", majorDefault: "", criticalDefault: "" });
                                      setLocalTemplates(updated);
                                  }}>
                                      <IconPlus size={16} style={{ marginLeft: '8px' }}/> הוסף חוק מאוחד
                                  </Button>
                              </Group>

                              <Stack gap="lg">
                                  {rulesData.length === 0 && <Text c="dimmed" size="sm">לא הוגדרו חוקים לטכנולוגיה זו.</Text>}
                                  {rulesData.map((tpl, idx) => {
                                      return (
                                          <Paper key={idx} withBorder p="md" radius="md" bg="gray.0">
                                              <Group justify="space-between" mb="sm">
                                                  <Badge color="grape" size="lg" variant="filled">חוק {idx + 1}</Badge>
                                                  <ActionIcon color="red" variant="subtle" onClick={() => {
                                                      if(!window.confirm("למחוק חוק זה?")) return;
                                                      const updated = {...localTemplates};
                                                      updated[activeUnifiedTech].splice(idx, 1);
                                                      setLocalTemplates(updated);
                                                  }}><IconTrash size={18} /></ActionIcon>
                                              </Group>
                                              
                                              <Grid mb="sm">
                                                  <Grid.Col span={6}>
                                                      <TextInput 
                                                          label="שם חוק באנגלית (Rule Name)" 
                                                          placeholder={`ברירת מחדל: neptune_generic_${mappedTech}_{$team}_...`}
                                                          value={tpl.ruleName || ''} 
                                                          onChange={(e) => {
                                                              const updated = {...localTemplates};
                                                              updated[activeUnifiedTech][idx].ruleName = e.currentTarget.value;
                                                              setLocalTemplates(updated);
                                                          }} 
                                                          dir="ltr"
                                                      />
                                                  </Grid.Col>
                                                  <Grid.Col span={6}>
                                                      <TextInput 
                                                          label="מטרת החוק ותיאור (Purpose)" 
                                                          placeholder="למשל: שימוש גבוה ב-CPU"
                                                          value={tpl.purpose} 
                                                          onChange={(e) => {
                                                              const updated = {...localTemplates};
                                                              updated[activeUnifiedTech][idx].purpose = e.currentTarget.value;
                                                              setLocalTemplates(updated);
                                                          }} 
                                                      />
                                                  </Grid.Col>
                                              </Grid>

                                              {/* MAJOR */}
                                              <Paper p="sm" bg="yellow.0" radius="sm" style={{ border: '1px solid #fcc419' }} mb="xs">
                                                  <Grid align="center">
                                                      <Grid.Col span={9}>
                                                          <Textarea 
                                                              label={<Text size="sm" fw={800} c="yellow.9">שאילתת אזהרה (MAJOR)</Text>}
                                                              placeholder="לדוגמה: metric > {{majorThreshold}}" 
                                                              value={tpl.majorQuery} 
                                                              minRows={2} dir="ltr"
                                                              styles={{ input: { fontFamily: 'monospace', fontWeight: 600 } }}
                                                              onChange={(e) => {
                                                                  const updated = {...localTemplates};
                                                                  updated[activeUnifiedTech][idx].majorQuery = e.currentTarget.value;
                                                                  setLocalTemplates(updated);
                                                              }} 
                                                          />
                                                      </Grid.Col>
                                                      <Grid.Col span={3}>
                                                          <TextInput 
                                                              label="סף MAJOR דיפולטיבי" 
                                                              placeholder="למשל: 80"
                                                              value={tpl.majorDefault}
                                                              onChange={(e) => {
                                                                  const updated = {...localTemplates};
                                                                  updated[activeUnifiedTech][idx].majorDefault = e.currentTarget.value;
                                                                  setLocalTemplates(updated);
                                                              }}
                                                          />
                                                      </Grid.Col>
                                                  </Grid>
                                              </Paper>

                                              {/* CRITICAL */}
                                              <Paper p="sm" bg="red.0" radius="sm" style={{ border: '1px solid #ffa8a8' }}>
                                                  <Grid align="center">
                                                      <Grid.Col span={9}>
                                                          <Textarea 
                                                              label={<Text size="sm" fw={800} c="red.9">שאילתה קריטית (CRITICAL)</Text>}
                                                              placeholder="לדוגמה: metric > {{criticalThreshold}}" 
                                                              value={tpl.criticalQuery} 
                                                              minRows={2} dir="ltr"
                                                              styles={{ input: { fontFamily: 'monospace', fontWeight: 600 } }}
                                                              onChange={(e) => {
                                                                  const updated = {...localTemplates};
                                                                  updated[activeUnifiedTech][idx].criticalQuery = e.currentTarget.value;
                                                                  setLocalTemplates(updated);
                                                              }} 
                                                          />
                                                      </Grid.Col>
                                                      <Grid.Col span={3}>
                                                          <TextInput 
                                                              label="סף CRITICAL דיפולטיבי" 
                                                              placeholder="למשל: 95"
                                                              value={tpl.criticalDefault}
                                                              onChange={(e) => {
                                                                  const updated = {...localTemplates};
                                                                  updated[activeUnifiedTech][idx].criticalDefault = e.currentTarget.value;
                                                                  setLocalTemplates(updated);
                                                              }}
                                                          />
                                                      </Grid.Col>
                                                  </Grid>
                                              </Paper>

                                          </Paper>
                                      );
                                  })}
                              </Stack>
                          </Paper>
                          
                          <Button color="red" mt="lg" variant="light" leftSection={<IconTrash size={16}/>} onClick={() => {
                              if(!window.confirm(`בטוח שברצונך למחוק לחלוטין את הטכנולוגיה ${activeUnifiedTech}? (כולל כל השדות והחוקים שלה)`)) return;
                              const updTechs = localTechs.filter(t => t.value !== activeUnifiedTech);
                              const updTpls = {...localTemplates};
                              delete updTpls[activeUnifiedTech];
                              setLocalTechs(updTechs);
                              setLocalTemplates(updTpls);
                              setActiveUnifiedTech(updTechs.length > 0 ? updTechs[0].value : null);
                          }}>
                              מחק טכנולוגיה זו לחלוטין
                          </Button>
                      </Stack>
                  </ScrollArea>
              );
          })()}
    
          <Group justify="flex-end" mt="xl" style={{ borderTop: '1px solid #dee2e6', paddingTop: '15px' }}>
              <Button color="blue" size="lg" leftSection={<IconCheck size={18}/>} onClick={() => {
                  // ממירים חזרה למבנה השטוח שנוסע ל-DB (שמירת הספים הדיפולטיביים בתוך אובייקט ה-Template)
                  const flatTpls = {};
                  for (const tech in localTemplates) {
                      flatTpls[tech] = [];
                      localTemplates[tech].forEach((uTpl, idx) => {
                          const cleanId = uTpl.purpose.replace(/[^a-zA-Z0-9א-ת]/g, '_').toLowerCase() || `rule_${idx}`;
                          
                          if (uTpl.majorQuery && uTpl.majorQuery.trim() !== '') {
                              flatTpls[tech].push({
                                  suffix: `${cleanId}_major`,
                                  customRuleName: uTpl.ruleName,
                                  purpose: uTpl.purpose,
                                  query: uTpl.majorQuery,
                                  defaultThreshold: uTpl.majorDefault // שמירת הסף
                              });
                          }
                          if (uTpl.criticalQuery && uTpl.criticalQuery.trim() !== '') {
                              flatTpls[tech].push({
                                  suffix: `${cleanId}_critical`,
                                  customRuleName: uTpl.ruleName,
                                  purpose: uTpl.purpose,
                                  query: uTpl.criticalQuery,
                                  defaultThreshold: uTpl.criticalDefault // שמירת הסף
                              });
                          }
                      });
                  }

                  setAdminTechsStr(JSON.stringify(localTechs, null, 2));
                  setAdminGenericTemplatesStr(JSON.stringify(flatTpls, null, 2));
                  setUnifiedUIOpen(false);
              }}>
                 אשר וסגור עורך (לא לשכוח לשמור שינויים ל-DB במסך הראשי)
        </Button>
    </Group>
</Modal>

      </AppShell>
    );
}