import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Button from '../components/Button';
import Input from '../components/Input';

type FilterValues = {
  experimentId: string;
  dateFrom: string;
  dateTo: string;
  participantId: string;
};

const Reports: React.FC = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [experiments, setExperiments] = useState<Array<{ _id: string; name: string }>>([]);
  const [activeTab, setActiveTab] = useState<'responses' | 'transactions' | 'progress'>('responses');
  const [filters, setFilters] = useState<FilterValues>({
    experimentId: '',
    dateFrom: '',
    dateTo: '',
    participantId: ''
  });
  
  const [surveyResponses, setSurveyResponses] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [participantProgress, setParticipantProgress] = useState<any[]>([]);

  // Fetch experiments for the dropdown
  useEffect(() => {
    const fetchExperiments = async () => {
      try {
        // This would be replaced with actual API call
        const response = await fetch('/api/experiments');
        const data = await response.json();
        setExperiments(data);
      } catch (error) {
        console.error('Failed to fetch experiments:', error);
      }
    };

    fetchExperiments();
  }, []);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleApplyFilters = async () => {
    setLoading(true);
    try {
      // This would be replaced with actual API calls
      if (activeTab === 'responses') {
        // Fetch survey responses
        const response = await fetch(`/api/reports/survey-responses?${new URLSearchParams(filters as any)}`);
        const data = await response.json();
        setSurveyResponses(data);
      } else if (activeTab === 'transactions') {
        // Fetch transactions
        const response = await fetch(`/api/reports/transactions?${new URLSearchParams(filters as any)}`);
        const data = await response.json();
        setTransactions(data);
      } else if (activeTab === 'progress') {
        // Fetch participant progress
        const response = await fetch(`/api/reports/participant-progress?${new URLSearchParams(filters as any)}`);
        const data = await response.json();
        setParticipantProgress(data);
      }
    } catch (error) {
      console.error(`Failed to fetch ${activeTab}:`, error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    let data: any[] = [];
    let filename = '';
    
    if (activeTab === 'responses') {
      data = surveyResponses;
      filename = 'survey-responses.csv';
    } else if (activeTab === 'transactions') {
      data = transactions;
      filename = 'transactions.csv';
    } else if (activeTab === 'progress') {
      data = participantProgress;
      filename = 'participant-progress.csv';
    }
    
    if (data.length === 0) return;
    
    // Convert data to CSV
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const cellValue = row[header];
          return typeof cellValue === 'string' ? `"${cellValue.replace(/"/g, '""')}"` : cellValue;
        }).join(',')
      )
    ].join('\n');
    
    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderTableContent = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center h-64">
          <div className="spinner"></div>
        </div>
      );
    }

    if (activeTab === 'responses' && surveyResponses.length > 0) {
      return (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Participant</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Experiment</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stage</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted At</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Responses</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {surveyResponses.map((response, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap">{response.userId}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{response.experimentId}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{response.stageId}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{new Date(response.submittedAt).toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <pre className="text-xs">{JSON.stringify(response.responses, null, 2)}</pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (activeTab === 'transactions' && transactions.length > 0) {
      return (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Participant</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asset</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Value</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Round</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {transactions.map((transaction, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap">{transaction.userId}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      transaction.type === 'buy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {transaction.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{transaction.symbol}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{transaction.quantity}</td>
                  <td className="px-6 py-4 whitespace-nowrap">${transaction.price.toFixed(2)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">${transaction.totalValue.toFixed(2)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{transaction.roundNumber}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{new Date(transaction.timestamp).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (activeTab === 'progress' && participantProgress.length > 0) {
      return (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Participant</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Experiment</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Started At</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completed At</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Activity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completed Stages</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {participantProgress.map((progress, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap">{progress.userId}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{progress.experimentId}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      progress.status === 'completed' 
                        ? 'bg-green-100 text-green-800' 
                        : progress.status === 'in_progress' 
                          ? 'bg-yellow-100 text-yellow-800' 
                          : 'bg-gray-100 text-gray-800'
                    }`}>
                      {progress.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{progress.startedAt ? new Date(progress.startedAt).toLocaleString() : '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{progress.completedAt ? new Date(progress.completedAt).toLocaleString() : '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{new Date(progress.lastActivityAt).toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{progress.completedStages?.length || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    return (
      <div className="text-center py-10 text-gray-500">
        Apply filters to load data
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-6">Experiment Reports</h1>
      
      {/* Tabs */}
      <div className="flex border-b mb-6">
        <button 
          className={`py-2 px-4 font-medium ${activeTab === 'responses' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
          onClick={() => setActiveTab('responses')}
        >
          Survey Responses
        </button>
        <button 
          className={`py-2 px-4 font-medium ${activeTab === 'transactions' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
          onClick={() => setActiveTab('transactions')}
        >
          Transactions
        </button>
        <button 
          className={`py-2 px-4 font-medium ${activeTab === 'progress' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
          onClick={() => setActiveTab('progress')}
        >
          Participant Progress
        </button>
      </div>
      
      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <h2 className="text-lg font-medium mb-4">Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label htmlFor="experimentId" className="block text-sm font-medium text-gray-700 mb-1">
              Experiment
            </label>
            <select
              id="experimentId"
              name="experimentId"
              value={filters.experimentId}
              onChange={handleFilterChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Experiments</option>
              {experiments.map(exp => (
                <option key={exp._id} value={exp._id}>{exp.name}</option>
              ))}
            </select>
          </div>
          
          <Input
            id="dateFrom"
            name="dateFrom"
            type="date"
            label="Date From"
            value={filters.dateFrom}
            onChange={handleFilterChange}
          />
          
          <Input
            id="dateTo"
            name="dateTo"
            type="date"
            label="Date To"
            value={filters.dateTo}
            onChange={handleFilterChange}
          />
          
          <Input
            id="participantId"
            name="participantId"
            label="Participant ID"
            value={filters.participantId}
            onChange={handleFilterChange}
          />
        </div>
        
        <div className="mt-4 flex justify-end">
          <Button 
            variant="primary" 
            onClick={handleApplyFilters}
            isLoading={loading}
          >
            Apply Filters
          </Button>
        </div>
      </div>
      
      {/* Table with export option */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-medium">
            {activeTab === 'responses' && 'Survey Responses'}
            {activeTab === 'transactions' && 'Transactions'}
            {activeTab === 'progress' && 'Participant Progress'}
          </h2>
          <Button 
            variant="outline" 
            onClick={handleExportCSV}
            disabled={
              (activeTab === 'responses' && surveyResponses.length === 0) || 
              (activeTab === 'transactions' && transactions.length === 0) || 
              (activeTab === 'progress' && participantProgress.length === 0)
            }
          >
            Export CSV
          </Button>
        </div>
        
        {renderTableContent()}
      </div>
    </div>
  );
};

export default Reports;