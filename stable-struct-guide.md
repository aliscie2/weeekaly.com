# IC Stable Structures Guide

## Key Principles

1. **Single MEMORY_MANAGER**: One global memory manager for all stable structures
2. **Unique MemoryId**: Each stable structure gets a unique MemoryId (0, 1, 2, etc.)
3. **Thread-local storage**: All stable structures in `thread_local!` block
4. **No .cloned()**: StableBTreeMap.get() returns the value directly, not Option that needs cloning

## Pattern

```rust
use ic_stable_structures::memory_manager::{MemoryId, MemoryManager, VirtualMemory};
use ic_stable_structures::{DefaultMemoryImpl, StableBTreeMap};

type Memory = VirtualMemory<DefaultMemoryImpl>;

thread_local! {
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> =
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));

    static STORE_NAME: RefCell<StableBTreeMap<KeyType, ValueType, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(0))),
        )
    );
}
```

## Usage

```rust
// Get (returns Option<T>, not Option<&T>)
STORE.with(|s| s.borrow().get(&key))

// Insert
STORE.with(|s| s.borrow_mut().insert(key, value))

// Remove
STORE.with(|s| s.borrow_mut().remove(&key))

// Iterate
STORE.with(|s| {
    s.borrow().iter().map(|(k, v)| {
        // k and v are owned values
    }).collect()
})
```

## Memory IDs Used in Our Project

- MemoryId(0): AVAILABILITIES (in availabilities.rs)
- MemoryId(1): USER_AVAILABILITIES (in availabilities.rs)
- MemoryId(2): USER_TOKENS (in lib.rs)

## Important Notes

- Data persists across canister upgrades
- No need for pre_upgrade/post_upgrade hooks
- StableBTreeMap handles serialization automatically
- Keys and values must implement Storable trait
