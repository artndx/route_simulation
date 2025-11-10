import math
import random

# ======
def horizontal_distance(lat1, lon1, lat2, lon2):
    # переводим градусы в радианы
    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    λ1, λ2 = math.radians(lon1), math.radians(lon2)

    # формула гаверсинусов
    dφ = φ2 - φ1
    dλ = λ2 - λ1

    a = math.sin(dφ / 2)**2 + math.cos(φ1) * math.cos(φ2) * math.sin(dλ / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    R = 6371000 
    return R * c  # результат в метрах
# ======

# ======
def get_altitude(lat, lon):
    """Грубая симуляция высоты (для реализма можно заменить API)."""
    return 150 + 10 * math.sin(lat * 20) * math.cos(lon * 10)
# ======

# ======
def get_slope():
    """Псевдослучайный уклон (в градусах)."""
    return round(random.uniform(-5, 5), 2)
# ======

# ======
class Point:
    def __init__(self, 
                latitude: float, 
                longitude: float, 
                altitude: float, 
                slope: float):
        self.latitude = latitude
        self.longitude = longitude
        self.altitude = altitude
        self.slope = slope
    def __init__ (self, 
                node):
        self.latitude = node['y']
        self.longitude = node['x']
        self.altitude = get_altitude(self.latitude, self.longitude)
        self.slope = get_slope()

    def to_dict(self):
        return {
            "latitude": self.latitude,
            "longitude": self.longitude,
            "altitude": self.altitude,
            "slope": self.slope
        }
# ======