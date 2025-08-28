import type { BulletData } from './types';

export const NUM_SLOTS = 6;
export const CHAMBER_RADIUS = 128; // in pixels
export const SPIN_FRICTION = 0.985;
export const MIN_SPIN_VELOCITY = 0.05;

export const DUD_BULLET_DATA: BulletData = {
    id: -2,
    originalId: -2,
    name: "Dud",
    message: "Just a harmless blank.",
    color: '#8b5e3c', // Brown color for the dud primer
    isCustom: false,
    isDud: true,
};

export const BULLET_PALETTE_COLORS: { id: number, color: string }[] = [
    { id: 1, color: '#ff2e63' }, // Fiery Rose
    { id: 2, color: '#08d9d6' }, // Aqua Splash
    { id: 3, color: '#7c3aed' }, // Electric Violet
    { id: 4, color: '#fbbf24' }, // Goldenrod
    { id: 5, color: '#ec4899' }, // Pink Glamour
    { id: 6, color: '#10b981' }, // Emerald Green
];

export const RAINBOW_COLORS = ['#ff4d4d', '#ff9a4d', '#ffdb4d', '#4dff9a', '#4d9aff', '#b04dff'];