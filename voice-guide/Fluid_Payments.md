# Fluid Payments

## What It Is

Fluid Payments is the payment infrastructure layer of the We-Commerce platform. It is built specifically for the realities of direct selling commerce — higher-risk merchant classification, complex attribution requirements, international markets, subscription billing, and enrollment orders — rather than adapted from a generic e-commerce payment stack.

The official product name is **Fluid Payments**. Within this, **Fluid Pay** is a specific saved payment method product (analogous to Shop Pay), distinct from the broader Fluid Payments infrastructure.

Fluid Payments is not just a payment processor. It is a payment orchestration system — managing multiple processors, routing intelligently, recovering failed transactions, and ensuring every legitimate purchase has the best possible chance of going through.

---

## Core Philosophy

In traditional e-commerce, a 2–3% payment failure rate is considered acceptable. Platforms are playing a volume game where individual declined transactions are statistics.

Direct selling is different. A failed transaction isn't just a lost sale. It's a rep's contact — someone they've been nurturing for weeks. It's a new distributor's first order. It's a subscription that lapses and doesn't come back. The compound cost of a declined transaction in direct selling is far greater than in anonymous e-commerce.

Fluid Payments was built around a single principle: **every transaction matters.**

---

## How It Works

### Cascading Payment Retries
When a transaction is declined, Fluid Payments doesn't stop. It automatically retries the transaction in real time across multiple payment processors. Each processor has different card network rules, bank relationships, and approval logic. What fails on one processor may succeed on another — immediately, without the customer needing to do anything.

This is different from decline recovery (see below). Cascading retries are real-time. The customer never knows it happened.

### Decline Recovery
Decline recovery is a separate, more strategic capability that operates on a different timeline from cascading retries. When a transaction cannot be recovered in real time, decline recovery attempts to recover it over a period of days or weeks — using different data elements, responding to specific decline reason codes, and retrying on an intelligent schedule.

Fluid Payments integrates with specialized third-party decline recovery vendors and makes their capabilities available to merchants directly through the platform — no separate technical integration required on the merchant's side.

Cascading retries and decline recovery are two distinct features. Cascading retries are real-time, processor-level. Decline recovery is strategic, over time.

### Subscription Recovery
For subscription transactions specifically, Fluid Payments includes dedicated subscription recovery logic — ensuring that if a recurring charge fails, the system works to recover it rather than simply lapsing the subscription.

### Payment Orchestration (Rules-Based, Moving to AI)
Fluid Payments uses a multi-processor architecture with intelligent routing logic. Currently, routing decisions are rules-based — the system evaluates transaction characteristics and routes to the processor most likely to approve. AI-driven orchestration is coming soon and will further optimize routing dynamically.

### Network Tokens
Fluid Payments supports network tokens — a relatively new and not yet widely adopted payment technology. Network tokens are created by a customer's issuing bank and are unique to the Fluid platform and its merchants. This means subsequent purchases from that customer are more likely to be approved and carry a significantly lower fraud rate.

The tokens are owned by Fluid's merchants — not by Fluid, and not by a third-party processor — which is unusual in the industry and represents a meaningful long-term advantage. This is a strong value proposition for merchants who process high volume or operate in markets with elevated fraud rates.

### One-Click Checkout and Alternative Payment Methods
Fluid Payments includes a full suite of alternative payment methods (APMs) that are pre-integrated and available globally. These remove friction at the moment of purchase — the moment where intent is highest and friction is most costly.

**Currently live APMs include:** Apple Pay, PayPal, Fastlane (PayPal accelerated checkout), AliPay, GCash, iDEAL, Bancontact, Blik, P24, and others. Additional APMs are added regularly.

Fluid Pay is the platform's native saved payment method — similar to Shop Pay — allowing returning customers to check out with a single tap using a previously stored payment method.

### Built for Higher-Risk Commerce
Direct selling merchants are classified as higher-risk by payment processors. This means their baseline decline rates are already worse than a typical e-commerce merchant. Fluid Payments is built with this classification in mind — its processor relationships, routing logic, and fraud tools are calibrated for the direct selling context rather than generic e-commerce.

### Attribution-Aware Payments
Fluid Payments is integrated directly with FairShare. Every successful transaction is automatically tied to the correct rep attribution at the point of payment — no reconciliation, no post-processing, no disputes. The credit assignment happens as part of the payment flow itself.

---

## What's Coming

**AI-Driven Orchestration** — Payment routing will soon be optimized dynamically by AI rather than static rules, further improving approval rates.

**Cash Reconciliation** — Important for merchants running multiple payment processors, cash reconciliation is in development and will provide a unified view of funds across payment sources.

---

## Key Differentiators

- Multiple live processors with real-time cascading retry — not a single-processor solution
- Network tokens: merchant-owned, bank-issued, dramatically lower fraud rates
- Decline recovery via specialized vendors, integrated directly into the platform
- Full APM suite with global coverage, growing monthly
- Fastlane for PayPal accelerated checkout
- Subscription recovery built in
- Attribution embedded in the payment flow — no separate reconciliation
- Built for the higher-risk classification of direct selling, not adapted from generic e-commerce

---

## Competitive Context

Shopify Payments and Stripe are built for anonymous e-commerce transactions — guest checkouts, single-step purchases, standard merchant classifications. They are not built for the layered complexity of direct selling: recurring subscriptions tied to compensation plans, enrollment orders with downline attribution, international transactions that need to route through rep-specific commission logic.

The result for direct selling companies using generic payment infrastructure is predictable: higher decline rates, lost subscriptions, broken attribution, and frustrated reps who learn that sending customers to the website is a gamble.

Fluid Payments exists to make that gamble into a certainty — or as close to one as payment infrastructure can get.
