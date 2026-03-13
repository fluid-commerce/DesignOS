# Fluid Connect

## What It Is

Fluid Connect is the data synchronization layer of the We-Commerce platform. It is the connective tissue that keeps a direct selling company's back-office systems — commission engines, product data, customer records, orders — continuously aligned with everything running on Fluid.

Most direct selling companies run their business on a commission engine such as Exigo, ByDesign, or Pillars. These systems are the source of truth for distributor trees, compensation calculations, and compliance. Connect bridges that world with Fluid's commerce experience, ensuring both systems always reflect reality — without manual exports, fragile scripts, or IT dependency.

The official external product name is **Fluid Connect**. Internally it may be referred to as "data sync" or "Sync," but those terms should not be used in marketing or client-facing materials.

---

## How It Works

### One-Click Back Office Connection
Connect uses Droplets — Fluid's extensibility layer — to establish the integration between a client's commission engine and the Fluid platform. A client provides their back office credentials, selects the appropriate Droplet (e.g., the Exigo Droplet, the ByDesign Droplet), and the connection is live. This is the one part of the Fluid platform where Droplets are foundational rather than optional: the back office Droplet is what makes Connect possible.

### Bi-Directional Data Flow
Connect moves data in both directions. Orders and customer activity generated on Fluid flow downstream into the commission engine. Product data, pricing, distributor trees, and compensation logic flow upstream into the Fluid platform. Companies can configure which system is the source of truth for each data type and whether syncs run automatically or are triggered manually.

### Automatic Syncing
Changes made in either system are reflected across the We-Commerce ecosystem without delay. Pricing updates, product availability changes, and new distributor enrollments stay consistent across web, mobile, live shopping, and rep-shared experiences — without requiring a manual export or an IT ticket.

### Complex Data Mapping
Direct selling back office data structures are often highly customized. Connect is built to handle that complexity. It maps a client's existing data structure — however non-standard — to the Fluid platform without requiring a system rebuild. This includes support for Exigo Pillars, ByDesign, InfoTrax, and other common commission engine architectures.

### Real-Time Visibility
Connect surfaces the status of every sync job in a clean dashboard — what ran, what succeeded, what failed, and why. If something breaks, the team sees it immediately and can act on it. This replaces the previous reality for most MLM companies: hidden server scripts, command-line tools, and a single IT person who knows where everything lives.

---

## Key Capabilities

**Automatic and manual sync options** — Companies can schedule syncs, run them automatically on a set frequency, or trigger them manually for specific use cases.

**Two-way sync with conflict resolution** — Clients choose which system wins for each data field in cases where both systems have conflicting values.

**Support for all major commission engines** — Exigo, ByDesign, Pillars, InfoTrax, and others are supported via dedicated Connect Droplets in the marketplace.

**Attribution preserved end-to-end** — FairShare attribution data travels with transactions as they flow into the commission engine, ensuring the right reps are credited downstream without reconciliation.

**Reduced operational drag** — Fewer manual imports. Fewer mismatched records. Fewer "why doesn't this match?" conversations between corporate and the field.

---

## On the Roadmap: Back Office Migration

Connect is building toward a capability that does not yet exist in the market: the ability for a direct selling company to migrate from one commission engine to another — for example, from ByDesign to Exigo — with minimal disruption and no data loss.

Many direct selling companies are effectively locked into their current back office because the cost and risk of migration feels prohibitive. Legacy data structures, customized compensation trees, and years of transaction history make switching feel impossible.

Fluid Connect is designed to remove that lock-in. The approved way to describe this capability in marketing materials is: **"Migrate between back offices without data loss."**

This feature is still in development and should not be presented as currently available. It can be referenced as a future capability or direction.

---

## Why It Matters

Most of the tools direct selling companies use to sync their back office to other systems were built by internal IT teams — shell scripts, scheduled exports, SFTP folders — and are understood by one or two people. When those people leave, the company is exposed.

Connect replaces all of that with one transparent, managed system. It is not trying to be impressive. It is trying to be dependable. And in commerce, dependability is what scales.

When systems agree, people trust them. When people trust the system, they move faster.

---

## Competitive Context

Traditional e-commerce platforms like Shopify have no native concept of a commission engine integration. The complex compensation logic that defines direct selling — downline attribution, CV/QV calculations, rank qualification — is not something Shopify was built to handle. Companies attempting to run a direct selling operation on Shopify are forced to build and maintain custom sync infrastructure on their own.

Connect makes this a solved problem, not an ongoing maintenance burden.
