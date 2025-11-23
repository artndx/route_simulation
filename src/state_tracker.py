# state_tracker.py
# Wrapper module for route simulation state tracking
# The actual RouteSimulationState class is defined in simulate.py

from .simulate import RouteSimulationState

# Global state instance
_current_state = None

def initialize_state(route):
    """Initialize simulation state from route."""
    global _current_state
    _current_state = RouteSimulationState(route)
    _current_state.is_active = True

def get_state():
    """Get current simulation state."""
    global _current_state
    return _current_state

def update_state(current_speed, dt=1.0):
    """Update simulation state with current speed and time step."""
    global _current_state
    if _current_state:
        _current_state.update(current_speed, dt)
