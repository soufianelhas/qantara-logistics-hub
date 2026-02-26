
1) Update `src/components/WorkflowStepper.tsx` only (no layout-wide resizing):
- Keep the step circle and icon sizes as-is (do not scale the whole stepper).
- Target only the active-state highlight element.

2) Rebuild active highlight so it intentionally wraps both the indicator ring and the two text lines:
- Replace current active overlay (`absolute ... rounded-full`) with a larger pill/oval overlay sized by axis-specific insets (separate X/Y).
- Keep `pointer-events-none` and place highlight behind content using z-index layering.

3) Prevent clipping/misalignment:
- Wrap icon + labels in a content container with stable vertical spacing.
- Ensure highlight uses enough vertical inset to fully contain label text and enough horizontal inset so it does not look tight around “Classify”.

4) Keep visual style consistent:
- Preserve current border/blur/theme palette.
- Keep pulse animation subtle, but ensure the oval boundary is clearly larger than the ring+text block.

5) Validation pass on all workflow pages:
- Check `HSNeuralNavigator`, `LandedCostEngine`, and `DocumentationWorkshop` step states.
- Confirm only the active-step oval changed, while the rest of the stepper size remains unchanged.
