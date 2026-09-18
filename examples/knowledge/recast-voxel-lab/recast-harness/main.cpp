#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <vector>
#include <utility>

#include "DetourAlloc.h"
#include "DetourNavMesh.h"
#include "DetourNavMeshBuilder.h"
#include "DetourNavMeshQuery.h"
#include "DetourStatus.h"
#include "DetourTileCache.h"
#include "DetourTileCacheBuilder.h"

namespace {

struct LinearCompressor final : dtTileCacheCompressor {
    int maxCompressedSize(const int bufferSize) override { return bufferSize; }
    dtStatus compress(const unsigned char* buffer, const int bufferSize,
                      unsigned char* compressed, const int maxCompressedSize,
                      int* compressedSize) override {
        if (bufferSize < 0 || maxCompressedSize < bufferSize || compressedSize == nullptr) {
            return DT_FAILURE;
        }
        if (bufferSize > 0 && (buffer == nullptr || compressed == nullptr)) return DT_FAILURE;
        if (bufferSize > 0) std::memcpy(compressed, buffer, static_cast<size_t>(bufferSize));
        *compressedSize = bufferSize;
        return DT_SUCCESS;
    }
    dtStatus decompress(const unsigned char* compressed, const int compressedSize,
                        unsigned char* buffer, const int maxBufferSize,
                        int* bufferSize) override {
        if (compressedSize < 0 || maxBufferSize < compressedSize || bufferSize == nullptr) {
            return DT_FAILURE;
        }
        if (compressedSize > 0 && (compressed == nullptr || buffer == nullptr)) return DT_FAILURE;
        if (compressedSize > 0) std::memcpy(buffer, compressed, static_cast<size_t>(compressedSize));
        *bufferSize = compressedSize;
        return DT_SUCCESS;
    }
};

struct Allocator final : dtTileCacheAlloc {
    void* alloc(const size_t size) override { return dtAlloc(size, DT_ALLOC_PERM); }
    void free(void* ptr) override { dtFree(ptr); }
};

struct MeshProcess final : dtTileCacheMeshProcess {
    void process(struct dtNavMeshCreateParams* params,
                 unsigned char* polyAreas, unsigned short* polyFlags) override {
        if (params == nullptr || polyAreas == nullptr || polyFlags == nullptr) return;
        for (int i = 0; i < params->polyCount; ++i) {
            polyAreas[i] = 1;
            polyFlags[i] = 1;
        }
    }
};

void require(bool condition, const char* message) {
    if (!condition) {
        std::fprintf(stderr, "FAIL: %s\n", message);
        std::exit(1);
    }
}

struct NavMeshFixture {
    dtNavMesh* mesh = nullptr;
    unsigned char* navData = nullptr;
    int navDataSize = 0;

    NavMeshFixture() = default;
    NavMeshFixture(const NavMeshFixture&) = delete;
    NavMeshFixture& operator=(const NavMeshFixture&) = delete;
    NavMeshFixture(NavMeshFixture&& other) noexcept : mesh(other.mesh), navData(other.navData), navDataSize(other.navDataSize) { other.mesh = nullptr; other.navData = nullptr; }

    ~NavMeshFixture() {
        if (mesh != nullptr) dtFreeNavMesh(mesh);
        if (navData != nullptr) dtFree(navData);
    }
};

NavMeshFixture makeOneQuadMesh() {
    NavMeshFixture out;
    dtNavMeshCreateParams params{};
    const unsigned short verts[] = {0, 0, 0, 0, 0, 4, 4, 0, 4, 4, 0, 0};
    const unsigned short polys[] = {0, 1, 2, 3, 0xffff, 0xffff,
                                    0xffff, 0xffff};
    const unsigned char polyAreas[] = {1};
    const unsigned short polyFlags[] = {1};
    params.verts = verts;
    params.vertCount = 4;
    params.polys = polys;
    params.polyAreas = polyAreas;
    params.polyFlags = polyFlags;
    params.polyCount = 1;
    params.nvp = 4;
    params.walkableHeight = 2.0f;
    params.walkableRadius = 0.5f;
    params.walkableClimb = 0.5f;
    params.tileX = 0;
    params.tileY = 0;
    params.tileLayer = 0;
    params.bmin[0] = 0.0f; params.bmin[1] = 0.0f; params.bmin[2] = 0.0f;
    params.bmax[0] = 4.0f; params.bmax[1] = 1.0f; params.bmax[2] = 4.0f;
    params.cs = 1.0f; params.ch = 0.2f;
    params.buildBvTree = true;
    params.offMeshConCount = 0;
    require(dtCreateNavMeshData(&params, &out.navData, &out.navDataSize), "dtCreateNavMeshData");

    dtNavMeshParams meshParams{};
    meshParams.orig[0] = 0; meshParams.orig[1] = 0; meshParams.orig[2] = 0;
    meshParams.tileWidth = 4.0f; meshParams.tileHeight = 4.0f;
    meshParams.maxTiles = 4; meshParams.maxPolys = 8;
    out.mesh = dtAllocNavMesh();
    require(out.mesh != nullptr, "dtAllocNavMesh");
    require(dtStatusSucceed(out.mesh->init(&meshParams)), "dtNavMesh::init");
    dtTileRef tile = 0;
    require(dtStatusSucceed(out.mesh->addTile(out.navData, out.navDataSize, DT_TILE_FREE_DATA, 0, &tile)),
            "dtNavMesh::addTile");
    out.navData = nullptr;
    return out;
}

void testQuery() {
    NavMeshFixture fixture = makeOneQuadMesh();
    dtNavMeshQuery* query = dtAllocNavMeshQuery();
    require(query != nullptr, "dtAllocNavMeshQuery");
    require(dtStatusSucceed(query->init(fixture.mesh, 64)), "dtNavMeshQuery::init");
    dtQueryFilter filter;
    const float extents[] = {2, 2, 2};
    const float start[] = {0.5f, 0.0f, 0.5f};
    const float end[] = {3.5f, 0.0f, 3.5f};
    dtPolyRef startRef = 0;
    dtPolyRef endRef = 0;
    float nearestStart[3]{};
    float nearestEnd[3]{};
    require(dtStatusSucceed(query->findNearestPoly(start, extents, &filter, &startRef, nearestStart)),
            "findNearestPoly(start)");
    require(dtStatusSucceed(query->findNearestPoly(end, extents, &filter, &endRef, nearestEnd)),
            "findNearestPoly(end)");
    require(startRef != 0 && endRef != 0, "nearest polygon references");
    dtPolyRef path[8]{};
    int pathCount = 0;
    const dtStatus pathStatus = query->findPath(startRef, endRef, start, end, &filter,
                                                 path, &pathCount, 8);
    require(dtStatusSucceed(pathStatus), "findPath");
    require(pathCount == 1 && path[0] == startRef, "one-poly path");
    dtFreeNavMeshQuery(query);
}

void testTileLayerAndCache() {
    LinearCompressor compressor;
    Allocator allocator;
    MeshProcess meshProcess;
    dtTileCacheLayerHeader header{};
    header.magic = DT_TILECACHE_MAGIC;
    header.version = DT_TILECACHE_VERSION;
    header.tx = 0; header.ty = 0; header.tlayer = 0;
    header.bmin[0] = 0; header.bmin[1] = 0; header.bmin[2] = 0;
    header.bmax[0] = 4; header.bmax[1] = 1; header.bmax[2] = 4;
    header.width = 4; header.height = 4;
    header.minx = 0; header.maxx = 3; header.miny = 0; header.maxy = 3;
    header.hmin = 0; header.hmax = 4;
    const int cells = 16;
    std::vector<unsigned char> heights(static_cast<size_t>(cells), 0);
    std::vector<unsigned char> areas(static_cast<size_t>(cells), DT_TILECACHE_WALKABLE_AREA);
    std::vector<unsigned char> cons(static_cast<size_t>(cells), 0);
    for (int z = 0; z < 4; ++z) for (int x = 0; x < 4; ++x) {
        cons[z * 4 + x] = static_cast<unsigned char>(
            (x > 0 ? 1 : 0) | (z < 3 ? 2 : 0) |
            (x < 3 ? 4 : 0) | (z > 0 ? 8 : 0));
    }
    unsigned char* compressed = nullptr;
    int compressedSize = 0;
    require(dtStatusSucceed(dtBuildTileCacheLayer(&compressor, &header, heights.data(), areas.data(),
                                                   cons.data(), &compressed, &compressedSize)),
            "dtBuildTileCacheLayer");
    require(compressed != nullptr && compressedSize > 0, "compressed layer output");

    dtTileCacheLayer* decompressed = nullptr;
    require(dtStatusSucceed(dtDecompressTileCacheLayer(&allocator, &compressor, compressed,
                                                        compressedSize, &decompressed)),
            "dtDecompressTileCacheLayer");
    require(decompressed != nullptr && decompressed->header->tx == 0, "layer header round trip");
    dtFreeTileCacheLayer(&allocator, decompressed);

    dtTileCacheParams params{};
    params.orig[0] = 0; params.orig[1] = 0; params.orig[2] = 0;
    params.cs = 1.0f; params.ch = 0.2f;
    params.width = 4; params.height = 4;
    params.walkableHeight = 2; params.walkableRadius = 0.5f; params.walkableClimb = 0.5f;
    params.maxSimplificationError = 1.3f;
    params.maxTiles = 4; params.maxObstacles = 4;
    dtTileCache* cache = dtAllocTileCache();
    require(cache != nullptr, "dtAllocTileCache");
    require(dtStatusSucceed(cache->init(&params, &allocator, &compressor, &meshProcess)),
            "dtTileCache::init");
    bool upToDate = false;
    require(dtStatusSucceed(cache->update(0.0f, nullptr, &upToDate)), "empty update");
    require(upToDate, "empty cache reports up to date");
    NavMeshFixture fixture = makeOneQuadMesh();
    dtCompressedTileRef layerRef = 0;
    require(dtStatusSucceed(cache->addTile(compressed, compressedSize,
                DT_COMPRESSEDTILE_FREE_DATA, &layerRef)), "cache add layer");
    compressed = nullptr; // cache now owns the compressed bytes
    require(dtStatusSucceed(cache->buildNavMeshTile(layerRef, fixture.mesh)), "build walkable tile");
    const auto hasPolygon = [&]() {
        const dtMeshTile* tile = fixture.mesh->getTileAt(0, 0, 0);
        return tile != nullptr && tile->header != nullptr && tile->header->polyCount > 0;
    };
    require(hasPolygon(), "walkable layer has polygons");
    const float obstacleMin[] = {-1, -1, -1};
    const float obstacleMax[] = {5, 3, 5};
    dtObstacleRef obstacle = 0;
    require(dtStatusSucceed(cache->addBoxObstacle(obstacleMin, obstacleMax, &obstacle)), "queue obstacle");
    const auto drain = [&]() {
        bool done = false;
        for (int tick = 0; tick < 32 && !done; ++tick)
            require(dtStatusSucceed(cache->update(0.0f, fixture.mesh, &done)), "obstacle update");
        require(done, "bounded cache update drain");
    };
    drain();
    require(cache->getObstacleByRef(obstacle)->state == DT_OBSTACLE_PROCESSED, "obstacle processed");
    require(!hasPolygon(), "covering obstacle removes walkable tile");
    require(dtStatusSucceed(cache->removeObstacle(obstacle)), "queue obstacle removal");
    drain();
    require(hasPolygon(), "obstacle removal restores walkable tile");
    dtFreeTileCache(cache);
}

}  // namespace

int main() {
    testQuery();
    testTileLayerAndCache();
    std::puts("PASS recast_lifetime_harness: query, layer round-trip, cache init/update/teardown");
    return 0;
}
