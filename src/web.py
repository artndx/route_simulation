from flask import Flask, request, render_template, jsonify
from .graph import init_graph, make_route_from_point

import os

BASE_DIR = os.path.dirname(os.path.dirname(__file__))  # путь до route_simulation/
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")
STATIC_DIR = os.path.join(BASE_DIR, "static")

# ====== Инициализация ======
# 
app = Flask(__name__, template_folder=TEMPLATES_DIR, static_folder=STATIC_DIR)
GRAPH_CENTER = {
    "latitude": 55.755864,
    "longtitude": 37.617698
}
GRAPH_RADIUS = 30_000  # 30 км
graph = init_graph(GRAPH_CENTER, GRAPH_RADIUS)
# ======

# ====== Главная страница ======
#
@app.route("/")
def index():
    return render_template(
        "index.html",
        center_lat=GRAPH_CENTER["latitude"],
        center_lon=GRAPH_CENTER["longtitude"]
    )
# ======

# ==== Построение маршрута ====
#
@app.route("/build_route", methods=["POST"])
def api_route():
    data = request.get_json()
    start = data["start"]
    nodes_count = data["nodes"]
    route = make_route_from_point(start, nodes_count, graph)
    return jsonify(route=route)
# ======