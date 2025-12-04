import * as turf from '@turf/turf';

const GOOGLE_MAPS_API_KEY = process.env.VITE_GOOGLE_MAPS_API_KEY;

const boundaryCache = new Map();

export async function generatePincodeBoundary(pincode) {
  if (boundaryCache.has(pincode)) {
    console.log(`[ML-Boundary] Cache hit for pincode: ${pincode}`);
    return boundaryCache.get(pincode);
  }

  console.log(`[ML-Boundary] Generating boundary for pincode: ${pincode}`);

  try {
    const geocodeData = await geocodePincode(pincode);
    if (!geocodeData) {
      throw new Error('Failed to geocode pincode');
    }

    const { centroid, viewport, placeId, localities } = geocodeData;
    console.log(`[ML-Boundary] Geocoded ${pincode}: centroid=${centroid.lat},${centroid.lng}`);

    const baseRadius = calculateBaseRadius(viewport);
    console.log(`[ML-Boundary] Base radius: ${baseRadius}m`);

    const radialPoints = generateRadialPoints(centroid, baseRadius, 180);
    console.log(`[ML-Boundary] Generated ${radialPoints.length} radial points`);

    const snappedPoints = await snapPointsToRoads(radialPoints);
    console.log(`[ML-Boundary] Snapped ${snappedPoints.length} points to roads`);

    const effectivePoints = snappedPoints.length > 20 ? snappedPoints : radialPoints;

    const sortedPoints = sortPointsByAngle(effectivePoints, centroid);

    const smoothedCoords = applyChaikiSmoothing(sortedPoints, 3);
    console.log(`[ML-Boundary] Smoothed to ${smoothedCoords.length} points`);

    const closedCoords = [...smoothedCoords];
    if (closedCoords.length > 0 && 
        (closedCoords[0][0] !== closedCoords[closedCoords.length - 1][0] ||
         closedCoords[0][1] !== closedCoords[closedCoords.length - 1][1])) {
      closedCoords.push(closedCoords[0]);
    }

    const polygon = turf.polygon([closedCoords]);

    const result = {
      source: 'google_road_ml_approximation',
      centroid: {
        lat: centroid.lat,
        lng: centroid.lng
      },
      viewport: viewport,
      polygon: polygon,
      placeId: placeId,
      localities: localities,
      boundary: closedCoords.map(coord => ({
        lat: coord[1],
        lng: coord[0]
      })),
      pointCount: closedCoords.length,
      generatedAt: new Date().toISOString()
    };

    boundaryCache.set(pincode, result);
    console.log(`[ML-Boundary] Successfully generated boundary for ${pincode}`);
    
    return result;

  } catch (error) {
    console.error(`[ML-Boundary] Error generating boundary for ${pincode}:`, error);
    throw error;
  }
}

async function geocodePincode(pincode) {
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn('[ML-Boundary] No Google Maps API key configured');
    return null;
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?components=postal_code:${pincode}|country:IN&key=${GOOGLE_MAPS_API_KEY}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      console.warn(`[ML-Boundary] Geocode failed for ${pincode}: ${data.status}`);
      return null;
    }

    const result = data.results[0];
    const location = result.geometry.location;
    const viewport = result.geometry.viewport;
    const placeId = result.place_id;

    const localities = [];
    if (result.postcode_localities) {
      localities.push(...result.postcode_localities);
    }

    const addressComponents = result.address_components || [];
    addressComponents.forEach(comp => {
      if (comp.types.includes('sublocality') || comp.types.includes('locality')) {
        if (!localities.includes(comp.long_name)) {
          localities.push(comp.long_name);
        }
      }
    });

    return {
      centroid: { lat: location.lat, lng: location.lng },
      viewport: {
        northeast: viewport.northeast,
        southwest: viewport.southwest
      },
      placeId,
      localities
    };
  } catch (error) {
    console.error('[ML-Boundary] Geocode API error:', error);
    return null;
  }
}

function calculateBaseRadius(viewport) {
  if (!viewport) return 1000;

  const ne = viewport.northeast;
  const sw = viewport.southwest;
  
  const point1 = turf.point([sw.lng, sw.lat]);
  const point2 = turf.point([ne.lng, ne.lat]);
  const diagonal = turf.distance(point1, point2, { units: 'meters' });
  
  const radius = Math.min(Math.max(diagonal / 2, 500), 3000);
  return radius;
}

function generateRadialPoints(centroid, radius, numRays) {
  const points = [];
  const centerPoint = turf.point([centroid.lng, centroid.lat]);
  
  for (let i = 0; i < numRays; i++) {
    const angle = (i * 360) / numRays;
    
    const radiusVariation = radius * (0.85 + Math.random() * 0.3);
    
    const destination = turf.destination(centerPoint, radiusVariation / 1000, angle, { units: 'kilometers' });
    const coords = destination.geometry.coordinates;
    
    points.push({
      lat: coords[1],
      lng: coords[0],
      angle: angle
    });
  }
  
  return points;
}

async function snapPointsToRoads(points) {
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn('[ML-Boundary] No API key for road snapping');
    return points;
  }

  const BATCH_SIZE = 90;
  const snappedPoints = [];
  
  for (let i = 0; i < points.length; i += BATCH_SIZE) {
    const batch = points.slice(i, i + BATCH_SIZE);
    
    const pathParam = batch
      .map(p => `${p.lat},${p.lng}`)
      .join('|');
    
    const url = `https://roads.googleapis.com/v1/snapToRoads?path=${encodeURIComponent(pathParam)}&interpolate=true&key=${GOOGLE_MAPS_API_KEY}`;
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.snappedPoints && data.snappedPoints.length > 0) {
        data.snappedPoints.forEach(sp => {
          snappedPoints.push({
            lat: sp.location.latitude,
            lng: sp.location.longitude,
            originalIndex: sp.originalIndex
          });
        });
      }
    } catch (error) {
      console.warn(`[ML-Boundary] Road snap batch failed:`, error.message);
    }
    
    if (i + BATCH_SIZE < points.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return snappedPoints.length > 0 ? snappedPoints : points;
}

function sortPointsByAngle(points, centroid) {
  return points
    .map(p => ({
      ...p,
      calculatedAngle: Math.atan2(p.lat - centroid.lat, p.lng - centroid.lng)
    }))
    .sort((a, b) => a.calculatedAngle - b.calculatedAngle)
    .map(p => [p.lng, p.lat]);
}

function applyChaikiSmoothing(coords, iterations = 2) {
  if (coords.length < 3) return coords;
  
  let result = [...coords];
  
  for (let iter = 0; iter < iterations; iter++) {
    const smoothed = [];
    
    for (let i = 0; i < result.length - 1; i++) {
      const p0 = result[i];
      const p1 = result[i + 1];
      
      const q = [
        0.75 * p0[0] + 0.25 * p1[0],
        0.75 * p0[1] + 0.25 * p1[1]
      ];
      
      const r = [
        0.25 * p0[0] + 0.75 * p1[0],
        0.25 * p0[1] + 0.75 * p1[1]
      ];
      
      smoothed.push(q, r);
    }
    
    if (result.length > 0) {
      const lastPoint = result[result.length - 1];
      const firstPoint = result[0];
      
      const q = [
        0.75 * lastPoint[0] + 0.25 * firstPoint[0],
        0.75 * lastPoint[1] + 0.25 * firstPoint[1]
      ];
      
      const r = [
        0.25 * lastPoint[0] + 0.75 * firstPoint[0],
        0.25 * lastPoint[1] + 0.75 * firstPoint[1]
      ];
      
      smoothed.push(q, r);
    }
    
    result = smoothed;
  }
  
  return result;
}

export function clearBoundaryCache(pincode = null) {
  if (pincode) {
    boundaryCache.delete(pincode);
  } else {
    boundaryCache.clear();
  }
}

export function getCacheStats() {
  return {
    size: boundaryCache.size,
    pincodes: Array.from(boundaryCache.keys())
  };
}

export async function queryPointsInBoundary(polygon, collection, db) {
  if (!polygon || !collection) return [];
  
  try {
    const geoJsonPolygon = polygon.geometry || polygon;
    
    const query = {
      location: {
        $geoWithin: {
          $geometry: geoJsonPolygon
        }
      }
    };
    
    const results = await db.collection(collection).find(query).toArray();
    return results;
  } catch (error) {
    console.error('[ML-Boundary] Spatial query error:', error);
    return [];
  }
}

export function isPointInBoundary(point, polygon) {
  try {
    const pt = turf.point([point.lng, point.lat]);
    return turf.booleanPointInPolygon(pt, polygon);
  } catch (error) {
    return false;
  }
}

export async function getNeighborhoodData(centroid) {
  if (!GOOGLE_MAPS_API_KEY) return [];
  
  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${centroid.lat},${centroid.lng}&radius=2000&type=neighborhood|sublocality|locality&key=${GOOGLE_MAPS_API_KEY}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.results) {
      return data.results.map(place => ({
        name: place.name,
        location: place.geometry.location,
        viewport: place.geometry.viewport,
        types: place.types
      }));
    }
  } catch (error) {
    console.warn('[ML-Boundary] Places API error:', error);
  }
  
  return [];
}
