import React, { useState, useEffect } from 'react';
import { Modal, Button, TextInput, Select, Stack, Group, Text, Paper, Textarea } from '@mantine/core';
import { IconServer, IconAppWindow, IconDeviceFloppy } from '@tabler/icons-react';

export function AddRuleModal({ opened, onClose, onAdd, editingRule, sysConfig }) {
  const [name, setName] = useState('');
  const [tech, setTech] = useState('');
  const [team, setTeam] = useState('');
  const [query, setQuery] = useState('');
  const [purpose, setPurpose] = useState('');
  const [subType, setSubType] = useState('תשתיתי'); 
  const [application, setApplication] = useState('');
  const [vhost, setVhost] = useState('');
  const [queueName, setQueueName] = useState('');
  const [environment, setEnvironment] = useState('');
  const [namespace, setNamespace] = useState('');
  const [deployment, setDeployment] = useState('');

  useEffect(() => {
    if (editingRule) {
      setName(editingRule.name || '');
      setTech(editingRule.tech || '');
      setTeam(editingRule.team || '');
      setQuery(editingRule.query || '');
      setPurpose(editingRule.purpose || '');
      setSubType(editingRule.subType || 'תשתיתי');
      setApplication(editingRule.application || '');
      setVhost(editingRule.vhost || '');
      setQueueName(editingRule.queueName || '');
      setEnvironment(editingRule.environment || '');
      setNamespace(editingRule.namespace || '');
      setDeployment(editingRule.deployment || '');
    } else {
      setName('');
      setTech('');
      setTeam('');
      setQuery('');
      setPurpose('');
      setSubType('תשתיתי');
      setApplication('');
      setVhost('');
      setQueueName('');
      setEnvironment('');
      setNamespace('');
      setDeployment('');
    }
  }, [editingRule, opened]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onAdd({ name, tech, team, query, purpose, subType, application, vhost, queueName, environment, namespace, deployment });
  };

  return (
    <Modal opened={opened} onClose={onClose} title={editingRule ? "עריכת חוק ניטור ידני" : "הוספת חוק ניטור ידני"} centered dir="rtl" size="lg">
      <form onSubmit={handleSubmit}>
      <Stack spacing="md">
        
        <TextInput 
          label="שם החוק" 
          placeholder="לדוגמה: CPU Usage High" 
          value={name} 
          onChange={(e) => setName(e.currentTarget.value)} 
          required 
          disabled={!!editingRule} 
          description={editingRule ? "לא ניתן לשנות שם של חוק קיים כדי למנוע שבירת קישורים." : ""}
        />

        <Textarea 
          label="מטרת החוק" 
          placeholder="תאר בקצרה מה החוק מנטר ולמה..." 
          value={purpose} 
          onChange={(e) => setPurpose(e.currentTarget.value)} 
          minRows={2}
          required 
        />

        <Group grow>
          <Select 
            label="טכנולוגיה" 
            placeholder="בחר טכנולוגיה" 
            data={sysConfig?.techs || []} 
            value={tech} 
            onChange={setTech} 
            required 
          />
          <Select 
            label="צוות אחראי" 
            placeholder="בחר צוות" 
            data={sysConfig?.teams?.map(t => t.name) || []} 
            value={team} 
            onChange={setTeam} 
            required 
          />
        </Group>

        <TextInput 
          label="שאילתת PromQL" 
          placeholder="לדוגמה: up == 0" 
          value={query} 
          onChange={(e) => setQuery(e.currentTarget.value)} 
          required 
          dir="ltr"
        />

        {['rabbit', 'elastic', 'mongo', 's3', 'nfs', 'openshift'].includes(tech) && (
           <Select 
             label="APPLICATION (שם המסלול)" 
             placeholder="בחר מסלול (Application)" 
             data={sysConfig?.apps || []} 
             value={application} 
             onChange={setApplication} 
             required 
           />
        )}

        {tech === 'rabbit' && (
          <Group grow mt="sm">
            <TextInput label="VHOST" placeholder="/" value={vhost} onChange={(e) => setVhost(e.currentTarget.value)} required />
            <TextInput label="QUEUE NAME" placeholder="queue_name" value={queueName} onChange={(e) => setQueueName(e.currentTarget.value)} required />
          </Group>
        )}

        {tech === 'openshift' && (
          <Group grow mt="sm">
            <TextInput label="סביבה (Environment)" placeholder="לדוגמה: PROD" value={environment} onChange={(e) => setEnvironment(e.currentTarget.value)} required />
            <TextInput label="Namespace" placeholder="my-namespace" value={namespace} onChange={(e) => setNamespace(e.currentTarget.value)} required />
            <TextInput label="Deployment" placeholder="my-deployment" value={deployment} onChange={(e) => setDeployment(e.currentTarget.value)} required />
          </Group>
        )}

        <div>
          <Text size="sm" fw={500} mb={5} mt="sm">סוג ניטור</Text>
          <Group grow>
            <Paper 
              withBorder p="sm" radius="md" 
              style={{ cursor: 'pointer', backgroundColor: subType === 'תשתיתי' ? '#e7f5ff' : 'white', borderColor: subType === 'תשתיתי' ? '#339af0' : '#dee2e6', transition: 'all 0.2s' }}
              onClick={() => setSubType('תשתיתי')}
            >
              <Group justify="center" gap="xs">
                <IconServer size={20} color={subType === 'תשתיתי' ? '#1c7ed6' : '#868e96'} />
                <Text fw={600} c={subType === 'תשתיתי' ? 'blue.9' : 'gray.6'}>ניטור תשתיתי</Text>
              </Group>
            </Paper>

            <Paper 
              withBorder p="sm" radius="md" 
              style={{ cursor: 'pointer', backgroundColor: subType === 'אפליקטיבי' ? '#ebfbee' : 'white', borderColor: subType === 'אפליקטיבי' ? '#40c057' : '#dee2e6', transition: 'all 0.2s' }}
              onClick={() => setSubType('אפליקטיבי')}
            >
              <Group justify="center" gap="xs">
                <IconAppWindow size={20} color={subType === 'אפליקטיבי' ? '#2b8a3e' : '#868e96'} />
                <Text fw={600} c={subType === 'אפליקטיבי' ? 'green.9' : 'gray.6'}>ניטור אפליקטיבי</Text>
              </Group>
            </Paper>
          </Group>
        </div>

        <Button 
          type="submit"
          fullWidth mt="md" color="blue" leftSection={<IconDeviceFloppy size={16} />} 
          disabled={!name || !tech || !team || !query || !purpose || (['rabbit', 'elastic', 'mongo', 's3', 'nfs', 'openshift'].includes(tech) && !application) || (tech === 'rabbit' && (!vhost || !queueName)) || (tech === 'openshift' && (!environment || !namespace || !deployment))}
        >
          {editingRule ? "שמור שינויים" : "צור חוק ניטור"}
        </Button>
      </Stack>
      </form>
    </Modal>
  );
}