// Procedural 16x16 Minecraft-Style Pixel Art Texture Generator
window.MCTextures = (function () {
  const cache = {};

  function createCanvas(w = 16, h = 16) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  // Deterministic pseudo-random for consistent pixel textures
  function seededRandom(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function () {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  function drawPixelGrid(ctx, palette, seed = 42) {
    const rand = seededRandom(seed);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const idx = Math.floor(rand() * palette.length);
        ctx.fillStyle = palette[idx];
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  function buildTextures() {
    // 1. Grass Block
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      drawPixelGrid(ctx, ['#4b8b2b', '#559932', '#437d26', '#5ca338', '#4f912e'], 101);
      cache.grass = c;
    }

    // 2. Dirt Path (Trampelpfad)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      drawPixelGrid(ctx, ['#9c784c', '#8e6b41', '#a88457', '#7f5e36'], 202);
      cache.path = c;
    }

    // 3. Oak Planks Floor
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      const colors = ['#a2824e', '#b08f58', '#967644', '#ab8a53'];
      const rand = seededRandom(303);
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
          ctx.fillRect(x, y, 1, 1);
        }
      }
      // Plank seams
      ctx.fillStyle = '#6f552e';
      for (let y of [3, 7, 11, 15]) {
        ctx.fillRect(0, y, 16, 1);
      }
      ctx.fillRect(7, 0, 1, 3);
      ctx.fillRect(12, 4, 1, 3);
      ctx.fillRect(4, 8, 1, 3);
      ctx.fillRect(10, 12, 1, 3);
      cache.planks = c;
    }

    // 4. Forest Wall (Dense Oak Tree Canopy / Trunk border)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      drawPixelGrid(ctx, ['#255217', '#2e631d', '#1c4011', '#387524', '#1f4714'], 404);
      // Add dark border & leaf highlights
      ctx.strokeStyle = '#15300c';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, 15, 15);
      ctx.fillStyle = '#4c9434';
      ctx.fillRect(3, 3, 2, 2);
      ctx.fillRect(10, 4, 2, 2);
      ctx.fillRect(5, 10, 2, 2);
      ctx.fillRect(11, 11, 2, 2);
      cache.tree_wall = c;
    }

    // 5. Solid Stone / Mossy Wall
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      drawPixelGrid(ctx, ['#686868', '#757575', '#585858', '#4d6b3c', '#5b7d47'], 505);
      ctx.strokeStyle = '#3b3b3b';
      ctx.strokeRect(0.5, 0.5, 15, 15);
      ctx.fillStyle = '#474747';
      ctx.fillRect(0, 7, 16, 1);
      ctx.fillRect(8, 0, 1, 7);
      ctx.fillRect(4, 8, 1, 8);
      cache.mossy_wall = c;
    }

    // 6. Loose Cracked Cobblestone (Mineable with Wooden Pickaxe!)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      drawPixelGrid(ctx, ['#7a7a7a', '#8c8c8c', '#696969', '#999999', '#5e5e5e'], 606);
      // Cobble outlines
      ctx.strokeStyle = '#3d3d3d';
      ctx.strokeRect(0.5, 0.5, 15, 15);
      // Cracks to signal "break me with a pickaxe!"
      ctx.fillStyle = '#222222';
      const cracks = [
        [4, 3], [5, 4], [6, 5], [7, 5], [8, 6], [9, 7], [10, 8], [11, 9],
        [9, 5], [10, 4], [6, 7], [5, 8], [4, 9], [7, 10], [8, 11]
      ];
      cracks.forEach(([x, y]) => ctx.fillRect(x, y, 1, 1));
      cache.loose_cobble = c;
    }

    // 7. Loose Oak Log (Collectible / Chop-able wood block)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      ctx.drawImage(cache.grass, 0, 0);
      // Outer bark ring
      ctx.fillStyle = '#4a361f';
      ctx.fillRect(2, 2, 12, 12);
      // Inner wood rings
      ctx.fillStyle = '#b8945f';
      ctx.fillRect(3, 3, 10, 10);
      ctx.fillStyle = '#8f6f40';
      ctx.fillRect(5, 5, 6, 6);
      ctx.fillStyle = '#cca972';
      ctx.fillRect(6, 6, 4, 4);
      ctx.fillStyle = '#6e522b';
      ctx.fillRect(7, 7, 2, 2);
      cache.loose_log = c;
    }

    // 8. Pressure Plate OFF
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      ctx.drawImage(cache.planks, 0, 0);
      // Shadow
      ctx.fillStyle = '#332716';
      ctx.fillRect(3, 4, 11, 10);
      // Raised stone plate
      ctx.fillStyle = '#969696';
      ctx.fillRect(2, 2, 12, 11);
      ctx.fillStyle = '#b5b5b5';
      ctx.fillRect(3, 3, 10, 2);
      // Red unpressed status dot in center
      ctx.fillStyle = '#b02e26';
      ctx.fillRect(7, 6, 2, 2);
      cache.plate_off = c;
    }

    // 9. Pressure Plate ON (Activated!)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      ctx.drawImage(cache.planks, 0, 0);
      // Glowing green rim
      ctx.fillStyle = '#52e038';
      ctx.fillRect(1, 1, 14, 14);
      // Pressed stone plate
      ctx.fillStyle = '#7d7d7d';
      ctx.fillRect(2, 2, 12, 12);
      // Bright green center light
      ctx.fillStyle = '#68ff47';
      ctx.fillRect(6, 6, 4, 4);
      cache.plate_on = c;
    }

    // 10. Chest Closed
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      ctx.drawImage(cache.planks, 0, 0);
      ctx.fillStyle = '#1f160b';
      ctx.fillRect(1, 2, 14, 12);
      ctx.fillStyle = '#a86728';
      ctx.fillRect(2, 3, 12, 10);
      ctx.fillStyle = '#c47c35';
      ctx.fillRect(3, 3, 10, 4);
      // Seam
      ctx.fillStyle = '#291b0c';
      ctx.fillRect(2, 7, 12, 1);
      // Gold latch
      ctx.fillStyle = '#ffd83d';
      ctx.fillRect(7, 6, 2, 3);
      cache.chest_closed = c;
    }

    // 11. Chest Open
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      ctx.drawImage(cache.planks, 0, 0);
      ctx.fillStyle = '#1f160b';
      ctx.fillRect(1, 2, 14, 12);
      // Dark interior
      ctx.fillStyle = '#2b1b0e';
      ctx.fillRect(2, 4, 12, 5);
      // Lower body
      ctx.fillStyle = '#96591f';
      ctx.fillRect(2, 9, 12, 4);
      ctx.fillStyle = '#ffd83d';
      ctx.fillRect(7, 8, 2, 2);
      cache.chest_open = c;
    }

    // 12. Crafting Table (Werkbank)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#472e16';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#9c6334';
      ctx.fillRect(1, 1, 14, 14);
      ctx.fillStyle = '#c28349';
      ctx.fillRect(2, 2, 12, 12);
      // 3x3 crafting grid lines
      ctx.fillStyle = '#5c381b';
      for (let p of [3, 6, 9, 12]) {
        ctx.fillRect(3, p, 10, 1);
        ctx.fillRect(p, 3, 1, 10);
      }
      cache.workbench = c;
    }

    // 13. Sign (Holzschild mit Hinweis)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      ctx.drawImage(cache.grass, 0, 0);
      // Post
      ctx.fillStyle = '#5c4326';
      ctx.fillRect(7, 9, 2, 5);
      // Board
      ctx.fillStyle = '#473219';
      ctx.fillRect(2, 3, 12, 7);
      ctx.fillStyle = '#b5905b';
      ctx.fillRect(3, 4, 10, 5);
      // Text lines
      ctx.fillStyle = '#2e1f0f';
      ctx.fillRect(4, 5, 8, 1);
      ctx.fillRect(4, 7, 6, 1);
      cache.sign = c;
    }

    // 14. Blue Cornflower on Grass (Hinweis-Element für späteres Finale!)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      ctx.drawImage(cache.grass, 0, 0);
      // Stem
      ctx.fillStyle = '#296318';
      ctx.fillRect(7, 8, 2, 5);
      // Blue petals
      ctx.fillStyle = '#3b6fe0';
      ctx.fillRect(6, 5, 4, 4);
      ctx.fillStyle = '#6c9bff';
      ctx.fillRect(5, 6, 6, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(7, 6, 2, 2);
      cache.flower_blue = c;
    }

    // 15. Locked Gate (Nord-Tor)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#2b2b2b';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#6e4f2d';
      ctx.fillRect(1, 1, 14, 14);
      // Iron bars
      ctx.fillStyle = '#999999';
      ctx.fillRect(3, 1, 2, 14);
      ctx.fillRect(7, 1, 2, 14);
      ctx.fillRect(11, 1, 2, 14);
      // Red glowing lock
      ctx.fillStyle = '#e0312b';
      ctx.fillRect(5, 6, 6, 4);
      ctx.fillStyle = '#ff8a85';
      ctx.fillRect(7, 7, 2, 2);
      cache.door_locked = c;
    }

    // 16. Open Gate (Nord-Tor geöffnet!)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      ctx.drawImage(cache.path, 0, 0);
      // Side posts
      ctx.fillStyle = '#5c4022';
      ctx.fillRect(0, 0, 3, 16);
      ctx.fillRect(13, 0, 3, 16);
      // Glowing green portal / arrow up
      ctx.fillStyle = '#4eff3b';
      ctx.fillRect(7, 3, 2, 9);
      ctx.fillRect(6, 4, 4, 2);
      ctx.fillRect(5, 5, 6, 2);
      cache.door_open = c;
    }

    // --- Items & Placed Blocks ---
    // Wooden Pickaxe Icon
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      // Handle (diagonal)
      ctx.fillStyle = '#6b4c28';
      for (let i = 2; i < 12; i++) {
        ctx.fillRect(i, 15 - i, 2, 2);
      }
      // Wooden pick head
      ctx.fillStyle = '#9e733b';
      ctx.fillRect(8, 2, 6, 3);
      ctx.fillRect(11, 4, 3, 4);
      ctx.fillStyle = '#c49352';
      ctx.fillRect(9, 2, 4, 2);
      cache.item_pickaxe = c;
    }

    // Oak Log Item Icon
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#4a361f';
      ctx.fillRect(3, 2, 10, 12);
      ctx.fillStyle = '#614729';
      ctx.fillRect(4, 3, 8, 10);
      ctx.fillStyle = '#c49e66';
      ctx.fillRect(4, 2, 8, 3);
      ctx.fillStyle = '#87683a';
      ctx.fillRect(6, 3, 4, 1);
      cache.item_log = c;
    }

    // Cobblestone Block Item / Placed Block
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      drawPixelGrid(ctx, ['#787878', '#8f8f8f', '#616161', '#a0a0a0'], 707);
      ctx.strokeStyle = '#2b2b2b';
      ctx.strokeRect(1.5, 1.5, 13, 13);
      cache.item_cobble = c;
    }

    // Crafted Heavy Oak Crate (Schwerer Holzblock)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#3d2812';
      ctx.fillRect(1, 1, 14, 14);
      ctx.fillStyle = '#9e6f38';
      ctx.fillRect(2, 2, 12, 12);
      ctx.fillStyle = '#bf8949';
      ctx.fillRect(4, 4, 8, 8);
      // Diagonal brace
      ctx.fillStyle = '#5e3f1c';
      for (let i = 3; i < 12; i++) {
        ctx.fillRect(i, i, 2, 2);
      }
      // Iron corners
      ctx.fillStyle = '#b0b5bd';
      ctx.fillRect(2, 2, 2, 2);
      ctx.fillRect(12, 2, 2, 2);
      ctx.fillRect(2, 12, 2, 2);
      ctx.fillRect(12, 12, 2, 2);
      cache.item_heavy_wood = c;
    }

    // Empty Hand Icon
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#d9a077';
      ctx.fillRect(5, 5, 6, 7);
      ctx.fillRect(4, 7, 2, 3);
      ctx.fillStyle = '#b8825c';
      ctx.fillRect(5, 4, 6, 1);
      cache.item_hand = c;
    }

    // ==========================================
    // RAUM 2 TEXTUREN: DIE TIEFE REDSTONE-MINE
    // ==========================================

    // 17. Deepslate Floor (Tiefenschiefer Boden)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      drawPixelGrid(ctx, ['#36363d', '#2c2c33', '#404048', '#25252b'], 808);
      ctx.strokeStyle = '#1b1b20';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, 15, 15);
      cache.deepslate_floor = c;
    }

    // 18. Deepslate Wall (Massive Höhlenwand)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      drawPixelGrid(ctx, ['#232328', '#1c1c21', '#2c2c33', '#16161a'], 909);
      ctx.strokeStyle = '#0e0e12';
      ctx.strokeRect(0.5, 0.5, 15, 15);
      // Horizontal slate lines
      ctx.fillStyle = '#141418';
      ctx.fillRect(0, 5, 16, 1);
      ctx.fillRect(0, 11, 16, 1);
      cache.deepslate_wall = c;
    }

    // 19. Diamond Ore Block (Hinweis-Element für Raum 5!)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      drawPixelGrid(ctx, ['#36363d', '#2c2c33', '#404048'], 1010);
      ctx.strokeStyle = '#1b1b20';
      ctx.strokeRect(0.5, 0.5, 15, 15);
      // Cyan glowing diamond flecks
      ctx.fillStyle = '#2be3e0';
      ctx.fillRect(3, 4, 2, 2);
      ctx.fillRect(10, 3, 3, 2);
      ctx.fillRect(5, 10, 3, 2);
      ctx.fillRect(11, 11, 2, 2);
      ctx.fillStyle = '#b5ffff';
      ctx.fillRect(4, 4, 1, 1);
      ctx.fillRect(11, 3, 1, 1);
      ctx.fillRect(6, 10, 1, 1);
      cache.diamond_ore = c;
    }

    // 20. Redstone Ore (Deko / Atmosphäre)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      drawPixelGrid(ctx, ['#36363d', '#2c2c33', '#404048'], 1111);
      ctx.strokeStyle = '#1b1b20';
      ctx.strokeRect(0.5, 0.5, 15, 15);
      ctx.fillStyle = '#d41313';
      ctx.fillRect(4, 3, 2, 2);
      ctx.fillRect(10, 5, 2, 2);
      ctx.fillRect(6, 10, 2, 2);
      ctx.fillStyle = '#ff7575';
      ctx.fillRect(5, 3, 1, 1);
      ctx.fillRect(11, 5, 1, 1);
      cache.redstone_ore = c;
    }

    // 21. Mine Rails (Schienen)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      ctx.drawImage(cache.deepslate_floor, 0, 0);
      // Wood sleepers
      ctx.fillStyle = '#5c4125';
      ctx.fillRect(2, 3, 12, 2);
      ctx.fillRect(2, 8, 12, 2);
      ctx.fillRect(2, 13, 12, 2);
      // Iron rails
      ctx.fillStyle = '#c7c7c7';
      ctx.fillRect(3, 0, 2, 16);
      ctx.fillRect(11, 0, 2, 16);
      ctx.fillStyle = '#7a7a7a';
      ctx.fillRect(4, 0, 1, 16);
      ctx.fillRect(12, 0, 1, 16);
      cache.rails = c;
    }

    // 22. Minecart with Chest (Lorentruhe)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      ctx.drawImage(cache.rails, 0, 0);
      // Iron cart body
      ctx.fillStyle = '#4a4a52';
      ctx.fillRect(1, 4, 14, 10);
      ctx.fillStyle = '#72727a';
      ctx.fillRect(2, 5, 12, 8);
      // Small chest inside
      ctx.fillStyle = '#a86728';
      ctx.fillRect(4, 6, 8, 6);
      ctx.fillStyle = '#ffd83d';
      ctx.fillRect(7, 8, 2, 2);
      cache.minecart_chest = c;
    }

    // 23. Redstone Wire OFF (Dunkelrot)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      ctx.drawImage(cache.deepslate_floor, 0, 0);
      ctx.fillStyle = '#5c0f0f';
      ctx.fillRect(6, 0, 4, 16);
      ctx.fillRect(0, 6, 16, 4);
      cache.redstone_wire_off = c;
    }

    // 24. Redstone Wire ON (Leuchtend Hellrot)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      ctx.drawImage(cache.deepslate_floor, 0, 0);
      // Red glow halo
      ctx.fillStyle = 'rgba(255, 30, 30, 0.35)';
      ctx.fillRect(4, 0, 8, 16);
      ctx.fillRect(0, 4, 16, 8);
      // Bright core wire
      ctx.fillStyle = '#ff2b2b';
      ctx.fillRect(6, 0, 4, 16);
      ctx.fillRect(0, 6, 16, 4);
      ctx.fillStyle = '#ffaaaa';
      ctx.fillRect(7, 2, 2, 12);
      ctx.fillRect(2, 7, 12, 2);
      cache.redstone_wire_on = c;
    }

    // 25. Redstone Wire Slot Empty (Fehlendes Kabelstück)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      ctx.drawImage(cache.deepslate_floor, 0, 0);
      // Dashed wire placeholder slot
      ctx.strokeStyle = '#8a3c3c';
      ctx.setLineDash([2, 2]);
      ctx.strokeRect(3.5, 3.5, 9, 9);
      ctx.fillStyle = 'rgba(160, 40, 40, 0.25)';
      ctx.fillRect(4, 4, 8, 8);
      cache.wire_slot_empty = c;
    }

    // 26. Redstone Lever OFF (Hebel AUS)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      ctx.drawImage(cache.deepslate_floor, 0, 0);
      // Cobblestone base
      ctx.fillStyle = '#6e6e6e';
      ctx.fillRect(3, 4, 10, 8);
      ctx.fillStyle = '#8f8f8f';
      ctx.fillRect(4, 5, 8, 6);
      // Lever handle (pointing down/off)
      ctx.fillStyle = '#4a3219';
      ctx.fillRect(7, 3, 2, 8);
      ctx.fillStyle = '#1e1e1e';
      ctx.fillRect(6, 9, 4, 3);
      cache.lever_off = c;
    }

    // 27. Redstone Lever ON (Hebel AN)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      ctx.drawImage(cache.deepslate_floor, 0, 0);
      // Cobblestone base
      ctx.fillStyle = '#6e6e6e';
      ctx.fillRect(3, 4, 10, 8);
      ctx.fillStyle = '#8f8f8f';
      ctx.fillRect(4, 5, 8, 6);
      // Glowing red base indicator
      ctx.fillStyle = '#ff2424';
      ctx.fillRect(4, 5, 3, 2);
      // Lever handle (pointing up/on)
      ctx.fillStyle = '#4a3219';
      ctx.fillRect(7, 1, 2, 8);
      ctx.fillStyle = '#ff3b3b';
      ctx.fillRect(6, 1, 4, 3);
      cache.lever_on = c;
    }

    // 28. Iron Door Locked
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#3a3a3a';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#a6a6a6';
      ctx.fillRect(1, 1, 14, 14);
      ctx.fillStyle = '#7a7a7a';
      // Iron door windows/slots
      ctx.fillRect(3, 2, 4, 5);
      ctx.fillRect(9, 2, 4, 5);
      ctx.fillRect(3, 9, 4, 5);
      ctx.fillRect(9, 9, 4, 5);
      // Red locked LED
      ctx.fillStyle = '#ff2424';
      ctx.fillRect(7, 7, 2, 2);
      cache.iron_door_locked = c;
    }

    // 29. Iron Door Open
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      ctx.drawImage(cache.deepslate_floor, 0, 0);
      // Side door frames
      ctx.fillStyle = '#7a7a7a';
      ctx.fillRect(0, 0, 3, 16);
      ctx.fillRect(13, 0, 3, 16);
      // Glowing green exit arrow
      ctx.fillStyle = '#4eff3b';
      ctx.fillRect(7, 3, 2, 9);
      ctx.fillRect(6, 4, 4, 2);
      ctx.fillRect(5, 5, 6, 2);
      cache.iron_door_open = c;
    }

    // 30. Redstone Torch (Wandfackel - Code-Hinweis!)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      ctx.drawImage(cache.deepslate_wall, 0, 0);
      // Wooden stick
      ctx.fillStyle = '#5c4125';
      ctx.fillRect(7, 7, 2, 7);
      // Redstone head
      ctx.fillStyle = '#ff2222';
      ctx.fillRect(6, 3, 4, 4);
      ctx.fillStyle = '#ffa8a8';
      ctx.fillRect(7, 4, 2, 2);
      cache.torch_redstone_on = c;
    }

    // 31. Redstone Torch OFF (Unbeleuchtet)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      ctx.drawImage(cache.deepslate_wall, 0, 0);
      ctx.fillStyle = '#5c4125';
      ctx.fillRect(7, 7, 2, 7);
      ctx.fillStyle = '#4a1111';
      ctx.fillRect(6, 4, 4, 3);
      cache.torch_redstone_off = c;
    }

    // 32. Item: Redstone Dust Icon
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      // Pile of glowing red dust
      ctx.fillStyle = '#e81717';
      ctx.fillRect(4, 7, 8, 6);
      ctx.fillRect(6, 5, 4, 8);
      ctx.fillStyle = '#ff7373';
      ctx.fillRect(5, 8, 2, 2);
      ctx.fillRect(9, 6, 2, 2);
      ctx.fillStyle = '#700909';
      ctx.fillRect(4, 12, 8, 2);
      cache.item_redstone = c;
    }

    // ==========================================
    // RAUM 3 TEXTUREN: DIE NETHER-FESTUNG (WASSERBLOCK-BRÜCKE)
    // ==========================================

    // 33. Nether Bricks Floor (Hellerer, kontrastreicherer Festungsboden)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      drawPixelGrid(ctx, ['#54262c', '#612d34', '#471f24', '#6e353d'], 3301);
      ctx.fillStyle = '#331418';
      for (let y of [3, 7, 11, 15]) {
        ctx.fillRect(0, y, 16, 1);
      }
      ctx.fillRect(7, 0, 1, 3);
      ctx.fillRect(13, 4, 1, 3);
      ctx.fillRect(4, 8, 1, 3);
      ctx.fillRect(10, 12, 1, 3);
      cache.nether_floor = c;
    }

    // 34. Nether Bricks Wall (Massive Festungsmauer)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      drawPixelGrid(ctx, ['#2b0f13', '#210a0d', '#38151a', '#1a0709'], 3302);
      ctx.strokeStyle = '#0f0305';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, 15, 15);
      ctx.fillStyle = '#4d1f26';
      ctx.fillRect(2, 2, 5, 2);
      ctx.fillRect(9, 6, 5, 2);
      ctx.fillRect(3, 10, 5, 2);
      cache.nether_wall = c;
    }

    // 35. Lava Block (Glühende Lava)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      drawPixelGrid(ctx, ['#d93800', '#f55600', '#b82800', '#ff7b00', '#ffa600'], 3303);
      ctx.fillStyle = '#ffdf4f';
      ctx.fillRect(3, 3, 3, 2);
      ctx.fillRect(10, 7, 3, 2);
      ctx.fillRect(5, 11, 4, 2);
      cache.lava = c;
    }

    // 36. Bridgeable Lava Slot (Stark markiertes Brücken-Zielfeld für Wasserblöcke!)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      ctx.drawImage(cache.lava, 0, 0);
      // Dark stone socket in lava
      ctx.fillStyle = 'rgba(15, 25, 45, 0.85)';
      ctx.fillRect(2, 2, 12, 12);
      // Bright white & cyan target frame so it stands out strongly!
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(1.5, 1.5, 13, 13);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(1, 1, 3, 3);
      ctx.fillRect(12, 1, 3, 3);
      ctx.fillRect(1, 12, 3, 3);
      ctx.fillRect(12, 12, 3, 3);
      // Blue water drop icon in the middle
      ctx.fillStyle = '#29b6f6';
      ctx.fillRect(7, 4, 2, 2);
      ctx.fillRect(6, 6, 4, 2);
      ctx.fillRect(5, 8, 6, 3);
      ctx.fillRect(6, 11, 4, 1);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(6, 8, 1, 2);
      cache.lava_bridge_slot = c;
    }

    // 37. Walkable Water-Obsidian Bridge Block (Begehbare Brücke nach Einsetzen eines Wasserblocks!)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      // Solid cooled obsidian/water-stone core
      drawPixelGrid(ctx, ['#263859', '#1c2b47', '#314a75', '#2a1f4a'], 3305);
      // Bright cyan-blue safe bridge side rails (left & right)
      ctx.fillStyle = '#00e5ff';
      ctx.fillRect(0, 0, 2, 16);
      ctx.fillRect(14, 0, 2, 16);
      // Light stone bridge planks across so it looks 100% walkable
      ctx.fillStyle = '#8fa8cc';
      ctx.fillRect(3, 2, 10, 2);
      ctx.fillRect(3, 7, 10, 2);
      ctx.fillRect(3, 12, 10, 2);
      ctx.fillStyle = '#d4e6ff';
      ctx.fillRect(4, 2, 8, 1);
      ctx.fillRect(4, 7, 8, 1);
      ctx.fillRect(4, 12, 8, 1);
      cache.obsidian = c;
    }

    // 38. Glowstone Block (Leuchtstein-Säule)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      drawPixelGrid(ctx, ['#b88328', '#e6b13e', '#ffdd73', '#8f5e15', '#fff3b8'], 3306);
      ctx.strokeStyle = '#6b440c';
      ctx.strokeRect(0.5, 0.5, 15, 15);
      cache.glowstone = c;
    }

    // 39. Water Block on Pedestal (Aufnehmbarer Wasserblock im Raum!)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      ctx.drawImage(cache.nether_floor, 0, 0);
      // White/Cyan pedestal base
      ctx.fillStyle = '#e0f7fa';
      ctx.fillRect(1, 1, 14, 14);
      // Vibrant Minecraft Water Block
      drawPixelGrid(ctx, ['#0077ff', '#0099ff', '#29b6f6', '#0288d1'], 3901);
      ctx.strokeStyle = '#80d8ff';
      ctx.strokeRect(1.5, 1.5, 13, 13);
      // Water wave highlights
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(4, 4, 4, 2);
      ctx.fillRect(9, 7, 3, 2);
      ctx.fillRect(5, 10, 5, 2);
      cache.water_block = c;
    }

    // 40. Nether Gate Locked
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#1c080b';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#52151f';
      ctx.fillRect(1, 1, 14, 14);
      ctx.fillStyle = '#ff9924';
      ctx.fillRect(3, 1, 2, 14);
      ctx.fillRect(7, 1, 2, 14);
      ctx.fillRect(11, 1, 2, 14);
      ctx.fillStyle = '#ff2424';
      ctx.fillRect(5, 6, 6, 4);
      cache.nether_door_locked = c;
    }

    // 41. Nether Gate Open
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      ctx.drawImage(cache.nether_floor, 0, 0);
      ctx.fillStyle = '#52151f';
      ctx.fillRect(0, 0, 3, 16);
      ctx.fillRect(13, 0, 3, 16);
      ctx.fillStyle = '#4eff3b';
      ctx.fillRect(7, 3, 2, 9);
      ctx.fillRect(6, 4, 4, 2);
      ctx.fillRect(5, 5, 6, 2);
      cache.nether_door_open = c;
    }

    // 42. Item: Water Block (Wasserblock-Item für die Hotbar!)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#0066cc';
      ctx.fillRect(2, 2, 12, 12);
      ctx.fillStyle = '#00aaff';
      ctx.fillRect(3, 3, 10, 10);
      ctx.strokeStyle = '#ffffff';
      ctx.strokeRect(2.5, 2.5, 11, 11);
      // Wave highlights
      ctx.fillStyle = '#b3e5fc';
      ctx.fillRect(5, 5, 4, 2);
      ctx.fillRect(7, 9, 4, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(5, 5, 2, 1);
      cache.item_water_block = c;
    }

    // 43. Empty Water Pedestal (Leerer Wasser-Sockel nach dem Aufheben)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      ctx.drawImage(cache.nether_floor, 0, 0);
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.45)';
      ctx.strokeRect(3.5, 3.5, 9, 9);
      cache.water_pad_empty = c;
    }

    // 44. Horizontal Mine Rails (Waagerechte Schienen)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      ctx.drawImage(cache.deepslate_floor, 0, 0);
      // Wood sleepers (vertical)
      ctx.fillStyle = '#5c4125';
      ctx.fillRect(2, 2, 2, 12);
      ctx.fillRect(7, 2, 2, 12);
      ctx.fillRect(12, 2, 2, 12);
      // Iron rails (horizontal)
      ctx.fillStyle = '#c7c7c7';
      ctx.fillRect(0, 3, 16, 2);
      ctx.fillRect(0, 11, 16, 2);
      ctx.fillStyle = '#7a7a7a';
      ctx.fillRect(0, 4, 16, 1);
      ctx.fillRect(0, 12, 16, 1);
      cache.rails_h = c;
    }

    // 45. Powered Rail OFF (Gold-Antriebsschiene ohne Strom)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      ctx.drawImage(cache.rails_h, 0, 0);
      // Dark red center bar
      ctx.fillStyle = '#571111';
      ctx.fillRect(0, 7, 16, 2);
      // Gold rail accents
      ctx.fillStyle = '#d4a017';
      ctx.fillRect(0, 3, 16, 1);
      ctx.fillRect(0, 11, 16, 1);
      cache.powered_rail_off = c;
    }

    // 46. Powered Rail ON (Gold-Antriebsschiene mit Redstone-Power!)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      ctx.drawImage(cache.rails_h, 0, 0);
      // Bright glowing red center bar
      ctx.fillStyle = '#ff2424';
      ctx.fillRect(0, 6, 16, 4);
      ctx.fillStyle = '#ff9e9e';
      ctx.fillRect(0, 7, 16, 2);
      // Bright gold rails
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(0, 3, 16, 2);
      ctx.fillRect(0, 11, 16, 2);
      cache.powered_rail_on = c;
    }

    // 47. Detector Rail OFF (Sensorschiene am Ziel)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      ctx.drawImage(cache.rails_h, 0, 0);
      // Stone sensor plate in center
      ctx.fillStyle = '#8c8c8c';
      ctx.fillRect(4, 4, 8, 8);
      ctx.fillStyle = '#5e1414';
      ctx.fillRect(6, 6, 4, 4);
      cache.detector_rail_off = c;
    }

    // 48. Detector Rail ON (Sensorschiene aktiviert!)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      ctx.drawImage(cache.rails_h, 0, 0);
      ctx.fillStyle = '#52ff38';
      ctx.fillRect(3, 3, 10, 10);
      ctx.fillStyle = '#b8ffad';
      ctx.fillRect(6, 6, 4, 4);
      cache.detector_rail_on = c;
    }

    // 49. Mineable Glowing Redstone Ore (Abbaubares Redstone-Erz mit Rissen)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      drawPixelGrid(ctx, ['#42383d', '#362c30', '#4f4046'], 4901);
      ctx.strokeStyle = '#ff3b3b';
      ctx.strokeRect(0.5, 0.5, 15, 15);
      // Rich glowing redstone crystals
      ctx.fillStyle = '#ff1f1f';
      ctx.fillRect(3, 3, 3, 3);
      ctx.fillRect(9, 4, 4, 3);
      ctx.fillRect(4, 9, 4, 4);
      ctx.fillRect(10, 10, 3, 3);
      ctx.fillStyle = '#ffadad';
      ctx.fillRect(4, 4, 1, 1);
      ctx.fillRect(10, 5, 2, 1);
      ctx.fillRect(5, 10, 2, 1);
      // Mining cracks
      ctx.fillStyle = '#141414';
      [[6, 6], [7, 7], [8, 7], [8, 8], [7, 9]].forEach(([x, y]) => ctx.fillRect(x, y, 1, 1));
      cache.mineable_redstone_ore = c;
    }

    // 50. Pushable Minecart (Schiebbare Lore)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      // Wheels
      ctx.fillStyle = '#1c1c1c';
      ctx.fillRect(2, 12, 3, 3);
      ctx.fillRect(11, 12, 3, 3);
      // Metallic cart body
      ctx.fillStyle = '#474a52';
      ctx.fillRect(1, 3, 14, 10);
      ctx.fillStyle = '#858a96';
      ctx.fillRect(2, 4, 12, 8);
      ctx.fillStyle = '#b4bac7';
      ctx.fillRect(2, 4, 12, 2);
      // Glowing gold/redstone core inside cart
      ctx.fillStyle = '#292b30';
      ctx.fillRect(4, 6, 8, 5);
      ctx.fillStyle = '#ffaa00';
      ctx.fillRect(6, 7, 4, 3);
      cache.minecart_push = c;
    }

    // 51. Redstone Generator Block (Stromquelle)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      drawPixelGrid(ctx, ['#8f1111', '#b81616', '#d92121', '#ff3838'], 5101);
      ctx.strokeStyle = '#ff9494';
      ctx.strokeRect(0.5, 0.5, 15, 15);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(6, 6, 4, 4);
      cache.redstone_generator = c;
    }

    // 52. Mineable Cracked Glowstone (Abbaubarer Leuchtstein-Kristall in Raum 3)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      drawPixelGrid(ctx, ['#8f5e15', '#b88328', '#e6b13e', '#ffdd73'], 5201);
      ctx.strokeStyle = '#ffea85';
      ctx.strokeRect(0.5, 0.5, 15, 15);
      // Bright crystal highlights
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(4, 4, 2, 2);
      ctx.fillRect(10, 5, 2, 2);
      ctx.fillRect(6, 10, 3, 2);
      // Cracks to show it can be mined with Pickaxe
      ctx.fillStyle = '#261405';
      [[5, 6], [6, 7], [7, 7], [8, 8], [9, 9], [7, 8]].forEach(([x, y]) => ctx.fillRect(x, y, 1, 1));
      cache.mineable_glowstone = c;
    }

    // 53. Nether Altar OFF (Goldener Portal-Sockel neben dem Nether-Tor – stark markiert!)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      ctx.drawImage(cache.nether_floor, 0, 0);
      // Dark stone pedestal
      ctx.fillStyle = '#1f0b0e';
      ctx.fillRect(1, 1, 14, 14);
      // Bright Gold & White frame so it is immediately visible
      ctx.strokeStyle = '#ffd700';
      ctx.strokeRect(1.5, 1.5, 13, 13);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(1, 1, 2, 2);
      ctx.fillRect(13, 1, 2, 2);
      ctx.fillRect(1, 13, 2, 2);
      ctx.fillRect(13, 13, 2, 2);
      // Empty socket in center waiting for Glowstone
      ctx.fillStyle = '#38151a';
      ctx.fillRect(4, 4, 8, 8);
      ctx.strokeStyle = '#ffaa00';
      ctx.strokeRect(4.5, 4.5, 7, 7);
      cache.nether_altar_off = c;
    }

    // 54. Nether Altar ON (Aktiviert mit Leuchtstaub!)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      ctx.drawImage(cache.nether_altar_off, 0, 0);
      ctx.strokeStyle = '#52ff38';
      ctx.strokeRect(1.5, 1.5, 13, 13);
      // Glowing golden/green energy in center
      ctx.fillStyle = '#ffea47';
      ctx.fillRect(4, 4, 8, 8);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(6, 6, 4, 4);
      cache.nether_altar_on = c;
    }

    // 55. Item: Glowstone Dust (Leuchtstaub)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#d48b17';
      ctx.fillRect(4, 7, 8, 6);
      ctx.fillStyle = '#ffcf40';
      ctx.fillRect(5, 5, 6, 7);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(6, 7, 2, 2);
      ctx.fillRect(9, 6, 1, 1);
      cache.item_glowstone_dust = c;
    }

    // ==========================================
    // RAUM 4 TEXTUREN: DAS AMETHYST-OBSERVATORIUM
    // ==========================================

    // 56. Endstone Bricks Floor (Heller, warmer Endstein-Boden für starken Kontrast)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      drawPixelGrid(ctx, ['#dcd59c', '#e6e0ab', '#cfc78a', '#ebe6b9'], 5601);
      ctx.fillStyle = '#b5ad72';
      for (let y of [3, 7, 11, 15]) {
        ctx.fillRect(0, y, 16, 1);
      }
      ctx.fillRect(6, 0, 1, 3);
      ctx.fillRect(12, 4, 1, 3);
      ctx.fillRect(4, 8, 1, 3);
      ctx.fillRect(10, 12, 1, 3);
      cache.end_floor = c;
    }

    // 57. Purpur Pillar Wall (Lila Purpur-Festungsmauer)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      drawPixelGrid(ctx, ['#522d5e', '#43224d', '#633870', '#361a40'], 5701);
      ctx.strokeStyle = '#240f2b';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, 15, 15);
      ctx.fillStyle = '#7e4a8f';
      ctx.fillRect(2, 2, 5, 2);
      ctx.fillRect(9, 6, 5, 2);
      ctx.fillRect(3, 10, 5, 2);
      cache.purpur_wall = c;
    }

    // 58. Amethyst Target Slot (Leuchtend Pink-Lila markiertes Zielfeld!)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      ctx.drawImage(cache.end_floor, 0, 0);
      ctx.fillStyle = 'rgba(45, 12, 60, 0.85)';
      ctx.fillRect(2, 2, 12, 12);
      // Bright pink/magenta & white target frame
      ctx.strokeStyle = '#ff40fb';
      ctx.strokeRect(1.5, 1.5, 13, 13);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(1, 1, 3, 3);
      ctx.fillRect(12, 1, 3, 3);
      ctx.fillRect(1, 12, 3, 3);
      ctx.fillRect(12, 12, 3, 3);
      // Diamond crystal target icon in center
      ctx.fillStyle = '#e040fb';
      ctx.fillRect(7, 5, 2, 6);
      ctx.fillRect(5, 7, 6, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(7, 7, 2, 2);
      cache.amethyst_slot = c;
    }

    // 59. Amethyst Resonance Block (Schiebbarer & platzierbarer Pink-Lila Kristallblock)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      drawPixelGrid(ctx, ['#7b1fa2', '#9c27b0', '#ba68c8', '#ce93d8', '#e040fb'], 5901);
      ctx.strokeStyle = '#ffffff';
      ctx.strokeRect(0.5, 0.5, 15, 15);
      ctx.strokeStyle = '#ff40fb';
      ctx.strokeRect(1.5, 1.5, 13, 13);
      // Facet sparkles
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(4, 4, 2, 2);
      ctx.fillRect(10, 5, 2, 2);
      ctx.fillRect(7, 9, 3, 2);
      cache.amethyst_block = c;
    }

    // 60. Mineable Amethyst Geode Cluster (Abbaubare Amethyst-Geode)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      ctx.drawImage(cache.end_floor, 0, 0);
      drawPixelGrid(ctx, ['#4a148c', '#6a1b9a', '#8e24aa', '#d500f9'], 6001);
      ctx.strokeStyle = '#ff80fc';
      ctx.strokeRect(0.5, 0.5, 15, 15);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(3, 4, 2, 2);
      ctx.fillRect(10, 4, 2, 2);
      ctx.fillRect(6, 10, 3, 2);
      // Cracks to show pickaxe mining
      ctx.fillStyle = '#1a0526';
      [[5, 6], [6, 7], [7, 7], [8, 8], [9, 9], [7, 8]].forEach(([x, y]) => ctx.fillRect(x, y, 1, 1));
      cache.mineable_amethyst = c;
    }

    // 61. Item: Amethyst Block (Hotbar Icon)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#6a1b9a';
      ctx.fillRect(2, 2, 12, 12);
      ctx.fillStyle = '#d500f9';
      ctx.fillRect(3, 3, 10, 10);
      ctx.strokeStyle = '#ffffff';
      ctx.strokeRect(2.5, 2.5, 11, 11);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(5, 5, 2, 2);
      ctx.fillRect(9, 8, 2, 2);
      cache.item_amethyst_block = c;
    }

    // 62. Beam Emitter & Receiver (Pink-Lila Lichtstrahl-Sender & Empfänger)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      drawPixelGrid(ctx, ['#381847', '#4a205e', '#291036'], 6201);
      ctx.strokeStyle = '#ff40fb';
      ctx.strokeRect(0.5, 0.5, 15, 15);
      ctx.fillStyle = '#ff40fb';
      ctx.fillRect(4, 4, 8, 8);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(6, 6, 4, 4);
      cache.beam_emitter = c;
    }

    // 63. Dragon Egg Pedestal (1 Drachenei auf Sockel – Code-Hinweis für Raum 5!)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      ctx.drawImage(cache.end_floor, 0, 0);
      // Gold pedestal base
      ctx.fillStyle = '#5c3566';
      ctx.fillRect(2, 11, 12, 4);
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(3, 10, 10, 2);
      // Dragon Egg shape
      ctx.fillStyle = '#1a0926';
      ctx.fillRect(5, 3, 6, 7);
      ctx.fillRect(4, 5, 8, 4);
      ctx.fillStyle = '#d500f9';
      ctx.fillRect(6, 4, 2, 2);
      ctx.fillRect(8, 7, 2, 2);
      ctx.fillRect(5, 6, 1, 2);
      cache.dragon_egg = c;
    }

    // 64. End Portal Door Locked & Open
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#12071c';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#3b8c7d';
      ctx.fillRect(1, 1, 14, 14);
      ctx.fillStyle = '#1c0a2b';
      ctx.fillRect(3, 3, 10, 10);
      ctx.fillStyle = '#ff40fb';
      ctx.fillRect(5, 6, 6, 4);
      cache.end_door_locked = c;
    }
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      ctx.drawImage(cache.end_floor, 0, 0);
      ctx.fillStyle = '#3b8c7d';
      ctx.fillRect(0, 0, 3, 16);
      ctx.fillRect(13, 0, 3, 16);
      ctx.fillStyle = '#4eff3b';
      ctx.fillRect(7, 3, 2, 9);
      ctx.fillRect(6, 4, 4, 2);
      ctx.fillRect(5, 5, 6, 2);
      cache.end_door_open = c;
    }

    // ==========================================
    // RAUM 5 TEXTUREN: DIE ANTIKE SCHATZKAMMER
    // ==========================================

    // 65. Quartz & Gold Floor (Edler heller Quarz-Boden)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      drawPixelGrid(ctx, ['#ebe6dc', '#f5f1e8', '#dfd9cc', '#faf7f0'], 6501);
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, 15, 15);
      ctx.fillStyle = '#e6c65a';
      ctx.fillRect(1, 1, 2, 2);
      ctx.fillRect(13, 1, 2, 2);
      ctx.fillRect(1, 13, 2, 2);
      ctx.fillRect(13, 13, 2, 2);
      cache.quartz_floor = c;
    }

    // 66. Royal Bookshelf & Gold Wall (Schatzkammer-Mauer)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      drawPixelGrid(ctx, ['#3b2614', '#4d331c', '#2e1c0e'], 6601);
      // Gold trim top & bottom
      ctx.fillStyle = '#d4af37';
      ctx.fillRect(0, 0, 16, 3);
      ctx.fillRect(0, 7, 16, 2);
      ctx.fillRect(0, 13, 16, 3);
      // Colorful books on shelves
      const bookColors = ['#e53935', '#1e88e5', '#43a047', '#fdd835', '#8e24aa', '#00acc1'];
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = bookColors[i];
        ctx.fillRect(2 + i * 2, 3, 2, 4);
        ctx.fillStyle = bookColors[(i + 3) % 6];
        ctx.fillRect(2 + i * 2, 9, 2, 4);
      }
      ctx.strokeStyle = '#1f1208';
      ctx.strokeRect(0.5, 0.5, 15, 15);
      cache.gold_wall = c;
    }

    // 67. Emerald Pillar (Smaragd-Säule)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      drawPixelGrid(ctx, ['#007a2f', '#00a843', '#1de96b', '#005921'], 6701);
      ctx.strokeStyle = '#80ffaa';
      ctx.strokeRect(0.5, 0.5, 15, 15);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(4, 4, 2, 2);
      ctx.fillRect(10, 10, 2, 2);
      cache.emerald_pillar = c;
    }

    // 68. Code Dial Pedestal (Goldene Code-Ziffern-Säule)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      ctx.drawImage(cache.quartz_floor, 0, 0);
      ctx.fillStyle = '#291d12';
      ctx.fillRect(1, 1, 14, 14);
      ctx.strokeStyle = '#ffd700';
      ctx.strokeRect(1.5, 1.5, 13, 13);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(1, 1, 2, 2);
      ctx.fillRect(13, 1, 2, 2);
      ctx.fillRect(1, 13, 2, 2);
      ctx.fillRect(13, 13, 2, 2);
      cache.code_pedestal = c;
    }

    // 69. Mineable Emerald Crystal (Abbaubarer Smaragd-Kristallblock)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      ctx.drawImage(cache.quartz_floor, 0, 0);
      drawPixelGrid(ctx, ['#006927', '#00993b', '#00e65c', '#69f0ae'], 6901);
      ctx.strokeStyle = '#ffffff';
      ctx.strokeRect(0.5, 0.5, 15, 15);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(4, 4, 2, 2);
      ctx.fillRect(10, 5, 2, 2);
      // Cracks for pickaxe mining
      ctx.fillStyle = '#00260d';
      [[5, 6], [6, 7], [7, 7], [8, 8], [9, 9], [7, 8]].forEach(([x, y]) => ctx.fillRect(x, y, 1, 1));
      cache.mineable_emerald = c;
    }

    // 70. Item: Master Emerald (Meister-Smaragd für die Hotbar)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#006927';
      ctx.fillRect(4, 2, 8, 12);
      ctx.fillRect(3, 4, 10, 8);
      ctx.fillStyle = '#00e65c';
      ctx.fillRect(5, 3, 6, 10);
      ctx.fillRect(4, 5, 8, 6);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(5, 4, 2, 3);
      cache.item_emerald = c;
    }

    // 71. Vault Key Socket OFF & ON (Smaragd-Schlüsselsockel vor dem Tresor)
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      ctx.drawImage(cache.quartz_floor, 0, 0);
      ctx.fillStyle = '#1f1608';
      ctx.fillRect(1, 1, 14, 14);
      ctx.strokeStyle = '#00e676';
      ctx.strokeRect(1.5, 1.5, 13, 13);
      ctx.fillStyle = '#0a2916';
      ctx.fillRect(4, 4, 8, 8);
      cache.vault_socket_off = c;
    }
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      ctx.drawImage(cache.vault_socket_off, 0, 0);
      ctx.fillStyle = '#00e676';
      ctx.fillRect(3, 3, 10, 10);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(6, 5, 4, 6);
      cache.vault_socket_on = c;
    }

    // 72. Royal Treasure Vault Locked & Open
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#291b06';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(1, 1, 14, 14);
      ctx.fillStyle = '#b8860b';
      ctx.fillRect(3, 3, 10, 10);
      ctx.fillStyle = '#00e676';
      ctx.fillRect(6, 5, 4, 6);
      cache.vault_door_locked = c;
    }
    {
      const c = createCanvas();
      const ctx = c.getContext('2d');
      ctx.drawImage(cache.quartz_floor, 0, 0);
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(0, 0, 3, 16);
      ctx.fillRect(13, 0, 3, 16);
      ctx.fillStyle = '#4eff3b';
      ctx.fillRect(7, 3, 2, 9);
      ctx.fillRect(6, 4, 4, 2);
      ctx.fillRect(5, 5, 6, 2);
      cache.vault_door_open = c;
    }
  }

  buildTextures();

  return {
    get(name) {
      return cache[name] || cache.grass;
    }
  };
})();

