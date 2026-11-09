// MineEscape 2D - Game Engine & Room 1 ("Der überwucherte Eichenwald")
(function () {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const TILE_SIZE = 64;
  const COLS = 12; // 12 * 64 = 768
  const ROWS = 9;  // 9 * 64 = 576

  // Dialogs & Light-Dismiss Fallback (modern-web-guidance: light-dismiss-a-dialog)
  const workbenchDialog = document.getElementById('workbenchDialog');
  const infoDialog = document.getElementById('infoDialog');
  const tutorialDialog = document.getElementById('tutorialDialog');
  const heroDialog = document.getElementById('heroDialog');

  [workbenchDialog, infoDialog, tutorialDialog, heroDialog].forEach((dialog) => {
    if (!dialog) return;
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      dialog.addEventListener('click', (event) => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        const isDialogContent =
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width;
        if (isDialogContent) return;
        dialog.close();
      });
    }
  });

  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.getAttribute('data-close'));
      if (target) target.close();
    });
  });

  // Mining animation state
  let mining = {
    active: false,
    tx: -1,
    ty: -1,
    progress: 0, // 0 to 1
    duration: 0.55 // seconds to mine a block
  };

  // Web Audio Synth for Retro Block Sounds
  let soundEnabled = true;
  let audioCtx = null;

  function playSound(type) {
    if (!soundEnabled) return;
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'step') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(110, now);
        osc.frequency.exponentialRampToValueAtTime(65, now + 0.04);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.04);
        osc.start(now);
        osc.stop(now + 0.04);
      } else if (type === 'pickup' || type === 'mine') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(280, now);
        osc.frequency.exponentialRampToValueAtTime(560, now + 0.09);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (type === 'chest') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(190, now);
        osc.frequency.setValueAtTime(260, now + 0.07);
        osc.frequency.setValueAtTime(350, now + 0.14);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.22);
      } else if (type === 'plate') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(660, now + 0.06);
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.14);
        osc.start(now);
        osc.stop(now + 0.14);
      } else if (type === 'unlock') {
        const notes = [392, 493.88, 587.33, 783.99];
        notes.forEach((freq, idx) => {
          const o = audioCtx.createOscillator();
          const g = audioCtx.createGain();
          o.type = 'triangle';
          o.connect(g);
          g.connect(audioCtx.destination);
          o.frequency.setValueAtTime(freq, now + idx * 0.08);
          g.gain.setValueAtTime(0.16, now + idx * 0.08);
          g.gain.linearRampToValueAtTime(0.01, now + idx * 0.08 + 0.18);
          o.start(now + idx * 0.08);
          o.stop(now + idx * 0.08 + 0.18);
        });
      } else if (type === 'error') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.linearRampToValueAtTime(95, now + 0.14);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      }
    } catch (e) {
      // Ignore audio errors
    }
  }

  // Item Definitions
  const ITEM_DEFS = {
    hand: {
      id: 'hand',
      name: 'Leere Hand',
      texture: 'item_hand',
      hint: 'Untersuche Truhen, Schilder, Bäume & die Werkbank'
    },
    pickaxe: {
      id: 'pickaxe',
      name: 'Holzspitzhacke',
      texture: 'item_pickaxe',
      hint: 'Benutze sie (E / Klick), um rissigen Pflasterstein abzubauen!'
    },
    log: {
      id: 'log',
      name: 'Eichenstamm',
      texture: 'item_log',
      hint: 'Rohholz – kombiniere 2 Eichenstämme an der Werkbank!'
    },
    cobble: {
      id: 'cobble',
      name: 'Pflasterstein-Block',
      texture: 'item_cobble',
      placeableHeavy: true,
      hint: 'Schwerer Block! Platziere ihn (E / Klick) auf einer Stein-Druckplatte.'
    },
    heavy_wood: {
      id: 'heavy_wood',
      name: 'Schwerer Eichenblock',
      texture: 'item_heavy_wood',
      placeableHeavy: true,
      hint: 'Schwerer Block! Platziere ihn (E / Klick) auf einer Stein-Druckplatte.'
    },
    redstone: {
      id: 'redstone',
      name: 'Redstone-Staub',
      texture: 'item_redstone',
      placeableRedstone: true,
      hint: 'Lege den Redstone-Staub (<kbd>E</kbd> / Klick) in die rote Fassung über der Goldschiene!'
    },
    water_block: {
      id: 'water_block',
      name: 'Wasserblock',
      texture: 'item_water_block',
      placeableWater: true,
      hint: 'Setze den Wasserblock (<kbd>E</kbd> / Klick) in eines der blau markierten Brücken-Felder in der Lava!'
    },
    glowstone_dust: {
      id: 'glowstone_dust',
      name: 'Leuchtstaub',
      texture: 'item_glowstone_dust',
      hint: 'Lege den Leuchtstaub (<kbd>E</kbd> / Klick) rechts oben in den goldenen Portal-Altar neben dem Tor!'
    },
    amethyst_block: {
      id: 'amethyst_block',
      name: 'Amethyst-Block',
      texture: 'item_amethyst_block',
      placeableAmethyst: true,
      hint: 'Setze den Amethyst-Block (<kbd>E</kbd> / Klick) in das freie pink markierte Zielfeld in der Mitte!'
    },
    emerald: {
      id: 'emerald',
      name: 'Meister-Smaragd',
      texture: 'item_emerald',
      hint: 'Setze den Meister-Smaragd (<kbd>E</kbd> / Klick) in den grünen Schlüsselsockel vor dem Tresor!'
    }
  };

  // Game State
  let state = null;
  let particles = [];
  let balloons = []; // Floating balloons for victory celebration
  let currentHero = 'steve'; // 'steve', 'alex', 'mage'
  let meadowEnding = false; // true when player reaches the sunny celebration meadow!
  let toastTimeout = null;
  const keys = {};

  const HERO_DEFS = {
    steve: {
      id: 'steve',
      name: 'Steve',
      shirt: '#00aaaa',
      skin: '#d9a077',
      hair: '#4a311c',
      eyes: '#3b5dc9'
    },
    alex: {
      id: 'alex',
      name: 'Alex',
      shirt: '#5b8731',
      skin: '#e5b088',
      hair: '#c46829',
      eyes: '#2f8241'
    },
    mage: {
      id: 'mage',
      name: 'Amethyst-Magier',
      shirt: '#8e24aa',
      skin: '#dfb598',
      hair: '#311b92',
      eyes: '#e040fb'
    }
  };

  function clearPressedKeys() {
    for (const k of Object.keys(keys)) {
      keys[k] = false;
    }
  }

  function createInitialRoom1State() {
    // Tile Legend:
    // 'T' = Tree Wall (Solid)
    // 'M' = Mossy Stone Wall (Solid)
    // 'D' = Locked/Open Gate at (5,0) & (6,0)
    // 'G' = Grass Floor
    // 'P' = Dirt Path
    // 'W' = Oak Planks Floor
    // 'F' = Blue Cornflower on Grass (4 total in Room 1 -> Clue for Room 5!)
    const layout = [
      ['T', 'T', 'T', 'T', 'M', 'D', 'D', 'M', 'T', 'T', 'T', 'T'],
      ['T', 'W', 'W', 'W', 'W', 'P', 'P', 'W', 'T', 'W', 'W', 'T'],
      ['T', 'W', 'W', 'W', 'W', 'P', 'P', 'W', 'G', 'W', 'W', 'T'],
      ['T', 'G', 'P', 'G', 'W', 'P', 'P', 'W', 'G', 'T', 'T', 'T'],
      ['T', 'F', 'P', 'G', 'G', 'P', 'P', 'G', 'P', 'P', 'F', 'T'],
      ['T', 'G', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'G', 'G', 'T'],
      ['T', 'G', 'G', 'G', 'F', 'P', 'P', 'G', 'G', 'G', 'F', 'T'],
      ['T', 'G', 'G', 'G', 'G', 'P', 'P', 'G', 'G', 'G', 'G', 'T'],
      ['T', 'T', 'T', 'T', 'T', 'T', 'T', 'T', 'T', 'T', 'T', 'T']
    ];

    // Interactive Objects on Grid (key: "x,y")
    const objects = {
      '2,2': { type: 'chest', opened: false },
      '4,2': { type: 'plate', id: 'plate_left', placedItem: null },
      '7,2': { type: 'plate', id: 'plate_right', placedItem: null },
      '8,2': { type: 'loose_cobble' }, // Blocks access to the workbench alcove (9,1)-(10,2)!
      '10,1': { type: 'workbench' },
      '3,4': { type: 'sign' },
      '9,6': { type: 'loose_log' } // Collectible oak trunk in the forest
    };

    return {
      roomNumber: 1,
      grid: layout,
      objects,
      gateOpen: false,
      gateWasOpenedOnce: false,
      roomCompleted: false,
      player: {
        x: 5.5 * TILE_SIZE,
        y: 6.5 * TILE_SIZE,
        radius: 14,
        speed: 210, // px per second
        dir: 'up', // 'up', 'down', 'left', 'right'
        walkFrame: 0,
        isMoving: false
      },
      hotbar: [
        { id: 'hand', count: 1 },
        null,
        null,
        null,
        null
      ],
      selectedSlot: 0
    };
  }

  let room2Variant = 'A'; // 'A' = Loren- & Bergbau-Rätsel, 'B' = Live-Redstone-Dreh-Gitter

  function createInitialRoom2State(carriedHotbar, variant = room2Variant) {
    room2Variant = variant;

    // Ensure player always has Hand + Wooden Pickaxe when entering/testing Room 2
    const hotbar = [
      { id: 'hand', count: 1 },
      { id: 'pickaxe', count: 1 },
      null,
      null,
      null
    ];

    if (variant === 'A') {
      // VARIANTE A: Loren- & Bergbau-Rätsel
      // 'B' = Deepslate Wall (Solid)
      // 'F' = Deepslate Floor
      // 'H' = Horizontal Rails (y = 4)
      // 'O' = Diamond Ore Block (3 total -> Clue for Room 5!)
      // 'I' = Iron Door at (5,0) & (6,0)
      const layout = [
        ['B', 'B', 'B', 'B', 'B', 'I', 'I', 'B', 'B', 'B', 'B', 'B'],
        ['B', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'O', 'B'],
        ['B', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'B'],
        ['B', 'O', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'B'],
        ['B', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'B'],
        ['B', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'B'],
        ['B', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'O', 'B'],
        ['B', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'B'],
        ['B', 'B', 'B', 'B', 'B', 'B', 'B', 'B', 'B', 'B', 'B', 'B']
      ];

      const objects = {
        '2,2': { type: 'mineable_redstone_ore' }, // Mit Spitzhacke abbauen -> 1x Redstone-Staub
        '4,4': { type: 'loose_cobble' },          // Felsbrocken blockiert die Schiene bei (4,4)!
        '7,4': { type: 'powered_rail' },          // Gold-Antriebsschiene (braucht Strom aus (7,3))
        '7,3': { type: 'wire_slot', filled: false }, // Redstone-Fassung für die Goldschiene
        '9,5': { type: 'lever', id: 'track_lever', state: false }, // Schranken-Hebel für Gleis (9,4)
        '10,4': { type: 'detector_rail', triggered: false },       // Ziel-Sensorschiene
        '2,6': { type: 'sign_room2' }
      };

      return {
        roomNumber: 2,
        variant: 'A',
        grid: layout,
        objects,
        gateOpen: false,
        gateWasOpenedOnce: false,
        roomCompleted: false,
        cart: {
          x: 1, // tile X (float during animation)
          y: 4,
          moving: false,
          returning: false,
          stopX: 1,
          failReason: '',
          arrived: false
        },
        player: {
          x: 5.5 * TILE_SIZE,
          y: 6.5 * TILE_SIZE,
          radius: 14,
          speed: 210,
          dir: 'up',
          walkFrame: 0,
          isMoving: false
        },
        hotbar,
        selectedSlot: 1 // Direkt Spitzhacke ausgewählt!
      };
    } else {
      // VARIANTE B: Live-Redstone-Dreh-Gitter (Stromfluss-Rätsel)
      const layout = [
        ['B', 'B', 'B', 'B', 'B', 'I', 'I', 'B', 'B', 'B', 'B', 'B'],
        ['B', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'O', 'B'],
        ['B', 'F', 'B', 'F', 'F', 'F', 'F', 'F', 'B', 'F', 'F', 'B'],
        ['B', 'O', 'B', 'F', 'F', 'F', 'F', 'F', 'B', 'F', 'F', 'B'],
        ['B', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'B'],
        ['B', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'B'],
        ['B', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'O', 'B'],
        ['B', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'B'],
        ['B', 'B', 'B', 'B', 'B', 'B', 'B', 'B', 'B', 'B', 'B', 'B']
      ];

      const objects = {
        '2,4': { type: 'mineable_redstone_ore' },
        '5,6': { type: 'generator' },
        '5,5': { type: 'rot_wire', shape: 'corner', rot: 1, powered: false },
        '4,5': { type: 'rot_wire', shape: 'corner', rot: 3, powered: false },
        '4,4': { type: 'rot_wire', shape: 'straight', rot: 1, powered: false },
        '4,3': { type: 'rot_wire', shape: 'corner', rot: 0, powered: false },
        '5,3': { type: 'rot_wire_missing' },
        '5,2': { type: 'rot_wire', shape: 'straight', rot: 1, powered: false },
        '5,1': { type: 'rot_wire', shape: 'straight', rot: 0, powered: false },
        '2,6': { type: 'sign_room2' }
      };

      const st = {
        roomNumber: 2,
        variant: 'B',
        grid: layout,
        objects,
        gateOpen: false,
        gateWasOpenedOnce: false,
        roomCompleted: false,
        player: {
          x: 5.5 * TILE_SIZE,
          y: 7.2 * TILE_SIZE,
          radius: 14,
          speed: 210,
          dir: 'up',
          walkFrame: 0,
          isMoving: false
        },
        hotbar,
        selectedSlot: 1
      };
      return st;
    }
  }

  function createInitialRoom3State() {
    // RAUM 3: Die Nether-Festung (Wasserblock-Brücke)
    // 'N' = Nether Wall (Solid)
    // 'K' = Nether Bricks Floor (High contrast)
    // 'L' = Lava River (Solid unless a Water Block is placed in the bridge slot!)
    // 'G' = Glowstone Lamp Pillar (Solid in Room 3)
    // 'U' = Nether Gate at (5,0) & (6,0)
    const layout = [
      ['N', 'N', 'N', 'N', 'N', 'U', 'U', 'N', 'N', 'N', 'N', 'N'],
      ['N', 'G', 'K', 'K', 'K', 'K', 'K', 'K', 'K', 'K', 'G', 'N'],
      ['N', 'K', 'K', 'K', 'K', 'K', 'K', 'K', 'K', 'K', 'K', 'N'],
      ['N', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'N'],
      ['N', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'N'],
      ['N', 'K', 'K', 'K', 'K', 'K', 'K', 'K', 'N', 'N', 'N', 'N'],
      ['N', 'K', 'K', 'K', 'K', 'K', 'K', 'K', 'K', 'K', 'K', 'N'],
      ['N', 'K', 'K', 'K', 'K', 'K', 'K', 'K', 'N', 'N', 'N', 'N'],
      ['N', 'N', 'N', 'N', 'N', 'N', 'N', 'N', 'N', 'N', 'N', 'N']
    ];

    const objects = {
      '2,6': { type: 'water_source', taken: false },           // Wasserblock #1 (links auf Sockel)
      '8,6': { type: 'loose_cobble' },                         // Rissiger Felsbrocken vor der rechten Kammer
      '10,6': { type: 'water_source', taken: false },          // Wasserblock #2 (rechts in der Kammer)
      '5,4': { type: 'lava_bridge', cooled: false },           // Südliches Brücken-Zielfeld in der Lava
      '5,3': { type: 'lava_bridge', cooled: false },           // Nördliches Brücken-Zielfeld in der Lava
      '3,1': { type: 'mineable_glowstone' },                   // Abbaubarer Leuchtstein-Kristall (Nord-Ufer)
      '7,1': { type: 'nether_altar', activated: false },       // Goldener Portal-Sockel neben dem Tor
      '3,6': { type: 'sign_room3' }                            // Hinweisschild
    };

    return {
      roomNumber: 3,
      grid: layout,
      objects,
      gateOpen: false,
      gateWasOpenedOnce: false,
      roomCompleted: false,
      player: {
        x: 5.5 * TILE_SIZE,
        y: 6.5 * TILE_SIZE,
        radius: 14,
        speed: 210,
        dir: 'up',
        walkFrame: 0,
        isMoving: false
      },
      hotbar: [
        { id: 'hand', count: 1 },
        { id: 'pickaxe', count: 1 },
        null,
        null,
        null
      ],
      selectedSlot: 1
    };
  }

  function createInitialRoom4State() {
    // RAUM 4: Das Amethyst-Observatorium (Pink-Lila Lichtstrahl-Linie)
    // 'P' = Purpur Wall (Solid in Room 4)
    // 'S' = Endstone Bricks Floor (High contrast warm floor)
    // 'Z' = End Portal Gate at (5,0) & (6,0)
    const layout = [
      ['P', 'P', 'P', 'P', 'P', 'Z', 'Z', 'P', 'P', 'P', 'P', 'P'],
      ['P', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'P'],
      ['P', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'P'],
      ['P', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'P'],
      ['P', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'P'],
      ['P', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'P'],
      ['P', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'P'],
      ['P', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'P'],
      ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P']
    ];

    const objects = {
      '2,4': { type: 'beam_emitter' },                         // Laser-Sender links
      '8,4': { type: 'beam_receiver' },                        // Laser-Empfänger rechts
      '4,4': { type: 'amethyst_slot', filled: false },         // Zielfeld 1 (links)
      '5,4': { type: 'amethyst_slot', filled: false },         // Zielfeld 2 (Mitte)
      '6,4': { type: 'amethyst_slot', filled: false, blockedByRock: true }, // Zielfeld 3 (rechts, erst Felsbrocken abbauen!)
      '4,6': { type: 'push_amethyst', targetY: 4, dirY: -1 },  // Schiebbarer Amethyst-Block #1 (nach oben schieben!)
      '5,2': { type: 'push_amethyst', targetY: 4, dirY: 1 },   // Schiebbarer Amethyst-Block #2 (nach unten schieben!)
      '9,6': { type: 'mineable_amethyst' },                    // Abbaubare Amethyst-Geode rechts unten -> gibt Amethyst-Block #3!
      '9,2': { type: 'dragon_egg' },                           // 1 Drachenei auf Sockel (Code-Hinweis für Raum 5!)
      '2,6': { type: 'sign_room4' }                            // Hinweisschild
    };

    return {
      roomNumber: 4,
      grid: layout,
      objects,
      gateOpen: false,
      gateWasOpenedOnce: false,
      roomCompleted: false,
      player: {
        x: 5.5 * TILE_SIZE,
        y: 6.5 * TILE_SIZE,
        radius: 14,
        speed: 210,
        dir: 'up',
        walkFrame: 0,
        isMoving: false
      },
      hotbar: [
        { id: 'hand', count: 1 },
        { id: 'pickaxe', count: 1 },
        null,
        null,
        null
      ],
      selectedSlot: 1
    };
  }

  // Raum 5: Code-Reihenfolge der 4 Ziffern-Säulen (von links nach rechts)
  const ROOM5_CODE = [4, 3, 2, 1];
  const ROOM5_DIAL_KEYS = ['3,4', '4,4', '7,4', '8,4'];
  const ROOM5_DIAL_INFO = [
    { icon: '🌼', label: 'Wald – blaue Kornblumen' },
    { icon: '💎', label: 'Mine – Diamanterze' },
    { icon: '🌉', label: 'Nether – Brückenblöcke' },
    { icon: '🥚', label: 'End – Dracheneier' }
  ];

  function createInitialRoom5State() {
    // RAUM 5: Die antike Schatzkammer (4-stelliger Code-Tresor)
    // 'W' = Gold-Bücherregal-Mauer (Solid)
    // 'Q' = Quarz-Boden
    // 'E' = Smaragd-Säule (Solid, Deko)
    // 'V' = Königlicher Tresor-Ausgang bei (5,0) & (6,0)
    const layout = [
      ['W', 'W', 'W', 'W', 'W', 'V', 'V', 'W', 'W', 'W', 'W', 'W'],
      ['W', 'Q', 'Q', 'Q', 'Q', 'Q', 'Q', 'Q', 'Q', 'Q', 'Q', 'W'],
      ['W', 'Q', 'E', 'Q', 'Q', 'Q', 'Q', 'Q', 'Q', 'E', 'Q', 'W'],
      ['W', 'Q', 'Q', 'Q', 'Q', 'Q', 'Q', 'Q', 'Q', 'Q', 'Q', 'W'],
      ['W', 'Q', 'Q', 'Q', 'Q', 'Q', 'Q', 'Q', 'Q', 'Q', 'Q', 'W'],
      ['W', 'Q', 'Q', 'Q', 'Q', 'Q', 'Q', 'Q', 'Q', 'Q', 'Q', 'W'],
      ['W', 'Q', 'E', 'Q', 'Q', 'Q', 'Q', 'Q', 'Q', 'E', 'Q', 'W'],
      ['W', 'Q', 'Q', 'Q', 'Q', 'Q', 'Q', 'Q', 'Q', 'Q', 'Q', 'W'],
      ['W', 'W', 'W', 'W', 'W', 'W', 'W', 'W', 'W', 'W', 'W', 'W']
    ];

    const objects = {
      '3,4': { type: 'code_dial', index: 0, value: 0 },   // 🌼 Wald
      '4,4': { type: 'code_dial', index: 1, value: 0 },   // 💎 Mine
      '7,4': { type: 'code_dial', index: 2, value: 0 },   // 🌉 Nether
      '8,4': { type: 'code_dial', index: 3, value: 0 },   // 🥚 End
      '10,1': { type: 'mineable_emerald', locked: true },  // Smaragd hinter Kraftfeld (erst nach richtigem Code)
      '7,1': { type: 'vault_socket', filled: false },      // Smaragd-Schlüsselsockel neben dem Tresor
      '5,6': { type: 'sign_room5' }                        // Inschrift
    };

    return {
      roomNumber: 5,
      grid: layout,
      objects,
      gateOpen: false,
      gateWasOpenedOnce: false,
      roomCompleted: false,
      codeSolved: false,
      player: {
        x: 5.5 * TILE_SIZE,
        y: 7.5 * TILE_SIZE,
        radius: 14,
        speed: 210,
        dir: 'up',
        walkFrame: 0,
        isMoving: false
      },
      hotbar: [
        { id: 'hand', count: 1 },
        { id: 'pickaxe', count: 1 },
        null,
        null,
        null
      ],
      selectedSlot: 0
    };
  }

  function updateVaultStatus() {
    if (state.roomNumber !== 5) return;
    const plateStatus = document.getElementById('plateStatus');
    const values = ROOM5_DIAL_KEYS.map((k) => (state.objects[k] ? state.objects[k].value : 0));
    const correct = values.every((v, i) => v === ROOM5_CODE[i]);

    if (correct && !state.codeSolved) {
      state.codeSolved = true;
      const emerald = state.objects['10,1'];
      if (emerald) emerald.locked = false;
      playSound('unlock');
      spawnBlockParticles(10, 1, '#00e676', '#ffffff');
      showToast('🔓 <strong>Code 4-3-2-1 korrekt!</strong> Das Kraftfeld um den <strong>Meister-Smaragd</strong> oben rechts ist erloschen – baue ihn mit der Spitzhacke ab!', 6500);
    }

    if (plateStatus) {
      if (state.gateOpen) {
        plateStatus.innerHTML = 'Tresor: <span style="color:#52ff38;">Geöffnet – der Schatz gehört dir!</span>';
      } else if (state.codeSolved) {
        plateStatus.innerHTML = 'Code: <span style="color:#52ff38;">Korrekt</span> · Smaragd: <span style="color:#ffd54f;">In den Sockel setzen</span>';
      } else {
        plateStatus.innerHTML = `Code-Säulen: <span style="color:#ffd700;">${values.join(' - ')}</span>`;
      }
    }
  }

  function resetRoom(targetRoomNum) {
    const rNum = targetRoomNum || (state ? state.roomNumber : 1);
    particles = [];
    balloons = [];
    meadowEnding = false;
    mining.active = false;
    mining.progress = 0;
    clearPressedKeys();

    if (rNum === 1) {
      state = createInitialRoom1State();
      document.getElementById('roomSubtitle').textContent = 'Raum 1 von 5: Der überwucherte Eichenwald';
      document.getElementById('objectiveText').innerHTML =
        '🎯 <strong>Aufgabe:</strong> Beide Stein-Druckplatten vor dem Nord-Tor müssen gleichzeitig beschwert sein, damit sich das Tor öffnet!';
      document.getElementById('plateStatus').innerHTML =
        'Druckplatten: <span id="plateCounter">0 / 2</span> aktiviert';
      updateRoomStepHighlight(1);
      renderHotbar();
      updatePlateStatus();
      showToast('🌲 <strong>Tutorial:</strong> Öffne zuerst die <strong>Holztruhe</strong> links mit <kbd>E</kbd> oder Klick, um deine Spitzhacke zu holen!');
    } else if (rNum === 2) {
      state = createInitialRoom2State(null, room2Variant);
      updateRoomStepHighlight(2);
      renderHotbar();
      document.getElementById('roomSubtitle').textContent = 'Raum 2 von 5: Die tiefe Redstone-Mine';
      document.getElementById('objectiveText').innerHTML =
        room2Variant === 'A'
          ? '🎯 <strong>Aufgabe:</strong> Mache die Schiene frei, gib der Goldschiene Redstone-Strom, öffne die Schranke und stoße die <strong>Lore</strong> links an!'
          : '🎯 <strong>Aufgabe (Variante B):</strong> Baue links das Redstone-Erz ab, setze es in die Lücke <code>(5,3)</code> und drehe die Kabel mit <kbd>E</kbd>, bis die Tür aufgeht!';
      updatePlateStatus();
      showToast(
        room2Variant === 'A'
          ? '⛏️ <strong>Raum 2 gestartet:</strong> Baue den Felsbrocken auf den Schienen &amp; das glühende Redstone-Erz oben links mit der Spitzhacke ab!'
          : '🔌 <strong>Raum 2 (Variante B):</strong> Baue links das Redstone-Erz ab und verbinde den Dreh-Schaltkreis!'
      );
    } else if (rNum === 3) {
      state = createInitialRoom3State();
      updateRoomStepHighlight(3);
      renderHotbar();
      document.getElementById('roomSubtitle').textContent = 'Raum 3 von 5: Die Nether-Festung';
      document.getElementById('objectiveText').innerHTML =
        '🎯 <strong>Aufgabe:</strong> Sammle die <strong>2 blauen Wasserblöcke</strong>, setze sie in die <strong>blau markierten Lava-Felder</strong> in der Mitte und aktiviere oben den Portal-Altar!';
      updatePlateStatus();
      showToast('💧 <strong>Raum 3:</strong> Nimm links den leuchtenden <strong>Wasserblock</strong> (<kbd>E</kbd> / Klick) und setze ihn in das blau markierte Brückenfeld in der Lava!');
    } else if (rNum === 4) {
      state = createInitialRoom4State();
      updateRoomStepHighlight(4);
      renderHotbar();
      document.getElementById('roomSubtitle').textContent = 'Raum 4 von 5: Das Amethyst-Observatorium';
      document.getElementById('objectiveText').innerHTML =
        '🎯 <strong>Aufgabe:</strong> Bringe alle <strong>3 pink-lila Amethyst-Blöcke</strong> in die <strong>pink markierten Zielfelder</strong> in der Mitte, um den Lichtstrahl zu verbinden!';
      updatePlateStatus();
      showToast('🔮 <strong>Raum 4:</strong> Schiebe die beiden Amethyst-Blöcke mit <kbd>E</kbd> / Klick in die pink markierten Zielfelder und baue rechts die Geode ab!');
    } else if (rNum === 5) {
      state = createInitialRoom5State();
      updateRoomStepHighlight(5);
      renderHotbar();
      document.getElementById('roomSubtitle').textContent = 'Raum 5 von 5: Die antike Schatzkammer';
      document.getElementById('objectiveText').innerHTML =
        '🎯 <strong>Finale:</strong> Stelle an den <strong>4 goldenen Code-Säulen</strong> die Zahlen aus den Räumen 1–4 ein, baue den <strong>Meister-Smaragd</strong> ab und öffne den Tresor!';
      updatePlateStatus();
      showToast('👑 <strong>Raum 5:</strong> Jede goldene Säule steht für einen Raum. Drücke <kbd>E</kbd> / Klick, um ihre Ziffer zu erhöhen!', 6000);
    }
  }

  function updateRoomStepHighlight(activeRoom) {
    document.querySelectorAll('.room-step').forEach((el) => {
      const r = parseInt(el.getAttribute('data-room'), 10);
      el.classList.remove('active');
      if (r === activeRoom) {
        el.classList.remove('locked');
        el.classList.add('active');
      }
    });
  }

  // Inventory Helpers
  function addItem(itemId, amount = 1) {
    // Check if already in hotbar
    for (let i = 0; i < state.hotbar.length; i++) {
      if (state.hotbar[i] && state.hotbar[i].id === itemId) {
        state.hotbar[i].count += amount;
        renderHotbar();
        return i;
      }
    }
    // Find first empty slot
    for (let i = 0; i < state.hotbar.length; i++) {
      if (!state.hotbar[i]) {
        state.hotbar[i] = { id: itemId, count: amount };
        renderHotbar();
        return i;
      }
    }
    return -1;
  }

  function removeItem(itemId, amount = 1) {
    for (let i = 0; i < state.hotbar.length; i++) {
      const slot = state.hotbar[i];
      if (slot && slot.id === itemId && slot.count >= amount) {
        slot.count -= amount;
        if (slot.count <= 0) {
          state.hotbar[i] = null;
          if (state.selectedSlot === i) {
            state.selectedSlot = 0;
          }
        }
        renderHotbar();
        return true;
      }
    }
    return false;
  }

  function getItemCount(itemId) {
    let total = 0;
    for (const slot of state.hotbar) {
      if (slot && slot.id === itemId) total += slot.count;
    }
    return total;
  }

  function getSelectedItem() {
    const slot = state.hotbar[state.selectedSlot];
    if (!slot) return ITEM_DEFS.hand;
    return ITEM_DEFS[slot.id] || ITEM_DEFS.hand;
  }

  function selectSlot(index) {
    if (index < 0 || index >= state.hotbar.length) return;
    state.selectedSlot = index;
    renderHotbar();
  }

  function renderHotbar() {
    const hotbarEl = document.getElementById('hotbar');
    hotbarEl.innerHTML = '';

    state.hotbar.forEach((slot, idx) => {
      const slotEl = document.createElement('div');
      slotEl.className = 'hotbar-slot' + (idx === state.selectedSlot ? ' selected' : '');
      slotEl.setAttribute('role', 'option');
      slotEl.setAttribute('aria-selected', idx === state.selectedSlot ? 'true' : 'false');

      const keySpan = document.createElement('span');
      keySpan.className = 'slot-key';
      keySpan.textContent = String(idx + 1);
      slotEl.appendChild(keySpan);

      if (slot) {
        const def = ITEM_DEFS[slot.id];
        const iconCanvas = document.createElement('canvas');
        iconCanvas.width = 16;
        iconCanvas.height = 16;
        const iconCtx = iconCanvas.getContext('2d');
        iconCtx.imageSmoothingEnabled = false;
        iconCtx.drawImage(window.MCTextures.get(def.texture), 0, 0);
        slotEl.appendChild(iconCanvas);
        slotEl.title = `${def.name} (Taste ${idx + 1})`;

        if (slot.count > 1 || (slot.id !== 'hand' && slot.id !== 'pickaxe')) {
          const countSpan = document.createElement('span');
          countSpan.className = 'slot-count';
          countSpan.textContent = String(slot.count);
          slotEl.appendChild(countSpan);
        }
      }

      slotEl.addEventListener('click', () => {
        selectSlot(idx);
      });

      hotbarEl.appendChild(slotEl);
    });

    const activeDef = getSelectedItem();
    document.getElementById('selectedItemName').textContent = activeDef.name;
    document.getElementById('selectedItemHint').innerHTML = `– ${activeDef.hint}`;
  }

  // Particles Effect
  function spawnBlockParticles(tileX, tileY, color1, color2) {
    const cx = (tileX + 0.5) * TILE_SIZE;
    const cy = (tileY + 0.5) * TILE_SIZE;
    for (let i = 0; i < 16; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 110;
      particles.push({
        x: cx + (Math.random() - 0.5) * 20,
        y: cy + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 5 + Math.floor(Math.random() * 5),
        color: i % 2 === 0 ? color1 : color2,
        life: 0.45 + Math.random() * 0.25
      });
    }
  }

  // Toast / Prompt
  function showToast(msg, duration = 4200) {
    const promptEl = document.getElementById('interactionPrompt');
    promptEl.innerHTML = msg;
    if (toastTimeout) clearTimeout(toastTimeout);
    if (duration > 0) {
      toastTimeout = setTimeout(() => {
        toastTimeout = null;
      }, duration);
    }
  }

  // Tile & Object Queries
  function getPlayerTile() {
    return {
      tx: Math.floor(state.player.x / TILE_SIZE),
      ty: Math.floor(state.player.y / TILE_SIZE)
    };
  }

  function getFacingTile() {
    const { tx, ty } = getPlayerTile();
    const dir = state.player.dir;
    if (dir === 'up') return { tx, ty: ty - 1 };
    if (dir === 'down') return { tx, ty: ty + 1 };
    if (dir === 'left') return { tx: tx - 1, ty };
    if (dir === 'right') return { tx: tx + 1, ty };
    return { tx, ty };
  }

  function isTileSolid(tx, ty) {
    if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) return true;
    const base = state.grid[ty][tx];
    const obj = state.objects[`${tx},${ty}`];

    // Room 1 solid tiles ('T' = Tree Wall, 'M' = Mossy Wall, 'D' = Gate)
    if (state.roomNumber === 1) {
      if (base === 'T' || base === 'M') return true;
      if (base === 'D' && !state.gateOpen) return true;
    }

    // Room 2 solid tiles ('B' = Deepslate Wall, 'O' = Diamond Ore, 'E' = Redstone Ore, 'I' = Iron Door)
    if (state.roomNumber === 2) {
      if (base === 'B' || base === 'O' || base === 'E') return true;
      if (base === 'I' && !state.gateOpen) return true;
      if (state.variant === 'A' && state.cart) {
        if (Math.round(state.cart.x) === tx && state.cart.y === ty) return true;
      }
    }

    // Room 3 solid tiles ('N' = Nether Wall, 'G' = Glowstone Pillar, 'U' = Nether Gate, 'L' = Lava unless cooled)
    if (state.roomNumber === 3) {
      if (base === 'N' || base === 'G') return true;
      if (base === 'U' && !state.gateOpen) return true;
      if (base === 'L') {
        if (obj && obj.type === 'lava_bridge' && obj.cooled) {
          return false; // Cooled Obsidian bridge is walkable!
        }
        return true;
      }
    }

    // Room 4 solid tiles ('P' = Purpur Wall, 'Z' = End Portal Gate)
    if (state.roomNumber === 4) {
      if (base === 'P') return true;
      if (base === 'Z' && !state.gateOpen) return true;
    }

    // Room 5 solid tiles ('W' = Gold Wall, 'E' = Emerald Pillar, 'V' = Vault Door)
    if (state.roomNumber === 5) {
      if (base === 'W' || base === 'E') return true;
      if (base === 'V' && !state.gateOpen) return true;
    }

    if (!obj) return false;
    if (
      obj.type === 'chest' ||
      obj.type === 'loose_cobble' ||
      obj.type === 'workbench' ||
      obj.type === 'loose_log' ||
      obj.type === 'mineable_redstone_ore' ||
      obj.type === 'generator' ||
      obj.type === 'sign_room2' ||
      (obj.type === 'water_source' && !obj.taken) ||
      obj.type === 'mineable_glowstone' ||
      obj.type === 'nether_altar' ||
      obj.type === 'sign_room3' ||
      obj.type === 'beam_emitter' ||
      obj.type === 'beam_receiver' ||
      obj.type === 'push_amethyst' ||
      (obj.type === 'amethyst_slot' && (obj.filled || obj.blockedByRock)) ||
      obj.type === 'mineable_amethyst' ||
      obj.type === 'dragon_egg' ||
      obj.type === 'sign_room4' ||
      obj.type === 'code_dial' ||
      obj.type === 'mineable_emerald' ||
      obj.type === 'vault_socket' ||
      obj.type === 'sign_room5'
    ) {
      return true;
    }
    return false;
  }

  function isPlateActive(tx, ty) {
    const obj = state.objects[`${tx},${ty}`];
    if (!obj || obj.type !== 'plate') return false;
    if (obj.placedItem) return true;
    const pTile = getPlayerTile();
    return pTile.tx === tx && pTile.ty === ty;
  }

  function updatePlateStatus() {
    if (state.roomNumber === 1) {
      const leftActive = isPlateActive(4, 2);
      const rightActive = isPlateActive(7, 2);
      const count = (leftActive ? 1 : 0) + (rightActive ? 1 : 0);

      const plateCounter = document.getElementById('plateCounter');
      if (plateCounter) plateCounter.textContent = `${count} / 2`;
      const bothActive = leftActive && rightActive;

      if (bothActive && !state.gateOpen) {
        state.gateOpen = true;
        playSound('unlock');
        const bothHaveBlocks =
          state.objects['4,2'].placedItem && state.objects['7,2'].placedItem;
        if (bothHaveBlocks) {
          showToast('🎉 Beide Druckplatten sind dauerhaft beschwert! Das Nord-Tor ist offen – laufe hindurch!', 6000);
        } else {
          showToast('🔓 Beide Druckplatten sind aktiv! Aber Vorsicht: Wenn du heruntergehst, brauchst du einen 2. schweren Block!', 5000);
        }
        state.gateWasOpenedOnce = true;
      } else if (!bothActive && state.gateOpen) {
        state.gateOpen = false;
        playSound('error');
        showToast('🔒 Du bist von der Druckplatte gegangen und das Nord-Tor hat sich wieder geschlossen! Platziere auf beiden Platten einen Block.', 5500);
      }
    } else if (state.roomNumber === 2) {
      updateRedstoneCircuitStatus();
    } else if (state.roomNumber === 3) {
      updateNetherStatus();
    } else if (state.roomNumber === 4) {
      updateAmethystStatus();
    } else if (state.roomNumber === 5) {
      updateVaultStatus();
    }
  }

  function updateNetherStatus() {
    if (state.roomNumber !== 3) return;
    const plateStatus = document.getElementById('plateStatus');
    const b1 = state.objects['5,4'] && state.objects['5,4'].cooled ? 1 : 0;
    const b2 = state.objects['5,3'] && state.objects['5,3'].cooled ? 1 : 0;
    const bridgeCount = b1 + b2;
    const altarActive = Boolean(state.objects['7,1'] && state.objects['7,1'].activated);

    if (plateStatus) {
      if (altarActive) {
        plateStatus.innerHTML = `Nether-Altar: <span style="color:#52ff38;">Aktiv &amp; Portal-Tor offen!</span>`;
      } else {
        plateStatus.innerHTML = `Wasser-Brücke: <span style="color:#00e5ff;">${bridgeCount} / 2</span> · Altar: <span style="color:#ff9f43;">Wartet</span>`;
      }
    }
  }

  function updateAmethystStatus() {
    if (state.roomNumber !== 4) return;
    const plateStatus = document.getElementById('plateStatus');
    const s1 = state.objects['4,4'] && state.objects['4,4'].filled ? 1 : 0;
    const s2 = state.objects['5,4'] && state.objects['5,4'].filled ? 1 : 0;
    const s3 = state.objects['6,4'] && state.objects['6,4'].filled ? 1 : 0;
    const count = s1 + s2 + s3;
    const allAligned = count === 3;

    if (plateStatus) {
      if (allAligned) {
        plateStatus.innerHTML = `Lichtstrahl: <span style="color:#52ff38;">3 / 3 verbunden &amp; Portal offen!</span>`;
      } else {
        plateStatus.innerHTML = `Amethyst-Linie: <span style="color:#ff80fc;">${count} / 3 im Zielfeld</span>`;
      }
    }

    if (allAligned && !state.gateOpen) {
      state.gateOpen = true;
      playSound('unlock');
      spawnBlockParticles(5, 0, '#ff40fb', '#52ff38');
      spawnBlockParticles(6, 0, '#ff40fb', '#52ff38');
      showToast('🔮 <strong>Der pink-lila Resonanzstrahl ist verbunden!</strong> Das End-Portal-Tor im Norden ist offen – laufe hindurch!', 6500);
    }
  }

  // Helper for Variant B rotatable wires: returns array of open directions ['N','E','S','W']
  function getWireDirs(shape, rot) {
    const r = ((rot % 4) + 4) % 4;
    if (shape === 'straight') {
      return r % 2 === 0 ? ['N', 'S'] : ['E', 'W'];
    }
    // corner:
    // rot 0: N + E
    // rot 1: E + S
    // rot 2: S + W
    // rot 3: W + N
    if (r === 0) return ['N', 'E'];
    if (r === 1) return ['E', 'S'];
    if (r === 2) return ['S', 'W'];
    return ['W', 'N'];
  }

  const OPP_DIR = { N: 'S', S: 'N', E: 'W', W: 'E' };
  const DIR_DELTA = {
    N: [0, -1],
    S: [0, 1],
    E: [1, 0],
    W: [-1, 0]
  };

  function evaluateVariantBCircuit() {
    // Reset all rot_wire powered states
    for (const obj of Object.values(state.objects)) {
      if (obj.type === 'rot_wire') obj.powered = false;
    }

    // BFS starting from Generator at (5,6), which outputs to 'N' -> (5,5)
    const queue = [];
    const first = state.objects['5,5'];
    if (first && first.type === 'rot_wire') {
      const dirs = getWireDirs(first.shape, first.rot);
      if (dirs.includes('S')) {
        first.powered = true;
        queue.push([5, 5]);
      }
    }

    const visited = new Set(['5,5']);
    let doorPowered = false;

    while (queue.length > 0) {
      const [cx, cy] = queue.shift();
      const curr = state.objects[`${cx},${cy}`];
      if (!curr || curr.type !== 'rot_wire') continue;

      const dirs = getWireDirs(curr.shape, curr.rot);
      for (const d of dirs) {
        const [dx, dy] = DIR_DELTA[d];
        const nx = cx + dx;
        const ny = cy + dy;

        // Did power reach the Iron Door at (5,0)?
        if (nx === 5 && ny === 0 && d === 'N') {
          doorPowered = true;
        }

        const nKey = `${nx},${ny}`;
        if (visited.has(nKey)) continue;
        const nextObj = state.objects[nKey];
        if (nextObj && nextObj.type === 'rot_wire') {
          const nextDirs = getWireDirs(nextObj.shape, nextObj.rot);
          if (nextDirs.includes(OPP_DIR[d])) {
            nextObj.powered = true;
            visited.add(nKey);
            queue.push([nx, ny]);
          }
        }
      }
    }

    return doorPowered;
  }

  function updateRedstoneCircuitStatus() {
    if (state.roomNumber !== 2) return;
    const plateStatus = document.getElementById('plateStatus');

    if (state.variant === 'A') {
      const rockCleared = !state.objects['4,4'];
      const railPowered = state.objects['7,3'] && state.objects['7,3'].filled;
      const leverOpen = state.objects['9,5'] && state.objects['9,5'].state;
      const doneCount = (rockCleared ? 1 : 0) + (railPowered ? 1 : 0) + (leverOpen ? 1 : 0);

      if (plateStatus) {
        if (state.gateOpen) {
          plateStatus.innerHTML = `Strecke: <span style="color:#52ff38;">Lore am Ziel &amp; Tor offen!</span>`;
        } else {
          plateStatus.innerHTML = `Schienen-Check: <span style="color:#ffd54f;">${doneCount} / 3 bereit</span>`;
        }
      }
    } else {
      // Variant B
      const doorPowered = evaluateVariantBCircuit();
      const missingStillThere = Boolean(state.objects['5,3'] && state.objects['5,3'].type === 'rot_wire_missing');

      if (plateStatus) {
        if (doorPowered) {
          plateStatus.innerHTML = `Schaltkreis: <span style="color:#52ff38;">Verbunden &amp; Tür offen!</span>`;
        } else if (missingStillThere) {
          plateStatus.innerHTML = `Schaltkreis: <span style="color:#ff6b6b;">1 Kabelstück fehlt (Mitte)</span>`;
        } else {
          plateStatus.innerHTML = `Schaltkreis: <span style="color:#ffd54f;">Kabel drehen (E / Klick)</span>`;
        }
      }

      if (doorPowered && !state.gateOpen) {
        state.gateOpen = true;
        playSound('unlock');
        showToast('⚡ <strong>Der Redstone-Schaltkreis ist geschlossen!</strong> Die Eisentür im Norden ist offen – laufe hindurch!', 6000);
      } else if (!doorPowered && state.gateOpen) {
        state.gateOpen = false;
        playSound('error');
        showToast('🔒 Der Stromfluss zur Eisentür wurde unterbrochen.');
      }
    }
  }

  function pushMinecart() {
    if (!state.cart || state.cart.moving || state.cart.arrived) return;
    playSound('chest');

    const rockBlocked = Boolean(state.objects['4,4']);
    const railPowered = Boolean(state.objects['7,3'] && state.objects['7,3'].filled);
    const leverOpen = Boolean(state.objects['9,5'] && state.objects['9,5'].state);

    state.cart.moving = true;
    state.cart.returning = false;

    if (rockBlocked) {
      state.cart.stopX = 3.2;
      state.cart.failReason = '🪨 <strong>Klonk!</strong> Die Lore prallt am rissigen Felsbrocken auf den Schienen ab! Baue ihn erst mit deiner <strong>Spitzhacke</strong> ab.';
    } else if (!railPowered) {
      state.cart.stopX = 6.8;
      state.cart.failReason = '⚡ Die Lore bleibt auf der <strong>Gold-Antriebsschiene</strong> stehen! Baue oben links das <strong>Redstone-Erz</strong> ab und lege den Staub in die Fassung darüber.';
    } else if (!leverOpen) {
      state.cart.stopX = 8.3;
      state.cart.failReason = '🕹️ Die Schranke vor dem Sensor ist noch zu! Lege rechts unten den <strong>Schranken-Hebel</strong> um.';
    } else {
      state.cart.stopX = 10.0;
      state.cart.failReason = '';
    }
  }

  // Interaction Logic
  function interactWithTile(tx, ty) {
    const key = `${tx},${ty}`;
    const obj = state.objects[key];
    const base = (ty >= 0 && ty < ROWS && tx >= 0 && tx < COLS) ? state.grid[ty][tx] : null;
    const activeItem = getSelectedItem();

    // Check if player clicked/interacted with the Minecart in Room 2 Variant A
    if (state.roomNumber === 2 && state.variant === 'A' && state.cart) {
      if (Math.round(state.cart.x) === tx && state.cart.y === ty) {
        if (state.cart.arrived) {
          showToast('🛒 Die Lore steht bereits auf der Sensorschiene – die Eisentür im Norden ist offen!');
        } else {
          pushMinecart();
        }
        return;
      }
    }

    // 1. Check Gate interaction (Room 1)
    if (base === 'D' && state.roomNumber === 1) {
      if (state.gateOpen) {
        triggerRoom1Victory();
      } else {
        playSound('error');
        showToast('🔒 Das massive Eichen-Tor ist verriegelt! Beschwere beide Stein-Druckplatten davor.');
      }
      return;
    }

    // Check Iron Door interaction (Room 2)
    if (base === 'I') {
      if (state.gateOpen) {
        triggerRoom2Victory();
      } else {
        playSound('error');
        showToast(
          state.variant === 'A'
            ? '🔒 Die Eisentür öffnet sich erst, wenn die Lore rechts auf der Sensorschiene einrastet!'
            : '🔒 Die Eisentür öffnet sich erst, wenn der Redstone-Strom vom Generator bis zur Tür fließt!'
        );
      }
      return;
    }

    // Check Nether Portal Gate interaction (Room 3)
    if (base === 'U' && state.roomNumber === 3) {
      if (state.gateOpen) {
        triggerRoom3Victory();
      } else {
        playSound('error');
        showToast('🔒 Das Nether-Portal-Tor ist noch versiegelt! Überquere die Lava und entzünde den Gold-Altar rechts daneben mit Leuchtstaub.');
      }
      return;
    }

    // Check End Portal Gate interaction (Room 4)
    if (base === 'Z' && state.roomNumber === 4) {
      if (state.gateOpen) {
        triggerRoom4Victory();
      } else {
        playSound('error');
        showToast('🔒 Das End-Portal-Tor öffnet sich erst, wenn alle 3 pink-lila Amethyst-Blöcke in den markierten Zielfeldern in der Mitte stehen!');
      }
      return;
    }

    // Check Royal Vault Door interaction (Room 5)
    if (base === 'V' && state.roomNumber === 5) {
      if (state.gateOpen) {
        triggerRoom5Victory();
      } else {
        playSound('error');
        showToast(
          state.codeSolved
            ? '🔒 Der Tresor wartet auf den <strong>Meister-Smaragd</strong>! Setze ihn in den grünen Sockel rechts neben der Tür.'
            : '🔒 Der königliche Tresor ist versiegelt! Stelle zuerst an den 4 goldenen Säulen den richtigen Code ein.'
        );
      }
      return;
    }

    // Room 5 objects
    if (obj && state.roomNumber === 5) {
      if (obj.type === 'code_dial') {
        if (state.codeSolved) {
          showToast('✅ Der Code ist bereits korrekt eingerastet – die Säulen lassen sich nicht mehr drehen.');
          return;
        }
        obj.value = (obj.value + 1) % 10;
        playSound('plate');
        spawnBlockParticles(tx, ty, '#ffd700', '#ffffff');
        const info = ROOM5_DIAL_INFO[obj.index];
        showToast(`${info.icon} <strong>Säule ${obj.index + 1} (${info.label}):</strong> zeigt jetzt <strong>${obj.value}</strong>`, 2500);
        updateVaultStatus();
        return;
      }

      if (obj.type === 'mineable_emerald') {
        if (obj.locked) {
          playSound('error');
          showToast('🛡️ Ein schimmerndes <strong>Kraftfeld</strong> schützt den Meister-Smaragd! Löse zuerst den Code an den 4 goldenen Säulen.');
          return;
        }
        if (activeItem.id === 'pickaxe') {
          startMining(tx, ty, 'emerald');
        } else {
          const pickIdx = state.hotbar.findIndex((s) => s && s.id === 'pickaxe');
          if (pickIdx !== -1) {
            selectSlot(pickIdx);
            playSound('pickup');
            showToast('⛏️ <strong>Spitzhacke automatisch ausgewählt!</strong> Drücke erneut <kbd>E</kbd> oder Klick, um den Smaragd abzubauen.');
          }
        }
        return;
      }

      if (obj.type === 'vault_socket') {
        if (obj.filled) {
          showToast('💚 Der Meister-Smaragd leuchtet im Sockel – der Tresor ist offen!');
          return;
        }
        const emIdx = state.hotbar.findIndex((s) => s && s.id === 'emerald');
        if (emIdx !== -1) {
          selectSlot(emIdx);
          if (removeItem('emerald', 1)) {
            obj.filled = true;
            state.gateOpen = true;
            playSound('unlock');
            spawnBlockParticles(tx, ty, '#00e676', '#ffd700');
            spawnBlockParticles(5, 0, '#ffd700', '#00e676');
            spawnBlockParticles(6, 0, '#ffd700', '#00e676');
            updateVaultStatus();
            showToast('👑 <strong>Der königliche Tresor öffnet sich!</strong> Laufe hindurch und hol dir den Schatz!', 6500);
          }
        } else {
          playSound('error');
          showToast(
            state.codeSolved
              ? '💚 <strong>Smaragd-Schlüsselsockel:</strong> Baue oben rechts den Meister-Smaragd mit der Spitzhacke ab und setze ihn hier ein!'
              : '💚 <strong>Smaragd-Schlüsselsockel:</strong> Hier gehört ein Meister-Smaragd hinein. Löse zuerst den Code!'
          );
        }
        return;
      }

      if (obj.type === 'sign_room5') {
        playSound('pickup');
        openInfoDialog(
          '🪧 Inschrift des Schatzmeisters',
          `
          <div class="hint-box">
            <h3>Der Schlüssel liegt in deiner Reise:</h3>
            <p><em>„Nur wer sich an alle vier Welten erinnert, darf den Schatz der Könige berühren.“</em></p>
            <hr style="margin: 10px 0; border-color: #b5905b;">
            <ul>
              <li>🌼 <strong>Säule 1 (links außen):</strong> Wie viele blaue Kornblumen blühten im Wald?</li>
              <li>💎 <strong>Säule 2:</strong> Wie viele Diamanterze funkelten in der Mine?</li>
              <li>🌉 <strong>Säule 3:</strong> Aus wie vielen Blöcken bestand deine Brücke im Nether?</li>
              <li>🥚 <strong>Säule 4 (rechts außen):</strong> Wie viele Dracheneier ruhten im Observatorium?</li>
            </ul>
            <p>Drücke <kbd>E</kbd> vor einer Säule, um ihre Ziffer um 1 zu erhöhen (nach 9 kommt wieder 0).</p>
          </div>
          `
        );
        return;
      }
    }

    // Inspection: Diamond Ore in Room 2 (Clue for Room 5)
    if (base === 'O' && state.roomNumber === 2) {
      playSound('pickup');
      showToast('💎 Ein funkelndes Diamanterz! In dieser Mine gibt es insgesamt genau <strong>3 Diamanterze</strong>. (Wichtig fürs Finale!)');
      return;
    }

    // Inspection: Lava River in Room 3 (when not a bridge slot)
    if (!obj && base === 'L' && state.roomNumber === 3) {
      playSound('error');
      showToast('🌋 Glühende Lava! Suche die beiden blau markierten Brücken-Felder in der Mitte und setze dort deine Wasserblöcke ein.');
      return;
    }

    // 2. Check Blue Cornflower inspection
    if (!obj && base === 'F' && state.roomNumber === 1) {
      playSound('pickup');
      showToast('🌼 Eine blaue Kornblume! Du zählst insgesamt 4 blaue Kornblumen in diesem Wald-Raum. (Merke dir das fürs Finale!)');
      return;
    }

    if (!obj) {
      showToast('Hier gibt es nichts zum Benutzen. Stelle dich vor ein Objekt, ein Erz oder die Lore!');
      return;
    }

    // 3. Chest (Room 1)
    if (obj.type === 'chest') {
      if (!obj.opened) {
        obj.opened = true;
        playSound('chest');
        const pickSlot = addItem('pickaxe', 1);
        addItem('log', 1);
        if (pickSlot !== -1) selectSlot(pickSlot);
        spawnBlockParticles(tx, ty, '#ffd83d', '#c47c35');
        showToast('🎁 <strong>Holzspitzhacke ausgerüstet!</strong> Gehe jetzt zum rissigen Stein rechts und drücke <kbd>E</kbd> oder Klick zum Abbauen!');
      } else {
        showToast('Die Holztruhe ist bereits leer.');
      }
      return;
    }

    // 4. Sign (Room 1)
    if (obj.type === 'sign') {
      playSound('pickup');
      openInfoDialog(
        '🪧 Altes Waldschild',
        `
        <div class="hint-box">
          <h3>Inschrift des Waldwächters:</h3>
          <p><em>„Zwei Platten aus Stein bewachen das Tor nach Norden. Ein einzelner Wanderer ist zu leicht, um auf beiden zugleich zu stehen und durch das Tor zu schreiten.“</em></p>
          <hr style="margin: 10px 0; border-color: #b5905b;">
          <ul>
            <li>⛏️ Baue den <strong>rissigen Pflasterstein</strong> rechts mit der <strong>Holzspitzhacke</strong> ab, um 1 schweren Steinblock zu erhalten und den Weg zur Werkbank freizulegen.</li>
            <li>🪵 Sammle den zweiten <strong>Eichenstamm</strong> unten rechts im Wald und fertige an der <strong>Werkbank</strong> einen zweiten schweren Block!</li>
            <li>🌼 <em>Geheim-Notiz für Raum 5: Zähle die blauen Kornblumen im Wald (es sind <strong>4 Stück</strong>).</em></li>
          </ul>
        </div>
        `
      );
      return;
    }

    // 5. Loose Cracked Cobblestone (Room 1 & Room 2 Track Obstacle!)
    if (obj.type === 'loose_cobble') {
      if (activeItem.id === 'pickaxe') {
        startMining(tx, ty, 'cobble');
      } else {
        const pickIdx = state.hotbar.findIndex(s => s && s.id === 'pickaxe');
        if (pickIdx !== -1) {
          selectSlot(pickIdx);
          playSound('pickup');
          showToast('⛏️ <strong>Spitzhacke automatisch ausgewählt!</strong> Drücke jetzt noch einmal <kbd>E</kbd> oder Klick, um den Felsbrocken abzubauen.');
        } else {
          playSound('error');
          showToast('🧱 Ein rissiger Felsbrocken! Hole erst die <strong>Holzspitzhacke</strong> aus der Truhe.');
        }
      }
      return;
    }

    // 5b. Mineable Glowing Redstone Ore (Room 2!)
    if (obj.type === 'mineable_redstone_ore') {
      if (activeItem.id === 'pickaxe') {
        startMining(tx, ty, 'redstone_ore');
      } else {
        const pickIdx = state.hotbar.findIndex(s => s && s.id === 'pickaxe');
        if (pickIdx !== -1) {
          selectSlot(pickIdx);
          playSound('pickup');
          showToast('⛏️ <strong>Spitzhacke automatisch ausgewählt!</strong> Drücke erneut <kbd>E</kbd> oder Klick, um das Redstone-Erz abzubauen.');
        } else {
          playSound('error');
          showToast('🔴 Zum Abbauen von Redstone-Erz brauchst du deine Spitzhacke!');
        }
      }
      return;
    }

    // 6. Loose Oak Log in forest
    if (obj.type === 'loose_log') {
      startMining(tx, ty, 'log');
      return;
    }

    // 7. Workbench (Crafting Table)
    if (obj.type === 'workbench') {
      playSound('chest');
      openWorkbenchDialog();
      return;
    }

    // 8. Pressure Plate
    if (obj.type === 'plate') {
      if (obj.placedItem) {
        const returnedItem = obj.placedItem;
        obj.placedItem = null;
        playSound('pickup');
        const slotIdx = addItem(returnedItem, 1);
        if (slotIdx !== -1) selectSlot(slotIdx);
        updatePlateStatus();
        showToast(`🔄 ${ITEM_DEFS[returnedItem].name} wieder von der Druckplatte aufgenommen.`);
      } else if (activeItem.placeableHeavy) {
        if (removeItem(activeItem.id, 1)) {
          obj.placedItem = activeItem.id;
          playSound('plate');
          spawnBlockParticles(tx, ty, '#68ff47', '#969696');
          updatePlateStatus();
        }
      } else {
        const hasCobble = getItemCount('cobble') > 0;
        const hasHeavyWood = getItemCount('heavy_wood') > 0;
        if (hasCobble || hasHeavyWood) {
          playSound('error');
          showToast('💡 Wähle deinen schweren Block (Pflasterstein oder Schwerer Eichenblock) unten in der Hotbar aus, um ihn auf die Druckplatte zu legen!');
        } else {
          playSound('plate');
          showToast('⚖️ Eine Stein-Druckplatte! Stelle einen schweren Block (Pflasterstein oder Schwerer Eichenblock) darauf, damit sie gedrückt bleibt.');
        }
      }
      return;
    }

    // 9. Room 2 Variant A: Powered Rail inspection
    if (obj.type === 'powered_rail') {
      const powered = state.objects['7,3'] && state.objects['7,3'].filled;
      showToast(
        powered
          ? '⚡ <strong>Gold-Antriebsschiene (Aktiv):</strong> Sie hat volle Redstone-Energie und katapultiert die Lore ins Ziel!'
          : '🔌 <strong>Gold-Antriebsschiene (Stromlos):</strong> Lege <strong>Redstone-Staub</strong> in die rote Fassung direkt über dieser Schiene!'
      );
      return;
    }

    // 9b. Room 2 Variant A: Detector Rail inspection
    if (obj.type === 'detector_rail') {
      showToast('🎯 <strong>Ziel-Sensorschiene:</strong> Sobald die Lore hier ankommt, entriegelt sie die Eisentür im Norden!');
      return;
    }

    // 10. Room 2 Variant A: Redstone Wire Slot next to Powered Rail
    if (obj.type === 'wire_slot') {
      if (obj.filled) {
        obj.filled = false;
        playSound('pickup');
        const slotIdx = addItem('redstone', 1);
        if (slotIdx !== -1) selectSlot(slotIdx);
        updateRedstoneCircuitStatus();
        showToast('🔄 Redstone-Staub wieder aus der Fassung genommen.');
      } else if (activeItem.placeableRedstone) {
        if (removeItem('redstone', 1)) {
          obj.filled = true;
          playSound('unlock');
          spawnBlockParticles(tx, ty, '#ff2b2b', '#ffd700');
          updateRedstoneCircuitStatus();
          showToast('⚡ <strong>Gold-Antriebsschiene aktiviert!</strong> Sie glüht jetzt voller Energie!');
        }
      } else {
        const hasRedstone = getItemCount('redstone') > 0;
        if (hasRedstone) {
          const redIdx = state.hotbar.findIndex(s => s && s.id === 'redstone');
          if (redIdx !== -1) selectSlot(redIdx);
          playSound('pickup');
          showToast('⚡ <strong>Redstone-Staub ausgewählt!</strong> Drücke noch einmal <kbd>E</kbd> oder Klick, um die Goldschiene mit Strom zu versorgen.');
        } else {
          playSound('error');
          showToast('🔌 Diese Fassung versorgt die Gold-Antriebsschiene! Baue oben links das <strong>glühende Redstone-Erz</strong> mit der Spitzhacke ab.');
        }
      }
      return;
    }

    // 10b. Room 2 Variant B: Missing Rotatable Wire Slot
    if (obj.type === 'rot_wire_missing') {
      if (activeItem.placeableRedstone) {
        if (removeItem('redstone', 1)) {
          state.objects[key] = { type: 'rot_wire', shape: 'corner', rot: 1, powered: false };
          playSound('plate');
          spawnBlockParticles(tx, ty, '#ff2b2b', '#ffaaaa');
          updateRedstoneCircuitStatus();
          showToast('⚡ <strong>Redstone-Eckkabel eingesetzt!</strong> Drücke <kbd>E</kbd> oder Klick darauf, um es in die richtige Richtung zu drehen!');
        }
      } else {
        const hasRedstone = getItemCount('redstone') > 0;
        if (hasRedstone) {
          const redIdx = state.hotbar.findIndex(s => s && s.id === 'redstone');
          if (redIdx !== -1) selectSlot(redIdx);
          playSound('pickup');
          showToast('⚡ <strong>Redstone-Staub ausgewählt!</strong> Drücke erneut <kbd>E</kbd>, um das fehlende Kabelstück einzusetzen.');
        } else {
          playSound('error');
          showToast('🔌 Hier fehlt ein Redstone-Kabelstück! Baue links das <strong>glühende Redstone-Erz</strong> mit deiner Spitzhacke ab.');
        }
      }
      return;
    }

    // 10c. Room 2 Variant B: Rotate Wire on Click / E
    if (obj.type === 'rot_wire') {
      obj.rot = (obj.rot + 1) % 4;
      playSound('plate');
      spawnBlockParticles(tx, ty, '#ff5252', '#c7c7c7');
      updateRedstoneCircuitStatus();
      return;
    }

    // 10d. Room 2 Variant B: Generator
    if (obj.type === 'generator') {
      playSound('plate');
      showToast('🔋 <strong>Redstone-Generator:</strong> Schickt dauerhaft Strom nach Norden. Drehe die Kabelstücke so, dass der Strom die Tür erreicht!');
      return;
    }

    // 11. Room 2 Variant A: Track Barrier Lever
    if (obj.type === 'lever') {
      obj.state = !obj.state;
      playSound('plate');
      spawnBlockParticles(tx, ty, obj.state ? '#52ff38' : '#ff2424', '#8f8f8f');
      updateRedstoneCircuitStatus();
      showToast(
        obj.state
          ? '🕹️ <strong>Schranken-Hebel auf [OFFEN]!</strong> Die Zufahrt zur Sensorschiene ist jetzt frei!'
          : '🕹️ <strong>Schranken-Hebel auf [GESPERT]!</strong>'
      );
      return;
    }

    // 12. Room 2: Sign
    if (obj.type === 'sign_room2') {
      playSound('pickup');
      if (state.variant === 'A') {
        openInfoDialog(
          '🪧 Logbuch des Vorarbeiters (Loren-Strecke)',
          `
          <div class="hint-box">
            <h3>So entriegelst du das schwere Eisentor:</h3>
            <p><em>„Nur die schwere Erzlore ist stark genug, um den Sensor rechts am Ende des Gleises auszulösen!“</em></p>
            <hr style="margin: 10px 0; border-color: #b5905b;">
            <ul>
              <li>🪨 <strong>1. Schiene räumen:</strong> Baue den <strong>rissigen Felsbrocken</strong> mitten auf dem Gleis mit deiner <strong>Spitzhacke</strong> ab.</li>
              <li>🔴 <strong>2. Goldschiene aufladen:</strong> Baue oben links das <strong>glühende Redstone-Erz</strong> mit der Spitzhacke ab und lege den Redstone-Staub in die Fassung über der Goldschiene.</li>
              <li>🕹️ <strong>3. Schranke öffnen &amp; Stoßen:</strong> Lege rechts den <strong>Hebel</strong> um und stoße links die <strong>Lore</strong> an (<kbd>E</kbd> / Klick)!</li>
              <li>💎 <em>Hinweis für Raum 5: In dieser Mine funkeln genau <strong>3 Diamanterze</strong>.</em></li>
            </ul>
          </div>
          `
        );
      } else {
        openInfoDialog(
          '🪧 Schaltplan des Ingenieurs (Dreh-Gitter)',
          `
          <div class="hint-box">
            <h3>Hochspannungs-Schaltkreis:</h3>
            <p><em>„Leite den Strom vom roten Generator unten bis zur Eisentür im Norden!“</em></p>
            <hr style="margin: 10px 0; border-color: #b5905b;">
            <ul>
              <li>⛏️ Baue links das <strong>glühende Redstone-Erz</strong> mit der <strong>Spitzhacke</strong> ab und setze es in die Lücke in der Mitte ein.</li>
              <li>🔄 Stelle dich vor ein beliebiges Kabelstück und drücke <kbd>E</kbd> (oder klicke darauf), um es <strong>um 90° zu drehen</strong>.</li>
              <li>⚡ Sobald ein Kabel mit dem Generator verbunden ist, <strong>leuchtet es sofort hellrot auf</strong>!</li>
              <li>💎 <em>Hinweis für Raum 5: In dieser Mine funkeln genau <strong>3 Diamanterze</strong>.</em></li>
            </ul>
          </div>
          `
        );
      }
      return;
    }

    // 13. Room 3: Pickup-able Water Block on Pedestal
    if (obj.type === 'water_source') {
      if (!obj.taken) {
        obj.taken = true;
        playSound('pickup');
        const wSlot = addItem('water_block', 1);
        if (wSlot !== -1) selectSlot(wSlot);
        spawnBlockParticles(tx, ty, '#00e5ff', '#80d8ff');
        showToast('💧 <strong>Wasserblock aufgenommen!</strong> Gehe jetzt zu einem der <strong>blau umrandeten Brücken-Felder</strong> in der Lava und drücke <kbd>E</kbd> oder Klick!');
      } else {
        showToast('Der Wasserblock von diesem Sockel wurde bereits aufgenommen.');
      }
      return;
    }

    // 14. Room 3: Lava Bridge Slot -> Place Water Block to create walkable bridge!
    if (obj.type === 'lava_bridge') {
      if (obj.cooled) {
        playSound('pickup');
        showToast('🌉 <strong>Sichere Wasser-Obsidian-Brücke!</strong> Du kannst einfach darüberlaufen. (Hinweis für Raum 5: Die Brücke besteht aus <strong>2 Blöcken</strong>!)');
        return;
      }
      const waterIdx = state.hotbar.findIndex(s => s && s.id === 'water_block');
      if (waterIdx !== -1) {
        selectSlot(waterIdx);
        if (removeItem('water_block', 1)) {
          obj.cooled = true;
          playSound('unlock');
          spawnBlockParticles(tx, ty, '#00e5ff', '#ffffff');
          updateNetherStatus();
          const bothCooled =
            state.objects['5,4'] && state.objects['5,4'].cooled &&
            state.objects['5,3'] && state.objects['5,3'].cooled;
          if (bothCooled) {
            showToast('🌊 <strong>Die 2-Block-Brücke über die Lava ist fertig!</strong> Laufe jetzt über die Brücke ans Nordufer!', 5500);
          } else {
            showToast('🌊 <strong>Erster Wasserblock eingesetzt (Brücke 1/2)!</strong> Hole rechts unten hinter dem Felsbrocken den <strong>zweiten Wasserblock</strong> für das nächste Feld!', 5500);
          }
        }
      } else {
        playSound('error');
        showToast('💧 <strong>Markiertes Lava-Brückenfeld:</strong> Nimm erst einen der leuchtenden <strong>blauen Wasserblöcke</strong> unten im Raum auf und setze ihn hier ein!');
      }
      return;
    }

    // 15. Room 3: Mineable Glowstone Crystal on North Shore
    if (obj.type === 'mineable_glowstone') {
      if (activeItem.id === 'pickaxe') {
        startMining(tx, ty, 'glowstone');
      } else {
        const pickIdx = state.hotbar.findIndex(s => s && s.id === 'pickaxe');
        if (pickIdx !== -1) {
          selectSlot(pickIdx);
          playSound('pickup');
          showToast('⛏️ <strong>Spitzhacke automatisch ausgewählt!</strong> Drücke noch einmal <kbd>E</kbd> oder Klick, um den Leuchtstein-Kristall abzubauen.');
        } else {
          playSound('error');
          showToast('✨ Zum Abbauen des Leuchtstein-Kristalls brauchst du deine Spitzhacke!');
        }
      }
      return;
    }

    // 16. Room 3: Golden Nether Altar next to Gate
    if (obj.type === 'nether_altar') {
      if (obj.activated) {
        showToast('🔥 Der Goldene Portal-Altar leuchtet bereits – das Nether-Portal-Tor links daneben ist offen!');
        return;
      }
      const dustIdx = state.hotbar.findIndex(s => s && s.id === 'glowstone_dust');
      if (dustIdx !== -1) {
        selectSlot(dustIdx);
        if (removeItem('glowstone_dust', 1)) {
          obj.activated = true;
          state.gateOpen = true;
          playSound('unlock');
          spawnBlockParticles(tx, ty, '#ffdd47', '#52ff38');
          spawnBlockParticles(5, 0, '#52ff38', '#ff9924');
          spawnBlockParticles(6, 0, '#52ff38', '#ff9924');
          updateNetherStatus();
          showToast('🔥 <strong>Goldener Portal-Altar aktiviert!</strong> Das Nether-Portal-Tor im Norden ist offen – laufe hindurch!', 6000);
        }
      } else {
        playSound('error');
        showToast('🔥 <strong>Goldener Portal-Altar:</strong> Baue links am Nordufer den <strong>goldenen Leuchtstein-Kristall</strong> mit der Spitzhacke ab und setze ihn hier ein!');
      }
      return;
    }

    // 17. Room 3: Sign
    if (obj.type === 'sign_room3') {
      playSound('pickup');
      openInfoDialog(
        '🪧 Inschrift der Nether-Wächter',
        `
        <div class="hint-box">
          <h3>So überquerst du den glühenden Lava-Strom:</h3>
          <p><em>„Wasser und Lava formen zusammen eine unzerstörbare Brücke!“</em></p>
          <hr style="margin: 10px 0; border-color: #b5905b;">
          <ul>
            <li>💧 <strong>1. Wasserblock #1:</strong> Nimm links den leuchtenden <strong>blauen Wasserblock</strong> mit <kbd>E</kbd> oder Klick auf und setze ihn in das erste <strong>blau markierte Zielfeld</strong> in der Lava.</li>
            <li>⛏️ <strong>2. Wasserblock #2:</strong> Baue rechts den <strong>rissigen Felsbrocken</strong> mit der Spitzhacke ab, nimm den zweiten <strong>Wasserblock</strong> auf und vervollständige die Brücke!</li>
            <li>✨ <strong>3. Portal-Altar:</strong> Überquere die Brücke, baue oben links den <strong>Leuchtstein-Kristall</strong> mit der Spitzhacke ab und aktiviere rechts den <strong>goldenen Altar</strong>!</li>
            <li>🔍 <em>Geheim-Notiz für Raum 5: Deine Brücke besteht aus genau <strong>2 Wasser-/Obsidian-Brückenblöcken</strong>.</em></li>
          </ul>
        </div>
        `
      );
      return;
    }

    // 18. Room 4: Pushable Amethyst Block (slides safely into target slot y=4 without ever trapping the player!)
    if (obj.type === 'push_amethyst') {
      const pTile = getPlayerTile();
      let ny = ty + obj.dirY;
      // If the player is standing on the intermediate tile (tx, ny), slide the block directly into the target slot (tx, 4)!
      if (pTile.tx === tx && pTile.ty === ny) {
        ny = 4;
      }
      const nextKey = `${tx},${ny}`;
      const nextObj = state.objects[nextKey];

      delete state.objects[key];
      playSound('plate');
      spawnBlockParticles(tx, ny, '#e040fb', '#ffffff');

      if (nextObj && nextObj.type === 'amethyst_slot') {
        nextObj.filled = true;
        playSound('unlock');
        updateAmethystStatus();
        if (!state.gateOpen) {
          showToast('🔮 <strong>Eingerastet!</strong> Der Amethyst-Block steht genau im pinken Zielfeld und leitet den Lichtstrahl weiter!');
        }
      } else {
        state.objects[nextKey] = obj;
        showToast('🔮 <strong>Amethyst-Block verschoben!</strong> Drücke noch einmal <kbd>E</kbd> oder Klick, um ihn bis ins pink markierte Zielfeld zu schieben!');
      }
      return;
    }

    // 19. Room 4: Amethyst Target Slot (4,4 / 5,4 / 6,4)
    if (obj.type === 'amethyst_slot') {
      if (obj.blockedByRock) {
        if (activeItem.id === 'pickaxe') {
          startMining(tx, ty, 'slot_rock');
        } else {
          const pickIdx = state.hotbar.findIndex(s => s && s.id === 'pickaxe');
          if (pickIdx !== -1) {
            selectSlot(pickIdx);
            playSound('pickup');
            showToast('⛏️ <strong>Spitzhacke automatisch ausgewählt!</strong> Drücke erneut <kbd>E</kbd> oder Klick, um den Felsbrocken vom Zielfeld abzubauen.');
          } else {
            playSound('error');
            showToast('🪨 Ein Felsbrocken blockiert dieses Zielfeld! Baue ihn mit der Spitzhacke ab.');
          }
        }
        return;
      }

      if (obj.filled) {
        showToast('🔮 <strong>Amethyst-Resonanzblock:</strong> Sitzt perfekt im Zielfeld und bündelt den pink-lila Lichtstrahl!');
        return;
      }

      const ameIdx = state.hotbar.findIndex(s => s && s.id === 'amethyst_block');
      if (ameIdx !== -1) {
        selectSlot(ameIdx);
        if (removeItem('amethyst_block', 1)) {
          obj.filled = true;
          playSound('unlock');
          spawnBlockParticles(tx, ty, '#ff40fb', '#ffffff');
          updateAmethystStatus();
          if (!state.gateOpen) {
            showToast('🔮 <strong>Amethyst-Block eingesetzt!</strong> Schiebe jetzt noch die übrigen Amethyst-Blöcke in ihre pinken Zielfelder!');
          }
        }
      } else {
        if (tx === 4) {
          showToast('🎯 <strong>Pinkes Zielfeld (Links):</strong> Schiebe den Amethyst-Block unterhalb <code>(4,6)</code> mit <kbd>E</kbd> oder Klick hier hinein!');
        } else if (tx === 5) {
          showToast('🎯 <strong>Pinkes Zielfeld (Mitte):</strong> Schiebe den Amethyst-Block oberhalb <code>(5,2)</code> mit <kbd>E</kbd> oder Klick hier hinein!');
        } else {
          showToast('🎯 <strong>Pinkes Zielfeld (Rechts):</strong> Baue rechts unten die <strong>glitzernde Amethyst-Geode</strong> mit deiner Spitzhacke ab und setze den Block hier ein!');
        }
      }
      return;
    }

    // 20. Room 4: Mineable Amethyst Geode
    if (obj.type === 'mineable_amethyst') {
      if (activeItem.id === 'pickaxe') {
        startMining(tx, ty, 'amethyst');
      } else {
        const pickIdx = state.hotbar.findIndex(s => s && s.id === 'pickaxe');
        if (pickIdx !== -1) {
          selectSlot(pickIdx);
          playSound('pickup');
          showToast('⛏️ <strong>Spitzhacke automatisch ausgewählt!</strong> Drücke erneut <kbd>E</kbd> oder Klick, um die Amethyst-Geode abzubauen.');
        } else {
          playSound('error');
          showToast('🔮 Zum Abbauen der Amethyst-Geode brauchst du deine Spitzhacke!');
        }
      }
      return;
    }

    // 21. Room 4: Dragon Egg Pedestal (Clue for Room 5!)
    if (obj.type === 'dragon_egg') {
      playSound('pickup');
      showToast('🥚 Das legendäre <strong>Drachenei</strong>! In diesem Observatorium ruht genau <strong>1 Drachenei</strong> auf seinem Sockel. (Wichtig fürs Finale!)');
      return;
    }

    // 22. Room 4: Beam Emitter / Receiver
    if (obj.type === 'beam_emitter' || obj.type === 'beam_receiver') {
      playSound('plate');
      showToast('⚡ <strong>Resonanz-Projektor:</strong> Sobald alle 3 pinken Zielfelder in der Mitte mit Amethyst-Blöcken gefüllt sind, verbindet sich der Lichtstrahl!');
      return;
    }

    // 23. Room 4: Sign
    if (obj.type === 'sign_room4') {
      playSound('pickup');
      openInfoDialog(
        '🪧 Sternenkarte des Observatoriums',
        `
        <div class="hint-box">
          <h3>Das Rätsel der Pink-Lila Resonanzlinie:</h3>
          <p><em>„Nur wenn drei Amethyst-Kristalle in einer Reihe stehen, erreicht der Sternenstrahl den Empfänger!“</em></p>
          <hr style="margin: 10px 0; border-color: #b5905b;">
          <ul>
            <li>🔮 <strong>1. Schieben:</strong> Schiebe den unteren Amethyst-Block <code>(4,6)</code> nach oben und den oberen Amethyst-Block <code>(5,2)</code> nach unten in die ersten beiden <strong>pink markierten Zielfelder</strong> (<kbd>E</kbd> / Klick).</li>
            <li>🪨 <strong>2. Freiräumen:</strong> Baue den <strong>rissigen Felsbrocken</strong> auf dem dritten Zielfeld <code>(6,4)</code> mit der <strong>Spitzhacke</strong> ab.</li>
            <li>⛏️ <strong>3. Geode abbauen:</strong> Baue rechts unten die <strong>Amethyst-Geode</strong> <code>(9,6)</code> mit der Spitzhacke ab und setze den gewonnenen Amethyst-Block in das dritte Zielfeld!</li>
            <li>🥚 <em>Geheim-Notiz für Raum 5: Oben rechts ruht genau <strong>1 Drachenei</strong> auf dem Sockel.</em></li>
          </ul>
        </div>
        `
      );
      return;
    }
  }

  // Mining Action System
  function startMining(tx, ty, blockKind) {
    mining.active = true;
    mining.tx = tx;
    mining.ty = ty;
    mining.blockKind = blockKind;
    mining.progress = 0;
    mining.duration = blockKind === 'cobble' ? 0.45 : 0.4;
    playSound('step');
  }

  function completeMining() {
    const { tx, ty, blockKind } = mining;
    const key = `${tx},${ty}`;
    if (blockKind === 'slot_rock') {
      if (state.objects[key]) {
        state.objects[key].blockedByRock = false;
      }
    } else {
      delete state.objects[key];
    }
    mining.active = false;
    mining.progress = 0;
    playSound('mine');

    if (blockKind === 'cobble') {
      spawnBlockParticles(tx, ty, '#8c8c8c', '#5e5e5e');
      if (state.roomNumber === 1) {
        const cobbleSlot = addItem('cobble', 1);
        if (cobbleSlot !== -1) selectSlot(cobbleSlot);
        showToast('⛏️ <strong>Pflasterstein erfolgreich abgebaut!</strong> Er liegt jetzt in deiner Hotbar. Platziere ihn auf einer Druckplatte!');
      } else if (state.roomNumber === 2) {
        updateRedstoneCircuitStatus();
        showToast('⛏️ <strong>Felsbrocken von den Schienen geräumt!</strong> Der Weg für die Lore ist an dieser Stelle frei!');
      } else if (state.roomNumber === 3) {
        showToast('⛏️ <strong>Felsbrocken abgebaut!</strong> Der Weg zum zweiten blauen Wasserblock rechts ist jetzt frei!');
      }
    } else if (blockKind === 'slot_rock') {
      spawnBlockParticles(tx, ty, '#8c8c8c', '#ff40fb');
      showToast('⛏️ <strong>Drittes pinkes Zielfeld freigeräumt!</strong> Baue jetzt rechts unten die <strong>Amethyst-Geode</strong> ab und setze den Block hier ein!');
    } else if (blockKind === 'redstone_ore') {
      spawnBlockParticles(tx, ty, '#ff2424', '#ffadad');
      const rSlot = addItem('redstone', 1);
      if (rSlot !== -1) selectSlot(rSlot);
      showToast('🔴 <strong>Redstone-Erz abgebaut!</strong> Du erhältst <strong>1× Redstone-Staub</strong> (automatisch ausgerüstet)!');
    } else if (blockKind === 'glowstone') {
      spawnBlockParticles(tx, ty, '#ffdd73', '#ffffff');
      const gSlot = addItem('glowstone_dust', 1);
      if (gSlot !== -1) selectSlot(gSlot);
      showToast('✨ <strong>Leuchtstein-Kristall abgebaut!</strong> Du erhältst <strong>1× Leuchtstaub</strong> – lege ihn rechts in den goldenen Portal-Altar!');
    } else if (blockKind === 'amethyst') {
      spawnBlockParticles(tx, ty, '#e040fb', '#ffffff');
      const aSlot = addItem('amethyst_block', 1);
      if (aSlot !== -1) selectSlot(aSlot);
      showToast('🔮 <strong>Amethyst-Geode abgebaut!</strong> Du erhältst <strong>1× Amethyst-Block</strong> – setze ihn in das dritte pinke Zielfeld <code>(6,4)</code>!');
    } else if (blockKind === 'emerald') {
      spawnBlockParticles(tx, ty, '#00e676', '#ffffff');
      const eSlot = addItem('emerald', 1);
      if (eSlot !== -1) selectSlot(eSlot);
      updateVaultStatus();
      showToast('💚 <strong>Meister-Smaragd abgebaut!</strong> Setze ihn jetzt in den grünen Schlüsselsockel rechts neben dem Tresor!');
    } else if (blockKind === 'log') {
      spawnBlockParticles(tx, ty, '#b8945f', '#4a361f');
      addItem('log', 1);
      showToast('🪵 <strong>Eichenstamm abgebaut!</strong> Gehe jetzt zur Werkbank oben rechts, um einen schweren Block zu craften.');
    }
  }

  // Crafting Workbench Modal
  function openWorkbenchDialog() {
    const recipeList = document.getElementById('recipeList');
    const logCount = getItemCount('log');
    const canCraftHeavyWood = logCount >= 2;

    recipeList.innerHTML = `
      <div class="recipe-card">
        <div class="recipe-info">
          <div class="recipe-title">📦 1× Schwerer Eichenblock</div>
          <div class="recipe-cost">Benötigt: <strong>2× Eichenstamm</strong> (Du hast: ${logCount}×)</div>
          <div class="recipe-cost" style="color:#1b4d12;">Perfekt, um eine Stein-Druckplatte dauerhaft zu beschweren!</div>
        </div>
        <button type="button" id="btnCraftHeavyWood" class="mc-btn ${canCraftHeavyWood ? 'mc-btn-primary' : ''}" ${canCraftHeavyWood ? '' : 'disabled style="opacity:0.5;cursor:not-allowed;"'}>
          🛠️ Herstellen
        </button>
      </div>
    `;

    const craftBtn = document.getElementById('btnCraftHeavyWood');
    if (craftBtn && canCraftHeavyWood) {
      craftBtn.addEventListener('click', () => {
        if (removeItem('log', 2)) {
          const newSlot = addItem('heavy_wood', 1);
          if (newSlot !== -1) selectSlot(newSlot);
          playSound('unlock');
          workbenchDialog.close();
          showToast('🛠️ Hergestellt: 1× Schwerer Eichenblock! Platziere ihn jetzt auf der freien Stein-Druckplatte.');
        }
      });
    }

    clearPressedKeys();
    workbenchDialog.showModal();
  }

  function openInfoDialog(title, htmlContent) {
    clearPressedKeys();
    document.getElementById('infoDialogTitle').textContent = title;
    document.getElementById('infoDialogBody').innerHTML = htmlContent;
    infoDialog.showModal();
  }

  function openTutorialDialog() {
    clearPressedKeys();
    // Populate tutorial item icons
    const pairs = [
      { id: 'tutIconCobble', tex: 'item_cobble' },
      { id: 'tutIconLog', tex: 'item_log' },
      { id: 'tutIconChest', tex: 'chest_closed' },
      { id: 'tutIconPlate', tex: 'plate_on' }
    ];
    pairs.forEach(({ id, tex }) => {
      const container = document.getElementById(id);
      if (container && !container.hasChildNodes()) {
        const c = document.createElement('canvas');
        c.width = 16;
        c.height = 16;
        const cCtx = c.getContext('2d');
        cCtx.imageSmoothingEnabled = false;
        cCtx.drawImage(window.MCTextures.get(tex), 0, 0);
        container.appendChild(c);
      }
    });

    tutorialDialog.showModal();
  }

  function triggerRoom1Victory() {
    if (state.roomCompleted) return;
    state.roomCompleted = true;
    playSound('unlock');

    // Mark Room 1 step as solved in HUD & Step 2 as active
    const step1 = document.querySelector('.room-step[data-room="1"]');
    if (step1) {
      step1.classList.remove('active');
      step1.classList.add('solved');
    }
    const step2 = document.querySelector('.room-step[data-room="2"]');
    if (step2) {
      step2.classList.remove('locked');
      step2.classList.add('active');
    }

    openInfoDialog(
      '🏆 Raum 1 gelöst: Der überwucherte Eichenwald!',
      `
      <div class="hint-box">
        <h3>Stark gemacht! Du betrittst Raum 2! 🎉</h3>
        <p>Du hast beide Stein-Druckplatten erfolgreich beschwert und das Nord-Tor durchschritten.</p>
        <hr style="margin: 10px 0; border-color: #b5905b;">
        <p>🔍 <strong>Wichtiger Code-Hinweis für das Finale (Raum 5):</strong><br>
        Im Wald blühten genau <strong>4 blaue Kornblumen</strong>.</p>
        <hr style="margin: 10px 0; border-color: #b5905b;">
        <p>⛏️ <strong>Willkommen in Raum 2: Die tiefe Redstone-Mine!</strong><br>
        Der Weg führt tief in den Berg. Schließe die Redstone-Leitung und stelle die Hebel richtig ein!</p>
      </div>
      `
    );

    // Nahtloser Übergang in Raum 2
    transitionToRoom2();
  }

  function transitionToRoom2() {
    resetRoom(2);
  }

  function triggerRoom2Victory() {
    if (state.roomCompleted) return;
    state.roomCompleted = true;
    playSound('unlock');

    const step2 = document.querySelector('.room-step[data-room="2"]');
    if (step2) {
      step2.classList.remove('active');
      step2.classList.add('solved');
    }
    const step3 = document.querySelector('.room-step[data-room="3"]');
    if (step3) {
      step3.classList.remove('locked');
      step3.classList.add('active');
    }

    openInfoDialog(
      '🏆 Raum 2 gelöst: Die tiefe Redstone-Mine!',
      `
      <div class="hint-box">
        <h3>Stark! Die schwere Eisentür ist überwunden! ⚡🎉</h3>
        <p>Du hast das Minen-Rätsel gelöst (${state.variant === 'A' ? 'Variante A: Erzlore &amp; Antriebsschiene' : 'Variante B: Redstone-Dreh-Schaltkreis'}).</p>
        <hr style="margin: 10px 0; border-color: #b5905b;">
        <p>🔍 <strong>Wichtiger Code-Hinweis für das Finale (Raum 5):</strong><br>
        In dieser Mine funkelten genau <strong>3 Diamanterze</strong>.</p>
        <hr style="margin: 10px 0; border-color: #b5905b;">
        <p>🔥 <strong>Willkommen in Raum 3: Die Nether-Festung!</strong><br>
        Kühle den glühenden Lavastrom mit Wasser zu einer festen Obsidian-Brücke ab!</p>
      </div>
      `
    );

    resetRoom(3);
  }

  function triggerRoom3Victory() {
    if (state.roomCompleted) return;
    state.roomCompleted = true;
    playSound('unlock');

    const step3 = document.querySelector('.room-step[data-room="3"]');
    if (step3) {
      step3.classList.remove('active');
      step3.classList.add('solved');
    }
    const step4 = document.querySelector('.room-step[data-room="4"]');
    if (step4) {
      step4.classList.remove('locked');
      step4.classList.add('active');
    }

    openInfoDialog(
      '🏆 Raum 3 gelöst: Die Nether-Festung!',
      `
      <div class="hint-box">
        <h3>Stark! Du hast das Nether-Portal durchschritten! 🟣🔥</h3>
        <p>Durch die Obsidian-Brücke konntest du den Lavastrom überqueren und den Portal-Altar mit Leuchtstein-Staub erwecken.</p>
        <hr style="margin: 10px 0; border-color: #b5905b;">
        <p>🔍 <strong>Wichtiger Code-Hinweis für das Finale (Raum 5):</strong><br>
        Du hast genau <strong>2 Brückenblöcke</strong> aus Obsidian im Lavastrom erschaffen.</p>
        <hr style="margin: 10px 0; border-color: #b5905b;">
        <p>🔮 <strong>Willkommen in Raum 4: Das Amethyst-Observatorium!</strong><br>
        Richte die pink-lila Amethyst-Resonanzblöcke in einer Reihe aus, um den Laserstrahl zu leiten!</p>
      </div>
      `
    );

    resetRoom(4);
  }

  function triggerRoom4Victory() {
    if (state.roomCompleted) return;
    state.roomCompleted = true;
    playSound('unlock');

    const step4 = document.querySelector('.room-step[data-room="4"]');
    if (step4) {
      step4.classList.remove('active');
      step4.classList.add('solved');
    }
    const step5 = document.querySelector('.room-step[data-room="5"]');
    if (step5) {
      step5.classList.remove('locked');
      step5.classList.add('active');
    }

    openInfoDialog(
      '🏆 Raum 4 gelöst: Das Amethyst-Observatorium!',
      `
      <div class="hint-box">
        <h3>Brillant! Der pink-lila Resonanz-Strahl ist vollendet! 🔮✨</h3>
        <p>Alle 3 Amethyst-Blöcke leiten den Kristallstrahl nun lückenlos vom Sender links zum Empfänger rechts!</p>
        <hr style="margin: 10px 0; border-color: #b5905b;">
        <p>🔍 <strong>Wichtiger Code-Hinweis für das Finale (Raum 5):</strong><br>
        Im Observatorium ruhte genau <strong>1 legendäres Drachenei</strong>.</p>
        <hr style="margin: 10px 0; border-color: #b5905b;">
        <p>👑 <strong>Alle 4 Hinweise gesammelt:</strong><br>
        🌲 Wald: <strong>4</strong> Kornblumen · ⛏️ Mine: <strong>3</strong> Diamanten · 🔥 Nether: <strong>2</strong> Brückenblöcke · 🔮 End: <strong>1</strong> Drachenei!</p>
        <hr style="margin: 10px 0; border-color: #b5905b;">
        <p>👑 <strong>Willkommen im Finale – Raum 5: Die antike Schatzkammer!</strong><br>
        Nutze deine gesammelten Hinweise, um den königlichen Tresor zu knacken!</p>
      </div>
      `
    );

    resetRoom(5);
  }

  function triggerRoom5Victory() {
    if (state.roomCompleted) return;
    state.roomCompleted = true;
    playSound('unlock');

    const step5 = document.querySelector('.room-step[data-room="5"]');
    if (step5) {
      step5.classList.remove('active');
      step5.classList.add('solved');
    }

    // Goldenes Konfetti-Feuerwerk
    for (let i = 0; i < 6; i++) {
      spawnBlockParticles(2 + i * 1.5, 1 + (i % 3), '#ffd700', '#00e676');
    }

    openInfoDialog(
      '👑 GESCHAFFT! Du bist aus MineEscape 2D entkommen!',
      `
      <div class="hint-box">
        <h3>🏆 Der Schatz der Könige gehört dir! 🎉💎</h3>
        <p>Du hast alle <strong>5 Biome</strong> gemeistert und den königlichen Tresor mit dem Code <strong>4 - 3 - 2 - 1</strong> geknackt!</p>
        <p>Du durchschreitest das Tor und erreichst die blühende Sonnenwiese in Freiheit!</p>
      </div>
      `
    );

    // Starte die Blumenwiese mit Luftballons & Konfetti!
    startMeadowCelebration();
  }

  function startMeadowCelebration() {
    meadowEnding = true;
    document.getElementById('roomSubtitle').textContent = '🎉 FREIHEIT! Die sonnige Blumenwiese';
    document.getElementById('objectiveText').innerHTML =
      '🎉 <strong>Herzlichen Glückwunsch, du hast das Rätsel gelöst!</strong> Genieße deinen Triumph auf der Blumenwiese!';
    document.getElementById('plateStatus').innerHTML =
      'Status: <span style="color:#52ff38;">🏆 Alle 5 Räume gemeistert!</span>';

    // Positioniere die Spielfigur in der Wiesenmitte
    state.player.x = 6.0 * TILE_SIZE;
    state.player.y = 5.5 * TILE_SIZE;
    state.player.dir = 'down';

    // Erzeuge aufsteigende bunte Luftballons
    balloons = [];
    const balloonColors = ['#ff3b30', '#ff9500', '#ffcc00', '#4cd964', '#5ac8fa', '#007aff', '#af52de', '#ff2d55'];
    for (let i = 0; i < 28; i++) {
      balloons.push({
        x: Math.random() * (canvas.width - 40) + 20,
        y: canvas.height + Math.random() * 300,
        vy: 55 + Math.random() * 65,
        swaySpeed: 1.5 + Math.random() * 2,
        swayAmp: 12 + Math.random() * 16,
        color: balloonColors[Math.floor(Math.random() * balloonColors.length)],
        size: 14 + Math.random() * 8,
        time: Math.random() * 10
      });
    }

    // Erstes Konfetti-Gewitter
    for (let i = 0; i < 150; i++) {
      spawnConfetti();
    }
  }

  function spawnConfetti() {
    const confettiColors = ['#ffd700', '#ff4081', '#00e676', '#00e5ff', '#ffeb3b', '#7c4dff', '#ff6d00'];
    particles.push({
      x: Math.random() * canvas.width,
      y: -10 - Math.random() * 100,
      vx: (Math.random() - 0.5) * 80,
      vy: 80 + Math.random() * 120,
      size: 4 + Math.floor(Math.random() * 5),
      color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
      life: 4.5 + Math.random() * 2.5
    });
  }

  // Input Handling (Keyboard + Mouse + D-Pad)
  window.addEventListener('keydown', (e) => {
    if (workbenchDialog.open || infoDialog.open || (tutorialDialog && tutorialDialog.open)) return;

    const k = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'e', '1', '2', '3', '4', '5'].includes(k)) {
      e.preventDefault();
    }

    keys[k] = true;

    if (k === ' ' || k === 'e') {
      const target = getFacingTile();
      interactWithTile(target.tx, target.ty);
    } else if (k >= '1' && k <= '5') {
      selectSlot(parseInt(k, 10) - 1);
    }
  });

  window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
  });

  // D-Pad & Action Buttons
  const dirMap = {
    up: 'w',
    down: 's',
    left: 'a',
    right: 'd'
  };

  document.querySelectorAll('.dpad-btn').forEach((btn) => {
    const dir = btn.getAttribute('data-dir');
    const keyName = dirMap[dir];
    const startMove = (e) => {
      e.preventDefault();
      keys[keyName] = true;
    };
    const stopMove = () => {
      keys[keyName] = false;
    };
    btn.addEventListener('mousedown', startMove);
    btn.addEventListener('mouseup', stopMove);
    btn.addEventListener('mouseleave', stopMove);
    btn.addEventListener('touchstart', startMove, { passive: false });
    btn.addEventListener('touchend', stopMove);
  });

  document.getElementById('btnAction').addEventListener('click', () => {
    const target = getFacingTile();
    interactWithTile(target.tx, target.ty);
  });

  // Canvas Click: Interact with clicked tile if adjacent (or face towards it)
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;
    const tx = Math.floor(cx / TILE_SIZE);
    const ty = Math.floor(cy / TILE_SIZE);

    const pTile = getPlayerTile();
    const dist = Math.abs(tx - pTile.tx) + Math.abs(ty - pTile.ty);

    // Update facing direction toward click
    const dx = tx - pTile.tx;
    const dy = ty - pTile.ty;
    if (Math.abs(dx) > Math.abs(dy)) {
      state.player.dir = dx > 0 ? 'right' : 'left';
    } else if (dy !== 0) {
      state.player.dir = dy > 0 ? 'down' : 'up';
    }

    if (dist <= 1) {
      interactWithTile(tx, ty);
    } else {
      showToast('Laufe näher an den Block heran (mit WASD / Pfeiltasten), um mit ihm zu interagieren!');
    }
  });

  // Top HUD Room Step Clicks (Jump directly between Rooms 1–4!)
  document.querySelectorAll('.room-step').forEach((stepEl) => {
    stepEl.addEventListener('click', () => {
      const r = parseInt(stepEl.getAttribute('data-room'), 10);
      if (r >= 1 && r <= 5) {
        resetRoom(r);
      }
    });
  });

  // Switch between Room 2 Variant A and Variant B
  const btnSwitchVariant = document.getElementById('btnSwitchRoom2Variant');
  if (btnSwitchVariant) {
    btnSwitchVariant.addEventListener('click', () => {
      room2Variant = room2Variant === 'A' ? 'B' : 'A';
      playSound('unlock');
      resetRoom(2);
    });
  }

  // Top HUD Buttons
  const btnSelectHero = document.getElementById('btnSelectHero');
  if (btnSelectHero) {
    btnSelectHero.addEventListener('click', () => {
      openHeroDialog();
    });
  }

  // Hero Card Click Listener
  document.querySelectorAll('.hero-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      const hId = card.getAttribute('data-hero');
      setHero(hId);
    });
  });

  document.querySelectorAll('.btn-choose-hero').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const hId = btn.getAttribute('data-hero');
      setHero(hId);
      heroDialog.close();
    });
  });

  const btnTutorial = document.getElementById('btnTutorial');
  if (btnTutorial) {
    btnTutorial.addEventListener('click', () => {
      openTutorialDialog();
    });
  }

  document.getElementById('btnHint').addEventListener('click', () => {
    if (state.roomNumber === 1) {
      openInfoDialog(
        '📖 Tagebuch des Abenteurers – Raum 1 Tipps',
        `
        <div class="hint-box">
          <h3>🌲 Raum 1: Der überwucherte Eichenwald</h3>
          <p><strong>Ziel:</strong> Beide Stein-Druckplatten vor dem Nord-Tor müssen gleichzeitig mit einem schweren Block belegt sein.</p>
          <hr style="margin: 10px 0; border-color: #b5905b;">
          <ul>
            <li><strong>Schritt 1:</strong> Öffne die <strong>Truhe</strong> oben links. Du bekommst eine <strong>Holzspitzhacke</strong>.</li>
            <li><strong>Schritt 2:</strong> Baue den <strong>rissigen Pflasterstein</strong> rechts ab. Du erhältst <strong>1× Pflasterstein-Block</strong>!</li>
            <li><strong>Schritt 3:</strong> Sammle unten rechts den <strong>Eichenstamm</strong> ein und crafte an der <strong>Werkbank</strong> einen <strong>Schweren Eichenblock</strong>.</li>
            <li><strong>Schritt 4:</strong> Platziere je einen schweren Block auf den beiden <strong>Stein-Druckplatten</strong>.</li>
          </ul>
        </div>
        `
      );
    } else if (state.roomNumber === 2) {
      if (state.variant === 'A') {
        openInfoDialog(
          '📖 Tagebuch – Raum 2 (Variante A: Lore & Bergbau)',
          `
          <div class="hint-box">
            <h3>🛒 Raum 2 (Variante A): Die Erzlore ins Ziel bringen</h3>
            <p><strong>Ziel:</strong> Die Lore links muss ungebremst bis auf die <strong>Sensorschiene</strong> ganz rechts rollen!</p>
            <hr style="margin: 10px 0; border-color: #b5905b;">
            <ul>
              <li><strong>Schritt 1 (Gleis räumen):</strong> Baue den <strong>rissigen Felsbrocken</strong> mitten auf den Schienen <code>(4,4)</code> mit deiner <strong>Spitzhacke</strong> ab.</li>
              <li><strong>Schritt 2 (Goldschiene aufladen):</strong> Baue oben links das <strong>glühende Redstone-Erz</strong> <code>(2,2)</code> mit der Spitzhacke ab und lege den gewonnenen <strong>Redstone-Staub</strong> in die rote Fassung <code>(7,3)</code> über der Goldschiene.</li>
              <li><strong>Schritt 3 (Schranke öffnen):</strong> Lege rechts unten den <strong>Hebel</strong> <code>(9,5)</code> um, damit die Schranke aufgeht.</li>
              <li><strong>Schritt 4 (Lore anstoßen):</strong> Laufe nach links zur <strong>Lore</strong> <code>(1,4)</code> und drücke <kbd>E</kbd> oder klicke darauf!</li>
            </ul>
          </div>
          `
        );
      } else {
        openInfoDialog(
          '📖 Tagebuch – Raum 2 (Variante B: Dreh-Schaltkreis)',
          `
          <div class="hint-box">
            <h3>🔌 Raum 2 (Variante B): Redstone-Dreh-Gitter</h3>
            <p><strong>Ziel:</strong> Leite den Strom vom roten Generator unten <code>(5,6)</code> lückenlos bis zur Eisentür <code>(5,0)</code>!</p>
            <hr style="margin: 10px 0; border-color: #b5905b;">
            <ul>
              <li><strong>Schritt 1:</strong> Baue links das <strong>glühende Redstone-Erz</strong> <code>(2,4)</code> mit der Spitzhacke ab.</li>
              <li><strong>Schritt 2:</strong> Setze den Redstone-Staub in die <strong>fehlende Lücke</strong> <code>(5,3)</code> in der Mitte ein.</li>
              <li><strong>Schritt 3:</strong> Drehe die Kabelstücke mit <kbd>E</kbd> oder Klick, bis alle Segmente <strong>hellrot aufleuchten</strong> und die Tür aufspringt!</li>
            </ul>
          </div>
          `
        );
      }
    } else if (state.roomNumber === 3) {
      openInfoDialog(
        '📖 Tagebuch – Raum 3 (Die Nether-Festung)',
        `
        <div class="hint-box">
          <h3>🔥 Raum 3: Die Nether-Festung</h3>
          <p><strong>Ziel:</strong> Überquere den Lavastrom über eine 2-Block-Obsidian-Brücke und erwecke den goldenen Portal-Altar im Norden!</p>
          <hr style="margin: 10px 0; border-color: #b5905b;">
          <ul>
            <li><strong>Schritt 1 (Erster Wasserblock):</strong> Nimm unten links den <strong>blauen Wasserblock</strong> <code>(2,6)</code> mit <kbd>E</kbd> auf und setze ihn in das erste türkis markierte Brücken-Feld <code>(5,4)</code> in der Lava.</li>
            <li><strong>Schritt 2 (Zweiter Wasserblock):</strong> Baue rechts unten den <strong>rissigen Felsbrocken</strong> <code>(8,6)</code> mit der <strong>Spitzhacke</strong> ab, nimm den zweiten Wasserblock <code>(10,6)</code> auf und kühle das zweite Brücken-Feld <code>(5,3)</code>!</li>
            <li><strong>Schritt 3 (Leuchtstein &amp; Altar):</strong> Laufe über die Obsidian-Brücke ans Nordufer, baue links den <strong>Leuchtstein-Kristall</strong> <code>(3,1)</code> mit der Spitzhacke ab und setze ihn rechts in den <strong>Portal-Altar</strong> <code>(7,1)</code> ein!</li>
          </ul>
        </div>
        `
      );
    } else if (state.roomNumber === 4) {
      openInfoDialog(
        '📖 Tagebuch – Raum 4 (Das Amethyst-Observatorium)',
        `
        <div class="hint-box">
          <h3>🔮 Raum 4: Das Amethyst-Observatorium</h3>
          <p><strong>Ziel:</strong> Leite den pink-lila Resonanz-Laser vom Sender links <code>(2,4)</code> durch alle 3 Zielfelder zum Empfänger rechts <code>(8,4)</code>!</p>
          <hr style="margin: 10px 0; border-color: #b5905b;">
          <ul>
            <li><strong>Schritt 1 (Schieben):</strong> Schiebe den unteren Amethyst-Block <code>(4,6)</code> nach oben und den oberen Amethyst-Block <code>(5,2)</code> nach unten in die pink markierten Zielfelder <code>(4,4)</code> und <code>(5,4)</code> (<kbd>E</kbd> / Klick).</li>
            <li><strong>Schritt 2 (Drittes Zielfeld freiräumen):</strong> Baue den <strong>rissigen Felsbrocken</strong> auf dem dritten Zielfeld <code>(6,4)</code> mit deiner <strong>Spitzhacke</strong> ab.</li>
            <li><strong>Schritt 3 (Geode abbauen &amp; einsetzen):</strong> Baue rechts unten die <strong>Amethyst-Geode</strong> <code>(9,6)</code> mit der Spitzhacke ab und setze den gewonnenen Amethyst-Block in <code>(6,4)</code> ein!</li>
          </ul>
        </div>
        `
      );
    } else if (state.roomNumber === 5) {
      openInfoDialog(
        '📖 Tagebuch – Raum 5 (Die antike Schatzkammer)',
        `
        <div class="hint-box">
          <h3>👑 Raum 5: Die antike Schatzkammer</h3>
          <p><strong>Ziel:</strong> Knacke den 4-stelligen Code und öffne den königlichen Tresor im Norden!</p>
          <hr style="margin: 10px 0; border-color: #b5905b;">
          <ul>
            <li><strong>Schritt 1 (Code):</strong> Jede goldene Säule gehört zu einem Raum (🌼 Wald, 💎 Mine, 🌉 Nether, 🥚 End). Erinnere dich an die gezählten Dinge und stelle die Ziffern mit <kbd>E</kbd> ein.</li>
            <li><strong>Schritt 2 (Smaragd):</strong> Ist der Code richtig, erlischt das Kraftfeld oben rechts. Baue den <strong>Meister-Smaragd</strong> <code>(10,1)</code> mit der Spitzhacke ab.</li>
            <li><strong>Schritt 3 (Tresor):</strong> Setze den Smaragd in den grünen Sockel <code>(7,1)</code> neben dem Tresor ein und laufe hindurch!</li>
          </ul>
          <details style="margin-top:8px;"><summary>🔑 Lösung anzeigen</summary><p>Der Code lautet <strong>4 - 3 - 2 - 1</strong>.</p></details>
        </div>
        `
      );
    }
  });

  document.getElementById('btnRestart').addEventListener('click', () => {
    resetRoom(state ? state.roomNumber : 1);
  });

  document.getElementById('btnSound').addEventListener('click', (e) => {
    soundEnabled = !soundEnabled;
    const btn = e.currentTarget;
    btn.setAttribute('aria-pressed', String(soundEnabled));
    btn.textContent = soundEnabled ? '🔊 Ton' : '🔇 Stumm';
  });

  // Movement & Collision Update
  let stepTimer = 0;

  function update(dt) {
    if (!state) return;

    resolvePlayerStuck();

    const p = state.player;
    let vx = 0;
    let vy = 0;

    if (keys['w'] || keys['arrowup']) {
      vy -= 1;
      p.dir = 'up';
    }
    if (keys['s'] || keys['arrowdown']) {
      vy += 1;
      p.dir = 'down';
    }
    if (keys['a'] || keys['arrowleft']) {
      vx -= 1;
      p.dir = 'left';
    }
    if (keys['d'] || keys['arrowright']) {
      vx += 1;
      p.dir = 'right';
    }

    if (vx !== 0 && vy !== 0) {
      const inv = 1 / Math.sqrt(2);
      vx *= inv;
      vy *= inv;
    }

    p.isMoving = vx !== 0 || vy !== 0;

    if (p.isMoving) {
      p.walkFrame += dt * 10;
      stepTimer += dt;
      if (stepTimer > 0.28) {
        stepTimer = 0;
        playSound('step');
      }

      const nextX = p.x + vx * p.speed * dt;
      const nextY = p.y + vy * p.speed * dt;

      if (!checkCircleCollision(nextX, p.y, p.radius)) {
        p.x = nextX;
      } else if (vy === 0) {
        // Corner sliding assist when walking horizontally into narrow 1-tile passages
        const tileCenterY = Math.floor(p.y / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
        const diffY = tileCenterY - p.y;
        if (Math.abs(diffY) > 1 && Math.abs(diffY) < 26) {
          const slideY = p.y + Math.sign(diffY) * Math.min(Math.abs(diffY), p.speed * dt * 0.85);
          if (!checkCircleCollision(p.x, slideY, p.radius)) p.y = slideY;
        }
      }

      if (!checkCircleCollision(p.x, nextY, p.radius)) {
        p.y = nextY;
      } else if (vx === 0) {
        // Corner sliding assist when walking vertically onto narrow 1-tile bridges (like Room 3 Obsidian bridge)
        const tileCenterX = Math.floor(p.x / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
        const diffX = tileCenterX - p.x;
        if (Math.abs(diffX) > 1 && Math.abs(diffX) < 26) {
          const slideX = p.x + Math.sign(diffX) * Math.min(Math.abs(diffX), p.speed * dt * 0.85);
          if (!checkCircleCollision(slideX, p.y, p.radius)) p.x = slideX;
        }
      }

      // Check if player walked into the open North Gate
      const pTile = getPlayerTile();
      if (state.gateOpen && pTile.ty === 0 && (pTile.tx === 5 || pTile.tx === 6)) {
        if (state.roomNumber === 1) {
          triggerRoom1Victory();
        } else if (state.roomNumber === 2) {
          triggerRoom2Victory();
        } else if (state.roomNumber === 3) {
          triggerRoom3Victory();
        } else if (state.roomNumber === 4) {
          triggerRoom4Victory();
        } else if (state.roomNumber === 5) {
          triggerRoom5Victory();
        }
      }

      updatePlateStatus();
      updateContextPrompt();
    }

    // Update Minecart animation in Room 2 Variant A
    if (state.roomNumber === 2 && state.variant === 'A' && state.cart && state.cart.moving) {
      const cart = state.cart;
      if (!cart.returning) {
        const speed = cart.x >= 6.5 && state.objects['7,3'] && state.objects['7,3'].filled ? 7.5 : 4.5;
        cart.x += speed * dt;
        if (Math.random() < 0.4) {
          spawnBlockParticles(cart.x, cart.y, '#ffd700', '#ff5252');
        }
        if (cart.x >= cart.stopX) {
          cart.x = cart.stopX;
          if (!cart.failReason) {
            // Reached Detector Rail (10,4)!
            cart.moving = false;
            cart.arrived = true;
            if (state.objects['10,4']) state.objects['10,4'].triggered = true;
            state.gateOpen = true;
            playSound('unlock');
            spawnBlockParticles(10, 4, '#52ff38', '#ffd700');
            updateRedstoneCircuitStatus();
            showToast('🎉 <strong>Volltreffer!</strong> Die Lore hat die Sensorschiene ausgelöst – die Eisentür im Norden ist offen!', 6000);
          } else {
            // Hit obstacle -> bounce back!
            playSound('error');
            spawnBlockParticles(cart.x, cart.y, '#ff5252', '#aaaaaa');
            showToast(cart.failReason, 5500);
            cart.returning = true;
          }
        }
      } else {
        cart.x -= 5.0 * dt;
        if (cart.x <= 1) {
          cart.x = 1;
          cart.moving = false;
          cart.returning = false;
        }
      }
    }

    // Update mining animation progress
    if (mining.active) {
      mining.progress += dt / mining.duration;
      if (Math.random() < 0.3) {
        spawnBlockParticles(mining.tx, mining.ty, '#ffd54f', '#ffffff');
      }
      if (mining.progress >= 1) {
        completeMining();
      }
    }

    // Update particles (Confetti etc.)
    for (let i = particles.length - 1; i >= 0; i--) {
      const pt = particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) {
        particles.splice(i, 1);
      }
    }

    // Update Balloons & Confetti Rain in Meadow Ending
    if (meadowEnding) {
      if (Math.random() < 0.25) {
        spawnConfetti();
      }
      for (let i = 0; i < balloons.length; i++) {
        const b = balloons[i];
        b.time += dt;
        b.y -= b.vy * dt;
        b.x += Math.sin(b.time * b.swaySpeed) * 0.7;
        if (b.y < -60) {
          b.y = canvas.height + 40;
          b.x = Math.random() * (canvas.width - 40) + 20;
        }
      }
    }
  }

  // Befreit die Spielfigur, falls ein Block (z. B. ein eingesetzter Amethyst, eine Lore
  // oder ein geschobener Block) direkt in ihre Hitbox gesetzt wurde. Ohne diese Korrektur
  // würde jede Bewegung blockiert, weil die Figur bereits mit einem festen Feld überlappt.
  function resolvePlayerStuck() {
    const p = state.player;
    if (!checkCircleCollision(p.x, p.y, p.radius)) return;
    const baseX = Math.floor(p.x / TILE_SIZE);
    const baseY = Math.floor(p.y / TILE_SIZE);
    let best = null;
    let bestDist = Infinity;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const tx = baseX + dx;
        const ty = baseY + dy;
        if (isTileSolid(tx, ty)) continue;
        const cx = (tx + 0.5) * TILE_SIZE;
        const cy = (ty + 0.5) * TILE_SIZE;
        if (checkCircleCollision(cx, cy, p.radius)) continue;
        const d = (cx - p.x) ** 2 + (cy - p.y) ** 2;
        if (d < bestDist) {
          bestDist = d;
          best = [cx, cy];
        }
      }
    }
    if (best) {
      p.x = best[0];
      p.y = best[1];
    }
  }

  function checkCircleCollision(cx, cy, r) {
    const points = [
      [cx - r, cy - r],
      [cx + r, cy - r],
      [cx - r, cy + r],
      [cx + r, cy + r]
    ];
    for (const [px, py] of points) {
      const tx = Math.floor(px / TILE_SIZE);
      const ty = Math.floor(py / TILE_SIZE);
      if (isTileSolid(tx, ty)) return true;
    }
    return false;
  }

  function updateContextPrompt() {
    if (toastTimeout) return;
    const target = getFacingTile();
    const obj = state.objects[`${target.tx},${target.ty}`];
    const base = (target.ty >= 0 && target.ty < ROWS && target.tx >= 0 && target.tx < COLS)
      ? state.grid[target.ty][target.tx]
      : null;

    const promptEl = document.getElementById('interactionPrompt');

    // Check Minecart in front of player
    if (state.roomNumber === 2 && state.variant === 'A' && state.cart) {
      if (Math.round(state.cart.x) === target.tx && state.cart.y === target.ty) {
        promptEl.innerHTML = state.cart.arrived
          ? '🛒 <strong>Erzlore (Am Ziel)</strong> – Die Eisentür ist offen!'
          : '🛒 <strong>Schwere Erzlore</strong> – Drücke <kbd>E</kbd> oder Klick, um die Lore anzustoßen!';
        return;
      }
    }

    if (base === 'D' && state.roomNumber === 1) {
      promptEl.innerHTML = state.gateOpen
        ? '🚪 <strong>Nord-Tor (Offen)</strong> – Laufe hindurch oder drücke <kbd>E</kbd>!'
        : '🔒 <strong>Nord-Tor (Verschlossen)</strong> – Beide Stein-Druckplatten müssen beschwert sein.';
    } else if (base === 'I') {
      promptEl.innerHTML = state.gateOpen
        ? '🚪 <strong>Eisentür (Offen)</strong> – Laufe hindurch oder drücke <kbd>E</kbd>!'
        : '🔒 <strong>Eisentür (Verriegelt)</strong> – Löse das Minen-Rätsel, um sie zu öffnen.';
    } else if (base === 'U' && state.roomNumber === 3) {
      promptEl.innerHTML = state.gateOpen
        ? '🟣 <strong>Nether-Portal (Aktiv)</strong> – Laufe hindurch oder drücke <kbd>E</kbd>!'
        : '🔒 <strong>Nether-Portal (Inaktiv)</strong> – Erwecke den goldenen Portal-Altar im Norden!';
    } else if (base === 'Z' && state.roomNumber === 4) {
      promptEl.innerHTML = state.gateOpen
        ? '🔮 <strong>End-Portal (Aktiv)</strong> – Laufe hindurch oder drücke <kbd>E</kbd>!'
        : '🔒 <strong>End-Portal (Versiegelt)</strong> – Leite den Amethyst-Resonanz-Laser in den Empfänger!';
    } else if (base === 'O' && state.roomNumber === 2) {
      promptEl.innerHTML = '💎 <strong>Diamanterz</strong> – <kbd>E</kbd> zum Untersuchen (Hinweis für Raum 5!)';
    } else if (base === 'V' && state.roomNumber === 5) {
      promptEl.innerHTML = state.gateOpen
        ? '👑 <strong>Königlicher Tresor (Offen)</strong> – Laufe hindurch zum Schatz!'
        : '🔒 <strong>Königlicher Tresor (Versiegelt)</strong> – Code knacken &amp; Smaragd einsetzen!';
    } else if (obj && state.roomNumber === 5 && obj.type === 'code_dial') {
      const info = ROOM5_DIAL_INFO[obj.index];
      promptEl.innerHTML = `${info.icon} <strong>Code-Säule ${obj.index + 1}</strong> (${info.label}) zeigt <strong>${obj.value}</strong> – <kbd>E</kbd> zum Erhöhen`;
    } else if (obj && state.roomNumber === 5 && obj.type === 'mineable_emerald') {
      promptEl.innerHTML = obj.locked
        ? '🛡️ <strong>Meister-Smaragd (Kraftfeld aktiv)</strong> – Löse zuerst den Code!'
        : '💚 <strong>Meister-Smaragd</strong> – Mit <strong>Spitzhacke</strong> (<kbd>E</kbd> / Klick) abbauen!';
    } else if (obj && state.roomNumber === 5 && obj.type === 'vault_socket') {
      promptEl.innerHTML = obj.filled
        ? '💚 <strong>Smaragd-Sockel (Aktiv)</strong> – Der Tresor ist offen!'
        : '💚 <strong>Smaragd-Schlüsselsockel</strong> – Meister-Smaragd einsetzen (<kbd>E</kbd>)!';
    } else if (obj && state.roomNumber === 5 && obj.type === 'sign_room5') {
      promptEl.innerHTML = '🪧 <strong>Inschrift des Schatzmeisters</strong> – Drücke <kbd>E</kbd> oder Klick!';
    } else if (obj) {
      if (obj.type === 'chest') {
        promptEl.innerHTML = obj.opened
          ? '📦 <strong>Holztruhe</strong> (Bereits geplündert)'
          : '📦 <strong>Holztruhe</strong> – Drücke <kbd>E</kbd> oder Klick zum Öffnen!';
      } else if (obj.type === 'water_source') {
        promptEl.innerHTML = obj.taken
          ? '💧 <strong>Leerer Wasser-Sockel</strong>'
          : '💧 <strong>Wasserblock</strong> – Drücke <kbd>E</kbd> oder Klick zum Aufnehmen!';
      } else if (obj.type === 'lava_bridge') {
        promptEl.innerHTML = obj.cooled
          ? '🟣 <strong>Obsidian-Brückenblock</strong> – Fester Übergang über die Lava!'
          : '🌊 <strong>Brücken-Bauplatz in der Lava</strong> – Wasserblock auswählen &amp; <kbd>E</kbd> drücken!';
      } else if (obj.type === 'mineable_glowstone') {
        promptEl.innerHTML = '✨ <strong>Leuchtstein-Kristall</strong> – Mit <strong>Spitzhacke</strong> (<kbd>E</kbd> / Klick) abbauen!';
      } else if (obj.type === 'nether_altar') {
        promptEl.innerHTML = obj.activated
          ? '🔥 <strong>Portal-Altar (Erweckt)</strong> – Das Nether-Portal im Norden ist offen!'
          : '✨ <strong>Goldener Portal-Altar</strong> – Leuchtstein-Staub auswählen &amp; <kbd>E</kbd> drücken!';
      } else if (obj.type === 'push_amethyst') {
        promptEl.innerHTML = '🔮 <strong>Amethyst-Resonanzblock</strong> – Drücke <kbd>E</kbd> oder Klick zum Verschieben!';
      } else if (obj.type === 'mineable_amethyst') {
        promptEl.innerHTML = '🔮 <strong>Amethyst-Geode</strong> – Mit <strong>Spitzhacke</strong> (<kbd>E</kbd> / Klick) abbauen!';
      } else if (obj.type === 'amethyst_slot') {
        promptEl.innerHTML = obj.blockedByRock
          ? '🪨 <strong>Blockiertes Resonanz-Feld</strong> – Felsbrocken mit <strong>Spitzhacke</strong> (<kbd>E</kbd> / Klick) abbauen!'
          : obj.filled
            ? '🔮 <strong>Amethyst-Resonanzblock (Im Strahlengang)</strong>'
            : '✨ <strong>Leeres Resonanz-Feld</strong> – Amethyst-Block hineinschieben oder aus Hotbar einsetzen (<kbd>E</kbd>)!';
      } else if (obj.type === 'dragon_egg') {
        promptEl.innerHTML = '🥚 <strong>Drachenei</strong> – <kbd>E</kbd> zum Untersuchen (Hinweis für Raum 5!)';
      } else if (obj.type === 'beam_emitter') {
        promptEl.innerHTML = '🔮 <strong>Resonanz-Sender</strong> – Sendet einen pink-lila Kristallstrahl nach rechts!';
      } else if (obj.type === 'beam_receiver') {
        promptEl.innerHTML = state.gateOpen
          ? '✨ <strong>Resonanz-Empfänger (Aktiv!)</strong> – Das End-Portal ist offen!'
          : '🎯 <strong>Resonanz-Empfänger (Wartet auf Strahl)</strong> – Fülle alle 3 Resonanz-Felder!';
      } else if (obj.type === 'sign_room3' || obj.type === 'sign_room4') {
        promptEl.innerHTML = '🪧 <strong>Inschrift lesen</strong> – Drücke <kbd>E</kbd> oder Klick!';
      } else if (obj.type === 'mineable_redstone_ore') {
        promptEl.innerHTML = '🔴 <strong>Glühendes Redstone-Erz</strong> – Mit <strong>Spitzhacke</strong> (<kbd>E</kbd> / Klick) abbauen!';
      } else if (obj.type === 'powered_rail') {
        const powered = state.objects['7,3'] && state.objects['7,3'].filled;
        promptEl.innerHTML = powered
          ? '⚡ <strong>Gold-Antriebsschiene (Geladen)</strong> – Bereit für die Lore!'
          : '🔌 <strong>Gold-Antriebsschiene (Stromlos)</strong> – Lege Redstone in die Fassung darüber!';
      } else if (obj.type === 'detector_rail') {
        promptEl.innerHTML = '🎯 <strong>Sensorschiene</strong> – Ziel für die Erzlore!';
      } else if (obj.type === 'wire_slot') {
        promptEl.innerHTML = obj.filled
          ? '⚡ <strong>Redstone-Fassung (Aktiv)</strong> – <kbd>E</kbd> zum Aufnehmen'
          : '🔌 <strong>Leere Redstone-Fassung</strong> – Redstone-Staub einsetzen (<kbd>E</kbd> / Klick)!';
      } else if (obj.type === 'rot_wire_missing') {
        promptEl.innerHTML = '🔌 <strong>Fehlendes Kabelstück</strong> – Redstone-Staub einsetzen (<kbd>E</kbd> / Klick)!';
      } else if (obj.type === 'rot_wire') {
        promptEl.innerHTML = '🔄 <strong>Drehbares Redstone-Kabel</strong> – Drücke <kbd>E</kbd> oder Klick zum Drehen (90°)!';
      } else if (obj.type === 'generator') {
        promptEl.innerHTML = '🔋 <strong>Redstone-Generator</strong> – Stromquelle für den Schaltkreis';
      } else if (obj.type === 'lever') {
        promptEl.innerHTML = obj.state
          ? '🕹️ <strong>Schranken-Hebel: [OFFEN]</strong> – <kbd>E</kbd> zum Umschalten'
          : '🕹️ <strong>Schranken-Hebel: [GESPERRT]</strong> – Drücke <kbd>E</kbd> zum Öffnen der Schranke!';
      } else if (obj.type === 'sign_room2') {
        promptEl.innerHTML = '🪧 <strong>Schild lesen</strong> – Drücke <kbd>E</kbd> oder Klick!';
      } else if (obj.type === 'loose_cobble') {
        promptEl.innerHTML = '🪨 <strong>Rissiger Felsbrocken</strong> – Mit <strong>Spitzhacke</strong> (<kbd>E</kbd> / Klick) abbauen!';
      } else if (obj.type === 'loose_log') {
        promptEl.innerHTML = '🪵 <strong>Loser Eichenstamm</strong> – Drücke <kbd>E</kbd> oder Klick zum Abbauen!';
      } else if (obj.type === 'workbench') {
        promptEl.innerHTML = '🛠️ <strong>Werkbank</strong> – Drücke <kbd>E</kbd> oder Klick zum Craften!';
      } else if (obj.type === 'sign') {
        promptEl.innerHTML = '🪧 <strong>Holzschild</strong> – Drücke <kbd>E</kbd> oder Klick zum Lesen!';
      } else if (obj.type === 'plate') {
        promptEl.innerHTML = obj.placedItem
          ? `⚖️ <strong>Stein-Druckplatte (Belegt)</strong> – <kbd>E</kbd> zum Aufheben`
          : '⚖️ <strong>Stein-Druckplatte</strong> – Schweren Block auswählen &amp; <kbd>E</kbd> drücken!';
      }
    } else if (base === 'L' && state.roomNumber === 3) {
      promptEl.innerHTML = '🌋 <strong>Glühender Lavastrom</strong> – Unpassierbar! Nutze Wasserblöcke an der türkis markierten Engstelle.';
    } else if (base === 'F' && state.roomNumber === 1) {
      promptEl.innerHTML = '🌼 <strong>Blaue Kornblume</strong> – <kbd>E</kbd> zum Untersuchen';
    } else {
      promptEl.innerHTML = 'Laufe mit <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> · Interagieren mit <kbd>E</kbd> / <kbd>Leertaste</kbd> oder <kbd>Klick</kbd>';
    }
  }

  // Rendering
  function render() {
    if (!state) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Wenn Meadow Ending aktiv ist: Zeichne die sonnige Festwiese mit Blumen & Himmel
    if (meadowEnding) {
      renderMeadowScene();
      return;
    }

    // 1. Draw Base Grid
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const code = state.grid[y][x];
        let texName = 'grass';
        if (state.roomNumber === 1) {
          if (code === 'T') texName = 'tree_wall';
          else if (code === 'M') texName = 'mossy_wall';
          else if (code === 'P') texName = 'path';
          else if (code === 'W') texName = 'planks';
          else if (code === 'F') texName = 'flower_blue';
          else if (code === 'D') texName = state.gateOpen ? 'door_open' : 'door_locked';
        } else if (state.roomNumber === 2) {
          if (code === 'B') texName = 'deepslate_wall';
          else if (code === 'F') texName = 'deepslate_floor';
          else if (code === 'H') texName = 'rails_h';
          else if (code === 'R') texName = 'rails';
          else if (code === 'O') texName = 'diamond_ore';
          else if (code === 'E') texName = 'redstone_ore';
          else if (code === 'I') texName = state.gateOpen ? 'iron_door_open' : 'iron_door_locked';
        } else if (state.roomNumber === 3) {
          if (code === 'N') texName = 'nether_wall';
          else if (code === 'K') texName = 'nether_floor';
          else if (code === 'L') texName = 'lava';
          else if (code === 'G') texName = 'glowstone';
          else if (code === 'U') texName = state.gateOpen ? 'nether_door_open' : 'nether_door_locked';
        } else if (state.roomNumber === 4) {
          if (code === 'P') texName = 'purpur_wall';
          else if (code === 'S') texName = 'end_floor';
          else if (code === 'Z') texName = state.gateOpen ? 'end_door_open' : 'end_door_locked';
        } else if (state.roomNumber === 5) {
          if (code === 'W') texName = 'gold_wall';
          else if (code === 'Q') texName = 'quartz_floor';
          else if (code === 'E') texName = 'emerald_pillar';
          else if (code === 'V') texName = state.gateOpen ? 'vault_door_open' : 'vault_door_locked';
        }

        ctx.drawImage(
          window.MCTextures.get(texName),
          x * TILE_SIZE,
          y * TILE_SIZE,
          TILE_SIZE,
          TILE_SIZE
        );

        // Subtle pixel grid border on floor tiles
        const isWallTile =
          (state.roomNumber === 1 && (code === 'T' || code === 'M')) ||
          (state.roomNumber === 2 && (code === 'B' || code === 'O' || code === 'E')) ||
          (state.roomNumber === 3 && (code === 'N' || code === 'G')) ||
          (state.roomNumber === 4 && code === 'P') ||
          (state.roomNumber === 5 && (code === 'W' || code === 'E'));
        if (!isWallTile) {
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
      }
    }

    // 2. Draw Floor Wiring
    if (state.roomNumber === 1) {
      drawPlateWiring(4, 2, 5, 1, isPlateActive(4, 2));
      drawPlateWiring(7, 2, 6, 1, isPlateActive(7, 2));
    } else if (state.roomNumber === 2) {
      drawRoom2RedstoneCircuits();
    } else if (state.roomNumber === 3) {
      drawPlateWiring(7, 1, 6, 1, state.gateOpen);
    } else if (state.roomNumber === 4) {
      drawPlateWiring(8, 4, 6, 1, state.gateOpen);
    } else if (state.roomNumber === 5) {
      drawPlateWiring(7, 1, 6, 1, state.gateOpen);
    }

    // 3. Draw Interactive Objects
    for (const [key, obj] of Object.entries(state.objects)) {
      const [tx, ty] = key.split(',').map(Number);
      const px = tx * TILE_SIZE;
      const py = ty * TILE_SIZE;

      if (obj.type === 'code_dial') {
        drawCodeDial(px, py, obj);
      } else if (obj.type === 'mineable_emerald') {
        ctx.drawImage(window.MCTextures.get('mineable_emerald'), px, py, TILE_SIZE, TILE_SIZE);
        if (obj.locked) {
          const pulse = 0.35 + 0.2 * Math.sin(performance.now() / 250);
          ctx.save();
          ctx.fillStyle = `rgba(80, 220, 255, ${pulse})`;
          ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
          ctx.strokeStyle = '#b3f5ff';
          ctx.lineWidth = 3;
          ctx.strokeRect(px + 3, py + 3, TILE_SIZE - 6, TILE_SIZE - 6);
          ctx.restore();
        }
      } else if (obj.type === 'vault_socket') {
        ctx.drawImage(
          window.MCTextures.get(obj.filled ? 'vault_socket_on' : 'vault_socket_off'),
          px,
          py,
          TILE_SIZE,
          TILE_SIZE
        );
      } else if (obj.type === 'sign_room5') {
        ctx.drawImage(window.MCTextures.get('sign'), px, py, TILE_SIZE, TILE_SIZE);
      } else if (obj.type === 'chest') {
        const tex = obj.opened ? 'chest_open' : 'chest_closed';
        ctx.drawImage(window.MCTextures.get(tex), px, py, TILE_SIZE, TILE_SIZE);
      } else if (obj.type === 'water_source') {
        const tex = obj.taken ? 'water_pad_empty' : 'water_block';
        ctx.drawImage(window.MCTextures.get(tex), px, py, TILE_SIZE, TILE_SIZE);
      } else if (obj.type === 'lava_bridge') {
        const tex = obj.cooled ? 'obsidian' : 'lava_bridge_slot';
        ctx.drawImage(window.MCTextures.get(tex), px, py, TILE_SIZE, TILE_SIZE);
      } else if (obj.type === 'mineable_glowstone') {
        ctx.drawImage(window.MCTextures.get('mineable_glowstone'), px, py, TILE_SIZE, TILE_SIZE);
      } else if (obj.type === 'nether_altar') {
        ctx.drawImage(
          window.MCTextures.get(obj.activated ? 'nether_altar_on' : 'nether_altar_off'),
          px,
          py,
          TILE_SIZE,
          TILE_SIZE
        );
      } else if (obj.type === 'amethyst_slot') {
        ctx.drawImage(window.MCTextures.get('amethyst_slot'), px, py, TILE_SIZE, TILE_SIZE);
        if (obj.blockedByRock) {
          ctx.drawImage(window.MCTextures.get('loose_cobble'), px, py, TILE_SIZE, TILE_SIZE);
        } else if (obj.filled) {
          ctx.drawImage(window.MCTextures.get('amethyst_block'), px, py, TILE_SIZE, TILE_SIZE);
        }
      } else if (obj.type === 'push_amethyst') {
        ctx.drawImage(window.MCTextures.get('amethyst_block'), px, py, TILE_SIZE, TILE_SIZE);
      } else if (obj.type === 'mineable_amethyst') {
        ctx.drawImage(window.MCTextures.get('mineable_amethyst'), px, py, TILE_SIZE, TILE_SIZE);
      } else if (obj.type === 'dragon_egg') {
        ctx.drawImage(window.MCTextures.get('dragon_egg'), px, py, TILE_SIZE, TILE_SIZE);
      } else if (obj.type === 'beam_emitter' || obj.type === 'beam_receiver') {
        ctx.drawImage(window.MCTextures.get('beam_emitter'), px, py, TILE_SIZE, TILE_SIZE);
      } else if (obj.type === 'sign_room3' || obj.type === 'sign_room4') {
        ctx.drawImage(window.MCTextures.get('sign'), px, py, TILE_SIZE, TILE_SIZE);
      } else if (obj.type === 'mineable_redstone_ore') {
        ctx.drawImage(window.MCTextures.get('mineable_redstone_ore'), px, py, TILE_SIZE, TILE_SIZE);
      } else if (obj.type === 'powered_rail') {
        const powered = state.objects['7,3'] && state.objects['7,3'].filled;
        ctx.drawImage(
          window.MCTextures.get(powered ? 'powered_rail_on' : 'powered_rail_off'),
          px,
          py,
          TILE_SIZE,
          TILE_SIZE
        );
      } else if (obj.type === 'detector_rail') {
        ctx.drawImage(
          window.MCTextures.get(obj.triggered ? 'detector_rail_on' : 'detector_rail_off'),
          px,
          py,
          TILE_SIZE,
          TILE_SIZE
        );
      } else if (obj.type === 'wire_slot') {
        const wireTex = obj.filled ? 'redstone_wire_on' : 'wire_slot_empty';
        ctx.drawImage(window.MCTextures.get(wireTex), px, py, TILE_SIZE, TILE_SIZE);
      } else if (obj.type === 'rot_wire_missing') {
        ctx.drawImage(window.MCTextures.get('wire_slot_empty'), px, py, TILE_SIZE, TILE_SIZE);
      } else if (obj.type === 'rot_wire') {
        drawRotatableWireTile(px, py, obj.shape, obj.rot, obj.powered);
      } else if (obj.type === 'generator') {
        ctx.drawImage(window.MCTextures.get('redstone_generator'), px, py, TILE_SIZE, TILE_SIZE);
      } else if (obj.type === 'lever') {
        const leverTex = obj.state ? 'lever_on' : 'lever_off';
        ctx.drawImage(window.MCTextures.get(leverTex), px, py, TILE_SIZE, TILE_SIZE);
      } else if (obj.type === 'sign_room2' || obj.type === 'sign') {
        ctx.drawImage(window.MCTextures.get('sign'), px, py, TILE_SIZE, TILE_SIZE);
      } else if (obj.type === 'loose_cobble') {
        ctx.drawImage(window.MCTextures.get('loose_cobble'), px, py, TILE_SIZE, TILE_SIZE);
      } else if (obj.type === 'loose_log') {
        ctx.drawImage(window.MCTextures.get('loose_log'), px, py, TILE_SIZE, TILE_SIZE);
      } else if (obj.type === 'workbench') {
        ctx.drawImage(window.MCTextures.get('workbench'), px, py, TILE_SIZE, TILE_SIZE);
      } else if (obj.type === 'plate') {
        const active = isPlateActive(tx, ty);
        ctx.drawImage(
          window.MCTextures.get(active ? 'plate_on' : 'plate_off'),
          px,
          py,
          TILE_SIZE,
          TILE_SIZE
        );
        if (obj.placedItem) {
          const itemDef = ITEM_DEFS[obj.placedItem];
          ctx.drawImage(
            window.MCTextures.get(itemDef.texture),
            px + 10,
            py + 10,
            TILE_SIZE - 20,
            TILE_SIZE - 20
          );
        }
      }
    }

    // 3a. Draw Track Barrier & Minecart in Room 2 Variant A
    if (state.roomNumber === 2 && state.variant === 'A') {
      const leverOpen = state.objects['9,5'] && state.objects['9,5'].state;
      const bx = 9 * TILE_SIZE;
      const by = 4 * TILE_SIZE;
      ctx.save();
      if (!leverOpen) {
        // Draw closed red/iron barrier bar across track at (9,4)
        ctx.fillStyle = '#222';
        ctx.fillRect(bx + 24, by + 6, 16, TILE_SIZE - 12);
        ctx.fillStyle = '#ff3838';
        ctx.fillRect(bx + 27, by + 10, 10, 18);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(bx + 27, by + 28, 10, 10);
        ctx.fillStyle = '#ff3838';
        ctx.fillRect(bx + 27, by + 38, 10, 16);
      } else {
        // Open barrier indicator on sides
        ctx.fillStyle = '#52ff38';
        ctx.fillRect(bx + 26, by + 2, 12, 6);
        ctx.fillRect(bx + 26, by + TILE_SIZE - 8, 12, 6);
      }
      ctx.restore();

      if (state.cart) {
        ctx.drawImage(
          window.MCTextures.get('minecart_push'),
          state.cart.x * TILE_SIZE,
          state.cart.y * TILE_SIZE - 4,
          TILE_SIZE,
          TILE_SIZE
        );
      }
    }

    // 3a-2. Draw Pink-Purple Amethyst Laser Beam in Room 4
    if (state.roomNumber === 4) {
      let beamEndTileX = 3; // Stops before (4,4) unless filled
      if (state.objects['4,4'] && state.objects['4,4'].filled) {
        beamEndTileX = 4;
        if (state.objects['5,4'] && state.objects['5,4'].filled) {
          beamEndTileX = 5;
          if (state.objects['6,4'] && state.objects['6,4'].filled) {
            beamEndTileX = 8; // Reaches receiver at (8,4)!
          }
        }
      }
      const startX = 2.75 * TILE_SIZE;
      const endX = (beamEndTileX + 0.35) * TILE_SIZE;
      const beamY = 4.5 * TILE_SIZE;

      ctx.save();
      ctx.strokeStyle = 'rgba(255, 85, 255, 0.35)';
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(startX, beamY);
      ctx.lineTo(endX, beamY);
      ctx.stroke();

      ctx.strokeStyle = '#ff55ff';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(startX, beamY);
      ctx.lineTo(endX, beamY);
      ctx.stroke();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(startX, beamY);
      ctx.lineTo(endX, beamY);
      ctx.stroke();
      ctx.restore();
    }

    // 3b. Draw Mining Cracks & Progress Bar if mining
    if (mining.active) {
      const mx = mining.tx * TILE_SIZE;
      const my = mining.ty * TILE_SIZE;
      ctx.save();
      ctx.fillStyle = `rgba(0, 0, 0, ${0.15 + mining.progress * 0.45})`;
      ctx.fillRect(mx, my, TILE_SIZE, TILE_SIZE);

      ctx.strokeStyle = '#ffff55';
      ctx.lineWidth = 3;
      ctx.strokeRect(mx + 3, my + 3, TILE_SIZE - 6, TILE_SIZE - 6);

      ctx.fillStyle = '#222';
      ctx.fillRect(mx + 6, my - 12, TILE_SIZE - 12, 8);
      ctx.fillStyle = '#4cd137';
      ctx.fillRect(mx + 8, my - 10, (TILE_SIZE - 16) * Math.min(mining.progress, 1), 4);
      ctx.restore();
    }

    // 4. Draw Target Selection Wireframe Box (Tile in front of player)
    const target = getFacingTile();
    if (target.tx >= 0 && target.tx < COLS && target.ty >= 0 && target.ty < ROWS) {
      const isCartTile =
        state.roomNumber === 2 &&
        state.variant === 'A' &&
        state.cart &&
        Math.round(state.cart.x) === target.tx &&
        state.cart.y === target.ty;

      const codeAtTarget = state.grid[target.ty][target.tx];
      const hasInteractable =
        isCartTile ||
        state.objects[`${target.tx},${target.ty}`] ||
        (codeAtTarget === 'D' && state.roomNumber === 1) ||
        (codeAtTarget === 'F' && state.roomNumber === 1) ||
        (codeAtTarget === 'O' && state.roomNumber === 2) ||
        (codeAtTarget === 'I' && state.roomNumber === 2) ||
        (codeAtTarget === 'U' && state.roomNumber === 3) ||
        (codeAtTarget === 'Z' && state.roomNumber === 4) ||
        (codeAtTarget === 'V' && state.roomNumber === 5);

      ctx.save();
      ctx.strokeStyle = hasInteractable ? 'rgba(255, 235, 100, 0.9)' : 'rgba(255, 255, 255, 0.28)';
      ctx.lineWidth = hasInteractable ? 3 : 2;
      ctx.strokeRect(
        target.tx * TILE_SIZE + 2,
        target.ty * TILE_SIZE + 2,
        TILE_SIZE - 4,
        TILE_SIZE - 4
      );
      ctx.restore();
    }

    // 5. Draw Player (Top-Down Minecraft Character)
    drawPlayer(state.player);

    // 6. Draw Particles
    for (const pt of particles) {
      ctx.fillStyle = pt.color;
      ctx.fillRect(Math.round(pt.x), Math.round(pt.y), pt.size, pt.size);
    }
  }

  function renderMeadowScene() {
    // 1. Himmel mit Sonnenstrahlen
    const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.45);
    skyGrad.addColorStop(0, '#4fc3f7');
    skyGrad.addColorStop(1, '#e1f5fe');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height * 0.45);

    // Große leuchtende Sonne oben rechts
    ctx.fillStyle = '#fff59d';
    ctx.beginPath();
    ctx.arc(canvas.width - 90, 80, 52, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffeb3b';
    ctx.beginPath();
    ctx.arc(canvas.width - 90, 80, 42, 0, Math.PI * 2);
    ctx.fill();

    // Wolken
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    [
      [120, 70, 40], [160, 60, 50], [200, 70, 40],
      [420, 100, 35], [455, 90, 45], [490, 100, 35]
    ].forEach(([cx, cy, r]) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    });

    // 2. Grüne Blumenwiese (Pixel-Gras)
    for (let y = 3; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        ctx.drawImage(window.MCTextures.get('grass'), x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        // Bunte Blumen auf der Wiese verteilen
        if ((x + y * 3) % 4 === 0) {
          ctx.drawImage(window.MCTextures.get('flower_blue'), x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
      }
    }

    // Burg-Tor im Hintergrund (Ausgang aus der Festung)
    ctx.drawImage(window.MCTextures.get('mossy_wall'), 5 * TILE_SIZE, 3 * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    ctx.drawImage(window.MCTextures.get('door_open'), 5.5 * TILE_SIZE, 3 * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    ctx.drawImage(window.MCTextures.get('mossy_wall'), 6.5 * TILE_SIZE, 3 * TILE_SIZE, TILE_SIZE, TILE_SIZE);

    // 3. Spielfigur auf der Wiese
    drawPlayer(state.player);

    // 4. Aufsteigende Luftballons mit Schnur
    for (const b of balloons) {
      ctx.save();
      // Schnur
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y + b.size);
      ctx.quadraticCurveTo(b.x + 4, b.y + b.size + 15, b.x - 2, b.y + b.size + 30);
      ctx.stroke();

      // Ballon-Körper (Oval)
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, b.size * 0.82, b.size, 0, 0, Math.PI * 2);
      ctx.fill();

      // Glanzpunkt
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.beginPath();
      ctx.arc(b.x - b.size * 0.3, b.y - b.size * 0.3, b.size * 0.22, 0, Math.PI * 2);
      ctx.fill();

      // Knoten
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x - 2, b.y + b.size - 1, 4, 3);
      ctx.restore();
    }

    // 5. Konfetti
    for (const pt of particles) {
      ctx.fillStyle = pt.color;
      ctx.fillRect(Math.round(pt.x), Math.round(pt.y), pt.size, pt.size);
    }

    // 6. Großes goldenes Siegesbanner
    ctx.save();
    const bannerW = 680;
    const bannerH = 74;
    const bannerX = (canvas.width - bannerW) / 2;
    const bannerY = 32;

    ctx.fillStyle = 'rgba(20, 22, 28, 0.88)';
    ctx.fillRect(bannerX, bannerY, bannerW, bannerH);
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 4;
    ctx.strokeRect(bannerX, bannerY, bannerW, bannerH);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px "Courier New", Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🎉 Herzlichen Glückwunsch, du hast das Rätsel gelöst! 🎉', canvas.width / 2, bannerY + 26);

    ctx.fillStyle = '#69f0ae';
    ctx.font = 'bold 15px "Courier New", Consolas, monospace';
    ctx.fillText('Du bist durch das Schlosstor auf die Sonnenwiese entkommen!', canvas.width / 2, bannerY + 52);
    ctx.restore();
  }

  function drawCodeDial(px, py, obj) {
    ctx.drawImage(window.MCTextures.get('code_pedestal'), px, py, TILE_SIZE, TILE_SIZE);
    const correct = state.codeSolved;
    ctx.save();
    // Digit display
    ctx.fillStyle = correct ? '#0f3d1a' : '#1a1206';
    ctx.fillRect(px + 14, py + 18, TILE_SIZE - 28, TILE_SIZE - 26);
    ctx.fillStyle = correct ? '#52ff38' : '#ffd700';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(obj.value), px + TILE_SIZE / 2, py + TILE_SIZE / 2 + 6);
    // Room symbol above
    ctx.font = '14px sans-serif';
    ctx.fillText(ROOM5_DIAL_INFO[obj.index].icon, px + TILE_SIZE / 2, py + 10);
    ctx.restore();
  }

  function drawPlateWiring(plateX, plateY, gateX, gateY, active) {
    ctx.save();
    ctx.strokeStyle = active ? '#52ff38' : '#4a3b2c';
    ctx.lineWidth = 4;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo((plateX + 0.5) * TILE_SIZE, plateY * TILE_SIZE + 8);
    ctx.lineTo((plateX + 0.5) * TILE_SIZE, (gateY + 0.5) * TILE_SIZE);
    ctx.lineTo((gateX + 0.5) * TILE_SIZE, (gateY + 0.5) * TILE_SIZE);
    ctx.lineTo((gateX + 0.5) * TILE_SIZE, gateY * TILE_SIZE);
    ctx.stroke();
    ctx.restore();
  }

  function drawRotatableWireTile(px, py, shape, rot, powered) {
    ctx.save();
    // Subtle stone base plate so player sees it's a rotatable conduit block
    ctx.fillStyle = 'rgba(85, 85, 98, 0.65)';
    ctx.fillRect(px + 6, py + 6, TILE_SIZE - 12, TILE_SIZE - 12);
    ctx.strokeStyle = powered ? '#ff5252' : '#555562';
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 6, py + 6, TILE_SIZE - 12, TILE_SIZE - 12);

    const dirs = getWireDirs(shape, rot);
    const cx = px + TILE_SIZE / 2;
    const cy = py + TILE_SIZE / 2;

    // Outer glow if powered
    if (powered) {
      ctx.strokeStyle = 'rgba(255, 40, 40, 0.4)';
      ctx.lineWidth = 18;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (const d of dirs) {
        const [dx, dy] = DIR_DELTA[d];
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + dx * (TILE_SIZE / 2), cy + dy * (TILE_SIZE / 2));
      }
      ctx.stroke();
    }

    // Core Redstone line
    ctx.strokeStyle = powered ? '#ff2b2b' : '#631515';
    ctx.lineWidth = 10;
    ctx.lineCap = 'square';
    ctx.beginPath();
    for (const d of dirs) {
      const [dx, dy] = DIR_DELTA[d];
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + dx * (TILE_SIZE / 2 - 2), cy + dy * (TILE_SIZE / 2 - 2));
    }
    ctx.stroke();

    // Center pivot node
    ctx.fillStyle = powered ? '#ffbaba' : '#8f3434';
    ctx.fillRect(cx - 5, cy - 5, 10, 10);
    ctx.restore();
  }

  function drawRoom2RedstoneCircuits() {
    if (state.variant === 'A') {
      // Draw dashed Redstone wire from Detector Rail (10,4) up to Iron Door (6,0)
      drawPlateWiring(10, 4, 6, 1, state.gateOpen);
    }
  }

  function drawPlayer(p) {
    ctx.save();
    ctx.translate(Math.round(p.x), Math.round(p.y));

    // Rotate according to facing direction
    let angle = 0;
    if (p.dir === 'up') angle = 0;
    else if (p.dir === 'right') angle = Math.PI / 2;
    else if (p.dir === 'down') angle = Math.PI;
    else if (p.dir === 'left') angle = -Math.PI / 2;
    ctx.rotate(angle);

    const swing = p.isMoving ? Math.sin(p.walkFrame) * 4 : 0;
    const hero = HERO_DEFS[currentHero] || HERO_DEFS.steve;

    // Drop shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(-18, -14, 36, 32);

    // Left & Right Shoulders / Arms (Hero Shirt Color)
    ctx.fillStyle = hero.shirt;
    ctx.fillRect(-20, -8 + swing, 8, 16);
    ctx.fillRect(12, -8 - swing, 8, 16);

    // Hands (Hero Skin Tone)
    ctx.fillStyle = hero.skin;
    ctx.fillRect(-19, -12 + swing, 6, 6);
    ctx.fillRect(13, -12 - swing, 6, 6);

    // Held Item in Right Hand
    const activeItem = getSelectedItem();
    if (activeItem && activeItem.id !== 'hand') {
      ctx.drawImage(
        window.MCTextures.get(activeItem.texture),
        8,
        -26 - swing,
        20,
        20
      );
    }

    // Head Outline
    ctx.fillStyle = '#24180e';
    ctx.fillRect(-13, -13, 26, 26);

    // Face / Skin front
    ctx.fillStyle = hero.skin;
    ctx.fillRect(-11, -11, 22, 22);

    // Hair
    ctx.fillStyle = hero.hair;
    ctx.fillRect(-11, -5, 22, 16);
    ctx.fillRect(-11, -11, 4, 8);
    ctx.fillRect(7, -11, 4, 8);

    // Eyes
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-7, -11, 4, 3);
    ctx.fillRect(3, -11, 4, 3);
    ctx.fillStyle = hero.eyes;
    ctx.fillRect(-5, -11, 2, 3);
    ctx.fillRect(3, -11, 2, 3);

    ctx.restore();
  }

  function renderHeroPreviews() {
    ['steve', 'alex', 'mage'].forEach((hId) => {
      const container = document.getElementById(hId === 'steve' ? 'previewSteve' : (hId === 'alex' ? 'previewAlex' : 'previewMage'));
      if (!container || container.hasChildNodes()) return;
      const c = document.createElement('canvas');
      c.width = 48;
      c.height = 48;
      const pCtx = c.getContext('2d');
      pCtx.imageSmoothingEnabled = false;

      const hero = HERO_DEFS[hId];
      // Face
      pCtx.fillStyle = '#24180e';
      pCtx.fillRect(8, 8, 32, 32);
      pCtx.fillStyle = hero.skin;
      pCtx.fillRect(10, 10, 28, 28);
      // Hair
      pCtx.fillStyle = hero.hair;
      pCtx.fillRect(10, 10, 28, 12);
      pCtx.fillRect(10, 10, 6, 18);
      pCtx.fillRect(32, 10, 6, 18);
      // Eyes
      pCtx.fillStyle = '#ffffff';
      pCtx.fillRect(14, 22, 6, 4);
      pCtx.fillRect(28, 22, 6, 4);
      pCtx.fillStyle = hero.eyes;
      pCtx.fillRect(17, 22, 3, 4);
      pCtx.fillRect(28, 22, 3, 4);

      container.appendChild(c);
    });
  }

  function setHero(hId) {
    if (!HERO_DEFS[hId]) return;
    currentHero = hId;
    playSound('pickup');
    document.querySelectorAll('.hero-card').forEach((card) => {
      card.classList.toggle('active', card.getAttribute('data-hero') === hId);
    });
    showToast(`👤 Du spielst jetzt als <strong>${HERO_DEFS[hId].name}</strong>!`, 3000);
  }

  function openHeroDialog() {
    clearPressedKeys();
    renderHeroPreviews();
    document.querySelectorAll('.hero-card').forEach((card) => {
      card.classList.toggle('active', card.getAttribute('data-hero') === currentHero);
    });
    heroDialog.showModal();
  }

  // Main Loop
  let lastTime = performance.now();
  function loop(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  // Initialize Game
  resetRoom();
  // Zeige die Charakter-Auswahl direkt beim Spielstart
  setTimeout(() => {
    openHeroDialog();
  }, 150);
  requestAnimationFrame(loop);
})();

