import requests
import math
import csv

def get_altitudes_from_route(route):
    locations = [{"latitude": lat, "longitude": lon} for lon, lat in route]
    url = "https://api.open-elevation.com/api/v1/lookup"
    response = requests.post(url, json={"locations": locations})
    response.raise_for_status()
    data = response.json()
    return [result["elevation"] for result in data["results"]]

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

def get_slope(prev_lat, prev_lon, prev_alt, 
              next_lat, next_lon, next_alt):
    hor_dist = haversine(prev_lat, prev_lon, next_lat, next_lon)
    delta_alt = next_alt - prev_alt
    if hor_dist == 0:
        return 0.0
    return (delta_alt / hor_dist) * 100

# ====== Построение маршрута по двум точкам ======
#
def make_route(start, end):
    base_url = "http://router.project-osrm.org/route/v1/driving/"
    route_params = f"{start[1]},{start[0]};{end[1]},{end[0]}"
    url = f"{base_url}{route_params}?overview=full&geometries=geojson"

    response = requests.get(url)
    response.raise_for_status()
    
    data = response.json()
    
    # Извлекаем маршрут
    route = data['routes'][0]['geometry']['coordinates']
    elevations = get_altitudes_from_route(route)

    points = []
    prev_lon, prev_lat = route[0]
    prev_alt = elevations[0]
    slope = 0.0
    points.append({
        "latitude": prev_lat,
        "longitude": prev_lon,
        "altitude": prev_alt,
        "slope": slope
    })
    
    for i in range(1, len(route)):
        lon, lat = route[i]
        alt = elevations[i]
        slope = get_slope(prev_lat, prev_lon, prev_alt,
                          lat, lon, alt)

        prev_lat = lat
        prev_lon = lon
        prev_alt = alt

        points.append({
            "latitude": lat,
            "longitude": lon,
            "altitude": alt,
            "slope": slope
        })
    
    save_to_csv(points)

    # Возвращаем подробный маршрут с альтитудами и уклоном
    return points
# ======

ROUTE_FILE = "data/route.csv"

# ====== Сохранение маршрута ======
#
def save_to_csv(points):
    file = open(ROUTE_FILE, "w", newline="", encoding="utf-8")
    writer = csv.DictWriter(file, fieldnames=["latitude", "longitude", "altitude", "slope"])
    writer.writeheader()

    for point in points:
        writer.writerow(point)
    print("✅ Route saved to {}, {} points".format(ROUTE_FILE, len(points)))
# ======