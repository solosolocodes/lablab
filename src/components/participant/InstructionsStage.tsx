'use client';

import { useEffect, useRef } from 'react';
import { useParticipant } from '@/contexts/ParticipantContext';

type InstructionsStageProps = {
  stage: {
    id: string;
    title: string;
    description: string;
    content: string;
    format?: string;
  };
  onNext: () => void;
};

export default function InstructionsStage({ stage, onNext }: InstructionsStageProps) {
  const { isStageTransitioning, saveStageResponse } = useParticipant();
  
  // Add ref to track component mount state
  const isMountedRef = useRef(true);
  
  // Effect to clean up when component unmounts
  useEffect(() => {
    // Set the mounted flag to true (it already is, but this is for clarity)
    isMountedRef.current = true;
    
    // Clean up function that runs when component unmounts
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  const handleNext = async () => {
    // Don't proceed if component is unmounted
    if (!isMountedRef.current) return;
    
    try {
      // Mark this stage as completed with a "done" response
      await saveStageResponse(stage.id, 'instructions', 'done');
      
      // Only proceed if component is still mounted
      if (isMountedRef.current) {
        onNext();
      }
    } catch (error) {
      console.error('Error completing instructions stage:', error);
      // Still try to proceed if we encounter an error with saving the response
      if (isMountedRef.current) {
        onNext();
      }
    }
  };
  
  // Enhanced markdown-like rendering function
  const renderContent = (content: string) => {
    if (!content) return '<p>No content available</p>';
    
    // Replace markdown headers
    let formattedContent = content
      .replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold mt-4 mb-2">$1</h2>')
      .replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold mt-3 mb-2">$1</h3>')
      .replace(/^#### (.*$)/gm, '<h4 class="text-md font-semibold mt-2 mb-1">$1</h4>');
    
    // Replace lists
    formattedContent = formattedContent.replace(/^(\d+)\. (.*)$/gm, '<li class="ml-5 list-decimal mb-1">$2</li>');
    formattedContent = formattedContent.replace(/^\* (.*)$/gm, '<li class="ml-5 list-disc mb-1">$1</li>');
    
    // Replace line breaks with paragraphs
    const paragraphs = formattedContent
      .split('\n\n')
      .map(p => p.trim())
      .filter(p => p.length > 0);
    
    // Process each paragraph
    const processedParagraphs = paragraphs.map(p => {
      if (p.startsWith('<h2') || p.startsWith('<h3') || p.startsWith('<h4')) {
        return p; // Don't wrap headers
      } else if (p.startsWith('<li')) {
        return `<ul class="my-2">${p}</ul>`; // Wrap list items
      } else {
        return `<p class="mb-2">${p}</p>`; // Wrap normal paragraphs
      }
    }).join('');
    
    return processedParagraphs;
  };
  
  return (
    <div className="w-full p-4 bg-white rounded border shadow-sm">
      <div className="mb-4 pb-3 border-b border-gray-200">
        <h3 className="text-xl font-bold mb-2">{stage.title}</h3>
        <p className="text-gray-600">{stage.description}</p>
      </div>
      
      <div 
        className="p-4 bg-gray-50 rounded border mb-5 prose max-w-none"
        dangerouslySetInnerHTML={{ __html: renderContent(stage.content) }}
      />
      
      <div className="flex justify-center">
        <button 
          onClick={handleNext}
          disabled={isStageTransitioning}
          className={`px-6 py-2 bg-blue-500 text-white rounded ${
            isStageTransitioning ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          Continue
        </button>
      </div>
    </div>
  );
}