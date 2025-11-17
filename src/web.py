from flask import Flask, request, render_template, jsonify
from .route import make_route
from .simulate import simulate_route

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

# ==== Симуляция маршрута ====
#
@app.route('/simulate', methods=['POST'])
def api_simulate():
    data = request.get_json()
    route = data.get('route')
    dt = data.get('dt', 1.0)
    # Route is expected to be list of {latitude, longitude, altitude, slope}
    sim = simulate_route(route, dt=float(dt))
    return jsonify(sim=sim)
# ====