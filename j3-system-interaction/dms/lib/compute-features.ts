import { PrismaClient } from "@prisma/client";
import { computeSPI } from "./spi";

const prisma = new PrismaClient();

// sklearn LabelEncoder on alphabetically sorted division names (0–120)
export const DIVISION_ENCODING: Record<string, number> = {
  "Akurana": 0, "Alawwa": 1, "Ambalantota": 2, "Ambanganga": 3, "Aranayake": 4,
  "Badulla": 5, "Bibile": 6, "Bulathkohipitiya": 7, "Dambulla": 8, "Dehiattakandiya": 9,
  "Deltota": 10, "Dimbulagala": 11, "Doluwa": 12, "Dompe": 13, "Ehetuwewa": 14,
  "Eravur Pattu": 15, "Galenbidunuwewa": 16, "Galgamuwa": 17, "Ganga Ihala Korale": 18,
  "Giribawa": 19, "Gomarankadawala": 20, "Hanguranketa": 21, "Harispattuwa": 22,
  "Hatharaliyadda": 23, "Higurakgoda": 24, "Horowpathana": 25, "Ibbagamuwa": 26,
  "Kahatagasdigiliya": 27, "Kandavalai": 28, "Kandeketiya": 29, "Kantale": 30,
  "Karachchi": 31, "Karuwalagaswewa": 32, "Kebithigollewa": 33, "Kekirawa": 34,
  "Kinniya": 35, "Kolonna": 36, "Koralai Pattu North": 37, "Koralai Pattu South": 38,
  "Kothmale East": 39, "Kothmale West": 40, "Kuchchaweli": 41, "Kuruvita": 42,
  "Laggala": 43, "Lankapura": 44, "Lunugala": 45, "Mahawilachchiya": 46,
  "Mahiyanganaya": 47, "Mallawapitiya": 48, "Mannar Town": 49, "Manthai West": 50,
  "Maritimepattu": 51, "Matale": 52, "Mathurata": 53, "Mawanella": 54,
  "Mawathagama": 55, "Medadumbara": 56, "Medawachchiya": 57, "Medirigiriya": 58,
  "Meegahakiula": 59, "Mihinthale": 60, "Minipe": 61, "Morawewa": 62, "Mundel": 63,
  "Musali": 64, "Muthur": 65, "Nanaddan": 66, "Naula": 67, "Nildandahinna": 68,
  "Nochchiyagama": 69, "Norwood": 70, "Nuwara Eliya": 71, "Nuwaragam Palatha Central": 72,
  "Oddusuddan": 73, "Pachchilaipalli": 74, "Padaviya": 75, "Palagala": 76, "Pallepola": 77,
  "Panvila": 78, "Pasbagekorale": 79, "Passara": 80, "Pathadumbara": 81,
  "Pathahewaheta": 82, "Polgahawela": 83, "Polpitigama": 84, "Poojapitiya": 85,
  "Poonakary": 86, "Rambewa": 87, "Rambukkana": 88, "Ratnapura": 89, "Rattota": 90,
  "Rideegama": 91, "Rideemaliyadda": 92, "Sammanthurai": 93, "Seruvila": 94,
  "Soranathota": 95, "Thalawa": 96, "Thalawakele": 97, "Thamankaduwa": 98,
  "Thanamalwila": 99, "Thenmaradchi (Chavakachcheri)": 100, "Thirappane": 101,
  "Udapalatha": 102, "Ududumbara": 103, "Udunuwara": 104, "Ukuwela": 105,
  "Vadamaradchchi East": 106, "Vavuniya": 107, "Vavuniya North": 108,
  "Vavuniya South": 109, "Vengalacheddikulam": 110, "Verugal": 111, "Walapane": 112,
  "Warakapola": 113, "Welikanda": 114, "Welimada": 115, "Welioya": 116,
  "Wilgamuwa": 117, "Yatawatta": 118, "Yatinuwara": 119, "Yatiyantota": 120,
};

// ─── Main export ─────────────────────────────────────────────────────────────

export async function computeAndSaveFeatures(): Promise<{ success: number; failed: number }> {
  const results = { success: 0, failed: 0 };

  const divisions = await prisma.division.findMany({
    select: { divisionId: true, name: true },
    orderBy: { name: "asc" },
  });

  for (const division of divisions) {
    try {
      const allRainfall = await prisma.rainfallData.findMany({
        where: { divisionId: division.divisionId },
        orderBy: { date: "asc" },
        select: { date: true, rainSum: true },
      });

      if (allRainfall.length === 0) {
        console.log(`[Compute] Skipping ${division.name} — no rainfall data`);
        continue;
      }

      const rainSums = allRainfall.map((r) => r.rainSum);
      const spiValues = computeSPI(rainSums);
      const divisionEncoded = DIVISION_ENCODING[division.name] ?? null;

      for (let i = 0; i < allRainfall.length; i++) {
        const { date, rainSum } = allRainfall[i];
        const month = date.getMonth() + 1;

        const rainLag1 = i >= 1 ? allRainfall[i - 1].rainSum : null;
        const rainRolling3d = i >= 2
          ? allRainfall.slice(i - 2, i + 1).reduce((s, r) => s + (r.rainSum ?? 0), 0)
          : null;
        const rainRolling7d = i >= 6
          ? allRainfall.slice(i - 6, i + 1).reduce((s, r) => s + (r.rainSum ?? 0), 0)
          : null;

        const payload = {
          rainLag1,
          rainRolling3d,
          rainRolling7d,
          monthSin: Math.sin((2 * Math.PI * month) / 12),
          monthCos: Math.cos((2 * Math.PI * month) / 12),
          spi: spiValues[i],
          divisionEncoded,
        };

        await prisma.computedFeatures.upsert({
          where: { divisionId_date: { divisionId: division.divisionId, date } },
          update: payload,
          create: { divisionId: division.divisionId, date, ...payload },
        });
      }

      console.log(`[Compute] ✓ ${division.name} — ${allRainfall.length} days`);
      results.success++;
    } catch (error) {
      console.error(`[Compute] ✗ ${division.name}:`, error);
      results.failed++;
    }
  }

  return results;
}
