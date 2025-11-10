import os
import osmnx as ox
import pickle

from .point import Point
import random
from .route import save_to_csv
from shapely.geometry import LineString

# ====== Загрузка или создание графа ======
#
GRAPH_FILE = "data/map.pkl"

def init_graph(graph_center, graph_radius_dist):
    if os.path.exists(GRAPH_FILE):
        with open(GRAPH_FILE, "rb") as f:
            print("✔️  Map graph loaded from cache {}".format(GRAPH_FILE))
            return pickle.load(f)
    else:
        print("⏳ Loading map graph from OSM...")
        graph = ox.graph_from_point(graph_center, graph_radius_dist, network_type="drive")
        with open(GRAPH_FILE, "wb") as f:
            pickle.dump(graph, f)
        print("💾 Map graph saved locally in {}".format(GRAPH_FILE))
        return graph
# ======

# ====== Построение маршрута по двум точкам ======
#
def make_route(start, end, graph):
    lat1, lon1 = start
    lat2, lon2 = end

    orig_node = ox.distance.nearest_nodes(graph, lon1, lat1)
    dest_node = ox.distance.nearest_nodes(graph, lon2, lat2)
    coords = ox.shortest_path(graph, orig_node, dest_node, weight="length")

    route = [(graph.nodes[n]['y'], graph.nodes[n]['x']) for n in coords]

    return route
# ======

# ====== Построение маршрута из точки ======
#
def make_route_from_point(start, nodes_count, graph):
    lat, lon = start
    orig_node_id = ox.distance.nearest_nodes(graph, lon, lat)

    coords = []

    coords.append(Point(graph.nodes[orig_node_id]))

    current_node_id = orig_node_id
    while len(coords) < nodes_count:
        neighbors = list(graph.neighbors(current_node_id))
        if not neighbors:
            break  # если узел тупиковый

        next_node_id = random.choice(neighbors)
        coords.append(Point(graph.nodes[next_node_id]))

        current_node_id = next_node_id
    
    save_to_csv(coords)
    route = [(n.latitude, n.longitude) for n in coords]

    return route
# ======

# ====== Получение набора точек на участке дороги ======
#
def make_points_at(start_node, end_node, graph):
    # data = graph.get_edge_data(start_node, end_node)
    # if not data:
    #     return []

    # Выбираем первое ребро (если есть несколько)
    # edge = data[0]
    # geometry = edge.get("geometry")

    # if geometry is None:
    #     # Прямая линия между узлами
    #     lat_a, lon_a = graph.nodes[start_node]["y"], graph.nodes[start_node]["x"]
    #     lat_b, lon_b = graph.nodes[end_node]["y"], graph.nodes[end_node]["x"]
    #     geometry = LineString([(lon_a, lat_a), (lon_b, lat_b)])

    # Разбиваем линию на segment_points участков

    # segment_points = 2

    # distances = [i / (segment_points - 1) for i in range(segment_points)]
    # segment_coords = []
    # for d in distances:
    #     point = geometry.interpolate(d, normalized=True)
    #     lat, lon = point.y, point.x
    #     altitude = get_altitude(lat, lon)
    #     slope = get_slope()
    #     segment_coords.append((lat, lon, altitude, slope))

    segment_coords = [
    ]

    return segment_coords
# ======

