from flask import Flask, request, render_template, jsonify
import pandas as pd

from src.graph import get_graph
from src.graph import make_route

# ====== Инициализация ======
# 
app = Flask(__name__)
GRAPH_CENTER = {
    "latitude": 55.755864,
    "longtitude": 37.617698
}
GRAPH_RADIUS = 30_000  # 30 км
graph = get_graph(GRAPH_CENTER, GRAPH_RADIUS)
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
def build_route():
    data = request.get_json()
    coords = make_route(data["start"], data["end"], graph)
    df = pd.DataFrame(coords, columns=["lat", "lon"])
    df.to_csv("data/route.csv", index=False)

    return jsonify({"route": coords})
# ======

if __name__ == "__main__":
    app.run(debug=True)
