from flask import Flask, request, render_template, jsonify
from .route import make_route
from .simulate import SimulationRouter

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
def api_build_route():
    data = request.get_json()
    start = data["start"]
    end = data["end"]
    route = make_route(start, end)
    return jsonify(route=route)
# ======

SIMULATION_ROUTER = None

# ==== Симуляция маршрута ====
#
@app.route('/simulate', methods=['POST'])
def api_simulate():
    data = request.get_json()
    route = data.get('route')
    dt = data.get('dt', 1.0)

    global SIMULATION_ROUTER  
    SIMULATION_ROUTER = SimulationRouter(route, dt)
    sim = SIMULATION_ROUTER.simulate_optimize_route()

    return jsonify(sim=sim)
# ====

# ==== Движение по маршруту ====
#
@app.route('/drive_route', methods=['POST'])
def api_drive_route():
    data = request.get_json()
    currend_speed = float(data.get('current_speed'))

    global SIMULATION_ROUTER

    if SIMULATION_ROUTER is None:
        return jsonify(error="Simulation not initialized."), 400
    
    state = SIMULATION_ROUTER.drive_route(currend_speed)
    return jsonify(state=state)
# ====