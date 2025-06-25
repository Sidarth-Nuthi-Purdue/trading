// Let me verify no session references exist by checking line 50 specifically
// The error says line 50 has session.user.id but the file shows user.id

// This suggests either:
// 1. The file wasn't saved properly
// 2. There's a caching issue
// 3. The error is from a different file

// Let me completely rewrite the problematic section