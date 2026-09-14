"""Check relational examples in an isolated in-memory SQLite database."""
import itertools
import sqlite3


def closure(attributes, dependencies):
    result = set(attributes)
    while True:
        before = set(result)
        for left, right in dependencies:
            if set(left) <= result:
                result.update(right)
        if result == before:
            return result


def keys(attributes, dependencies):
    found = []
    for size in range(len(attributes) + 1):
        for candidate in itertools.combinations(attributes, size):
            candidate = set(candidate)
            if any(key <= candidate for key in found):
                continue
            if closure(candidate, dependencies) == set(attributes):
                found.append(candidate)
    return found


assert closure('A', [('A', 'B'), ('B', 'C'), ('AC', 'D')]) == set('ABCD')
assert keys('SCI', [('SC', 'I'), ('I', 'C')]) == [set('SC'), set('SI')]
assert keys('ABCD', [('A', 'BC'), ('BC', 'AD'), ('B', 'D')]) == [set('A'), set('BC')]

con = sqlite3.connect(':memory:')
con.executescript('''
CREATE TABLE r(a TEXT, b TEXT, c TEXT);
INSERT INTO r VALUES ('a1','b1','c1'), ('a2','b1','c2');
CREATE TABLE members(id INTEGER PRIMARY KEY, name TEXT);
INSERT INTO members VALUES (1,'A'),(2,'B'),(3,'C');
CREATE TABLE orders(id INTEGER PRIMARY KEY, member_id INTEGER);
INSERT INTO orders VALUES (10,1),(11,1),(12,1),(13,2),(14,NULL);
CREATE TABLE numbers(x INTEGER);
INSERT INTO numbers VALUES (1),(2),(NULL);
CREATE TABLE employees(id INTEGER PRIMARY KEY, department_id INTEGER, score INTEGER);
INSERT INTO employees VALUES (1,1,100),(2,1,100),(3,1,90),(4,1,80);
''')
original = set(con.execute('SELECT * FROM r'))
lossless = set(con.execute('''SELECT ab.a, ab.b, ac.c
FROM (SELECT DISTINCT a,b FROM r) ab
JOIN (SELECT DISTINCT a,c FROM r) ac ON ac.a=ab.a'''))
lossy = set(con.execute('''SELECT ab.a, ab.b, bc.c
FROM (SELECT DISTINCT a,b FROM r) ab
JOIN (SELECT DISTINCT b,c FROM r) bc ON bc.b=ab.b'''))
assert lossless == original
assert len(lossy) == 4 and original < lossy
assert list(con.execute('SELECT x FROM numbers WHERE x NOT IN (1,NULL)')) == []
assert list(con.execute('SELECT COUNT(*),COUNT(x) FROM numbers')) == [(3, 2)]
assert list(con.execute('''SELECT m.id FROM members m
WHERE EXISTS (SELECT 1 FROM orders o WHERE o.member_id=m.id) ORDER BY m.id''')) == [(1,), (2,)]
assert list(con.execute('''SELECT m.id FROM members m
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.member_id=m.id) ORDER BY m.id''')) == [(3,)]
assert list(con.execute('''SELECT m.id FROM members m JOIN orders o ON o.member_id=m.id
ORDER BY m.id,o.id LIMIT 2''')) == [(1,), (1,)]
page = list(con.execute('''WITH p AS (SELECT id FROM members ORDER BY id LIMIT 2)
SELECT p.id,o.id FROM p LEFT JOIN orders o ON o.member_id=p.id ORDER BY p.id,o.id'''))
assert {row[0] for row in page} == {1, 2}
assert list(con.execute('''SELECT score,
ROW_NUMBER() OVER (ORDER BY score DESC,id),
RANK() OVER (ORDER BY score DESC),
DENSE_RANK() OVER (ORDER BY score DESC)
FROM employees ORDER BY score DESC,id''')) == [(100,1,1,1),(100,2,1,1),(90,3,3,2),(80,4,4,3)]
name = "O'Reilly_%"
con.execute('INSERT INTO members(id,name) VALUES (?,?)', (4, name))
assert list(con.execute('SELECT id FROM members WHERE name=?', (name,))) == [(4,)]
assert list(con.execute('SELECT id FROM members WHERE name=?', ('not present',))) == []
print('SQLite', sqlite3.sqlite_version, 'PASS: NULL, EXISTS, parent pages, ranking, value binding')
print('PASS: FD closure, candidate keys, lossless and spurious join examples')
print('Scope: SQLite result semantics only; not PostgreSQL/MySQL/SQL Server concurrency validation')
con.close()
