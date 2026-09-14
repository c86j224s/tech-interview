#include <atomic>
#include <cassert>
#include <cstdint>
#include <iostream>
#include <memory>
#include <span>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

int category(const std::string&) { return 1; }
int category(std::string&&) { return 2; }
template<class T> int forwarded(T&& value) {
    return category(std::forward<T>(value));
}

struct Item {
    static inline int copies = 0;
    static inline int moves = 0;
    Item() = default;
    Item(const Item&) { ++copies; }
    Item(Item&&) noexcept { ++moves; }
};

std::uint32_t read_be32(std::span<const std::uint8_t> input) {
    if (input.size() < 4) throw std::runtime_error("truncated length");
    return (std::uint32_t(input[0]) << 24)
         | (std::uint32_t(input[1]) << 16)
         | (std::uint32_t(input[2]) << 8)
         | std::uint32_t(input[3]);
}

struct State { int left; int right; };

int main() {
    std::string value = "value";
    const std::string constant = "constant";
    assert(category(value) == 1);
    assert(category(std::move(value)) == 2);
    assert(category(std::move(constant)) == 1);
    assert(forwarded(value) == 1);
    assert(forwarded(std::string("temporary")) == 2);
    std::string&& named = std::move(value);
    assert(category(named) == 1);

    std::vector<Item> items;
    items.reserve(2);
    items.emplace_back();
    items.emplace_back();
    const auto count = items.size();
    items.reserve(items.capacity() + 1);
    assert(items.size() == count);
    std::cout << "noexcept vector relocation: copies=" << Item::copies
              << " moves=" << Item::moves << '\n';

    std::vector<int> numbers;
    numbers.reserve(3);
    numbers.push_back(10);
    const int* first = &numbers[0];
    numbers.push_back(20);
    assert(first == &numbers[0]);
    numbers.erase(numbers.begin());
    assert(numbers[0] == 20); // Do not use the invalidated pointer.

    const std::uint8_t bytes[] = {0xFF, 0x12, 0x34, 0x56, 0x78};
    assert(read_be32(std::span(bytes).subspan(1)) == 0x12345678u);
    assert(read_be32(std::span(bytes)) == 0xFF123456u);
    bool truncated = false;
    try { read_be32(std::span(bytes).first(3)); }
    catch (const std::runtime_error&) { truncated = true; }
    assert(truncated);

    std::weak_ptr<int> weak;
    {
        auto owner = std::make_shared<int>(42);
        weak = owner;
        auto held = weak.lock();
        owner.reset();
        assert(*held == 42);
    }
    assert(!weak.lock());
#if defined(__cpp_lib_atomic_shared_ptr) && __cpp_lib_atomic_shared_ptr >= 201711L
    std::atomic<std::shared_ptr<const State>> root;
    root.store(std::make_shared<const State>(State{3, 7}), std::memory_order_release);
    auto snapshot = root.load(std::memory_order_acquire);
    root.store(std::make_shared<const State>(State{4, 6}), std::memory_order_release);
    assert(snapshot->left == 3 && snapshot->right == 7);
    assert(root.load()->left == 4);
    std::cout << "PASS: atomic shared_ptr snapshot example\n";
#else
    std::cout << "SKIP: standard library lacks __cpp_lib_atomic_shared_ptr\n";
#endif
    std::cout << "PASS: value categories, valid iterator use, decoding, ownership\n";
}
