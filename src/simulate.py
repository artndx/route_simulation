import math
from .geometry import haversine
from .geometry import direction
from .geometry import angle_diff

# ==== Разбиение маршрута на участки (расстояние + направление) ====
# 
def segments_from_route(points):
    segments = []
    for i in range(1, len(points)):
        p0 = points[i-1]
        p1 = points[i]
        dist = haversine(p0['latitude'], p0['longitude'], p1['latitude'], p1['longitude'])
        dir = direction(p0['latitude'], p0['longitude'], p1['latitude'], p1['longitude'])
        segments.append({'distance': dist, 'direction': dir})
    
    return segments
# ====

# ==== Симуляция маршрута ====
def rotation_angles_from_segments(segments):
    rotation_angle = [0.0] * len(segments)
    for i in range(1, len(segments)-1):
        a = segments[i-1]['direction']
        b = segments[i]['direction']
        rotation_angle[i] = angle_diff(a, b)
    
    return rotation_angle
# ====

# ==== Симуляция маршрута ====
# 
def simulate_route(points, dt=1.0):
    if not points or len(points) < 2:
        return []

    base_speed = 15.0   # m/s
    max_speed = 40.0
    min_speed = 2.0
    accel = 1.5         # m/s^2
    decel = 3.0         # m/s^2
    base_fuel = 0.0008  # L/s at base speed

    segments = segments_from_route(points)
    rotations = rotation_angles_from_segments(segments)

    states = []
    time_s = 0.0
    speed = 0.0
    dist_traveled = 0.0
    fuel_used = 0.0

    for si in range(len(segments)):
        seg = segments[si]
        seg_dist = seg['distance']
        slope_percent = points[si+1].get('slope', 0.0)

        # rotation_angle = rotations[si+1] if si+1 < len(rotations) else 0.0
        # curv_factor = 1.0 - min(0.6, (rotation_angle / 180.0) * 1.6)
        near_rotations = rotations[si+1 : si+3]
        if not near_rotations:
            average_rotation = 0.0
        else:
            average_rotation = sum(near_rotations) / len(near_rotations)

        curv_factor = 1.0 - min(0.8, (average_rotation / 180.0) * 1.6)
            
        seg_target_speed = base_speed * (1 - slope_percent * 0.012) * curv_factor
        seg_target_speed = max(min_speed, min(max_speed, seg_target_speed))

        remaining_dist = seg_dist
        while remaining_dist > 1e-3:
            if speed < seg_target_speed:
                speed = min(seg_target_speed, speed + accel * dt)
            else:
                speed = max(seg_target_speed, speed - decel * dt)

            moved_dist = speed * dt
            if moved_dist > remaining_dist:
                moved_dist = remaining_dist
            frac = moved_dist / seg_dist if seg_dist > 0 else 0

            p0 = points[si]
            p1 = points[si+1]
            lat = p0['latitude'] + (p1['latitude'] - p0['latitude']) * (1 - (remaining_dist - moved_dist) / seg_dist)
            lon = p0['longitude'] + (p1['longitude'] - p0['longitude']) * (1 - (remaining_dist - moved_dist) / seg_dist)
            alt = p0.get('altitude', 0.0) + (p1.get('altitude', 0.0) - p0.get('altitude', 0.0)) * (1 - (remaining_dist - moved_dist) / seg_dist)

            fuel_factor = max(0.1, speed / base_speed)
            fuel_rate = base_fuel * fuel_factor * fuel_factor * (1 + (slope_percent * 0.02))
            fuel_used += fuel_rate * dt

            dist_traveled += moved_dist
            time_s += dt

            states.append({
                'time_s': round(time_s, 3),
                'latitude': lat,
                'longitude': lon,
                'altitude': alt,
                'slope': slope_percent,
                'speed_m_s': round(speed, 3),
                'distance_km': round(dist_traveled/1000.0, 6),
                'fuel_l': round(fuel_used, 6)
            })

            remaining_dist -= moved_dist

    return states
# ======

# ====== Отслеживание состояния маршрута в режиме реального времени ======
#
class RouteSimulationState:
    """Live tracking of route simulation with progressive fuel calculation."""
    
    def __init__(self, route):
        """Initialize state tracker from route points.
        
        Args:
            route: list of {latitude, longitude, altitude, slope} dicts
        """
        self.route = route
        self.current_index = 0
        self.segment_offset = 0.0
        self.elapsed_time = 0.0
        self.current_speed = 0.0
        self.distance_traveled = 0.0
        self.fuel_used = 0.0
        self.optimal_fuel_used = 0.0
        self.is_complete = False
        self.is_active = False
        
        # Precompute segments and optimal speeds using existing functions
        self._precompute_route_data()
    
    def _precompute_route_data(self):
        """Precompute segments, distances, bearings, and optimal speeds."""
        self.segments = segments_from_route(self.route)
        self.segment_distances = [seg['distance'] for seg in self.segments]
        self.segment_bearings = [seg['direction'] for seg in self.segments]
        
        # Compute rotation angles
        self.rotation_angles = rotation_angles_from_segments(self.segments)
        
        # Compute optimal speeds with curvature factor (following simulate_route logic)
        self.optimal_speeds = []
        base_speed = 15.0
        max_speed = 40.0
        min_speed = 2.0
        
        for i, seg in enumerate(self.segments):
            slope = self.route[i + 1].get('slope', 0.0)
            
            # Average rotation angle for upcoming turns (follow simulate_route)
            near_rotations = self.rotation_angles[i+1:i+3]
            avg_rotation = sum(near_rotations) / len(near_rotations) if near_rotations else 0.0
            
            curv_factor = 1.0 - min(0.8, (avg_rotation / 180.0) * 1.6)
            opt_speed = base_speed * (1 - slope * 0.012) * curv_factor
            opt_speed = max(min_speed, min(max_speed, opt_speed))
            
            self.optimal_speeds.append(opt_speed)
    
    def get_current_state(self):
        """Return current state as dict with all telemetry."""
        if self.is_complete:
            p_final = self.route[-1]
            return {
                'is_complete': True,
                'current_speed': 0.0,
                'elapsed_time': self.elapsed_time,
                'distance_km': self.distance_traveled / 1000.0,
                'fuel_l': self.fuel_used,
                'optimal_distance_km': sum(self.segment_distances) / 1000.0,
                'optimal_fuel_l': self.optimal_fuel_used,
                'latitude': p_final['latitude'],
                'longitude': p_final['longitude'],
                'altitude': p_final.get('altitude', 0.0),
                'slope': p_final.get('slope', 0.0),
                'optimal_speed': 0.0,
                'current_index': self.current_index
            }
        
        # Interpolate position within current segment
        if self.current_index >= len(self.route) - 1:
            p_final = self.route[-1]
            lat, lon = p_final['latitude'], p_final['longitude']
            alt = p_final.get('altitude', 0.0)
            slope = 0.0
        else:
            p0 = self.route[self.current_index]
            p1 = self.route[self.current_index + 1]
            
            seg_dist = self.segment_distances[self.current_index] if self.current_index < len(self.segment_distances) else 0.0
            frac = (self.segment_offset / seg_dist) if seg_dist > 0 else 0.0
            frac = min(1.0, frac)
            
            lat = p0['latitude'] + (p1['latitude'] - p0['latitude']) * frac
            lon = p0['longitude'] + (p1['longitude'] - p0['longitude']) * frac
            alt = p0.get('altitude', 0.0) + (p1.get('altitude', 0.0) - p0.get('altitude', 0.0)) * frac
            slope = p1.get('slope', 0.0)
        
        # Compute optimal speed at current position
        opt_speed = 0.0
        if self.current_index < len(self.optimal_speeds):
            opt_speed = self.optimal_speeds[self.current_index]
        
        return {
            'is_complete': self.is_complete,
            'current_speed': self.current_speed,
            'elapsed_time': self.elapsed_time,
            'distance_km': self.distance_traveled / 1000.0,
            'fuel_l': self.fuel_used,
            'optimal_distance_km': sum(self.segment_distances) / 1000.0,
            'optimal_fuel_l': self.optimal_fuel_used,
            'latitude': lat,
            'longitude': lon,
            'altitude': alt,
            'slope': slope,
            'optimal_speed': opt_speed,
            'current_index': self.current_index
        }
    
    def update(self, current_speed, dt=1.0):
        """Update state: advance position and compute fuel consumption.
        
        Args:
            current_speed: current speed in m/s
            dt: time step in seconds
        """
        if self.is_complete:
            return
        
        # Advance position
        distance_step = current_speed * dt
        self.distance_traveled += distance_step
        self.elapsed_time += dt
        self.current_speed = current_speed
        
        self.segment_offset += distance_step
        
        # Compute fuel for actual speed
        slope = self.route[self.current_index + 1].get('slope', 0.0) if self.current_index + 1 < len(self.route) else 0.0
        base_fuel = 0.0008
        factor = max(0.1, current_speed / 15.0)
        fuel_rate = base_fuel * factor * factor * (1 + slope * 0.02)
        self.fuel_used += fuel_rate * dt
        
        # Compute fuel for optimal speed (progressive)
        if self.current_index < len(self.optimal_speeds):
            opt_speed = self.optimal_speeds[self.current_index]
            opt_factor = max(0.1, opt_speed / 15.0)
            opt_fuel_rate = base_fuel * opt_factor * opt_factor * (1 + slope * 0.02)
            self.optimal_fuel_used += opt_fuel_rate * dt
        
        # Advance through segments
        while self.current_index < len(self.segment_distances) - 1:
            seg_dist = self.segment_distances[self.current_index]
            if self.segment_offset >= seg_dist:
                self.segment_offset -= seg_dist
                self.current_index += 1
            else:
                break
        
        # Check if route complete
        if self.current_index >= len(self.segment_distances):
            self.is_complete = True
# ======