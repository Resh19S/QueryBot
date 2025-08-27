import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Table, FileText, Send, BarChart3, Download } from 'lucide-react';
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

type VisualizationType = 'table' | 'text';
type ChartType = 'pie' | 'bar' | 'line' | null;

export function AnswerDisplay({ result }: AnswerDisplayProps) {
  const [visualizationType, setVisualizationType] = useState<VisualizationType>('table');
  const [chartRequest, setChartRequest] = useState('');
  const [showChart, setShowChart] = useState<ChartType>(null);
  const [chartProcessing, setChartProcessing] = useState(false);

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

  const downloadCSV = () => {
    if (!result.data.length) return;
    
    // Convert data to CSV format
    const headers = result.columns.join(',');
    const csvContent = result.data.map(row => 
      result.columns.map(col => {
        const value = row[col];
        // Handle values that contain commas or quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    ).join('\n');
    
    const csv = `${headers}\n${csvContent}`;
    
    // Create and download the file
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'query_results.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
    
    // Use the AI-generated summary from the backend if available
    if (result.ai_summary) {
      return result.ai_summary;
    }
    
    // Fallback to basic summary if AI summary is not available
    const rowCount = result.data.length;
    const colCount = result.columns.length;
    
    return `Found ${rowCount} record${rowCount !== 1 ? 's' : ''} with ${colCount} column${colCount !== 1 ? 's' : ''}. ${
      yKey && typeof result.data[0][yKey] === 'number' 
        ? `The data includes numeric values in "${yKey}" ranging from ${Math.min(...result.data.map(d => d[yKey]))} to ${Math.max(...result.data.map(d => d[yKey]))}.`
        : ''
    }`;
  };

  const handleChartRequest = async () => {
    if (!chartRequest.trim()) return;
    
    setChartProcessing(true);
    
    // Simple keyword matching for chart types
    const request = chartRequest.toLowerCase();
    let chartType: ChartType = null;
    
    if (request.includes('pie') || request.includes('donut') || request.includes('circle')) {
      chartType = 'pie';
    } else if (request.includes('bar') || request.includes('column') || request.includes('histogram')) {
      chartType = 'bar';
    } else if (request.includes('line') || request.includes('trend') || request.includes('time') || request.includes('over time')) {
      chartType = 'line';
    } else {
      // Default to bar chart for numeric data requests
      chartType = 'bar';
    }
    
    // Simulate processing delay
    setTimeout(() => {
      setShowChart(chartType);
      setChartProcessing(false);
    }, 1000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleChartRequest();
    }
  };

  return (
    <div className="py-16 bg-gray-50 dark:bg-gray-800">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Main Query Results */}
        <motion.section
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* SQL Query Section */}
            {result.sql_query && (
              <div className="px-6 pt-6">
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

            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Query Results
                </h3>
                
                {/* Download Button */}
                <motion.button
                  onClick={downloadCSV}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg text-sm font-medium hover:from-green-600 hover:to-green-700 transition-all duration-200 shadow-lg"
                >
                  <Download className="w-4 h-4" />
                  <span>Download CSV</span>
                </motion.button>
              </div>
            </div>

            <div className="p-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key="table"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  <DataTable data={result.data} columns={result.columns} />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.section>

        {/* Text Summary Section */}
        <motion.section
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <FileText className="mr-2" size={20} />
                Data Summary
              </h3>
            </div>

            <div className="p-6">
              <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-gray-800 dark:to-gray-700 rounded-xl p-6 border border-amber-200 dark:border-gray-600">
  
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  {generateTextSummary()}
                </p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Chart Request Section */}
        <motion.section
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <BarChart3 className="mr-2" size={20} />
                Data Visualization
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                what type of chart you'd like to see (e.g., "show me a pie chart")
              </p>
            </div>

            <div className="p-6">
              <div className="flex space-x-3">
                <input
                  type="text"
                  value={chartRequest}
                  onChange={(e) => setChartRequest(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="What kind of chart would you like to see?"
                  className="flex-1 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-colors"
                />
                <motion.button
                  onClick={handleChartRequest}
                  disabled={!chartRequest.trim() || chartProcessing}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:from-amber-600 hover:to-amber-700 transition-all duration-200 flex items-center space-x-2"
                >
                  {chartProcessing ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send size={16} />
                  )}
                  <span>{chartProcessing ? 'Creating...' : 'Create Chart'}</span>
                </motion.button>
              </div>

              {/* Chart Display */}
              <AnimatePresence>
                {showChart && (
                  <motion.div
                    initial={{ opacity: 0, y: 20, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -20, height: 0 }}
                    className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700"
                  >
                    <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-4">
                      Generated Chart
                    </h4>
                    
                    {showChart === 'pie' && (
                      <PieChartComponent data={result.data} dataKey={yKey} nameKey={xKey} />
                    )}

                    {showChart === 'bar' && (
                      <BarChartComponent data={result.data} xAxisKey={xKey} yAxisKey={yKey} />
                    )}

                    {showChart === 'line' && (
                      <LineChartComponent data={result.data} xAxisKey={xKey} yAxisKey={yKey} />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  );
}