import osmnx as ox
import pickle

import os

# ====== Загрузка или создание графа ======
#
GRAPH_FILE = "data/map.pkl"

def init_graph( graph_center, graph_radius_dist):
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

# ====== Построение маршрута ======
#
def make_route(start, end, graph):
    lat1, lon1 = start
    lat2, lon2 = end

    orig_node = ox.distance.nearest_nodes(graph, lon1, lat1)
    dest_node = ox.distance.nearest_nodes(graph, lon2, lat2)
    route = ox.shortest_path(graph, orig_node, dest_node, weight="length")

    coords = [(graph.nodes[n]['y'], graph.nodes[n]['x']) for n in route]

    return coords
# ======