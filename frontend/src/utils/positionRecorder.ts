import { api } from "../api/api";
import { positionRecorderConfig } from "../config/positionRecorder";
import { haversineKm } from "./math";

export interface PositionRecorderSample {
  robotId: string;
  devicetime?: string | Date | number;
  latitude: number;
  longitude: number;
  altitude?: number;
  speed?: number;
  accuracy?: number;
  heading?: number | null;
}

interface NormalizedSample {
  robotId: string;
  devicetime: string;
  timestampMs: number;
  latitude: number;
  longitude: number;
  altitude?: number;
  speed?: number;
  accuracy?: number;
  heading: number | null;
}

interface PositionRecorderOptions {
  distanceThresholdMeters?: number;
  headingThresholdDegrees?: number;
  timeoutMs?: number;
  maxSpeedKmh?: number;
}

const DEFAULT_DISTANCE_THRESHOLD_METERS = positionRecorderConfig.distanceThresholdMeters;
const DEFAULT_HEADING_THRESHOLD_DEGREES = positionRecorderConfig.headingThresholdDegrees;
const DEFAULT_TIMEOUT_MS = positionRecorderConfig.timeoutMs;
const DEFAULT_MAX_SPEED_KMH = positionRecorderConfig.maxSpeedKmh;

function normalizeHeading(heading?: number | null): number | null {
  if (!Number.isFinite(heading)) return null;
  return ((((heading as number) % 360) + 360) % 360);
}

function headingDeltaDegrees(a: number | null, b: number | null): number {
  if (a === null || b === null) return 0;
  const delta = Math.abs(a - b);
  return Math.min(delta, 360 - delta);
}

function normalizeSample(sample: PositionRecorderSample): NormalizedSample | null {
  const latitude = Number(sample.latitude);
  const longitude = Number(sample.longitude);

  if (!sample.robotId || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  if (latitude === 0 && longitude === 0) {
    return null;
  }

  const rawTime = sample.devicetime ?? Date.now();
  const deviceDate = rawTime instanceof Date ? rawTime : new Date(rawTime);
  const timestampMs = deviceDate.getTime();

  if (Number.isNaN(timestampMs)) {
    return null;
  }

  const altitude = Number(sample.altitude);
  const speed = Number(sample.speed);
  const accuracy = Number(sample.accuracy);

  return {
    robotId: sample.robotId,
    devicetime: deviceDate.toISOString(),
    timestampMs,
    latitude,
    longitude,
    altitude: Number.isFinite(altitude) ? altitude : undefined,
    speed: Number.isFinite(speed) ? speed : undefined,
    accuracy: Number.isFinite(accuracy) ? accuracy : undefined,
    heading: normalizeHeading(sample.heading),
  };
}

export class PositionRecorder {
  private readonly distanceThresholdMeters: number;
  private readonly headingThresholdDegrees: number;
  private readonly timeoutMs: number;
  private readonly maxSpeedKmh: number;
  private lastSaved: NormalizedSample | null = null;
  private latestSeen: NormalizedSample | null = null;
  private writeChain: Promise<void> = Promise.resolve();
  private active = false;

  constructor(options: PositionRecorderOptions = {}) {
    this.distanceThresholdMeters = options.distanceThresholdMeters ?? DEFAULT_DISTANCE_THRESHOLD_METERS;
    this.headingThresholdDegrees = options.headingThresholdDegrees ?? DEFAULT_HEADING_THRESHOLD_DEGREES;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxSpeedKmh = options.maxSpeedKmh ?? DEFAULT_MAX_SPEED_KMH;
  }

  startSession() {
    this.active = true;
    this.lastSaved = null;
    this.latestSeen = null;
    this.writeChain = Promise.resolve();
  }

  async record(sample: PositionRecorderSample) {
    if (!this.active) return;

    const normalized = normalizeSample(sample);
    if (!normalized) return;

    if (normalized.speed !== undefined && normalized.speed > this.maxSpeedKmh) {
      return;
    }

    this.latestSeen = normalized;

    if (!this.shouldPersist(normalized)) {
      return;
    }

    await this.persist(normalized);
  }

  async endSession() {
    if (!this.active) return;
    this.active = false;

    const lastPoint = this.latestSeen;
    if (lastPoint && this.shouldPersistLastPoint(lastPoint)) {
      await this.persist(lastPoint);
    }

    await this.writeChain;
    this.lastSaved = null;
    this.latestSeen = null;
  }

  private shouldPersist(sample: NormalizedSample): boolean {
    if (!this.lastSaved) {
      return true;
    }

    const distanceMeters = haversineKm(
      this.lastSaved.latitude,
      this.lastSaved.longitude,
      sample.latitude,
      sample.longitude,
    ) * 1000;

    if (distanceMeters >= this.distanceThresholdMeters) {
      return true;
    }

    const headingDelta = headingDeltaDegrees(this.lastSaved.heading, sample.heading);
    if (headingDelta >= this.headingThresholdDegrees) {
      return true;
    }

    const elapsedMs = sample.timestampMs - this.lastSaved.timestampMs;
    return elapsedMs >= this.timeoutMs;
  }

  private shouldPersistLastPoint(sample: NormalizedSample): boolean {
    if (!this.lastSaved) {
      return true;
    }

    return sample.timestampMs > this.lastSaved.timestampMs;
  }

  private persist(sample: NormalizedSample): Promise<void> {
    this.writeChain = this.writeChain
      .catch(() => undefined)
      .then(async () => {
        await api.post("/api/robots/positions", {
          robotId: sample.robotId,
          devicetime: sample.devicetime,
          latitude: sample.latitude,
          longitude: sample.longitude,
          altitude: sample.altitude,
          speed: sample.speed,
          accuracy: sample.accuracy,
        });
        this.lastSaved = sample;
      });

    return this.writeChain;
  }
}