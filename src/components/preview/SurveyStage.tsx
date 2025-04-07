'use client';

import { useState } from 'react';
import { usePreview } from '@/contexts/PreviewContext';

export default function SurveyStage() {
  const { currentStage, goToNextStage } = usePreview();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);

  if (!currentStage || currentStage.type !== 'survey') {
    return <div>Invalid stage type</div>;
  }

  const questions = currentStage.questions || [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleInputChange = (questionId: string, value: any) => {
    setFormValues(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Check if all required questions are answered
    const requiredQuestions = questions.filter(q => q.required);
    const allRequiredAnswered = requiredQuestions.every(q => formValues[q.id]);
    
    if (!allRequiredAnswered) {
      alert('Please answer all required questions before proceeding.');
      return;
    }
    
    setSubmitted(true);
    setTimeout(() => {
      goToNextStage();
    }, 1500);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderQuestionInput = (question: any) => {
    switch (question.type) {
      case 'text':
        return (
          <input
            type="text"
            className="w-full px-3 py-2 border rounded-md"
            value={formValues[question.id] || ''}
            onChange={e => handleInputChange(question.id, e.target.value)}
            disabled={submitted}
          />
        );
      
      case 'multipleChoice':
        return (
          <div className="space-y-2">
            {(question.options || []).map((option: string, idx: number) => (
              <div key={idx} className="flex items-center">
                <input
                  type="radio"
                  id={`${question.id}-${idx}`}
                  name={question.id}
                  className="mr-2"
                  checked={formValues[question.id] === option}
                  onChange={() => handleInputChange(question.id, option)}
                  disabled={submitted}
                />
                <label htmlFor={`${question.id}-${idx}`}>{option}</label>
              </div>
            ))}
          </div>
        );
      
      case 'checkboxes':
        return (
          <div className="space-y-2">
            {(question.options || []).map((option: string, idx: number) => {
              const values = formValues[question.id] || [];
              return (
                <div key={idx} className="flex items-center">
                  <input
                    type="checkbox"
                    id={`${question.id}-${idx}`}
                    className="mr-2"
                    checked={values.includes(option)}
                    onChange={(e) => {
                      const updatedValues = e.target.checked
                        ? [...(formValues[question.id] || []), option]
                        : (formValues[question.id] || []).filter((v: string) => v !== option);
                      handleInputChange(question.id, updatedValues);
                    }}
                    disabled={submitted}
                  />
                  <label htmlFor={`${question.id}-${idx}`}>{option}</label>
                </div>
              );
            })}
          </div>
        );
      
      case 'rating':
        return (
          <div className="flex space-x-2 justify-between">
            {[1, 2, 3, 4, 5].map(rating => (
              <button
                key={rating}
                type="button"
                className={`w-12 h-12 rounded-full ${
                  formValues[question.id] === rating
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
                onClick={() => handleInputChange(question.id, rating)}
                disabled={submitted}
              >
                {rating}
              </button>
            ))}
          </div>
        );
      
      default:
        return <div>Unsupported question type</div>;
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">{currentStage.title}</h2>
        <p className="text-gray-600 mb-6">{currentStage.description}</p>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-6 mb-8">
            {questions.map((question, index) => (
              <div key={question.id} className="border-b border-gray-200 pb-4 last:border-b-0">
                <div className="flex items-start mb-2">
                  <span className="bg-gray-200 text-gray-700 rounded-full w-6 h-6 flex items-center justify-center mr-2">
                    {index + 1}
                  </span>
                  <div>
                    <label className="block font-medium text-gray-800">
                      {question.text}
                      {question.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                  </div>
                </div>
                <div className="ml-8">
                  {renderQuestionInput(question)}
                </div>
              </div>
            ))}
          </div>
          
          {!submitted ? (
            <div className="flex justify-center">
              <button
                type="submit"
                className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 font-medium shadow-md"
              >
                Submit
              </button>
            </div>
          ) : (
            <div className="text-center text-green-600">
              <p>Thank you for your responses! Proceeding to next stage...</p>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}