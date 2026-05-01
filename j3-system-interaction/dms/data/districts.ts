// ============================================================
// Sri Lanka Districts — Reference Data
// ============================================================

export interface District {
  name: string;
  province: string;
  latitude: number;
  longitude: number;
  floodRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  landslideRisk: 'LOW' | 'MEDIUM' | 'HIGH';
}

export const SRI_LANKA_DISTRICTS: District[] = [
  // Western Province
  { name: 'Colombo', province: 'Western', latitude: 6.9271, longitude: 79.8612, floodRisk: 'HIGH', landslideRisk: 'LOW' },
  { name: 'Gampaha', province: 'Western', latitude: 7.0840, longitude: 80.0098, floodRisk: 'HIGH', landslideRisk: 'LOW' },
  { name: 'Kalutara', province: 'Western', latitude: 6.5854, longitude: 80.0817, floodRisk: 'HIGH', landslideRisk: 'MEDIUM' },

  // Central Province
  { name: 'Kandy', province: 'Central', latitude: 7.2906, longitude: 80.6337, floodRisk: 'MEDIUM', landslideRisk: 'HIGH' },
  { name: 'Matale', province: 'Central', latitude: 7.4675, longitude: 80.6234, floodRisk: 'MEDIUM', landslideRisk: 'HIGH' },
  { name: 'Nuwara Eliya', province: 'Central', latitude: 6.9497, longitude: 80.7891, floodRisk: 'LOW', landslideRisk: 'HIGH' },

  // Southern Province
  { name: 'Galle', province: 'Southern', latitude: 6.0535, longitude: 80.2210, floodRisk: 'HIGH', landslideRisk: 'MEDIUM' },
  { name: 'Matara', province: 'Southern', latitude: 5.9485, longitude: 80.5353, floodRisk: 'HIGH', landslideRisk: 'LOW' },
  { name: 'Hambantota', province: 'Southern', latitude: 6.1243, longitude: 81.1185, floodRisk: 'MEDIUM', landslideRisk: 'LOW' },

  // Northern Province
  { name: 'Jaffna', province: 'Northern', latitude: 9.6615, longitude: 80.0255, floodRisk: 'MEDIUM', landslideRisk: 'LOW' },
  { name: 'Kilinochchi', province: 'Northern', latitude: 9.3803, longitude: 80.3770, floodRisk: 'MEDIUM', landslideRisk: 'LOW' },
  { name: 'Mullaitivu', province: 'Northern', latitude: 9.2671, longitude: 80.8142, floodRisk: 'MEDIUM', landslideRisk: 'LOW' },
  { name: 'Mannar', province: 'Northern', latitude: 8.9810, longitude: 79.9044, floodRisk: 'LOW', landslideRisk: 'LOW' },
  { name: 'Vavuniya', province: 'Northern', latitude: 8.7514, longitude: 80.4971, floodRisk: 'LOW', landslideRisk: 'LOW' },

  // Eastern Province
  { name: 'Batticaloa', province: 'Eastern', latitude: 7.7310, longitude: 81.6747, floodRisk: 'HIGH', landslideRisk: 'LOW' },
  { name: 'Ampara', province: 'Eastern', latitude: 7.2976, longitude: 81.6821, floodRisk: 'MEDIUM', landslideRisk: 'LOW' },
  { name: 'Trincomalee', province: 'Eastern', latitude: 8.5874, longitude: 81.2152, floodRisk: 'MEDIUM', landslideRisk: 'LOW' },

  // North Western Province
  { name: 'Kurunegala', province: 'North Western', latitude: 7.4863, longitude: 80.3647, floodRisk: 'MEDIUM', landslideRisk: 'MEDIUM' },
  { name: 'Puttalam', province: 'North Western', latitude: 8.0362, longitude: 79.8283, floodRisk: 'MEDIUM', landslideRisk: 'LOW' },

  // North Central Province
  { name: 'Anuradhapura', province: 'North Central', latitude: 8.3114, longitude: 80.4037, floodRisk: 'MEDIUM', landslideRisk: 'LOW' },
  { name: 'Polonnaruwa', province: 'North Central', latitude: 7.9403, longitude: 81.0188, floodRisk: 'MEDIUM', landslideRisk: 'LOW' },

  // Uva Province
  { name: 'Badulla', province: 'Uva', latitude: 6.9934, longitude: 81.0550, floodRisk: 'MEDIUM', landslideRisk: 'HIGH' },
  { name: 'Monaragala', province: 'Uva', latitude: 6.8728, longitude: 81.3507, floodRisk: 'MEDIUM', landslideRisk: 'MEDIUM' },

  // Sabaragamuwa Province
  { name: 'Ratnapura', province: 'Sabaragamuwa', latitude: 6.6828, longitude: 80.4025, floodRisk: 'HIGH', landslideRisk: 'HIGH' },
  { name: 'Kegalle', province: 'Sabaragamuwa', latitude: 7.2513, longitude: 80.3464, floodRisk: 'HIGH', landslideRisk: 'HIGH' },
];

export const DISTRICT_NAMES = SRI_LANKA_DISTRICTS.map(d => d.name);

// Sri Lanka map center coordinates
export const SRI_LANKA_CENTER = {
  latitude: 7.8731,
  longitude: 80.7718,
  zoom: 7.2,
};
