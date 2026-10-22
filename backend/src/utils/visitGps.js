const DEFAULT_GEOFENCE_RADIUS_METERS = 75;
const MAX_GPS_ACCURACY_METERS = 50;

function isValidCoordinatePair(latitude, longitude) {
  return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
    && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
}

function distanceInMeters(latitude1, longitude1, latitude2, longitude2) {
  const radians = degrees => degrees * Math.PI / 180;
  const latitudeDelta = radians(latitude2 - latitude1);
  const longitudeDelta = radians(longitude2 - longitude1);
  const value = Math.min(1, Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(latitude1)) * Math.cos(radians(latitude2))
    * Math.sin(longitudeDelta / 2) ** 2);
  return 6371000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function getDealerGeofenceRadius(dealer) {
  const configuredRadius = process.env.VISIT_GEOFENCE_RADIUS_METERS;
  if (configuredRadius !== undefined) {
    const radius = Number(configuredRadius);
    if (!Number.isFinite(radius) || radius <= 0) {
      throw new Error('VISIT_GEOFENCE_RADIUS_METERS must be a positive number of metres.');
    }
    return radius;
  }

  const radius = Number(dealer?.geofenceRadius ?? DEFAULT_GEOFENCE_RADIUS_METERS);
  return Number.isFinite(radius) && radius > 0 ? radius : DEFAULT_GEOFENCE_RADIUS_METERS;
}

function validateGpsFix(dealer, latitude, longitude, accuracyMeters) {
  if (!isValidCoordinatePair(latitude, longitude)) {
    return { result: 'invalid_coordinates', reason: 'Valid GPS latitude and longitude are required.', distanceMeters: null };
  }
  if (!dealer || dealer.locationVerificationStatus !== 'approved'
    || !isValidCoordinatePair(dealer.latitude, dealer.longitude)) {
    return { result: 'dealer_location_unapproved', reason: 'Dealer GPS coordinates are missing or not approved.', distanceMeters: null };
  }
  if (!Number.isFinite(accuracyMeters) || accuracyMeters < 0) {
    return { result: 'invalid_accuracy', reason: 'A non-negative GPS accuracy value is required.', distanceMeters: null };
  }
  const distanceMeters = distanceInMeters(latitude, longitude, dealer.latitude, dealer.longitude);
  if (accuracyMeters > MAX_GPS_ACCURACY_METERS) {
    return {
      result: 'inaccurate',
      reason: `GPS accuracy exceeds the ${MAX_GPS_ACCURACY_METERS} metre limit.`,
      distanceMeters,
    };
  }
  const radiusMeters = getDealerGeofenceRadius(dealer);
  if (distanceMeters > radiusMeters) {
    return {
      result: 'outside_geofence',
      reason: `GPS is ${Math.round(distanceMeters)} metres away, outside the ${radiusMeters} metre dealer geofence.`,
      distanceMeters,
    };
  }
  return { result: 'accepted', reason: '', distanceMeters };
}

module.exports = {
  DEFAULT_GEOFENCE_RADIUS_METERS,
  MAX_GPS_ACCURACY_METERS,
  distanceInMeters,
  getDealerGeofenceRadius,
  isValidCoordinatePair,
  validateGpsFix,
};
