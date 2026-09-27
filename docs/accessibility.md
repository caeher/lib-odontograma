# Odontogram accessibility

The `@odontogram/svg` schematic view exposes a labeled `group` containing keyboard-operable tooth and surface targets. Its sibling text equivalent is kept in sync with the visible teeth, presence, and marks. Tooth and surface accessible names include the configured tooth notation, presence, surface name where relevant, and applicable mark type/status. Selection is exposed with `aria-selected` / `aria-pressed`; color is not the only selection cue (the focus ring and these state properties remain available).

## Keyboard pattern

- Tab enters at the current roving target (the first visible tooth on first entry) and Tab/Shift+Tab leave the chart using normal browser order. The chart does not capture Tab.
- Right/Down moves forward and Left/Up moves backward through each visible tooth in dental layout order: tooth, then its applicable surfaces, then the next tooth. Navigation stops at the ends; it does not wrap.
- Enter or Space activates the focused tooth or surface using the same selection behavior as pointer activation.
- Escape from a surface returns focus to that tooth. Escape on a tooth is not captured, so it never traps focus.
- Focus is indicated by a high contrast outline. Disabled charts are removed from this navigation sequence.

## Text equivalent and announcements

The chart's `aria-describedby` points to a visually hidden text equivalent listing each visible tooth, its current presence, and marks with statuses and surface names. The SVG labels and text equivalent update after state changes. A polite status region announces explicit keyboard activation; focusing each target does not repeatedly read the complete chart. Tooth and surface controls expose toggle state through `aria-pressed`. Existing `detailDidChange` remains available for applications that need their own focused-target description or controls.

Accessible names, the text equivalent, and orientation labels follow the configured odontogram `locale`. An RTL locale sets direction on the surrounding interface; the chart itself remains left to right so screen coordinates continue to match patient right/left and the canonical quadrant layout. Custom control labels and custom mark catalog labels are supplied by the application and should be localized there.

## Verification record

- Automated DOM and keyboard interaction coverage is in `packages/svg/src/view-navigation.test.ts`: named chart, tooth state, marked surface name, synchronized text, roving Tab stop, arrow traversal, and Escape return.
- CSS provides a visible focus treatment and visually hidden text equivalent. Accessible names and state attributes provide non-color information.
- Manual screen-reader review has not been performed in this repository environment. Before release, manually check Tab entry/exit, arrows, Enter/Space, Escape, state/mark announcements, and text equivalent with NVDA + Firefox and VoiceOver + Safari. Confirm touch users can target the smallest surface at the published display size; touch-target sizing depends on the host's rendered chart dimensions.

The odontogram SVG has no native browser control semantics for its geometric surface regions, so screen-reader behavior should be verified in the consuming browser/assistive-technology combinations as part of release QA.
