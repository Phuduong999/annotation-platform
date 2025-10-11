import { Container, Title, Text, Stack, Button, Card, Group, Badge, Table, ActionIcon, Select, TextInput, NumberInput, Textarea, Modal, Grid, Progress, Tooltip } from '@mantine/core';
import { IconDownload, IconPlus, IconEye, IconTrash, IconRefresh, IconFileText, IconDatabase, IconCheck, IconX } from '@tabler/icons-react';
import { useState, useEffect } from 'react';
import { notifications } from '@mantine/notifications';
import { snapshotService } from '../services/snapshot.service';
import { exportService } from '../services/export.service';
import { Snapshot, CreateSnapshotRequest, Export as ExportType, ExportFormat, DataSplit } from '../types/snapshot.types';


export function Export() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [exports, setExports] = useState<ExportType[]>([]);
  const [loading, setLoading] = useState(false);
  const [createSnapshotModalOpen, setCreateSnapshotModalOpen] = useState(false);
  const [createExportModalOpen, setCreateExportModalOpen] = useState(false);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>('');
  
  // Create snapshot form stoiate
  const [snapshotForm, setSnapshotForm] = useState<CreateSnapshotRequest>({
    name: '',
    description: '',
    train_ratio: 0.7,
    validation_ratio: 0.15,
    test_ratio: 0.15,
    split_seed: Math.floor(Math.random() * 10000)
  });
  
  // Create export form state
  const [exportForm, setExportForm] = useState({
    snapshot_id: '',
    format: 'csv' as ExportFormat,
    split: undefined as DataSplit | undefined,
    compression: false
  });

  const loadSnapshots = async () => {
    try {
      setLoading(true);
      const response = await snapshotService.getSnapshots();
      setSnapshots(response.snapshots);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to load snapshots',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };
  
  const loadExports = async () => {
    try {
      const response = await exportService.getExports();
      setExports(response.exports);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to load exports',
        color: 'red',
      });
    }
  };

  useEffect(() => {
    loadSnapshots();
    loadExports();
  }, []);

  const handleCreateSnapshot = async () => {
    try {
      await snapshotService.createSnapshot(snapshotForm);
      notifications.show({
        title: 'Success',
        message: 'Snapshot created successfully',
        color: 'green',
      });
      setCreateSnapshotModalOpen(false);
      setSnapshotForm({
        name: '',
        description: '',
        train_ratio: 0.7,
        validation_ratio: 0.15,
        test_ratio: 0.15,
        split_seed: Math.floor(Math.random() * 10000)
      });
      loadSnapshots();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to create snapshot',
        color: 'red',
      });
    }
  };

  const handleCreateExport = async () => {
    try {
      await exportService.createExport({
        snapshot_id: exportForm.snapshot_id,
        format: exportForm.format,
        split: exportForm.split,
        compression: exportForm.compression
      });
      notifications.show({
        title: 'Success',
        message: 'Export started successfully',
        color: 'green',
      });
      setCreateExportModalOpen(false);
      setExportForm({
        snapshot_id: '',
        format: 'csv',
        split: undefined,
        compression: false
      });
      loadExports();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to create export',
        color: 'red',
      });
    }
  };

  const handleDownloadExport = async (exportItem: ExportType) => {
    try {
      await exportService.downloadExportFile(exportItem);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to download export',
        color: 'red',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      pending: 'blue',
      processing: 'yellow',
      completed: 'green',
      failed: 'red',
      expired: 'gray'
    };
    return <Badge color={colors[status as keyof typeof colors] || 'gray'}>{status}</Badge>;
  };

  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        <div>
          <Title order={1}>Export & Snapshots</Title>
          <Text size="sm" c="dimmed" mt="xs">
            Create data snapshots and export task data in various formats
          </Text>
        </div>

        {/* Snapshots Section */}
        <Card withBorder>
          <Stack gap="md">
            <Group justify="space-between">
              <div>
                <Text size="lg" fw={500}>Snapshots</Text>
                <Text size="sm" c="dimmed">Versioned datasets with train/validation/test splits</Text>
              </div>
              <Group>
                <Button leftSection={<IconRefresh size={14} />} variant="light" onClick={loadSnapshots} loading={loading}>
                  Refresh
                </Button>
                <Button leftSection={<IconPlus size={14} />} onClick={() => setCreateSnapshotModalOpen(true)}>
                  Create Snapshot
                </Button>
              </Group>
            </Group>
            
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Items</Table.Th>
                  <Table.Th>Split Ratio</Table.Th>
                  <Table.Th>Created</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {snapshots.map((snapshot) => (
                  <Table.Tr key={snapshot.id}>
                    <Table.Td>
                      <Stack gap={4}>
                        <Text size="sm" fw={500}>{snapshot.name}</Text>
                        {snapshot.description && (
                          <Text size="xs" c="dimmed">{snapshot.description}</Text>
                        )}
                      </Stack>
                    </Table.Td>
                    <Table.Td>{getStatusBadge(snapshot.status)}</Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        <Text size="sm">{snapshot.total_items}</Text>
                        <Text size="xs" c="dimmed">
                          ({snapshot.train_count}/{snapshot.validation_count}/{snapshot.test_count})
                        </Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs">
                        {(snapshot.train_ratio * 100).toFixed(0)}%/
                        {(snapshot.validation_ratio * 100).toFixed(0)}%/
                        {(snapshot.test_ratio * 100).toFixed(0)}%
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs">{new Date(snapshot.created_at).toLocaleDateString()}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        <Tooltip label="Create Export">
                          <ActionIcon 
                            variant="light" 
                            size="sm" 
                            onClick={() => {
                              setSelectedSnapshotId(snapshot.id);
                              setExportForm(prev => ({ ...prev, snapshot_id: snapshot.id }));
                              setCreateExportModalOpen(true);
                            }}
                          >
                            <IconDownload size={14} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            
            {snapshots.length === 0 && (
              <Text ta="center" c="dimmed" py="xl">
                No snapshots created yet. Click "Create Snapshot" to get started.
              </Text>
            )}
          </Stack>
        </Card>

        {/* Exports Section */}
        <Card withBorder>
          <Stack gap="md">
            <Group justify="space-between">
              <div>
                <Text size="lg" fw={500}>Exports</Text>
                <Text size="sm" c="dimmed">Download task data in various formats</Text>
              </div>
              <Button leftSection={<IconRefresh size={14} />} variant="light" onClick={loadExports}>
                Refresh
              </Button>
            </Group>
            
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Snapshot</Table.Th>
                  <Table.Th>Format</Table.Th>
                  <Table.Th>Split</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Size</Table.Th>
                  <Table.Th>Created</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {exports.map((exportItem) => {
                  const snapshot = snapshots.find(s => s.id === exportItem.snapshot_id);
                  return (
                    <Table.Tr key={exportItem.id}>
                      <Table.Td>
                        <Text size="sm">{snapshot?.name || 'Unknown'}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light">{exportItem.format.toUpperCase()}</Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{exportItem.split || 'All'}</Text>
                      </Table.Td>
                      <Table.Td>{getStatusBadge(exportItem.status)}</Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {exportItem.file_size_bytes ? 
                            (exportItem.file_size_bytes / 1024 / 1024).toFixed(2) + ' MB' : 
                            '-'
                          }
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs">{new Date(exportItem.created_at).toLocaleDateString()}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4}>
                          {exportItem.status === 'completed' && exportItem.download_url && (
                            <Tooltip label="Download">
                              <ActionIcon 
                                variant="light" 
                                color="green"
                                size="sm" 
                                onClick={() => handleDownloadExport(exportItem)}
                              >
                                <IconDownload size={14} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
            
            {exports.length === 0 && (
              <Text ta="center" c="dimmed" py="xl">
                No exports created yet.
              </Text>
            )}
          </Stack>
        </Card>
      </Stack>

      {/* Create Snapshot Modal */}
      <Modal
        opened={createSnapshotModalOpen}
        onClose={() => setCreateSnapshotModalOpen(false)}
        title="Create New Snapshot"
        size="lg"
      >
        <Stack gap="md">
          <TextInput
            label="Name"
            placeholder="Enter snapshot name"
            value={snapshotForm.name}
            onChange={(e) => setSnapshotForm(prev => ({ ...prev, name: e.target.value }))}
            required
          />
          
          <Textarea
            label="Description"
            placeholder="Optional description"
            value={snapshotForm.description}
            onChange={(e) => setSnapshotForm(prev => ({ ...prev, description: e.target.value }))}
            minRows={3}
          />
          
          <Text size="sm" fw={500}>Data Split Configuration</Text>
          
          <Grid>
            <Grid.Col span={4}>
              <NumberInput
                label="Train Ratio"
                value={snapshotForm.train_ratio}
                onChange={(val) => setSnapshotForm(prev => ({ ...prev, train_ratio: val || 0.7 }))}
                min={0}
                max={1}
                step={0.05}
                decimalScale={2}
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <NumberInput
                label="Validation Ratio"
                value={snapshotForm.validation_ratio}
                onChange={(val) => setSnapshotForm(prev => ({ ...prev, validation_ratio: val || 0.15 }))}
                min={0}
                max={1}
                step={0.05}
                decimalScale={2}
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <NumberInput
                label="Test Ratio"
                value={snapshotForm.test_ratio}
                onChange={(val) => setSnapshotForm(prev => ({ ...prev, test_ratio: val || 0.15 }))}
                min={0}
                max={1}
                step={0.05}
                decimalScale={2}
              />
            </Grid.Col>
          </Grid>
          
          <NumberInput
            label="Split Seed"
            description="Random seed for reproducible splits"
            value={snapshotForm.split_seed}
            onChange={(val) => setSnapshotForm(prev => ({ ...prev, split_seed: val || 0 }))}
          />
          
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setCreateSnapshotModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSnapshot} disabled={!snapshotForm.name}>
              Create Snapshot
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Create Export Modal */}
      <Modal
        opened={createExportModalOpen}
        onClose={() => setCreateExportModalOpen(false)}
        title="Create New Export"
        size="md"
      >
        <Stack gap="md">
          <Select
            label="Snapshot"
            placeholder="Select a snapshot"
            data={snapshots
              .filter(s => s.status === 'completed')
              .map(s => ({ value: s.id, label: s.name }))
            }
            value={exportForm.snapshot_id}
            onChange={(val) => setExportForm(prev => ({ ...prev, snapshot_id: val || '' }))}
            required
          />
          
          <Select
            label="Format"
            data={[
              { value: 'csv', label: 'CSV' },
              { value: 'json', label: 'JSON' },
              { value: 'jsonl', label: 'JSON Lines' },
              { value: 'parquet', label: 'Parquet' }
            ]}
            value={exportForm.format}
            onChange={(val) => setExportForm(prev => ({ ...prev, format: val as ExportFormat || 'csv' }))}
          />
          
          <Select
            label="Data Split"
            placeholder="All splits (leave empty for full dataset)"
            data={[
              { value: 'train', label: 'Training Set' },
              { value: 'validation', label: 'Validation Set' },
              { value: 'test', label: 'Test Set' }
            ]}
            value={exportForm.split}
            onChange={(val) => setExportForm(prev => ({ ...prev, split: val as DataSplit || undefined }))}
            clearable
          />
          
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setCreateExportModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateExport} disabled={!exportForm.snapshot_id}>
              Create Export
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
