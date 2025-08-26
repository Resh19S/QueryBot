import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';

interface LineChartComponentProps {
  data: any[];
  xAxisKey: string;
  yAxisKey: string;
}

export function LineChartComponent({ data, xAxisKey, yAxisKey }: LineChartComponentProps) {
  const chartData = data.slice(0, 20).map(item => ({
    name: item[xAxisKey],
    value: typeof item[yAxisKey] === 'number' ? item[yAxisKey] : 0
  }));

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="h-96 w-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis 
            dataKey="name" 
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip 
            contentStyle={{
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              border: 'none',
              borderRadius: '8px',
              color: 'white'
            }}
          />
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke="#F59E0B" 
            strokeWidth={3}
            dot={{ fill: '#D97706', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, fill: '#B45309' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </motion.div>
  );
}