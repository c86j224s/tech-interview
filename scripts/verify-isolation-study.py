"""Real two-connection SQLite WAL visibility checks, not cross-engine emulation."""
import pathlib
import sqlite3
import tempfile

with tempfile.TemporaryDirectory(prefix='study-isolation-') as directory:
    database = str(pathlib.Path(directory) / 'state.db')
    a = sqlite3.connect(database, isolation_level=None, timeout=1)
    b = sqlite3.connect(database, isolation_level=None, timeout=1)
    try:
        assert a.execute('PRAGMA journal_mode=WAL').fetchone()[0] == 'wal'
        a.execute('CREATE TABLE mvcc_demo(id INTEGER PRIMARY KEY, value INTEGER)')
        a.execute('INSERT INTO mvcc_demo VALUES(1,100)')
        a.execute('BEGIN')
        first = a.execute('SELECT value FROM mvcc_demo WHERE id=1').fetchone()[0]
        b.execute('BEGIN')
        b.execute('UPDATE mvcc_demo SET value=120 WHERE id=1')
        b.execute('COMMIT')
        second = a.execute('SELECT value FROM mvcc_demo WHERE id=1').fetchone()[0]
        assert (first, second) == (100, 100)
        try:
            a.execute('UPDATE mvcc_demo SET value=130 WHERE id=1')
        except sqlite3.OperationalError as error:
            assert 'locked' in str(error).lower()
            print('stale snapshot write rejected:', str(error),
                  getattr(error, 'sqlite_errorname', 'extended error name unavailable'))
        else:
            raise AssertionError('stale read transaction unexpectedly upgraded to writer')
        a.execute('ROLLBACK')
        assert a.execute('SELECT value FROM mvcc_demo WHERE id=1').fetchone()[0] == 120
        b.execute('UPDATE mvcc_demo SET value=140 WHERE id=1')
        assert a.execute('SELECT value FROM mvcc_demo WHERE id=1').fetchone()[0] == 140
        a.execute('BEGIN')
        a.execute('UPDATE mvcc_demo SET value=150 WHERE id=1')
        assert a.execute('SELECT value FROM mvcc_demo WHERE id=1').fetchone()[0] == 150
        a.execute('ROLLBACK')
        assert b.execute('SELECT value FROM mvcc_demo WHERE id=1').fetchone()[0] == 140
        print('SQLite', sqlite3.sqlite_version,
              'PASS: transaction snapshot=100/100, autocommit=120/140, own write=150, rollback=140')
    finally:
        a.close()
        b.close()
