"""
Endless daemon for background processing tasks.
"""
import logging
import signal
import time
from typing import Optional


logger = logging.getLogger(__name__)


class EndlessDaemon:
    """
    A daemon that runs endless background processing tasks.
    
    Handles graceful shutdown on SIGTERM/SIGINT signals.
    """
    
    def __init__(self, task_interval: int = 60):
        """
        Initialize the endless daemon.
        
        Args:
            task_interval: Interval in seconds between task executions.
        """
        self.task_interval = task_interval
        self.running = False
        self._setup_signal_handlers()
    
    def _setup_signal_handlers(self) -> None:
        """
        Set up signal handlers for graceful shutdown.
        """
        signal.signal(signal.SIGTERM, self._handle_shutdown)
        signal.signal(signal.SIGINT, self._handle_shutdown)
    
    def _handle_shutdown(self, signum: int, frame) -> None:
        """
        Handle shutdown signals.
        
        Args:
            signum: Signal number received.
            frame: Current stack frame.
        """
        logger.info(f"Received signal {signum}, shutting down gracefully...")
        self.running = False
    
    def start(self) -> None:
        """
        Start the endless daemon loop.
        """
        self.running = True
        logger.info("Endless daemon started")
        
        while self.running:
            try:
                self._run_task()
            except Exception as e:
                logger.error(f"Error in daemon task: {e}")
            
            time.sleep(self.task_interval)
        
        logger.info("Endless daemon stopped")
    
    def _run_task(self) -> None:
        """
        Execute the background task. Override in subclasses.
        """
        pass