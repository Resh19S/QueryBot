import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Table, BarChart3, PieChart, TrendingUp, FileText } from 'lucide-react';
import { DataTable } from './DataTable';
import { PieChartComponent } from './charts/PieChart';
import { BarChartComponent } from './charts/BarChart';
import { LineChartComponent } from './charts/LineChart';

interface AnswerDisplayProps {
  result: {
    success: boolean;
    data: any[];
    columns: string[];
    question: string;
    sql_query?: string;
    message?: string;
  } | null;
}

type VisualizationType = 'table' | 'pie' | 'bar' | 'line' | 'text';

export function AnswerDisplay({ result }: AnswerDisplayProps) {
  const [visualizationType, setVisualizationType] = useState<VisualizationType>('table');

  if (!result) return null;

  if (!result.success) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
      >
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
          <p className="text-red-700 dark:text-red-400">
            {result.message || 'An error occurred while processing your query.'}
          </p>
        </div>
      </motion.div>
    );
  }

  const visualizationOptions = [
    { type: 'table' as const, icon: Table, label: 'Table View' },
    { type: 'bar' as const, icon: BarChart3, label: 'Bar Chart' },
    { type: 'pie' as const, icon: PieChart, label: 'Pie Chart' },
    { type: 'line' as const, icon: TrendingUp, label: 'Line Chart' },
    { type: 'text' as const, icon: FileText, label: 'Text Summary' }
  ];

  const getChartKeys = () => {
    if (!result.data.length) return { x: '', y: '' };
    
    const firstRow = result.data[0];
    const numericColumns = result.columns.filter(col => 
      typeof firstRow[col] === 'number'
    );
    const textColumns = result.columns.filter(col => 
      typeof firstRow[col] === 'string'
    );
    
    return {
      x: textColumns[0] || result.columns[0],
      y: numericColumns[0] || result.columns[1]
    };
  };

  const { x: xKey, y: yKey } = getChartKeys();

  const generateTextSummary = () => {
    if (!result.data.length) return "No data found for this query.";
    
    const rowCount = result.data.length;
    const colCount = result.columns.length;
    
    return `Found ${rowCount} record${rowCount !== 1 ? 's' : ''} with ${colCount} column${colCount !== 1 ? 's' : ''}. ${
      yKey && typeof result.data[0][yKey] === 'number' 
        ? `The data includes numeric values in "${yKey}" ranging from ${Math.min(...result.data.map(d => d[yKey]))} to ${Math.max(...result.data.map(d => d[yKey]))}.`
        : ''
    }`;
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      className="py-16 bg-gray-50 dark:bg-gray-800"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Query Results
            </h3>
                        
            <div className="flex flex-wrap gap-2">
              {visualizationOptions.map((option) => (
                <motion.button
                  key={option.type}
                  onClick={() => setVisualizationType(option.type)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    visualizationType === option.type
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  <option.icon className="w-4 h-4" />
                  <span>{option.label}</span>
                </motion.button>
              ))}
            </div>
          </div>

          <div className="p-6">
            <AnimatePresence mode="wait">
              {visualizationType === 'table' && (
                <motion.div
                  key="table"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  <DataTable data={result.data} columns={result.columns} />
                </motion.div>
              )}

              {visualizationType === 'pie' && (
                <motion.div
                  key="pie"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  <PieChartComponent data={result.data} dataKey={yKey} nameKey={xKey} />
                </motion.div>
              )}

              {visualizationType === 'bar' && (
                <motion.div
                  key="bar"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  <BarChartComponent data={result.data} xAxisKey={xKey} yAxisKey={yKey} />
                </motion.div>
              )}

              {visualizationType === 'line' && (
                <motion.div
                  key="line"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  <LineChartComponent data={result.data} xAxisKey={xKey} yAxisKey={yKey} />
                </motion.div>
              )}

              {visualizationType === 'text' && (
                <motion.div
                  key="text"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="prose dark:prose-invert max-w-none"
                >
                  <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-gray-800 dark:to-gray-700 rounded-xl p-6 border border-amber-200 dark:border-gray-600">
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                      Summary
                    </h4>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                      {generateTextSummary()}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {result.sql_query && (
            <div className="px-6 pb-6">
              <details className="group">
                <summary className="cursor-pointer text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
                  View Generated SQL Query
                </summary>
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  className="mt-3 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden"
                >
                  <code className="text-sm text-gray-700 dark:text-gray-300 font-mono">
                    {result.sql_query}
                  </code>
                </motion.div>
              </details>
            </div>
          )}
        </div>
      </div>
    </motion.section>
  );
}