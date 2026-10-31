# Ground markers

These are the marks laid over the tomb floor where the ground is something other than plain
stone. They are transparent 256 × 256 PNGs, stretched over one map tile, drawn on top of the
floor tile and under creatures and objects. Repaint any of them in your editor and keep the
transparency.

| File | Ground | Where it appears |
|---|---|---|
| `water.png` | Shallow water | Pool edges and streams; walkable |
| `deep.png` | Deep water | Pool centers; only swimmers (or Water-sure) can cross |
| `moss.png` | Moss | Damp chambers near water |
| `roots.png` | Roots | Root galleries and overgrown ruins |
| `guano.png` | Guano | Under bat roosts |
| `bones.png` | Bones | Bone yards and dens |
| `rubble.png` | Rubble | Ruined and fortress chambers |
| `ash.png` | Dust and ash | Hot vent chambers |
| `crystal.png` | Star crystal | Star hollows (floors 8–13) |
| `mycelium.png` | Mycelium | Fungal gardens |
| `flesh.png` | Living rock | Tlaltecuhtli's chambers (floors 9–13) |

Water and living rock cover the whole tile, and their art is partly transparent so the floor
shows through. The others are scattered marks on a clear background.

After changing one, bump its `?v=` number in `styles.css` (search for `ground/`) so players
don't see a cached copy.
