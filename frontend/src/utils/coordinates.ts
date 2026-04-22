import * as mgrs from "mgrs";

export class GeoCoordinate {
  readonly latitude: number;
  readonly longitude: number;

  private constructor(latitude: number, longitude: number) {
    this.latitude = latitude;
    this.longitude = longitude;
  }

  static tryCreate(latitude: unknown, longitude: unknown): GeoCoordinate | null {
    const lat = Number(latitude);
    const lng = Number(longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }

    return new GeoCoordinate(lat, lng);
  }

  isZeroPair(): boolean {
    return this.latitude === 0 && this.longitude === 0;
  }

  hasNegativePart(): boolean {
    return this.latitude < 0 || this.longitude < 0;
  }

  toMGRS(accuracy = 5): string {
    return mgrs.forward([this.longitude, this.latitude], accuracy);
  }

  toDecimalString(decimals = 7): string {
    return `${this.latitude.toFixed(decimals)}, ${this.longitude.toFixed(decimals)}`;
  }

  toTuple(): [number, number] {
    return [this.latitude, this.longitude];
  }
}

export function isInvalidTelemetryPoint(
  coordinate: GeoCoordinate | null,
  speed: unknown,
  maxSpeedKmh: number,
): boolean {
  if (!coordinate) {
    return true;
  }

  if (coordinate.hasNegativePart()) {
    return true;
  }

  const numericSpeed = Number(speed);
  if (Number.isFinite(numericSpeed) && numericSpeed > maxSpeedKmh) {
    return true;
  }

  return false;
}
