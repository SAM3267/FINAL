import { useState, useEffect } from 'react';
import axios from 'axios';
import { AppShell, Container, Paper, Group, Title, Text, Button, TextInput, Stack, Tabs, SimpleGrid, Card, CopyButton, Code, ActionIcon, Select, Badge, Modal, Grid, Center, Loader, Table, ScrollArea, Accordion, Image, PasswordInput, Textarea, List, NumberInput, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconSitemap, IconFileText, IconShield, IconRocket, IconRadar, IconAppWindow, IconTerminal2, IconCopy, IconCheck, IconFilter, IconServer, IconSettings, IconTrash, IconPlus, IconDeviceFloppy, IconBook, IconSchool, IconReportAnalytics, IconFolder, IconPlayerPlay, IconHistory, IconCode, IconChartLine, IconArrowDownCircle } from '@tabler/icons-react';
import RulesTable from './RulesTable';
import { AddRuleModal } from './AddRuleModal';
import { HistoryDrawer } from './HistoryDrawer';
import ArchitectureCanvas from './ArchitectureCanvas';
import bgDashboard from '../assets/background_dashbord.png';
import s3Icon from '../assets/iconsTech/s3.png';
import mongoIcon from '../assets/iconsTech/mongo.png';
import { API_BASE_URL } from '../config'; 


import iconLogs from '../assets/iconNitur/logs.webp';
import iconMessages from '../assets/iconNitur/messages.png';
import iconStorage from '../assets/iconNitur/storage.png';
import iconCustom from '../assets/iconNitur/custom.png';

const iconMap = {
  IconShield: <IconShield size={32} color="#1c7ed6" />,
  IconRocket: <IconRocket size={32} color="#f59f00" />,
  IconRadar: <IconRadar size={32} color="#e03131" />,
  IconServer: <IconServer size={32} color="#40c057" />
};

export const getNiturIconSrc = (tech) => {
  if (tech === 'elastic_log') return iconLogs;
  if (tech === 'CUSTOM') return iconCustom;
  if (['rabbit', 'nifi'].includes(tech)) return iconMessages;
  return iconStorage;
};

export default function Dashboard({ onLogout, username, userRole: initialRole }) {
  const [currentRole, setCurrentRole] = useState(initialRole || 'admin');

  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [rules, setRules] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [filterTeam, setFilterTeam] = useState(null);
  const [filterTech, setFilterTech] = useState(null);

  const [editingRule, setEditingRule] = useState(null);
  const [historyOpened, setHistoryOpened] = useState(false);
  const [selectedRuleForHistory, setSelectedRuleForHistory] = useState(null);
  
  const [activeTab, setActiveTab] = useState('rules');
  const [selectedArchTeam, setSelectedArchTeam] = useState(null);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [focusedNodeId, setFocusedNodeId] = useState(null);

  const [selectedTechQuery, setSelectedTechQuery] = useState('rabbit');
  const [selectedApp, setSelectedApp] = useState(null);
  const [appQueryModalOpen, setAppQueryModalOpen] = useState(false);

  const [sysConfig, setSysConfig] = useState(null);

  const [adminTeams, setAdminTeams] = useState([]);
  const [adminApps, setAdminApps] = useState([]);
  const [adminTechsStr, setAdminTechsStr] = useState('[]');
  const [adminRolesStr, setAdminRolesStr] = useState('{}');
  const [adminOcpStr, setAdminOcpStr] = useState('{}');
  const [adminLearnUrl, setAdminLearnUrl] = useState('');
  
  const [newTeamId, setNewTeamId] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [newApp, setNewApp] = useState('');

  const [editingTeamIndex, setEditingTeamIndex] = useState(null);
  const [newTrackId, setNewTrackId] = useState('');
  const [newTrackName, setNewTrackName] = useState('');

  const [ocpForms, setOcpForms] = useState({ OS: {user:'', pass:''}, NEXT: {user:'', pass:''}, AMRICA: {user:'', pass:''} });
  const [ocpLogModal, setOcpLogModal] = useState({ open: false, logs: [] });

  const [adminEditorModal, setAdminEditorModal] = useState({ opened: false, title: '', field: '' });
  const [adminJsonError, setAdminJsonError] = useState(null);

  const [summaryModal, setSummaryModal] = useState({ opened: false, type: null, team: null, track: null });

  // Automations states
  const [folders, setFolders] = useState([]);
  const [automations, setAutomations] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [autoModalOpen, setAutoModalOpen] = useState(false);
  
  const [autoForm, setAutoForm] = useState({ name: '', metric_query: '', operator: '>', threshold: 0, python_code: '' });
  const [promqlModalOpen, setPromqlModalOpen] = useState(false);
  const [pythonModalOpen, setPythonModalOpen] = useState(false);
  
  const [promqlGraphData, setPromqlGraphData] = useState([]);
  const [isGraphLoading, setIsGraphLoading] = useState(false);
  const [pythonTestOutput, setPythonTestOutput] = useState('');
  const [isPythonError, setIsPythonError] = useState(false);
  const [autoHistoryModal, setAutoHistoryModal] = useState({ open: false, auto: null });

  const [autoGraphStartTime, setAutoGraphStartTime] = useState('');
  const [autoGraphEndTime, setAutoGraphEndTime] = useState('');
  const [autoHoverPoint, setAutoHoverPoint] = useState(null);
  const toLocalISO = (d) => (new Date(d - (new Date()).getTimezoneOffset() * 60000)).toISOString().slice(0, 16);

  useEffect(() => {
    if (promqlModalOpen && !autoGraphStartTime) {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        setAutoGraphStartTime(toLocalISO(oneHourAgo));
        setAutoGraphEndTime(toLocalISO(now));
    }
  }, [promqlModalOpen]);

  const fetchConfig = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/config`);
      setSysConfig(res.data);
      setAdminTeams(res.data.teams || []);
      setAdminApps(res.data.apps || []);
      setAdminTechsStr(JSON.stringify(res.data.techs || [], null, 2));
      setAdminRolesStr(JSON.stringify(res.data.roles || {}, null, 2));
      setAdminOcpStr(JSON.stringify(res.data.ocp_envs || {}, null, 2));
      setAdminLearnUrl(res.data.learn_url || '');
    } catch (error) { console.error('Error fetching config from ETCD:', error); }
  };

  const fetchRules = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/rules`);
      setRules(response.data);
    } catch (error) { console.error('Error fetching rules:', error); }
  };

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

  useEffect(() => { 
    fetchConfig();
    fetchRules(); 
    fetchAutomationsData();
  }, [username]);

  const handleInitEtcd = async () => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/init-etcd`);
      alert(response.data.message);
      fetchConfig(); 
    } catch (error) {
      alert('שגיאה באתחול ETCD: ' + (error.response?.data?.detail || error.message));
    }
  };

  const saveAdminConfigToEtcd = async () => {
    try {
      await axios.post(`${API_BASE_URL}/api/config`, {
        teams: adminTeams,
        apps: adminApps,
        techs: JSON.parse(adminTechsStr),
        roles: JSON.parse(adminRolesStr),
        ocp_envs: JSON.parse(adminOcpStr),
        learn_url: adminLearnUrl,
        admins: sysConfig.admins || []
      });
      alert("תצורות המערכת נשמרו ב-ETCD בהצלחה!");
      fetchConfig();
    } catch (error) {
      alert("שגיאה בשמירת התצורות. ודא שכל שדות ה-JSON תקינים לחלוטין.");
    }
  };

  const validateAndCloseAdminModal = () => {
    try {
        if (adminEditorModal.field === 'roles') JSON.parse(adminRolesStr);
        if (adminEditorModal.field === 'ocp') JSON.parse(adminOcpStr);
        if (adminEditorModal.field === 'techs') JSON.parse(adminTechsStr);
        
        setAdminEditorModal({ opened: false, title: '', field: '' });
        setAdminJsonError(null);
    } catch (err) {
        setAdminJsonError("שגיאת JSON - פורמט לא חוקי: " + err.message);
    }
  };

  const handleAdminJsonChange = (val) => {
    setAdminJsonError(null);
    if (adminEditorModal.field === 'roles') setAdminRolesStr(val);
    if (adminEditorModal.field === 'ocp') setAdminOcpStr(val);
    if (adminEditorModal.field === 'techs') setAdminTechsStr(val);
  };

  const handleGrantOCP = async (clusterKey) => {
    const creds = ocpForms[clusterKey];
    if(!creds.user || !creds.pass) return alert("הזן שם משתמש וסיסמא");
    try {
      const res = await axios.post(`${API_BASE_URL}/api/ocp/grant`, { cluster: clusterKey, target_user: creds.user, target_password: creds.pass });
      setOcpLogModal({ open: true, logs: res.data.log });
    } catch(e) { alert("שגיאה בהפעלת הסקריפט"); }
  };

  const handleDeleteTrack = async (teamIdx, trackIdx) => {
    if (!window.confirm('מחיקת המסלול תמחק את כל החוקים המשויכים אליו, ואת הרכיבים שבו. חוקים גנריים שנסמכו עליו יתעדכנו. האם להמשיך?')) return;
    const team = adminTeams[teamIdx];
    const track = team.tracks[trackIdx];
    
    try {
      const trackRules = rules.filter(r => r.track_id === track.id);
      const ruleIds = trackRules.map(r => r.id);
      if (ruleIds.length > 0) {
        await axios.post(`${API_BASE_URL}/rules/bulk-delete`, { ids: ruleIds });
      }
      
      await axios.delete(`${API_BASE_URL}/architecture/${team.id}/${track.id}`);
      
      const newTeams = JSON.parse(JSON.stringify(adminTeams));
      newTeams[teamIdx].tracks.splice(trackIdx, 1);
      setAdminTeams(newTeams);
      fetchRules();
      alert(`המסלול ${track.name} והחוקים הייעודיים שלו נמחקו. שמור ל-ETCD כדי לסיים.`);
    } catch(e) {
      alert("שגיאה במחיקת המסלול.");
    }
  };

  const handleCreateFolder = async () => {
    if(!newFolderName) return;
    await axios.post(`${API_BASE_URL}/api/automations/folders`, { name: newFolderName });
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
    if(!autoForm.name || !autoForm.metric_query || !autoForm.python_code || !selectedFolderId) return;
    await axios.post(`${API_BASE_URL}/api/automations`, { ...autoForm, folder_id: selectedFolderId });
    setAutoModalOpen(false);
    setAutoForm({ name: '', metric_query: '', operator: '>', threshold: 0, python_code: '' });
    fetchAutomationsData();
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
      if(promqlGraphData.length === 0) return <Text c="dimmed" ta="center" mt="xl">אין נתונים להצגה. בחר זמנים ולחץ 'הצג בדיקת טריגר'.</Text>;
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
                  <Paper p="xs" radius="sm" bg="dark.8" style={{ position: 'absolute', left: `calc(${autoHoverPoint.xPercentage}% + 10px)`, top: '10%', border: '1px solid #495057', pointerEvents: 'none', transform: autoHoverPoint.xPercentage > 80 ? 'translateX(-120%)' : 'none', zIndex: 100 }}>
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

  const handleTabChange = (val) => { setActiveTab(val); };

  const handleNavigateToNode = (rule) => {
    const team = adminTeams.find(t => t.id === rule.application || t.name === rule.team);
    if (!team) return alert("לא ניתן לאתר את הצוות המשויך לחוק זה.");
    let track = null;
    if (rule.track_id) track = team.tracks?.find(t => t.id === rule.track_id);
    if (!track && team.tracks?.length > 0) track = team.tracks[0];
    
    if (track) { setSelectedArchTeam(team); setSelectedTrack(track); } 
    else { setSelectedArchTeam(team); }
    
    setActiveTab('routes');
    if (rule.node) setFocusedNodeId(rule.node);
    else if (rule.tech) setFocusedNodeId({ tech: rule.tech });
  };

  const handleDeleteRule = async (ruleId) => {
    if (!window.confirm('מחיקה? הנתונים יסתנכרנו בכל רחבי המערכת באופן מיידי.')) return;
    try { 
      await axios.delete(`${API_BASE_URL}/rules/${ruleId}`); 
      fetchRules();
    } catch (error) { console.error('Error deleting rule', error); }
  };

  const handleBulkDelete = async (selectedIds) => {
      if (!window.confirm(`האם אתה בטוח שברצונך למחוק ${selectedIds.length} חוקים? (הפעולה תסיר אותם גם מהרכיבים)`)) return;
      try {
          await axios.post(`${API_BASE_URL}/rules/bulk-delete`, { ids: selectedIds });
          fetchRules();
      } catch (e) { alert("שגיאה במחיקה הרוחבית"); }
  };

  const handleSaveRule = async (values) => {
    try {
      const payload = { ...values, user: username };
      if (editingRule && editingRule.id) { await axios.put(`${API_BASE_URL}/rules/${editingRule.id}`, payload); } 
      else { await axios.post(`${API_BASE_URL}/rules`, payload); }
      fetchRules(); 
      handleCloseModal();
    } catch (error) { console.error('Error saving rule:', error); }
  };

  const handleRestore = async (ruleId, historicalVersion) => {
    if (!window.confirm(`לשחזר לגרסה ${historicalVersion.version}?`)) return;
    try {
      const payload = { ...historicalVersion, user: `${username} (שחזור)` };
      delete payload.version; delete payload.date;
      await axios.put(`${API_BASE_URL}/rules/${ruleId}`, payload);
      fetchRules(); setHistoryOpened(false);
    } catch (error) { alert("השחזור נכשל"); }
  };

  const handleEditClick = (rule) => { setEditingRule(rule); openModal(); };
  const handleHistoryClick = (rule) => { setSelectedRuleForHistory(rule); setHistoryOpened(true); };
  const handleCloseModal = () => { setEditingRule(null); closeModal(); };

  const getGenericQuery = (tech, appName, suffix) => {
    let mappedTech = tech;
    if (tech === 'rabbit') mappedTech = 'rabbitmq'; 
    const ruleName = `neptune_generic_${mappedTech}_${appName}_${suffix}`.toLowerCase();
    const rule = rules.find(r => r.name.toLowerCase() === ruleName);
    return rule ? rule.query : 'לא הוגדרו חוקים (או רכיבים) לאפליקציה זו.';
  };

  const parseGenericQuery = (query) => {
    if (!query) return [];
    const parts = query.split(/\s+or\s+/);
    const components = [];
    parts.forEach(p => {
        const match = p.match(/\{([^}]+)\}\s*>=\s*(\d+(?:\.\d+)?)/);
        if (match) components.push({ labels: match[1], threshold: match[2] });
    });
    return components;
  };

  const handleDownload = (type) => {
      alert(`הורדת ${type} החלה.`);
  };

  const renderSummaryContent = () => {
    if (!summaryModal.team) return null;
    const teamRules = rules.filter(r => r.application === summaryModal.team.id || r.team === summaryModal.team.name);
    const genericRules = teamRules.filter(r => r.name.startsWith('neptune_generic_'));

    const renderGenericRulesSection = () => {
        if(genericRules.length === 0) return null;
        return (
            <Paper withBorder p="md" bg="blue.0" radius="md" mb="lg">
                <Text fw={700} size="lg" mb="sm" c="blue.9">חוקים גנריים (פרוסים על כל הרכיבים בצוות)</Text>
                <Accordion variant="separated">
                    {genericRules.map((rule, idx) => {
                        const parsed = parseGenericQuery(rule.query);
                        const isCritical = rule.name.includes('critical');
                        const itemVal = rule.id || `${rule.name}-${idx}`;
                        return (
                            <Accordion.Item key={itemVal} value={itemVal}>
                                <Accordion.Control>
                                    <Group gap="xs">
                                        <Image src={getNiturIconSrc(rule.tech)} w={20} h={20}/>
                                        <Text fw={700}>{rule.name}</Text>
                                        <Badge size="xs" color={isCritical ? 'red' : 'yellow'}>{isCritical ? 'CRITICAL' : 'MAJOR'}</Badge>
                                    </Group>
                                </Accordion.Control>
                                <Accordion.Panel>
                                    {parsed.length === 0 ? <Text c="dimmed">אין רכיבים מוגדרים.</Text> : (
                                        <List spacing="xs" size="sm" center>
                                            {parsed.map((p, i) => (
                                                <List.Item key={i}>
                                                    <Group gap="xs">
                                                        <Badge color="gray" variant="outline">{p.labels}</Badge>
                                                        <Text size="sm">סף הפעלה: <Text span fw={700} c={isCritical ? 'red.6' : 'yellow.6'}>{p.threshold}</Text></Text>
                                                    </Group>
                                                </List.Item>
                                            ))}
                                        </List>
                                    )}
                                </Accordion.Panel>
                            </Accordion.Item>
                        );
                    })}
                </Accordion>
            </Paper>
        );
    };

    if (summaryModal.type === 'track' && summaryModal.track) {
        const trackRules = teamRules.filter(r => r.track_id === summaryModal.track.id);
        return (
            <Stack>
                {renderGenericRulesSection()}
                <Text fw={700} size="lg" mb="sm" c="blue.9">ניטורים ייעודיים למסלול {summaryModal.track.name}</Text>
                {trackRules.length === 0 ? <Text c="dimmed" ta="center">לא נמצאו ניטורים ייעודיים למסלול זה.</Text> : (
                    <Table highlightOnHover dir="rtl">
                      <Table.Thead><Table.Tr><Table.Th>שם חוק</Table.Th><Table.Th>טכנולוגיה</Table.Th><Table.Th>מטרה/השפעה</Table.Th></Table.Tr></Table.Thead>
                      <Table.Tbody>
                        {trackRules.map(r => (
                          <Table.Tr key={r.id}>
                            <Table.Td>
                              <Group gap="xs">
                                <Image src={getNiturIconSrc(r.tech)} w={20} h={20} />
                                <Text fw={700}>{r.name}</Text>
                              </Group>
                            </Table.Td>
                            <Table.Td><Badge color="blue" variant="light">{r.tech}</Badge></Table.Td>
                            <Table.Td>{r.purpose || r.operationalImpact || '-'}</Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                )}
            </Stack>
        );
    }

    if (summaryModal.type === 'team') {
        const tracks = summaryModal.team.tracks || [];
        return (
            <Stack gap="xl">
                {renderGenericRulesSection()}
                <Text fw={700} size="lg" mb="sm" c="blue.9">ניטורים לפי תתי-מסלולים</Text>
                {tracks.length === 0 ? <Text c="dimmed" ta="center">לא הוגדרו מסלולים בצוות זה.</Text> : (
                    tracks.map(track => {
                        const trackRules = teamRules.filter(r => r.track_id === track.id);
                        return (
                            <Paper key={track.id} withBorder p="md" bg="gray.0" radius="md">
                                <Text fw={700} mb="md" c="dark">{track.name} ({trackRules.length} ניטורים)</Text>
                                {trackRules.length === 0 ? <Text c="dimmed" size="sm">אין ניטורים במסלול זה.</Text> : (
                                    <Table highlightOnHover dir="rtl" size="sm">
                                      <Table.Thead><Table.Tr><Table.Th>שם חוק</Table.Th><Table.Th>טכנולוגיה</Table.Th></Table.Tr></Table.Thead>
                                      <Table.Tbody>
                                        {trackRules.map(r => (
                                          <Table.Tr key={r.id}>
                                            <Table.Td>
                                              <Group gap="xs">
                                                <Image src={getNiturIconSrc(r.tech)} w={16} h={16} />
                                                <Text size="sm" fw={600}>{r.name}</Text>
                                              </Group>
                                            </Table.Td>
                                            <Table.Td><Badge size="sm" color="blue" variant="light">{r.tech}</Badge></Table.Td>
                                          </Table.Tr>
                                        ))}
                                      </Table.Tbody>
                                    </Table>
                                )}
                            </Paper>
                        );
                    })
                )}
            </Stack>
        );
    }
    return null;
  };

  if (!sysConfig) return <Center style={{ height: '100vh', backgroundImage: `url(${bgDashboard})`, backgroundSize: 'cover' }}><Loader size="xl" color="blue" /></Center>;

  const uniqueTeams = sysConfig.teams.map(t => t.name);
  const uniqueTechs = sysConfig.techs.map(t => t.value);

  const filteredRules = rules.filter((rule) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = Object.values(rule).some(value => typeof value === 'string' && value.toLowerCase().includes(searchLower)) || rule.history?.some(h => h.user.toLowerCase().includes(searchLower));
    const matchesTeam = filterTeam ? rule.team === filterTeam : true;
    const matchesTech = filterTech ? rule.tech === filterTech : true;
    return matchesSearch && matchesTeam && matchesTech;
  });

  return (
    <AppShell header={{ height: { base: 110, md: 70 } }} padding="md">
      <AppShell.Header p="sm">
        <Group justify="space-between" align="center" dir="rtl" h="100%" wrap="nowrap">
          <Group gap="md" wrap="nowrap" style={{ flexGrow: 1, overflow: 'hidden' }}>
            <Text fw={900} c="blue.9" size="xl" style={{ whiteSpace: 'nowrap' }}>neptuneManager</Text>
            <ScrollArea type="never" style={{ flexGrow: 1 }}>
              <Tabs value={activeTab} onChange={handleTabChange} variant="pills" radius="md" style={{ whiteSpace: 'nowrap' }}>
                <Tabs.List style={{ flexWrap: 'nowrap' }}>
                  <Tabs.Tab value="rules" leftSection={<IconFileText size={16} />}>ניהול חוקים</Tabs.Tab>
                  <Tabs.Tab value="routes" leftSection={<IconSitemap size={16} />}>מסלולים (ארכיטקטורה)</Tabs.Tab>
                  <Tabs.Tab value="queries" leftSection={<IconTerminal2 size={16} />}>שאילתות מאוחדות</Tabs.Tab>
                  <Tabs.Tab value="automations" leftSection={<IconCode size={16} />} c="indigo.7">אוטומציות</Tabs.Tab>
                  {currentRole === 'admin' && <Tabs.Tab value="admin" leftSection={<IconSettings size={16} />}>הגדרות מערכת (Admin)</Tabs.Tab>}
                  <Tabs.Tab value="guide" leftSection={<IconBook size={16} />}>מדריך למשתמש</Tabs.Tab>
                </Tabs.List>
              </Tabs>
            </ScrollArea>
          </Group>
          <Group wrap="nowrap" style={{ flexShrink: 0 }}>
            <Group gap="xs" style={{ borderLeft: '1px solid #ccc', paddingLeft: '15px' }}>
               <Text size="xs" fw={700}>TEST Role:</Text>
               <Select data={['admin', 'editor', 'viewer']} value={currentRole} onChange={setCurrentRole} size="xs" w={90} styles={{ input: { backgroundColor: '#fff3cd' } }} />
            </Group>
            {currentRole === 'admin' && <Button variant="light" color="grape" size="xs" onClick={handleInitEtcd}>אתחל תצורות (ETCD)</Button>}
            <Badge color={currentRole === 'admin' ? 'red' : currentRole === 'editor' ? 'blue' : 'gray'} size="lg" variant="light">
              {username} ({currentRole.toUpperCase()})
            </Badge>
            <Button variant="outline" color="red" size="xs" onClick={onLogout}>התנתק</Button>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Main pt={{ base: 130, md: 100 }} style={{ backgroundImage: `url(${bgDashboard})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed', minHeight: '100vh' }}>
        
        {/* טאב 1: ניהול חוקים */}
        {activeTab === 'rules' && (
          <Container size="xl" pb={120}>
            <Paper shadow="xl" p="xl" radius="md" withBorder>
              <Group justify="space-between" mb="xl" dir="rtl" wrap="wrap">
                <Title order={2}>ניהול חוקי ניטור</Title>
                <Group>
                  <Select placeholder="סנן לפי צוות..." data={uniqueTeams} value={filterTeam} onChange={setFilterTeam} clearable leftSection={<IconFilter size={14}/>} />
                  <Select placeholder="סנן לפי תשתית..." data={uniqueTechs} value={filterTech} onChange={setFilterTech} clearable leftSection={<IconFilter size={14}/>} />
                  <TextInput placeholder="חיפוש חופשי..." value={searchQuery} onChange={(e) => setSearchQuery(e.currentTarget.value)} w={200} />
                  {currentRole === 'admin' && <Button onClick={() => { setEditingRule(null); openModal(); }}>הוסף חוק ידני +</Button>}
                </Group>
              </Group>
              <RulesTable 
                rules={filteredRules} 
                onDelete={handleDeleteRule} 
                onBulkDelete={handleBulkDelete}
                onEdit={handleEditClick} 
                onViewHistory={handleHistoryClick} 
                onNavigate={handleNavigateToNode} 
                userRole={currentRole} 
              />
            </Paper>
          </Container>
        )}

        {/* טאב 2: מסלולים (ארכיטקטורה) */}
        {activeTab === 'routes' && (
          <Container fluid px="md" style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
            <Paper shadow="xl" p="md" radius="md" withBorder style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }} dir="rtl">
              {!selectedArchTeam ? (
                <>
                  <Title order={3} mb="md">בחר צוות לעריכת מסלולים</Title>
                  <SimpleGrid cols={3} spacing="lg" mt="sm">
                    {sysConfig.teams.map((team) => (
                      <Card key={team.id} shadow="sm" p="lg" withBorder style={{ cursor: 'pointer' }} onClick={() => setSelectedArchTeam(team)}>
                        <Group justify="center" mb="md">{iconMap[team.icon] || <IconServer size={32} color="#40c057" />}</Group>
                        <Text fw={700} ta="center">{team.name}</Text>
                      </Card>
                    ))}
                  </SimpleGrid>
                </>
              ) : !selectedTrack ? (
                <>
                  <Group justify="space-between" mb="md">
                    <Title order={3}>צוות {selectedArchTeam.name}: בחר מסלול (Track)</Title>
                    <Group>
                       <Button variant="light" color="teal" leftSection={<IconReportAnalytics size={16}/>} onClick={() => setSummaryModal({ opened: true, type: 'team', team: selectedArchTeam, track: null })}>
                         סיכום ניטורים כולל
                       </Button>
                       <Button variant="subtle" onClick={() => setSelectedArchTeam(null)}>חזור לצוותים</Button>
                    </Group>
                  </Group>
                  <SimpleGrid cols={4}>
                    {(selectedArchTeam.tracks || []).map((track) => (
                      <Card key={track.id} shadow="sm" p="lg" withBorder style={{ cursor: 'pointer', backgroundColor: '#e7f5ff' }} onClick={() => setSelectedTrack(track)}>
                        <Group justify="center" mb="xs"><IconSitemap size={32} color="#1c7ed6" /></Group>
                        <Text fw={700} ta="center">{track.name}</Text>
                      </Card>
                    ))}
                  </SimpleGrid>
                </>
              ) : (
                <>
                  <Group justify="space-between" mb="xs">
                    <Title order={3}>ארכיטקטורה: {selectedArchTeam.name} ➔ {selectedTrack.name}</Title>
                    <Group>
                       <Button variant="light" color="teal" leftSection={<IconReportAnalytics size={16}/>} onClick={() => setSummaryModal({ opened: true, type: 'track', team: selectedArchTeam, track: selectedTrack })}>
                         סיכום ניטורים למסלול זה
                       </Button>
                       <Button variant="subtle" onClick={() => setSelectedTrack(null)}>חזור למסלולים</Button>
                    </Group>
                  </Group>
                  <div style={{ flexGrow: 1, minHeight: 0 }}>
                    <ArchitectureCanvas 
                      team={selectedArchTeam} 
                      track={selectedTrack}
                      rules={rules} 
                      onRuleAdded={fetchRules}
                      username={username}
                      sysConfig={sysConfig}
                      userRole={currentRole}
                      focusedNodeId={focusedNodeId} 
                    />
                  </div>
                </>
              )}
            </Paper>
          </Container>
        )}

        {/* טאב 3: שאילתות מאוחדות */}
        {activeTab === 'queries' && (
          <Container size="xl">
            <Paper shadow="xl" p="xl" radius="md" withBorder dir="rtl">
              <Group justify="space-between" mb="xl">
                <Title order={2}>שאילתות מאוחדות (Generic Rules)</Title>
                <Select data={sysConfig.techs.map(t => ({value: t.value, label: t.label}))} value={selectedTechQuery} onChange={setSelectedTechQuery} w={300} size="md" label="בחר טכנולוגיה" />
              </Group>

              {['dp', 'server', 'windows', 'linux', 'openshift', 'kafka', 'elastic'].includes(selectedTechQuery) ? (
                <Text c="dimmed" ta="center" mt="xl" size="lg">לרכיבי {selectedTechQuery.toUpperCase()} אין שאילתות מאוחדות מבוססות ספים כרגע.</Text>
              ) : (
                <SimpleGrid cols={3} spacing="lg">
                  {sysConfig.apps.map(appName => {
                    let mappedTech = selectedTechQuery === 'rabbit' ? 'rabbitmq' : selectedTechQuery;
                    if (selectedTechQuery === 's3') mappedTech = 's3_storage';
                    const hasRules = rules.some(r => r.name.toLowerCase().includes(`neptune_generic_${mappedTech}_${appName.toLowerCase()}`));
                    
                    return (
                      <Card key={appName} shadow="sm" p="lg" withBorder radius="md" style={{ cursor: 'pointer', transition: 'transform 0.2s ease' }} onClick={() => { setSelectedApp(appName); setAppQueryModalOpen(true); }} onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
                        <Group justify="center" mb="md" mt="sm"><IconAppWindow size={40} color="#339af0" /></Group>
                        <Text fw={900} size="xl" ta="center" mb="md">{appName.toUpperCase()}</Text>
                        <Group justify="center">
                          <Badge color={hasRules ? "blue" : "gray"} variant="light" size="lg">{hasRules ? "קיימים חוקים מאוחדים" : "לא הוגדרו רכיבים"}</Badge>
                        </Group>
                      </Card>
                    );
                  })}
                </SimpleGrid>
              )}
            </Paper>
          </Container>
        )}

        {/* טאב 4: אוטומציות */}
        {activeTab === 'automations' && (
           <Container size="xl" pb={120}>
             <Paper shadow="xl" p="xl" radius="md" withBorder dir="rtl">
                <Group justify="space-between" mb="xl">
                   <Title order={2} c="indigo.8">מערכת אוטומציות מתקדמת (Event-Driven)</Title>
                </Group>
                
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
                                  {f.name}
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
                                           </Stack>
                                           <Group>
                                              <Badge color="teal" size="lg" variant="light" leftSection={<IconPlayerPlay size={14}/>}>רצה {auto.run_count} פעמים</Badge>
                                              <Tooltip label="היסטוריית ריצות">
                                                <ActionIcon color="blue" variant="light" size="lg" onClick={() => setAutoHistoryModal({open: true, auto})}>
                                                   <IconHistory size={18}/>
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
                            <Center h="100%">
                               <Text c="dimmed" size="lg">בחר תיקייה מצד ימין כדי לראות אוטומציות</Text>
                            </Center>
                         )}
                      </Paper>
                   </Grid.Col>
                </Grid>
             </Paper>
           </Container>
        )}

        {/* טאב 5: הגדרות מערכת (Admin) */}
        {activeTab === 'admin' && currentRole === 'admin' && (
          <Container size="xl" pb={120}>
            <Paper shadow="xl" p="xl" radius="md" withBorder dir="rtl">
              <Group justify="space-between" mb="lg">
                <Title order={2}>הגדרות מתקדמות (ניהול דינמי ETCD)</Title>
                <Button color="blue" onClick={saveAdminConfigToEtcd} leftSection={<IconDeviceFloppy size={16} />}>שמור הכל ל-ETCD</Button>
              </Group>

              <Grid>
                <Grid.Col span={6}>
                   <Paper withBorder p="md" bg="gray.0" ta="center">
                      <Text fw={700} mb="sm">ניהול הרשאות מנהלים ועורכים</Text>
                      <Button variant="light" onClick={() => setAdminEditorModal({ opened: true, title: 'עריכת הרשאות', field: 'roles' })}>לחץ כאן לעריכה</Button>
                   </Paper>
                </Grid.Col>
                <Grid.Col span={6}>
                   <Paper withBorder p="md" bg="gray.0" ta="center">
                      <Text fw={700} mb="sm">סביבות OpenShift (JSON)</Text>
                      <Button variant="light" onClick={() => setAdminEditorModal({ opened: true, title: 'עריכת סביבות OCP', field: 'ocp' })}>לחץ כאן לעריכה</Button>
                   </Paper>
                </Grid.Col>
                
                <Grid.Col span={12}>
                   <Paper withBorder p="md" bg="gray.0">
                      <Text fw={700} mb="sm">כתובת 'ללמוד נפטון'</Text>
                      <TextInput value={adminLearnUrl} onChange={(e) => setAdminLearnUrl(e.currentTarget.value)} dir="ltr" />
                   </Paper>
                </Grid.Col>

                <Grid.Col span={12}>
                   <Paper withBorder p="md" bg="gray.0" ta="center">
                      <Text fw={700} mb="sm">ניהול טכנולוגיות, שדות וספים</Text>
                      <Text c="dimmed" size="xs" mb="sm">כאן מוגדרות כל הטכנולוגיות כולל איזה שדות להציג ביצירה ואיזה ספים יש בהקלקה כפולה.</Text>
                      <Button variant="light" color="teal" onClick={() => setAdminEditorModal({ opened: true, title: 'ניהול תצורת טכנולוגיות', field: 'techs' })}>לחץ כאן לעריכה</Button>
                   </Paper>
                </Grid.Col>

                <Grid.Col span={6}>
                  <Paper withBorder p="md" bg="gray.0">
                    <Text fw={700} mb="sm">ניהול צוותים במערכת</Text>
                    <Table highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>שם צוות (מסלול)</Table.Th>
                          <Table.Th>APPLICATION</Table.Th>
                          <Table.Th>תתי מסלולים</Table.Th>
                          <Table.Th>אפשרות מחיקה</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {adminTeams.map((team, idx) => (
                          <Table.Tr key={idx}>
                            <Table.Td>{team.name}</Table.Td>
                            <Table.Td>
                               <Badge color="dark" variant="outline">{team.id}</Badge>
                            </Table.Td>
                            <Table.Td>
                              <Group gap="xs">
                                {(team.tracks || []).map(tr => <Badge key={tr.id} color="blue">{tr.name}</Badge>)}
                                <Button size="compact-xs" variant="light" color="blue" leftSection={<IconPlus size={12}/>} onClick={() => setEditingTeamIndex(idx)}>
                                  הוסף/ערוך
                                </Button>
                              </Group>
                            </Table.Td>
                            <Table.Td>
                              <ActionIcon color="red" variant="subtle" onClick={() => setAdminTeams(adminTeams.filter((_, i) => i !== idx))}>
                                <IconTrash size={16}/>
                              </ActionIcon>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                        
                        <Table.Tr bg="gray.0">
                          <Table.Td>
                             <TextInput placeholder="הזן שם צוות" value={newTeamName} onChange={(e) => setNewTeamName(e.currentTarget.value)} size="xs" />
                          </Table.Td>
                          <Table.Td>
                             <Select placeholder="בחר Application" data={adminApps} value={newTeamId} onChange={setNewTeamId} size="xs" searchable clearable />
                          </Table.Td>
                          <Table.Td>
                             <Text size="xs" c="dimmed">שמור כדי להוסיף תתי מסלולים</Text>
                          </Table.Td>
                          <Table.Td>
                             <Button size="xs" variant="light" color="teal" onClick={() => { 
                               setAdminTeams([...adminTeams, {id: newTeamId || `team_${Date.now()}`, name: newTeamName, desc: '', icon: 'IconServer', tracks: []}]); 
                               setNewTeamId(''); setNewTeamName(''); 
                             }} disabled={!newTeamName}>
                               <IconPlus size={14}/> הוסף
                             </Button>
                          </Table.Td>
                        </Table.Tr>
                      </Table.Tbody>
                    </Table>
                  </Paper>
                </Grid.Col>

                <Grid.Col span={6}>
                  <Paper withBorder p="md" bg="gray.0">
                    <Text fw={700} mb="sm">שמות אפליקציות (לגנריים)</Text>
                    <Stack gap="xs">
                      {adminApps.map((app, idx) => (
                        <Group key={idx} justify="space-between" bg="white" p="xs" style={{ border: '1px solid #dee2e6', borderRadius: '4px' }}>
                          <Text fw={600}>{app}</Text>
                          <ActionIcon color="red" variant="subtle" onClick={() => setAdminApps(adminApps.filter((_, i) => i !== idx))}><IconTrash size={14}/></ActionIcon>
                        </Group>
                      ))}
                      <Group>
                        <TextInput placeholder="שם אפליקציה (אנגלית)" value={newApp} onChange={(e) => setNewApp(e.currentTarget.value)} style={{ flexGrow: 1 }} />
                        <Button onClick={() => { setAdminApps([...adminApps, newApp]); setNewApp(''); }} disabled={!newApp}>הוסף</Button>
                      </Group>
                    </Stack>
                  </Paper>
                </Grid.Col>

                {/* איזור מסוכן - איפוס מערכת */}
                <Grid.Col span={12}>
                    <Paper withBorder p="md" bg="red.0" ta="center" style={{ borderColor: '#fa5252' }}>
                        <Text fw={900} c="red.9" mb="xs">איזור מסוכן (Danger Zone) - איפוס מערכת</Text>
                        <Text c="dimmed" size="sm" mb="md">פעולה זו תמחק את <b>כל</b> החוקים, המסלולים, הארכיטקטורות והאוטומציות במסד הנתונים. מומלץ לבצע זאת אם נשארו "חוקי רפאים" מגרסאות קודמות.</Text>
                        <Button color="red" leftSection={<IconTrash size={16} />} onClick={async () => {
                            if(window.confirm('אזהרה חמורה: האם אתה בטוח שברצונך למחוק את כל המידע במערכת?')) {
                                const pass = window.prompt('הקלד "I AM SURE" כדי לאשר את המחיקה:');
                                if (pass === 'I AM SURE') {
                                    try {
                                        await axios.delete(`${API_BASE_URL}/api/admin/clear-all`);
                                        alert('המערכת אופסה בהצלחה. העמוד יתרענן כעת.');
                                        window.location.reload();
                                    } catch(e) {
                                        alert('שגיאה באיפוס המערכת');
                                    }
                                } else {
                                    alert('הפעולה בוטלה.');
                                }
                            }
                        }}>מחק את כל הנתונים (איפוס מלא)</Button>
                    </Paper>
                </Grid.Col>
              </Grid>
            </Paper>
          </Container>
        )}

        {/* טאב 6: מדריך למשתמש */}
        {activeTab === 'guide' && (
           <Container size="md" pb={120}>
             <Paper shadow="xl" p="xl" radius="md" withBorder dir="rtl">
               <Title order={2} mb="xl">מדריך למשתמש והתקנות</Title>
               
               <Accordion variant="separated" radius="md" mb="xl">
                  <Accordion.Item value="learn-neptune">
                    <Accordion.Control><Text fw={900} c="teal.8">ללמוד נפטון (קורס דיגיטלי)</Text></Accordion.Control>
                    <Accordion.Panel>
                       <Text mb="sm">לחץ על הכפתור מטה כדי לעבור לסביבת הלמידה הרשמית של נפטון ולהעשיר את הידע שלך במערכות הניטור.</Text>
                       <Button onClick={() => window.open(sysConfig.learn_url, '_blank')} color="teal" leftSection={<IconSchool size={16}/>}>
                           היכנס לסביבת הלמידה
                       </Button>
                    </Accordion.Panel>
                  </Accordion.Item>
                  <Accordion.Item value="what-is">
                    <Accordion.Control><Text fw={700}>למה המערכת נועדה?</Text></Accordion.Control>
                    <Accordion.Panel>מערכת NeptuneManager פותחה כדי לתת מענה אחוד וויזואלי לניהול חוקי ניטור וארכיטקטורת רכיבים בארגון.</Accordion.Panel>
                  </Accordion.Item>
                  <Accordion.Item value="edit-rabbit">
                    <Accordion.Control><Text fw={700}>איך לשנות / לערוך חוק ראביט?</Text></Accordion.Control>
                    <Accordion.Panel>עבור למסך <b>מסלולים (ארכיטקטורה)</b>. לחץ פעמיים כדי להגדיר ספים. קליק ימני ובחירת "הגדרות רכיב" תשנה VHOST ו-QUEUE.</Accordion.Panel>
                  </Accordion.Item>
                  <Accordion.Item value="elastic-logs">
                    <Accordion.Control><Text fw={700}>איך להוסיף ניטורי אלסטיק לוגים?</Text></Accordion.Control>
                    <Accordion.Panel>מקם רכיב Elastic על הקנבס ולחץ על הכפתור העגול בצד ימין למעלה המיועד ללוגים.</Accordion.Panel>
                  </Accordion.Item>
                  <Accordion.Item value="view-all">
                    <Accordion.Control><Text fw={700}>איך אני יכול לראות את כל הניטורים שלנו?</Text></Accordion.Control>
                    <Accordion.Panel>בלשונית <b>ניהול חוקים</b>. ניתן גם ללחוץ על "סיכום ניטורים" בלשונית המסלולים.</Accordion.Panel>
                  </Accordion.Item>
                  <Accordion.Item value="auth-ocp">
                    <Accordion.Control><Text fw={700}>מתן הרשאות (OpenShift)</Text></Accordion.Control>
                    <Accordion.Panel>
                       <SimpleGrid cols={3} spacing="md">
                          {['OS', 'NEXT', 'AMRICA'].map(cluster => (
                              <Paper key={cluster} withBorder p="sm" bg="gray.0">
                                 <Text fw={900} mb="xs" ta="center">{cluster}</Text>
                                 <TextInput placeholder="שם משתמש" size="xs" mb="xs" value={ocpForms[cluster].user} onChange={(e) => setOcpForms({...ocpForms, [cluster]: {...ocpForms[cluster], user: e.currentTarget.value}})} />
                                 <PasswordInput placeholder="סיסמא" size="xs" mb="sm" value={ocpForms[cluster].pass} onChange={(e) => setOcpForms({...ocpForms, [cluster]: {...ocpForms[cluster], pass: e.currentTarget.value}})} />
                                 <Button fullWidth size="xs" color="blue" onClick={() => handleGrantOCP(cluster)}>הענק הרשאות</Button>
                              </Paper>
                          ))}
                       </SimpleGrid>
                    </Accordion.Panel>
                  </Accordion.Item>
               </Accordion>

               <Title order={3} mt="xl" mb="md" c="blue.9">התקנות סוכנים (הורדה ישירה)</Title>
               <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
                  <Card shadow="sm" p="lg" withBorder style={{ cursor: 'pointer', textAlign: 'center', transition: 'transform 0.2s ease' }} onClick={() => handleDownload('s3')} onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
                     <Image src={s3Icon} w={60} h={60} mx="auto" mb="md" fit="contain" />
                     <Text fw={700} size="lg">הורד חבילת S3</Text>
                  </Card>
                  <Card shadow="sm" p="lg" withBorder style={{ cursor: 'pointer', textAlign: 'center', transition: 'transform 0.2s ease' }} onClick={() => handleDownload('mongo')} onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
                     <Image src={mongoIcon} w={60} h={60} mx="auto" mb="md" fit="contain" />
                     <Text fw={700} size="lg">הורד חבילת MongoDB</Text>
                  </Card>
               </SimpleGrid>
             </Paper>
           </Container>
        )}

      </AppShell.Main>
      
      {/* -------------------- מודאלים כלליים -------------------- */}

      <Modal opened={adminEditorModal.opened} onClose={() => setAdminEditorModal({ opened: false, title: '', field: '' })} title={<Text fw={900} size="lg">{adminEditorModal.title}</Text>} fullScreen centered dir="rtl">
         <Stack h="calc(100vh - 100px)" gap="sm">
            <Textarea 
               value={adminEditorModal.field === 'roles' ? adminRolesStr : adminEditorModal.field === 'ocp' ? adminOcpStr : adminTechsStr} 
               onChange={(e) => handleAdminJsonChange(e.currentTarget.value)} 
               styles={{ 
                  root: { flexGrow: 1, display: 'flex', flexDirection: 'column' }, 
                  wrapper: { flexGrow: 1 }, 
                  input: { height: '100%', resize: 'none', direction: 'ltr', fontFamily: 'monospace', fontSize: '15px', backgroundColor: '#1e1e1e', color: '#d4d4d4' } 
               }} 
            />
            <Group justify="space-between">
               <Text c="red" fw={700}>{adminJsonError || ''}</Text>
               <Button size="lg" color="blue" onClick={validateAndCloseAdminModal}>אשר וסגור חלונית (שמור זמנית עד השמירה ב-ETCD)</Button>
            </Group>
         </Stack>
      </Modal>

      <Modal opened={appQueryModalOpen} onClose={() => setAppQueryModalOpen(false)} title={`חוקים גנריים: ${selectedTechQuery.toUpperCase()} (${selectedApp})`} centered dir="rtl" size="xl">
        <Stack>
          {selectedTechQuery === 's3' ? (
             <Grid>
               <Grid.Col span={6}><Paper p="md" bg="dark.7" radius="md"><Group justify="space-between" mb="xs"><Text c="yellow" fw={700}>Storage Major</Text><CopyButton value={getGenericQuery('s3_storage', selectedApp, 'major')}>{({ copied, copy }) => (<ActionIcon onClick={copy} color={copied ? 'teal' : 'gray'}>{copied ? <IconCheck size={16}/> : <IconCopy size={16}/>}</ActionIcon>)}</CopyButton></Group><Code color="dark.8" c="yellow.4" block style={{ direction: 'ltr', whiteSpace: 'pre-wrap' }}>{getGenericQuery('s3_storage', selectedApp, 'major')}</Code></Paper></Grid.Col>
               <Grid.Col span={6}><Paper p="md" bg="dark.7" radius="md"><Group justify="space-between" mb="xs"><Text c="red.4" fw={700}>Storage Critical</Text><CopyButton value={getGenericQuery('s3_storage', selectedApp, 'critical')}>{({ copied, copy }) => (<ActionIcon onClick={copy} color={copied ? 'teal' : 'gray'}>{copied ? <IconCheck size={16}/> : <IconCopy size={16}/>}</ActionIcon>)}</CopyButton></Group><Code color="dark.8" c="red.4" block style={{ direction: 'ltr', whiteSpace: 'pre-wrap' }}>{getGenericQuery('s3_storage', selectedApp, 'critical')}</Code></Paper></Grid.Col>
               <Grid.Col span={6}><Paper p="md" bg="dark.7" radius="md"><Group justify="space-between" mb="xs"><Text c="yellow" fw={700}>Objects Major</Text><CopyButton value={getGenericQuery('s3_objects', selectedApp, 'major')}>{({ copied, copy }) => (<ActionIcon onClick={copy} color={copied ? 'teal' : 'gray'}>{copied ? <IconCheck size={16}/> : <IconCopy size={16}/>}</ActionIcon>)}</CopyButton></Group><Code color="dark.8" c="yellow.4" block style={{ direction: 'ltr', whiteSpace: 'pre-wrap' }}>{getGenericQuery('s3_objects', selectedApp, 'major')}</Code></Paper></Grid.Col>
               <Grid.Col span={6}><Paper p="md" bg="dark.7" radius="md"><Group justify="space-between" mb="xs"><Text c="red.4" fw={700}>Objects Critical</Text><CopyButton value={getGenericQuery('s3_objects', selectedApp, 'critical')}>{({ copied, copy }) => (<ActionIcon onClick={copy} color={copied ? 'teal' : 'gray'}>{copied ? <IconCheck size={16}/> : <IconCopy size={16}/>}</ActionIcon>)}</CopyButton></Group><Code color="dark.8" c="red.4" block style={{ direction: 'ltr', whiteSpace: 'pre-wrap' }}>{getGenericQuery('s3_objects', selectedApp, 'critical')}</Code></Paper></Grid.Col>
             </Grid>
          ) : (
            <>
              <Paper p="md" bg="dark.7" radius="md"><Group justify="space-between" mb="xs"><Text c="yellow" fw={700}>MAJOR Threshold Query</Text><CopyButton value={getGenericQuery(selectedTechQuery, selectedApp, 'major')}>{({ copied, copy }) => (<ActionIcon onClick={copy} color={copied ? 'teal' : 'gray'}>{copied ? <IconCheck size={16}/> : <IconCopy size={16}/>}</ActionIcon>)}</CopyButton></Group><Code color="dark.8" c="yellow.4" block style={{ direction: 'ltr', whiteSpace: 'pre-wrap' }}>{getGenericQuery(selectedTechQuery, selectedApp, 'major')}</Code></Paper>
              <Paper p="md" bg="dark.7" radius="md"><Group justify="space-between" mb="xs"><Text c="red.4" fw={700}>CRITICAL Threshold Query</Text><CopyButton value={getGenericQuery(selectedTechQuery, selectedApp, 'critical')}>{({ copied, copy }) => (<ActionIcon onClick={copy} color={copied ? 'teal' : 'gray'}>{copied ? <IconCheck size={16}/> : <IconCopy size={16}/>}</ActionIcon>)}</CopyButton></Group><Code color="dark.8" c="red.4" block style={{ direction: 'ltr', whiteSpace: 'pre-wrap' }}>{getGenericQuery(selectedTechQuery, selectedApp, 'critical')}</Code></Paper>
            </>
          )}
          <Button onClick={() => setAppQueryModalOpen(false)}>סגור</Button>
        </Stack>
      </Modal>

      <Modal opened={editingTeamIndex !== null} onClose={() => setEditingTeamIndex(null)} title="ניהול תתי-מסלולים (Tracks) לצוות" centered dir="rtl">
        <Stack>
          {(adminTeams[editingTeamIndex]?.tracks || []).map((tr, i) => (
             <Group key={i} justify="space-between" p="xs" style={{ border: '1px solid #ccc', borderRadius: 4 }}>
               <Text>{tr.name} ({tr.id})</Text>
               <ActionIcon color="red" onClick={() => {
                  const newTeams = JSON.parse(JSON.stringify(adminTeams));
                  newTeams[editingTeamIndex].tracks.splice(i, 1);
                  setAdminTeams(newTeams);
               }}><IconTrash size={14}/></ActionIcon>
             </Group>
          ))}
          <Group>
            <TextInput placeholder="מזהה מסלול (אנגלית)" value={newTrackId} onChange={(e)=>setNewTrackId(e.currentTarget.value)} />
            <TextInput placeholder="שם מסלול תצוגה" value={newTrackName} onChange={(e)=>setNewTrackName(e.currentTarget.value)} />
            <Button onClick={() => {
               const newTeams = JSON.parse(JSON.stringify(adminTeams));
               if(!newTeams[editingTeamIndex].tracks) newTeams[editingTeamIndex].tracks = [];
               newTeams[editingTeamIndex].tracks.push({ id: newTrackId, name: newTrackName });
               setAdminTeams(newTeams);
               setNewTrackId(''); setNewTrackName('');
            }} disabled={!newTrackId || !newTrackName}>הוסף מסלול</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={ocpLogModal.open} onClose={() => setOcpLogModal({ open: false, logs: [] })} title={<Text fw={900} size="lg">יומן הרצת פקודות OCP</Text>} centered dir="rtl" size="lg">
         <Paper p="md" bg="dark.9" style={{ maxHeight: '300px', overflowY: 'auto' }}>
            <Stack gap={4}>
               {ocpLogModal.logs.map((log, i) => (
                  <Text key={i} c="green.4" style={{ fontFamily: 'monospace', direction: 'ltr', textAlign: 'left' }}>{log}</Text>
               ))}
            </Stack>
         </Paper>
         <Button fullWidth mt="md" onClick={() => setOcpLogModal({ open: false, logs: [] })}>סגור</Button>
      </Modal>

      <Modal opened={autoModalOpen} onClose={() => setAutoModalOpen(false)} title={<Text fw={900} size="lg">יצירת אוטומציה חדשה</Text>} centered dir="rtl" size="md">
         <Stack>
            <TextInput label="שם האוטומציה" placeholder="לדוגמה: ניקוי תורים כשיש עומס" value={autoForm.name} onChange={(e) => setAutoForm({...autoForm, name: e.currentTarget.value})} required />
            
            <Paper withBorder p="sm" bg="gray.0" style={{ cursor: 'pointer' }} onClick={() => setPromqlModalOpen(true)}>
               <Group justify="space-between">
                  <Stack gap={0}>
                     <Text fw={700}>הגדרת טריגר (PromQL)</Text>
                     <Text size="xs" c="dimmed">{autoForm.metric_query ? `${autoForm.metric_query} ${autoForm.operator} ${autoForm.threshold}` : 'לחץ להגדרת תנאי הריצה'}</Text>
                  </Stack>
                  <IconChartLine color="#339af0" />
               </Group>
            </Paper>

            <Paper withBorder p="sm" bg="gray.0" style={{ cursor: 'pointer' }} onClick={() => setPythonModalOpen(true)}>
               <Group justify="space-between">
                  <Stack gap={0}>
                     <Text fw={700}>הגדרת סקריפט (Python)</Text>
                     <Text size="xs" c="dimmed">{autoForm.python_code ? 'סקריפט מוגדר - לחץ לעריכה' : 'לחץ לכתיבת הקוד שירוץ'}</Text>
                  </Stack>
                  <IconCode color="#40c057" />
               </Group>
            </Paper>

            <Button fullWidth color="indigo" onClick={handleCreateAutomation} disabled={!autoForm.name || !autoForm.metric_query || !autoForm.python_code}>שמור אוטומציה ופעיל ברקע</Button>
         </Stack>
      </Modal>

      <Modal opened={promqlModalOpen} onClose={() => setPromqlModalOpen(false)} title="הגדרת טריגר (PromQL)" size="lg" centered dir="rtl">
         <Stack>
            <TextInput label="שאילתת בסיס (ללא ספים)" placeholder='לדוגמה: rabbitmq_messages_ready_total' value={autoForm.metric_query} onChange={(e) => setAutoForm({...autoForm, metric_query: e.currentTarget.value})} dir="ltr" />
            <Group grow>
               <Select label="תנאי" data={['>', '<', '==']} value={autoForm.operator} onChange={(val) => setAutoForm({...autoForm, operator: val})} />
               <NumberInput label="סף הפעלה" value={autoForm.threshold} onChange={(val) => setAutoForm({...autoForm, threshold: val})} />
            </Group>
            <Group grow>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                   <Text size="xs" fw={700} mb={2}>מזמן</Text>
                   <input type="datetime-local" value={autoGraphStartTime} onChange={(e) => setAutoGraphStartTime(e.target.value)} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                   <Text size="xs" fw={700} mb={2}>עד זמן</Text>
                   <input type="datetime-local" value={autoGraphEndTime} onChange={(e) => setAutoGraphEndTime(e.target.value)} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }} />
                </div>
            </Group>

            <Button variant="light" color="blue" onClick={handleFetchAutoGraph} loading={isGraphLoading}>הצג בדיקת טריגר על הגרף</Button>
            {renderAutoGraph()}
            <Button fullWidth color="teal" onClick={() => setPromqlModalOpen(false)}>אשר ושמור טריגר</Button>
         </Stack>
      </Modal>

      <Modal opened={pythonModalOpen} onClose={() => setPythonModalOpen(false)} title="עורך Python לאוטומציה" size="lg" centered dir="rtl">
         <Stack>
            <Text size="xs" c="dimmed">כתוב את הסקריפט שלך. ניתן להשתמש במשתנה המובנה `value` המכיל את הערך ברגע הקפיצה.</Text>
            <Textarea minRows={10} value={autoForm.python_code} onChange={(e) => setAutoForm({...autoForm, python_code: e.currentTarget.value})} styles={{input:{direction:'ltr', fontFamily:'monospace', backgroundColor:'#2b2b2b', color:'#a9b7c6'}}} />
            
            <Group justify="space-between">
               <Button color="orange" onClick={handleTestPython}>הרץ טסט (Test Run)</Button>
               {isPythonError && <Text size="xs" c="red" fw={700}>שים לב: קיבלת שגיאת SyntaxError מהשרת, אולי שכחת לסגור מחרוזת עם מרכאות (" ")?</Text>}
            </Group>
            
            <Paper bg="dark.9" p="sm" style={{ minHeight: '100px', border: isPythonError ? '2px solid #fa5252' : '1px solid #000' }}>
               <Text c={isPythonError ? "red.4" : "green.4"} style={{ fontFamily: 'monospace', direction: 'ltr', whiteSpace: 'pre-wrap' }}>
                  {pythonTestOutput || '> ממתין להרצה... (ערך test value = 100)'}
               </Text>
            </Paper>
            <Button fullWidth color="teal" onClick={() => setPythonModalOpen(false)}>אשר סקריפט</Button>
         </Stack>
      </Modal>

      <Modal opened={autoHistoryModal.open} onClose={() => setAutoHistoryModal({open: false, auto: null})} title={<Text fw={900} size="lg">היסטוריית ריצות: {autoHistoryModal.auto?.name}</Text>} centered dir="rtl" size="lg">
         {autoHistoryModal.auto && (
            <ScrollArea h={400} offsetScrollbars>
               {(!autoHistoryModal.auto.history || autoHistoryModal.auto.history.length === 0) ? (
                  <Text ta="center" c="dimmed" mt="xl">האוטומציה טרם רצה.</Text>
               ) : (
                  <Table highlightOnHover>
                     <Table.Thead><Table.Tr><Table.Th>תאריך ושעה</Table.Th><Table.Th>ערך המטריקה באותו רגע</Table.Th></Table.Tr></Table.Thead>
                     <Table.Tbody>
                        {[...autoHistoryModal.auto.history].reverse().map((h, i) => (
                           <Table.Tr key={i}>
                              <Table.Td><Badge color="gray" variant="light">{h.date}</Badge></Table.Td>
                              <Table.Td><Text fw={700} c="indigo.6">{h.value}</Text></Table.Td>
                           </Table.Tr>
                        ))}
                     </Table.Tbody>
                  </Table>
               )}
            </ScrollArea>
         )}
      </Modal>

      <Modal opened={summaryModal.opened} onClose={() => setSummaryModal({ opened: false, type: null, team: null, track: null })} title={<Text fw={900} size="lg">סיכום הניטורים הפעילים</Text>} size="80%" centered dir="rtl">
         <ScrollArea h="60vh" offsetScrollbars>
            {renderSummaryContent()}
         </ScrollArea>
      </Modal>

      <AddRuleModal opened={modalOpened} onClose={handleCloseModal} onAdd={handleSaveRule} editingRule={editingRule} sysConfig={sysConfig} />
      <HistoryDrawer opened={historyOpened} onClose={() => setHistoryOpened(false)} rule={selectedRuleForHistory} onRestore={handleRestore} />
    </AppShell>
  );
}