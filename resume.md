**Owais Ahmed Khan** | Senior Developer — Backend & Infrastructure  
**Location:** India · open to remote & relocation | **Phone:** \+91-7003080896 | **Email:** [oaak78692@gmail.com](mailto:oaak78692@gmail.com)  
**Portfolio:** [reaperoak.web.app](https://reaperoak.web.app/) | **GitHub:** [github.com/ReaperOAK](https://github.com/ReaperOAK) | **LinkedIn:** [linkedin.com/in/owaistech](https://linkedin.com/in/owaistech)

**Summary:** Backend and infrastructure engineer with **3 years building and operating production systems**. First engineer at **Cornflakes Media** — own architecture across all products and lead a team of 4\. Built and operate the backend and cloud infrastructure for a generative-AI media platform, from horizontal scale-out and load-shedding under saturation to a fail-closed billing ledger.

**Technical Skills**

* **Languages:** TypeScript, Python, Java, SQL, JavaScript (ES6+)  
* **Backend & Distributed Systems:** NestJS, FastAPI, Node.js, Express.js, REST APIs, microservices, BullMQ job queues, Socket.io, idempotency & replay safety, distributed rate limiting, JWT / RBAC  
* **Data:** PostgreSQL (pgbouncer, read replicas, Multi-AZ, query tuning), Redis / ElastiCache, MySQL, MongoDB, OpenSearch  
* **Cloud & Infrastructure:** AWS (Amazon Web Services) — EC2, RDS, ElastiCache, S3, Lambda; Docker, Kubernetes, GitHub Actions CI/CD (continuous integration & delivery)  
* **Observability & Testing:** Datadog, Sentry, k6 load testing, Playwright, Jest, Supertest  
* **AI Systems:** multi-model inference orchestration (Claude, GPT, Gemini, fal.ai, ElevenLabs), prompt systems, multimodal / vision pipelines  
* **Payments:** Stripe, Cashfree, Razorpay

**Experience**  
[**Cornflakes Media**](https://www.linkedin.com/company/cornflakesmedia) **([Opacity AI Pvt Ltd](https://www.linkedin.com/company/opacityai)) | Senior Developer (Founding Engineer) | Remote | Sept 2025 – Present**  
*First engineer hired; own architecture across all products and lead a team of 4\.*

* **Production infrastructure:** Led a **zero-downtime migration** from a single instance to a horizontally scaled, highly available setup on AWS — managed **PostgreSQL** with connection pooling and read replicas, **Redis**-backed rate limiting and idempotency.  
* **Performance & capacity:** Built a **k6** load-testing harness against production-like infrastructure and used it to find the system's saturation points; root-caused them to CPU-bound authentication and database connection-pool exhaustion, and brought worst-case login latency **from tens of seconds to sub-second** while roughly doubling throughput.  
* **Failure behavior:** Replaced a hang-under-load failure mode with **admission control and fast load-shedding** (`503` + `Retry-After`), eliminating server errors under burst traffic; showed experimentally that enlarging the connection pool *worsened* tail latency, and sized admission limits from queueing behavior instead of adding capacity.  
* **Billing correctness:** Designed an **atomic, fail-closed credit ledger** for metered AI usage, correct under concurrent spend, replayed webhooks, and partial payment-provider failures; built idempotent subscription, top-up, and refund flows that close double-spend paths.  
* **Generative-AI media platform:** Architected and built the platform (**Python/FastAPI \+ Java \+ NestJS \+ React**) that orchestrates multiple third-party foundation models for image, video, and audio generation, with a multilingual prompt system and multimodal vision.  
* **Cross-platform creator marketplace:** Led the build of an **iOS / Android / Web** marketplace on one **Expo/React Native \+ NestJS** codebase, with escrow payments, real-time messaging, and search.  
* **Developer infrastructure:** Replaced a cloud staging dependency with a local **Docker/MinIO** mirror of production storage and queues, cutting dev-infra cost and enabling a high-coverage integration test suite.  
* **Leadership:** Interviewed, hired, and lead 4 engineers across code review, mentoring, and standards; solo-built a separate B2B product MVP at the founder's request.

[**Kolkata Chess Academy**](https://kolkatachessacademy.in) **| Full-Stack Developer (Contract) | Kolkata, India | Oct 2024 – Sept 2025**

* Built a **LAMP** learning-management system from scratch with role-based student/coach dashboards and an interactive chess-training module (PGN parsing, **Stockfish** engine integration, real-time challenges).  
* Designed a secure **REST API with RBAC** over a multi-tenant backend; ran a **security self-audit** and remediated authentication, access-control, and input-validation defects.

[**Today Egg Rates**](https://todayeggrates.com/) **| Freelance Full-Stack Engineer | Remote | Nov 2023 – Oct 2024**

* Built and scaled a data platform (**React · PHP · MySQL**) to **7M+ impressions, 34.2K+ clicks, and 2K+ MAU**; cut database load **\~90%** and reached **sub-100ms** API response times via Redis caching, at **\~99.9% uptime**.  
* Shipped 5 interactive data visualizations and SEO-optimized pages, driving a **20% increase in organic traffic**; automated deploys with GitHub Actions.

**Projects**

* [**TicketVault**](https://github.com/ReaperOAK/TicketVault) **— Offline-Capable Ticketing with On-Chain Settlement** | *Aptos, Move, Next.js, Node.js* — Led a team of 3\. Built a **gasless relayer** letting users transact without holding crypto, plus **offline-first signed-JWT QR verification** that validates tickets at the gate with no network connectivity.

**Education & Achievements**  
**B.Tech in Computer Science & Engineering** | St. Thomas' College of Engineering & Technology, Kolkata | 2027

* **National Finalist — [Odoo Hackathon 2025](https://unstop.com/hackathons/odoo-hackathon-odoo-1464473)** (19,000+ participants): full-stack skill-swapping platform with real-time **Socket.IO** messaging. | [Prelims Project](https://github.com/ReaperOAK/odoo2k25) | [Finals Project](https://github.com/ReaperOAK/odoo-final-2025)  
* **HackerRank** — Gold Badge, Python.