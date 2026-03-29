import { Drawer, Timeline, Text, Stack, Group, Badge, ScrollArea, ActionIcon, Tooltip, Paper } from '@mantine/core';
import { IconGitBranch, IconUser, IconCalendar, IconRestore, IconArrowsDiff } from '@tabler/icons-react';
import * as diff from 'diff'; 

export function HistoryDrawer({ opened, onClose, rule, onRestore }) {
  if (!rule) return null;

  const renderDiff = (currentQuery, prevQuery) => {
    // תיקון: אם אין גרסה קודמת, נתייחס לכל הטקסט כאל טקסט שנוסף (added)
    const diffs = prevQuery 
      ? diff.diffWordsWithSpace(prevQuery, currentQuery) 
      : [{ value: currentQuery, added: true }]; 

    return (
      <Paper withBorder p="xs" bg="gray.0" style={{ direction: 'ltr', borderRadius: '4px' }}>
        <div style={{ fontFamily: 'monospace', fontSize: '12px', whiteSpace: 'pre-wrap', textAlign: 'left' }}>
          {diffs.map((part, i) => {
            const color = part.added ? '#2f8132' : part.removed ? '#a40e26' : '#24292f';
            const bg = part.added ? '#dafbe1' : part.removed ? '#ffdce0' : 'transparent';
            const decoration = part.removed ? 'line-through' : 'none';

            return (
              <span key={i} style={{ 
                color, 
                backgroundColor: bg, 
                textDecoration: decoration,
                padding: '2px 1px',
                fontWeight: (part.added || part.removed) ? 'bold' : 'normal'
              }}>
                {part.value}
              </span>
            );
          })}
        </div>
      </Paper>
    );
  };

  const sortedHistory = [...(rule.history || [])].reverse();

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={<Text fw={900} size="lg">היסטוריית שינויים: {rule.name}</Text>}
      position="right"
      size="lg"
      dir="rtl"
    >
      <ScrollArea h="calc(100vh - 80px)" offsetScrollbars>
        <Stack p="md">
          <Timeline active={0} bulletSize={24} lineWidth={2} align="right">
            {sortedHistory.map((item, index) => {
              const prevItem = sortedHistory[index + 1];
              
              return (
                <Timeline.Item 
                  key={index} 
                  bullet={<IconGitBranch size={12} />} 
                  title={
                    <Group justify="space-between" dir="rtl">
                      <Group gap="xs">
                        <Text fw={700}>גרסה {item.version}</Text>
                        {index === 0 && <Badge size="xs" color="green" variant="light">נוכחית</Badge>}
                      </Group>
                      {index !== 0 && (
                        <Tooltip label="שחזר לגרסה זו" withArrow>
                          <ActionIcon variant="light" color="orange" onClick={() => onRestore(rule.id, item)}>
                            <IconRestore size={16} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </Group>
                  }
                >
                  <Stack gap={8} mt={4} align="flex-start">
                    <Group gap={4} dir="rtl">
                      <IconUser size={14} color="gray" />
                      <Text size="sm">עודכן ע"י: <Text span fw={600}>{item.user}</Text></Text>
                    </Group>
                    
                    <Group gap={4} dir="rtl" mb={-4}>
                      <IconArrowsDiff size={14} color="blue" />
                      <Text size="xs" fw={700} c="blue.8">
                        {prevItem ? 'שינויים בשאילתה:' : 'שאילתה ראשונית:'}
                      </Text>
                    </Group>

                    <div style={{ width: '100%' }}>
                      {renderDiff(item.query, prevItem?.query)}
                    </div>
                    
                    <Group gap={4} dir="rtl">
                      <IconCalendar size={14} color="gray" />
                      <Text size="xs" c="dimmed">{item.date}</Text>
                    </Group>
                  </Stack>
                </Timeline.Item>
              );
            })}
          </Timeline>
        </Stack>
      </ScrollArea>
    </Drawer>
  );
}