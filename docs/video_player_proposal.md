# Video Player Feature Audit & UX Proposal

Currently, the SKR Player includes a robust set of professional-grade features. Below is a breakdown of what exists today and how we can elevate the user experience.

## Current Control Set
| Category | Features |
| :--- | :--- |
| **Playback** | Play/Pause, Seek (Scrubbing), Double-Tap Seek (10s), Playback Speed (0.5x - 2x), Loop Modes. |
| **Gestures** | **Vertical (Right):** System Volume Control (New) <br> **Vertical (Left):** Brightness Control <br> **Horizontal:** Seek/Scrubbing <br> **Pinch:** Up to 3x Digital Zoom. |
| **UI Modes** | **Lock Mode:** Prevents accidental touches. <br> **Night Mode:** Reduces blue light/eye strain. <br> **Background Play:** Continuous audio when app is minimized. |
| **Advanced** | **Frame Capture:** High-quality screenshots. <br> **Trim Tool:** Create and save clips from longer videos. <br> **Queue:** "Up Next" panel for seamless binge-watching. |

---

## Proposed User-Friendly Add-ons

### 1. Visual Seek Preview (High Impact)
**Problem:** Users can't see what they are seeking to until they release the slider.
**Solution:** Show a small floating thumbnail or a "time-skip" indicator above the slider while dragging.

### 2. Sleep Timer
**Problem:** Users who listen to audio/videos at night don't want the battery to drain after they fall asleep.
**Solution:** Add a "Sleep Timer" option in the Quick Actions menu (15m, 30m, 1h, End of Video).

### 3. Gesture Discovery Hints
**Problem:** New users don't know they can swipe for volume or brightness.
**Solution:** On the first launch of the player, show subtle animated icons on the left/right sides to "teach" the gestures.

### 4. Audio Track & Subtitle Switcher
**Problem:** Multi-language videos or those with external subtitles are hard to manage.
**Solution:** Add a dedicated "Media Tracks" button to quickly toggle between internal audio streams and subtitle files.

### 5. Playback Completion "Next Video" Popup
**Problem:** When a video ends, the user has to manually open the queue to find the next one.
**Solution:** 5 seconds before a video ends, show a small "Up Next: [Title]" overlay with a "Play Now" button.

---

## Recommended Immediate Implementation
I recommend starting with the **Sleep Timer** and **Gesture Discovery Hints** as they provide immediate value with minimal complexity.

**Would you like me to implement any of these specific improvements next?**
