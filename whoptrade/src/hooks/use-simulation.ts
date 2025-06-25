import { useState, useEffect, useRef } from 'react';
import { 
  SimulationService, 
  SimulationConfig, 
  SimulationState, 
  SimulationBar 
} from '@/lib/simulation-service';

/**
 * Custom hook to use the practice trading simulation service
 */
export function useSimulation() {
  // State for simulation
  const [simulationState, setSimulationState] = useState<SimulationState>({
    currentDateTime: new Date(),
    isActive: false,
    isPaused: false,
    progress: 0,
    visibleBars: []
  });
  
  // Keep a ref to the simulation service so it persists across renders
  const simulationService = useRef<SimulationService | null>(null);
  
  // Initialize the simulation service on first render
  useEffect(() => {
    if (!simulationService.current) {
      simulationService.current = new SimulationService();
      
      // Set up listeners for simulation updates
      const unsubscribe = simulationService.current.onDataUpdate((state) => {
        setSimulationState(state);
      });
      
      // Clean up listeners on unmount
      return () => {
        unsubscribe();
        if (simulationService.current) {
          simulationService.current.stop();
        }
      };
    }
  }, []);
  
  // Function to initialize the simulation with data and config
  const initializeSimulation = (data: SimulationBar[], config: SimulationConfig) => {
    if (simulationService.current) {
      simulationService.current.initialize(data, config);
    }
  };
  
  // Function to start the simulation
  const startSimulation = () => {
    if (simulationService.current) {
      simulationService.current.start();
    }
  };
  
  // Function to pause the simulation
  const pauseSimulation = () => {
    if (simulationService.current) {
      simulationService.current.pause();
    }
  };
  
  // Function to resume the simulation
  const resumeSimulation = () => {
    if (simulationService.current) {
      simulationService.current.resume();
    }
  };
  
  // Function to reset the simulation
  const resetSimulation = () => {
    if (simulationService.current) {
      simulationService.current.reset();
    }
  };
  
  // Function to stop the simulation
  const stopSimulation = () => {
    if (simulationService.current) {
      simulationService.current.stop();
    }
  };
  
  // Function to change the simulation speed
  const setSimulationSpeed = (speed: number) => {
    if (simulationService.current) {
      simulationService.current.setSpeed(speed);
    }
  };
  
  return {
    // Current state
    simulationState,
    
    // State getters
    isActive: simulationState.isActive,
    isPaused: simulationState.isPaused,
    progress: simulationState.progress,
    currentDateTime: simulationState.currentDateTime,
    visibleBars: simulationState.visibleBars,
    currentBar: simulationState.currentBar,
    
    // Actions
    initialize: initializeSimulation,
    start: startSimulation,
    pause: pauseSimulation,
    resume: resumeSimulation,
    reset: resetSimulation,
    stop: stopSimulation,
    setSpeed: setSimulationSpeed
  };
} 