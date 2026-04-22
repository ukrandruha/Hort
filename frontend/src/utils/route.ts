import { haversineKm } from "./math";
import { GeoCoordinate } from "./coordinates";

export interface RoutePoint {
  coordinate: GeoCoordinate;
  timestampMs: number;
}

export class Route {
  private readonly points: RoutePoint[] = [];

  addCoordinate(coordinate: GeoCoordinate, timestamp: Date | number = Date.now()): boolean {
    const timestampMs = timestamp instanceof Date ? timestamp.getTime() : Number(timestamp);
    if (!Number.isFinite(timestampMs)) {
      return false;
    }

    this.points.push({ coordinate, timestampMs });
    return true;
  }

  addRaw(latitude: unknown, longitude: unknown, timestamp: Date | number = Date.now()): boolean {
    const coordinate = GeoCoordinate.tryCreate(latitude, longitude);
    if (!coordinate) {
      return false;
    }

    return this.addCoordinate(coordinate, timestamp);
  }

  clear(): void {
    this.points.length = 0;
  }

  size(): number {
    return this.points.length;
  }

  getPoints(): RoutePoint[] {
    return [...this.points];
  }

  getDistanceKm(): number {
    if (this.points.length < 2) {
      return 0;
    }

    let totalKm = 0;
    for (let i = 1; i < this.points.length; i += 1) {
      const prev = this.points[i - 1].coordinate;
      const curr = this.points[i].coordinate;
      totalKm += haversineKm(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
    }

    return totalKm;
  }

  getDistanceMeters(): number {
    return this.getDistanceKm() * 1000;
  }

  getTravelTimeMs(): number {
    if (this.points.length < 2) {
      return 0;
    }

    const firstTimestamp = this.points[0].timestampMs;
    const lastTimestamp = this.points[this.points.length - 1].timestampMs;
    return Math.max(0, lastTimestamp - firstTimestamp);
  }

  getTravelTimeSeconds(): number {
    return this.getTravelTimeMs() / 1000;
  }

  getTravelTimeMinutes(): number {
    return this.getTravelTimeMs() / 60000;
  }
}
