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
        rotation_angle = rotations[si+1] if si+1 < len(rotations) else 0.0

        curv_factor = 1.0 - min(0.6, (rotation_angle / 180.0) * 1.6)

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