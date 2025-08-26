import React from 'react';
import { motion } from 'framer-motion';

interface DataTableProps {
  data: any[];
  columns: string[];
}

export function DataTable({ data, columns }: DataTableProps) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        No data to display
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden border border-gray-200 dark:border-gray-700 rounded-xl"
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gradient-to-r from-amber-50 to-amber-100 dark:from-gray-800 dark:to-gray-700">
            <tr>
              {columns.map((column, index) => (
                <motion.th
                  key={column}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700"
                >
                  {column}
                </motion.th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {data.slice(0, 50).map((row, rowIndex) => (
              <motion.tr
                key={rowIndex}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: rowIndex * 0.02 }}
                className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-150"
              >
                {columns.map((column) => (
                  <td key={column} className="px-6 py-4 text-sm text-gray-900 dark:text-gray-300">
                    {row[column] !== null && row[column] !== undefined 
                      ? String(row[column]) 
                      : '-'}
                  </td>
                ))}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.length > 50 && (
        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing first 50 rows of {data.length} results
          </p>
        </div>
      )}
    </motion.div>
  );
}