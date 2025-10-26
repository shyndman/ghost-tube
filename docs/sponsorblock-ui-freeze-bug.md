# SponsorBlock UI Freezing Bug Analysis

This document details the investigation into a severe freezing bug related to the SponsorBlock integration, specifically its user interface component.

## 1. Bug Summary

A freezing bug was identified that occurs under the following conditions:

- **Trigger**: Performing a single-step scrub (e.g., pressing "seek forward 10s") on a video.
- **Symptom**: The player UI becomes unresponsive almost immediately (within seconds), followed by a complete freeze of video and audio playback.
- **Scope**: The bug is 100% reproducible on at least one specific video but not on others. Disabling SponsorBlock entirely prevents the bug.
- **Location**: The bug occurs even when scrubbing at the beginning of the video, far away from any actual sponsored segments.

## 2. Root Cause Analysis

The investigation concluded that the bug is not in the core segment-skipping logic of SponsorBlock, but in the UI component that draws segment markers on the player's progress bar (`buildOverlay` function in `src/sponsorblock.js`).

The root cause is a performance-intensive loop triggered by a conflict between SponsorBlock's DOM manipulation and the YouTube app's UI rendering framework.

### The Conflict Mechanism

1.  **DOM Interference**: The current implementation injects its own `<div>` elements directly into the HTML structure of the progress bar component, which is owned and managed by the YouTube app's rendering framework.

2.  **Reconciliation Failure**: When a scrub occurs, the YouTube app re-renders its progress bar. SponsorBlock's `MutationObserver` detects this and re-injects its segment markers into the new progress bar HTML. This manual DOM change corrupts the state of the framework's component.

3.  **Framework Error Recovery**: The next time the framework tries to perform a routine update to the progress bar (e.g., to reflect the new `currentTime`), its operation fails because the actual DOM no longer matches its internal model (its Virtual DOM). To recover from this corrupted state, the framework's only safe option is to destroy the entire progress bar component and re-render it from scratch.

4.  **The Loop**: This full re-render is detected by SponsorBlock's `MutationObserver` as another removal, which dutifully re-injects the markers, which corrupts the component again, forcing another error-recovery re-render. This cycle repeats as fast as the CPU can execute it, leading to a total system freeze.

### Video Specificity

The bug only manifests on certain videos because the HTML structure of the progress bar can differ (e.g., based on the presence of chapter markers). On the problematic video, the structure is such that it leads to this unstable feedback loop. On other videos, the component structure is different and happens to be resilient to this specific type of interference.

## 3. Proposed Solution: The Canvas Overlay

The ideal solution, as proposed during the investigation, is to decouple the SponsorBlock UI from the YouTube app's UI. This is achieved by using a `<canvas>` element positioned _over_ the progress bar, rather than injected _inside_ it.

### Why This Works

- **No DOM Interference**: The canvas is a separate element. The YouTube app's framework can manage its progress bar without any external modifications, preventing the reconciliation failure.
- **Decoupled**: The canvas's lifecycle is independent of the progress bar's. The framework can re-render its component as much as it wants, and the canvas overlay is unaffected.
- **Performant**: A single canvas element is more efficient for this task than injecting and managing multiple `<div>` elements.

### High-Level Implementation Guide

A developer with access to the live DOM would need to:

1.  **Modify `src/sponsorblock.js`**:

    - Replace the call to `buildOverlay()` with a new function that initializes the canvas overlay.
    - Remove the `durationchange` listener that is tied to the old `buildOverlay` function.

2.  **Implement the Canvas Overlay Logic**:
    - **Create a `<canvas>` element**.
    - **Append it to a high-level container**: Find a stable container element outside of the progress bar (e.g., the main player container) and append the canvas to it.
    - **Style the canvas**: Use CSS to position it absolutely over the progress bar, with `z-index` to ensure it's on top and `pointer-events: none` so it doesn't block remote control input.
    - **Draw the segments**: Create a function that takes the segment data and draws rectangles onto the canvas corresponding to the segment positions.
    - **Position and Size the Canvas**: The most critical part. The code will need to find the progress bar element in the DOM and use its dimensions (`getBoundingClientRect()`) to dynamically set the canvas's position and size to match it perfectly. A `ResizeObserver` or a safe `MutationObserver` could be used to detect when the progress bar appears or resizes and trigger a re-positioning of the canvas.
    - **Manage Visibility**: Tie the canvas's visibility (`display` or `opacity`) to the visibility of the main player controls.

This approach will resolve the freezing bug while retaining the segment visualization feature in a safe and performant way.
