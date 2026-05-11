#!/usr/bin/env python3
"""
Seed data loader for J2 Database

Initializes divisions and reference data for Sri Lankan administrative divisions.
Run this script to populate the database with initial reference data.

Usage:
    python seed_data.py
"""

from app.db.database import SessionLocal, engine
from app.db.models import Base, Division, IoTDevice
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Sri Lankan Division Reference Data
DIVISIONS_DATA = [
    # Western Province
    {"division_name": "Colombo", "district": "Colombo", "latitude": 6.9271, "longitude": 80.6369, "division_population": 2309000},
    {"division_name": "Dehiwala", "district": "Colombo", "latitude": 6.8315, "longitude": 80.7660, "division_population": 750000},
    {"division_name": "Kelaniya", "district": "Colombo", "latitude": 6.9246, "longitude": 80.6400, "division_population": 250000},
    
    # Gampaha District
    {"division_name": "Negombo", "district": "Gampaha", "latitude": 7.2064, "longitude": 79.8394, "division_population": 280000},
    {"division_name": "Attanagalla", "district": "Gampaha", "latitude": 7.0850, "longitude": 79.9200, "division_population": 150000},
    
    # Kalutara District
    {"division_name": "Kalutara", "district": "Kalutara", "latitude": 6.5920, "longitude": 80.3270, "division_population": 350000},
    {"division_name": "Beruwala", "district": "Kalutara", "latitude": 6.4868, "longitude": 80.3604, "division_population": 180000},
    
    # North Central Province
    {"division_name": "Kandy", "district": "Kandy", "latitude": 7.2906, "longitude": 80.6337, "division_population": 1300000},
    {"division_name": "Matale", "district": "Matale", "latitude": 7.4671, "longitude": 80.7889, "division_population": 450000},
    
    # Sabaragamuwa Province
    {"division_name": "Ratnapura", "district": "Ratnapura", "latitude": 6.6828, "longitude": 80.7900, "division_population": 500000},
    {"division_name": "Kegalle", "district": "Kegalle", "latitude": 7.2550, "longitude": 80.8350, "division_population": 400000},
    
    # Central Province
    {"division_name": "Nuwara Eliya", "district": "Nuwara Eliya", "latitude": 6.9271, "longitude": 80.7744, "division_population": 350000},
    
    # Southern Province
    {"division_name": "Galle", "district": "Galle", "latitude": 6.0366, "longitude": 80.2170, "division_population": 1050000},
    {"division_name": "Matara", "district": "Matara", "latitude": 5.7479, "longitude": 80.5498, "division_population": 820000},
    
    # Uva Province
    {"division_name": "Badulla", "district": "Badulla", "latitude": 6.9904, "longitude": 81.0550, "division_population": 320000},
    {"division_name": "Moneragala", "district": "Moneragala", "latitude": 6.8223, "longitude": 81.3472, "division_population": 450000},
    
    # Eastern Province
    {"division_name": "Batticaloa", "district": "Batticaloa", "latitude": 7.7056, "longitude": 81.7687, "division_population": 520000},
    {"division_name": "Ampara", "district": "Ampara", "latitude": 7.3000, "longitude": 81.6500, "division_population": 620000},
    
    # Northern Province
    {"division_name": "Jaffna", "district": "Jaffna", "latitude": 9.6615, "longitude": 80.0255, "division_population": 570000},
    {"division_name": "Mullaitivu", "district": "Mullaitivu", "latitude": 8.3136, "longitude": 81.3233, "division_population": 146000},
]

# Sample IoT Devices
IOT_DEVICES_DATA = [
    {"device_id": "J1_TX_01", "status": "ACTIVE", "division_name": "Colombo"},
    {"device_id": "J1_TX_02", "status": "ACTIVE", "division_name": "Kandy"},
    {"device_id": "J1_TX_03", "status": "ACTIVE", "division_name": "Ratnapura"},
    {"device_id": "J1_TX_04", "status": "ACTIVE", "division_name": "Nuwara Eliya"},
    {"device_id": "J1_TX_05", "status": "ACTIVE", "division_name": "Galle"},
]


def seed_database():
    """Populate database with initial reference data"""
    db = SessionLocal()
    
    try:
        # Create tables
        logger.info("Creating database tables...")
        Base.metadata.create_all(bind=engine)
        
        # Seed divisions
        logger.info("Seeding divisions...")
        existing_divisions = db.query(Division).count()
        
        if existing_divisions == 0:
            for div_data in DIVISIONS_DATA:
                division = Division(**div_data)
                db.add(division)
            db.commit()
            logger.info(f"Seeded {len(DIVISIONS_DATA)} divisions")
        else:
            logger.info(f"Database already contains {existing_divisions} divisions, skipping")
        
        # Seed IoT devices
        logger.info("Seeding IoT devices...")
        existing_devices = db.query(IoTDevice).count()
        
        if existing_devices == 0:
            for dev_data in IOT_DEVICES_DATA:
                # Find division by name
                division = db.query(Division).filter(
                    Division.division_name == dev_data.pop("division_name")
                ).first()
                
                if division:
                    device = IoTDevice(
                        division_id=division.division_id,
                        **dev_data
                    )
                    db.add(device)
                else:
                    logger.warning(f"Division not found for device {dev_data['device_id']}")
            
            db.commit()
            logger.info(f"Seeded {len(IOT_DEVICES_DATA)} IoT devices")
        else:
            logger.info(f"Database already contains {existing_devices} devices, skipping")
        
        logger.info("Database seeding completed successfully!")
    
    except Exception as e:
        logger.error(f"Error seeding database: {e}")
        db.rollback()
        raise
    
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
