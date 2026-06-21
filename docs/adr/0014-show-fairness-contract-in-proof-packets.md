# Show fairness contract in proof packets

Every Proof Packet will expose a Fairness Contract that lists the controls for the run: same task prompt, same instrumented agent, same model/version, same time budget, same starting app functionality, same acceptance tests, same scenario fixture version, no hand-editing after the run, failed attempts counted, and every metric linked to raw evidence. Database-native data models remain allowed because identical schemas would make the comparison less fair, not more fair.
