import React from 'react';
import { Box, Title, Text, Group, ActionIcon, Menu } from '@mantine/core';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Brush,
  Cell,
} from 'recharts';
import { IconDotsVertical, IconDownload, IconMaximize } from '@tabler/icons-react';
import { format } from 'date-fns';

interface MetricsChartProps {
  title: string;
  data: any[];
  type: 'line' | 'area' | 'bar' | 'scatter' | 'multi-line' | 'composed' | 'heatmap';
  color?: string;
  colors?: string[];
  height?: number;
  showTrend?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  showArea?: boolean;
  stacked?: boolean;
  yAxisSuffix?: string;
  yAxisDomain?: [number, number];
  enableZoom?: boolean;
  colorScheme?: string;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const CustomTooltip = ({ active, payload, label, suffix = '' }: any) => {
  if (active && payload && payload.length) {
    return (
      <Box
        p="sm"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
        }}
      >
        <Text size="sm" fw={600} mb={4}>
          {label && format(new Date(label), 'MMM dd, HH:mm')}
        </Text>
        {payload.map((entry: any, index: number) => (
          <Text key={index} size="xs" style={{ color: entry.color }}>
            {entry.name}: {entry.value?.toFixed(2)}{suffix}
          </Text>
        ))}
      </Box>
    );
  }
  return null;
};

export function MetricsChart({
  title,
  data,
  type,
  color = '#3b82f6',
  colors = COLORS,
  height = 350,
  showTrend = false,
  showLegend = false,
  showTooltip = true,
  showArea = false,
  stacked = false,
  yAxisSuffix = '',
  yAxisDomain,
  enableZoom = false,
  colorScheme = 'blues',
}: MetricsChartProps) {
  // Calculate trend line if needed
  const trendLine = showTrend ? calculateTrendLine(data) : null;

  const renderChart = () => {
    switch (type) {
      case 'line':
      case 'multi-line':
        const dataKeys = type === 'multi-line' 
          ? Object.keys(data[0] || {}).filter(key => key !== 'timestamp' && key !== 'date')
          : ['value'];
        
        return (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(value) => format(new Date(value), 'HH:mm')}
              stroke="#9ca3af"
            />
            <YAxis
              stroke="#9ca3af"
              domain={yAxisDomain}
              tickFormatter={(value) => `${value}${yAxisSuffix}`}
            />
            {showTooltip && <Tooltip content={<CustomTooltip suffix={yAxisSuffix} />} />}
            {showLegend && <Legend />}
            {enableZoom && <Brush dataKey="timestamp" height={30} stroke={color} />}
            
            {dataKeys.map((key, index) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={colors[index % colors.length]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6 }}
              />
            ))}
            
            {showArea && (
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                fill={color}
                fillOpacity={0.1}
              />
            )}
            
            {trendLine && (
              <ReferenceLine
                stroke="#9ca3af"
                strokeDasharray="5 5"
                segment={trendLine}
              />
            )}
          </LineChart>
        );

      case 'area':
        return (
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(value) => format(new Date(value), 'HH:mm')}
              stroke="#9ca3af"
            />
            <YAxis
              stroke="#9ca3af"
              domain={yAxisDomain}
              tickFormatter={(value) => `${value}${yAxisSuffix}`}
            />
            {showTooltip && <Tooltip content={<CustomTooltip suffix={yAxisSuffix} />} />}
            {showLegend && <Legend />}
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              fill={color}
              fillOpacity={0.3}
            />
          </AreaChart>
        );

      case 'bar':
        const barDataKeys = Object.keys(data[0] || {}).filter(
          key => key !== 'timestamp' && key !== 'date' && key !== 'name'
        );
        
        return (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(value) => format(new Date(value), 'HH:mm')}
              stroke="#9ca3af"
            />
            <YAxis
              stroke="#9ca3af"
              tickFormatter={(value) => `${value}${yAxisSuffix}`}
            />
            {showTooltip && <Tooltip content={<CustomTooltip suffix={yAxisSuffix} />} />}
            {showLegend && <Legend />}
            
            {stacked ? (
              barDataKeys.map((key, index) => (
                <Bar
                  key={key}
                  dataKey={key}
                  stackId="stack"
                  fill={colors[index % colors.length]}
                />
              ))
            ) : (
              <Bar dataKey="value" fill={color}>
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.alert ? '#ef4444' : color}
                  />
                ))}
              </Bar>
            )}
          </BarChart>
        );

      case 'scatter':
        return (
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="x"
              type="number"
              stroke="#9ca3af"
              domain={['dataMin', 'dataMax']}
            />
            <YAxis
              dataKey="y"
              type="number"
              stroke="#9ca3af"
              domain={yAxisDomain || ['dataMin', 'dataMax']}
            />
            {showTooltip && <Tooltip cursor={{ strokeDasharray: '3 3' }} />}
            <Scatter
              name="Data"
              data={data}
              fill={color}
            />
          </ScatterChart>
        );

      case 'heatmap':
        // Simple heatmap using colored bars
        return (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="hour" stroke="#9ca3af" />
            <YAxis dataKey="day" stroke="#9ca3af" />
            {showTooltip && <Tooltip />}
            <Bar dataKey="value">
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getHeatmapColor(entry.value, colorScheme)}
                />
              ))}
            </Bar>
          </BarChart>
        );

      default:
        return null;
    }
  };

  return (
    <Box h={height}>
      <Group justify="space-between" mb="sm">
        <Title order={5}>{title}</Title>
        <Menu shadow="md" width={200}>
          <Menu.Target>
            <ActionIcon variant="subtle" color="gray">
              <IconDotsVertical size={16} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item leftSection={<IconDownload size={14} />}>
              Export as PNG
            </Menu.Item>
            <Menu.Item leftSection={<IconDownload size={14} />}>
              Export as CSV
            </Menu.Item>
            <Menu.Item leftSection={<IconMaximize size={14} />}>
              View Fullscreen
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
      
      <ResponsiveContainer width="100%" height={height - 40}>
        {renderChart()}
      </ResponsiveContainer>
    </Box>
  );
}

// Helper functions
function calculateTrendLine(data: any[]): any {
  if (!data || data.length < 2) return null;
  
  // Simple linear regression
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  const n = data.length;
  
  data.forEach((point, index) => {
    const x = index;
    const y = point.value || 0;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  });
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  return [
    { x: data[0].timestamp, y: intercept },
    { x: data[data.length - 1].timestamp, y: intercept + slope * (n - 1) },
  ];
}

function getHeatmapColor(value: number, scheme: string): string {
  const intensity = Math.min(Math.max(value / 100, 0), 1);
  
  const schemes: Record<string, string[]> = {
    blues: ['#e0f2fe', '#7dd3fc', '#0ea5e9', '#0369a1', '#082f49'],
    reds: ['#fee2e2', '#fca5a5', '#ef4444', '#b91c1c', '#7f1d1d'],
    greens: ['#dcfce7', '#86efac', '#22c55e', '#15803d', '#14532d'],
  };
  
  const colors = schemes[scheme] || schemes.blues;
  const index = Math.floor(intensity * (colors.length - 1));
  return colors[index];
}