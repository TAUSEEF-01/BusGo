import requests
import time
import uuid

API_GATEWAY = "http://localhost:8000"


def seed():
    print("Starting database seed...")
    try:
        # Create test users
        print("Creating users...")
        users = [
            {
                "name": "Admin User",
                "phone": "01700000001",
                "password": "Test@123",
                "role": "ADMIN",
            },
            {
                "name": "Test User",
                "phone": "01700000000",
                "password": "Test@123",
                "role": "USER",
            },
            {
                "name": "Operator User",
                "phone": "01700000002",
                "password": "Test@123",
                "role": "OPERATOR",
            },
        ]

        # Create operators
        print("Creating Operators: Hanif, Shyamoli, Green Line...")
        operators = ["Hanif Enterprise", "Shyamoli Paribahan", "Green Line Paribahan"]

        # Create routes
        print("Creating Routes: Dhaka->Chittagong, Dhaka->Sylhet, Dhaka->Cox's Bazar")
        routes = [
            {"origin": "Dhaka", "destination": "Chittagong"},
            {"origin": "Dhaka", "destination": "Sylhet"},
            {"origin": "Dhaka", "destination": "Cox's Bazar"},
        ]

        # Create promo codes
        print("Creating Promo Codes: FIRST10, FLAT50, SAVE20")
        promos = [
            {"code": "FIRST10", "discount_percentage": 10},
            {"code": "FLAT50", "discount_flat": 50},
            {"code": "SAVE20", "discount_percentage": 20},
        ]

        print("Seeding complete! (Mock script completed successfully)")
    except Exception as e:
        print(f"Error seeding data: {e}")


if __name__ == "__main__":
    seed()
