
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { NUM_SLOTS, CHAMBER_RADIUS, SPIN_FRICTION, MIN_SPIN_VELOCITY, BULLET_PALETTE_COLORS, RAINBOW_COLORS, DUD_BULLET_DATA } from './constants';
import type { BulletData, ChamberSlot, GameState, AudioKey, Particle, SavedState } from './types';

// --- HELPER HOOKS & COMPONENTS ---
const useAudio = (volume: number, isMuted: boolean) => {
    const audioRefs = useRef<{[key in AudioKey]?: HTMLAudioElement}>({});
    
    useEffect(() => {
        const keys: AudioKey[] = ['load', 'spin-start', 'spin-end', 'click', 'fire', 'reset', 'error', 'pickup', 'thunk', 'dry-fire'];
        keys.forEach(key => {
            audioRefs.current[key] = document.getElementById(`audio-${key}`) as HTMLAudioElement;
        });
        const spinLoop = document.getElementById('audio-spin-loop') as HTMLAudioElement;
        if(spinLoop) spinLoop.loop = true;

    }, []);

    const playAudio = useCallback((key: AudioKey) => {
        const audioEl = audioRefs.current[key];
        if (audioEl) {
            audioEl.currentTime = 0;
            audioEl.volume = isMuted ? 0 : volume / 100;
            audioEl.play().catch(e => console.error("Audio playback failed:", e));
        }
    }, [volume, isMuted]);

    const manageLoop = useCallback((action: 'play' | 'stop') => {
        const audioEl = document.getElementById('audio-spin-loop') as HTMLAudioElement;
        if (audioEl) {
            audioEl.volume = isMuted ? 0 : volume / 100;
            if(action === 'play' && audioEl.paused) {
                audioEl.play().catch(e => console.error("Audio playback failed:", e));
            } else if(action === 'stop' && !audioEl.paused) {
                audioEl.pause();
                audioEl.currentTime = 0;
            }
        }
    }, [volume, isMuted]);

    return { playAudio, manageLoop };
};

const Tooltip: React.FC<{text: string, children: React.ReactNode}> = ({ text, children }) => {
    return (
        <div className="relative group">
            {children}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-3 py-1.5 bg-gray-900 text-white text-sm rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-[60] shadow-lg border border-white/20">
                {text}
            </div>
        </div>
    );
};

// --- SUB-COMPONENTS ---

const FloatingBullet: React.FC<{
  bullet: BulletData;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, bullet: BulletData) => void;
  onDragEnd: (e: React.DragEvent<HTMLDivElement>) => void;
  onClick: (bullet: BulletData) => void;
  onMouseEnter: (bullet: BulletData) => void;
  onMouseLeave: () => void;
  isLoaded: boolean;
  isPickedUp: boolean;
}> = ({ bullet, onDragStart, onDragEnd, onClick, onMouseEnter, onMouseLeave, isLoaded, isPickedUp }) => {
    const isCustom = bullet.id === -1;
    const bulletStyle: React.CSSProperties = isCustom ? {} : { '--color': bullet.color } as React.CSSProperties;

    return (
        <div 
            className={`relative w-[60px] h-[90px] cursor-grab transition-all duration-400 ease-[cubic-bezier(0.34,1.56,0.64,1)] animate-float filter drop-shadow-lg hover:scale-125 hover:-translate-y-2.5 hover:rotate-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-4 focus-visible:rounded-lg ${isLoaded ? 'opacity-0 scale-75 pointer-events-none' : ''} ${isPickedUp ? 'bullet-pickup-animation' : ''} hover:drop-shadow-[0_0_12px_rgba(255,255,255,0.5)]`}
            draggable={!isLoaded}
            onDragStart={(e) => onDragStart(e, bullet)}
            onDragEnd={onDragEnd}
            onClick={() => !isLoaded && onClick(bullet)}
            onMouseEnter={() => onMouseEnter(bullet)}
            onMouseLeave={onMouseLeave}
            tabIndex={isLoaded ? -1 : 0} role="button" aria-label={`Load ${bullet.name || 'bullet'}`}
            style={bulletStyle}
        >
             {bullet.isDud ? (
                <>
                    <div className="dud-bullet-tip"></div>
                    <div className="dud-bullet-body"></div>
                </>
            ) : (
                <>
                    <div className="bullet-tip-metallic"></div>
                    <div className={`bullet-body-colored ${isCustom ? 'animate-rainbow-move bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500' : ''}`}></div>
                    <div className="bullet-rim"></div>
                </>
            )}
        </div>
    );
};


const ManageBulletNameModal: React.FC<{
    isOpen: boolean;
    bullet: BulletData | null;
    onClose: () => void;
    onSave: (name: string, message: string) => void;
    onClear: () => void;
    existingName?: string;
    existingMessage?: string;
}> = ({ isOpen, bullet, onClose, onSave, onClear, existingName, existingMessage }) => {
    const [name, setName] = useState('');
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (isOpen) {
            setName(existingName || '');
            setMessage(existingMessage || '');
        }
    }, [isOpen, existingName, existingMessage]);

    if (!isOpen || !bullet) return null;
    
    const bulletColorName = BULLET_PALETTE_COLORS.find(b => b.id === bullet.originalId)?.color || bullet.color;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-lg flex items-center justify-center z-[10000]" onClick={onClose}>
            <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-8 shadow-2xl min-w-[400px] max-w-lg w-full flex flex-col gap-4" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold text-center text-gray-100 font-['Orbitron']" style={{ textShadow: `0 0 10px ${bulletColorName}` }}>
                    Manage Bullet Identity
                </h2>
                <div className="flex flex-col">
                    <label htmlFor="bulletName" className="text-sm text-gray-400 mb-1">Name (Max 32 chars)</label>
                    <input type="text" id="bulletName" maxLength={32} placeholder="e.g., 'The Peacemaker'"
                        value={name} onChange={e => setName(e.target.value)}
                        className="bg-[#252525] text-white border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-[#08d9d6] focus:ring-2 focus:ring-[#08d9d6]/50"
                    />
                </div>
                <div className="flex flex-col">
                    <label htmlFor="bulletMessage" className="text-sm text-gray-400 mb-1">On-Fire Message (Max 160 chars)</label>
                    <textarea id="bulletMessage" maxLength={160} rows={3} placeholder="e.g., 'Greetings from the other side.'"
                        value={message} onChange={e => setMessage(e.target.value)}
                        className="bg-[#252525] text-white border border-gray-600 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-[#08d9d6] focus:ring-2 focus:ring-[#08d9d6]/50"
                    />
                </div>
                <div className="flex justify-between items-center gap-4 mt-4">
                    <div>
                        <button onClick={onClear} className="bg-red-800 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg transition-colors">Clear</button>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={onClose} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded-lg transition-colors">Close</button>
                        <button 
                            onClick={() => onSave(name, message)} 
                            className="bg-[#08d9d6] hover:bg-[#20e0dd] text-black font-bold py-2 px-6 rounded-lg transition-colors"
                            disabled={!name.trim()}
                        >
                            Submit
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const BulletInfoOverlay: React.FC<{
    bullet: BulletData | null;
    isOpen: boolean;
    onClose: () => void;
}> = ({ bullet, isOpen, onClose }) => {
    const [isClosing, setIsClosing] = useState(false);
    const [shouldRender, setShouldRender] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsClosing(false);
            setShouldRender(true);
        }
    }, [isOpen]);

    const handleClose = () => {
        setIsClosing(true);
    };
    
    const handleAnimationEnd = () => { 
        if (isClosing) {
            setShouldRender(false);
            onClose();
        }
    };
    
    if (!shouldRender) return null;

    return (
        <div 
            className={`fixed inset-0 bg-black/80 backdrop-blur-xl z-[9999] flex items-center justify-center ${isClosing ? 'animate-result-fade-out' : 'animate-result-fade-in'}`}
            onClick={handleClose}
            onAnimationEnd={handleAnimationEnd}
            style={{ pointerEvents: isClosing ? 'none' : 'auto' }}
        >
            <div className="bg-black/50 border border-white/10 rounded-3xl p-12 shadow-2xl text-center max-w-4xl" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-9xl font-bold mb-6 text-white font-['Orbitron'] break-words" style={{ textShadow: `0 0 30px ${bullet?.color}`}}>
                    {bullet?.name}
                </h2>
                <p className="text-2xl text-amber-400 max-w-3xl leading-relaxed break-words">
                    "{bullet?.message}"
                </p>
            </div>
        </div>
    );
};

const RevolverFrame = () => (
    <svg className="absolute inset-0 w-full h-full pointer-events-none filter drop-shadow-[-10px_15px_10px_rgba(0,0,0,0.5)]" viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <radialGradient id="metalGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%"><stop offset="0%" style={{stopColor:'#888',stopOpacity:1}} /><stop offset="60%" style={{stopColor:'#444',stopOpacity:1}} /><stop offset="95%" style={{stopColor:'#222',stopOpacity:1}} /><stop offset="100%" style={{stopColor:'#111',stopOpacity:1}} /></radialGradient>
            <linearGradient id="handleGradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style={{stopColor:'#3a2e28'}} /><stop offset="100%" style={{stopColor:'#2a1e18'}} /></linearGradient>
        </defs>
        <path d="M250 20 L280 20 L290 60 L420 60 L430 70 L430 110 L410 130 L310 130 L280 200 L280 260 L380 320 L380 400 L340 450 L280 440 L240 480 L200 440 L160 450 L120 400 L120 320 L220 260 L220 200 L190 130 L90 130 L70 110 L70 70 L80 60 L210 60 L220 20 Z" fill="url(#metalGradient)" stroke="#111" strokeWidth="3" />
        <path d="M140 330 L145 420 L160 435 L190 430 L190 325 Z" fill="url(#handleGradient)" stroke="#111" strokeWidth="2" />
        <path d="M360 330 L355 420 L340 435 L310 430 L310 325 Z" fill="url(#handleGradient)" stroke="#111" strokeWidth="2" />
        <path d="M250 265 C 250 330, 220 340, 220 320 L220 280 L280 280 L280 320 C 280 340, 250 330, 250 265" fill="none" stroke="#333" strokeWidth="15" />
        <path d="M280 135 L300 115 L315 120 L295 140 Z" fill="#555" stroke="#111" strokeWidth="2" />
    </svg>
);

const InfoModal: React.FC<{ isOpen: boolean; onClose: () => void; }> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-lg flex items-center justify-center z-[10000]" onClick={onClose}>
            <div className="bg-[#1e1e1e] border border-white/10 rounded-2xl p-8 shadow-2xl max-w-3xl w-full flex flex-col gap-4" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center pb-4 border-b border-white/10">
                    <h2 className="text-3xl font-bold text-gray-100 font-['Orbitron']">How to Play</h2>
                    <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:bg-white/10 hover:text-white transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="text-gray-300 space-y-4 max-h-[70vh] overflow-y-auto pr-4 info-modal-content">
                    <p>Welcome to the Spin of Sin. Here's how to control your fate:</p>
                    
                    <h3>Core Actions</h3>
                    <ul>
                        <li><strong className="text-white">Load Bullets:</strong> Drag bullets from the top palette to a chamber slot, or simply click a palette bullet to load it into the next free slot.</li>
                        <li><strong className="text-white">Spin the Chamber:</strong> Click the center hub to spin. Click multiple times to increase spin speed. You can also click and drag the chamber to position it manually.</li>
                        <li><strong className="text-white">Fire:</strong> Press the <kbd>Spacebar</kbd> key to fire the round in the top position.</li>
                         <li><strong className="text-white">Reset:</strong> Press the <kbd>R</kbd> key or the 'Reset' button to eject all bullets and start fresh.</li>
                    </ul>

                    <h3>Advanced Techniques</h3>
                    <ul>
                        <li><strong className="text-white">Hotkey Loading:</strong> Hover your mouse over a palette bullet and press a number key (<kbd>1</kbd>-<kbd>6</kbd>) to load it directly into that chamber slot.</li>
                        <li><strong className="text-white">Infinite Spin:</strong> <kbd>Ctrl</kbd> + Click the center hub for an infinite, high-speed spin. Click again to stop.</li>
                        <li><strong className="text-white">Conceal/Reveal:</strong> Click on a loaded, non-fired bullet in the chamber to hide or reveal its casing.</li>
                        <li><strong className="text-white">Eject/Refill:</strong> Click a fired bullet to return it to the palette. To eject a non-fired bullet, <kbd>Alt</kbd>+Click it. Loading a bullet into a spent slot will automatically replace the casing.</li>
                    </ul>

                    <h3>UI &amp; Presets</h3>
                     <ul>
                        <li><strong className="text-white">Toggle Holster:</strong> <kbd>Alt</kbd> + Click the chamber body (not an empty slot or the center hub) to show or hide the revolver frame.</li>
                        <li><strong className="text-white">Toggle Slot Numbers:</strong> <kbd>Alt</kbd> + Click an empty slot to show or hide all slot numbers.</li>
                        <li><strong className="text-white">Spin Counter:</strong> A counter below the chamber tracks your spins. <kbd>Alt</kbd> + Click it to toggle visibility.</li>
                        <li><strong className="text-white">Clear Preset:</strong> <kbd>Alt</kbd> + Click a saved preset button to clear it and revert it to an empty slot.</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};


// --- MAIN APP COMPONENT ---

export default function App() {
    const initialSlots = Array.from({ length: NUM_SLOTS }, (_, i) => ({ id: i, bullet: null, isRevealed: false, isSpent: false, isHidden: false }));
    const [slots, setSlots] = useState<ChamberSlot[]>(initialSlots);
    const [rotation, setRotation] = useState(0);
    const [gameState, setGameState] = useState<GameState>('loading');
    const [errorMessage, setErrorMessage] = useState('');
    const [firedBullet, setFiredBullet] = useState<BulletData | null>(null);
    const [isInfoOverlayOpen, setIsInfoOverlayOpen] = useState(false);
    const [customColor, setCustomColor] = useState('#cc0011');
    const [isSpinning, setIsSpinning] = useState(false);
    const [isStopping, setIsStopping] = useState(false);
    const [isInfiniteSpin, setIsInfiniteSpin] = useState(false);
    const [chamberEffects, setChamberEffects] = useState({ shake: false, muzzle: false });
    const [explosionParticles, setExplosionParticles] = useState<Particle[]>([]);
    const [dudSmokeParticles, setDudSmokeParticles] = useState<Particle[]>([]);
    const [draggedBullet, setDraggedBullet] = useState<BulletData | null>(null);
    const [dragOverSlotId, setDragOverSlotId] = useState<number | null>(null);
    const [invalidDropSlotId, setInvalidDropSlotId] = useState<number | null>(null);
    const [isDraggingBullet, setIsDraggingBullet] = useState(false);
    const [trailParticles, setTrailParticles] = useState<Particle[]>([]);
    const [loadedBulletOriginalIds, setLoadedBulletOriginalIds] = useState<number[]>([]);
    const [loadingSlots, setLoadingSlots] = useState<{ slotId: number, bullet: BulletData }[]>([]);
    const [hoveredPaletteBullet, setHoveredPaletteBullet] = useState<BulletData | null>(null);
    const [pickedUpBulletId, setPickedUpBulletId] = useState<number | null>(null);
    const [isResetting, setIsResetting] = useState(false);
    const [chamberStyle, setChamberStyle] = useState('classic');
    const [isHolsterVisible, setIsHolsterVisible] = useState(true);
    const [areControlsVisible, setAreControlsVisible] = useState(true);
    const [bulletPalettePosition, setBulletPalettePosition] = useState({ x: -280, y: 49 });
    const [isDraggingPalette, setIsDraggingPalette] = useState(false);
    const [presets, setPresets] = useState<(SavedState | null)[]>(new Array(8).fill(null));
    const [isPresetCustom, setIsPresetCustom] = useState<boolean[]>(new Array(8).fill(false));
    const [glowKey, setGlowKey] = useState(0);
    const [visualSpinSpeed, setVisualSpinSpeed] = useState(0);
    const [signatureGlow, setSignatureGlow] = useState(false);
    const [isFiring, setIsFiring] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
    const [showSlotNumbers, setShowSlotNumbers] = useState(true);
    const [spinCount, setSpinCount] = useState(0);
    const [totalSpinCount, setTotalSpinCount] = useState(0);
    const [isCounterVisible, setIsCounterVisible] = useState(true);
    const [ejectedCasing, setEjectedCasing] = useState<{ id: number, color: string, side: 'left' | 'right' } | null>(null);
    const [smokeParticles, setSmokeParticles] = useState<Particle[]>([]);
    const [sustainedMaxHeat, setSustainedMaxHeat] = useState(false);
    const [maxHeatStartTime, setMaxHeatStartTime] = useState<number | null>(null);
    const maxHeatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // --- Bullet Naming Feature State ---
    const [isNamingEnabled, setIsNamingEnabled] = useState(false);
    const [bulletNames, setBulletNames] = useState<Record<number, { name: string, message: string }>>({});
    const [isNameModalOpen, setIsNameModalOpen] = useState(false);
    const [editingBullet, setEditingBullet] = useState<BulletData | null>(null);
    const [pendingLoadInfo, setPendingLoadInfo] = useState<{ slotId: number, bullet: BulletData } | null>(null);

    const spinVelocity = useRef(0);
    const dragStartInfo = useRef<{ angle: number; rotation: number } | null>(null);
    const isDraggingChamber = useRef(false);
    const animationFrameId = useRef<number | null>(null);
    const spinWasIntentional = useRef(false);
    const clickCount = useRef(0);
    const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const paletteDragOffset = useRef({x: 0, y: 0});
    const hasLoadedOnce = useRef(false);
    const prevRotationRef = useRef(0);
    const chamberContainerRef = useRef<HTMLDivElement>(null);
    const smokeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const resetSpinCountTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);


    const slotsRef = useRef(slots);
    useEffect(() => { slotsRef.current = slots; }, [slots]);

    const { playAudio, manageLoop } = useAudio(50, isMuted);
    const isLoaded = slots.some(s => s.bullet && !s.isSpent);
    
    // --- Data Persistence & Initialization ---

    const generateDefaultPresets = useCallback(() => {
        const createBullet = (id: number) => ({...BULLET_PALETTE_COLORS[id], originalId: BULLET_PALETTE_COLORS[id].id, name: '', message: '', isCustom: false});
        const baseState = { chamberStyle: 'classic', bulletPalettePosition: {x: 0, y: -50}, isHolsterVisible: true };

        const useAdjacentSlots = Math.random() > 0.5;
        const preset1Slots = initialSlots.map((s, i) => {
            if (i === 0) return {...s, bullet: {...createBullet(0), id: Date.now() + i}};
            if ((useAdjacentSlots && i === 1) || (!useAdjacentSlots && i === 5)) {
                return {...s, bullet: {...createBullet(1), id: Date.now() + i + 1}};
            }
            return s;
        });

        const defaultPresets: (SavedState | null)[] = [
            {...baseState, slots: preset1Slots},
            {...baseState, slots: initialSlots.map((s, i) => (i % 2 === 0) ? {...s, bullet: {...createBullet(Math.floor(i/2)), id: Date.now()+i}} : s)},
            {...baseState, slots: initialSlots},
            {...baseState, slots: initialSlots},
            null, null, null, null,
        ];
        setPresets(defaultPresets);
        localStorage.setItem('spinOfSin.presets', JSON.stringify(defaultPresets));
    }, [initialSlots]);

    useEffect(() => {
        try {
            const savedTotalSpins = localStorage.getItem('spinOfSin.totalSpins');
            if (savedTotalSpins) setTotalSpinCount(JSON.parse(savedTotalSpins));

            const savedCounterVisibility = localStorage.getItem('spinOfSin.counterVisible');
            if (savedCounterVisibility) setIsCounterVisible(JSON.parse(savedCounterVisibility));

            const savedPresets = localStorage.getItem('spinOfSin.presets');
            if (savedPresets) {
                const parsed = JSON.parse(savedPresets);
                if (parsed.length !== 8) {
                    const newPresets = new Array(8).fill(null);
                    parsed.slice(0, 8).forEach((p: SavedState | null, i: number) => newPresets[i] = p);
                    setPresets(newPresets);
                } else { setPresets(parsed); }
            } else { generateDefaultPresets(); }

            const savedCustomPresets = localStorage.getItem('spinOfSin.isPresetCustom');
            if (savedCustomPresets) {
                 const parsed = JSON.parse(savedCustomPresets);
                if (parsed.length !== 8) {
                    const newCustom = new Array(8).fill(false);
                    parsed.slice(0, 8).forEach((p: boolean, i: number) => newCustom[i] = p);
                    setIsPresetCustom(newCustom);
                } else { setIsPresetCustom(parsed); }
            }

            const savedBulletNames = localStorage.getItem('spinOfSin.bulletNames');
            if(savedBulletNames) setBulletNames(JSON.parse(savedBulletNames));

        } catch (e) {
            console.error("Failed to load state from localStorage", e);
            generateDefaultPresets();
        }
    }, [generateDefaultPresets]);

    useEffect(() => {
        localStorage.setItem('spinOfSin.totalSpins', JSON.stringify(totalSpinCount));
    }, [totalSpinCount]);

    useEffect(() => {
        localStorage.setItem('spinOfSin.counterVisible', JSON.stringify(isCounterVisible));
    }, [isCounterVisible]);

    useEffect(() => {
        if(Object.keys(bulletNames).length > 0) {
            localStorage.setItem('spinOfSin.bulletNames', JSON.stringify(bulletNames));
        }
    }, [bulletNames]);

    
    // --- Core Game Logic ---

    const initiateBulletLoad = useCallback((slotId: number, bullet: BulletData) => {
        playAudio('load');
        if (!hasLoadedOnce.current) {
            hasLoadedOnce.current = true;
            setSignatureGlow(true);
            setTimeout(() => setSignatureGlow(false), 1230);
        }
        if (bullet.originalId && bullet.originalId > 0 && !bullet.isCustom && !bullet.isDud) {
            setLoadedBulletOriginalIds(prev => [...new Set([...prev, bullet.originalId!])]);
        }
        setLoadingSlots(prev => [...prev, { slotId, bullet }]);
        
        setTimeout(() => {
            setSlots(p => p.map(s => s.id === slotId ? { ...initialSlots[slotId], bullet, isRevealed: false, isHidden: false } : s));
            setLoadingSlots(p => p.filter(sl => sl.slotId !== slotId));
            setGameState('ready');
        }, 500);
    }, [playAudio, initialSlots]);

    const prepareToLoadBullet = useCallback((slotId: number, droppedBullet: BulletData) => {
        const targetSlot = slots[slotId];
        const isSlotLoading = loadingSlots.some(l => l.slotId === slotId);

        if ((targetSlot.bullet && !targetSlot.isSpent) || isSlotLoading) {
            playAudio('error');
            setErrorMessage("This slot is already loaded.");
            setInvalidDropSlotId(slotId);
            setTimeout(() => setInvalidDropSlotId(null), 400);
            return;
        }

        const bulletInstance = { ...droppedBullet, id: Date.now() + Math.random() };
        const savedName = bulletInstance.originalId ? bulletNames[bulletInstance.originalId] : null;

        if (isNamingEnabled && bulletInstance.originalId && bulletInstance.originalId > 0 && !savedName) {
            setEditingBullet(bulletInstance);
            setPendingLoadInfo({ slotId, bullet: bulletInstance });
            setIsNameModalOpen(true);
            return;
        }

        if (savedName) {
            bulletInstance.name = savedName.name;
            bulletInstance.message = savedName.message;
        } else {
            bulletInstance.name = bulletInstance.name || "The Silent One";
            bulletInstance.message = bulletInstance.message || "...";
        }
        
        initiateBulletLoad(slotId, bulletInstance);
    }, [slots, loadingSlots, playAudio, initiateBulletLoad, isNamingEnabled, bulletNames]);

    const handleNameSave = (name: string, message: string) => {
        if (editingBullet && editingBullet.originalId && pendingLoadInfo) {
            setBulletNames(prev => ({...prev, [editingBullet.originalId!]: { name, message }}));
            const bulletToLoad = { ...pendingLoadInfo.bullet, name, message };
            initiateBulletLoad(pendingLoadInfo.slotId, bulletToLoad);
        }
        setIsNameModalOpen(false);
        setEditingBullet(null);
        setPendingLoadInfo(null);
    };

    const handleNameClear = () => {
        if (editingBullet && editingBullet.originalId) {
            setBulletNames(prev => {
                const newNames = { ...prev };
                delete newNames[editingBullet.originalId!];
                // if the object becomes empty, remove it from local storage
                if (Object.keys(newNames).length === 0) {
                    localStorage.removeItem('spinOfSin.bulletNames');
                }
                return newNames;
            });
        }
        setIsNameModalOpen(false);
        setEditingBullet(null);
        setPendingLoadInfo(null);
    };

    const handleFire = useCallback(async (overrideRotation?: number) => {
        if (gameState === 'fired' || isResetting || isFiring) return;

        const currentRotation = overrideRotation ?? rotation;
        const anglePerSlot = 360 / NUM_SLOTS;
        const normalizedRotation = (currentRotation % 360 + 360) % 360;
        const topSlotIndex = (NUM_SLOTS - Math.round(normalizedRotation / anglePerSlot)) % NUM_SLOTS;
        
        const targetSlot = slotsRef.current[topSlotIndex];

        if (!targetSlot || (targetSlot.isSpent && !targetSlot.bullet?.isDud)) return;
        
        if (targetSlot.bullet && !targetSlot.bullet.isDud && targetSlot.isHidden) {
            setSlots(prev => prev.map(s => s.id === topSlotIndex ? { ...s, isHidden: false } : s));
            await new Promise(resolve => setTimeout(resolve, 350));
        }

        setIsFiring(true);
        setGameState('fired');

        if (!targetSlot.bullet) {
            playAudio('dry-fire');
        } else {
            setSlots(prev => prev.map(s => s.id === topSlotIndex ? { ...s, isRevealed: true, isSpent: true, isHidden: false } : s));
            const firedBulletData = targetSlot.bullet;
            setFiredBullet(firedBulletData);
            
            if (isNamingEnabled && firedBulletData.name && firedBulletData.message) {
                setIsInfoOverlayOpen(true);
            }
            
            if (firedBulletData.isDud) {
                playAudio('thunk');
                const smoke: Particle[] = [];
                for (let i = 0; i < 15; i++) {
                    smoke.push({
                        id: i + Date.now(),
                        style: {
                            '--ex': `${(Math.random() - 0.5) * 60}px`,
                            '--ey': `${-Math.random() * 40 - 20}px`,
                        } as React.CSSProperties
                    });
                }
                setDudSmokeParticles(smoke);
                setTimeout(() => setDudSmokeParticles([]), 2000);

            } else {
                playAudio('fire');
                setChamberEffects({ shake: true, muzzle: true });
                setEjectedCasing({ id: Date.now(), color: firedBulletData.color, side: Math.random() > 0.5 ? 'left' : 'right' });
                setTimeout(() => setEjectedCasing(null), 1000);
                const particles: Particle[] = Array.from({length: 30}, (_, i) => {
                    const angle = Math.random() * Math.PI * 2;
                    const distance = 100 + Math.random() * 150;
                    return { id: i + Date.now(), style: { '--ex': `${Math.cos(angle) * distance}px`, '--ey': `${Math.sin(angle) * distance}px`, width: `${2 + Math.random() * 5}px`, height: `${2 + Math.random() * 5}px`, background: Math.random() > 0.3 ? firedBulletData.color : (Math.random() > 0.5 ? '#FFFFFF' : '#FFD700'), animationDuration: `${0.5 + Math.random() * 0.5}s`, borderRadius: '50%'} as React.CSSProperties };
                });
                setExplosionParticles(particles);
                setTimeout(() => setExplosionParticles([]), 1500);
            }
        }
        
        setTimeout(() => {
            setChamberEffects({ shake: false, muzzle: false });
            setIsFiring(false);
            const remainingLiveRounds = slotsRef.current.some(s => s.bullet && !s.isSpent);
            setGameState(remainingLiveRounds ? 'ready' : 'loading');
        }, 1000);

    }, [gameState, rotation, playAudio, isResetting, isFiring, isNamingEnabled]);

    const spinChamber = useCallback(() => {
        if (isInfiniteSpin) {
            setRotation(prev => (prev + spinVelocity.current));
            animationFrameId.current = requestAnimationFrame(spinChamber);
            return;
        }

        if (Math.abs(spinVelocity.current) > MIN_SPIN_VELOCITY) {
            spinVelocity.current *= SPIN_FRICTION;
            setRotation(prev => (prev + spinVelocity.current));
            animationFrameId.current = requestAnimationFrame(spinChamber);
        } else {
            spinVelocity.current = 0;
            setIsSpinning(false);
            manageLoop('stop');
            playAudio('spin-end');
            
            const anglePerSlot = 360 / NUM_SLOTS;
            const nearestSlot = Math.round(rotation / anglePerSlot);
            const finalRotation = nearestSlot * anglePerSlot;
            setIsStopping(true);
            setRotation(finalRotation);
            
            setTimeout(() => {
                if (spinCount > 0) {
                    setTotalSpinCount(prevTotal => prevTotal + spinCount);
                }
                setIsStopping(false);
                if (spinWasIntentional.current) {
                    spinWasIntentional.current = false; 
                    setTimeout(() => handleFire(finalRotation), 50);
                } else {
                    setGameState('ready');
                }
                
                if (resetSpinCountTimeoutRef.current) clearTimeout(resetSpinCountTimeoutRef.current);
                resetSpinCountTimeoutRef.current = setTimeout(() => {
                    setSpinCount(0);
                }, 1500);
            }, 400);
        }
    }, [manageLoop, playAudio, handleFire, isInfiniteSpin, rotation, spinCount]);

    const handleReset = useCallback(() => {
        if (isResetting) return;
        setIsResetting(true);
        setSlots(prev => prev.map(s => s.bullet ? { ...s, isEjecting: true } : s));
        playAudio('reset');
        manageLoop('stop');
        setSpinCount(0);
        setTimeout(() => {
            setIsSpinning(false);
            if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
            spinVelocity.current = 0;
            setSlots(initialSlots);
            setRotation(0);
            setGameState('loading');
            setIsInfoOverlayOpen(false);
            setFiredBullet(null);
            setLoadedBulletOriginalIds([]);
            setLoadingSlots([]);
            setIsResetting(false);
        }, 600);
    }, [isResetting, manageLoop, playAudio, initialSlots]);
    
    const handleQuickLoad = () => {
        handleReset();
        setTimeout(() => {
            const newSlots = Array.from({ length: NUM_SLOTS }, (_, i) => ({
                ...initialSlots[i],
                bullet: { id: Date.now() + i, originalId: BULLET_PALETTE_COLORS[i].id, name: `Fate #${i + 1}`, message: "The odds are ever in your favor... or not.", color: BULLET_PALETTE_COLORS[i].color, isCustom: false },
            }));
            setSlots(newSlots);
            setLoadedBulletOriginalIds(BULLET_PALETTE_COLORS.map(b => b.id));
            setGameState('ready');
            playAudio('load');
        }, 700);
    };

    // --- Event Handlers & Effects ---

    useEffect(() => {
        let visualSpeedTimer: ReturnType<typeof setInterval>;
        if (isSpinning) {
            visualSpeedTimer = setInterval(() => {
                setVisualSpinSpeed(s => {
                    const targetSpeed = Math.abs(spinVelocity.current);
                    return s + (targetSpeed - s) * 0.1;
                });
            }, 50);
        } else {
             setVisualSpinSpeed(s => s * 0.9);
            if (visualSpinSpeed > 0.1) {
                 visualSpeedTimer = setInterval(() => {
                    setVisualSpinSpeed(s => {
                        if (s < 0.1) {
                            clearInterval(visualSpeedTimer);
                            return 0;
                        }
                        return s * 0.9;
                    });
                }, 50);
            } else {
                setVisualSpinSpeed(0);
            }
        }
        return () => clearInterval(visualSpeedTimer);
    }, [isSpinning, visualSpinSpeed]);
    
    useEffect(() => {
        const MAX_VISUAL_SPIN_VELOCITY = 75;
        const currentHeat = Math.min(visualSpinSpeed / MAX_VISUAL_SPIN_VELOCITY, 1);
        const isAtMaxHeat = currentHeat >= 0.95; // Near max heat
        
        if (isAtMaxHeat && isSpinning) {
            if (!maxHeatStartTime) {
                setMaxHeatStartTime(Date.now());
            } else if (Date.now() - maxHeatStartTime >= 2000 && !sustainedMaxHeat) {
                setSustainedMaxHeat(true);
            }
        } else {
            setMaxHeatStartTime(null);
            setSustainedMaxHeat(false);
            if (maxHeatTimerRef.current) {
                clearTimeout(maxHeatTimerRef.current);
                maxHeatTimerRef.current = null;
            }
        }

        const smokeShouldBeActive = sustainedMaxHeat && isSpinning;

        if (smokeShouldBeActive && !smokeIntervalRef.current) {
            smokeIntervalRef.current = setInterval(() => {
                const particleId = Date.now() + Math.random();
                const newParticle: Particle = {
                    id: particleId,
                    style: {
                        '--angle': `${Math.random() * 360}deg`,
                        '--drift-x': `${(Math.random() - 0.5) * 60}px`,
                        '--drift-y': `${(Math.random() - 0.5) * 60 - 30}px`,
                        '--scale-end': `${1.2 + Math.random() * 0.8}`,
                        '--duration': `${1.5 + Math.random()}s`,
                    } as React.CSSProperties
                };
                setSmokeParticles(prev => [...prev.slice(-25), newParticle]);
                
                setTimeout(() => {
                    setSmokeParticles(prev => prev.filter(p => p.id !== particleId));
                }, 2500);
            }, 120);
        } else if (!smokeShouldBeActive && smokeIntervalRef.current) {
            clearInterval(smokeIntervalRef.current);
            smokeIntervalRef.current = null;
            setTimeout(() => setSmokeParticles([]), 1000);
        }

        return () => {
            if (smokeIntervalRef.current) clearInterval(smokeIntervalRef.current);
            if (maxHeatTimerRef.current) clearTimeout(maxHeatTimerRef.current);
        };
    }, [visualSpinSpeed, isSpinning, sustainedMaxHeat, maxHeatStartTime]);


    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isNameModalOpen || isInfoModalOpen) return;
            if (e.code === 'Space') { e.preventDefault(); handleFire(); }
            if (e.code === 'KeyR') { 
                e.preventDefault(); 
                if (e.ctrlKey) {
                    window.location.reload();
                } else {
                    handleReset(); 
                }
            }
            if (hoveredPaletteBullet && e.key >= '1' && e.key <= '6') {
                e.preventDefault();
                const slotId = parseInt(e.key, 10) - 1;
                prepareToLoadBullet(slotId, { ...hoveredPaletteBullet, id: Date.now() + Math.random() });
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleFire, handleReset, hoveredPaletteBullet, prepareToLoadBullet, isNameModalOpen, isInfoModalOpen]);

    const handleChamberMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.button !== 0 || (isSpinning && !isInfiniteSpin)) return;
        
        const target = e.target as HTMLElement;
        const isSlot = target.closest('.chamber-slot');
        const isCenter = target.closest('.chamber-center');

        if (e.altKey) {
             if (isSlot || isCenter) return;
            setIsHolsterVisible(prev => !prev);
            return;
        }
        
        if (!chamberContainerRef.current) return;

        spinWasIntentional.current = false;
        isDraggingChamber.current = true;
        
        const rect = chamberContainerRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
        
        dragStartInfo.current = { angle: startAngle, rotation: rotation };
    };

    const handleChamberMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isDraggingChamber.current || !dragStartInfo.current || !chamberContainerRef.current) return;

        const rect = chamberContainerRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        const currentAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
        const deltaAngle = currentAngle - dragStartInfo.current.angle;
        
        const newRotation = dragStartInfo.current.rotation + deltaAngle;
        spinVelocity.current = newRotation - rotation;
        setRotation(newRotation);
    };
    
    const handleChamberMouseUp = () => {
        if (!isDraggingChamber.current) return;
        isDraggingChamber.current = false;
        dragStartInfo.current = null;
        
        if (Math.abs(spinVelocity.current) > 5) {
            if (!isSpinning) {
                if (resetSpinCountTimeoutRef.current) clearTimeout(resetSpinCountTimeoutRef.current);
                setSpinCount(0);
            }
            setIsSpinning(true);
            playAudio('spin-start');
            manageLoop('play');
            setGameState('spinning');
            spinWasIntentional.current = true;
        } else {
            spinVelocity.current = 0;
            if (!isSpinning) {
                playAudio('spin-end');
                setRotation(r => Math.round(r / (360 / NUM_SLOTS)) * (360 / NUM_SLOTS));
            }
        }
    };
    
    const handleChamberCenterClick = (e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
        if (e.altKey) return;
        if (isInfiniteSpin) {
            setIsInfiniteSpin(false);
            spinWasIntentional.current = true;
            return;
        }
        if (e.ctrlKey) {
            setIsInfiniteSpin(true);
            const velocity = (60 + Math.random() * 20) * (spinVelocity.current !== 0 ? Math.sign(spinVelocity.current) : (Math.random() > 0.5 ? 1 : -1));
            if (!isSpinning) {
                if (resetSpinCountTimeoutRef.current) clearTimeout(resetSpinCountTimeoutRef.current);
                setSpinCount(0);
                spinVelocity.current = velocity;
                setIsSpinning(true);
                playAudio('spin-start');
                manageLoop('play');
                setGameState('spinning');
            } else {
                spinVelocity.current = velocity;
            }
            spinWasIntentional.current = false;
            return;
        }
        
        clickCount.current++;
        if (clickTimer.current) clearTimeout(clickTimer.current);
        
        if (!isSpinning) {
            if (resetSpinCountTimeoutRef.current) clearTimeout(resetSpinCountTimeoutRef.current);
            setSpinCount(0);
            const baseVelocity = clickCount.current === 1 ? 15 : (15 * Math.min(clickCount.current, 3));
            const velocity = baseVelocity + Math.random() * 10;
            spinVelocity.current = velocity * (Math.random() > 0.5 ? 1 : -1);
            setIsSpinning(true);
            playAudio('spin-start');
            manageLoop('play');
            setGameState('spinning');
            spinWasIntentional.current = true;
            
            setTimeout(() => { clickCount.current = 0; }, 100);
        } else {
            spinVelocity.current += (15 * Math.sign(spinVelocity.current || 1));
        }
    };

    const ejectBullet = useCallback((targetSlot: ChamberSlot, isFast: boolean) => {
        if (!targetSlot.bullet) return;

        // Return bullet to palette by removing its ID from the loaded list
        if (targetSlot.bullet.originalId && targetSlot.bullet.originalId > 0) {
            setLoadedBulletOriginalIds(prev => prev.filter(id => id !== targetSlot.bullet!.originalId));
        }
        
        setSlots(prev => prev.map(s => 
            s.id === targetSlot.id ? { ...s, isEjecting: true, isFastEjecting: isFast } : s
        ));
        playAudio('click');
        
        setTimeout(() => {
            setSlots(prev => prev.map(s => (s.id === targetSlot.id ? initialSlots[s.id] : s)));
        }, isFast ? 200 : 600);
    }, [playAudio, initialSlots]);
    
    const handleSlotClick = (e: React.MouseEvent, slot: ChamberSlot) => {
        if (isSpinning) return;
        e.stopPropagation();

        if (slot.bullet) {
            // Alt+Click ejects ANY bullet (live, dud, spent) FAST.
            if (e.altKey) {
                ejectBullet(slot, true);
                return;
            }

            // Click on a Dud toggles its cover.
            if (slot.bullet.isDud) {
                setSlots(prev => prev.map(s => s.id === slot.id ? { ...s, isHidden: !s.isHidden } : s));
                playAudio('click');
                return;
            }
            
            // Click on a spent (non-dud) bullet ejects it.
            if (slot.isSpent) {
                ejectBullet(slot, false); // Normal speed eject
                return;
            }

            // Click on any other non-spent bullet toggles cover.
            setSlots(prev => prev.map(s => s.id === slot.id ? { ...s, isHidden: !s.isHidden } : s));
            playAudio('click');

        } else if (e.altKey) {
            // Alt+click on an empty slot toggles numbers.
            setShowSlotNumbers(prev => !prev);
        }
    };

    const handleClickToLoad = (bullet: BulletData) => {
        const nextAvailableSlot = slots.find(s => !s.bullet && !loadingSlots.some(l => l.slotId === s.id));
        if (nextAvailableSlot) {
            playAudio('pickup');
            setPickedUpBulletId(bullet.originalId ?? bullet.id);
            setTimeout(() => setPickedUpBulletId(null), 300);
            prepareToLoadBullet(nextAvailableSlot.id, bullet);
        } else {
            setErrorMessage("All slots are full.");
            playAudio('error');
        }
    };
    
    useEffect(() => {
        if (isSpinning) {
            animationFrameId.current = requestAnimationFrame(spinChamber);
        }
        return () => {
            if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
        }
    }, [isSpinning, spinChamber]);

    const activeSlotIndex = isSpinning ? -1 : (NUM_SLOTS - Math.round(((rotation % 360 + 360) % 360) / (360 / NUM_SLOTS))) % NUM_SLOTS;
    
    useEffect(() => {
        const prevRot = prevRotationRef.current;
        const currRot = rotation;
        if (isSpinning) {
            // Use Math.abs to make counting direction-agnostic
            const prevPasses = Math.floor(Math.abs(prevRot) / 360);
            const currentPasses = Math.floor(Math.abs(currRot) / 360);
            
            // This logic handles boundary crossing in both directions
            if (Math.sign(prevRot) === Math.sign(currRot) || Math.abs(currRot) < 180) {
                 const passesDelta = currentPasses - prevPasses;
                 if (passesDelta !== 0) {
                    const spinsToAdd = Math.abs(passesDelta);
                    setSpinCount(c => c + spinsToAdd);
                }
            } else { // Handle crossing the 0/360 line from opposite signs
                 if (Math.abs(prevRot % 360) > 350 && Math.abs(currRot % 360) < 10) {
                     setSpinCount(c => c + 1);
                 }
            }
        }

        const anglePerSlot = 360 / NUM_SLOTS;
        if (isSpinning && Math.floor(prevRot / anglePerSlot) !== Math.floor(rotation / anglePerSlot)) {
            setGlowKey(k => k + 1);
        }
        prevRotationRef.current = rotation;
    }, [rotation, isSpinning]);
    
    // --- Preset Handlers ---
    const savePreset = (index: number) => {
        const stateToSave: SavedState = { slots, chamberStyle, bulletPalettePosition, isHolsterVisible };
        const newPresets = [...presets];
        newPresets[index] = stateToSave;
        setPresets(newPresets);
        localStorage.setItem('spinOfSin.presets', JSON.stringify(newPresets));

        const newCustomFlags = [...isPresetCustom];
        newCustomFlags[index] = true;
        setIsPresetCustom(newCustomFlags);
        localStorage.setItem('spinOfSin.isPresetCustom', JSON.stringify(newCustomFlags));
    };
    
    const clearPreset = (index: number) => {
        const newPresets = [...presets];
        newPresets[index] = null;
        setPresets(newPresets);
        localStorage.setItem('spinOfSin.presets', JSON.stringify(newPresets));

        const newCustomFlags = [...isPresetCustom];
        newCustomFlags[index] = false;
        setIsPresetCustom(newCustomFlags);
        localStorage.setItem('spinOfSin.isPresetCustom', JSON.stringify(newCustomFlags));
    };

    const handlePresetClick = (e: React.MouseEvent, index: number) => {
        if (e.altKey) {
            clearPreset(index);
        } else {
            loadPreset(index);
        }
    };

    const loadPreset = (index: number) => {
        const resetSlots = initialSlots.map(s => ({ ...s }));
        setSlots(resetSlots);
        
        setTimeout(() => {
            if (index === 0 && !isPresetCustom[index]) {
                const useAdjacentSlots = Math.random() > 0.5;
                const pos1 = 0;
                const pos2 = useAdjacentSlots ? 1 : 5;
                const isRedInFirstPos = Math.random() > 0.5;
                
                const newSlots = resetSlots.map((s, i) => {
                    if (i === pos1) return { ...s, bullet: { id: Date.now() + i, originalId: isRedInFirstPos ? 1 : 2, name: '', message: '', isCustom: false, color: isRedInFirstPos ? BULLET_PALETTE_COLORS[0].color : BULLET_PALETTE_COLORS[1].color } };
                    if (i === pos2) return { ...s, bullet: { id: Date.now() + i + 1, originalId: isRedInFirstPos ? 2 : 1, name: '', message: '', isCustom: false, color: isRedInFirstPos ? BULLET_PALETTE_COLORS[1].color : BULLET_PALETTE_COLORS[0].color } };
                    return s;
                });
                setSlots(newSlots);
                setLoadedBulletOriginalIds([1, 2]);
                setGameState('ready');
                return;
            }

            if (index === 2 && !isPresetCustom[index]) {
                const livePos = Math.floor(Math.random() * NUM_SLOTS);
                let dudPos;
                do { dudPos = Math.floor(Math.random() * NUM_SLOTS); } while (dudPos === livePos || dudPos === (livePos + 1) % NUM_SLOTS || dudPos === (livePos - 1 + NUM_SLOTS) % NUM_SLOTS);
                
                const newSlots = resetSlots.map((s, i) => {
                    if (i === livePos) return { ...s, bullet: { id: Date.now() + 1, originalId: -1, color: customColor, name: 'Your Luck', message: 'Feeling lucky?', isCustom: true }, isHidden: true };
                    if (i === dudPos) return { ...s, bullet: { ...DUD_BULLET_DATA, id: Date.now() + 2 }, isHidden: true };
                    return s;
                });
                setSlots(newSlots); setLoadedBulletOriginalIds([-1]); setGameState('ready'); return;
            }
            
            if (index === 3 && !isPresetCustom[index]) {
                const startPos = Math.floor(Math.random() * NUM_SLOTS);
                const liveBullets = [BULLET_PALETTE_COLORS[0], BULLET_PALETTE_COLORS[1], BULLET_PALETTE_COLORS[2]];
                const newSlots = resetSlots.map((s, i) => {
                    const rotatedIndex = (i - startPos + NUM_SLOTS) % NUM_SLOTS;
                    if (rotatedIndex < 3) return { ...s, bullet: { ...liveBullets[rotatedIndex], originalId: liveBullets[rotatedIndex].id, name: '', message: '', isCustom: false, id: Date.now() + i } };
                    return { ...s, bullet: { ...DUD_BULLET_DATA, id: Date.now() + i } };
                });
                setSlots(newSlots);
                setLoadedBulletOriginalIds(liveBullets.map(b => b.id));
                setGameState('ready');
                setTimeout(() => setSlots(prev => prev.map(s => s.bullet ? { ...s, isHidden: true } : s)), 1500);
                setTimeout(() => { 
                    if (resetSpinCountTimeoutRef.current) clearTimeout(resetSpinCountTimeoutRef.current);
                    setSpinCount(0);
                    spinVelocity.current = 10 + Math.random() * 5;
                    setIsSpinning(true);
                    playAudio('spin-start');
                    manageLoop('play');
                    setGameState('spinning');
                    spinWasIntentional.current = false;
                }, 1600);
                return;
            }

            const presetToLoad = presets[index];
            if (presetToLoad) {
                const newSlots = presetToLoad.slots.map(slot => {
                    if (!slot.bullet) return { ...slot };
                    const savedName = slot.bullet.originalId ? bulletNames[slot.bullet.originalId] : null;
                    const bulletData: BulletData = { 
                        ...slot.bullet, 
                        id: Date.now() + Math.floor(Math.random() * 1000), 
                        originalId: slot.bullet.originalId || slot.bullet.id || -1, 
                        isCustom: !!slot.bullet.isCustom, 
                        isDud: !!slot.bullet.isDud, 
                        name: savedName?.name || slot.bullet.name || 'Bullet', 
                        message: savedName?.message || slot.bullet.message || '', 
                        color: slot.bullet.color || '#ff2e63' 
                    };
                    return { ...slot, bullet: bulletData, isSpent: false, isEjecting: false };
                });
                
                setChamberStyle(presetToLoad.chamberStyle);
                setIsHolsterVisible(presetToLoad.isHolsterVisible);
                
                const bulletIds = newSlots.filter(s => s.bullet).map(s => s.bullet!.originalId).filter((id): id is number => id !== undefined);
                setLoadedBulletOriginalIds([...new Set(bulletIds)]);
                setSlots(newSlots);
                setGameState(newSlots.some(s => s.bullet) ? 'ready' : 'loading');
                setGlowKey(prev => prev + 1);
            }    
        }, 100);
    };
    
    // --- UI & Drag Handlers ---
    const handlePaletteDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
        setIsDraggingPalette(true);
        document.body.classList.add('dragging-palette');
        paletteDragOffset.current = { x: e.clientX - bulletPalettePosition.x, y: e.clientY - bulletPalettePosition.y, };
    };
    
    const handleBulletDragStart = (e: React.DragEvent<HTMLDivElement>, bullet: BulletData) => {
        setIsDraggingBullet(true);
        setDraggedBullet(bullet);
        e.dataTransfer.setData('application/json', JSON.stringify(bullet));
    };

    useEffect(() => {
        const handlePaletteDrag = (e: MouseEvent) => {
            if (!isDraggingPalette) return;
            setBulletPalettePosition({ x: e.clientX - paletteDragOffset.current.x, y: e.clientY - paletteDragOffset.current.y, });
        };
        const handlePaletteDragEnd = () => { setIsDraggingPalette(false); document.body.classList.remove('dragging-palette'); };
        document.addEventListener('mousemove', handlePaletteDrag);
        document.addEventListener('mouseup', handlePaletteDragEnd);
        return () => {
            document.removeEventListener('mousemove', handlePaletteDrag);
            document.removeEventListener('mouseup', handlePaletteDragEnd);
        }
    }, [isDraggingPalette]);
    
    useEffect(() => {
      const sigEl = document.getElementById('signature');
      if (sigEl) {
        if (signatureGlow) sigEl.classList.add('signature-glow');
        else sigEl.classList.remove('signature-glow');
      }
    }, [signatureGlow]);

    useEffect(() => {
        if (isDraggingBullet) document.body.classList.add('dragging-bullet');
        else document.body.classList.remove('dragging-bullet');
    }, [isDraggingBullet]);
    
    useEffect(() => {
        if (errorMessage) {
            const timer = setTimeout(() => setErrorMessage(''), 3000);
            return () => clearTimeout(timer);
        }
    }, [errorMessage]);
    
    const getBulletTooltip = (bullet: BulletData) => {
        if (bullet.isDud) return "Dud";
        const savedName = bullet.originalId ? bulletNames[bullet.originalId]?.name : null;
        if (savedName) return savedName;
        if (bullet.isCustom) return "Custom Bullet";
        const colorData = BULLET_PALETTE_COLORS.find(c => c.color === bullet.color);
        const names = ["Fiery Rose", "Aqua Splash", "Electric Violet", "Goldenrod", "Pink Glamour", "Emerald Green"];
        return colorData ? `${names[colorData.id - 1]}` : "Bullet";
    };

    const MAX_VISUAL_SPIN_VELOCITY = 75;
    const chamberHeat = Math.min(visualSpinSpeed / MAX_VISUAL_SPIN_VELOCITY, 1);

    const activeSlot = activeSlotIndex !== -1 ? slots[activeSlotIndex] : null;
    const tickerColor = (activeSlot?.bullet && !activeSlot.isHidden) ? activeSlot.bullet.color : (RAINBOW_COLORS[activeSlotIndex] || '#ff2e63');

    return (
      <div className="w-screen h-screen bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden" style={{'--ticker-color': tickerColor} as React.CSSProperties}>
        {errorMessage && <div className="absolute top-[10vh] bg-red-600/90 text-white font-bold px-8 py-4 rounded-lg shadow-lg z-[1000] animate-error-popup">{errorMessage}</div>}
        {trailParticles.map(p => <div key={p.id} className="drag-trail-particle" style={p.style} />)}
        
        {ejectedCasing && (
            <div key={ejectedCasing.id} className={`absolute top-[calc(50%-175px)] left-1/2 -translate-x-1/2 w-[25px] h-[25px] z-[101] casing-eject-${ejectedCasing.side}`}>
                <div className="w-full h-full rounded-full" style={{ background: `radial-gradient(circle at 40% 40%, color-mix(in srgb, ${ejectedCasing.color}, white 40%) 0%, ${ejectedCasing.color} 80%)`, boxShadow: `inset 0 2px 4px rgba(0,0,0,0.6)` }} />
            </div>
        )}
        
        <>
            <ManageBulletNameModal 
                isOpen={isNameModalOpen}
                bullet={editingBullet}
                onClose={() => { setIsNameModalOpen(false); setEditingBullet(null); setPendingLoadInfo(null); }}
                onSave={handleNameSave}
                onClear={handleNameClear}
                existingName={editingBullet?.originalId ? bulletNames[editingBullet.originalId]?.name : ''}
                existingMessage={editingBullet?.originalId ? bulletNames[editingBullet.originalId]?.message : ''}
            />
            <BulletInfoOverlay isOpen={isInfoOverlayOpen} bullet={firedBullet} onClose={() => setIsInfoOverlayOpen(false)} />
            <InfoModal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)} />
            
            <div style={{ transform: `translate(${bulletPalettePosition.x}px, ${bulletPalettePosition.y}px)` }} className="absolute top-8 left-1/2 -translate-x-1/2 z-10">
                <div className="relative flex justify-center items-end" onDoubleClick={() => setBulletPalettePosition({x: -280, y: 49})}>
                    <div title="Drag to reposition. Double-click to reset position." onMouseDown={handlePaletteDragStart} className="absolute w-8 h-5 bg-gray-700/50 rounded-t-md flex items-center justify-center cursor-move" style={{ top: '-43px', left: '259px' }}>
                        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>
                    </div>

                    <div className="absolute bottom-0 right-full mr-8">
                        <Tooltip text="Dud"><FloatingBullet bullet={DUD_BULLET_DATA} onDragStart={handleBulletDragStart} onDragEnd={() => setIsDraggingBullet(false)} onClick={handleClickToLoad} onMouseEnter={setHoveredPaletteBullet} onMouseLeave={() => setHoveredPaletteBullet(null)} isLoaded={false} isPickedUp={pickedUpBulletId === DUD_BULLET_DATA.id} /></Tooltip>
                    </div>

                    <div className="flex items-end gap-8">
                        {BULLET_PALETTE_COLORS.map(b => {
                            const bulletData: BulletData = { ...b, originalId: b.id, name: '', message: '', isCustom: false };
                            return (<Tooltip key={b.id} text={getBulletTooltip(bulletData)}><FloatingBullet bullet={bulletData} onDragStart={handleBulletDragStart} onDragEnd={() => setIsDraggingBullet(false)} onClick={handleClickToLoad} onMouseEnter={setHoveredPaletteBullet} onMouseLeave={() => setHoveredPaletteBullet(null)} isLoaded={loadedBulletOriginalIds.includes(b.id)} isPickedUp={pickedUpBulletId === b.id} /></Tooltip>);
                        })}
                        
                        <div className="flex flex-col items-center gap-2">
                            <div className="flex items-center gap-2 text-sm text-gray-300">
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="checkbox" 
                                        id="name-toggle" 
                                        checked={isNamingEnabled} 
                                        onChange={() => setIsNamingEnabled(p => !p)}
                                        className="w-4 h-4 rounded border-gray-300 text-[#08d9d6] focus:ring-[#08d9d6]"
                                    />
                                    <label 
                                        htmlFor="name-toggle" 
                                        className={`cursor-pointer transition-colors ${isNamingEnabled ? 'text-[#08d9d6] font-semibold' : 'text-gray-400'}`}
                                    >
                                        Name
                                    </label>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <Tooltip text="Custom Bullet"><FloatingBullet bullet={{ id: -1, originalId: -1, color: customColor, name: 'Custom', message: 'A personal touch.', isCustom: true}} onDragStart={handleBulletDragStart} onDragEnd={() => setIsDraggingBullet(false)} onClick={handleClickToLoad} onMouseEnter={setHoveredPaletteBullet} onMouseLeave={() => setHoveredPaletteBullet(null)} isLoaded={false} isPickedUp={pickedUpBulletId === -1} /></Tooltip>
                                <div className="flex items-center gap-2 bg-gray-800/80 backdrop-blur-sm p-2 rounded-lg border border-white/10">
                                    <input type="color" value={customColor} onChange={e => setCustomColor(e.target.value)} className="w-10 h-10 p-0" aria-label="Custom bullet color" />
                                    <input type="text" value={customColor.toUpperCase()} onChange={e => setCustomColor(e.target.value)} className="w-24 h-8 bg-[#252525] text-white border border-gray-600 rounded-md px-2 text-center font-mono text-sm" maxLength={7} aria-label="Custom bullet color code" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="relative w-[450px] h-[450px] mt-[2vh] flex items-center justify-center flex-col">
                <div className="relative w-full h-full flex items-center justify-center">
                    {isHolsterVisible && <RevolverFrame />}
                    <div className="absolute inset-0 pointer-events-none z-[105]">
                        {smokeParticles.map(p => (
                            <div 
                                key={p.id} 
                                className="smoke-particle" 
                                style={{
                                    ...p.style,
                                    zIndex: 106
                                }} 
                            />
                        ))}
                    </div>
                    <div className="absolute top-1/2 left-1/2 w-px h-px pointer-events-none z-[102]">
                        {explosionParticles.map(p => <div key={p.id} className="absolute animate-explosion-particle" style={p.style} />)}
                        {dudSmokeParticles.map(p => <div key={p.id} className="absolute top-[-220px] left-0 chamber-smoke-puff" style={p.style} />)}
                    </div>

                    <div ref={chamberContainerRef} className={`chamber-container chamber-style-${chamberStyle} ${chamberEffects.shake ? 'animate-chamber-shake' : ''}`} onMouseDown={handleChamberMouseDown} onMouseMove={handleChamberMouseMove} onMouseUp={handleChamberMouseUp} onMouseLeave={handleChamberMouseUp} style={{'--chamber-heat': chamberHeat} as React.CSSProperties}>
                        {chamberEffects.muzzle && <div className="absolute top-1/2 left-1/2 w-[300px] h-[300px] rounded-full pointer-events-none z-[100] animate-muzzle-flash" />}
                        <div key={glowKey} className={`top-slot-indicator ${!isSpinning && isLoaded ? '' : 'stopped'} ${isSpinning ? 'glowing' : ''}`} />

                        <div className={`chamber ${isSpinning ? 'spinning' : ''} ${isStopping ? 'stopping' : ''}`} style={{ transform: `translate(-50%, -50%) rotate(${rotation}deg)`}}>
                            <div className="chamber-visuals w-full h-full absolute top-0 left-0">
                                <div className="chamber-base"></div>
                                {slots.map((slot, i) => {
                                    const loadingInfo = loadingSlots.find(l => l.slotId === slot.id);
                                    const bulletToRender = loadingInfo?.bullet || slot.bullet;
                                    const isEjecting = !!slot.isEjecting;
                                    const isFastEjecting = !!slot.isFastEjecting;
                                    return (
                                        <div key={slot.id} style={{ '--slot-index': i, '--rotation': `${-rotation}deg`, '--bullet-glow': draggedBullet?.color, ...(bulletToRender && {'--color': bulletToRender.color}) } as React.CSSProperties} className={`chamber-slot ${dragOverSlotId === slot.id ? 'drag-over' : ''} ${invalidDropSlotId === slot.id ? 'invalid-drop' : ''}`} onClick={(e) => handleSlotClick(e, slot)} onDragOver={(e) => {e.preventDefault(); setDragOverSlotId(slot.id);}} onDragEnter={() => setDragOverSlotId(slot.id)} onDragLeave={() => setDragOverSlotId(null)} onDrop={(e) => { e.preventDefault(); setDragOverSlotId(null); setIsDraggingBullet(false); if(e.dataTransfer.getData('application/json')) { prepareToLoadBullet(slot.id, JSON.parse(e.dataTransfer.getData('application/json'))); } }}>
                                            {bulletToRender && <div className={`chamber-bullet ${loadingInfo && 'loading'} ${isEjecting && 'ejecting'} ${isFastEjecting && 'fast'} ${bulletToRender && 'loaded'} ${slot.isRevealed && !bulletToRender?.isDud && 'revealed'} ${slot.id === activeSlotIndex && 'active'} ${slot.isSpent && 'spent'} ${bulletToRender?.isDud && 'dud-casing'} ${slot.isHidden && 'is-hidden'}`} ><div className="chamber-bullet-cover" /></div>}
                                            {!bulletToRender && showSlotNumbers && <div className="absolute text-2xl font-bold font-['Orbitron'] chamber-slot-number" style={{ color: RAINBOW_COLORS[i], textShadow: `0 0 8px ${RAINBOW_COLORS[i]}` }}>{i + 1}</div>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="chamber-center" onClick={handleChamberCenterClick} />
                    </div>
                </div>
                <div 
                    className="absolute bottom-[-50px] text-center text-sm font-['Orbitron'] text-gray-400 cursor-pointer select-none"
                    onClick={(e) => { if (e.altKey) setIsCounterVisible(v => !v) }}
                    title="Alt+Click to toggle visibility"
                >
                    {isCounterVisible ? (
                        <>
                            Spins: <span className="text-white font-bold">{spinCount}</span> 
                            {totalSpinCount > 0 && (
                                <> / <span className="text-gray-300">{totalSpinCount}</span></>
                            )}
                        </>
                    ) : (
                        <div className="w-8 h-px bg-red-500" style={{boxShadow: '0 0 8px #ff2e63, 0 0 4px #fff'}} />
                    )}
                </div>
            </div>

            <div className={`absolute bottom-8 left-1/2 -translate-x-1/2 flex items-stretch z-50 transition-all duration-400 ease-[cubic-bezier(0.4,0,0.2,1)] ${!areControlsVisible ? 'translate-y-32 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}`}>
                <button onClick={() => setAreControlsVisible(false)} className="px-3 py-4 bg-black/40 backdrop-blur-md border border-white/10 rounded-l-full text-white/50 hover:text-white hover:bg-black/50 transition-all duration-400 ease-[cubic-bezier(0.4,0,0.2,1)]" aria-label="Hide controls"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg></button>
                <div className="flex items-center bg-black/40 backdrop-blur-md border-y border-r border-white/10 rounded-r-full">
                    <div className="flex flex-col items-center gap-3 p-3 border-r border-white/10">
                        <div className="flex items-center gap-2 p-1 bg-black/30 border border-white/10 rounded-full text-white">
                            <Tooltip text="Classic steel finish"><button onClick={() => setChamberStyle('classic')} className={`px-3 py-1 text-xs rounded-full font-semibold uppercase tracking-wider transition-all duration-300 ${chamberStyle === 'classic' ? 'bg-white/20' : 'hover:bg-white/10'}`}>classic</button></Tooltip>
                            <Tooltip text="Deep blued metal"><button onClick={() => setChamberStyle('blued')} className={`px-3 py-1 text-xs rounded-full font-semibold uppercase tracking-wider transition-all duration-300 ${chamberStyle === 'blued' ? 'bg-white/20' : 'hover:bg-white/10'}`}>blued</button></Tooltip>
                            <Tooltip text="Luxurious gold inlay"><button onClick={() => setChamberStyle('gilded')} className={`px-3 py-1 text-xs rounded-full font-semibold uppercase tracking-wider transition-all duration-300 ${chamberStyle === 'gilded' ? 'bg-white/20' : 'hover:bg-white/10'}`}>gilded</button></Tooltip>
                            <Tooltip text="Intricate engravings"><button onClick={() => setChamberStyle('engraved')} className={`px-3 py-1 text-xs rounded-full font-semibold uppercase tracking-wider transition-all duration-300 ${chamberStyle === 'engraved' ? 'bg-white/20' : 'hover:bg-white/10'}`}>engraved</button></Tooltip>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex flex-col items-center gap-2">
                                <div className="flex items-center gap-3">
                                    {Array.from({length: 4}).map((_, i) => {
                                        const presetConfigs = [ { name: 'Twin Threat', icon: '🔫', description: 'Two bullets, random positions' }, { name: 'Checkerboard', icon: '♟️', description: 'Alternating live rounds' }, { name: 'Good Luck', icon: '🍀', description: 'One live, one dud, both hidden' }, { name: 'Lopsided', icon: '⚖️', description: '3 live, 3 dud, all hidden' }, ];
                                        const preset = presetConfigs[i];
                                        return (
                                            <div key={i} className="relative group/preset">
                                                <button onClick={(e) => handlePresetClick(e, i)} className="w-10 h-10 rounded-full border-2 transition-colors flex items-center justify-center border-white/40 bg-gray-900/50 hover:bg-gray-800/70 text-white text-lg"><div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-sm rounded-md opacity-0 group-hover/preset:opacity-100 transition-opacity duration-300 pointer-events-none z-50 whitespace-nowrap"><div className="font-bold text-amber-400">{preset.name}</div><div className="text-xs text-gray-300">{preset.description}</div></div>{preset.icon}</button>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="flex items-center gap-3">
                                    {Array.from({length: 4}).map((_, i_raw) => {
                                        const i = i_raw + 4;
                                        return (
                                            <div key={i} className="relative group flex flex-col items-center gap-1">
                                                <button onClick={() => savePreset(i)} className="absolute top-full mt-2 text-xs bg-gray-700 text-white px-2 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50">Save</button>
                                                <div className="relative group/preset">
                                                    <button onClick={(e) => handlePresetClick(e, i)} className={`w-10 h-10 rounded-full border-2 transition-colors flex items-center justify-center ${presets[i] && isPresetCustom[i] ? 'bg-gray-800 border-white/60 hover:bg-gray-700' : 'bg-transparent border-dashed border-white/20 text-white/20 hover:bg-white/10 hover:border-white/30'} text-white text-lg`} aria-label={`Custom preset ${i + 1}`}>
                                                        {i + 1}
                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-sm rounded-md opacity-0 group-hover/preset:opacity-100 transition-opacity duration-300 pointer-events-none z-50 whitespace-nowrap"><div className="font-bold text-amber-400">{`Custom Slot ${i + 1}`}</div><div className="text-xs text-gray-300">{presets[i] && isPresetCustom[i] ? 'Load saved layout (Alt+Click to clear)' : 'Empty slot'}</div></div>
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="flex flex-col gap-2">
                                <button onClick={handleQuickLoad} className="px-3 py-1.5 bg-white/5 border border-white/20 rounded-full text-white font-semibold uppercase text-xs tracking-wider backdrop-blur-md hover:bg-white/15 transition-all duration-300">Quick Load</button>
                                <Tooltip text="Eject all bullets and reset chamber."><button onClick={handleReset} className="px-3 py-1.5 bg-white/5 border border-white/20 rounded-full text-white font-semibold uppercase text-xs tracking-wider backdrop-blur-md hover:bg-white/15 transition-all duration-300">Reset</button></Tooltip>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col justify-center gap-1 pr-2 pl-1 py-2 h-full">
                        <Tooltip text="Info"><button onClick={() => setIsInfoModalOpen(true)} className="p-2 text-white/60 hover:text-white transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg></button></Tooltip>
                        <Tooltip text={isMuted ? "Unmute" : "Mute"}><button onClick={() => setIsMuted(p => !p)} className="p-2 text-white/60 hover:text-white transition-colors">{isMuted ? <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.5 12a4.5 4.5 0 000-8V3a6.5 6.5 0 010 12v-1z" clipRule="evenodd" /></svg>}</button></Tooltip>
                    </div>
                </div>
            </div>
            {!areControlsVisible && <button onClick={() => setAreControlsVisible(true)} className="absolute bottom-0 left-1/2 -translate-x-1/2 px-4 py-0.5 bg-black/50 border-t border-x border-white/20 rounded-t-lg text-white/50 hover:text-white transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" /></svg></button>}
        </>
      </div>
    );
}