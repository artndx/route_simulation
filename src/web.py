from flask import Flask, request, render_template, jsonify
from .route import make_route

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
    end = data["end"]
    route = make_route(start, end)
    return jsonify(route=route)
# ======