
export interface BulletData {
  id: number;
  originalId?: number;
  name: string;
  message: string;
  color: string;
  isCustom: boolean;
  isDud?: boolean;
}

export interface ChamberSlot {
  id: number;
  bullet: BulletData | null;
  isRevealed: boolean;
  isSpent: boolean;
  isHidden: boolean;
  isEjecting?: boolean;
}

export type GameState = 'loading' | 'spinning' | 'ready' | 'fired';

export type AudioKey = 'load' | 'spin-start' | 'spin-end' | 'click' | 'fire' | 'reset' | 'error' | 'pickup' | 'thunk' | 'dry-fire';

export interface Particle {
  id: number;
  style: React.CSSProperties;
}

export interface SavedState {
  slots: ChamberSlot[];
  chamberStyle: string;
  bulletPalettePosition: { x: number; y: number };
  isHolsterVisible: boolean;
}
