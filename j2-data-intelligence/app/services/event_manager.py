import asyncio
import logging

logger = logging.getLogger(__name__)

class EventManager:
    def __init__(self):
        self._listeners = {}

    def subscribe(self, event_name: str, callback):
        if event_name not in self._listeners:
            self._listeners[event_name] = []
        self._listeners[event_name].append(callback)
        logger.info(f"Subscribed to event: {event_name}")

    async def emit(self, event_name: str, *args, **kwargs):
        if event_name in self._listeners:
            logger.info(f"Emitting event: {event_name} to {len(self._listeners[event_name])} listeners")
            for callback in self._listeners[event_name]:
                try:
                    if asyncio.iscoroutinefunction(callback):
                        await callback(*args, **kwargs)
                    else:
                        callback(*args, **kwargs)
                except Exception as e:
                    logger.error(f"Error executing listener for event {event_name}: {e}")
        else:
            logger.warning(f"No listeners found for event: {event_name}")

# Global instance
event_manager = EventManager()
