"""Run bounded, dependency-free examples used by the Python study notes."""
import asyncio
import copy
import gc
import io
import platform
import weakref
from contextvars import ContextVar


def add_shared(item, bucket=[]):
    bucket.append(item)
    return bucket


def add_fresh(item, bucket=None):
    if bucket is None:
        bucket = []
    bucket.append(item)
    return bucket


assert add_shared('a') == ['a']
assert add_shared('b') == ['a', 'b']
assert add_fresh('a') == ['a']
assert add_fresh('b') == ['b']
late = [lambda: i for i in range(3)]
fixed = [lambda i=i: i for i in range(3)]
assert [f() for f in late] == [2, 2, 2]
assert [f() for f in fixed] == [0, 1, 2]
shared = []
graph = {'a': shared, 'b': shared}
graph['self'] = graph
cloned = copy.deepcopy(graph)
assert cloned['a'] is cloned['b'] and cloned['a'] is not shared
assert cloned['self'] is cloned


def child():
    value = yield 'ready'
    return value * 2


def parent():
    result = yield from child()
    yield result


it = parent()
assert next(it) == 'ready'
assert it.send(3) == 6
assert list(it) == []
assert list(it) == []
closed = []


def resource_generator():
    try:
        yield 1
        yield 2
    finally:
        closed.append(True)


it = resource_generator()
assert next(it) == 1
it.close()
assert closed == [True]


class A:
    def f(self):
        return ['A']


class B(A):
    def f(self):
        return ['B'] + super().f()


class C(A):
    def f(self):
        return ['C'] + super().f()


class D(B, C):
    pass


assert [t.__name__ for t in D.__mro__] == ['D', 'B', 'C', 'A', 'object']
assert D().f() == ['B', 'C', 'A']


class Scope:
    def __init__(self, suppress):
        self.suppress = suppress
        self.exited = False

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        self.exited = True
        return self.suppress


scope = Scope(True)
with scope:
    raise ValueError('intentionally suppressed')
assert scope.exited
scope = Scope(False)
try:
    with scope:
        raise ValueError('propagated')
except ValueError as error:
    assert str(error) == 'propagated'
else:
    raise AssertionError('exception was swallowed')
assert scope.exited
with io.StringIO('ok') as stream:
    assert stream.read() == 'ok'
assert stream.closed


class Node:
    pass


node = Node()
node.self = node
ref = weakref.ref(node)
del node
gc.collect()
assert ref() is None

rows = [('A', 10, 2), ('B', 10, 1), ('C', 20, 3)]
key_calls = []
rows.sort(key=lambda r: r[2])


def score(row):
    key_calls.append(row[0])
    return row[1]


rows.sort(key=score, reverse=True)
assert [r[0] for r in rows] == ['C', 'B', 'A']
assert len(key_calls) == 3

user = ContextVar('user', default='outer')


async def context_example():
    ready_a = asyncio.Event()
    ready_b = asyncio.Event()

    async def a():
        token = user.set('A')
        try:
            ready_a.set()
            await ready_b.wait()
            return user.get()
        finally:
            user.reset(token)

    async def b():
        await ready_a.wait()
        token = user.set('B')
        try:
            ready_b.set()
            await asyncio.sleep(0)
            return user.get()
        finally:
            user.reset(token)

    assert await asyncio.gather(a(), b()) == ['A', 'B']
    assert user.get() == 'outer'


asyncio.run(context_example())
print(platform.python_implementation(), platform.python_version(),
      'PASS: defaults, copying, generators, MRO, cleanup, cycles, sorting, contextvars')
if not hasattr(asyncio, 'TaskGroup'):
    print('SKIP: TaskGroup requires Python 3.11+; not substituted with gather')
else:
    async def group_example():
        entered = asyncio.Event()
        cleaned = asyncio.Event()

        async def sibling():
            try:
                entered.set()
                await asyncio.Event().wait()
            finally:
                cleaned.set()

        async def failing():
            await entered.wait()
            raise ValueError('required task failed')

        try:
            async with asyncio.TaskGroup() as group:
                group.create_task(sibling())
                group.create_task(failing())
        except BaseExceptionGroup as errors:
            assert any(isinstance(error, ValueError) for error in errors.exceptions)
        else:
            raise AssertionError('TaskGroup failure was hidden')
        assert cleaned.is_set()

    asyncio.run(group_example())
    print('PASS: TaskGroup sibling cancellation, cleanup and grouped error')
