import React, { useState } from 'react';
import { Paper, Title, Text, Group, Stack, Table, Badge, ScrollArea, Center, Loader, Alert } from '@mantine/core';
import { Dropzone, IMAGE_MIME_TYPE } from '@mantine/dropzone';
import { IconUpload, IconPhoto, IconX, IconRadar, IconAlertCircle } from '@tabler/icons-react';
import axios from 'axios';
import { API_BASE_URL } from '../config';

export default function ArchitectureScanner({ rules = [] }) {
  const [loading, setLoading] = useState(false);
  const [scanResults, setScanResults] = useState([]);
  const [error, setError] = useState(null);

  // פונקציה משופרת: בודקת גם התאמה סטטית וגם צימוד דינמי שהתקבל מהסנכרון
  const getRulesForComponent = (componentName) => {
    if (!componentName) return [];
    const lowerName = componentName.toLowerCase().trim();
    
    return rules.filter(r => {
      // 1. בדיקה ראשונה: האם החוק אמר במפורש שהוא מוצמד לרכיב הזה (מבוסס פרומטאוס)
      if (r.attachedComponents && r.attachedComponents.some(c => c.toLowerCase().trim() === lowerName)) {
        return true;
      }

      // 2. בדיקה שנייה: התאמה סטטית לשם הרכיב (למקרים של בחירה ידנית מהמאגר)
      const staticNode = String(r.node || '').toLowerCase().trim();
      if (staticNode === lowerName) return true;

      // 3. בדיקה ייעודית לרכיבי RabbitMQ המפרקת את ה-vhost וה-queue מהשאילתות החדשות
      const q = r.queryMajor || r.queryCritical || r.query || '';
      // 3. בדיקה ייעודית לראביט (גם אם הוגדר כ-CUSTOM ידנית דרך PromQL)
      if (r.tech === 'rabbit' || lowerQ.includes('rabbitmq')) {
        const queueMatch = q.match(/queue\s*=\s*["']([^"']+)["']/i);
        const vhostMatch = q.match(/vhost\s*=\s*["']([^"']+)["']/i);
        if (queueMatch && vhostMatch) {
          const vhost = vhostMatch[1].toLowerCase().trim();
          const queue = queueMatch[1].toLowerCase().trim();
          // התיקון: הצמדה אך ורק לפי vhost-queue
          if (`${vhost}-${queue}` === lowerName) return true;
        }
      }

      // 4. בדיקה רביעית: האם שם הרכיב מופיע בשאילתה או בשם החוק (חיפוש טקסטואלי מורחב)
      return (
        (r.name && r.name.toLowerCase().includes(lowerName)) || 
        (r.query && r.query.toLowerCase().includes(lowerName)) ||
        (r.queryMajor && r.queryMajor.toLowerCase().includes(lowerName)) ||
        (r.queryCritical && r.queryCritical.toLowerCase().includes(lowerName))
      );
    });
  };

  const handleDrop = async (files) => {
    const file = files[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setScanResults([]);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/scan-architecture`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data.status === 'success') {
        setScanResults(response.data.data || []);
      } else {
        setError(response.data.message || "השרת החזיר שגיאה בעיבוד התמונה");
      }
    } catch (error) {
      console.error("Error scanning architecture:", error);
      setError("שגיאת תקשורת מול השרת. וודא שה-API מעודכן ורץ.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack gap="lg" dir="rtl">
      <Group gap="sm">
        <IconRadar size={28} color="#339af0" />
        <Title order={3} c="blue.9">סורק ארכיטקטורה (OCR) וזיהוי חוקים</Title>
      </Group>

      <Text c="dimmed">העלה תמונה של שרטוט המערכת. נפטון יזהה את שמות הרכיבים באנגלית ויציג את חוקי הניטור המשויכים אליהם בטבלה.</Text>
      
      <Dropzone
        onDrop={handleDrop}
        maxSize={5 * 1024 ** 2}
        accept={IMAGE_MIME_TYPE}
        loading={loading}
        radius="md"
        style={{ border: '2px dashed #bac8ff', backgroundColor: '#f8f9fa' }}
      >
        <Group justify="center" gap="xl" minHeight={150} style={{ pointerEvents: 'none' }}>
          <Dropzone.Accept>
            <IconUpload size={50} color="var(--mantine-color-blue-6)" stroke={1.5} />
          </Dropzone.Accept>
          <Dropzone.Reject>
            <IconX size={50} color="var(--mantine-color-red-6)" stroke={1.5} />
          </Dropzone.Reject>
          <Dropzone.Idle>
            <IconPhoto size={50} color="#74c0fc" stroke={1.5} />
          </Dropzone.Idle>

          <div>
            <Text size="xl" inline fw={700}>גרור שרטוט לכאן או לחץ לבחירה</Text>
            <Text size="sm" c="dimmed" mt={7}>זיהוי טקסט ממוחשב באנגלית בלבד (2 אותיות ומעלה)</Text>
          </div>
        </Group>
      </Dropzone>

      {error && (
        <Alert variant="light" color="red" title="שגיאת סריקה" icon={<IconAlertCircle />}>
          {error}
        </Alert>
      )}

      {loading && (
        <Center py="xl">
          <Stack align="center">
            <Loader size="lg" />
            <Text fw={700} c="blue">מנתח תמונה ומבצע OCR...</Text>
          </Stack>
        </Center>
      )}

      {scanResults.length > 0 && (
        <Paper withBorder radius="md" p="md" bg="gray.0" shadow="sm">
          <Title order={4} mb="md" c="dark.7">תוצאות זיהוי רכיבים וחוקים:</Title>
          
          <ScrollArea offsetScrollbars type="auto">
            <Table striped highlightOnHover withTableBorder withColumnBorders bg="white">
              <Table.Thead bg="blue.1">
                <Table.Tr>
                  {scanResults.map((result, idx) => (
                    <Table.Th key={idx} ta="center" w={220} py="md">
                      <Text fw={900} c="blue.9" size="md" dir="ltr">{result.component}</Text>
                    </Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                <Table.Tr>
                  {scanResults.map((result, idx) => {
                    const matchedRules = getRulesForComponent(result.component);
                    
                    return (
                      <Table.Td key={idx} style={{ verticalAlign: 'top' }} py="md">
                        <Stack gap="xs">
                          {matchedRules.length > 0 ? (
                            matchedRules.map(rule => (
                              <Paper key={rule.id} p="xs" withBorder shadow="xs" radius="sm" style={{ borderRight: '4px solid #339af0' }}>
                                <Text size="sm" fw={800} c="dark.8" mb={2}>{rule.name}</Text>
                                <Text size="xs" c="dimmed" lineClamp={2}>{rule.purposeRule || rule.purpose || 'ניטור רכיב'}</Text>
                                
                                {/* הצגת אינדיקציה ויזואלית לספים של התורים במידה וקיימים */}
                                {(rule.majorThreshold !== undefined && rule.majorThreshold !== null || rule.criticalThreshold !== undefined && rule.criticalThreshold !== null) && (
                                  <Group gap={4} mt="xs" mb={4}>
                                    {rule.majorThreshold !== undefined && rule.majorThreshold !== null && (
                                      <Badge size="xs" color="yellow" variant="light">Major: {rule.majorThreshold}</Badge>
                                    )}
                                    {rule.criticalThreshold !== undefined && rule.criticalThreshold !== null && (
                                      <Badge size="xs" color="red" variant="light">Critical: {rule.criticalThreshold}</Badge>
                                    )}
                                  </Group>
                                )}
                                
                                <Group justify="space-between" mt="xs">
                                  <Badge size="xs" color="indigo" variant="light">{rule.tech || 'CUSTOM'}</Badge>
                                  {rule.subType && <Badge size="xs" color="gray" variant="outline">{rule.subType}</Badge>}
                                </Group>
                              </Paper>
                            ))
                          ) : (
                            <Center py="xl">
                              <Text size="xs" c="dimmed" fs="italic">לא נמצאו חוקים</Text>
                            </Center>
                          )}
                        </Stack>
                      </Table.Td>
                    );
                  })}
                </Table.Tr>
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Paper>
      )}
    </Stack>
  );
}