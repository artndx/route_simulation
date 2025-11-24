import csv

from .geometry import haversine
from .geometry import direction
from .geometry import angle_diff
from .geometry import Point

from .vehicle import Vehicle

OPTIMIZED_STATES_FILE = "data/optimized_states.csv"
CONTROLLED_STATES_FILE = "data/controlled_states.csv"

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
        self.is_finished = False

    def to_dict(self):
        return {
            'time_s': round(self.time_s, 3),
            'latitude': self.point.latitude,
            'longitude': self.point.longitude,
            'altitude': self.point.altitude,
            'slope': self.point.slope,
            'speed_m_s': round(self.speed, 3),
            'distance_km': round(self.dist_traveled/1000.0, 6),
            'fuel_l': round(self.fuel_used, 6),
            'if_finished':self.is_finished
        }
# ======

_controlled_states = []

# ==== Класс симуляции маршрута ====
#
class SimulationRouter:
    def __init__(self, 
                 route, 
                 time_step = 0.05,
                 vehicle = Vehicle()):
        self.route = route
        self.segments = segments_from_route(self.route)
        self.rotations = rotation_angles_from_segments(self.segments)
        self.time_step = time_step
        self.vehicle = vehicle

        self.cur_segment_index = None
        self.dist_on_segment = None
        self.current_state = None

    
    def simulate_optimize_route(self):
        if not self.route or len(self.route) < 2:
            return []

        states = []
        state = State()
        for si in range(len(self.segments)):
            seg_dist = self.segments[si]['distance']
            slope_percent = self.route[si+1].get('slope', 0.0)

            near_rotations = self.rotations[si+1 : si+3]
            if not near_rotations:
                average_rotation = 0.0
            else:
                average_rotation = sum(near_rotations) / len(near_rotations)

            curv_factor = 1.0 - min(0.8, (average_rotation / 180.0) * 1.6)
                
            remaining_dist = seg_dist
            while remaining_dist > 1e-3:
                params = self.vehicle.optimized_move(curv_factor, slope_percent, state.speed, self.time_step)
       
                moved_dist = params['moved_dist']
                if moved_dist > remaining_dist:
                    moved_dist = remaining_dist

                p0 = self.route[si]
                p1 = self.route[si+1]
                state.point.latitude = p0['latitude'] + (p1['latitude'] - p0['latitude']) * (1 - (remaining_dist - moved_dist) / seg_dist)
                state.point.longitude = p0['longitude'] + (p1['longitude'] - p0['longitude']) * (1 - (remaining_dist - moved_dist) / seg_dist)
                state.point.altitude = p0.get('altitude', 0.0) + (p1.get('altitude', 0.0) - p0.get('altitude', 0.0)) * (1 - (remaining_dist - moved_dist) / seg_dist)
                state.point.slope = slope_percent

                state.speed = params['speed']
                state.fuel_used += params['fuel_used']
                state.dist_traveled += moved_dist
                state.time_s += self.time_step

                states.append(state.to_dict())

                remaining_dist -= moved_dist
                
        # self.save_to_csv(states, OPTIMIZED_STATES_FILE)
        return states
    
    def drive_route(self, current_speed):
        if not self.route or len(self.route) < 2:
            return {
                'is_finish': True
            }
        
        if self.current_state is None:
            self.current_state = State()
            self.cur_segment_index = 0
            self.dist_on_segment = 0.0   

        moved_dist = current_speed * self.time_step
        while moved_dist > 0 and self.cur_segment_index < len(self.segments):
            seg = self.segments[self.cur_segment_index]
            seg_len = seg['distance']

            p0 = self.route[self.cur_segment_index]
            p1 = self.route[self.cur_segment_index + 1]

            slope_percent = p1.get('slope', 0.0)
            remaining_dist = seg_len - self.dist_on_segment
            if moved_dist >= remaining_dist:
                # Пройдем до конца сегмента
                moved_here = remaining_dist
                moved_dist -= moved_here
                self.dist_on_segment = 0.0
                self.cur_segment_index += 1
            else:
                # Не доходим до конца сегмента
                moved_here = moved_dist
                self.dist_on_segment += moved_here
                moved_dist = 0.0

            params = self.vehicle.move(slope_percent, current_speed, self.time_step)
            self.current_state.fuel_used += params['fuel_used']
            self.current_state.dist_traveled += moved_here
            self.current_state.time_s += self.time_step
            self.current_state.speed = current_speed

            # --- Вычислить положение автомобиля ---
            if self.cur_segment_index >= len(self.segments):
                # Достигли конца маршрута
                p0 = self.route[-2]
                p1 = self.route[-1]
                progress = 1.0
            else:
                seg_len = self.segments[self.cur_segment_index]['distance']
                progress = self.dist_on_segment / seg_len if seg_len > 0 else 1.0
                p0 = self.route[self.cur_segment_index]
                p1 = self.route[self.cur_segment_index + 1]

            lat = p0['latitude']  + (p1['latitude']  - p0['latitude'])  * progress
            lon = p0['longitude'] + (p1['longitude'] - p0['longitude']) * progress
            alt = p0.get('altitude', 0.0) + (p1.get('altitude', 0.0) -
                                            p0.get('altitude', 0.0)) * progress

            self.current_state.point.latitude = lat
            self.current_state.point.longitude = lon
            self.current_state.point.altitude = alt
            self.current_state.point.slope = slope_percent

            # Если сегменты закончились — выходим
            if self.cur_segment_index >= len(self.segments):
                break

        # --- Формируем итоговый словарь ---
        self.current_state.is_finished = (self.cur_segment_index >= len(self.segments))
        
        global _controlled_states
        _controlled_states.append(self.current_state)
        if(self.current_state.is_finished):
            self.save_to_csv(_controlled_states, CONTROLLED_STATES_FILE)
            _controlled_states.clear()

        return self.current_state.to_dict()

    def save_to_csv(self, states, path):
        file = open(path, "w", newline="", encoding="utf-8")
        writer = csv.DictWriter(file, fieldnames=["time_s", "latitude", "longitude", "altitude", "slope", 
                                                  "speed_m_s", "distance_km", "fuel_l", "is_finish"])
        writer.writeheader()

        for state in states:
            writer.writerow(state)
        print("✅ Route saved to {}, {} points".format(path, len(states)))
# ======


