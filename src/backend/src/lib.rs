use ic_cdk_macros::query;

// Simple hello world query function
#[query]
fn hello_world() -> String {
    "Hello, World from oDoc backend!".to_string()
}

// Simple greeting function with parameter
#[query]
fn greet(name: String) -> String {
    format!("Hello, {}! Welcome to oDoc.", name)
}

ic_cdk_macros::export_candid!();
