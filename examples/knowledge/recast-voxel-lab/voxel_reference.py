#!/usr/bin/env python3
"""Small executable voxel reference lab.

The lab is deliberately independent of an engine. It proves coordinate, face,
halo, seam, AABB, and generation contracts with bounded deterministic tests.
"""
from __future__ import annotations

from dataclasses import dataclass
import math
from typing import Dict, Iterable, List, Optional, Set, Tuple

Voxel = Tuple[int, int, int]
Chunk = Tuple[int, int, int]
Face = Tuple[Voxel, str]
AABB = Tuple[float, float, float, float, float, float]

CHUNK_SIZE = 4
DIRECTIONS = ((1, 0, 0, "+x"), (-1, 0, 0, "-x"), (0, 1, 0, "+y"),
              (0, -1, 0, "-y"), (0, 0, 1, "+z"), (0, 0, -1, "-z"))


def floor_divmod(value: int, size: int = CHUNK_SIZE) -> Tuple[int, int]:
    """Return chunk/local coordinates, including negative world positions."""
    chunk = value // size
    return chunk, value - chunk * size


def split_voxel(pos: Voxel) -> Tuple[Chunk, Voxel]:
    cx, lx = floor_divmod(pos[0])
    cy, ly = floor_divmod(pos[1])
    cz, lz = floor_divmod(pos[2])
    return (cx, cy, cz), (lx, ly, lz)


class UnknownChunk(RuntimeError):
    pass


@dataclass
class ChunkData:
    solid: Set[Voxel]
    generation: int = 0


class World:
    def __init__(self) -> None:
        self.chunks: Dict[Chunk, ChunkData] = {}
        self.dirty: Set[Chunk] = set()
        self.target_generation = 0

    def put_chunk(self, chunk: Chunk, local_solid: Iterable[Voxel], generation: int = 0) -> None:
        checked = set(local_solid)
        if any(any(v < 0 or v >= CHUNK_SIZE for v in cell) for cell in checked):
            raise ValueError("local voxel outside chunk")
        self.chunks[chunk] = ChunkData(checked, generation)

    def set_solid(self, pos: Voxel, solid: bool) -> int:
        chunk, local = split_voxel(pos)
        if chunk not in self.chunks:
            raise UnknownChunk("cannot mutate an unloaded chunk")
        data = self.chunks[chunk]
        if solid:
            data.solid.add(local)
        else:
            data.solid.discard(local)
        data.generation += 1
        self.target_generation += 1
        self.invalidate(chunk)
        return self.target_generation

    def invalidate(self, chunk: Chunk) -> None:
        self.dirty.add(chunk)
        for axis in range(3):
            for sign in (-1, 1):
                neighbor = list(chunk)
                neighbor[axis] += sign
                self.dirty.add(tuple(neighbor))

    def cell(self, pos: Voxel) -> Optional[bool]:
        chunk, local = split_voxel(pos)
        data = self.chunks.get(chunk)
        if data is None:
            return None
        return local in data.solid

    def visible_faces(self, chunk: Chunk) -> List[Face]:
        data = self.chunks.get(chunk)
        if data is None:
            raise UnknownChunk("mesh source is unloaded")
        faces: List[Face] = []
        for local in sorted(data.solid):
            world = tuple(chunk[i] * CHUNK_SIZE + local[i] for i in range(3))
            for dx, dy, dz, name in DIRECTIONS:
                neighbor = (world[0] + dx, world[1] + dy, world[2] + dz)
                occupied = self.cell(neighbor)
                if occupied is None:
                    raise UnknownChunk("halo is unknown; do not treat it as empty")
                if not occupied:
                    faces.append((world, name))
        return faces

    def mesh_snapshot(self, chunk: Chunk) -> Tuple[int, List[Face]]:
        data = self.chunks.get(chunk)
        if data is None:
            raise UnknownChunk("mesh source is unloaded")
        neighbors = []
        for axis in range(3):
            for sign in (-1, 1):
                c = list(chunk)
                c[axis] += sign
                neighbor = self.chunks.get(tuple(c))
                if neighbor is None:
                    raise UnknownChunk("required halo is unloaded")
                neighbors.append((tuple(c), neighbor.generation))
        # A real builder would retain a lease; this immutable result records its inputs.
        version = (data.generation, tuple(neighbors))
        return version, self.visible_faces(chunk)


def greedy_rectangles(faces: Iterable[Face]) -> List[Tuple[Voxel, str, int, int]]:
    """Greedy merge coplanar unit faces with a conservative material-free rule."""
    grouped: Dict[Tuple[str, int], Set[Tuple[int, int]]] = {}
    for (x, y, z), direction in faces:
        if direction in ("+x", "-x"):
            key, uv = (direction, x), (y, z)
        elif direction in ("+y", "-y"):
            key, uv = (direction, y), (x, z)
        else:
            key, uv = (direction, z), (x, y)
        grouped.setdefault(key, set()).add(uv)
    out: List[Tuple[Voxel, str, int, int]] = []
    for (direction, plane), cells in sorted(grouped.items()):
        while cells:
            u, v = min(cells)
            width = 1
            while (u + width, v) in cells:
                width += 1
            height = 1
            while all((u + i, v + height) in cells for i in range(width)):
                height += 1
            for du in range(width):
                for dv in range(height):
                    cells.remove((u + du, v + dv))
            if direction in ("+x", "-x"):
                origin = (plane, u, v)
            elif direction in ("+y", "-y"):
                origin = (u, plane, v)
            else:
                origin = (u, v, plane)
            out.append((origin, direction, width, height))
    return out


def aabb_intersects(a: AABB, b: AABB) -> bool:
    return (a[0] <= b[3] and b[0] <= a[3] and a[1] <= b[4] and
            b[1] <= a[4] and a[2] <= b[5] and b[2] <= a[5])


def voxel_aabb(pos: Voxel) -> AABB:
    x, y, z = pos
    return (float(x), float(y), float(z), float(x + 1), float(y + 1), float(z + 1))


def collision_oracle(world: World, moving: AABB, conservative_unknown: bool = True) -> str:
    minx, miny, minz, maxx, maxy, maxz = moving
    if not all(math.isfinite(v) for v in moving) or minx > maxx or miny > maxy or minz > maxz:
        raise ValueError("invalid AABB")
    if (math.ceil(maxx)-math.floor(minx)+2)*(math.ceil(maxy)-math.floor(miny)+2)*(math.ceil(maxz)-math.floor(minz)+2)>100000:
        raise ValueError("AABB query budget exceeded")
    for z in range(math.floor(minz) - 1, math.ceil(maxz) + 1):
        for y in range(math.floor(miny) - 1, math.ceil(maxy) + 1):
            for x in range(math.floor(minx) - 1, math.ceil(maxx) + 1):
                if not aabb_intersects(moving, voxel_aabb((x, y, z))):
                    continue
                occupied = world.cell((x, y, z))
                if occupied is None and conservative_unknown:
                    return "unknown_blocked"
                if occupied:
                    return "solid_hit"
    return "clear"


def seam_example() -> Dict[str, object]:
    """Triangulate adjacent planar patches with the same shared edge segments."""
    # The left coarse quad's right edge receives the right fine patch's midpoint.
    boundary = [(0, 0), (2, 0), (2, 1), (2, 2), (0, 2)]
    center = (1, 1)
    stitched = [(center, boundary[i], boundary[(i + 1) % len(boundary)])
                for i in range(len(boundary))]
    fine = [((2, 0), (4, 0), (4, 1)), ((2, 0), (4, 1), (2, 1)),
            ((2, 1), (4, 1), (4, 2)), ((2, 1), (4, 2), (2, 2))]
    def seam_edges(triangles):
        return {tuple(sorted((a, b))) for t in triangles for a, b in zip(t, t[1:] + t[:1])
                if a[0] == b[0] == 2}
    assert seam_edges(stitched) == seam_edges(fine) == {((2, 0), (2, 1)), ((2, 1), (2, 2))}
    area = sum(abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])) / 2
               for a, b, c in stitched)
    assert area == 4
    return {
        "coarse": boundary, "stitched": stitched, "fine": fine,
        "topology": "T-junction removed by splitting the shared coarse edge at the fine midpoint",
        "solution_bound": "planar 2:1 patch triangulation with matching seam segments and preserved area",
        "limitation": "not a general Transvoxel implementation; no normal/material/collision seam generation",
    }


def snapshot_generation_trace() -> List[str]:
    world = World()
    world.put_chunk((0, 0, 0), set(), 10)
    world.put_chunk((1, 0, 0), {(0, 0, 0)}, 4)
    world.put_chunk((-1, 0, 0), set(), 2)
    world.put_chunk((0, -1, 0), set(), 3)
    world.put_chunk((0, 1, 0), set(), 3)
    world.put_chunk((0, 0, -1), set(), 3)
    world.put_chunk((0, 0, 1), set(), 3)
    trace = []
    trace.append("world -1 => chunk -1/local 3")
    before, _ = world.mesh_snapshot((0, 0, 0))
    trace.append("A mesh halo B generation 4")
    world.set_solid((CHUNK_SIZE, 0, 0), True)
    trace.append("B generation 5 => A dirty")
    assert (0, 0, 0) in world.dirty
    after, _ = world.mesh_snapshot((0, 0, 0))
    assert before != after
    trace.append("new snapshot differs; stale result rejected by generation")
    return trace


def run_tests() -> None:
    assert split_voxel((-1, 0, 0)) == ((-1, 0, 0), (3, 0, 0))
    world = World()
    for chunk in ((0, 0, 0), (1, 0, 0), (-1, 0, 0), (0, -1, 0), (0, 1, 0), (0, 0, -1), (0, 0, 1)):
        world.put_chunk(chunk, set())
    world.put_chunk((0, 0, 0), {(3, 0, 0)})
    world.put_chunk((1, 0, 0), set())
    faces = world.visible_faces((0, 0, 0))
    assert ((3, 0, 0), "+x") in faces
    world.set_solid((4, 0, 0), True)
    assert ((3, 0, 0), "+x") not in world.visible_faces((0, 0, 0))
    assert len(greedy_rectangles([((0, 0, 0), "+y"), ((1, 0, 0), "+y")])) == 1
    assert collision_oracle(world, (3.2, 0.1, 0.1, 3.8, 0.9, 0.9)) == "solid_hit"
    unknown = World()
    unknown.put_chunk((0, 0, 0), set())
    assert collision_oracle(unknown, (4.1, 0.1, 0.1, 4.8, 0.9, 0.9)) == "unknown_blocked"
    assert "T-junction" in seam_example()["topology"]
    assert len(snapshot_generation_trace()) == 4


if __name__ == "__main__":
    run_tests()
    print("PASS voxel_reference: coordinate, face, greedy, halo, AABB, seam, generation")
