import re

file_path = r'e:\Saraswathan\AI\mx-player-source\artifacts\srkplayer\app\player.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix: insert the missing variable declarations after _currentTime
old_block = """  let _playing = false;
  let _currentTime = 0;


  return {"""

new_block = """  let _playing = false;
  let _currentTime = 0;
  let _duration = 0;
  let _loop = false;
  let _playbackRate = 1;
  let _volume = 1;
  let _muted = false;

  return {"""

if old_block in content:
    content = content.replace(old_block, new_block)
    print("Fixed: Restored _duration, _loop, _playbackRate, _volume, _muted variables")
else:
    print("WARNING: Could not find the exact block to fix. Checking alternatives...")
    # Try a more flexible match
    if 'let _playing = false;' in content and 'let _duration = 0;' not in content:
        # Insert after _currentTime line
        content = content.replace(
            '  let _currentTime = 0;\n',
            '  let _currentTime = 0;\n  let _duration = 0;\n  let _loop = false;\n  let _playbackRate = 1;\n  let _volume = 1;\n  let _muted = false;\n'
        )
        print("Fixed (alternative): Inserted missing variables after _currentTime")
    else:
        print("Variables may already be present or file structure is unexpected")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done! File saved.")
