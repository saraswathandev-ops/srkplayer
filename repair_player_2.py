import os

path = r'e:\Saraswathan\AI\mx-player-source\artifacts\srkplayer\app\player.tsx'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the line with videoWrapperProps
insert_idx = -1
for i, line in enumerate(lines):
    if 'const videoWrapperProps =' in line:
        insert_idx = i + 2 # Skip the next line which is the value
        break

if insert_idx != -1:
    new_code = [
        '\n',
        '  const showHud = useCallback((mode: GestureMode, label: string, progress: number) => {\n',
        '    setGestureHud({\n',
        '      mode,\n',
        '      label,\n',
        '      progress: clamp01(progress),\n',
        '    });\n',
        '\n',
        '    if (hudTimer.current) clearTimeout(hudTimer.current);\n',
        '    hudTimer.current = setTimeout(() => {\n',
        '      if (isMounted.current) setGestureHud(null);\n',
        '    }, HUD_TIMEOUT);\n',
        '  }, []);\n'
    ]
    lines[insert_idx:insert_idx] = new_code
    with open(path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print("Successfully inserted showHud into player.tsx")
else:
    print("Could not find insertion point in player.tsx")
