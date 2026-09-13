# Supervisor pattern over parallel/swarm execution

The pipeline has a strict dependency order: Extractor must complete before Classifier can run (it needs the merchant and line items), and Classifier must complete before Advisor can run (it needs the category). Because there is no step that can run independently of its predecessor, a supervisor sequencing three subagents is the right fit. Parallel/swarm execution would add coordination complexity with no throughput benefit on a linear dependency chain.

## Considered Options

- **Swarm / debate** — multiple agents running in parallel and reconciling outputs. Appropriate for open-ended or adversarial tasks; not this pipeline.
- **Direct chaining (no supervisor)** — each subagent calls the next directly. Loses central aggregation of Usage and makes it harder to add a validation/retry step at the boundary.
