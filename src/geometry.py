import math

# ====== Вычисление расстояния ======
#
def haversine(lat1, lon1, lat2, lon2):
    R = 6371000  # радиус Земли в метрах
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    distance = R * c
    return distance
# ======

# ==== Направление ====
# 
def direction(lat1, lon1, lat2, lon2):
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    lam1 = math.radians(lon1)
    lam2 = math.radians(lon2)
    y = math.sin(lam2 - lam1) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(lam2 - lam1)
    theta = math.degrees(math.atan2(y, x))
    return (theta + 360) % 360
# ======

# ==== Разница между углами ====
#
def angle_diff(a, b):
    d = abs(a - b) % 360
    return d if d <= 180 else 360 - d
# ======
