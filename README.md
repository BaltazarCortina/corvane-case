# Corvane: billing, customers at risk and data health

A prototype that helps Corvane Fire & Safety Services and its private equity owner answer three
questions: what is actually happening to revenue, which customers they are about to lose and why, and
whether the numbers can be trusted.

The build plan and its progress are in [docs/plan.md](docs/plan.md), and the choices behind the numbers
in [docs/decisions.md](docs/decisions.md).

## Run it

Requires Node 22 or later.

```bash
npm install
npm run pipeline # build the model, billing analysis and data findings from data/raw into data/build
npm run verify   # lint, typecheck and tests
```
