import math

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

    def get_slope(self, previous_point):
        if previous_point is None:
            return 0.0
        # Разница высот
        delta_h = self.altitude - previous_point.altitude

        # Горизонтальное расстояние между точками
        horizontal_distance = haversine(self.latitude, self.longitude, 
                                        previous_point.latitude, previous_point.longitude)
        if horizontal_distance == 0:
            return 0.0

        slope = (delta_h / horizontal_distance) * 100
        return slope

    def to_dict(self):
        return {
            "latitude": self.latitude,
            "longitude": self.longitude,
            "altitude": self.altitude,
            "slope": self.slope
        }
# ======

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