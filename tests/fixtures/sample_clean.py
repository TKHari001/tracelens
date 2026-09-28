# Clean Python file for X-RAY VISION package analyzer regression testing

import math

def calculate_area(radius: float) -> float:
    """Calculate the area of a circle with a given radius."""
    if radius < 0:
        raise ValueError("Radius cannot be negative")
    return math.pi * (radius ** 2)

def main():
    r = 5.0
    area = calculate_area(r)
    print(f"Area of circle with radius {r} is {area:.2f}")

if __name__ == "__main__":
    main()
