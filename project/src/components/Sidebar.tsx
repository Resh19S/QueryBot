import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Database, Settings, FileText } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onFileUpload: (file: File) => void;
  uploadStatus?: string;
  isFileUploaded?: boolean;
  dataOverview?: any;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  isOpen, 
  onClose, 
  onFileUpload, 
  uploadStatus, 
  isFileUploaded,
  dataOverview 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileUpload(file);
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={onClose}
          />
          
          {/* Sidebar */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 20, stiffness: 100 }}
            className="fixed right-0 top-0 h-full w-80 bg-white dark:bg-gray-900 shadow-2xl z-50 overflow-y-auto"
          >
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                  <Settings className="mr-2" size={20} />
                  Settings
                </h2>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <X size={20} className="text-gray-600 dark:text-gray-400" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* File Upload Section */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                  <Database className="mr-2" size={18} />
                  Data Upload
                </h3>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                
                <button
                  onClick={triggerFileUpload}
                  className="w-full p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-400 dark:hover:border-blue-400 transition-colors group"
                >
                  <Upload className="mx-auto mb-2 text-gray-400 group-hover:text-blue-400" size={24} />
                  <p className="text-sm text-gray-600 dark:text-gray-400 group-hover:text-blue-400">
                    Click to upload CSV file
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Supports supply chain and procurement data
                  </p>
                </button>

                {/* Upload Status */}
                {uploadStatus && (
                  <div className={`mt-3 p-3 rounded-lg text-sm ${
                    uploadStatus.includes('✅') 
                      ? 'bg-green-50 text-green-800 border border-green-200' 
                      : uploadStatus.includes('❌') 
                      ? 'bg-red-50 text-red-800 border border-red-200'
                      : 'bg-blue-50 text-blue-800 border border-blue-200'
                  }`}>
                    {uploadStatus}
                  </div>
                )}
              </div>

              {/* Data Information */}
              {isFileUploaded && dataOverview && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                    <FileText className="mr-2" size={18} />
                    Data Information
                  </h3>
                  
                  <div className="space-y-3">
                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        Records: {dataOverview.total_records?.toLocaleString()}
                      </div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        Columns: {dataOverview.columns}
                      </div>
                    </div>

                    {dataOverview.column_names && (
                      <div>
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Available Columns:
                        </div>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {dataOverview.column_names.map((column: string, index: number) => (
                            <div
                              key={index}
                              className="text-xs px-2 py-1 bg-blue-50 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded"
                            >
                              {column}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {dataOverview.top_suppliers && (
                      <div>
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Top Suppliers:
                        </div>
                        <div className="space-y-1">
                          {Object.entries(dataOverview.top_suppliers).slice(0, 5).map(([supplier, count], index) => (
                            <div
                              key={index}
                              className="text-xs flex justify-between px-2 py-1 bg-green-50 dark:bg-green-900 text-green-800 dark:text-green-200 rounded"
                            >
                              <span>{supplier}</span>
                              <span>{count as number}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {dataOverview.order_status_distribution && (
                      <div>
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Order Status:
                        </div>
                        <div className="space-y-1">
                          {Object.entries(dataOverview.order_status_distribution).map(([status, count], index) => (
                            <div
                              key={index}
                              className="text-xs flex justify-between px-2 py-1 bg-purple-50 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded"
                            >
                              <span>{status}</span>
                              <span>{count as number}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* API Configuration */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  🔧 API Configuration
                </h3>
                <div className="space-y-3">
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                    <div className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                      Backend Server
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      https://querybot-production.up.railway.app
                    </div>
                  </div>
                  
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};