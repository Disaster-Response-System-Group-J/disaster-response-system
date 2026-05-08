-- SQL Reference: Insert All 121 Division Locations with Integer IDs
-- Complete insert script for all Sri Lankan disaster response divisions
-- NOTE: Use the API or seed script instead for production!

-- Insert all 121 divisions with complete data (integer location_id)
INSERT INTO "Division" (division_id, division_name, district, province, latitude, longitude)
VALUES
  -- Central Province (30 divisions)
  (1, 'Ududumbara', 'Kandy', 'Central', 7.3, 80.8333),
  (2, 'Laggala', 'Matale', 'Central', 7.6, 80.75),
  (3, 'Lunugala', 'Badulla', 'Uva', 7.0, 81.05),
  (4, 'Kothmale East', 'Nuwara Eliya', 'Central', 7.1, 80.6167),
  (5, 'Passara', 'Badulla', 'Uva', 7.05, 81.15),
  (6, 'Meegahakiula', 'Badulla', 'Uva', 6.9833, 81.0),
  (7, 'Soranathota', 'Badulla', 'Uva', 7.15, 81.05),
  (8, 'Rideegama', 'Kurunegala', 'North Western', 7.7167, 80.3833),
  (9, 'Hanguranketa', 'Nuwara Eliya', 'Central', 7.1667, 80.8),
  (10, 'Kandeketiya', 'Badulla', 'Uva', 7.0833, 81.1833),
  (11, 'Thalawakele', 'Nuwara Eliya', 'Central', 6.936, 80.654),
  (12, 'Medadumbara', 'Kandy', 'Central', 7.3333, 80.7833),
  (13, 'Minipe', 'Kandy', 'Central', 7.35, 80.9167),
  (14, 'Deltota', 'Kandy', 'Central', 7.2, 80.5333),
  (15, 'Doluwa', 'Kandy', 'Central', 7.2167, 80.7167),
  (16, 'Mathurata', 'Nuwara Eliya', 'Central', 7.0833, 80.85),
  (17, 'Pathahewaheta', 'Kandy', 'Central', 7.1167, 80.5167),
  (18, 'Ambanganga', 'Matale', 'Central', 7.6333, 80.55),
  (19, 'Aranayake', 'Kegalle', 'Sabaragamuwa', 7.2167, 80.1667),
  (20, 'Rattota', 'Matale', 'Central', 7.5333, 80.75),
  (21, 'Walapane', 'Nuwara Eliya', 'Central', 7.0833, 80.8833),
  (22, 'Polpitigama', 'Kurunegala', 'North Western', 7.8833, 80.1833),
  (23, 'Mallawapitiya', 'Kurunegala', 'North Western', 7.3833, 80.4333),
  (24, 'Welimada', 'Badulla', 'Uva', 6.9, 80.9167),
  (25, 'Ratnapura', 'Ratnapura', 'Sabaragamuwa', 6.6797, 80.3992),
  (26, 'Bulathkohipitiya', 'Kegalle', 'Sabaragamuwa', 7.2833, 80.2167),
  (27, 'Yatinuwara', 'Kandy', 'Central', 7.25, 80.6833),
  (28, 'Matale', 'Matale', 'Central', 7.4675, 80.6235),
  (29, 'Kothmale West', 'Nuwara Eliya', 'Central', 7.1, 80.6),
  (30, 'Alawwa', 'Kurunegala', 'North Western', 7.2833, 80.25),
  
  -- Uva Province (12 divisions)
  (31, 'Badulla', 'Badulla', 'Uva', 6.9895, 81.0557),
  (32, 'Bibile', 'Monaragala', 'Uva', 7.1667, 81.2333),
  (33, 'Kuruvita', 'Ratnapura', 'Sabaragamuwa', 6.75, 80.3167),
  (34, 'Kolonna', 'Ratnapura', 'Sabaragamuwa', 6.4333, 80.4667),
  (35, 'Udunuwara', 'Kandy', 'Central', 7.2167, 80.5833),
  (36, 'Dompe', 'Gampaha', 'Western', 7.0167, 80.0833),
  (37, 'Akurana', 'Kandy', 'Central', 7.35, 80.6167),
  (38, 'Harispattuwa', 'Kandy', 'Central', 7.2833, 80.5667),
  (39, 'Pasbagekorale', 'Kandy', 'Central', 7.1333, 80.4167),
  (40, 'Dambulla', 'Matale', 'Central', 7.8731, 80.6517),
  (41, 'Pallepola', 'Matale', 'Central', 7.6333, 80.5833),
  (42, 'Norwood', 'Nuwara Eliya', 'Central', 6.8333, 80.6167),
  
  -- Sabaragamuwa Province (8 divisions)
  (43, 'Yatiyantota', 'Kegalle', 'Sabaragamuwa', 7.0833, 80.3167),
  (44, 'Rideemaliyadda', 'Badulla', 'Uva', 6.9833, 81.0833),
  (45, 'Ibbagamuwa', 'Kurunegala', 'North Western', 7.7, 80.3),
  (46, 'Nuwara Eliya', 'Nuwara Eliya', 'Central', 6.9497, 80.7891),
  (47, 'Mawathagama', 'Kurunegala', 'North Western', 7.5333, 80.45),
  (48, 'Ganga Ihala Korale', 'Kandy', 'Central', 7.3167, 80.75),
  (49, 'Ukuwela', 'Matale', 'Central', 7.5167, 80.6167),
  (50, 'Nildandahinna', 'Nuwara Eliya', 'Central', 7.0833, 80.8833),
  
  -- More Sabaragamuwa (continued)
  (51, 'Mawanella', 'Kegalle', 'Sabaragamuwa', 7.25, 80.45),
  (52, 'Warakapola', 'Kegalle', 'Sabaragamuwa', 7.25, 80.2167),
  (53, 'Poojapitiya', 'Kandy', 'Central', 7.4167, 80.7),
  (54, 'Naula', 'Matale', 'Central', 7.7667, 80.75),
  (55, 'Wilgamuwa', 'Matale', 'Central', 7.8167, 80.75),
  (56, 'Hatharaliyadda', 'Kandy', 'Central', 7.1833, 80.7),
  (57, 'Yatawatta', 'Matale', 'Central', 7.5833, 80.7833),
  (58, 'Pathadumbara', 'Kandy', 'Central', 7.2167, 80.75),
  (59, 'Panvila', 'Kandy', 'Central', 7.2333, 80.6833),
  (60, 'Polgahawela', 'Kurunegala', 'North Western', 7.3333, 80.3),
  (61, 'Rambukkana', 'Kegalle', 'Sabaragamuwa', 7.3333, 80.4167),
  (62, 'Udapalatha', 'Kandy', 'Central', 7.1833, 80.5667),
  
  -- North Western Province (10 divisions)
  (63, 'Vadamaradchchi East', 'Jaffna', 'Northern', 9.8333, 80.25),
  (64, 'Galenbidunuwewa', 'Anuradhapura', 'North Central', 8.45, 80.7),
  (65, 'Thamankaduwa', 'Polonnaruwa', 'North Central', 7.9, 81.0167),
  (66, 'Nanaddan', 'Mannar', 'Northern', 8.6667, 80.0),
  (67, 'Oddusuddan', 'Mullaitivu', 'Northern', 9.1667, 80.7),
  (68, 'Nuwaragam Palatha Central', 'Anuradhapura', 'North Central', 8.3333, 80.3667),
  (69, 'Muthur', 'Trincomalee', 'Eastern', 8.4567, 81.2267),
  (70, 'Kebithigollewa', 'Anuradhapura', 'North Central', 8.2833, 80.7667),
  (71, 'Thenmaradchi (Chavakachcheri)', 'Jaffna', 'Northern', 9.8, 80.1),
  (72, 'Nochchiyagama', 'Anuradhapura', 'North Central', 8.05, 80.25),
  
  -- North Central Province (18 divisions)
  (73, 'Higurakgoda', 'Polonnaruwa', 'North Central', 8.05, 80.9667),
  (74, 'Galgamuwa', 'Kurunegala', 'North Western', 8.0667, 80.2667),
  (75, 'Mundel', 'Puttalam', 'North Western', 8.0667, 79.85),
  (76, 'Mannar Town', 'Mannar', 'Northern', 8.976, 79.9047),
  (77, 'Padaviya', 'Anuradhapura', 'North Central', 8.85, 80.7),
  (78, 'Vengalacheddikulam', 'Vavuniya', 'Northern', 8.85, 80.4),
  (79, 'Vavuniya North', 'Vavuniya', 'Northern', 8.8333, 80.5),
  (80, 'Pachchilaipalli', 'Kilinochchi', 'Northern', 9.7833, 80.2),
  (81, 'Kinniya', 'Trincomalee', 'Eastern', 8.5167, 81.2667),
  (82, 'Thirappane', 'Anuradhapura', 'North Central', 8.2167, 80.5167),
  (83, 'Thalawa', 'Anuradhapura', 'North Central', 8.2167, 80.5667),
  (84, 'Dimbulagala', 'Polonnaruwa', 'North Central', 7.9167, 81.2167),
  (85, 'Kandavalai', 'Kilinochchi', 'Northern', 9.4667, 80.3833),
  (86, 'Maritimepattu', 'Mullaitivu', 'Northern', 9.3833, 80.8167),
  (87, 'Welikanda', 'Polonnaruwa', 'North Central', 7.95, 81.25),
  (88, 'Medirigiriya', 'Polonnaruwa', 'North Central', 8.0667, 81.1667),
  (89, 'Horowpathana', 'Anuradhapura', 'North Central', 9.0, 80.7333),
  (90, 'Poonakary', 'Kilinochchi', 'Northern', 9.3, 80.25),
  
  -- Eastern Province (10 divisions)
  (91, 'Kantale', 'Trincomalee', 'Eastern', 8.4, 81.0),
  (92, 'Kuchchaweli', 'Trincomalee', 'Eastern', 8.7667, 81.0833),
  (93, 'Dehiattakandiya', 'Ampara', 'Eastern', 7.3833, 81.3333),
  (94, 'Koralai Pattu South', 'Batticaloa', 'Eastern', 7.5833, 81.7833),
  (95, 'Vavuniya', 'Vavuniya', 'Northern', 8.7514, 80.4971),
  (96, 'Koralai Pattu North', 'Batticaloa', 'Eastern', 7.7333, 81.7167),
  (97, 'Manthai West', 'Mannar', 'Northern', 8.8833, 79.95),
  (98, 'Karachchi', 'Kilinochchi', 'Northern', 9.45, 80.35),
  (99, 'Mahiyanganaya', 'Badulla', 'Uva', 7.3297, 81.0),
  (100, 'Kahatagasdigiliya', 'Anuradhapura', 'North Central', 8.5833, 80.7667),
  
  -- Northern Province (10 divisions)
  (101, 'Medawachchiya', 'Anuradhapura', 'North Central', 8.5333, 80.4833),
  (102, 'Kekirawa', 'Anuradhapura', 'North Central', 8.05, 80.6167),
  (103, 'Rambewa', 'Anuradhapura', 'North Central', 8.2667, 80.3333),
  (104, 'Eravur Pattu', 'Batticaloa', 'Eastern', 7.8, 81.6333),
  (105, 'Ambalantota', 'Hambantota', 'Southern', 6.1, 81.0),
  (106, 'Ehetuwewa', 'Kurunegala', 'North Western', 7.9, 80.2),
  (107, 'Giribawa', 'Kurunegala', 'North Western', 8.1, 80.1),
  (108, 'Gomarankadawala', 'Trincomalee', 'Eastern', 8.6, 81.0),
  (109, 'Karuwalagaswewa', 'Puttalam', 'North Western', 8.0, 79.9),
  (110, 'Lankapura', 'Polonnaruwa', 'North Central', 7.9, 81.0),
  
  -- Final divisions
  (111, 'Mahawilachchiya', 'Anuradhapura', 'North Central', 8.4, 80.1),
  (112, 'Mihinthale', 'Anuradhapura', 'North Central', 8.35, 80.5),
  (113, 'Morawewa', 'Trincomalee', 'Eastern', 8.6, 80.9),
  (114, 'Musali', 'Mannar', 'Northern', 8.8, 79.9),
  (115, 'Palagala', 'Anuradhapura', 'North Central', 8.0, 80.5),
  (116, 'Sammanthurai', 'Ampara', 'Eastern', 7.3, 81.8),
  (117, 'Seruvila', 'Trincomalee', 'Eastern', 8.4, 81.2),
  (118, 'Thanamalwila', 'Monaragala', 'Uva', 6.4, 81.1),
  (119, 'Vavuniya South', 'Vavuniya', 'Northern', 8.7, 80.5),
  (120, 'Verugal', 'Trincomalee', 'Eastern', 8.2, 81.3),
  (121, 'Welioya', 'Mullaitivu', 'Northern', 8.8, 80.7)
ON CONFLICT (division_name) DO NOTHING;

-- Summary: 121 divisions total across 9 provinces

-- Statistics queries:

-- Count all divisions
-- SELECT COUNT(*) as total_divisions FROM "Division";

-- Count by province
-- SELECT province, COUNT(*) as count FROM "Division" GROUP BY province ORDER BY count DESC;

-- Count by location_id
-- SELECT location_id, COUNT(*) FROM "Division" GROUP BY location_id;

-- Get all divisions with their location IDs
-- SELECT location_id, name, district, province, latitude, longitude FROM "Division" ORDER BY location_id;

-- Check data integrity
-- SELECT COUNT(*) as total FROM "Division";
-- SELECT COUNT(DISTINCT province) as provinces FROM "Division";
-- SELECT COUNT(DISTINCT district) as districts FROM "Division";
-- SELECT COUNT(*) as with_coords FROM "Division" WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
-- SELECT COUNT(*) as with_location_ids FROM "Division" WHERE location_id IS NOT NULL;
