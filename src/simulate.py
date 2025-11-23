import math
from .geometry import haversine
from .geometry import direction
from .geometry import angle_diff
from .geometry import Point

from .vehicle import Vehicle

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

# ==== Состояние симуляции ====
#
class State:
    def __init__(self):
        self.point = Point()
        self.time_s = 0.0
        self.speed = 0.0
        self.dist_traveled = 0.0
        self.fuel_used = 0.0

    def to_dict(self):
        return {
            'time_s': round(self.time_s, 3),
            'latitude': self.point.latitude,
            'longitude': self.point.longitude,
            'altitude': self.point.altitude,
            'slope': self.point.slope,
            'speed_m_s': round(self.speed, 3),
            'distance_km': round(self.dist_traveled/1000.0, 6),
            'fuel_l': round(self.fuel_used, 6)
        }
# ======

# ==== Класс симуляции маршрута ====
#
class SimulationRouter:
    def __init__(self, 
                 route, 
                 time_step = 1,
                 vehicle = Vehicle()):
        self.route = route
        self.time_step = time_step
        self.vehicle = vehicle
        self.states = []
    
    def simulate_optimize_route(self):
        self.states = []
        if not self.route or len(self.route) < 2:
            return self.states

        segments = segments_from_route(self.route)
        rotations = rotation_angles_from_segments(segments)
        
        state = State()
        for si in range(len(segments)):
            seg = segments[si]
            seg_dist = seg['distance']
            slope_percent = self.route[si+1].get('slope', 0.0)

            # rotation_angle = rotations[si+1] if si+1 < len(rotations) else 0.0
            # curv_factor = 1.0 - min(0.6, (rotation_angle / 180.0) * 1.6)
            near_rotations = rotations[si+1 : si+3]
            if not near_rotations:
                average_rotation = 0.0
            else:
                average_rotation = sum(near_rotations) / len(near_rotations)

            curv_factor = 1.0 - min(0.8, (average_rotation / 180.0) * 1.6)
                
            remaining_dist = seg_dist
            while remaining_dist > 1e-3:
                params = self.vehicle.move(curv_factor, slope_percent, state.speed, self.time_step)

                moved_dist = params['moved_dist']
                if moved_dist > remaining_dist:
                    moved_dist = remaining_dist

                state.time_s += self.time_step
                state.speed = params['speed']
                state.fuel_used += params['fuel_used']
                state.dist_traveled += params['moved_dist']

                p0 = self.route[si]
                p1 = self.route[si+1]
                lat = p0['latitude'] + (p1['latitude'] - p0['latitude']) * (1 - (remaining_dist - moved_dist) / seg_dist)
                lon = p0['longitude'] + (p1['longitude'] - p0['longitude']) * (1 - (remaining_dist - moved_dist) / seg_dist)
                alt = p0.get('altitude', 0.0) + (p1.get('altitude', 0.0) - p0.get('altitude', 0.0)) * (1 - (remaining_dist - moved_dist) / seg_dist)

                state.point.latitude = lat
                state.point.longitude = lon
                state.point.altitude = alt
                state.point.slope = slope_percent

                self.states.append(state.to_dict())

                remaining_dist -= moved_dist

        return self.states
# ======


