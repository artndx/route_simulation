from flask import Blueprint, jsonify, request
from .graph import get_graph, build_route
api = Blueprint("api", __name__)

@api.route("/api/build_route", methods=["POST"])
def api_route():
    data = request.get_json()
    start = data["start"]
    end = data["end"]
    graph = get_graph()
    route = build_route(start, end, graph)
    return jsonify(route=route)
