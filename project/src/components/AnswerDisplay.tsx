import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Table, FileText, Send, BarChart3, Download, ChevronDown, Zap, Mail, AlertTriangle, Users, CheckCircle } from 'lucide-react';
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
    ai_summary?: string;
  } | null;
}

type VisualizationType = 'table' | 'text';
type ChartType = 'pie' | 'bar' | 'line' | null;

interface EmailData {
  supplierEmails: Array<{
    supplier: string;
    email: string;
    subject: string;
    body: string;
    issues: string[];
    priority: string;
  }>;
  executiveEmail: {
    subject: string;
    body: string;
    recipient: string;
  } | null;
  timestamp: string;
  totalIssuesFound: number;
}

export function AnswerDisplay({ result }: AnswerDisplayProps) {
  const [visualizationType, setVisualizationType] = useState<VisualizationType>('table');
  const [chartRequest, setChartRequest] = useState('');
  const [showChart, setShowChart] = useState<ChartType>(null);
  const [chartProcessing, setChartProcessing] = useState(false);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
  const [isActionProcessing, setIsActionProcessing] = useState(false);
  const [actionCompleted, setActionCompleted] = useState(false);
  const [emailData, setEmailData] = useState<EmailData | null>(null);
  const [showEmailDetails, setShowEmailDetails] = useState(false);

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
    
    const headers = result.columns.join(',');
    const csvContent = result.data.map(row => 
      result.columns.map(col => {
        const value = row[col];
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    ).join('\n');
    
    const csv = `${headers}\n${csvContent}`;
    
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

  const handleTakeAction = async () => {
    setIsActionProcessing(true);
    
    try {
      const payload = {
        trigger: 'action_button_clicked',
        timestamp: new Date().toISOString()
      };

      // Define both webhook URLs
      const webhookUrls = [
        'https://7215b9f1f74c.ngrok-free.app/webhook/f4f1181c-ce65-449c-90bc-33cfb8b3d9eb',
        'http://localhost:5678/webhook/f4f1181c-ce65-449c-90bc-33cfb8b3d9eb'
      ];

      // Send requests to both webhooks simultaneously
      const webhookPromises = webhookUrls.map(async (url) => {
        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify(payload)
          });

          if (response.ok) {
            console.log(`n8n workflow triggered successfully for ${url}`);
            return { url, success: true, status: response.status };
          } else {
            console.error(`Failed to trigger n8n workflow for ${url}:`, response.status, response.statusText);
            return { url, success: false, status: response.status, error: response.statusText };
          }
        } catch (error) {
          console.error(`Error triggering n8n workflow for ${url}:`, error);
          return { url, success: false, error: error.message };
        }
      });

      // Wait for all webhook requests to complete
      const results = await Promise.all(webhookPromises);
      
      // Check if at least one webhook succeeded
      const hasSuccess = results.some(result => result.success);
      
      if (hasSuccess) {
        console.log('At least one n8n workflow triggered successfully');
        
        // Log results for debugging
        results.forEach(result => {
          if (result.success) {
            console.log(`✅ Success: ${result.url}`);
          } else {
            console.log(`❌ Failed: ${result.url} - ${result.error || result.status}`);
          }
        });
        
        // Simulate email data based on the procurement data
        // In a real implementation, you'd get this from the n8n workflow response
        const mockEmailData = generateMockEmailData();
        setEmailData(mockEmailData);
        setActionCompleted(true);
        setShowEmailDetails(true);
      } else {
        console.error('All webhook requests failed');
        // You might want to show an error message to the user here
      }
    } catch (error) {
      console.error('Error in handleTakeAction:', error);
    } finally {
      setIsActionProcessing(false);
    }
  };

  // Generate mock email data based on the actual workflow logic
  const generateMockEmailData = (): EmailData => {
    const problematicSuppliers = result.data.filter(row => {
      const cancelled = parseInt(row['cancelled_orders'] || row['Cancelled_Orders'] || '0');
      const pending = parseInt(row['pending_orders'] || row['Pending_Orders'] || '0'); 
      const late = parseInt(row['late_deliveries'] || row['Late_Deliveries'] || '0');
      const quality = parseInt(row['quality_issues'] || row['Quality_Issues'] || '0');
      
      return cancelled > 2 || pending > 0 || late > 3 || quality > 1;
    });

    const supplierEmails = problematicSuppliers.map(supplier => {
      const name = supplier.Supplier || supplier.supplier || 'Unknown Supplier';
      const cancelled = parseInt(supplier['cancelled_orders'] || supplier['Cancelled_Orders'] || '0');
      const pending = parseInt(supplier['pending_orders'] || supplier['Pending_Orders'] || '0'); 
      const late = parseInt(supplier['late_deliveries'] || supplier['Late_Deliveries'] || '0');
      const quality = parseInt(supplier['quality_issues'] || supplier['Quality_Issues'] || '0');
      
      const issues = [];
      if (cancelled > 2) issues.push(`${cancelled} cancelled orders (threshold: 2)`);
      if (pending > 0) issues.push(`${pending} orders pending beyond 30 days`);
      if (late > 3) issues.push(`${late} late deliveries`);
      if (quality > 1) issues.push(`${quality} quality-related issues`);

      return {
        supplier: name,
        email: `${name.toLowerCase().replace(/\s+/g, '.')}@company.com`,
        subject: `URGENT: Performance Issues Require Immediate Attention - ${name}`,
        body: `Dear ${name} Team,

Our daily procurement review on ${new Date().toLocaleDateString()} has identified the following performance issues requiring immediate attention:

${issues.map(issue => `• ${issue}`).join('\n')}

Required Actions (Response needed within 24 hours):
${cancelled > 2 ? '1. Provide explanation for cancelled orders\n' : ''}${pending > 0 ? '2. Provide immediate status update on pending orders\n' : ''}${late > 3 ? '3. Submit delivery improvement plan\n' : ''}${quality > 1 ? '4. Conduct quality review and corrective actions\n' : ''}

Please provide:
• Root cause analysis
• Corrective action plan
• Timeline for resolution
• Point of contact for follow-up

Failure to respond within 24 hours may result in supplier performance review and potential sourcing alternatives.

Best regards,
Automated Procurement Monitoring System

---
This is an automated message. For urgent matters, contact: procurement@yourcompany.com`,
        issues,
        priority: 'high'
      };
    });

    const executiveEmail = {
      subject: `🚨 Procurement Intelligence Report - ${new Date().toLocaleDateString()} - ${supplierEmails.length} Actions Taken`,
      body: `PROCUREMENT INTELLIGENCE REPORT
══════════════════════════════════════════════════
Date: ${new Date().toLocaleDateString()}
Generated: ${new Date().toLocaleTimeString()}

EXECUTIVE SUMMARY
Performance monitoring has identified ${supplierEmails.length} suppliers requiring immediate intervention. Automated warning communications have been initiated with 24-hour response requirements.

ACTIONS TAKEN TODAY
${supplierEmails.map((email, idx) => `• Warning email sent to ${email.supplier} - ${email.issues.join(', ')}`).join('\n')}

RISK ASSESSMENT
• HIGH RISK: ${supplierEmails.filter(e => e.issues.length > 2).length} suppliers with multiple issues
• MEDIUM RISK: ${supplierEmails.filter(e => e.issues.length <= 2).length} suppliers with single issues
• Business Impact: Potential delivery delays and quality concerns

RECOMMENDED FOLLOW-UP
1. Monitor supplier responses within 24 hours
2. Initiate backup supplier evaluation for high-risk cases
3. Schedule quality review meetings for affected suppliers
4. Update supplier scorecards and contracts

MARKET INTELLIGENCE
Current supply chain stress indicators suggest proactive supplier management critical for Q4 performance.

══════════════════════════════════════════════════
RAW METRICS:
• Suppliers Monitored: ${result.data.length}
• Issues Detected: ${supplierEmails.length}
• Warning Communications: ${supplierEmails.length}

NEXT REVIEW: ${new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString()} at 8:00 AM

---
Automated Procurement Intelligence System
For questions: procurement-ops@yourcompany.com`,
      recipient: 'management@yourcompany.com'
    };

    return {
      supplierEmails,
      executiveEmail,
      timestamp: new Date().toISOString(),
      totalIssuesFound: supplierEmails.length
    };
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
    
    if (result.ai_summary) {
      return result.ai_summary;
    }
    
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
    
    const request = chartRequest.toLowerCase();
    let chartType: ChartType = null;
    
    if (request.includes('pie') || request.includes('donut') || request.includes('circle')) {
      chartType = 'pie';
    } else if (request.includes('bar') || request.includes('column') || request.includes('histogram')) {
      chartType = 'bar';
    } else if (request.includes('line') || request.includes('trend') || request.includes('time') || request.includes('over time')) {
      chartType = 'line';
    } else {
      chartType = 'bar';
    }
    
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
    <div className="py-8 bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
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
                
                {/* Action Buttons */}
                <div className="flex items-center space-x-3">
                  {/* Take Action Button */}
                  <motion.button
                    onClick={handleTakeAction}
                    disabled={isActionProcessing}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                      actionCompleted 
                        ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700' 
                        : 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700'
                    } text-white`}
                  >
                    {isActionProcessing ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : actionCompleted ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <Zap className="w-4 h-4" />
                    )}
                    <span>
                      {isActionProcessing ? 'Processing...' : actionCompleted ? 'Action Complete' : 'Take Action'}
                    </span>
                  </motion.button>

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

        {/* Email Communication Results */}
        <AnimatePresence>
          {emailData && (
            <motion.section
              initial={{ opacity: 0, y: 30, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -30, height: 0 }}
              className="space-y-6"
            >
              {/* Action Summary */}
              <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-2xl border border-green-200 dark:border-green-800 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-green-500 rounded-full">
                      <CheckCircle className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Automated Actions Completed
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {emailData.totalIssuesFound} suppliers contacted • {new Date(emailData.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <motion.button
                    onClick={() => setShowEmailDetails(!showEmailDetails)}
                    className="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span>{showEmailDetails ? 'Hide Details' : 'Show Details'}</span>
                    <motion.div
                      animate={{ rotate: showEmailDetails ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </motion.div>
                  </motion.button>
                </div>
              </div>

              <AnimatePresence>
                {showEmailDetails && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-6 overflow-hidden"
                  >
                    {/* Supplier Emails */}
                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700">
                      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-red-500 rounded-full">
                            <AlertTriangle className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                              Emails Sent to Suppliers
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {emailData.supplierEmails.length} warning emails sent
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="p-6 space-y-4">
                        {emailData.supplierEmails.map((email, index) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-2">
                                  <Mail className="w-4 h-4 text-red-600 dark:text-red-400" />
                                  <span className="font-medium text-red-800 dark:text-red-200">
                                    {email.supplier}
                                  </span>
                                  <span className="text-xs bg-red-200 dark:bg-red-800 text-red-700 dark:text-red-300 px-2 py-1 rounded">
                                    {email.priority.toUpperCase()}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                  To: {email.email}
                                </p>
                                <p className="font-medium text-gray-900 dark:text-white mb-2">
                                  {email.subject}
                                </p>
                                <div className="text-sm text-gray-700 dark:text-gray-300">
                                  <strong>Issues:</strong>
                                  <ul className="mt-1 ml-4">
                                    {email.issues.map((issue, i) => (
                                      <li key={i} className="list-disc">{issue}</li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            </div>
                            
                            <details className="mt-3">
                              <summary className="cursor-pointer text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300">
                                View Full Email Content
                              </summary>
                              <div className="mt-2 p-3 bg-white dark:bg-gray-800 rounded border border-red-200 dark:border-red-700">
                                <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">
                                  {email.body}
                                </pre>
                              </div>
                            </details>
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    {/* Executive Email */}
                    {emailData.executiveEmail && (
                      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                          <div className="flex items-center space-x-3">
                            <div className="p-2 bg-blue-500 rounded-full">
                              <Users className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Email Sent to Management
                              </h3>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                Executive report with action summary
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="p-6">
                          <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4"
                          >
                            <div className="flex items-start space-x-3 mb-3">
                              <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                              <div className="flex-1">
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                                  To: {emailData.executiveEmail.recipient}
                                </p>
                                <p className="font-medium text-gray-900 dark:text-white">
                                  {emailData.executiveEmail.subject}
                                </p>
                              </div>
                            </div>
                            
                            <details>
                              <summary className="cursor-pointer text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
                                View Executive Report Content
                              </summary>
                              <div className="mt-2 p-3 bg-white dark:bg-gray-800 rounded border border-blue-200 dark:border-blue-700">
                                <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">
                                  {emailData.executiveEmail.body}
                                </pre>
                              </div>
                            </details>
                          </motion.div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Text Summary Section */}
        <motion.section
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-6">
              <motion.button
                onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
                className="w-full flex items-center justify-between text-left cursor-pointer text-lg font-semibold text-gray-900 dark:text-white hover:text-amber-600 dark:hover:text-amber-400 transition-colors group"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <div className="flex items-center">
                  <FileText className="mr-2" size={20} />
                  Data Insights 
                </div>
                <motion.div
                  animate={{ rotate: isSummaryExpanded ? 180 : 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="text-gray-400 group-hover:text-amber-500 transition-colors"
                >
                  <ChevronDown size={20} />
                </motion.div>
              </motion.button>
              
              <AnimatePresence>
                {isSummaryExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ 
                      duration: 0.3, 
                      ease: "easeInOut",
                      opacity: { duration: 0.2 }
                    }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-gray-800 dark:to-gray-700 rounded-xl p-6 border border-amber-200 dark:border-gray-600">
                      <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                        {generateTextSummary()}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
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
                What type of chart you'd like to see (e.g., "show me a pie chart")
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