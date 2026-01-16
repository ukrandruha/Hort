import { AppError } from "./errors.js";

// Валідація email
export function validateEmail(email: string): void {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new AppError(400, "Invalid email format", "INVALID_EMAIL");
  }
}

// Валідація пароля
export function validatePassword(password: string): void {
  if (password.length < 6) {
    throw new AppError(400, "Password must be at least 6 characters", "INVALID_PASSWORD");
  }
}

// Валідація координат
export function validateCoordinates(lat: number, lng: number): void {
  if (lat < -90 || lat > 90) {
    throw new AppError(400, "Latitude must be between -90 and 90", "INVALID_LAT");
  }
  if (lng < -180 || lng > 180) {
    throw new AppError(400, "Longitude must be between -180 and 180", "INVALID_LNG");
  }
}

// Валідація robotId
export function validateRobotId(robotId: string): void {
  if (!robotId || robotId.trim().length === 0) {
    throw new AppError(400, "Robot ID is required", "INVALID_ROBOT_ID");
  }
}
