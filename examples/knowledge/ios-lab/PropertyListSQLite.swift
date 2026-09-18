import Foundation
import SQLite3

struct Settings: Codable, Equatable {
    var schemaVersion: Int
    var displayName: String
}

func propertyListRoundTrip(at url: URL) throws {
    let original = Settings(schemaVersion: 1, displayName: "local")
    let encoder = PropertyListEncoder()
    encoder.outputFormat = .xml
    let data = try encoder.encode(original)
    try data.write(to: url, options: .atomic)

    let decoded = try PropertyListDecoder().decode(Settings.self, from: Data(contentsOf: url))
    precondition(decoded == original)
    print("plist round trip: schema=\(decoded.schemaVersion), name=\(decoded.displayName)")
}

func sqliteMigration(at url: URL) throws {
    var database: OpaquePointer?
    guard sqlite3_open(url.path, &database) == SQLITE_OK else {
        defer { if database != nil { sqlite3_close(database) } }
        throw NSError(domain: "SQLite", code: 1, userInfo: [NSLocalizedDescriptionKey: "sqlite3_open failed"])
    }
    defer { sqlite3_close(database) }

    func exec(_ sql: String) throws {
        var errorMessage: UnsafeMutablePointer<CChar>?
        defer { sqlite3_free(errorMessage) }
        guard sqlite3_exec(database, sql, nil, nil, &errorMessage) == SQLITE_OK else {
            let message = errorMessage.map { String(cString: $0) } ?? "unknown sqlite error"
            throw NSError(domain: "SQLite", code: 2, userInfo: [NSLocalizedDescriptionKey: message])
        }
    }

    try exec("CREATE TABLE settings (id INTEGER PRIMARY KEY, display_name TEXT NOT NULL);")
    try exec("INSERT INTO settings (display_name) VALUES ('before-migration');")
    try exec("BEGIN IMMEDIATE;")
    do {
        try exec("ALTER TABLE settings ADD COLUMN schema_version INTEGER NOT NULL DEFAULT 1;")
        try exec("UPDATE settings SET schema_version = 2 WHERE id = 1;")
        try exec("PRAGMA user_version = 2;")
        try exec("COMMIT;")
    } catch {
        try? exec("ROLLBACK;")
        throw error
    }
    var row: OpaquePointer?
    guard sqlite3_prepare_v2(database, "SELECT display_name, schema_version FROM settings WHERE id=1", -1, &row, nil) == SQLITE_OK else {
        throw NSError(domain: "SQLite", code: 3)
    }
    defer { sqlite3_finalize(row) }
    precondition(sqlite3_step(row) == SQLITE_ROW)
    precondition(String(cString: sqlite3_column_text(row, 0)) == "before-migration")
    precondition(sqlite3_column_int(row, 1) == 2)
    precondition(sqlite3_step(row) == SQLITE_DONE)
    var check: OpaquePointer?
    guard sqlite3_prepare_v2(database, "PRAGMA foreign_key_check", -1, &check, nil) == SQLITE_OK else {
        throw NSError(domain: "SQLite", code: 4)
    }
    defer { sqlite3_finalize(check) }
    precondition(sqlite3_step(check) == SQLITE_DONE)
    print("PASS sqlite migration: transaction committed, original value preserved, version=2")
}

let base = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let plistURL = base.appendingPathComponent("ios-lab-settings.plist")
let sqliteURL = base.appendingPathComponent("ios-lab.sqlite3")
defer {
    try? FileManager.default.removeItem(at: plistURL)
    try? FileManager.default.removeItem(at: sqliteURL)
}

try propertyListRoundTrip(at: plistURL)
try sqliteMigration(at: sqliteURL)
