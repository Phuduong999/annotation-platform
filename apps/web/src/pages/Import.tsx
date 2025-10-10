import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Title,
  Text,
  Stack,
  Paper,
  Group,
  Button,
  Progress,
  Alert,
  List,
  Badge,
  ThemeIcon,
  FileInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconFileTypeCsv,
  IconAlertCircle,
  IconDownload,
  IconArrowRight,
} from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { importService, ImportJobResult } from '../services/import.service';

export function Import() {
  const navigate = useNavigate();
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<ImportJobResult | null>(null);

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: (file: File) => importService.uploadCSV(file, 'current-user'),
    onSuccess: (data) => {
      setUploadResult(data);
      notifications.show({
        title: 'Upload Successful',
        message: `Processed ${data.totalRows} rows: ${data.validRows} valid, ${data.invalidRows} invalid`,
        color: data.invalidRows > 0 ? 'yellow' : 'green',
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Upload Failed',
        message: error.response?.data?.error || 'Failed to upload CSV file',
        color: 'red',
      });
    },
  });

  const handleFileChange = (file: File | null) => {
    if (file) {
      setUploadedFile(file);
      setUploadResult(null);
      uploadMutation.mutate(file);
    }
  };

  const handleDownloadErrors = async () => {
    if (!uploadResult?.jobId) return;

    try {
      const blob = await importService.downloadErrorReport(uploadResult.jobId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `errors_${uploadResult.jobId}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      notifications.show({
        title: 'Download Started',
        message: 'Error report is being downloaded',
        color: 'blue',
      });
    } catch (error) {
      notifications.show({
        title: 'Download Failed',
        message: 'Failed to download error report',
        color: 'red',
      });
    }
  };

  const handleReset = () => {
    setUploadedFile(null);
    setUploadResult(null);
    uploadMutation.reset();
  };

  return (
    <Container size="lg" py="xl">
      <Stack gap="lg">
        {/* Header */}
        <div>
          <Title order={1}>Import Data</Title>
          <Text size="sm" c="dimmed" mt="xs">
            Upload a CSV or XLSX file to import data. Files are validated and processed in two steps:
            first validation and import, then task creation from valid rows with good assets.
          </Text>
        </div>

        {/* Upload Area */}
        {!uploadResult && (
          <Paper withBorder p="xl" radius="md">
            <Stack align="center" gap="md">
              <IconFileTypeCsv size={52} stroke={1.5} />
              <Text size="xl" fw={500}>
                Upload CSV or XLSX File
              </Text>
              <Text size="sm" c="dimmed" ta="center">
                Select a CSV or Excel file to import tasks (max 10MB)
              </Text>
              <FileInput
                placeholder="Choose CSV or XLSX file"
                accept=".csv,.xlsx,.xls,text/csv,application/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                value={uploadedFile}
                onChange={handleFileChange}
                disabled={uploadMutation.isPending}
                size="md"
                w="100%"
                maw={400}
              />
            </Stack>
          </Paper>
        )}

        {/* Upload Progress */}
        {uploadMutation.isPending && (
          <Paper withBorder p="md">
            <Stack gap="xs">
              <Text size="sm" fw={500}>
                Uploading and processing...
              </Text>
              <Progress value={100} animated />
            </Stack>
          </Paper>
        )}

        {/* Upload Result */}
        {uploadResult && (
          <Stack gap="md">
            <Alert
              icon={uploadResult.invalidRows > 0 ? <IconAlertCircle /> : <IconCheck />}
              title="Import Completed"
              color={uploadResult.invalidRows > 0 ? 'yellow' : 'green'}
            >
              <Stack gap="xs">
                <Text size="sm">
                  Successfully processed <strong>{uploadResult.filename}</strong>
                </Text>
                <Group gap="md">
                  <Badge color="blue" size="lg">
                    Total: {uploadResult.totalRows}
                  </Badge>
                  <Badge color="green" size="lg">
                    Valid: {uploadResult.validRows}
                  </Badge>
                  {uploadResult.invalidRows > 0 && (
                    <Badge color="red" size="lg">
                      Invalid: {uploadResult.invalidRows}
                    </Badge>
                  )}
                </Group>
              </Stack>
            </Alert>

            {uploadResult.invalidRows > 0 && (
              <Paper withBorder p="md">
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Text size="sm" fw={500}>
                      <ThemeIcon size="sm" radius="xl" color="red" variant="light" mr="xs">
                        <IconAlertCircle size={14} />
                      </ThemeIcon>
                      Validation Errors Found
                    </Text>
                    <Button
                      size="xs"
                      variant="light"
                      leftSection={<IconDownload size={16} />}
                      onClick={handleDownloadErrors}
                    >
                      Download Error Report
                    </Button>
                  </Group>
                  <Text size="xs" c="dimmed">
                    {uploadResult.invalidRows} row(s) failed validation. Download the error report to see
                    details and fix the issues.
                  </Text>
                </Stack>
              </Paper>
            )}

            <Paper withBorder p="md">
              <Stack gap="sm">
                <Text size="sm" fw={500}>
                  Next Steps
                </Text>
                <List size="sm" spacing="xs">
                  <List.Item>
                    {uploadResult.validRows} rows have been validated and imported successfully
                  </List.Item>
                  <List.Item>Tasks will be created from valid rows with good asset links</List.Item>
                  <List.Item>Use the Task Creation endpoint to generate tasks from this import</List.Item>
                  <List.Item>View all tasks in the task list after creation</List.Item>
                </List>
                <Group>
                  <Button
                    variant="filled"
                    rightSection={<IconArrowRight size={16} />}
                    onClick={() => navigate('/tasks')}
                  >
                    Go to Task List
                  </Button>
                  <Button variant="light" onClick={handleReset}>
                    Upload Another File
                  </Button>
                </Group>
              </Stack>
            </Paper>
          </Stack>
        )}

        {/* CSV Format Guide */}
        <Paper withBorder p="md">
          <Stack gap="sm">
            <Text size="sm" fw={500}>
              CSV Format Requirements
            </Text>
            <Text size="xs" c="dimmed">
              Your CSV file must include the following columns:
            </Text>
            <List size="xs" spacing="xs">
              <List.Item>
                <strong>date</strong> - Scan date in ISO-8601 format (e.g., 2025-10-09T10:00:00Z)
              </List.Item>
              <List.Item>
                <strong>request_id</strong> - Unique identifier for each request
              </List.Item>
              <List.Item>
                <strong>user_id</strong> - User who created the request
              </List.Item>
              <List.Item>
                <strong>team_id</strong> - Team identifier
              </List.Item>
              <List.Item>
                <strong>type</strong> - Scan type: <strong>meal</strong>, <strong>label</strong>, <strong>front_label</strong>, <strong>screenshot</strong>, or <strong>others</strong>
              </List.Item>
              <List.Item>
                <strong>user_input</strong> - Image URL (must be valid HTTP/HTTPS URL with image extension)
              </List.Item>
              <List.Item>
                <strong>raw_ai_output</strong> - AI model output as JSON string
              </List.Item>
            </List>
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}
