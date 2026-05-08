-- SQL Script: Update Division Population from CSV Data
-- Run this directly in Supabase SQL Editor
-- Matches by division_name and updates division_population column
-- Total: 121 divisions

-- Start transaction
BEGIN;

-- Update all divisions with population data
UPDATE "Division" SET division_population = 63000 WHERE division_name = 'Akurana';
UPDATE "Division" SET division_population = 55874 WHERE division_name = 'Alawwa';
UPDATE "Division" SET division_population = 82771 WHERE division_name = 'Ambalantota';
UPDATE "Division" SET division_population = 128221 WHERE division_name = 'Ambanganga';
UPDATE "Division" SET division_population = 53259 WHERE division_name = 'Aranayake';
UPDATE "Division" SET division_population = 73000 WHERE division_name = 'Badulla';
UPDATE "Division" SET division_population = 131874 WHERE division_name = 'Bibile';
UPDATE "Division" SET division_population = 87879 WHERE division_name = 'Bulathkohipitiya';
UPDATE "Division" SET division_population = 85000 WHERE division_name = 'Dambulla';
UPDATE "Division" SET division_population = 78533 WHERE division_name = 'Dehiattakandiya';
UPDATE "Division" SET division_population = 47490 WHERE division_name = 'Deltota';
UPDATE "Division" SET division_population = 47435 WHERE division_name = 'Dimbulagala';
UPDATE "Division" SET division_population = 67574 WHERE division_name = 'Doluwa';
UPDATE "Division" SET division_population = 23002 WHERE division_name = 'Dompe';
UPDATE "Division" SET division_population = 25274 WHERE division_name = 'Ehetuwewa';
UPDATE "Division" SET division_population = 45200 WHERE division_name = 'Eravur Pattu';
UPDATE "Division" SET division_population = 36083 WHERE division_name = 'Galenbidunuwewa';
UPDATE "Division" SET division_population = 70061 WHERE division_name = 'Galgamuwa';
UPDATE "Division" SET division_population = 38024 WHERE division_name = 'Ganga Ihala Korale';
UPDATE "Division" SET division_population = 29550 WHERE division_name = 'Giribawa';
UPDATE "Division" SET division_population = 124595 WHERE division_name = 'Gomarankadawala';
UPDATE "Division" SET division_population = 53482 WHERE division_name = 'Hanguranketa';
UPDATE "Division" SET division_population = 61930 WHERE division_name = 'Harispattuwa';
UPDATE "Division" SET division_population = 29366 WHERE division_name = 'Hatharaliyadda';
UPDATE "Division" SET division_population = 45606 WHERE division_name = 'Higurakgoda';
UPDATE "Division" SET division_population = 63288 WHERE division_name = 'Horowpathana';
UPDATE "Division" SET division_population = 33674 WHERE division_name = 'Ibbagamuwa';
UPDATE "Division" SET division_population = 72247 WHERE division_name = 'Kahatagasdigiliya';
UPDATE "Division" SET division_population = 44341 WHERE division_name = 'Kandavalai';
UPDATE "Division" SET division_population = 51748 WHERE division_name = 'Kandeketiya';
UPDATE "Division" SET division_population = 44318 WHERE division_name = 'Kantale';
UPDATE "Division" SET division_population = 151166 WHERE division_name = 'Karachchi';
UPDATE "Division" SET division_population = 59471 WHERE division_name = 'Karuwalagaswewa';
UPDATE "Division" SET division_population = 35282 WHERE division_name = 'Kebithigollewa';
UPDATE "Division" SET division_population = 90334 WHERE division_name = 'Kekirawa';
UPDATE "Division" SET division_population = 32518 WHERE division_name = 'Kinniya';
UPDATE "Division" SET division_population = 66465 WHERE division_name = 'Kolonna';
UPDATE "Division" SET division_population = 22475 WHERE division_name = 'Koralai Pattu North';
UPDATE "Division" SET division_population = 30819 WHERE division_name = 'Koralai Pattu South';
UPDATE "Division" SET division_population = 66067 WHERE division_name = 'Kothmale East';
UPDATE "Division" SET division_population = 86615 WHERE division_name = 'Kothmale West';
UPDATE "Division" SET division_population = 65230 WHERE division_name = 'Kuchchaweli';
UPDATE "Division" SET division_population = 56510 WHERE division_name = 'Kuruvita';
UPDATE "Division" SET division_population = 51505 WHERE division_name = 'Laggala';
UPDATE "Division" SET division_population = 28587 WHERE division_name = 'Lankapura';
UPDATE "Division" SET division_population = 41776 WHERE division_name = 'Lunugala';
UPDATE "Division" SET division_population = 47556 WHERE division_name = 'Mahawilachchiya';
UPDATE "Division" SET division_population = 101575 WHERE division_name = 'Mahiyanganaya';
UPDATE "Division" SET division_population = 71097 WHERE division_name = 'Mallawapitiya';
UPDATE "Division" SET division_population = 51000 WHERE division_name = 'Mannar Town';
UPDATE "Division" SET division_population = 70406 WHERE division_name = 'Manthai West';
UPDATE "Division" SET division_population = 49387 WHERE division_name = 'Maritimepattu';
UPDATE "Division" SET division_population = 42682 WHERE division_name = 'Matale';
UPDATE "Division" SET division_population = 81294 WHERE division_name = 'Mathurata';
UPDATE "Division" SET division_population = 111000 WHERE division_name = 'Mawanella';
UPDATE "Division" SET division_population = 95381 WHERE division_name = 'Mawathagama';
UPDATE "Division" SET division_population = 39355 WHERE division_name = 'Medadumbara';
UPDATE "Division" SET division_population = 51297 WHERE division_name = 'Medawachchiya';
UPDATE "Division" SET division_population = 70659 WHERE division_name = 'Medirigiriya';
UPDATE "Division" SET division_population = 97516 WHERE division_name = 'Meegahakiula';
UPDATE "Division" SET division_population = 47118 WHERE division_name = 'Mihinthale';
UPDATE "Division" SET division_population = 54566 WHERE division_name = 'Minipe';
UPDATE "Division" SET division_population = 34435 WHERE division_name = 'Morawewa';
UPDATE "Division" SET division_population = 32922 WHERE division_name = 'Mundel';
UPDATE "Division" SET division_population = 89882 WHERE division_name = 'Musali';
UPDATE "Division" SET division_population = 117962 WHERE division_name = 'Muthur';
UPDATE "Division" SET division_population = 57756 WHERE division_name = 'Nanaddan';
UPDATE "Division" SET division_population = 98890 WHERE division_name = 'Naula';
UPDATE "Division" SET division_population = 71741 WHERE division_name = 'Nildandahinna';
UPDATE "Division" SET division_population = 43366 WHERE division_name = 'Nochchiyagama';
UPDATE "Division" SET division_population = 71732 WHERE division_name = 'Norwood';
UPDATE "Division" SET division_population = 75000 WHERE division_name = 'Nuwara Eliya';
UPDATE "Division" SET division_population = 58811 WHERE division_name = 'Nuwaragam Palatha Central';
UPDATE "Division" SET division_population = 130917 WHERE division_name = 'Oddusuddan';
UPDATE "Division" SET division_population = 16157 WHERE division_name = 'Pachchilaipalli';
UPDATE "Division" SET division_population = 90305 WHERE division_name = 'Padaviya';
UPDATE "Division" SET division_population = 62537 WHERE division_name = 'Palagala';
UPDATE "Division" SET division_population = 51559 WHERE division_name = 'Pallepola';
UPDATE "Division" SET division_population = 62685 WHERE division_name = 'Panvila';
UPDATE "Division" SET division_population = 22163 WHERE division_name = 'Pasbagekorale';
UPDATE "Division" SET division_population = 53646 WHERE division_name = 'Passara';
UPDATE "Division" SET division_population = 71578 WHERE division_name = 'Pathadumbara';
UPDATE "Division" SET division_population = 125360 WHERE division_name = 'Pathahewaheta';
UPDATE "Division" SET division_population = 46205 WHERE division_name = 'Polgahawela';
UPDATE "Division" SET division_population = 39964 WHERE division_name = 'Polpitigama';
UPDATE "Division" SET division_population = 46589 WHERE division_name = 'Poojapitiya';
UPDATE "Division" SET division_population = 94627 WHERE division_name = 'Poonakary';
UPDATE "Division" SET division_population = 70571 WHERE division_name = 'Rambewa';
UPDATE "Division" SET division_population = 45941 WHERE division_name = 'Rambukkana';
UPDATE "Division" SET division_population = 77391 WHERE division_name = 'Ratnapura';
UPDATE "Division" SET division_population = 62852 WHERE division_name = 'Rattota';
UPDATE "Division" SET division_population = 97180 WHERE division_name = 'Rideegama';
UPDATE "Division" SET division_population = 42149 WHERE division_name = 'Rideemaliyadda';
UPDATE "Division" SET division_population = 50826 WHERE division_name = 'Sammanthurai';
UPDATE "Division" SET division_population = 49214 WHERE division_name = 'Seruvila';
UPDATE "Division" SET division_population = 28803 WHERE division_name = 'Soranathota';
UPDATE "Division" SET division_population = 69429 WHERE division_name = 'Thalawa';
UPDATE "Division" SET division_population = 68222 WHERE division_name = 'Thalawakele';
UPDATE "Division" SET division_population = 60027 WHERE division_name = 'Thamankaduwa';
UPDATE "Division" SET division_population = 53247 WHERE division_name = 'Thanamalwila';
UPDATE "Division" SET division_population = 29504 WHERE division_name = 'Thenmaradchi (Chavakachcheri)';
UPDATE "Division" SET division_population = 48517 WHERE division_name = 'Thirappane';
UPDATE "Division" SET division_population = 50445 WHERE division_name = 'Udapalatha';
UPDATE "Division" SET division_population = 40089 WHERE division_name = 'Ududumbara';
UPDATE "Division" SET division_population = 55235 WHERE division_name = 'Udunuwara';
UPDATE "Division" SET division_population = 73278 WHERE division_name = 'Ukuwela';
UPDATE "Division" SET division_population = 153751 WHERE division_name = 'Vadamaradchchi East';
UPDATE "Division" SET division_population = 65335 WHERE division_name = 'Vavuniya';
UPDATE "Division" SET division_population = 68102 WHERE division_name = 'Vavuniya North';
UPDATE "Division" SET division_population = 57686 WHERE division_name = 'Vavuniya South';
UPDATE "Division" SET division_population = 22939 WHERE division_name = 'Vengalacheddikulam';
UPDATE "Division" SET division_population = 59085 WHERE division_name = 'Verugal';
UPDATE "Division" SET division_population = 61704 WHERE division_name = 'Walapane';
UPDATE "Division" SET division_population = 205175 WHERE division_name = 'Warakapola';
UPDATE "Division" SET division_population = 54383 WHERE division_name = 'Welikanda';
UPDATE "Division" SET division_population = 69617 WHERE division_name = 'Welimada';
UPDATE "Division" SET division_population = 58843 WHERE division_name = 'Welioya';
UPDATE "Division" SET division_population = 33378 WHERE division_name = 'Wilgamuwa';
UPDATE "Division" SET division_population = 106023 WHERE division_name = 'Yatawatta';
UPDATE "Division" SET division_population = 87200 WHERE division_name = 'Yatinuwara';
UPDATE "Division" SET division_population = 88922 WHERE division_name = 'Yatiyantota';

-- Commit transaction
COMMIT;

-- Verify updates
SELECT 
  COUNT(*) as total_divisions,
  COUNT(CASE WHEN division_population IS NOT NULL THEN 1 END) as divisions_with_population,
  COUNT(CASE WHEN division_population IS NULL THEN 1 END) as divisions_without_population,
  ROUND(AVG(division_population)) as avg_population,
  MIN(division_population) as min_population,
  MAX(division_population) as max_population
FROM "Division";

-- Show divisions with population (sample)
SELECT 
  division_id,
  division_name,
  district,
  province,
  division_population
FROM "Division"
WHERE division_population IS NOT NULL
ORDER BY division_population DESC
LIMIT 10;
