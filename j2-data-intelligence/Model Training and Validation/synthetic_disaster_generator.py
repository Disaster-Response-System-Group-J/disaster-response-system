import csv
import random
from pathlib import Path


INPUT_PATH = Path('/home/vihanga/Downloads/division_population_map.csv')
OUTPUT_PATH = Path('/home/vihanga/Downloads/synthetic_disaster_dataset.csv')

random.seed(20260504)

LOCATION_HINTS = {
    'Ududumbara': ('Kandy', 'Central', 7.3000, 80.8333),
    'Laggala': ('Matale', 'Central', 7.6000, 80.7500),
    'Lunugala': ('Badulla', 'Uva', 7.0000, 81.0500),
    'Kothmale East': ('Nuwara Eliya', 'Central', 7.1000, 80.6167),
    'Passara': ('Badulla', 'Uva', 7.0500, 81.1500),
    'Meegahakiula': ('Badulla', 'Uva', 6.9833, 81.0000),
    'Soranathota': ('Badulla', 'Uva', 7.1500, 81.0500),
    'Rideegama': ('Kurunegala', 'North Western', 7.7167, 80.3833),
    'Hanguranketa': ('Nuwara Eliya', 'Central', 7.1667, 80.8000),
    'Kandeketiya': ('Badulla', 'Uva', 7.0833, 81.1833),
    'Thalawakele': ('Nuwara Eliya', 'Central', 6.9360, 80.6540),
    'Medadumbara': ('Kandy', 'Central', 7.3333, 80.7833),
    'Minipe': ('Kandy', 'Central', 7.3500, 80.9167),
    'Deltota': ('Kandy', 'Central', 7.2000, 80.5333),
    'Doluwa': ('Kandy', 'Central', 7.2167, 80.7167),
    'Mathurata': ('Nuwara Eliya', 'Central', 7.0833, 80.8500),
    'Pathahewaheta': ('Kandy', 'Central', 7.1167, 80.5167),
    'Ambanganga': ('Matale', 'Central', 7.6333, 80.5500),
    'Aranayake': ('Kegalle', 'Sabaragamuwa', 7.2167, 80.1667),
    'Rattota': ('Matale', 'Central', 7.5333, 80.7500),
    'Walapane': ('Nuwara Eliya', 'Central', 7.0833, 80.8833),
    'Polpitigama': ('Kurunegala', 'North Western', 7.8833, 80.1833),
    'Mallawapitiya': ('Kurunegala', 'North Western', 7.3833, 80.4333),
    'Welimada': ('Badulla', 'Uva', 6.9000, 80.9167),
    'Ratnapura': ('Ratnapura', 'Sabaragamuwa', 6.6797, 80.3992),
    'Bulathkohipitiya': ('Kegalle', 'Sabaragamuwa', 7.2833, 80.2167),
    'Yatinuwara': ('Kandy', 'Central', 7.2500, 80.6833),
    'Matale': ('Matale', 'Central', 7.4675, 80.6235),
    'Kothmale West': ('Nuwara Eliya', 'Central', 7.1000, 80.6000),
    'Alawwa': ('Kurunegala', 'North Western', 7.2833, 80.2500),
    'Badulla': ('Badulla', 'Uva', 6.9895, 81.0557),
    'Bibile': ('Monaragala', 'Uva', 7.1667, 81.2333),
    'Kuruvita': ('Ratnapura', 'Sabaragamuwa', 6.7500, 80.3167),
    'Kolonna': ('Ratnapura', 'Sabaragamuwa', 6.4333, 80.4667),
    'Udunuwara': ('Kandy', 'Central', 7.2167, 80.5833),
    'Dompe': ('Gampaha', 'Western', 7.0167, 80.0833),
    'Akurana': ('Kandy', 'Central', 7.3500, 80.6167),
    'Harispattuwa': ('Kandy', 'Central', 7.2833, 80.5667),
    'Pasbagekorale': ('Kandy', 'Central', 7.1333, 80.4167),
    'Dambulla': ('Matale', 'Central', 7.8731, 80.6517),
    'Pallepola': ('Matale', 'Central', 7.6333, 80.5833),
    'Norwood': ('Nuwara Eliya', 'Central', 6.8333, 80.6167),
    'Yatiyantota': ('Kegalle', 'Sabaragamuwa', 7.0833, 80.3167),
    'Rideemaliyadda': ('Badulla', 'Uva', 6.9833, 81.0833),
    'Ibbagamuwa': ('Kurunegala', 'North Western', 7.7000, 80.3000),
    'Nuwara Eliya': ('Nuwara Eliya', 'Central', 6.9497, 80.7891),
    'Mawathagama': ('Kurunegala', 'North Western', 7.5333, 80.4500),
    'Ganga Ihala Korale': ('Kandy', 'Central', 7.3167, 80.7500),
    'Ukuwela': ('Matale', 'Central', 7.5167, 80.6167),
    'Nildandahinna': ('Nuwara Eliya', 'Central', 7.0833, 80.8833),
    'Mawanella': ('Kegalle', 'Sabaragamuwa', 7.2500, 80.4500),
    'Warakapola': ('Kegalle', 'Sabaragamuwa', 7.2500, 80.2167),
    'Poojapitiya': ('Kandy', 'Central', 7.4167, 80.7000),
    'Naula': ('Matale', 'Central', 7.7667, 80.7500),
    'Wilgamuwa': ('Matale', 'Central', 7.8167, 80.7500),
    'Hatharaliyadda': ('Kandy', 'Central', 7.1833, 80.7000),
    'Yatawatta': ('Matale', 'Central', 7.5833, 80.7833),
    'Pathadumbara': ('Kandy', 'Central', 7.2167, 80.7500),
    'Panvila': ('Kandy', 'Central', 7.2333, 80.6833),
    'Polgahawela': ('Kurunegala', 'North Western', 7.3333, 80.3000),
    'Rambukkana': ('Kegalle', 'Sabaragamuwa', 7.3333, 80.4167),
    'Udapalatha': ('Kandy', 'Central', 7.1833, 80.5667),
    'Vadamaradchchi East': ('Jaffna', 'Northern', 9.8333, 80.2500),
    'Galenbidunuwewa': ('Anuradhapura', 'North Central', 8.4500, 80.7000),
    'Thamankaduwa': ('Polonnaruwa', 'North Central', 7.9000, 81.0167),
    'Nanaddan': ('Mannar', 'Northern', 8.6667, 80.0000),
    'Oddusuddan': ('Mullaitivu', 'Northern', 9.1667, 80.7000),
    'Nuwaragam Palatha Central': ('Anuradhapura', 'North Central', 8.3333, 80.3667),
    'Muthur': ('Trincomalee', 'Eastern', 8.4567, 81.2267),
    'Kebithigollewa': ('Anuradhapura', 'North Central', 8.2833, 80.7667),
    'Thenmaradchi (Chavakachcheri)': ('Jaffna', 'Northern', 9.8000, 80.1000),
    'Nochchiyagama': ('Anuradhapura', 'North Central', 8.0500, 80.2500),
    'Higurakgoda': ('Polonnaruwa', 'North Central', 8.0500, 80.9667),
    'Galgamuwa': ('Kurunegala', 'North Western', 8.0667, 80.2667),
    'Mundel': ('Puttalam', 'North Western', 8.0667, 79.8500),
    'Mannar Town': ('Mannar', 'Northern', 8.9760, 79.9047),
    'Padaviya': ('Anuradhapura', 'North Central', 8.8500, 80.7000),
    'Vengalacheddikulam': ('Vavuniya', 'Northern', 8.8500, 80.4000),
    'Vavuniya North': ('Vavuniya', 'Northern', 8.8333, 80.5000),
    'Pachchilaipalli': ('Kilinochchi', 'Northern', 9.7833, 80.2000),
    'Kinniya': ('Trincomalee', 'Eastern', 8.5167, 81.2667),
    'Thirappane': ('Anuradhapura', 'North Central', 8.2167, 80.5167),
    'Thalawa': ('Anuradhapura', 'North Central', 8.2167, 80.5667),
    'Dimbulagala': ('Polonnaruwa', 'North Central', 7.9167, 81.2167),
    'Kandavalai': ('Kilinochchi', 'Northern', 9.4667, 80.3833),
    'Maritimepattu': ('Mullaitivu', 'Northern', 9.3833, 80.8167),
    'Welikanda': ('Polonnaruwa', 'North Central', 7.9500, 81.2500),
    'Medirigiriya': ('Polonnaruwa', 'North Central', 8.0667, 81.1667),
    'Horowpathana': ('Anuradhapura', 'North Central', 9.0000, 80.7333),
    'Poonakary': ('Kilinochchi', 'Northern', 9.3000, 80.2500),
    'Kantale': ('Trincomalee', 'Eastern', 8.4000, 81.0000),
    'Kuchchaweli': ('Trincomalee', 'Eastern', 8.7667, 81.0833),
    'Dehiattakandiya': ('Ampara', 'Eastern', 7.3833, 81.3333),
    'Koralai Pattu South': ('Batticaloa', 'Eastern', 7.5833, 81.7833),
    'Vavuniya': ('Vavuniya', 'Northern', 8.7514, 80.4971),
    'Koralai Pattu North': ('Batticaloa', 'Eastern', 7.7333, 81.7167),
    'Manthai West': ('Mannar', 'Northern', 8.8833, 79.9500),
    'Karachchi': ('Kilinochchi', 'Northern', 9.4500, 80.3500),
    'Mahiyanganaya': ('Badulla', 'Uva', 7.3297, 81.0000),
    'Kahatagasdigiliya': ('Anuradhapura', 'North Central', 8.5833, 80.7667),
    'Medawachchiya': ('Anuradhapura', 'North Central', 8.5333, 80.4833),
    'Kekirawa': ('Anuradhapura', 'North Central', 8.0500, 80.6167),
    'Rambewa': ('Anuradhapura', 'North Central', 8.2667, 80.3333),
    'Eravur Pattu': ('Batticaloa', 'Eastern', 7.8000, 81.6333),
    'Ambalantota': ('Hambantota', 'Southern', 6.10, 81.00),
    'Ehetuwewa': ('Kurunegala', 'North Western', 7.90, 80.20),
    'Giribawa': ('Kurunegala', 'North Western', 8.10, 80.10),
    'Gomarankadawala': ('Trincomalee', 'Eastern', 8.60, 81.00),
    'Karuwalagaswewa': ('Puttalam', 'North Western', 8.00, 79.90),
    'Lankapura': ('Polonnaruwa', 'North Central', 7.90, 81.00),
    'Mahawilachchiya': ('Anuradhapura', 'North Central', 8.40, 80.10),
    'Mihinthale': ('Anuradhapura', 'North Central', 8.35, 80.50),
    'Morawewa': ('Trincomalee', 'Eastern', 8.60, 80.90),
    'Musali': ('Mannar', 'Northern', 8.80, 79.90),
    'Palagala': ('Anuradhapura', 'North Central', 8.00, 80.50),
    'Sammanthurai': ('Ampara', 'Eastern', 7.30, 81.80),
    'Seruvila': ('Trincomalee', 'Eastern', 8.40, 81.20),
    'Thanamalwila': ('Monaragala', 'Uva', 6.40, 81.10),
    'Vavuniya South': ('Vavuniya', 'Northern', 8.70, 80.50),
    'Verugal': ('Trincomalee', 'Eastern', 8.20, 81.30),
    'Welioya': ('Mullaitivu', 'Northern', 8.80, 80.70),
}


def classify(division: str) -> str:
    district, province, lat, lon = LOCATION_HINTS.get(division, (None, None, None, None))
    if province in {'Central', 'Sabaragamuwa', 'Uva'}:
        if district in {'Nuwara Eliya', 'Kandy', 'Badulla', 'Matale', 'Kegalle', 'Ratnapura'}:
            if lat is not None and lat >= 7.0 and lon is not None and lon >= 80.3:
                return 'hill'
        return 'upland'
    if province in {'Northern', 'North Central', 'Eastern', 'North Western'}:
        return 'dry'
    return 'coastal'


def disaster_for_zone(zone: str) -> str:
    if zone == 'hill':
        weights = [('Landslide', 0.55), ('Flood', 0.25), ('Drought', 0.20)]
    elif zone == 'dry':
        weights = [('Drought', 0.55), ('Flood', 0.30), ('Landslide', 0.15)]
    else:
        weights = [('Flood', 0.58), ('Drought', 0.25), ('Landslide', 0.17)]

    draw = random.random()
    total = 0.0
    for name, weight in weights:
        total += weight
        if draw <= total:
            return name
    return weights[-1][0]


with INPUT_PATH.open(newline='', encoding='utf-8') as f:
    divisions = list(csv.DictReader(f))

records = []
for row in divisions:
    division = row['division']
    population = int(row['population'])
    zone = classify(division)

    if zone == 'hill':
        active_disaster = random.random() < 0.72
    elif zone == 'dry':
        active_disaster = random.random() < 0.58
    else:
        active_disaster = random.random() < 0.64

    primary = disaster_for_zone(zone) if active_disaster else ''

    hospital_bed_capacity = '' if random.random() < 0.07 else max(0, round(population * random.uniform(0.0010, 0.0030)))
    emergency_shelters = '' if random.random() < 0.08 else max(0, round(population / random.uniform(5000, 15000)))
    ambulance_count = '' if random.random() < 0.09 else max(0, round(population / random.uniform(12000, 30000)))
    food_stock_tons = '' if random.random() < 0.08 else round(population * random.uniform(0.00010, 0.00035), 2)
    clean_water_capacity_liters = '' if random.random() < 0.07 else round(population * random.uniform(6.0, 18.0), 0)
    power_grid_resilience = '' if random.random() < 0.08 else round(min(1.0, max(0.05, random.uniform(0.38, 0.96))), 2)

    if not primary:
        hazard_risk_index = ''
        historical_frequency_per_decade = ''
        avg_inundation_depth_cm = ''
        displaced_population = ''
        accessibility_score = '' if random.random() < 0.55 else round(random.uniform(82, 100), 1)
        medical_relief_required = ''
    else:
        if primary == 'Landslide':
            hazard_risk_index = '' if random.random() < 0.06 else round(random.uniform(5.2, 9.5), 1)
            historical_frequency_per_decade = '' if random.random() < 0.08 else random.randint(3, 15)
            avg_inundation_depth_cm = ''
            displaced_population = '' if random.random() < 0.10 else max(0, min(population, int(round(population * random.uniform(0.003, 0.04)))))
            accessibility_score = '' if random.random() < 0.08 else round(max(8.0, min(100.0, random.uniform(15, 78))), 1)
            medical_relief_required = '' if random.random() < 0.12 else (0 if displaced_population in ('', 0) else int(round(displaced_population * random.uniform(0.12, 0.32))))
        elif primary == 'Drought':
            hazard_risk_index = '' if random.random() < 0.06 else round(random.uniform(4.0, 8.9), 1)
            historical_frequency_per_decade = '' if random.random() < 0.08 else random.randint(2, 13)
            avg_inundation_depth_cm = ''
            displaced_population = '' if random.random() < 0.12 else max(0, min(population, int(round(population * random.uniform(0.001, 0.018)))))
            accessibility_score = '' if random.random() < 0.08 else round(max(35.0, min(100.0, random.uniform(52, 97))), 1)
            medical_relief_required = '' if random.random() < 0.12 else (0 if displaced_population in ('', 0) else int(round(displaced_population * random.uniform(0.06, 0.20))))
        else:
            hazard_risk_index = '' if random.random() < 0.06 else round(random.uniform(4.8, 9.2), 1)
            historical_frequency_per_decade = '' if random.random() < 0.08 else random.randint(3, 15)
            if hazard_risk_index == '':
                avg_inundation_depth_cm = '' if random.random() < 0.45 else round(random.uniform(20, 160), 0)
            else:
                avg_inundation_depth_cm = '' if random.random() < 0.15 else round(random.uniform(15, 220) * (float(hazard_risk_index) / 8.5), 0)
            displaced_population = '' if random.random() < 0.10 else max(0, min(population, int(round(population * random.uniform(0.002, 0.05)))))
            accessibility_score = '' if random.random() < 0.08 else round(max(12.0, min(100.0, random.uniform(20, 86))), 1)
            medical_relief_required = '' if random.random() < 0.12 else (0 if displaced_population in ('', 0) else int(round(displaced_population * random.uniform(0.10, 0.30))))

    records.append({
        'division': division,
        'population': population,
        'hospital_bed_capacity': hospital_bed_capacity,
        'emergency_shelters': emergency_shelters,
        'ambulance_count': ambulance_count,
        'food_stock_tons': food_stock_tons,
        'clean_water_capacity_liters': clean_water_capacity_liters,
        'power_grid_resilience': power_grid_resilience,
        'primary_disaster_type': primary,
        'hazard_risk_index': hazard_risk_index,
        'historical_frequency_per_decade': historical_frequency_per_decade,
        'avg_inundation_depth_cm': avg_inundation_depth_cm,
        'displaced_population': displaced_population,
        'accessibility_score': accessibility_score,
        'medical_relief_required': medical_relief_required,
    })

FIELDNAMES = [
    'division', 'population',
    'hospital_bed_capacity', 'emergency_shelters', 'ambulance_count', 'food_stock_tons',
    'clean_water_capacity_liters', 'power_grid_resilience', 'primary_disaster_type',
    'hazard_risk_index', 'historical_frequency_per_decade', 'avg_inundation_depth_cm',
    'displaced_population', 'accessibility_score', 'medical_relief_required',
]

with OUTPUT_PATH.open('w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
    writer.writeheader()
    writer.writerows(records)

counts = {'Flood': 0, 'Drought': 0, 'Landslide': 0, '': 0}
for record in records:
    counts[record['primary_disaster_type']] += 1

print('wrote', len(records), 'rows to', OUTPUT_PATH)
print('counts', counts)
