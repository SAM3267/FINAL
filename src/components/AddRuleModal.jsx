import React, { useState, useEffect } from 'react';
import { Modal, Button, TextInput, Stack, Group, Text, Paper, Textarea, Radio, Select, Alert, Badge, Code, ScrollArea } from '@mantine/core';
import { IconDeviceFloppy, IconAlertTriangle, IconSearch, IconInfoCircle, IconX } from '@tabler/icons-react';
import axios from 'axios';
import { API_BASE_URL } from '../config';

export function AddRuleModal({ opened, onClose, onAdd, editingRule }) {
  const [name, setName] = useState('');
  const [purposeRule, setPurposeRule] = useState(''); 
  const [tsdb, setTsdb] = useState('pulse_thanos');
  const [queryMajor, setQueryMajor] = useState('');
  const [queryCritical, setQueryCritical] = useState('');
  const [mappingType, setMappingType] = useState('node');
  const [node, setNode] = useState('');
  const [mappingTemplate, setMappingTemplate] = useState(''); 
  const [savedSuccess, setSavedSuccess] = useState(false);

  const [showWarning, setShowWarning] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const [nodeOptions, setNodeOptions] = useState([]);
  const [testResults, setTestResults] = useState(null);
  const [isTestingPrometheus, setIsTestingPrometheus] = useState(false);

  // אובייקט לניהול שגיאות בטופס
  const [errors, setErrors] = useState({});

  // ניקוי שגיאות בעת סגירת המודאל
  useEffect(() => {
      if (!opened) setErrors({});
  }, [opened]);

  const getBaseMetric = (query) => {
    if (!query) return '';
    return query.replace(/\s*(?:>=|<=|>|<|==|!=)\s*[-+]?[0-9]*\.?[0-9]+\s*$/, '').trim();
  };

  // -------------------------------------------------------------
  // התיקון: פונקציה חכמה לפיצול, ניקוי ומיון אלפביתי של השאילתה
  // -------------------------------------------------------------
  const getNormalizedMetrics = (query) => {
      if (!query) return { metrics: [], operators: [] };
      
      const parts = query.split(/\s+\b(and|or|unless)\b\s+/i).map(p => p.trim()).filter(Boolean);
      const metrics = [];
      const operators = [];
      
      parts.forEach(part => {
          if (/^(and|or|unless)$/i.test(part)) {
              operators.push(part.toLowerCase());
          } else {
              metrics.push(getBaseMetric(part));
          }
      });
      
      // המיון כאן הוא המפתח - הוא מבטיח שסדר שונה לא יפיל את הוולידציה
      return { metrics: metrics.sort(), operators: operators.sort() };
  };

  // פונקציית ולידציה מרכזית לטופס
  const validateQueries = () => {
    const newErrors = {};
    let isValid = true;

    if (!queryMajor.trim() && !queryCritical.trim()) {
        newErrors.general = "חובה להזין לפחות שאילתה אחת (MAJOR או CRITICAL).";
        isValid = false;
    }

    const hasConditionRegex = /\s*(?:>=|<=|>|<|==|!=)\s*[-+]?[0-9]*\.?[0-9]+\s*$/;

    if (queryMajor.trim() && !hasConditionRegex.test(queryMajor)) {
        newErrors.queryMajor = "חובה לסיים את השאילתה בתנאי וסף (לדוגמה: > 80)";
        isValid = false;
    }

    if (queryCritical.trim() && !hasConditionRegex.test(queryCritical)) {
        newErrors.queryCritical = "חובה לסיים את השאילתה בתנאי וסף (לדוגמה: > 95)";
        isValid = false;
    }

    // בדיקת התאמה רק אם אין שגיאות תחביר קודמות
    if (queryMajor.trim() && queryCritical.trim() && isValid) {
        const normMajor = getNormalizedMetrics(queryMajor);
        const normCritical = getNormalizedMetrics(queryCritical);

        // השוואת אובייקטים אחרי מיון
        if (JSON.stringify(normMajor) !== JSON.stringify(normCritical)) {
            newErrors.general = `חוסר התאמה! המטריקות חייבות להיות זהות לחלוטין (מותר לשנות סדר, אך הבסיס והאופרטורים חייבים להיות זהים מלבד הסף).\n\nזוהו ב-MAJOR:\n${normMajor.metrics.join(' | ')}\n\nזוהו ב-CRITICAL:\n${normCritical.metrics.join(' | ')}`;
            newErrors.queryMajor = "המטריקה לא תואמת ל-CRITICAL";
            newErrors.queryCritical = "המטריקה לא תואמת ל-MAJOR";
            isValid = false;
        }
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleTestQuery = async () => {
    if (!validateQueries()) return;

    const queryToTest = queryMajor || queryCritical;
    setIsTestingPrometheus(true);
    setTestResults(null);
    
    const prometheusUrl = tsdb === 'pulse_thanos' ? 'http://localhost:9090' : 'http://URL_Y:9090'; 
    
    try {
      const splitRegex = /\s+\b(?:and|or|unless)\b\s+/i;
      const rawParts = queryToTest.split(splitRegex).filter(p => p.trim() !== '');

      const resultsPromises = rawParts.map(async (part) => {
        const cleanQuery = getBaseMetric(part);
        try {
          const res = await axios.get(`${prometheusUrl}/api/v1/query`, { params: { query: cleanQuery } });
          const resultData = res.data?.data?.result || [];
          return { part, cleanQuery, count: resultData.length, data: resultData, success: true };
        } catch (e) {
          return { part, cleanQuery, success: false, error: e.message || "שגיאת חיבור" };
        }
      });

      const allResults = await Promise.all(resultsPromises);
      setTestResults(allResults); 
    } catch (e) {
      setTestResults([{ success: false, error: "שגיאה כללית בפענוח השאילתה" }]);
    } finally {
      setIsTestingPrometheus(false);
    }
  };

  const fetchNodes = async () => {
    try {
        const res = await axios.get(`${API_BASE_URL}/api/components`);
        const formatted = res.data.map(c => ({ value: c.name, label: c.name }));
        setNodeOptions(formatted);
    } catch(e) { console.error("Error fetching components", e); }
  };

  useEffect(() => { 
    if (opened) fetchNodes(); 
  }, [opened]);

  useEffect(() => {
    setNodeOptions(prev => {
      if (node && !prev.some(opt => opt.value === node)) {
        return [...prev, { value: node, label: node }];
      }
      return prev;
    });
  }, [node]);

  useEffect(() => {
    if (editingRule) {
      setName(editingRule.name || ''); 
      setPurposeRule(editingRule.purposeRule || editingRule.purpose || ''); 
      setTsdb(editingRule.tsdb || 'pulse_thanos'); 
      setQueryMajor(editingRule.queryMajor || editingRule.query || ''); 
      setQueryCritical(editingRule.queryCritical || '');
      
      const incomingNode = editingRule.node || '';
      const incomingTemplate = editingRule.mappingTemplate || '';
      
      setNode(incomingNode); 
      setMappingTemplate(incomingTemplate);
      
      if (incomingTemplate && (!incomingNode || incomingNode === 'GENERIC' || incomingNode === 'SYS_GENERIC')) {
          setMappingType('template');
      } else {
          setMappingType('node');
      }
    } else {
      setName(''); 
      setPurposeRule('');
      setTsdb('pulse_thanos'); 
      setQueryMajor(''); 
      setQueryCritical('');
      setNode(''); 
      setMappingTemplate(''); 
      setMappingType('node');
    }
  }, [editingRule, opened]);

  const executeSave = async () => {
    try {
      await onAdd({ 
        name, 
        tsdb,
        team: '', 
        purposeRule: purposeRule, 
        queryMajor, 
        queryCritical, 
        node: mappingType === 'node' ? node : 'GENERIC', 
        mappingTemplate: mappingType === 'template' ? mappingTemplate : '' 
      });
      setSavedSuccess(true); setShowWarning(false);
      setTimeout(() => { setSavedSuccess(false); onClose(); }, 2000);
    } catch (error) { console.error(error); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // הפעלת הבדיקות לפני שמירה - עוצר אם יש שגיאה
    if (!validateQueries()) return;
    
    setIsChecking(true);
    try {
        const queryToCheck = getBaseMetric(queryMajor || queryCritical);
        const res = await axios.post(`${API_BASE_URL}/api/promql/labels`, { query: queryToCheck });
        setIsChecking(false);
        if (!res.data.labels || res.data.labels.length === 0) { setShowWarning(true); return; }
    } catch (err) { setIsChecking(false); setShowWarning(true); return; }
    
    executeSave();
  };

  const ltrStyle = { input: { textAlign: 'left', direction: 'ltr', fontFamily: 'monospace' } };

  return (
    <>
      <Modal 
        opened={opened} 
        onClose={onClose} 
        title={<Text fw={900} size="xl" c="blue.9">יצירת/עריכת חוק ניטור</Text>} 
        centered 
        size="85%" 
        dir="rtl"
        yOffset="5vh"
        scrollAreaComponent={ScrollArea.Autosize} 
      >
        <form onSubmit={handleSubmit}>
          <Stack gap="md" pb="md" px="xs">
            <Group grow>
                <TextInput label="שם החוק (באנגלית)" placeholder="לדוגמה: CPU_High_Usage" value={name} onChange={(e) => setName(e.currentTarget.value)} required styles={ltrStyle} />
                <Select 
                    label="מקור נתונים (TSDB)" 
                    data={[
                        { value: 'pulse_thanos', label: 'pulse_thanos' },
                        { value: 'unity', label: 'unity' }
                    ]}
                    value={tsdb} 
                    onChange={setTsdb} 
                    required 
                    styles={ltrStyle} 
                />
            </Group>
            
            <TextInput 
                label="מטרת החוק (Purpose Rule)" 
                placeholder="לדוגמה: ניטור עומס חיבורים לדאטה-בייס" 
                value={purposeRule} 
                onChange={(e) => setPurposeRule(e.currentTarget.value)} 
                styles={{ input: { textAlign: 'right', direction: 'rtl' } }}
            />

            <Paper withBorder p="md" bg="gray.0" radius="md">
              <Group justify="space-between" mb="sm">
                  <Text fw={900} size="lg">הגדרת שאילתות PromQL</Text>
                  <Button variant="light" color="blue" onClick={handleTestQuery} loading={isTestingPrometheus} leftSection={<IconSearch size={16} />}>
                      בדוק שאילתה מול {tsdb}
                  </Button>
              </Group>

              {/* הודעת שגיאה כללית */}
              {errors.general && (
                  <Alert color="red" variant="light" mb="md" title="שגיאת אימות" icon={<IconX size={16} />} style={{ whiteSpace: 'pre-line' }}>
                      {errors.general}
                  </Alert>
              )}

              {!errors.general && (
                <Alert color="blue" variant="light" mb="md" title="שימו לב לתחביר השאילתה" icon={<IconInfoCircle size={16} />}>
                    יש להשתמש בסימן <b>=</b> (שווה) בתוך הסוגריים המסולסלים לסינון לייבלים. שימוש בנקודתיים (:) יגרום לשגיאה 400.
                </Alert>
              )}

              <Stack gap="md" mb="md">
                  <Paper p="sm" bg="yellow.0" withBorder style={{borderColor: errors.queryMajor ? '#fa5252' : '#fcc419'}}>
                    <Text fw={800} c="yellow.9" mb="xs">MAJOR (אזהרה)</Text>
                    <Textarea 
                        placeholder="לדוגמה: sum(rate(metric_name[5m])) > 80"
                        value={queryMajor} 
                        onChange={(e) => {
                            setQueryMajor(e.currentTarget.value);
                            setErrors(prev => ({ ...prev, queryMajor: null, general: null })); 
                        }} 
                        error={errors.queryMajor}
                        minRows={5} 
                        autosize 
                        styles={{ input: { ...ltrStyle.input, backgroundColor: '#1e1e2d', color: '#4ade80', fontSize: '14px' }}} 
                    />
                  </Paper>
                  
                  <Paper p="sm" bg="red.0" withBorder style={{borderColor: errors.queryCritical ? '#fa5252' : '#ff8787'}}>
                    <Text fw={800} c="red.9" mb="xs">CRITICAL (קריטי)</Text>
                    <Textarea 
                        placeholder="לדוגמה: sum(rate(metric_name[5m])) > 95"
                        value={queryCritical} 
                        onChange={(e) => {
                            setQueryCritical(e.currentTarget.value);
                            setErrors(prev => ({ ...prev, queryCritical: null, general: null })); 
                        }} 
                        error={errors.queryCritical}
                        minRows={5} 
                        autosize 
                        styles={{ input: { ...ltrStyle.input, backgroundColor: '#1e1e2d', color: '#4ade80', fontSize: '14px' }}} 
                    />
                  </Paper>
              </Stack>

              {testResults && (
                  <Stack gap="sm">
                      <Text fw={900} size="md" c="blue.9">תוצאות הבדיקה ({testResults.length} מקטעים זוהו):</Text>
                      {testResults.map((res, index) => (
                          <Paper key={index} withBorder p="sm" bg={res.success ? "teal.0" : "red.0"} style={{ borderColor: res.success ? '#40c057' : '#fa5252' }}>
                              {res.success ? (
                                  <Stack gap="xs">
                                      <Group justify="space-between">
                                          <Text fw={800} c="teal.9" style={{ direction: 'ltr' }}>{res.cleanQuery}</Text>
                                          <Badge color={res.count > 0 ? "teal" : "orange"} variant="filled">
                                              זוהו {res.count} מטריקות
                                          </Badge>
                                      </Group>
                                      
                                      {res.count > 0 && (
                                          <div style={{ maxHeight: '150px', overflowY: 'auto', background: '#fff', border: '1px solid #ced4da', padding: '8px', borderRadius: '4px' }}>
                                              <Stack gap={4}>
                                                  {res.data.slice(0, 5).map((item, i) => (
                                                      <Group key={i} gap="xs" wrap="nowrap">
                                                          <Badge size="sm" circle color="blue">{i + 1}</Badge>
                                                          <Code style={{ direction: 'ltr', textAlign: 'left', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                              {JSON.stringify(item.metric)}
                                                          </Code>
                                                      </Group>
                                                  ))}
                                                  {res.count > 5 && (
                                                      <Text size="xs" c="dimmed" mt="xs" ta="center">...ועוד {res.count - 5} מטריקות שלא מוצגות</Text>
                                                  )}
                                              </Stack>
                                          </div>
                                      )}
                                  </Stack>
                              ) : (
                                  <Group gap="xs" justify="space-between">
                                      <Text fw={800} c="red.9" style={{ direction: 'ltr' }}>{res.part}</Text>
                                      <Group gap="xs">
                                          <IconAlertTriangle color="red" size={18} />
                                          <Text fw={800} c="red.9">{res.error}</Text>
                                      </Group>
                                  </Group>
                              )}
                          </Paper>
                      ))}
                  </Stack>
              )}
            </Paper>

            <Paper withBorder p="md" bg="gray.0">
              <Group justify="space-between" mb="xs">
                  <Text fw={700}>מיפוי רכיב יעד (מסתנכרן אוטומטית מול CPR)</Text>
              </Group>
              <Radio.Group value={mappingType} onChange={setMappingType}>
                <Group><Radio value="node" label="בחר רכיב מהמאגר" /><Radio value="template" label="שיוך דינמי (Template)" /></Group>
              </Radio.Group>
              
              {mappingType === 'node' ? 
                <Select 
                  mt="sm"
                  placeholder="חפש שם רכיב..." 
                  data={nodeOptions} 
                  value={node} 
                  onChange={(val) => {
                      setNode(val);
                      if (val && !nodeOptions.some(o => o.value === val)) {
                          setNodeOptions(prev => [...prev, { value: val, label: val }]);
                      }
                  }} 
                  searchable 
                  clearable 
                  required
                  leftSection={<IconSearch size={18} />}
                  styles={{
                      input: { 
                        textAlign: 'right', 
                        direction: 'ltr',
                        fontFamily: 'monospace',
                        paddingRight: '35px'
                      },
                      options: { textAlign: 'right', direction: 'ltr' }
                  }}
                /> :
                <Stack gap="xs" mt="sm">
                    <TextInput placeholder="{{$labels.label}}" value={mappingTemplate} onChange={(e) => setMappingTemplate(e.currentTarget.value)} styles={ltrStyle} required />
                    {mappingTemplate && testResults && testResults.some(r => r.success && r.count > 0) && (
                        <Paper withBorder p="sm" bg="blue.0" style={{ borderColor: '#74c0fc', borderRadius: '8px' }}>
                            <Text size="xs" fw={800} mb="xs" c="blue.9">תצוגה מקדימה - רכיבים שייגזרו מהמטריקה (Live Preview):</Text>
                            <ScrollArea h={90} offsetScrollbars>
                                <Group gap="xs">
                                    {testResults.filter(r => r.success).flatMap(r => r.data).slice(0, 30).map((item, i) => {
                                        const labels = {};
                                        for(let k in item.metric) labels[k.toLowerCase()] = item.metric[k];
                                        const resolved = mappingTemplate.replace(/\{+(?:\$labels\.)?([^}]+)\}+/gi, (m, p1) => {
                                            const key = p1.trim().toLowerCase();
                                            return labels[key] !== undefined ? labels[key] : m;
                                        });
                                        return <Badge key={i} color="indigo" variant="light" size="md">{resolved}</Badge>;
                                    })}
                                </Group>
                            </ScrollArea>
                        </Paper>
                    )}
                </Stack>
              }
            </Paper>

            <Button type="submit" size="lg" leftSection={<IconDeviceFloppy size={20} />} loading={isChecking}>
                שמור חוק ניטור
            </Button>
          </Stack>
        </form>
      </Modal>

      <Modal opened={showWarning} onClose={() => setShowWarning(false)} title={<Group><IconAlertTriangle color="orange" /><Text fw={900}>אזהרת חוסר נתונים בשאילתה</Text></Group>} centered zIndex={3000} dir="rtl">
          <Text mb="md">הבדיקה מול שרת הפרומטאוס מראה שהשאילתה שהזנת <b>לא מחזירה כרגע נתונים</b> או מטריקות חיות (ללא התחשבות בסף).</Text>
          <Alert color="orange" title="האם אתה בטוח שברצונך להמשיך?" mb="md">
            ייתכן שהשם של המטריקה שגוי, ה-Labels לא תואמים, או שהרכיב פשוט לא מייצר נתונים כרגע. שמירת החוק במצב זה תייצר ניטור שלא פוגע בכלום.
          </Alert>
          <Group justify="flex-end">
              <Button variant="outline" color="gray" onClick={() => setShowWarning(false)}>חזור לעריכה</Button>
              <Button color="red" onClick={executeSave}>התעלם ושמור בכל זאת</Button>
          </Group>
      </Modal>
    </>
  );
}