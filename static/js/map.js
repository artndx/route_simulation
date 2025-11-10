let map = L.map("map").setView(CENTER, 12);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/">OSM</a>'
}).addTo(map);

let startMarker = null;
let endMarker = null;
let routeLine = null;
let pickMode = null;
