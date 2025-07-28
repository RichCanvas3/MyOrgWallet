import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface ProgressStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  progress?: number; // 0-100
  error?: string;
}

export interface ProgressState {
  isVisible: boolean;
  title: string;
  description: string;
  steps: ProgressStep[];
  currentStepIndex: number;
  overallProgress: number;
}

interface ProgressContextType {
  progress: ProgressState;
  startProgress: (title: string, description: string, steps: ProgressStep[]) => void;
  updateStep: (stepId: string, updates: Partial<ProgressStep>) => void;
  completeStep: (stepId: string) => void;
  errorStep: (stepId: string, error: string) => void;
  setStepProgress: (stepId: string, progress: number) => void;
  completeProgress: () => void;
  hideProgress: () => void;
}

const ProgressContext = createContext<ProgressContextType | undefined>(undefined);

export const useProgress = () => {
  const context = useContext(ProgressContext);
  if (!context) {
    throw new Error('useProgress must be used within a ProgressProvider');
  }
  return context;
};

interface ProgressProviderProps {
  children: ReactNode;
}

export const ProgressProvider: React.FC<ProgressProviderProps> = ({ children }) => {
  const [progress, setProgress] = useState<ProgressState>({
    isVisible: false,
    title: '',
    description: '',
    steps: [],
    currentStepIndex: 0,
    overallProgress: 0,
  });

  const startProgress = (title: string, description: string, steps: ProgressStep[]) => {
    setProgress({
      isVisible: true,
      title,
      description,
      steps: steps.map(step => ({ ...step, status: 'pending' as const })),
      currentStepIndex: 0,
      overallProgress: 0,
    });
  };

  const updateStep = (stepId: string, updates: Partial<ProgressStep>) => {
    setProgress(prev => {
      const newSteps = prev.steps.map(step =>
        step.id === stepId ? { ...step, ...updates } : step
      );
      
      // Calculate overall progress
      const completedSteps = newSteps.filter(step => step.status === 'completed').length;
      const totalSteps = newSteps.length;
      const overallProgress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
      
      // Find current step index
      const currentStepIndex = newSteps.findIndex(step => step.status === 'in-progress');
      
      return {
        ...prev,
        steps: newSteps,
        currentStepIndex: currentStepIndex >= 0 ? currentStepIndex : prev.currentStepIndex,
        overallProgress,
      };
    });
  };

  const completeStep = (stepId: string) => {
    updateStep(stepId, { status: 'completed', progress: 100 });
  };

  const errorStep = (stepId: string, error: string) => {
    updateStep(stepId, { status: 'error', error });
  };

  const setStepProgress = (stepId: string, progress: number) => {
    updateStep(stepId, { progress });
  };

  const completeProgress = () => {
    setProgress(prev => ({
      ...prev,
      isVisible: false,
    }));
  };

  const hideProgress = () => {
    setProgress(prev => ({
      ...prev,
      isVisible: false,
    }));
  };

  return (
    <ProgressContext.Provider value={{
      progress,
      startProgress,
      updateStep,
      completeStep,
      errorStep,
      setStepProgress,
      completeProgress,
      hideProgress,
    }}>
      {children}
    </ProgressContext.Provider>
  );
}; 