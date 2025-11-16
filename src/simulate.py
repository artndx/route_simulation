import math
from .route import haversine

# ==== хз ====
# 
def bearing(lat1, lon1, lat2, lon2):
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    lam1 = math.radians(lon1)
    lam2 = math.radians(lon2)
    y = math.sin(lam2 - lam1) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(lam2 - lam1)
    theta = math.degrees(math.atan2(y, x))
    return (theta + 360) % 360
# ======

# ==== хз ====
#
def angle_diff(a, b):
    d = abs(a - b) % 360
    return d if d <= 180 else 360 - d
# ======

# ==== Симуляция маршрута ====
# 
def simulate_route(points, dt=1.0):
    if not points or len(points) < 2:
        return []

    # parameters
    base_speed = 15.0  # m/s
    max_speed = 40.0
    min_speed = 2.0
    accel = 1.0  # m/s^2
    decel = 2.5  # m/s^2
    base_fuel = 0.0008  # L/s at base speed

    # Precompute segment data
    segs = []
    for i in range(1, len(points)):
        p0 = points[i-1]
        p1 = points[i]
        d = haversine(p0['latitude'], p0['longitude'], p1['latitude'], p1['longitude'])
        b = bearing(p0['latitude'], p0['longitude'], p1['latitude'], p1['longitude'])
        segs.append({'d': d, 'bearing': b})

    # compute curvature at each vertex (index = 1..n-2) as angle change between incoming and outgoing bearings
    curvatures = [0.0] * len(points)
    for i in range(1, len(points)-1):
        a = segs[i-1]['bearing']
        b = segs[i]['bearing']
        curvatures[i] = angle_diff(a, b)

    states = []
    time_s = 0.0
    speed = 0.0
    dist_traveled = 0.0
    fuel = 0.0

    # iterate segments and simulate motion with simple accel/decel to segment target speeds
    for si in range(len(segs)):
        seg = segs[si]
        seg_len = seg['d']
        # slope percent roughly from endpoint
        slope_percent = points[si+1].get('slope', 0.0)

        # curvature at end of segment
        curvature = curvatures[si+1] if si+1 < len(curvatures) else 0.0

        # curvature factor: sharper turn -> lower allowed speed
        # map angle [0..180] -> factor [1.0 .. 0.4]
        curv_factor = 1.0 - min(0.6, (curvature / 180.0) * 1.2)

        # segment target speed from slope and curvature
        seg_target = base_speed * (1 - slope_percent * 0.012) * curv_factor
        seg_target = max(min_speed, min(max_speed, seg_target))

        remaining = seg_len
        # simulate along this segment in small steps dt
        while remaining > 1e-3:
            # accelerate or decelerate towards seg_target
            if speed < seg_target:
                speed = min(seg_target, speed + accel * dt)
            else:
                speed = max(seg_target, speed - decel * dt)

            # distance covered this dt
            move = speed * dt
            if move > remaining:
                move = remaining
            frac = move / seg_len if seg_len > 0 else 0

            # interpolate position along segment
            p0 = points[si]
            p1 = points[si+1]
            lat = p0['latitude'] + (p1['latitude'] - p0['latitude']) * (1 - (remaining - move) / seg_len)
            lon = p0['longitude'] + (p1['longitude'] - p0['longitude']) * (1 - (remaining - move) / seg_len)
            alt = p0.get('altitude', 0.0) + (p1.get('altitude', 0.0) - p0.get('altitude', 0.0)) * (1 - (remaining - move) / seg_len)

            # fuel consumption
            factor = max(0.1, speed / base_speed)
            fuel_rate = base_fuel * factor * factor * (1 + (slope_percent * 0.02))
            fuel += fuel_rate * dt

            dist_traveled += move
            time_s += dt

            states.append({
                'time_s': round(time_s, 3),
                'latitude': lat,
                'longitude': lon,
                'altitude': alt,
                'slope': slope_percent,
                'speed_m_s': round(speed, 3),
                'distance_km': round(dist_traveled/1000.0, 6),
                'fuel_l': round(fuel, 6)
            })

            remaining -= move

    return states
# ======