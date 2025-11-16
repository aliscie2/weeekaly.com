use ic_stable_structures::memory_manager::{MemoryManager, VirtualMemory};
use ic_stable_structures::DefaultMemoryImpl;
use std::cell::RefCell;

pub type Memory = VirtualMemory<DefaultMemoryImpl>;

thread_local! {
    pub static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> =
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));
}
