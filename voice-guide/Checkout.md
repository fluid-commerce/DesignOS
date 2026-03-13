# Checkout

## What It Is

Fluid's Checkout is the full commerce transaction layer of the We-Commerce platform. It covers everything that happens from the moment a customer decides to buy through the moment an order is fulfilled — including products, pricing, subscriptions, enrollments, promo codes, and order management.

Checkout is purpose-built for direct selling. It handles the complexity that generic e-commerce platforms cannot: country-specific variant pricing, enrollment flows with compensation logic, subscription billing tied to commission engines, and ordering on behalf of others. All of this works out of the box, without plugins or custom development.

---

## Products

### Country-Level Variant Pricing
Fluid supports pricing at the variant level per country. A single product can have different prices for different markets — not just different currencies, but genuinely different prices — applied at the variant level. This is not natively available in Shopify, which may support country pricing through extensions or apps but does not offer it as a core platform feature.

This matters significantly for direct selling companies operating across multiple markets, where pricing strategies differ by region and cannot be treated as a simple currency conversion.

### Variants, Bundles, and Collections
Fluid supports full variant management (size, flavor, format, etc.), product bundles, collections, and category structures. Products can be organized into theme-based templates and display natively across the web experience with SEO optimization and translation support for international markets.

---

## Subscriptions

Subscriptions are a critical component of direct selling commerce. Fluid has invested heavily in subscription infrastructure and is at the forefront of subscription capabilities in the industry.

### Plan Flexibility
Each subscription plan supports independent configuration of three separate frequencies: billing frequency (how often the customer is charged), fulfillment frequency (how often the order ships), and volume frequency (how often CV/QV is applied for commission purposes). These can all be different from each other. This level of flexibility allows client companies to design any pricing strategy and subscription cadence their compensation plan requires.

Pricing on subscription plans can be set as a percentage discount from the standard product price, or as a fully separate subscription-specific price.

### Subscription Bundling
Reps and customers can opt into subscription bundling, which consolidates multiple separate subscriptions into a single billing date. Bundling applies to billing date, payment method, and volume assignment — each can be managed independently. This reduces the number of individual transactions and often saves customers on shipping and tax. Subscriptions remain individually manageable despite being bundled for billing.

### Subscription Recovery
Fluid includes dedicated subscription recovery logic within Fluid Payments. If a recurring subscription charge fails, the system works to recover it — not just retry once and lapse. Subscription recovery is closely integrated with Fluid Payments' decline recovery infrastructure.

### Subscription Management Portal
Customers, reps, and admins all have access to subscription management tools. Customers can pause, skip, cancel, change products, update payment methods, and modify their subscription cadence. All actions available to the customer are also available to administrators in the admin panel.

---

## Enrollments

Enrollment is one of the most important and complex transaction types in direct selling — and one of the areas where generic e-commerce platforms fall shortest. Fluid's enrollment infrastructure is a significant selling point.

### Enrollment Pack Flexibility
Enrollment packs can include one-time products, subscription products, or both. The company configures which products are included, at what pricing, and in what combination.

### Customizable Enrollment Forms
Enrollment forms are built directly in the Fluid admin UI. Forms can be configured to capture information either before or after payment, with fully customizable fields. Both required and optional custom agreements (terms, income disclosures, policies) can be attached to the enrollment flow.

### International Enrollment Support
Enrollment flows are built to handle international markets. Pricing, product availability, forms, and agreements can all be configured by country. Fluid provides pre-seeded enrollment forms and agreements for countries that have been activated in the admin, reducing the setup burden for companies expanding into new markets. This is one of Fluid's strongest selling points for internationally operating direct selling companies.

---

## Promo Codes

Fluid supports a full-featured promotional engine with significant configurability:

- **Discount types:** Percentage off, fixed dollar amount, free products, free shipping
- **Availability controls:** By country, by customer type (retail customer vs. distributor vs. new enrollment), by product, by collection
- **Timing:** Configurable start and end dates
- **Application:** Can be applied manually by the customer or triggered automatically based on cart conditions
- **Stacking:** Multiple promo codes can be applied to a single order

---

## Order on Behalf Of

Reps can place orders on behalf of a customer or contact and assign credit to a specific rep in the process — including themselves, or another rep if appropriate. This applies to both one-time orders and subscription orders. When credit is assigned to a rep on a subscription order, all subsequent recurring orders from that subscription will continue to carry that rep attribution.

Order on Behalf Of is particularly common in non-US markets where assisted ordering by a distributor is standard practice.

---

## Order Management

The admin provides a full order management interface including:

- Order history, statistics, and filtering
- Refunds — calculated automatically, applicable item by item or as a manual amount
- Fulfillment management — including split and held fulfillment for multi-item orders, with configurable shipping notification emails and tracking information
- Inventory management — same status framework as Shopify, with bulk edit options and warehouse support
- Order Journey — the FairShare attribution audit trail attached to every order (see FairShare documentation)

**Returns are not yet supported.** This capability is in development.

---

## Competitive Context

The combination of country-level variant pricing, enrollment-native flows, flexible subscription billing, and Order on Behalf Of makes Fluid's Checkout functionally incompatible with what generic e-commerce platforms offer. These are not features that can be replicated with plugins. They require a commerce layer that was designed for direct selling from the ground up.

Shopify's checkout was designed for anonymous guest transactions. Fluid's checkout was designed for logged-in commerce — enrolled distributors, repeat subscribers, and customers with relationships to specific reps. Those are fundamentally different problems.
