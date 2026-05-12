import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { Kafka } from 'kafkajs';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import {
  attachLevelDifferences,
  buildComputedFeatureRecord,
  buildKafkaRiskAlert,
  ComputedFeatureRecord,
  DivisionContext,
  IoTRainfallReading,
  normalizePredictionRows,
  PredictionRecord,
  WeatherSnapshot,
} from '../lib/iot-risk-pipeline';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({ connectionString: DATABASE_URL });
const brokerCandidates = (process.env.KAFKA_BROKER || 'localhost:29092,localhost:9092')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const kafkaTopic = process.env.KAFKA_TOPIC || 'j2.engine.risk-alerts';

type WeatherTablePayload = WeatherSnapshot & { date: string };

function parseFlag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }

  const nextValue = process.argv[index + 1];
  if (!nextValue || nextValue.startsWith('--')) {
    return 'true';
  }

  return nextValue;
}

function parseNumberFlag(name: string, fallback: number): number {
  const value = parseFlag(name);
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asDateOnly(value: Date | string): string {
  const dateValue = value instanceof Date ? value : new Date(value);
  return dateValue.toISOString().slice(0, 10);
}

function formatTimestamp(value: Date): string {
  return value.toISOString();
}

async function loadDivisionEncoding(): Promise<Map<string, number>> {
  const { rows } = await pool.query<{ division_name: string }>(
    'SELECT division_name FROM public."Division" ORDER BY division_name ASC'
  );
  const encoding = new Map<string, number>();
  rows.forEach((row, index) => encoding.set(row.division_name, index));
  return encoding;
}

async function loadDivisionContext(deviceId: string, encoding: Map<string, number>): Promise<DivisionContext & { deviceId: string }> {
  const query = `
    SELECT
      d.division_id,
      d.division_name,
      d.district,
      d.latitude,
      d.longitude,
      d.division_population AS population,
      i.device_id
    FROM public."IoT_Device" i
    INNER JOIN public."Division" d ON d.division_id = i.division_id
    WHERE i.device_id = $1
    LIMIT 1
  `;
  const { rows } = await pool.query(query, [deviceId]);
  if (rows.length === 0) {
    throw new Error(`No IoT device found for device_id=${deviceId}`);
  }

  const row = rows[0];
  return {
    deviceId: row.device_id,
    divisionId: Number(row.division_id),
    divisionName: row.division_name,
    district: row.district,
    population: row.population !== null ? Number(row.population) : null,
    latitude: row.latitude !== null ? Number(row.latitude) : null,
    longitude: row.longitude !== null ? Number(row.longitude) : null,
    divisionEncoded: encoding.get(row.division_name) ?? null,
  };
}

async function seedSyntheticIotRows(deviceId: string, rowCount: number): Promise<Array<IoTRainfallReading & { recordedAt: string }>> {
  const now = new Date();
  const syntheticRows = Array.from({ length: rowCount }, (_, index) => {
    const recordedAt = new Date(now.getTime() - (rowCount - index) * 10 * 60 * 1000);
    const depth = Number((0.35 + index * 0.17).toFixed(2));
    const temp = Number((29.5 + index * 0.6).toFixed(1));
    const hum = Number((72 - index * 4.5).toFixed(1));

    return {
      id: deviceId,
      type: 'FLOOD',
      temp,
      hum,
      depth,
      recorded_at: formatTimestamp(recordedAt),
    };
  });

  for (const row of syntheticRows) {
    await pool.query(
      `
        INSERT INTO public.iot_rainfall_data (id, type, temp, hum, depth, recorded_at)
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [row.id, row.type, row.temp, row.hum, row.depth, row.recorded_at]
    );
  }

  return syntheticRows.map((row, index) => ({
    rowId: undefined,
    deviceId: row.id,
    sensorType: row.type,
    temp: row.temp,
    hum: row.hum,
    depth: row.depth,
    recordedAt: row.recorded_at,
  }));
}

async function loadRecentIotRows(deviceId: string, limit: number, since?: string): Promise<IoTRainfallReading[]> {
  const query = since
    ? `
      SELECT row_id, id, type, temp, hum, depth, recorded_at
      FROM public.iot_rainfall_data
      WHERE id = $1 AND recorded_at >= $2
      ORDER BY recorded_at ASC, row_id ASC
      LIMIT $3
    `
    : `
      SELECT row_id, id, type, temp, hum, depth, recorded_at
      FROM public.iot_rainfall_data
      WHERE id = $1
      ORDER BY recorded_at DESC, row_id DESC
      LIMIT $2
    `;

  const { rows } = await pool.query(
    query,
    since ? [deviceId, since, limit] : [deviceId, limit]
  );

  return rows
    .map((row) => ({
      rowId: Number(row.row_id),
      deviceId: row.id,
      sensorType: row.type,
      temp: row.temp !== null ? Number(row.temp) : null,
      hum: row.hum !== null ? Number(row.hum) : null,
      depth: row.depth !== null ? Number(row.depth) : null,
      recordedAt: row.recorded_at,
    }))
    .sort((left, right) => new Date(left.recordedAt).getTime() - new Date(right.recordedAt).getTime());
}

async function loadPreviousIotRow(deviceId: string, before: Date): Promise<IoTRainfallReading | null> {
  const { rows } = await pool.query(
    `
      SELECT row_id, id, type, temp, hum, depth, recorded_at
      FROM public.iot_rainfall_data
      WHERE id = $1 AND recorded_at < $2
      ORDER BY recorded_at DESC, row_id DESC
      LIMIT 1
    `,
    [deviceId, before.toISOString()]
  );

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    rowId: Number(row.row_id),
    deviceId: row.id,
    sensorType: row.type,
    temp: row.temp !== null ? Number(row.temp) : null,
    hum: row.hum !== null ? Number(row.hum) : null,
    depth: row.depth !== null ? Number(row.depth) : null,
    recordedAt: row.recorded_at,
  };
}

async function fetchOpenMeteoForDivision(division: DivisionContext): Promise<WeatherTablePayload> {
  if (division.latitude === null || division.longitude === null) {
    throw new Error(`Division ${division.divisionName} does not have coordinates`);
  }

  const date = asDateOnly(new Date());
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(division.latitude));
  url.searchParams.set('longitude', String(division.longitude));
  url.searchParams.set('daily', 'rain_sum,temperature_2m_max,temperature_2m_min');
  url.searchParams.set('hourly', 'soil_moisture_0_to_1cm,soil_moisture_1_to_3cm,soil_moisture_3_to_9cm');
  url.searchParams.set('timezone', 'UTC');
  url.searchParams.set('start_date', date);
  url.searchParams.set('end_date', date);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`OpenMeteo request failed: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  const daily = payload.daily || {};
  const hourly = payload.hourly || {};
  const dailyIndex = (daily.time || []).findIndex((entry: string) => entry === date);
  if (dailyIndex === -1) {
    throw new Error(`OpenMeteo returned no daily data for ${date}`);
  }

  const times: string[] = hourly.time || [];
  const dayIndices = times.reduce<number[]>((indices, entry, index) => {
    if (entry.startsWith(date)) {
      indices.push(index);
    }
    return indices;
  }, []);

  const averageFor = (key: string): number | null => {
    const values = dayIndices
      .map((index) => hourly[key]?.[index])
      .filter((value: unknown) => value !== null && value !== undefined) as number[];

    if (values.length === 0) {
      return null;
    }

    return Number((values.reduce((sum, value) => sum + Number(value), 0) / values.length).toFixed(4));
  };

  const rainSum = daily.rain_sum?.[dailyIndex] ?? null;
  const tempMax = daily.temperature_2m_max?.[dailyIndex] ?? null;
  const tempMin = daily.temperature_2m_min?.[dailyIndex] ?? null;
  const temperature = tempMax !== null && tempMin !== null
    ? Number(((Number(tempMax) + Number(tempMin)) / 2).toFixed(4))
    : (tempMax ?? tempMin ?? null);

  return {
    date,
    rainSum: rainSum !== null ? Number(rainSum) : null,
    temperature: temperature !== null ? Number(temperature) : null,
    soilMoisture7_28cm: averageFor('soil_moisture_0_to_1cm'),
    soilMoisture28_100cm: averageFor('soil_moisture_1_to_3cm'),
    soilMoisture100_255cm: averageFor('soil_moisture_3_to_9cm'),
  };
}

async function upsertWeatherTables(divisionId: number, weather: WeatherTablePayload): Promise<void> {
  await pool.query(
    `
      INSERT INTO public."RainfallData" (division_id, date, rain_sum)
      VALUES ($1, $2, $3)
      ON CONFLICT (division_id, date)
      DO UPDATE SET rain_sum = EXCLUDED.rain_sum
    `,
    [divisionId, weather.date, weather.rainSum]
  );

  await pool.query(
    `
      INSERT INTO public."TemperatureData" (division_id, date, temperature)
      VALUES ($1, $2, $3)
      ON CONFLICT (division_id, date)
      DO UPDATE SET temperature = EXCLUDED.temperature
    `,
    [divisionId, weather.date, weather.temperature]
  );

  await pool.query(
    `
      INSERT INTO public."SoilMoisture" (
        division_id,
        date,
        moisture_7_28cm,
        moisture_28_100cm,
        moisture_100_255cm
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (division_id, date)
      DO UPDATE SET
        moisture_7_28cm = EXCLUDED.moisture_7_28cm,
        moisture_28_100cm = EXCLUDED.moisture_28_100cm,
        moisture_100_255cm = EXCLUDED.moisture_100_255cm
    `,
    [
      divisionId,
      weather.date,
      weather.soilMoisture7_28cm,
      weather.soilMoisture28_100cm,
      weather.soilMoisture100_255cm,
    ]
  );
}

async function loadRainfallHistory(divisionId: number): Promise<Array<number | null>> {
  const { rows } = await pool.query(
    `
      SELECT rain_sum
      FROM public."RainfallData"
      WHERE division_id = $1
      ORDER BY date ASC
    `,
    [divisionId]
  );

  return rows.map((row) => (row.rain_sum !== null ? Number(row.rain_sum) : null));
}

async function loadWeatherSnapshot(divisionId: number, featureDate: string): Promise<WeatherSnapshot> {
  const { rows } = await pool.query(
    `
      SELECT
        r.rain_sum,
        t.temperature,
        s.moisture_7_28cm,
        s.moisture_28_100cm,
        s.moisture_100_255cm
      FROM public."RainfallData" r
      LEFT JOIN public."TemperatureData" t
        ON t.division_id = r.division_id AND t.date = r.date
      LEFT JOIN public."SoilMoisture" s
        ON s.division_id = r.division_id AND s.date = r.date
      WHERE r.division_id = $1 AND r.date = $2
      LIMIT 1
    `,
    [divisionId, featureDate]
  );

  if (rows.length === 0) {
    throw new Error(`No weather snapshot found for division_id=${divisionId} date=${featureDate}`);
  }

  const row = rows[0];
  return {
    rainSum: row.rain_sum !== null ? Number(row.rain_sum) : null,
    temperature: row.temperature !== null ? Number(row.temperature) : null,
    soilMoisture7_28cm: row.moisture_7_28cm !== null ? Number(row.moisture_7_28cm) : null,
    soilMoisture28_100cm: row.moisture_28_100cm !== null ? Number(row.moisture_28_100cm) : null,
    soilMoisture100_255cm: row.moisture_100_255cm !== null ? Number(row.moisture_100_255cm) : null,
  };
}

async function upsertComputedFeature(record: ComputedFeatureRecord): Promise<void> {
  await pool.query(
    `
      INSERT INTO public.computed_features (
        division_id,
        date,
        rain_lag_1,
        rain_rolling_3d,
        rain_rolling_7d,
        month_sin,
        month_cos,
        spi,
        division_encoded,
        level_difference
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (division_id, date)
      DO UPDATE SET
        rain_lag_1 = EXCLUDED.rain_lag_1,
        rain_rolling_3d = EXCLUDED.rain_rolling_3d,
        rain_rolling_7d = EXCLUDED.rain_rolling_7d,
        month_sin = EXCLUDED.month_sin,
        month_cos = EXCLUDED.month_cos,
        spi = EXCLUDED.spi,
        division_encoded = EXCLUDED.division_encoded,
        level_difference = EXCLUDED.level_difference
    `,
    [
      record.divisionId,
      record.date,
      record.rainLag1,
      record.rainRolling3d,
      record.rainRolling7d,
      record.monthSin,
      record.monthCos,
      record.spi,
      record.divisionEncoded,
      record.levelDifference,
    ]
  );
}

async function runModelPrediction(featureRecord: ComputedFeatureRecord & WeatherSnapshot & DivisionContext) {
  const inputRows = [
    {
      division_id: featureRecord.divisionId,
      division_name: featureRecord.divisionName,
      district: featureRecord.district,
      feature_date: featureRecord.date,
      rain_sum: featureRecord.rainSum,
      temperature_2m_mean: featureRecord.temperature,
      soil_moisture_7_to_28cm: featureRecord.soilMoisture7_28cm,
      soil_moisture_28_to_100cm: featureRecord.soilMoisture28_100cm,
      soil_moisture_100_to_255cm: featureRecord.soilMoisture100_255cm,
      rain_lag_1: featureRecord.rainLag1,
      rain_rolling_3d: featureRecord.rainRolling3d,
      rain_rolling_7d: featureRecord.rainRolling7d,
      month_sin: featureRecord.monthSin,
      month_cos: featureRecord.monthCos,
      spi: featureRecord.spi,
      division_encoded: featureRecord.divisionEncoded,
      humidity: null,
      depth: null,
      level_difference: featureRecord.levelDifference,
    },
  ];

  const helperPath = path.resolve(__dirname, 'predict_disaster_models.py');
  const result = spawnSync('python3', [helperPath], {
    input: JSON.stringify(inputRows),
    encoding: 'utf8',
    env: {
      ...process.env,
      MODELS_DIR: path.resolve(__dirname, '..', '..', '..', 'j2-data-intelligence', 'app', 'models'),
    },
  });

  if (result.status !== 0) {
    throw new Error(`Prediction helper failed: ${result.stderr || result.stdout}`);
  }

  const parsed = JSON.parse(result.stdout || '[]') as PredictionRecord[];
  return normalizePredictionRows(parsed);
}

async function upsertPredictions(predictions: PredictionRecord[]): Promise<void> {
  for (const prediction of predictions) {
    await pool.query(
      `
        INSERT INTO public.disaster_predictions (
          division_id,
          feature_date,
          predicted_for_date,
          horizon,
          hazard_type,
          prob_normal,
          prob_moderate,
          prob_severe,
          prob_extreme,
          predicted_severity,
          predicted_severity_label,
          run_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        ON CONFLICT (division_id, feature_date, hazard_type, horizon)
        DO UPDATE SET
          predicted_for_date = EXCLUDED.predicted_for_date,
          prob_normal = EXCLUDED.prob_normal,
          prob_moderate = EXCLUDED.prob_moderate,
          prob_severe = EXCLUDED.prob_severe,
          prob_extreme = EXCLUDED.prob_extreme,
          predicted_severity = EXCLUDED.predicted_severity,
          predicted_severity_label = EXCLUDED.predicted_severity_label,
          run_at = NOW()
      `,
      [
        prediction.division_id,
        prediction.feature_date,
        prediction.predicted_for_date,
        prediction.horizon,
        prediction.hazard_type,
        prediction.prob_normal,
        prediction.prob_moderate,
        prediction.prob_severe,
        prediction.prob_extreme,
        prediction.predicted_severity,
        prediction.predicted_severity_label,
      ]
    );
  }
}

async function publishKafkaAlert(alert: ReturnType<typeof buildKafkaRiskAlert>): Promise<'kafka' | 'docker' | 'outbox'> {
  const kafka = new Kafka({
    clientId: 'j3-iot-risk-pipeline',
    brokers: brokerCandidates,
  });

  const producer = kafka.producer();
  let transport: 'kafka' | 'docker' | 'outbox' = 'kafka';
  try {
    await producer.connect();
    await producer.send({
      topic: kafkaTopic,
      messages: [{ key: String(alert.payload.divisionId), value: JSON.stringify(alert) }],
    });
  } catch (error) {
    const dockerResult = spawnSync(
      'docker',
      [
        'exec',
        '-i',
        'disaster-kafka',
        '/opt/kafka/bin/kafka-console-producer.sh',
        '--bootstrap-server',
        'kafka:29092',
        '--topic',
        kafkaTopic,
      ],
      {
        input: JSON.stringify(alert),
        encoding: 'utf8',
      }
    );

    if (dockerResult.status !== 0) {
      const outboxPath = path.resolve(__dirname, 'iot-risk-alert-outbox.jsonl');
      fs.appendFileSync(
        outboxPath,
        `${JSON.stringify({
          topic: kafkaTopic,
          alert,
          transport: 'outbox',
          timestamp: new Date().toISOString(),
        })}\n`
      );
      console.warn(`[iot-risk-pipeline] Kafka unavailable; wrote alert to ${outboxPath}`);
      transport = 'outbox';
    } else {
      transport = 'docker';
    }
  } finally {
    try {
      await producer.disconnect();
    } catch {
      // ignore shutdown failures
    }
  }

  return transport;
}

async function main() {
  const deviceId = parseFlag('--device') || 'DEV-001';
  const rowCount = parseNumberFlag('--rows', 3);
  const synthetic = process.argv.includes('--synthetic');

  const encoding = await loadDivisionEncoding();
  const division = await loadDivisionContext(deviceId, encoding);

  let syntheticBatch: IoTRainfallReading[] | null = null;
  if (synthetic) {
    syntheticBatch = await seedSyntheticIotRows(deviceId, rowCount);
  }

  const recentRows = syntheticBatch ?? await loadRecentIotRows(deviceId, rowCount);
  if (recentRows.length === 0) {
    throw new Error(`No IoT rainfall rows available for device ${deviceId}`);
  }

  const priorBoundary = new Date(recentRows[0].recordedAt);
  const priorRow = await loadPreviousIotRow(deviceId, priorBoundary);
  const rowsForDifference = priorRow ? [priorRow, ...recentRows] : recentRows;
  const enrichedRows = attachLevelDifferences(rowsForDifference).filter((row) => row.deviceId === deviceId);

  const latestRow = enrichedRows[enrichedRows.length - 1];
  const featureDate = asDateOnly(latestRow.recordedAt);

  const weather = await fetchOpenMeteoForDivision(division);
  await upsertWeatherTables(division.divisionId, weather);

  const rainfallHistory = await loadRainfallHistory(division.divisionId);
  const currentSnapshot = await loadWeatherSnapshot(division.divisionId, featureDate);
  const computedFeature = buildComputedFeatureRecord({
    divisionId: division.divisionId,
    divisionEncoded: division.divisionEncoded,
    divisionName: division.divisionName,
    featureDate,
    rainfallHistory,
    levelDifference: latestRow.levelDifference,
  });

  await upsertComputedFeature(computedFeature);

  const modelInput = {
    ...computedFeature,
    ...currentSnapshot,
    ...division,
  };

  const predictions = await runModelPrediction(modelInput);
  await upsertPredictions(predictions);

  const kafkaAlert = buildKafkaRiskAlert({
    division,
    featureDate,
    predictions,
  });

  const transport = await publishKafkaAlert(kafkaAlert);

  const summary = {
    deviceId,
    divisionId: division.divisionId,
    divisionName: division.divisionName,
    iotRowsProcessed: recentRows.length,
    featureDate,
    computedFeature,
    latestLevelDifference: latestRow.levelDifference,
    predictionsInserted: predictions.length,
    kafkaTopic,
    transport,
    kafkaAlert,
  };

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .then(async () => {
    await pool.end();
  })
  .catch(async (error) => {
    console.error('[iot-risk-pipeline] Failed:', error instanceof Error ? error.stack || error.message : error);
    try {
      await pool.end();
    } catch {
      // ignore shutdown failures
    }
    process.exitCode = 1;
  });