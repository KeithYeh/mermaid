# Ishikawa (Fishbone)

> Ishikawa diagrams use a mindmap-style indentation tree to describe causes and sub-causes for a root problem.

## Example: 6M (Manufacturing)

```mermaid
ishikawa
  Problem: Excessive Scrap Rate
    Man
      Training gaps
      Shift handoff errors
        Missing checklist
        Unclear ownership
    Machine
      Worn spindle bearing
      Calibration drift
    Method
      Inconsistent setup
      Unstable process window
    Material
      Supplier batch variation
      Incorrect alloy mix
    Measurement
      Gauge out of calibration
      Sampling plan too sparse
    Mother Nature
      Humidity swings
      Temperature drift
```

## Example: 8P with mixed labels

```mermaid
%%{init: {"ishikawa": {"maxLabelWidth": 120}} }%%
ishikawa
  Problem: Line 3 Yield Drop 📉
    Product
      "P-AXX-5566778899"
      New revision "R2.1"
    Price
      Cost pressure
      Supplier quote variance
    Place
      Remote storage
      Long material travel
    Promotion
      Rush campaign schedule
    People
      Overtime fatigue
      Staffing gaps
    Process
      Rework loop
      Batch changeover delay
    Physical Evidence
      Full-width：記録表の欠落
      Labels peel off
    Productivity
      Cycle time variance
      WIP imbalance
```
