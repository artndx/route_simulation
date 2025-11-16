import os
import osmnx as ox
import pickle
import random

from .point import Point
from .route import save_to_csv
from shapely.geometry import LineString

# ====== Загрузка или создание графа ======
#
GRAPH_FILE = "data/map.pkl"

def init_graph(graph_center, graph_radius_dist):
    center_coords = (graph_center["latitude"], graph_center["longtitude"])
    if os.path.exists(GRAPH_FILE):
        with open(GRAPH_FILE, "rb") as f:
            print("✔️  Map graph loaded from cache {}".format(GRAPH_FILE))
            return pickle.load(f)
    else:
        print("⏳ Loading map graph from OSM...")
        graph = ox.graph_from_point(center_coords, graph_radius_dist, network_type="drive")
        with open(GRAPH_FILE, "wb") as f:
            pickle.dump(graph, f)
        print("💾 Map graph saved locally in {}".format(GRAPH_FILE))
        return graph
# ======

# ====== Построение маршрута из точки ======
#
def make_route_from_point(start, nodes_count, graph):
    lat, lon = start
    orig_node_id = ox.distance.nearest_nodes(graph, lon, lat)

    coords = []
    visited_nodes = {orig_node_id}
    path_stack = [orig_node_id]

    coords.append(Point(graph.nodes[orig_node_id]))

    current_node_id = orig_node_id
    while len(coords) < nodes_count:
        neighbors = list(graph.neighbors(current_node_id))
        unvisited_nodes = [n for n in neighbors if n not in visited_nodes]

        if unvisited_nodes:
            next_node_id = random.choice(unvisited_nodes)
            coords.append(Point(graph.nodes[next_node_id]))
            visited_nodes.add(next_node_id)
            path_stack.append(next_node_id)
            current_node_id = next_node_id
        else:
            # тупик — возвращаемся назад
            path_stack.pop()
            if path_stack:
                current_node_id = path_stack[-1]
            else:
                break  # больше некуда идти
    
    save_to_csv(coords)
    route = [(n.latitude, n.longitude) for n in coords]

    return route
# ======


