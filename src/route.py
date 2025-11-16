import csv
import requests
from .point import Point
from .point import haversine

def get_altitudes_from_route(route):
    locations = [{"latitude": lat, "longitude": lon} for lon, lat in route]
    url = "https://api.open-elevation.com/api/v1/lookup"
    response = requests.post(url, json={"locations": locations})
    response.raise_for_status()
    data = response.json()
    return [result["elevation"] for result in data["results"]]

def get_slope(prev_lat, prev_lon, prev_alt, 
              next_lat, next_lon, next_alt):
    if (prev_lat is None or 
        prev_lon is None or 
        prev_alt is None):
        return 0.0
   
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

    result = []
    points = []
    prev_lat = None
    prev_lon = None
    prev_alt = None
    for i in range(len(route)):
        lon, lat = route[i]
        alt = elevations[i]
        slope = get_slope(prev_lat, prev_lon, prev_alt,
                          lat, lon, alt)

        prev_lat = lat
        prev_lon = lon
        prev_alt = alt

        points.append(Point(lat, lon, alt, slope))
        result.append((lat, lon))
    
    save_to_csv(points)

    return result
# ======

ROUTE_FILE = "data/route.csv"

# ====== Сохранение маршрута ======
#
def save_to_csv(points):
    file = open(ROUTE_FILE, "w", newline="", encoding="utf-8")
    writer = csv.DictWriter(file, fieldnames=["latitude", "longitude", "altitude", "slope"])
    writer.writeheader()

    for point in points:
        writer.writerow(point.to_dict())
    print("✅ Route saved to {}, {} points".format(ROUTE_FILE, len(points)))
# ======