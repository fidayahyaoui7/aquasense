// Mock data for AquaSense prototype

export const mockConsumption24h = [
  { hour: '00h', value: 0.2, isNight: true },
  { hour: '02h', value: 0.1, isNight: true },
  { hour: '04h', value: 0.3, isNight: true },
  { hour: '06h', value: 1.2, isNight: false },
  { hour: '08h', value: 2.5, isNight: false },
  { hour: '10h', value: 1.8, isNight: false },
  { hour: '12h', value: 3.2, isNight: false },
  { hour: '14h', value: 2.1, isNight: false },
  { hour: '16h', value: 1.5, isNight: false },
  { hour: '18h', value: 2.8, isNight: false },
  { hour: '20h', value: 1.9, isNight: false },
  { hour: '22h', value: 0.8, isNight: true },
];

export const mockAlerts = [
  {
    id: '1',
    type: 'overconsumption' as const,
    date: '16 avril 2026',
    time: '14:30',
    value: 28.5,
    threshold: 25,
    description: 'Consommation supérieure au seuil défini',
  },
  {
    id: '2',
    type: 'night_leak' as const,
    date: '15 avril 2026',
    time: '02:15',
    value: 2.3,
    threshold: 0.5,
    description: 'Fuite détectée pendant la nuit',
  },
  {
    id: '3',
    type: 'unusual_spike' as const,
    date: '14 avril 2026',
    time: '18:45',
    value: 15.2,
    threshold: 10,
    description: 'Pic de consommation inhabituel',
  },
];

export const buildingTypes = [
  'Maison',
  'Appartement',
  'Café',
  'Restaurant',
  'Hôtel',
  'Immeuble',
  'Usine',
] as const;

export const seasons = {
  summer: { name: 'Été', coefficient: 2.00 },
  winter: { name: 'Hiver', coefficient: 0.60 },
  spring: { name: 'Printemps', coefficient: 1.00 },
  autumn: { name: 'Automne', coefficient: 0.85 },
} as const;
