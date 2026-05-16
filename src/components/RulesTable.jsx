import React, { useState } from 'react';
import axios from 'axios';
import { Table, Group, Text, Badge, ActionIcon, Menu, Loader, Tooltip, Code, Stack, Modal, Button, Image, Checkbox, CopyButton, Paper, ScrollArea, Alert, List, Divider } from '@mantine/core';
import { IconEdit, IconTrash, IconDotsVertical, IconHistory, IconCheck, IconX, IconAlertTriangle, IconFileSearch, IconCopy, IconPlus, IconCrosshair, IconSearch, IconInfoCircle } from '@tabler/icons-react';
import { API_BASE_URL } from '../config';

import iconLogs from '../assets/iconNitur/logs.webp';
import iconMessages from '../assets/iconNitur/messages.png';
import iconStorage from '../assets/iconNitur/storage.png';
import iconCustom from '../assets/iconNitur/custom.png';

export const getNiturIconSrc = (tsdb) => {
  if (!tsdb) return iconStorage;
  const t = String(tsdb).toLowerCase();
  if (t.includes('elastic') || t.includes('log')) return iconLogs;
  if (['pulse', 'thanos', 'prom', 'prometheus'].some(x => t.includes(x))) return iconCustom;
  return iconStorage;
};

export default function RulesTable({ rules, onDelete, onBulkDelete, onEdit, onViewHistory, userRole, onAddRule, onOpenCheckExists }) {
  const [ruleStatuses, setRuleStatuses] = useState({});
  const [queryModalOpen, setQueryModalOpen] = useState(false);
  const [selectedRuleData, setSelectedRuleData] = useState(null);
  const [selectedRecords, setSelectedRecords] = useState([]);

  // פונקציית עזר לחיתוך הספים מהשאילתה, כדי לבדוק קיום המטריקה נטו (מונעת התנגשות עם Labels)
  const stripThreshold = (query) => {
    if (!query) return query;
    return query.split(/(?:\s+or\s+|\n\s*or\s*\n)/i).map(segment => {
        // מחפש אופרטור השוואה, ומוודא שאין אחריו סוגריים מסולסלים (כדי לא לחתוך != בתוך ה-Labels)
        return segment.replace(/\s*(?:>=|<=|>|<|==|!=)\s*[^}]*$/, '').trim();
    }).join(' or ');
  };

  /// פנייה לשרת לבדיקה כפולה: גם קיום המטריקה וגם תאימות מול הקנבס
  const checkPromQLRule = async (query, ruleNode, mappingTemplate) => {
    try {
      const strippedQuery = stripThreshold(query);
      const res = await axios.post(`${API_BASE_URL}/check_promql`, { 
          query: strippedQuery,
          node: ruleNode,
          mappingTemplate: mappingTemplate
      });
      
      if (res.data.status === 'error') {
         return res.data; // השרת כעת מחזיר failing_parts וגם missing_nodes
      }
      return res.data;
    } catch (e) { 
      return { status: 'error', failing_parts: [stripThreshold(query)], missing_nodes: [] }; 
    }
  };

  const performRuleCheck = async (rule) => {
    let allPartsResults = [];
    let overallStatus = 'success';

    const checkQuery = async (q) => {
      if (!q) return;
      try {
        const res = await axios.post(`${API_BASE_URL}/check_promql`, { 
            query: q,
            node: rule.node,
            mappingTemplate: rule.mappingTemplate
        });
        allPartsResults = [...allPartsResults, ...res.data.parts_results];
        if (res.data.status === 'error') overallStatus = 'error';
        else if (res.data.status === 'partial' && overallStatus !== 'error') overallStatus = 'partial';
      } catch (e) {
        overallStatus = 'error';
      }
    };

    if (rule.queryMajor) await checkQuery(rule.queryMajor);
    if (rule.queryCritical) await checkQuery(rule.queryCritical);
    if (!rule.queryMajor && !rule.queryCritical && rule.query) await checkQuery(rule.query);

    return {
      status: overallStatus,
      partsResults: allPartsResults
    };
  };

  const handleCheckRule = async (rule) => {
    setRuleStatuses(prev => ({ ...prev, [rule.id]: { loading: true } }));
    const result = await performRuleCheck(rule);
    setRuleStatuses(prev => ({ 
      ...prev, 
      [rule.id]: { 
          loading: false, 
          status: result.status, 
          partsResults: result.partsResults
      } 
    }));
  };

  const checkAllRules = async () => {
    const statuses = {};
    rules.forEach(r => statuses[r.id] = { loading: true });
    setRuleStatuses(statuses);
    
    for (const rule of rules) {
      const result = await performRuleCheck(rule);
      setRuleStatuses(prev => ({ 
        ...prev, 
        [rule.id]: { 
            loading: false, 
            status: result.status, 
            partsResults: result.partsResults
        } 
      }));
    }
  };

  const toggleAll = () => {
    if (selectedRecords.length === rules.length) setSelectedRecords([]);
    else setSelectedRecords(rules.map(r => r.id));
  };

  return (
    <Stack gap="md" dir="rtl">
      {/* כלי ניהול עליונים */}
      <Group justify="space-between">
        <Group gap="sm">
          {userRole !== 'viewer' && onAddRule && (
            <Button variant="filled" color="blue.7" radius="md" onClick={onAddRule} leftSection={<IconPlus size={18} />}>
              צור חוק CUSTOM חדש
            </Button>
          )}
          <Button variant="light" color="blue.6" radius="md" onClick={checkAllRules} leftSection={<IconFileSearch size={18} />}>
            בדוק תקינות לכל הטבלה (Debug)
          </Button>
          {selectedRecords.length > 0 && userRole !== 'viewer' && (
            <Button variant="light" color="red" radius="md" leftSection={<IconTrash size={18}/>} onClick={() => { onBulkDelete(selectedRecords); setSelectedRecords([]); }}>
              מחק {selectedRecords.length} מסומנים
            </Button>
          )}
        </Group>
      </Group>

      {/* גוף הטבלה */}
      <Paper withBorder radius="lg" shadow="sm" style={{ overflow: 'hidden' }}>
        <ScrollArea h={650} scrollbarSize={8} offsetScrollbars>
          <Table verticalSpacing="md" horizontalSpacing="lg" highlightOnHover striped stickyHeader>
            <Table.Thead bg="gray.0">
              <Table.Tr>
                {userRole !== 'viewer' && (
                  <Table.Th w={50}>
                    <Checkbox checked={selectedRecords.length === rules.length && rules.length > 0} indeterminate={selectedRecords.length > 0 && selectedRecords.length < rules.length} onChange={toggleAll} />
                  </Table.Th>
                )}
                <Table.Th><Text fw={800} size="sm">חוק ומטרה</Text></Table.Th>
                <Table.Th><Text fw={800} size="sm">שאילתות ניטור</Text></Table.Th>
                <Table.Th><Text fw={800} size="sm">סטטוס (Debug)</Text></Table.Th>
                <Table.Th><Text fw={800} size="sm">צוות</Text></Table.Th>
                <Table.Th w={120} ta="center"><Text fw={800} size="sm">פעולות</Text></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rules.map((rule) => {
                const status = ruleStatuses[rule.id];
                // שולף בצורה חכמה את השגיאות מתוך התשובה של השרת
                const tooltipFailingPromQL = status?.partsResults?.filter(p => p.status === 'error').map(p => p.part) || [];
                const tooltipMissingNodes = status?.partsResults?.flatMap(p => p.missing_nodes || []) || [];

                return (
                  <Table.Tr key={rule.id}>
                    {userRole !== 'viewer' && (
                      <Table.Td>
                        <Checkbox checked={selectedRecords.includes(rule.id)} onChange={() => {
                          if (selectedRecords.includes(rule.id)) setSelectedRecords(selectedRecords.filter(id => id !== rule.id));
                          else setSelectedRecords([...selectedRecords, rule.id]);
                        }} />
                      </Table.Td>
                    )}
                    <Table.Td>
                      <Group gap="md" wrap="nowrap">
                        <Paper shadow="xs" p={6} radius="md" withBorder bg="white">
                          <Image src={getNiturIconSrc(rule.tsdb)} w={24} h={24} />
                        </Paper>
                        <Stack gap={2}>
                          <Text fw={800} c="blue.9" size="sm" style={{ cursor: 'pointer' }} onClick={() => { setSelectedRuleData({...rule, partsResults: status?.partsResults}); setQueryModalOpen(true); }}>{rule.name}</Text>
                          <Text size="xs" c="dimmed" fw={500} lineClamp={1}>{rule.purposeRule || 'ניטור ללא פירוט'}</Text>
                        </Stack>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Button variant="subtle" color="blue" size="compact-xs" leftSection={<IconFileSearch size={14} />} onClick={() => { setSelectedRuleData({...rule, partsResults: status?.partsResults}); setQueryModalOpen(true); }}>
                          צפה בשאילתה
                        </Button>
                        <CopyButton value={rule.queryMajor || rule.queryCritical || rule.query} timeout={2000}>
                          {({ copied, copy }) => (
                            <Tooltip label={copied ? 'הועתק' : 'העתק שאילתה'}>
                              <ActionIcon color={copied ? 'teal' : 'gray.5'} variant="subtle" onClick={copy} size="sm">
                                {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </CopyButton>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      {status?.loading ? <Loader size="xs" /> : status?.status === 'success' ? (
                        <Badge 
                           color="teal.6" variant="dot" size="sm" fw={800} style={{ cursor: 'pointer' }}
                           onClick={() => { setSelectedRuleData({...rule, partsResults: status?.partsResults}); setQueryModalOpen(true); }}
                        >
                          תקין בשרת ומופה לרכיב
                        </Badge>
                      ) : status?.status === 'error' || status?.status === 'partial' ? (
                        <Badge 
                           color={status.status === 'error' ? "red.6" : "orange.6"} variant="dot" size="sm" fw={800} style={{ cursor: 'pointer' }}
                           onClick={() => { setSelectedRuleData({...rule, partsResults: status?.partsResults}); setQueryModalOpen(true); }}
                        >
                          {status.status === 'error' ? 'נכשל בבדיקה!' : 'תקין חלקית'}
                        </Badge>
                      ) : (
                        <ActionIcon variant="light" color="gray.6" onClick={() => handleCheckRule(rule)} size="sm"><IconCheck size={14} /></ActionIcon>
                      )}
                    </Table.Td>
                    <Table.Td><Badge color="gray.2" c="dark.5" variant="filled" size="sm">{rule.team}</Badge></Table.Td>
                    <Table.Td>
                      <Group gap={4} justify="center">
                        {userRole !== 'viewer' && (
                          <Tooltip label="ערוך חוק">
                            <ActionIcon color="blue.6" variant="subtle" onClick={() => onEdit(rule)} size="md"><IconEdit size={18} /></ActionIcon>
                          </Tooltip>
                        )}
                        <Menu position="bottom-end" shadow="md" width={220} withArrow>
                          <Menu.Target>
                            <ActionIcon color="gray.6" variant="subtle" size="md"><IconDotsVertical size={18} /></ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown dir="rtl">
                            <Menu.Label>אפשרויות חוק</Menu.Label>
                            <Menu.Item color="indigo" leftSection={<IconCrosshair size={16} />} onClick={() => onOpenCheckExists(rule)}>
                              סורק מתקדם וזיהוי רכיב במאגר
                            </Menu.Item>
                            <Menu.Item leftSection={<IconHistory size={16} />} color="blue" onClick={() => onViewHistory(rule)}>
                              היסטוריית שינויים (Timeline)
                            </Menu.Item>
                            <Menu.Divider />
                            {userRole !== 'viewer' && (
                              <Menu.Item leftSection={<IconTrash size={16} />} color="red" onClick={() => onDelete(rule.id)}>
                                מחק חוק
                              </Menu.Item>
                            )}
                          </Menu.Dropdown>
                        </Menu>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Paper>

      <Modal opened={queryModalOpen} onClose={() => setQueryModalOpen(false)} title={<Text fw={900} size="xl">פירוט שאילתה ובדיקת תקינות: {selectedRuleData?.name}</Text>} size="xl" centered dir="rtl">
        {selectedRuleData && (
          <Stack gap="md">
            {/* הצגת השאילתות המקוריות */}
            <Group grow>
                {selectedRuleData.queryMajor && (
                  <Paper withBorder p="md" bg="yellow.0" radius="md" style={{ borderRight: '6px solid #fcc419' }}>
                    <Text fw={900} c="yellow.9" mb="xs">MAJOR (אזהרה):</Text>
                    <Code block color="dark.8" c="yellow.4" style={{ backgroundColor: '#1e1e2d', direction: 'ltr', textAlign: 'left' }}>{selectedRuleData.queryMajor}</Code>
                  </Paper>
                )}
                {selectedRuleData.queryCritical && (
                  <Paper withBorder p="md" bg="red.0" radius="md" style={{ borderRight: '6px solid #fa5252' }}>
                    <Text fw={900} c="red.9" mb="xs">CRITICAL (קריטי):</Text>
                    <Code block color="dark.8" c="red.4" style={{ backgroundColor: '#1e1e2d', direction: 'ltr', textAlign: 'left' }}>{selectedRuleData.queryCritical}</Code>
                  </Paper>
                )}
                {/* תמיכה בחוקים ישנים/כלליים */}
                {!selectedRuleData.queryMajor && !selectedRuleData.queryCritical && selectedRuleData.query && (
                  <Paper withBorder p="md" bg="blue.0" radius="md" style={{ borderRight: '6px solid #339af0' }}>
                    <Text fw={900} c="blue.9" mb="xs">שאילתת ניטור:</Text>
                    <Code block color="dark.8" c="blue.4" style={{ backgroundColor: '#1e1e2d', direction: 'ltr', textAlign: 'left' }}>{selectedRuleData.query}</Code>
                  </Paper>
                )}
            </Group>

            <Divider label="ניתוח מקטעים (Debug)" labelPosition="center" />

            <Stack gap="xs">
                {(selectedRuleData.partsResults || []).map((res, idx) => {
                    const colors = {
                        success: { bg: 'teal.0', border: 'teal.6', text: 'teal.9', icon: <IconCheck size={18}/> },
                        partial: { bg: 'orange.0', border: 'orange.6', text: 'orange.9', icon: <IconAlertTriangle size={18}/> },
                        error: { bg: 'red.0', border: 'red.6', text: 'red.9', icon: <IconX size={18}/> }
                    };
                    const style = colors[res.status] || colors.error;
                    return (
                        <Paper key={idx} withBorder p="md" radius="md" bg={style.bg} style={{ borderRight: `8px solid var(--mantine-color-${style.border})` }}>
                            <Group justify="space-between" mb="xs">
                                <Group gap="xs">
                                    {style.icon}
                                    <Text fw={900} c={style.text}>{res.status === 'success' ? 'תקין' : res.status === 'partial' ? 'חסר במאגר' : 'נכשל'}</Text>
                                </Group>
                                <Badge variant="filled" color={style.border}>{res.reason}</Badge>
                            </Group>
                            <Code block color="dark.8" c={res.status === 'error' ? 'red.3' : 'blue.3'} style={{ backgroundColor: '#16161e', direction: 'ltr', textAlign: 'left' }}>{res.part}</Code>
                            {(res.found_nodes?.length > 0 || res.missing_nodes?.length > 0) && (
                                <Stack gap="xs" mt="sm">
                                    <Text size="xs" fw={800}>רכיבים שנגזרו מהשאילתה (PromQL):</Text>
                                    <Group gap={4}>
                                        {res.found_nodes?.map((n, i) => <Badge key={`f-${i}`} size="xs" color="teal" variant="light" leftSection={<IconCheck size={10}/>}>{n}</Badge>)}
                                        {res.missing_nodes?.map((n, i) => <Badge key={`m-${i}`} size="xs" color="red" variant="light" leftSection={<IconX size={10}/>}>{n}</Badge>)}
                                    </Group>
                                </Stack>
                            )}
                        </Paper>
                    );
                })}
            </Stack>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}