import os
import shutil

ROOT_DIR = r"e:\Saraswathan\AI\mx-player-source\artifacts\srkplayer\docs"
PROPOSALS_DIR = os.path.join(ROOT_DIR, "proposals")

os.makedirs(PROPOSALS_DIR, exist_ok=True)

files_to_move = [
    "NEW_FEATURE_IMPLEMENTATION.md",
    "SQLITE_PLAYLIST_IMPLEMENTATION.md",
    "advanced_player_features.md",
    "improvements_apr26.md",
    "issues-and-improvements-2026-05-04.md",
    "production_audit_implementation_plan.md",
    "video_player_proposal.md",
    "player-controls.md"
]

files_to_delete = [
    "APP_TECH_STACK.md",
    "app-architecture.md",
    "app-screens.md"
]

for filename in files_to_move:
    src = os.path.join(ROOT_DIR, filename)
    dst = os.path.join(PROPOSALS_DIR, filename)
    if os.path.exists(src):
        shutil.move(src, dst)
        print(f"Moved {filename} to proposals/")

for filename in files_to_delete:
    src = os.path.join(ROOT_DIR, filename)
    if os.path.exists(src):
        os.remove(src)
        print(f"Deleted {filename}")

print("Docs reorganization completed.")
