import { Card, Stack, Group, Text, Badge, Paper, Grid, Divider, Center } from '@mantine/core';
import { IconArrowRight, IconCheck } from '@tabler/icons-react';
import { ReviewDiff } from '../types/review.types';

interface DiffViewProps {
  original: any;
  reviewed: any;
  fields?: string[];
}

export function DiffView({ original, reviewed, fields }: DiffViewProps) {
  // Generate diff data
  const generateDiffs = (): ReviewDiff[] => {
    const diffs: ReviewDiff[] = [];
    const checkFields = fields || Object.keys({ ...original, ...reviewed });

    checkFields.forEach(field => {
      const originalValue = original?.[field];
      const reviewedValue = reviewed?.[field];
      const changed = JSON.stringify(originalValue) !== JSON.stringify(reviewedValue);
      
      diffs.push({
        field,
        original: originalValue,
        reviewed: reviewedValue,
        changed,
      });
    });

    return diffs.sort((a, b) => {
      // Show changed fields first
      if (a.changed && !b.changed) return -1;
      if (!a.changed && b.changed) return 1;
      return 0;
    });
  };

  const diffs = generateDiffs();
  const changedCount = diffs.filter(d => d.changed).length;

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (Array.isArray(value)) return value.join(', ') || '(empty)';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  const getFieldLabel = (field: string): string => {
    const labels: Record<string, string> = {
      classification: 'Classification',
      tags: 'Tags',
      nutrition: 'Nutrition Data',
      feedback: 'Feedback',
      ai_confidence: 'AI Confidence',
    };
    return labels[field] || field.charAt(0).toUpperCase() + field.slice(1).replace(/_/g, ' ');
  };

  return (
    <Card withBorder p="md">
      <Stack gap="md">
        <Group justify="space-between">
          <Text fw={500}>Annotation Comparison</Text>
          {changedCount > 0 ? (
            <Badge color="yellow" variant="light">
              {changedCount} change{changedCount !== 1 ? 's' : ''}
            </Badge>
          ) : (
            <Badge color="green" variant="light">
              No changes
            </Badge>
          )}
        </Group>

        <Divider />

        {diffs.length === 0 ? (
          <Text size="sm" c="dimmed">No data to compare</Text>
        ) : (
          <Stack gap="sm">
            {diffs.map((diff, index) => (
              <Paper
                key={index}
                withBorder
                p="sm"
                style={{
                  backgroundColor: diff.changed ? 'var(--mantine-color-yellow-0)' : undefined,
                }}
              >
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text size="sm" fw={500}>
                      {getFieldLabel(diff.field)}
                    </Text>
                    {diff.changed ? (
                      <Badge size="xs" color="yellow" variant="light">
                        Changed
                      </Badge>
                    ) : (
                      <Badge size="xs" color="gray" variant="light">
                        Unchanged
                      </Badge>
                    )}
                  </Group>

                  <Grid gutter="xs">
                    <Grid.Col span={5}>
                      <Paper p="xs" withBorder bg="gray.0">
                        <Stack gap={4}>
                          <Text size="xs" c="dimmed">Original</Text>
                          <Text size="xs" style={{ wordBreak: 'break-word' }}>
                            {formatValue(diff.original)}
                          </Text>
                        </Stack>
                      </Paper>
                    </Grid.Col>

                    <Grid.Col span={2}>
                      <Center h="100%">
                        {diff.changed ? (
                          <IconArrowRight size={16} color="var(--mantine-color-yellow-6)" />
                        ) : (
                          <IconCheck size={16} color="var(--mantine-color-gray-5)" />
                        )}
                      </Center>
                    </Grid.Col>

                    <Grid.Col span={5}>
                      <Paper 
                        p="xs" 
                        withBorder 
                        bg={diff.changed ? "blue.0" : "gray.0"}
                      >
                        <Stack gap={4}>
                          <Text size="xs" c="dimmed">Reviewed</Text>
                          <Text 
                            size="xs" 
                            style={{ wordBreak: 'break-word' }}
                            fw={diff.changed ? 500 : undefined}
                          >
                            {formatValue(diff.reviewed)}
                          </Text>
                        </Stack>
                      </Paper>
                    </Grid.Col>
                  </Grid>
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}
      </Stack>
    </Card>
  );
}
