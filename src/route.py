import csv

ROUTE_FILE = "data/route.csv"

# ====== Сохранение маршрута ======
#
def save_to_csv(points):
    file = open(ROUTE_FILE, "w", newline="", encoding="utf-8")
    writer = csv.DictWriter(file, fieldnames=["latitude", "longitude", "altitude", "slope"])
    writer.writeheader()

    for i in range(len(points)):
        writer.writerow(points[i].to_dict())
    print("✅ Route saved to {}, {} points".format(ROUTE_FILE, len(points)))
# ======