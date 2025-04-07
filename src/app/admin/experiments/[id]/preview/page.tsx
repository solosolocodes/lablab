'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { PreviewProvider, usePreview } from '@/contexts/PreviewContext';

function SimplePreviewContent() {
  const { loadExperiment, goToNextStage } = usePreview();
  const params = useParams();
  const experimentId = params.id as string;

  useEffect(() => {
    if (experimentId) {
      loadExperiment(experimentId);
    }
  }, [experimentId, loadExperiment]);

  // Simple welcome screen
  return (
    <div className="p-4">
      <div className="max-w-2xl mx-auto p-4 bg-white rounded border text-center">
        <h3 className="text-lg font-bold mb-4">Welcome</h3>
        <p className="mb-6">Thank you. Please click Next.</p>
        <button 
          onClick={goToNextStage}
          className="px-6 py-2 bg-blue-500 text-white rounded"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default function SimplifiedPreviewPage() {
  return (
    <PreviewProvider>
      <SimplePreviewContent />
    </PreviewProvider>
  );
}