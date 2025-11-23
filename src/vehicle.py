# ==== Параметры автомобиля ====
# 
class Vehicle:
    def __init__(self):
        self.base_speed = 15.0   # m/s
        self.max_speed = 40.0    # m/s
        self.min_speed = 2.0     # m/s
        self.accel = 1.5         # m/s^2
        self.decel = 3.0         # m/s^2
        self.base_fuel = 0.0008  # L/s at base speed

    def move(self, slope_percent, current_speed, dt):
        moved_dist = current_speed * dt

        fuel_factor = max(0.1, current_speed / self.base_speed)
        fuel_rate = self.base_fuel * fuel_factor * fuel_factor * (1 + (slope_percent * 0.02))
        fuel_used = fuel_rate * dt

        return {
            'speed':        current_speed,
            'moved_dist':   moved_dist,
            'fuel_used':    fuel_used
        }
    
    def optimized_move(self, 
            curv_factor, 
            slope_percent, 
            current_speed,
            dt):
        optimal_speed = self.base_speed * (1 - slope_percent * 0.012) * curv_factor
        if current_speed < optimal_speed:
            current_speed = min(optimal_speed, current_speed + self.accel * dt)
        else:
            current_speed = max(optimal_speed, current_speed - self.decel * dt)
        
        move_result = self.move(slope_percent, current_speed, dt)

        return {
            'speed':        move_result['speed'],
            'moved_dist':   move_result['moved_dist'],
            'fuel_used':    move_result['fuel_used'],
        }
# ======