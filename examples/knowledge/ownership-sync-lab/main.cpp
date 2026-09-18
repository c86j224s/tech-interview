#include <atomic>
#include <cassert>
#include <chrono>
#include <condition_variable>
#include <cstdint>
#include <deque>
#include <iostream>
#include <memory>
#include <mutex>
#include <optional>
#include <string>
#include <thread>
#include <utility>
#include <vector>

namespace lab {

class CountDownLatch {
 public:
  explicit CountDownLatch(std::size_t count) : count_(count) {}

  void arrive() {
    std::lock_guard<std::mutex> lock(mutex_);
    assert(count_ > 0);
    --count_;
    if (count_ == 0) {
      condition_.notify_all();
    }
  }

  void wait() {
    std::unique_lock<std::mutex> lock(mutex_);
    condition_.wait(lock, [this] { return count_ == 0; });
  }

 private:
  std::mutex mutex_;
  std::condition_variable condition_;
  std::size_t count_;
};

struct CycleNode {
  explicit CycleNode(std::string node_name) : name(std::move(node_name)) {
    ++live_count;
  }

  ~CycleNode() { --live_count; }

  std::string name;
  std::shared_ptr<CycleNode> child;
  std::weak_ptr<CycleNode> parent;
  static std::atomic<int> live_count;
};

std::atomic<int> CycleNode::live_count{0};

struct CycleWitness {
  std::weak_ptr<CycleNode> left;
  std::weak_ptr<CycleNode> right;
};

CycleWitness make_cycle() {
  auto left = std::make_shared<CycleNode>("left");
  auto right = std::make_shared<CycleNode>("right");
  left->child = right;
  right->child = left;
  right->parent = left;
  return {left, right};
}

void test_cycle_and_weak_lock() {
  assert(CycleNode::live_count.load() == 0);
  const CycleWitness witness = make_cycle();
  assert(CycleNode::live_count.load() == 2);

  // A weak observation does not keep either node alive. Locking makes a
  // temporary strong owner for the exact scope in which we repair the cycle.
  auto left = witness.left.lock();
  auto right = witness.right.lock();
  assert(left && right);
  assert(left->child && right->child);
  left->child.reset();
  right->child.reset();
  left.reset();
  right.reset();
  assert(witness.left.expired());
  assert(witness.right.expired());
  assert(CycleNode::live_count.load() == 0);

  auto owner = std::make_shared<CycleNode>("weak-lock");
  std::weak_ptr<CycleNode> observer = owner;
  CountDownLatch entered(1);
  CountDownLatch proceed(1);
  bool locked_while_alive = false;
  bool locked_after_release = true;
  std::thread reader([&] {
    entered.arrive();
    proceed.wait();
    locked_while_alive = static_cast<bool>(observer.lock());
    proceed.wait();
    locked_after_release = static_cast<bool>(observer.lock());
  });

  entered.wait();
  proceed.arrive();
  reader.join();
  assert(locked_while_alive);

  owner.reset();
  CountDownLatch second_reader_done(1);
  std::thread second_reader([&] {
    locked_after_release = static_cast<bool>(observer.lock());
    second_reader_done.arrive();
  });
  second_reader_done.wait();
  second_reader.join();
  assert(!locked_after_release);
  assert(CycleNode::live_count.load() == 0);
  std::cout << "PASS cycle-and-weak-lock\n";
}

enum class CloseMode { kDrain, kCancel };

enum class PopKind { kItem, kClosed, kCancelled };

template <typename T>
struct PopResult {
  PopKind kind;
  T value;
};

template <typename T>
class BoundedQueue {
 public:
  explicit BoundedQueue(std::size_t capacity) : capacity_(capacity) {
    assert(capacity_ > 0);
  }

  bool try_push(T item) {
    std::lock_guard<std::mutex> lock(mutex_);
    if (closed_ || cancelled_ || items_.size() == capacity_) {
      return false;
    }
    items_.push_back(std::move(item));
    not_empty_.notify_one();
    return true;
  }

  PopResult<T> pop() {
    std::unique_lock<std::mutex> lock(mutex_);
    not_empty_.wait(lock, [this] {
      return !items_.empty() || closed_ || cancelled_;
    });
    if (cancelled_) {
      return {PopKind::kCancelled, T{}};
    }
    if (items_.empty()) {
      return {PopKind::kClosed, T{}};
    }
    T item = std::move(items_.front());
    items_.pop_front();
    not_full_.notify_one();
    return {PopKind::kItem, std::move(item)};
  }

  bool push_wait(T item, CountDownLatch& waiting) {
    std::unique_lock<std::mutex> lock(mutex_);
    waiting.arrive();
    not_full_.wait(lock, [this] {
      return items_.size() < capacity_ || closed_ || cancelled_;
    });
    if (closed_ || cancelled_) {
      return false;
    }
    items_.push_back(std::move(item));
    not_empty_.notify_one();
    return true;
  }

  std::vector<T> close(CloseMode mode) {
    std::vector<T> discarded;
    {
      std::lock_guard<std::mutex> lock(mutex_);
      closed_ = true;
      if (mode == CloseMode::kCancel) {
        cancelled_ = true;
        while (!items_.empty()) {
          discarded.push_back(std::move(items_.front()));
          items_.pop_front();
        }
      }
    }
    not_empty_.notify_all();
    not_full_.notify_all();
    return discarded;
  }

  std::size_t size() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return items_.size();
  }

 private:
  const std::size_t capacity_;
  mutable std::mutex mutex_;
  std::condition_variable not_empty_;
  std::condition_variable not_full_;
  std::deque<T> items_;
  bool closed_ = false;
  bool cancelled_ = false;
};

void test_bounded_queue_shutdown_and_cancel() {
  BoundedQueue<int> draining(2);
  assert(draining.try_push(10));
  assert(draining.try_push(20));
  assert(!draining.try_push(30));

  CountDownLatch producer_waiting(1);
  bool producer_accepted = true;
  std::thread producer([&] {
    producer_accepted = draining.push_wait(30, producer_waiting);
  });
  producer_waiting.wait();
  const auto discarded_by_drain = draining.close(CloseMode::kDrain);
  producer.join();
  assert(discarded_by_drain.empty());
  assert(!producer_accepted);
  assert(draining.pop().value == 10);
  assert(draining.pop().value == 20);
  assert(draining.pop().kind == PopKind::kClosed);

  BoundedQueue<int> cancelled(2);
  assert(cancelled.try_push(40));
  const auto discarded = cancelled.close(CloseMode::kCancel);
  assert(discarded.size() == 1 && discarded.front() == 40);
  assert(cancelled.pop().kind == PopKind::kCancelled);
  assert(!cancelled.try_push(50));
  assert(cancelled.size() == 0);
  std::cout << "PASS bounded-queue-drain-and-cancel\n";
}

struct RefcountModel {
  int strong = 1;
  int weak = 1;  // The implicit weak owner held while strong > 0.
  bool object_disposed = false;
  bool control_block_freed = false;

  void add_weak() { ++weak; }

  bool lock_weak() {
    if (strong == 0) {
      return false;
    }
    ++strong;
    return true;
  }

  void release_strong() {
    assert(strong > 0);
    --strong;
    if (strong == 0) {
      object_disposed = true;
      release_weak();
    }
  }

  void release_weak() {
    assert(weak > 0);
    --weak;
    if (weak == 0) {
      control_block_freed = true;
    }
  }
};

void test_refcount_state_model() {
  RefcountModel model;
  model.add_weak();
  assert(model.strong == 1 && model.weak == 2);
  assert(model.lock_weak());
  assert(model.strong == 2);
  model.release_strong();
  model.release_strong();
  assert(model.object_disposed);
  assert(model.strong == 0 && model.weak == 1);
  assert(!model.lock_weak());
  model.release_weak();
  assert(model.control_block_freed);
  std::cout << "PASS refcount-state-model\n";
}

struct TaggedObservation {
  const void* address;
  std::uint64_t generation;
};

void test_aba_counterexample() {
  int storage = 0;
  const TaggedObservation old_a{&storage, 7};
  int other_storage = 1;
  const TaggedObservation b{&other_storage, 8};
  const TaggedObservation new_a{&storage, 9};

  // This is only a state trace: no object is freed or accessed through a
  // stale pointer. Address-only CAS cannot distinguish old_a from new_a.
  assert(old_a.address != b.address && b.address != new_a.address);
  assert(old_a.address == new_a.address);
  assert(old_a.generation != new_a.generation);
  std::cout << "PASS aba-state-trace (illustrative; no lock-free structure)\n";
}

}  // namespace lab

int main() {
  try {
    lab::test_cycle_and_weak_lock();
    lab::test_bounded_queue_shutdown_and_cancel();
    lab::test_refcount_state_model();
    lab::test_aba_counterexample();
    std::cout << "PASS all\n";
    return 0;
  } catch (...) {
    std::cerr << "FAIL unexpected exception\n";
    return 1;
  }
}
