import os

path = r'e:\Saraswathan\AI\mx-player-source\artifacts\srkplayer\app\player.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Try to find the missing file block and disable it
old_line = 'if (playbackUri.startsWith("file://") || playbackUri.startsWith("content://") || playbackUri.startsWith("/")) {'
new_line = 'if (false) { // Hard disabled by script'

if old_line in content:
    content = content.replace(old_line, new_line)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Successfully patched player.tsx via string replace")
else:
    print("Direct string match failed, trying flexible match")
    import re
    # Match the if statement even if whitespaces vary
    pattern = r'if\s*\(\s*playbackUri\.startsWith\("file://"\)\s*\|\|\s*playbackUri\.startsWith\("content://"\)\s*\|\|\s*playbackUri\.startsWith\("/"\)\s*\)\s*\{'
    if re.search(pattern, content):
        content = re.sub(pattern, new_line, content)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print("Successfully patched player.tsx via regex")
    else:
        print("Even regex match failed")
        # Try to find ANY "Missing File" alert and disable the whole block
        if '"Missing File"' in content:
            print("Found 'Missing File' string, attempting to find its enclosing if block")
            # We'll just replace the whole try-catch if block if possible
            # But let's try a very broad regex for the startsWith check
            pattern = r'if\s*\(\s*playbackUri\.startsWith\(["\']file://["\']\)'
            if re.search(pattern, content):
                 content = re.sub(pattern, 'if (false && playbackUri.startsWith("file://")', content)
                 with open(path, 'w', encoding='utf-8') as f:
                     f.write(content)
                 print("Successfully patched player.tsx via broad regex")
            else:
                 print("Could not find any known pattern")
