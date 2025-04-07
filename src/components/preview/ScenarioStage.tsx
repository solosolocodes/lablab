'use client';

import { usePreview } from '@/contexts/PreviewContext';

export default function ScenarioStage() {
  const { currentStage } = usePreview();

  if (!currentStage || currentStage.type !== 'scenario') {
    return <div>Invalid stage type</div>;
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">{currentStage.title}</h2>
        <p className="text-gray-600 mb-6">{currentStage.description}</p>
        
        <div className="border-t border-gray-200 pt-4 mb-6">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <h3 className="font-semibold text-blue-800">Scenario Details</h3>
              <div className="mt-2 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Rounds:</span>
                  <span className="font-medium">{currentStage.rounds}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Round Duration:</span>
                  <span className="font-medium">{currentStage.roundDuration} seconds</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Duration:</span>
                  <span className="font-medium">{currentStage.durationSeconds} seconds</span>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <h3 className="font-semibold text-gray-800">This is a placeholder for the scenario interface</h3>
              <p className="text-sm text-gray-500 mt-2">
                In a real experiment, participants would interact with trading interface here.
              </p>
            </div>
          </div>
        </div>
        
        <div className="text-center text-gray-500">
          <p>This is a preview of the scenario stage. In the actual experiment, participants would see the trading interface.</p>
        </div>
      </div>
    </div>
  );
}