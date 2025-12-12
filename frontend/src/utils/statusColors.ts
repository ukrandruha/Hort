export function getStatusColor(value: number) {
  if (value < 50) return "text-green-400";
  if (value < 80) return "text-yellow-400";
  return "text-red-500";
}

export function getCloudColor(isOnline: boolean) {
  return isOnline ? "text-green-400" : "text-red-500";
}
