export const fixtures = {
  classic6M: `ishikawa
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
        Narrow tolerance
        Manual overrides
    Material
      Supplier batch variation
      Incorrect alloy mix
    Measurement
      Gauge out of calibration
      Sampling plan too sparse
    Mother Nature
      Humidity swings
      Temperature drift`,
  eightPEmoji: `ishikawa
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
      WIP imbalance`,
  longTokens: `ishikawa
  Problem: Part number mismatch
    Traceability
      PN-A-00000000000000000000000000000001
      PN-B-99999999999999999999999999999999
    Logistics
      lot-2024-09-14-extremely-long-token-without-breaks
      SHIP-REF-000000000000000000000000`,
  wideCategories: `ishikawa
  Problem: Wide layout test
    Cat-01
      Leaf 01-A
      Leaf 01-B
      Leaf 01-C
      Leaf 01-D
      Leaf 01-E
    Cat-02
      Leaf 02-A
      Leaf 02-B
      Leaf 02-C
      Leaf 02-D
      Leaf 02-E
    Cat-03
      Leaf 03-A
      Leaf 03-B
      Leaf 03-C
      Leaf 03-D
      Leaf 03-E
    Cat-04
      Leaf 04-A
      Leaf 04-B
      Leaf 04-C
      Leaf 04-D
      Leaf 04-E
    Cat-05
      Leaf 05-A
      Leaf 05-B
      Leaf 05-C
      Leaf 05-D
      Leaf 05-E
    Cat-06
      Leaf 06-A
      Leaf 06-B
      Leaf 06-C
      Leaf 06-D
      Leaf 06-E
    Cat-07
      Leaf 07-A
      Leaf 07-B
      Leaf 07-C
      Leaf 07-D
      Leaf 07-E
    Cat-08
      Leaf 08-A
      Leaf 08-B
      Leaf 08-C
      Leaf 08-D
      Leaf 08-E
    Cat-09
      Leaf 09-A
      Leaf 09-B
      Leaf 09-C
      Leaf 09-D
      Leaf 09-E
    Cat-10
      Leaf 10-A
      Leaf 10-B
      Leaf 10-C
      Leaf 10-D
      Leaf 10-E`,
  unevenDepth: `ishikawa
  Problem: Uneven depth
    People
      Training
        Onboarding
          Mentoring
      Coverage
    Process
      SOP gaps
    Machine
      Maintenance
        Schedule drift
          Shutdown backlog
    Material
      Supplier
      Inventory
        FIFO violations
          Warehouse layout`,
  duplicates: `ishikawa
  Problem: Duplicate labels
    People
      Training
      Training
      Training
    Process
      Validation
      Validation
    People
      Training`,
  punctuationHeavy: `ishikawa
  Problem: Punctuation hazards A/B test
    Man: people
      Hands-off mode?!
      Specs -> out-of-date
    Method: procedure
      Step-1: Init
      Step-2: Verify`,
  tinyWrap: `ishikawa
  Problem: Tiny wrap width
    Category
      VeryLongLabelThatShouldWrap
      Mixed 英文 and 中文 characters
      Emoji 🚧 label`,
};
