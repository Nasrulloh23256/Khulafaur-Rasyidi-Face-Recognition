export type AttendanceAreaStatus = {
  isInside: boolean;
  distanceMeters: number;
  radiusMeters: number;
  label: "Di area" | "Di luar area";
};

type AttendanceCoordinates = {
  latitude: number;
  longitude: number;
};

export const BIMBEL_LOCATION = {
  latitude: -7.405898281263192,
  longitude: 112.59609002393708,
};

export const BIMBEL_RADIUS_METERS = 5;

const toRadians = (value: number) => (value * Math.PI) / 180;

export const getDistanceMeters = (from: AttendanceCoordinates, to: AttendanceCoordinates) => {
  const earthRadiusMeters = 6371000;
  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLng = toRadians(to.longitude - from.longitude);
  const fromLat = toRadians(from.latitude);
  const toLat = toRadians(to.latitude);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMeters * c;
};

export const getAttendanceAreaStatus = (
  location: AttendanceCoordinates | null | undefined,
): AttendanceAreaStatus | null => {
  if (!location) return null;

  const distanceMeters = Math.round(getDistanceMeters(location, BIMBEL_LOCATION));
  const isInside = distanceMeters <= BIMBEL_RADIUS_METERS;

  return {
    isInside,
    distanceMeters,
    radiusMeters: BIMBEL_RADIUS_METERS,
    label: isInside ? "Di area" : "Di luar area",
  };
};
