from flask import Flask, request, render_template, jsonify
from .route import make_route
from .simulate import simulate_route
from .state_tracker import initialize_state, get_state, update_state

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
    # Initialize state tracker for live simulation
    initialize_state(route)
    sim = simulate_route(route, dt=float(dt))
    return jsonify(sim=sim)
# ====

# ==== Update state with current speed ====
#
@app.route('/update_state', methods=['POST'])
def api_update_state():
    data = request.get_json()
    current_speed = float(data.get('current_speed', 0.0))
    dt = data.get('dt', 0.05)  # time step in seconds
    
    state = get_state()
    if state is None:
        return jsonify({'error': 'No active simulation'}), 400
    
    update_state(current_speed, dt)
    return jsonify(state.get_current_state())
# ====

# ==== Finish simulation: calculate to route end ====
#
@app.route('/finish_simulation', methods=['POST'])
def api_finish_simulation():
    """Fast-forward simulation to end of route with current speed."""
    data = request.get_json()
    current_speed = float(data.get('current_speed', 0.0))
    
    state = get_state()
    if state is None:
        return jsonify({'error': 'No active simulation'}), 400
    
    # If already complete, return current state
    if state.is_complete:
        return jsonify(state.get_current_state())
    
    # Collect chart data during fast-forward
    chart_data = {
        'times': [],
        'altitudes': [],
        'slopes': []
    }
    
    # Advance to end with small time steps
    dt_step = 0.5  # 0.5 second steps
    max_iterations = 100000  # safety limit
    iterations = 0
    last_chart_time = -1
    
    while not state.is_complete and iterations < max_iterations:
        update_state(current_speed, dt_step)
        
        # Collect data for charts
        current_state = state.get_current_state()
        time_sec = int(current_state['elapsed_time'])
        if time_sec != last_chart_time:
            chart_data['times'].append(time_sec)
            chart_data['altitudes'].append(current_state['altitude'])
            chart_data['slopes'].append(current_state['slope'])
            last_chart_time = time_sec
        
        iterations += 1
    
    final_state = state.get_current_state()
    final_state['chart_data'] = chart_data
    return jsonify(final_state)
# ====